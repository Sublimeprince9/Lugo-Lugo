import { z } from 'zod';

const optionalHttpUrl = z.string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (value === '') return true;
    try {
      const url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
    } catch {
      return false;
    }
  }, 'Enter a valid website beginning with http:// or https://.')
  .transform((value) => value || null);

export const vendorApplicationSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  contactName: z.string().trim().min(2).max(100),
  contactEmail: z.string().trim().email().max(254),
  whatsapp: z.string().trim().min(7).max(32)
    .refine((value) => (value.match(/\d/g) ?? []).length >= 7, 'Enter a valid WhatsApp number.'),
  websiteUrl: optionalHttpUrl,
  stallNumber: z.string().trim().min(1).max(32).regex(/^[a-z0-9 _-]+$/i),
  category: z.enum(['Luxury', 'Food', 'Drinks', 'Science', 'Farming', 'Tech', 'Other']),
  description: z.string().trim().min(10).max(1200),
  zoneName: z.string().trim().min(1).max(100),
  mapX: z.number().int().min(0).max(100),
  mapY: z.number().int().min(0).max(100),
  giftTitle: z.string().trim().max(100),
  giftDetails: z.string().trim().max(600),
  giftQuantity: z.number().int().min(1).max(10000).nullable(),
  photoConsent: z.enum(['true', 'false']),
  hasPhotos: z.boolean(),
}).strict().superRefine((value, context) => {
  const hasGift = value.giftTitle.length > 0 || value.giftDetails.length > 0 || value.giftQuantity !== null;
  if (hasGift && (!value.giftTitle || !value.giftDetails || value.giftQuantity === null)) {
    context.addIssue({
      code: 'custom',
      path: ['giftTitle'],
      message: 'Complete the gift title, details, and quantity, or leave all three blank.',
    });
  }
  if (value.hasPhotos && value.photoConsent !== 'true') {
    context.addIssue({
      code: 'custom',
      path: ['photoConsent'],
      message: 'Confirm that you have permission to share the selected photos.',
    });
  }
});

export type VendorApplicationInput = z.infer<typeof vendorApplicationSchema>;

export const VENDOR_PHOTO_BUCKET = 'vendor-application-photos';
export const VENDOR_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const VENDOR_PHOTO_MAX_COUNT = 3;

export function isSupportedVendorPhoto(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === 'image/png') {
    return bytes.length >= 8
      && bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4e
      && bytes[3] === 0x47
      && bytes[4] === 0x0d
      && bytes[5] === 0x0a
      && bytes[6] === 0x1a
      && bytes[7] === 0x0a;
  }
  if (contentType === 'image/webp') {
    return bytes.length >= 12
      && bytes[0] === 0x52
      && bytes[1] === 0x49
      && bytes[2] === 0x46
      && bytes[3] === 0x46
      && bytes[8] === 0x57
      && bytes[9] === 0x45
      && bytes[10] === 0x42
      && bytes[11] === 0x50;
  }
  return false;
}
