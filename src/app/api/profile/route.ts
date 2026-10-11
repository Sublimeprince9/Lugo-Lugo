import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import {
  createRequestSupabaseClient,
  getSupabaseServerConfig,
  type SupabaseResponseCookie,
} from '@/lib/supabase/server';

const eventSlug = 'uma-fair-2026';
const zoneSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

function response(body: unknown, status: number, cookiesToSet: SupabaseResponseCookie[] = []) {
  const result = NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
  cookiesToSet.forEach(({ name, value, options }) => result.cookies.set(name, value, options));
  return result;
}

export async function GET(request: NextRequest) {
  let config;
  try {
    config = getSupabaseServerConfig();
  } catch (cause) {
    console.error('Profile service is not configured.', cause);
    return response({ error: 'Profile is unavailable because the server is not configured.' }, 503);
  }

  const cookiesToSet = new Map<string, SupabaseResponseCookie>();
  const supabase = createRequestSupabaseClient(
    request,
    config.url,
    config.anonKey,
    (cookies) => cookies.forEach((cookie) => cookiesToSet.set(cookie.name, cookie)),
  );
  const sendResponse = (body: unknown, status: number) => response(body, status, Array.from(cookiesToSet.values()));

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return sendResponse({ error: 'Sign in as a visitor to view your profile.' }, 401);
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id')
    .eq('slug', eventSlug)
    .maybeSingle();
  if (eventError) {
    console.error('Could not load the profile event.', eventError);
    return sendResponse({ error: 'Could not load your event profile.' }, 500);
  }
  if (!event) {
    return sendResponse({ error: 'The active event is unavailable.' }, 404);
  }

  const { data: eventStalls, error: eventStallsError } = await supabase
    .from('stalls')
    .select('id, zone_id')
    .eq('event_id', event.id);
  if (eventStallsError || !eventStalls) {
    console.error('Could not load stalls for the visitor profile.', eventStallsError);
    return sendResponse({ error: 'Could not load your event profile.' }, 500);
  }

  const [profileResult, progressResult, checkinsResult, rewardsResult, claimsResult, zonesResult] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', authData.user.id).maybeSingle(),
    supabase.from('event_progress').select('coins, stalls_visited').eq('profile_id', authData.user.id).eq('event_id', event.id).maybeSingle(),
    supabase.from('checkins').select('stall_id, created_at, stalls(stall_number, title)').eq('profile_id', authData.user.id).eq('event_id', event.id).order('created_at', { ascending: false }),
    supabase.from('rewards').select('id, title, kind, requires_verified_phone, stall_id').eq('is_active', true).in('stall_id', eventStalls.map((stall) => stall.id)),
    supabase.from('claims').select('reward_id, code, redeemed_at').eq('profile_id', authData.user.id),
    supabase.from('zones').select('id, name').eq('event_id', event.id).order('name'),
  ]);

  const queryError = [
    profileResult.error,
    progressResult.error,
    checkinsResult.error,
    rewardsResult.error,
    claimsResult.error,
    zonesResult.error,
  ].find(Boolean);
  if (queryError) {
    console.error('Could not load visitor profile data.', queryError);
    return sendResponse({ error: 'Could not load your saved profile. Please try again.' }, 500);
  }

  if (!checkinsResult.data || !rewardsResult.data || !claimsResult.data || !zonesResult.data) {
    console.error('Profile query returned missing result data.');
    return sendResponse({ error: 'Could not load your saved profile. Please try again.' }, 500);
  }

  const claimsByReward = new Map(claimsResult.data.map((claim) => [claim.reward_id, claim]));
  const stallCheckins = new Set(checkinsResult.data.map((checkin) => checkin.stall_id));
  const zones = z.array(zoneSchema).safeParse(zonesResult.data);
  if (!zones.success) {
    console.error('Profile query returned invalid zone data.', zones.error);
    return sendResponse({ error: 'Could not load your event progress.' }, 500);
  }
  const zoneCounts = new Map(zones.data.map((zone) => [zone.id, {
    ...zone,
    visited: 0,
    total: 0,
  }]));
  for (const stall of eventStalls) {
    const zone = stall.zone_id ? zoneCounts.get(stall.zone_id) : undefined;
    if (!zone) continue;
    zone.total += 1;
    if (stallCheckins.has(stall.id)) zone.visited += 1;
  }
  const checkinSchema = z.object({
    stall_number: z.string(),
    title: z.string(),
  });
  const formattedCheckins = checkinsResult.data.map((checkin) => {
    const stall = checkinSchema.safeParse(checkin.stalls);
    if (!stall.success) {
      console.error('Profile check-in references invalid stall data.', stall.error);
      return null;
    }
    return {
      stallNumber: stall.data.stall_number,
      title: stall.data.title,
      checkedInAt: checkin.created_at,
    };
  });
  if (formattedCheckins.some((checkin) => checkin === null)) {
    return sendResponse({ error: 'Your saved check-in data could not be loaded.' }, 500);
  }

  return sendResponse({
    success: true,
    username: profileResult.data?.username ?? 'Explorer',
    coins: progressResult.data?.coins ?? 0,
    stallsVisited: progressResult.data?.stalls_visited ?? 0,
    totalStalls: eventStalls.length,
    zones: Array.from(zoneCounts.values()).map((zone) => ({
      id: zone.id,
      name: zone.name,
      visited: zone.visited,
      total: zone.total,
    })),
    checkins: formattedCheckins,
    rewards: rewardsResult.data.map((reward) => ({
      id: reward.id,
      title: reward.title,
      kind: reward.kind,
      isActive: true,
      requiresVerifiedPhone: reward.requires_verified_phone,
      checkedInAtStall: stallCheckins.has(reward.stall_id),
      claimed: claimsByReward.has(reward.id),
      claimCode: claimsByReward.get(reward.id)?.code ?? null,
      redeemed: claimsByReward.get(reward.id)?.redeemed_at !== null
        && claimsByReward.get(reward.id)?.redeemed_at !== undefined,
    })),
  }, 200);
}
