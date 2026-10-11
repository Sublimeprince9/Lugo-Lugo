import assert from 'node:assert/strict';
import test from 'node:test';

import { GET } from '../src/app/api/events/route';

test('event endpoint fails clearly when public Supabase configuration is unavailable', async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    const response = await GET();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: 'Event data is unavailable because Supabase is not configured.',
    });
  } finally {
    if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    if (anonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
  }
});
