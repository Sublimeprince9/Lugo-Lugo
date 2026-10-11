import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { GET } from '../src/app/api/profile/route';

const protectedEnvironmentKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'QR_SIGNING_SECRET',
] as const;

test('profile requires an authenticated visitor', async () => {
  const savedValues = new Map(protectedEnvironmentKeys.map((key) => [key, process.env[key]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.QR_SIGNING_SECRET = 's'.repeat(64);

  try {
    const response = await GET(new NextRequest('http://localhost/api/profile'));

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Sign in as a visitor to view your profile.' });
  } finally {
    for (const [key, value] of savedValues) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
