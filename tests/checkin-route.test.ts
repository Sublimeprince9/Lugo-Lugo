import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { POST } from '../src/app/api/checkin/route';
import { signStaticToken } from '../src/lib/qr';

const protectedEnvironmentKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'QR_SIGNING_SECRET',
] as const;

async function withConfiguredSupabase(testBody: () => Promise<void>) {
  const savedValues = new Map(protectedEnvironmentKeys.map((key) => [key, process.env[key]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.QR_SIGNING_SECRET = 's'.repeat(64);

  try {
    await testBody();
  } finally {
    for (const [key, value] of savedValues) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('check-in rejects malformed JSON', async () => {
  const response = await POST(new NextRequest('http://localhost/api/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Request body must be valid JSON.' });
});

test('check-in requires an authenticated visitor', async () => {
  await withConfiguredSupabase(async () => {
    const response = await POST(new NextRequest('http://localhost/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalid' }),
    }));

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Sign in as a visitor before checking in.' });
  });
});

test('check-in reports missing Supabase setup without exposing configuration', async () => {
  const savedValues = new Map(protectedEnvironmentKeys.map((key) => [key, process.env[key]]));
  for (const key of protectedEnvironmentKeys) delete process.env[key];

  try {
    const token = signStaticToken(
      '00000000-0000-4000-8000-000000000101',
      'stall-secret',
      's'.repeat(64),
    );
    const response = await POST(new NextRequest('http://localhost/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }));

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: 'Check-in is unavailable because the server is not configured.',
    });
  } finally {
    for (const [key, value] of savedValues) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
