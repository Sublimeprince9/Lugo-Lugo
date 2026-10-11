import assert from 'node:assert/strict';
import test from 'node:test';

import { parseStaticToken, signStaticToken, verifyStaticToken } from '../src/lib/qr';

const stallId = '00000000-0000-4000-8000-000000000101';
const stallSecret = 'stall-secret';
const signingSecret = 'a'.repeat(64);

test('static stall tokens round-trip and verify', () => {
  const token = signStaticToken(stallId, stallSecret, signingSecret);

  assert.equal(parseStaticToken(token), stallId);
  assert.equal(verifyStaticToken(token, stallId, stallSecret, signingSecret), true);
});

test('static stall tokens reject changed signatures and mismatched stall data', () => {
  const token = signStaticToken(stallId, stallSecret, signingSecret);
  const [encodedId, signature] = token.split('.');
  const changedSignature = `${encodedId}.${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`;

  assert.equal(verifyStaticToken(changedSignature, stallId, stallSecret, signingSecret), false);
  assert.equal(verifyStaticToken(token, stallId, 'another-secret', signingSecret), false);
  assert.equal(verifyStaticToken(token, '00000000-0000-4000-8000-000000000102', stallSecret, signingSecret), false);
});

test('static stall token parsing rejects malformed and non-UUID payloads', () => {
  assert.equal(parseStaticToken(''), null);
  assert.equal(parseStaticToken('not.a.token'), null);
  assert.equal(
    parseStaticToken(`${Buffer.from('A12').toString('base64url')}.${'a'.repeat(43)}`),
    null,
  );
});

test('token signing requires a valid UUID and a sufficiently long secret', () => {
  assert.throws(() => signStaticToken('A12', stallSecret, signingSecret), /invalid stall ID/);
  assert.throws(() => signStaticToken(stallId, stallSecret, 'short'), /at least 32 bytes/);
});
