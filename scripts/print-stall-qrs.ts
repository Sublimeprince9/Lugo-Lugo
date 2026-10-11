import { config as loadEnv } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import QRCode from 'qrcode';

import { signStaticToken } from '../src/lib/qr';
import { createAdminSupabaseClient, getSupabaseServerConfig } from '../src/lib/supabase/server';

loadEnv({ path: '.env.local' });

async function main() {
  const slug = process.argv[2];
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    throw new Error('Usage: npm run qr:urls -- <event-slug>');
  }

  const config = getSupabaseServerConfig();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error('Set NEXT_PUBLIC_APP_URL before generating stall QR codes.');
  }

  const admin = createAdminSupabaseClient(config.url, config.serviceRoleKey);
  const { data: event, error: eventError } = await admin
    .from('events')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (eventError) throw new Error(`Could not find event: ${eventError.message}`);
  if (!event) throw new Error(`No event found with slug "${slug}".`);

  const { data: stalls, error: stallsError } = await admin
    .from('stalls')
    .select('id, stall_number, qr_secret')
    .eq('event_id', event.id)
    .order('stall_number');
  if (stallsError) throw new Error(`Could not load stall QR secrets: ${stallsError.message}`);
  if (!stalls?.length) throw new Error(`Event "${slug}" has no stalls to print.`);

  const outputDir = join(process.cwd(), 'public', 'qr', slug);
  await mkdir(outputDir, { recursive: true });
  const origin = appUrl.replace(/\/+$/, '');

  for (const stall of stalls) {
    const token = signStaticToken(stall.id, stall.qr_secret, config.qrSigningSecret);
    const url = `${origin}/scan?t=${encodeURIComponent(token)}`;
    const svg = await QRCode.toString(url, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 512,
      color: { dark: '#172829', light: '#fff2c3' },
    });
    const filename = `${stall.stall_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.svg`;
    await writeFile(join(outputDir, filename), svg, 'utf8');
    console.log(`${stall.stall_number}: ${join('public', 'qr', slug, filename)}`);
  }

  console.log(`Generated ${stalls.length} static QR codes for ${slug}. Keep the server secrets private.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
