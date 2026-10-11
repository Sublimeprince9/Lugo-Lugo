import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import {
  createRequestSupabaseClient,
  getSupabaseServerConfig,
  type SupabaseResponseCookie,
} from '@/lib/supabase/server';

const bodySchema = z.object({
  rewardId: z.string().uuid(),
}).strict();
const successSchema = z.object({
  success: z.literal(true),
  claimId: z.string().uuid(),
  code: z.string().min(1),
  title: z.string(),
  alreadyClaimed: z.boolean(),
  redeemed: z.boolean(),
});
const failureSchema = z.object({
  success: z.literal(false),
  error: z.enum([
    'REWARD_UNAVAILABLE',
    'CHECKIN_REQUIRED',
    'PHONE_VERIFICATION_REQUIRED',
    'REWARD_SOLD_OUT',
  ]),
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

  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return response({ error: 'A valid reward ID is required.' }, 400);
  }

  let config;
  try {
    config = getSupabaseServerConfig();
  } catch (cause) {
    console.error('Claim service is not configured.', cause);
    return response({ error: 'Reward claims are unavailable because the server is not configured.' }, 503);
  }

  const cookiesToSet = new Map<string, SupabaseResponseCookie>();
  const supabase = createRequestSupabaseClient(
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

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return sendResponse({ error: 'Sign in as a visitor before claiming a reward.' }, 401);
  }

  const { data, error } = await supabase.rpc('claim_reward', {
    p_reward_id: parsedBody.data.rewardId,
  });
  if (error) {
    if (error.code === '28000') {
      return sendResponse({ error: 'Sign in as a visitor before claiming a reward.' }, 401);
    }
    if (error.code === '42883' || error.code === 'PGRST202') {
      console.error('Reward claim migration is not installed.', error);
      return sendResponse({ error: 'Reward claiming is not enabled on this server yet.' }, 503);
    }
    console.error('Atomic reward claim failed.', error);
    return sendResponse({ error: 'Could not claim this reward. Please try again.' }, 500);
  }

  const failure = failureSchema.safeParse(data);
  if (failure.success) {
    switch (failure.data.error) {
      case 'REWARD_UNAVAILABLE':
        return sendResponse({ error: 'This reward is no longer available.' }, 404);
      case 'CHECKIN_REQUIRED':
        return sendResponse({ error: 'Check in at this stall before claiming its reward.' }, 403);
      case 'PHONE_VERIFICATION_REQUIRED':
        return sendResponse({ error: 'Verify your phone number before claiming this reward.' }, 403);
      case 'REWARD_SOLD_OUT':
        return sendResponse({ error: 'This reward has reached its claim limit.' }, 409);
    }
  }

  const success = successSchema.safeParse(data);
  if (!success.success) {
    console.error('Reward claim RPC returned an invalid result.', success.error);
    return sendResponse({ error: 'The claim response was invalid. Please try again.' }, 500);
  }

  return sendResponse(success.data, 200);
}
