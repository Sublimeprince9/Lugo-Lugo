import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { authorizeOrganizer } from '@/lib/organizer-server';
import { VENDOR_PHOTO_BUCKET } from '@/lib/vendor-application';
import type { SupabaseResponseCookie } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const reviewBodySchema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(['needs_changes', 'approved', 'rejected']),
  reviewNotes: z.string().trim().max(1000),
  stallNumber: z.string().trim().max(32).nullable().optional(),
  zoneId: z.string().uuid().nullable().optional(),
  mapX: z.number().int().min(0).max(100).nullable().optional(),
  mapY: z.number().int().min(0).max(100).nullable().optional(),
}).strict();
const applicationSchema = z.object({
  id: z.string().uuid(),
  business_name: z.string(),
  contact_name: z.string(),
  contact_email: z.string(),
  whatsapp: z.string(),
  website_url: z.string().nullable(),
  stall_number: z.string().nullable(),
  category: z.string(),
  description: z.string(),
  zone_id: z.string().uuid().nullable(),
  map_x: z.number().int().nullable(),
  map_y: z.number().int().nullable(),
  photo_paths: z.array(z.string()),
  photo_consent: z.boolean(),
  gift_title: z.string().nullable(),
  gift_details: z.string().nullable(),
  gift_quantity: z.number().int().nullable(),
  status: z.enum(['pending_review', 'needs_changes', 'approved', 'rejected']),
  review_notes: z.string().nullable(),
  created_at: z.string(),
  reviewed_at: z.string().nullable(),
});
const zoneSchema = z.object({ id: z.string().uuid(), name: z.string() });
const reviewResultSchema = z.object({
  success: z.literal(true),
  status: z.enum(['needs_changes', 'approved', 'rejected']),
  stallId: z.string().uuid().nullable(),
  rewardId: z.string().uuid().nullable(),
});
const eventSchema = z.object({ id: z.string().uuid() });

function response(
  body: unknown,
  status: number,
  cookiesToSet: SupabaseResponseCookie[] = [],
) {
  const result = NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
  cookiesToSet.forEach(({ name, value, options }) => result.cookies.set(name, value, options));
  return result;
}

export async function GET(request: NextRequest) {
  const cookiesToSet = new Map<string, SupabaseResponseCookie>();
  const sendResponse = (body: unknown, status: number) => response(body, status, Array.from(cookiesToSet.values()));
  const access = await authorizeOrganizer(
    request,
    (cookies) => cookies.forEach((cookie) => cookiesToSet.set(cookie.name, cookie)),
  );
  if (!access.authorized) return sendResponse({ error: access.error }, access.status);

  const { data: eventData, error: eventError } = await access.admin
    .from('events')
    .select('id')
    .eq('slug', 'uma-fair-2026')
    .maybeSingle();
  if (eventError) {
    console.error('Could not load the organizer review event.', eventError);
    return sendResponse({ error: 'Could not load the event for vendor review.' }, 500);
  }
  const event = eventSchema.safeParse(eventData);
  if (!event.success) {
    console.error('Organizer review event is missing or invalid.', event.success ? undefined : event.error);
    return sendResponse({ error: 'The event for vendor review is unavailable.' }, 503);
  }

  const { data, error } = await access.admin
    .from('vendor_applications')
    .select('id, business_name, contact_name, contact_email, whatsapp, website_url, stall_number, category, description, zone_id, map_x, map_y, photo_paths, photo_consent, gift_title, gift_details, gift_quantity, status, review_notes, created_at, reviewed_at')
    .eq('event_id', event.data.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('Could not load vendor applications for organizer review.', error);
    return sendResponse({ error: 'Could not load vendor applications.' }, 500);
  }

  const parsedApplications = z.array(applicationSchema).safeParse(data);
  if (!parsedApplications.success) {
    console.error('Organizer application query returned invalid data.', parsedApplications.error);
    return sendResponse({ error: 'Vendor applications returned an invalid response.' }, 500);
  }

  const { data: zonesData, error: zonesError } = await access.admin
    .from('zones')
    .select('id, name')
    .eq('event_id', event.data.id)
    .order('name');
  if (zonesError) {
    console.error('Could not load organizer application zones.', zonesError);
    return sendResponse({ error: 'Could not load application map locations.' }, 500);
  }
  const zones = z.array(zoneSchema).safeParse(zonesData);
  if (!zones.success) {
    console.error('Organizer application zones returned invalid data.', zones.error);
    return sendResponse({ error: 'Application map locations returned an invalid response.' }, 500);
  }
  const zoneNames = new Map(zones.data.map((zone) => [zone.id, zone.name]));

  const allPhotoPaths = parsedApplications.data.flatMap((application) => application.photo_paths);
  const signedUrls = allPhotoPaths.length > 0
    ? await access.admin.storage.from(VENDOR_PHOTO_BUCKET).createSignedUrls(allPhotoPaths, 15 * 60)
    : { data: [], error: null };
  if (signedUrls.error || signedUrls.data?.some((entry) => entry.error || !entry.signedUrl)) {
    console.error('Could not create private vendor photo preview URLs.', signedUrls.error);
    return sendResponse({ error: 'Could not load vendor application photos.' }, 500);
  }
  const photoUrls = new Map((signedUrls.data ?? []).flatMap((entry) =>
    entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl] as const] : [],
  ));

  return sendResponse({
    success: true,
    zones: zones.data,
    applications: parsedApplications.data.map((application) => ({
      id: application.id,
      businessName: application.business_name,
      contactName: application.contact_name,
      contactEmail: application.contact_email,
      whatsapp: application.whatsapp,
      websiteUrl: application.website_url,
      stallNumber: application.stall_number,
      category: application.category,
      description: application.description,
      zoneId: application.zone_id,
      zoneName: application.zone_id ? zoneNames.get(application.zone_id) ?? 'Unknown zone' : null,
      mapX: application.map_x === null ? null : Math.round(application.map_x / 9.6),
      mapY: application.map_y === null ? null : Math.round(application.map_y / 7),
      photoConsent: application.photo_consent,
      photos: application.photo_paths.map((path) => photoUrls.get(path)).filter((url): url is string => Boolean(url)),
      giftTitle: application.gift_title,
      giftDetails: application.gift_details,
      giftQuantity: application.gift_quantity,
      status: application.status,
      reviewNotes: application.review_notes,
      createdAt: application.created_at,
      reviewedAt: application.reviewed_at,
    })),
  }, 200);
}

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ error: 'Request body must be valid JSON.' }, 400);
  }
  const parsedBody = reviewBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return response({ error: parsedBody.error.issues[0]?.message ?? 'Review details are invalid.' }, 400);
  }

  const cookiesToSet = new Map<string, SupabaseResponseCookie>();
  const sendResponse = (result: unknown, status: number) => response(result, status, Array.from(cookiesToSet.values()));
  const access = await authorizeOrganizer(
    request,
    (cookies) => cookies.forEach((cookie) => cookiesToSet.set(cookie.name, cookie)),
  );
  if (!access.authorized) return sendResponse({ error: access.error }, access.status);

  const { data, error } = await access.admin.rpc('review_vendor_application', {
    p_application_id: parsedBody.data.applicationId,
    p_status: parsedBody.data.status,
    p_review_notes: parsedBody.data.reviewNotes || null,
    p_reviewed_by: access.userId,
    p_stall_number: parsedBody.data.stallNumber ?? null,
    p_zone_id: parsedBody.data.zoneId ?? null,
    p_map_x: parsedBody.data.mapX === undefined || parsedBody.data.mapX === null
      ? null
      : Math.round(parsedBody.data.mapX * 9.6),
    p_map_y: parsedBody.data.mapY === undefined || parsedBody.data.mapY === null
      ? null
      : Math.round(parsedBody.data.mapY * 7),
  });
  if (error) {
    if (error.code === '23505') {
      return sendResponse({ error: 'That stall number is already in use. Verify the application before approving it.' }, 409);
    }
    if (error.code === '23514') {
      return sendResponse({ error: 'An approved application cannot be changed through this review queue.' }, 409);
    }
    if (error.code === '22023') {
      return sendResponse({ error: 'Assign a valid stall number, event zone, and map position before approving.' }, 400);
    }
    if (error.code === 'P0002') return sendResponse({ error: 'The application no longer exists.' }, 404);
    if (error.code === '42883' || error.code === 'PGRST202') {
      console.error('Organizer review migration is not installed.', error);
      return sendResponse({ error: 'Organizer review is not enabled on this server yet.' }, 503);
    }
    console.error('Could not review vendor application.', error);
    return sendResponse({ error: 'Could not update this application.' }, 500);
  }

  const result = reviewResultSchema.safeParse(data);
  if (!result.success) {
    console.error('Vendor review RPC returned invalid data.', result.error);
    return sendResponse({ error: 'The review result was invalid.' }, 500);
  }
  return sendResponse(result.data, 200);
}
