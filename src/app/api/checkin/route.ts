import { createHmac } from 'node:crypto';
import { type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { parseStaticToken, verifyStaticToken } from '@/lib/qr';
import {
  createAdminSupabaseClient,
  createRequestSupabaseClient,
  getSupabaseServerConfig,
  type SupabaseResponseCookie,
} from '@/lib/supabase/server';

const checkinBodySchema = z.object({
  token: z.string().trim().min(1).max(2048),
}).strict();

const uuidSchema = z.string().uuid();
const checkinResultSchema = z.object({
  success: z.literal(true),
  checkinId: z.string().uuid(),
  coinsAwarded: z.number().int().nonnegative(),
  stallsVisited: z.number().int().nonnegative(),
  zoneProgress: z.object({
    zoneId: z.string().uuid(),
    visited: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    percentage: z.number().int().min(0).max(100),
  }).nullable(),
  voucherAvailable: z.boolean(),
});
const checkinFailureSchema = z.object({
  success: z.literal(false),
  error: z.enum(['CHECKIN_ALREADY_RECORDED', 'RATE_LIMITED', 'STALL_NOT_AVAILABLE']),
});

function response(body: unknown, status: number, cookiesToSet: SupabaseResponseCookie[] = []) {
  const result = NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
  cookiesToSet.forEach(({ name, value, options }) => result.cookies.set(name, value, options));
  return result;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ error: 'Request body must be valid JSON.' }, 400);
  }

  const parsed = checkinBodySchema.safeParse(body);
  if (!parsed.success) {
    return response({ error: 'A valid QR token is required.' }, 400);
  }

  let config;
  try {
    config = getSupabaseServerConfig();
  } catch (cause) {
    console.error('Check-in service is not configured.', cause);
    return response({ error: 'Check-in is unavailable because the server is not configured.' }, 503);
  }

  const cookiesToSet = new Map<string, SupabaseResponseCookie>();
  const userClient = createRequestSupabaseClient(
    request,
    config.url,
    config.anonKey,
    (cookies) => cookies.forEach((cookie) => cookiesToSet.set(cookie.name, cookie)),
  );
  const sendResponse = (result: unknown, status: number) => response(
    result,
    status,
    Array.from(cookiesToSet.values()),
  );
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return sendResponse({ error: 'Sign in as a visitor before checking in.' }, 401);
  }

  const tokenStallId = parseStaticToken(parsed.data.token);
  if (!tokenStallId || !uuidSchema.safeParse(tokenStallId).success) {
    return sendResponse({ error: 'This QR code is invalid or has been changed.' }, 400);
  }

  const adminClient = createAdminSupabaseClient(config.url, config.serviceRoleKey);
  const { data: stall, error: stallError } = await adminClient
    .from('stalls')
    .select('id, qr_secret, stall_number, title, category, event_id, zone_id, checkin_coins')
    .eq('id', tokenStallId)
    .maybeSingle();

  if (stallError) {
    console.error('Could not load private stall QR data.', stallError);
    return sendResponse({ error: 'Could not validate this stall QR code.' }, 500);
  }
  if (!stall) {
    return sendResponse({ error: 'This stall QR code is not recognized.' }, 404);
  }
  if (!verifyStaticToken(parsed.data.token, stall.id, stall.qr_secret, config.qrSigningSecret)) {
    return sendResponse({ error: 'This QR code is invalid or has been changed.' }, 400);
  }

  const forwardedIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const clientIp = forwardedIp || request.headers.get('x-real-ip') || 'unknown';
  const ipHash = createHmac('sha256', config.qrSigningSecret)
    .update(`ip:${clientIp}`)
    .digest('hex');

  const { data: checkinResult, error: checkinError } = await userClient.rpc('checkin_stall', {
    p_stall_id: stall.id,
    p_ip_hash: ipHash,
  });

  if (checkinError) {
    if (checkinError.code === '28000') {
      return sendResponse({ error: 'Sign in as a visitor before checking in.' }, 401);
    }
    console.error('Atomic stall check-in failed.', checkinError);
    return sendResponse({ error: 'Check-in could not be completed. Please try again.' }, 500);
  }
  const failure = checkinFailureSchema.safeParse(checkinResult);
  if (failure.success) {
    if (failure.data.error === 'CHECKIN_ALREADY_RECORDED') {
      return sendResponse({ error: 'You have already checked in at this stall.' }, 409);
    }
    if (failure.data.error === 'RATE_LIMITED') {
      return sendResponse({ error: 'Too many check-in attempts. Wait a few minutes and try again.' }, 429);
    }
    return sendResponse({ error: 'This stall is not available for check-in right now.' }, 404);
  }
  const validatedResult = checkinResultSchema.safeParse(checkinResult);
  if (!validatedResult.success) {
    console.error('Check-in RPC returned an invalid result.', validatedResult.error);
    return sendResponse({ error: 'Check-in could not be completed. Please try again.' }, 500);
  }

  return sendResponse({
    stall: {
      id: stall.id,
      stallNumber: stall.stall_number,
      title: stall.title,
      category: stall.category,
      eventId: stall.event_id,
      zoneId: stall.zone_id,
    },
    ...validatedResult.data,
  }, 200);
}
