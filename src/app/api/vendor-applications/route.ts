import { createHmac, randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import {
  createAdminSupabaseClient,
  getSupabaseServerConfig,
} from '@/lib/supabase/server';
import {
  isSupportedVendorPhoto,
  vendorApplicationSchema,
  VENDOR_PHOTO_BUCKET,
  VENDOR_PHOTO_MAX_BYTES,
  VENDOR_PHOTO_MAX_COUNT,
} from '@/lib/vendor-application';

export const runtime = 'nodejs';

const eventSlug = 'uma-fair-2026';
const photoMimeTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function parseOptionalInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  const maxBodyBytes = VENDOR_PHOTO_MAX_BYTES * VENDOR_PHOTO_MAX_COUNT + 1024 * 1024;
  if (contentLength > maxBodyBytes) {
    return response({ error: 'The application and photos are too large to submit.' }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return response({ error: 'Please submit the vendor application form again.' }, 400);
  }

  const files = form.getAll('photos').filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > VENDOR_PHOTO_MAX_COUNT) {
    return response({ error: `Choose no more than ${VENDOR_PHOTO_MAX_COUNT} photos.` }, 400);
  }

  const rawQuantity = parseOptionalInteger(form.get('giftQuantity'));
  if (Number.isNaN(rawQuantity)) {
    return response({ error: 'Gift quantity must be a whole number.' }, 400);
  }
  const giftTitle = String(form.get('giftTitle') ?? '');
  const giftDetails = String(form.get('giftDetails') ?? '');
  const input = {
    businessName: form.get('businessName'),
    contactName: form.get('contactName'),
    contactEmail: form.get('contactEmail'),
    whatsapp: form.get('whatsapp'),
    websiteUrl: form.get('websiteUrl') ?? '',
    stallNumber: form.get('stallNumber'),
    category: form.get('category'),
    description: form.get('description'),
    zoneName: form.get('zoneName') ?? '',
    mapX: parseOptionalInteger(form.get('mapX')),
    mapY: parseOptionalInteger(form.get('mapY')),
    giftTitle,
    giftDetails,
    giftQuantity: rawQuantity,
    photoConsent: form.get('photoConsent') === 'true' ? 'true' : 'false',
    hasPhotos: files.length > 0,
  };
  const parsed = vendorApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return response({ error: parsed.error.issues[0]?.message ?? 'Please check the application fields.' }, 400);
  }

  const photoBytes: Array<{ file: File; bytes: Uint8Array; extension: string }> = [];
  let totalPhotoBytes = 0;
  for (const file of files) {
    const extension = photoMimeTypes.get(file.type);
    if (!extension || file.size > VENDOR_PHOTO_MAX_BYTES) {
      return response({ error: 'Photos must be JPEG, PNG, or WebP, and no larger than 5 MB each.' }, 400);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isSupportedVendorPhoto(bytes, file.type)) {
      return response({ error: 'One of the selected files is not a valid JPEG, PNG, or WebP image.' }, 400);
    }
    totalPhotoBytes += bytes.byteLength;
    photoBytes.push({ file, bytes, extension });
  }
  if (totalPhotoBytes > VENDOR_PHOTO_MAX_BYTES * VENDOR_PHOTO_MAX_COUNT) {
    return response({ error: 'The selected photos are too large to submit together.' }, 400);
  }

  let config;
  try {
    config = getSupabaseServerConfig();
  } catch (cause) {
    console.error('Vendor application service is not configured.', cause);
    return response({ error: 'Vendor applications are unavailable because the server is not configured.' }, 503);
  }

  const admin = createAdminSupabaseClient(config.url, config.serviceRoleKey);
  const ipAddress = request.headers.get('x-real-ip') ?? 'unknown';
  const ipHash = createHmac('sha256', config.qrSigningSecret).update(`vendor-application:${ipAddress}`).digest('hex');
  const { data: allowed, error: rateLimitError } = await admin.rpc('reserve_vendor_application_submission', {
    p_ip_hash: ipHash,
  });
  if (rateLimitError) {
    console.error('Could not check vendor application submission limit.', rateLimitError);
    return response({ error: 'Could not submit your application right now. Please try again later.' }, 503);
  }
  if (allowed !== true) {
    return response({ error: 'Too many applications from this connection. Please try again in an hour.' }, 429);
  }

  const { data: event, error: eventError } = await admin
    .from('events')
    .select('id')
    .eq('slug', eventSlug)
    .eq('is_published', true)
    .maybeSingle();
  if (eventError) {
    console.error('Could not load the active event for a vendor application.', eventError);
    return response({ error: 'Could not verify the event. Please try again later.' }, 503);
  }
  if (!event) return response({ error: 'Vendor applications are not open for this event.' }, 404);

  let zoneId: string | null = null;
  if (parsed.data.zoneName) {
    const { data: zone, error: zoneError } = await admin
      .from('zones')
      .select('id')
      .eq('event_id', event.id)
      .eq('name', parsed.data.zoneName)
      .maybeSingle();
    if (zoneError) {
      console.error('Could not verify the vendor application zone.', zoneError);
      return response({ error: 'Could not verify the map location. Please try again later.' }, 503);
    }
    if (!zone) return response({ error: 'Select a zone from the active event map.' }, 400);
    zoneId = zone.id;
  }

  const uploadedPaths: string[] = [];
  let uploadFailure: string | null = null;
  for (const { bytes, extension, file } of photoBytes) {
    const path = `${randomUUID()}.${extension}`;
    const { error } = await admin.storage.from(VENDOR_PHOTO_BUCKET).upload(path, bytes, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      console.error('Could not store vendor application photo.', error);
      uploadFailure = 'Could not upload your photos. Please try again.';
      break;
    }
    uploadedPaths.push(path);
  }
  if (uploadFailure) {
    if (uploadedPaths.length > 0) {
      const { error } = await admin.storage.from(VENDOR_PHOTO_BUCKET).remove(uploadedPaths);
      if (error) console.error('Could not remove partial vendor application photo uploads.', error);
    }
    return response({ error: uploadFailure }, 503);
  }

  const { data: application, error: insertError } = await admin
    .from('vendor_applications')
    .insert({
      event_id: event.id,
      business_name: parsed.data.businessName,
      contact_name: parsed.data.contactName,
      contact_email: parsed.data.contactEmail,
      whatsapp: parsed.data.whatsapp,
      website_url: parsed.data.websiteUrl,
      stall_number: parsed.data.stallNumber,
      category: parsed.data.category,
      description: parsed.data.description,
      zone_id: zoneId,
      map_x: parsed.data.mapX === null ? null : Math.round(parsed.data.mapX * 9.6),
      map_y: parsed.data.mapY === null ? null : Math.round(parsed.data.mapY * 7),
      photo_paths: uploadedPaths,
      photo_consent: parsed.data.photoConsent === 'true',
      gift_title: parsed.data.giftTitle || null,
      gift_details: parsed.data.giftDetails || null,
      gift_quantity: parsed.data.giftQuantity,
    })
    .select('id')
    .single();
  if (insertError) {
    console.error('Could not save vendor application.', insertError);
    if (uploadedPaths.length > 0) {
      const { error } = await admin.storage.from(VENDOR_PHOTO_BUCKET).remove(uploadedPaths);
      if (error) console.error('Could not remove photos from a failed vendor application.', error);
    }
    if (insertError.code === '42P01' || insertError.code === 'PGRST205') {
      return response({ error: 'Vendor applications are not enabled yet. Please contact the event organizer.' }, 503);
    }
    return response({ error: 'Could not save your application. Please try again.' }, 500);
  }

  const result = z.object({ id: z.string().uuid() }).safeParse(application);
  if (!result.success) {
    console.error('Vendor application insert returned an invalid result.', result.error);
    return response({ error: 'Your application may have been saved, but its confirmation could not be created. Contact the event organizer before submitting again.' }, 500);
  }
  return response({ success: true, applicationId: result.data.id }, 201);
}
