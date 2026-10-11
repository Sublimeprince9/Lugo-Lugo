import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const eventSlug = 'uma-fair-2026';
const eventSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  venue: z.string().nullable(),
  slug: z.string(),
});
const stallSchema = z.object({
  id: z.string().uuid(),
  stall_number: z.string(),
  title: z.string(),
  category: z.enum(['Luxury', 'Food', 'Drinks', 'Science', 'Farming', 'Tech', 'Other']),
  zone: z.string().nullable(),
  map_x: z.number().int(),
  map_y: z.number().int(),
  description: z.string(),
  whatsapp_number: z.string().nullable(),
  website_url: z.string().nullable(),
  price_range: z.string().nullable(),
});
const rewardSchema = z.object({
  stall_number: z.string(),
  has_gift_reward: z.boolean(),
});
const leaderboardSchema = z.object({
  username: z.string(),
  coins: z.number().int().nonnegative(),
  stalls_visited: z.number().int().nonnegative(),
  rank: z.number().int().positive(),
});

export const dynamic = 'force-dynamic';

function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return failure('Event data is unavailable because Supabase is not configured.', 503);
  }

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .select('id, name, venue, slug')
    .eq('slug', eventSlug)
    .maybeSingle();
  if (eventError) {
    console.error('Could not load the published event.', eventError);
    return failure('Could not load event details.', 500);
  }
  const event = eventSchema.safeParse(eventData);
  if (!event.success) {
    console.error('Published event data is missing or invalid.', event.error);
    return failure('The active event is unavailable.', 404);
  }

  const [stallResult, leaderboardResult] = await Promise.all([
    supabase
      .from('stalls_public')
      .select('id, stall_number, title, category, zone, map_x, map_y, description, whatsapp_number, website_url, price_range')
      .eq('event_slug', eventSlug)
      .order('stall_number'),
    supabase
      .from('leaderboard')
      .select('username, coins, stalls_visited, rank')
      .eq('event_id', event.data.id)
      .order('rank')
      .limit(100),
  ]);

  if (stallResult.error || leaderboardResult.error) {
    const error = stallResult.error ?? leaderboardResult.error;
    console.error('Could not load public event data.', error);
    return failure('Could not load stalls or leaderboard. Please try again.', 500);
  }

  const stalls = z.array(stallSchema).safeParse(stallResult.data);
  const leaderboard = z.array(leaderboardSchema).safeParse(leaderboardResult.data);
  if (!stalls.success || !leaderboard.success) {
    console.error('Public event data returned an invalid shape.', {
      stalls: stalls.success ? undefined : stalls.error,
      leaderboard: leaderboard.success ? undefined : leaderboard.error,
    });
    return failure('Event data is temporarily unavailable.', 500);
  }

  const rewardsResult = await supabase
    .from('stall_gift_markers')
    .select('stall_number, has_gift_reward')
    .eq('event_slug', eventSlug);
  if (rewardsResult.error) {
    console.error('Could not load public stall gift availability.', rewardsResult.error);
    return failure('Could not load stall rewards. Please try again.', 500);
  }
  const rewards = z.array(rewardSchema).safeParse(rewardsResult.data);
  if (!rewards.success) {
    console.error('Public stall rewards returned an invalid shape.', rewards.error);
    return failure('Stall rewards are temporarily unavailable.', 500);
  }
  const giftAvailability = new Map(rewards.data.map((reward) => [
    reward.stall_number,
    reward.has_gift_reward,
  ]));

  return NextResponse.json({
    event: event.data,
    stalls: stalls.data.map((stall) => ({
      id: stall.stall_number,
      title: stall.title,
      category: stall.category,
      zone: stall.zone ?? 'Event grounds',
      x: Math.max(0, Math.min(100, Math.round(stall.map_x / 9.6))),
      y: Math.max(0, Math.min(100, Math.round(stall.map_y / 7))),
      description: stall.description,
      whatsapp: stall.whatsapp_number ?? '',
      website: stall.website_url,
      price: stall.price_range ?? 'Ask exhibitor',
      hasGiftReward: giftAvailability.get(stall.stall_number) ?? false,
    })),
    leaderboard: leaderboard.data.map((entry) => ({
      name: entry.username,
      coins: entry.coins,
      visited: entry.stalls_visited,
      rank: entry.rank,
    })),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
