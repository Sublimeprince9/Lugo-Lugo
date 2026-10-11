import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { POST } from '../src/app/api/claim/route';

test('claim rejects malformed JSON', async () => {
  const response = await POST(new NextRequest('http://localhost/api/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Request body must be valid JSON.' });
});

test('claim rejects invalid reward IDs', async () => {
  const response = await POST(new NextRequest('http://localhost/api/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rewardId: 'not-a-uuid' }),
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'A valid reward ID is required.' });
});
