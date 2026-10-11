import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { POST } from '../src/app/api/vendor-applications/route';
import { isSupportedVendorPhoto, vendorApplicationSchema } from '../src/lib/vendor-application';

const validApplication = {
  businessName: 'Kampala Crafts',
  contactName: 'Sam Vendor',
  contactEmail: 'sam@example.com',
  whatsapp: '+256 700 123 456',
  websiteUrl: 'https://example.com',
  stallNumber: 'B07',
  category: 'Food',
  description: 'Local food and drinks for event visitors.',
  zoneName: 'Catering Lane',
  mapX: 47,
  mapY: 26,
  giftTitle: '',
  giftDetails: '',
  giftQuantity: null,
  photoConsent: 'false',
  hasPhotos: false,
} as const;

test('vendor application accepts a complete application without photos or gift', () => {
  const result = vendorApplicationSchema.safeParse(validApplication);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.websiteUrl, 'https://example.com');
});

test('vendor application requires all details when proposing a gift', () => {
  const result = vendorApplicationSchema.safeParse({
    ...validApplication,
    giftTitle: 'Free juice',
  });
  assert.equal(result.success, false);
});

test('vendor application requires photo consent only when photos are attached', () => {
  const withoutPhotoConsent = vendorApplicationSchema.safeParse({
    ...validApplication,
    hasPhotos: true,
  });
  assert.equal(withoutPhotoConsent.success, false);

  const withPhotoConsent = vendorApplicationSchema.safeParse({
    ...validApplication,
    hasPhotos: true,
    photoConsent: 'true',
  });
  assert.equal(withPhotoConsent.success, true);
});

test('vendor application rejects unsafe website schemes and out-of-range map positions', () => {
  const unsafeWebsite = vendorApplicationSchema.safeParse({
    ...validApplication,
    websiteUrl: 'javascript:alert(1)',
  });
  assert.equal(unsafeWebsite.success, false);

  const invalidMapPosition = vendorApplicationSchema.safeParse({
    ...validApplication,
    mapX: 101,
  });
  assert.equal(invalidMapPosition.success, false);
});

test('vendor photo validation checks supported image signatures', () => {
  assert.equal(isSupportedVendorPhoto(
    new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
    'image/jpeg',
  ), true);
  assert.equal(isSupportedVendorPhoto(
    new Uint8Array([0x00, 0x00, 0x00]),
    'image/jpeg',
  ), false);
  assert.equal(isSupportedVendorPhoto(new Uint8Array([1, 2, 3]), 'image/svg+xml'), false);
});

test('vendor application endpoint rejects invalid form fields without writing data', async () => {
  const form = new FormData();
  form.set('businessName', '');
  form.set('contactName', 'Sam Vendor');
  form.set('contactEmail', 'sam@example.com');
  form.set('whatsapp', '+256 700 123 456');
  form.set('websiteUrl', '');
  form.set('stallNumber', 'B07');
  form.set('category', 'Food');
  form.set('description', 'Local food and drinks for event visitors.');
  form.set('zoneName', 'Catering Lane');
  form.set('mapX', '47');
  form.set('mapY', '26');
  form.set('giftTitle', '');
  form.set('giftDetails', '');
  form.set('giftQuantity', '');

  const response = await POST(new NextRequest('http://localhost/api/vendor-applications', {
    method: 'POST',
    body: form,
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Too small: expected string to have >=2 characters' });
});
