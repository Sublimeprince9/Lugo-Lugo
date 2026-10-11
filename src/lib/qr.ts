import { createHmac, timingSafeEqual } from 'node:crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/;

export function parseStaticToken(token: string): string | null {
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return null;

  try {
    const stallId = Buffer.from(match[1], 'base64url').toString('utf8');
    return UUID_PATTERN.test(stallId) ? stallId.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function signStaticToken(stallId: string, stallSecret: string, signingSecret: string): string {
  const normalizedId = stallId.toLowerCase();
  if (!UUID_PATTERN.test(normalizedId)) {
    throw new Error('Cannot sign a QR token for an invalid stall ID.');
  }
  if (Buffer.byteLength(signingSecret, 'utf8') < 32) {
    throw new Error('QR_SIGNING_SECRET must contain at least 32 bytes.');
  }

  const signature = createHmac('sha256', signingSecret)
    .update(`${normalizedId}.${stallSecret}`, 'utf8')
    .digest('base64url');
  return `${Buffer.from(normalizedId, 'utf8').toString('base64url')}.${signature}`;
}

export function verifyStaticToken(
  token: string,
  stallId: string,
  stallSecret: string,
  signingSecret: string,
): boolean {
  if (Buffer.byteLength(signingSecret, 'utf8') < 32) {
    throw new Error('QR_SIGNING_SECRET must contain at least 32 bytes.');
  }

  const tokenStallId = parseStaticToken(token);
  if (!tokenStallId || tokenStallId !== stallId.toLowerCase()) return false;

  const match = TOKEN_PATTERN.exec(token);
  if (!match) return false;
  const suppliedSignature = Buffer.from(match[2], 'base64url');
  const expectedSignature = createHmac('sha256', signingSecret)
    .update(`${tokenStallId}.${stallSecret}`, 'utf8')
    .digest();

  return suppliedSignature.length === expectedSignature.length
    && timingSafeEqual(suppliedSignature, expectedSignature);
}
