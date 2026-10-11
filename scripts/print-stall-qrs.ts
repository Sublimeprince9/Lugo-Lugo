import { config as loadEnv } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import QRCode from 'qrcode';

import { signStaticToken } from '../src/lib/qr';
import { createAdminSupabaseClient, getSupabaseServerConfig } from '../src/lib/supabase/server';

loadEnv({ path: '.env.local' });

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

async function main() {
  const [, , slug, applicationFlag, applicationId] = process.argv;
  if (!slug || !/^[a-z0-9-]+$/.test(slug) || applicationFlag !== '--application'
    || !applicationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicationId)) {
    throw new Error('Usage: npm run qr:generate -- <event-slug> --application <approved-application-id>');
  }

  const config = getSupabaseServerConfig();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error('Set NEXT_PUBLIC_APP_URL before generating stall QR codes.');
  }

  const admin = createAdminSupabaseClient(config.url, config.serviceRoleKey);
  const { data: event, error: eventError } = await admin
    .from('events')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle();
  if (eventError) throw new Error(`Could not find event: ${eventError.message}`);
  if (!event) throw new Error(`No event found with slug "${slug}".`);

  const { data: application, error: applicationError } = await admin
    .from('vendor_applications')
    .select('id, event_id, business_name, stall_number, status')
    .eq('id', applicationId)
    .maybeSingle();
  if (applicationError) {
    throw new Error(`Could not verify the vendor application: ${applicationError.message}`);
  }
  if (!application || application.event_id !== event.id || application.status !== 'approved') {
    throw new Error('QR codes can only be generated for an approved vendor application in this event.');
  }

  const { data: stall, error: stallError } = await admin
    .from('stalls')
    .select('id, stall_number, title, qr_secret')
    .eq('event_id', event.id)
    .eq('stall_number', application.stall_number)
    .maybeSingle();
  if (stallError) throw new Error(`Could not load the registered vendor stall: ${stallError.message}`);
  if (!stall || stall.title !== application.business_name) {
    throw new Error('The approved vendor stall is missing or does not match the application. Verify it before generating a QR code.');
  }

  const safeStallNumber = stall.stall_number.replace(/[^a-zA-Z0-9_-]/g, '_');
  const outputDir = join(process.cwd(), 'public', 'qr', slug, safeStallNumber);
  await mkdir(outputDir, { recursive: true });
  const origin = appUrl.replace(/\/+$/, '');

  const token = signStaticToken(stall.id, stall.qr_secret, config.qrSigningSecret);
  const url = `${origin}/scan?t=${encodeURIComponent(token)}`;
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 512,
    color: { dark: '#172829', light: '#fff2c3' },
  });
  const filename = `${safeStallNumber}.svg`;
  await writeFile(join(outputDir, filename), svg, 'utf8');

  const sheet = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(stall.title)} - Stall ${escapeHtml(stall.stall_number)} QR</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172829; font-family: Arial, sans-serif; }
    header { margin-bottom: 9mm; text-align: center; }
    h1 { margin: 0 0 3mm; font-size: 22pt; }
    header p { margin: 0; color: #52645d; font-size: 11pt; }
    .stall {
      min-height: 235mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 8mm;
      text-align: center;
      break-inside: avoid;
    }
    .stall img { display: block; width: 110mm; height: 110mm; }
    .stall-number { margin-top: 8mm; font-size: 25pt; font-weight: 800; }
    .stall-name { margin-top: 3mm; font-size: 18pt; }
    .hint { margin-top: 9mm; color: #52645d; font-size: 11pt; text-align: center; }
    @media screen {
      body { max-width: 210mm; margin: 12px auto; padding: 10mm; background: #fff; }
      .print-button { display: block; margin: 0 auto 8mm; padding: 10px 18px; }
    }
    @media print { .print-button { display: none; } }
  </style>
</head>
<body>
  <button class="print-button" type="button" onclick="window.print()">Print vendor QR</button>
  <header>
    <h1>${escapeHtml(event.name)}</h1>
    <p>Vendor stall check-in code</p>
  </header>
  <main class="stall">
    <img src="${escapeHtml(filename)}" alt="QR code for ${escapeHtml(stall.title)}, stall ${escapeHtml(stall.stall_number)}">
    <div class="stall-number">STALL ${escapeHtml(stall.stall_number)}</div>
    <div class="stall-name">${escapeHtml(stall.title)}</div>
  </main>
  <p class="hint">Display this code at the registered vendor stall. Visitors need an internet connection to scan it.</p>
</body>
</html>`;
  await writeFile(join(outputDir, 'index.html'), sheet, 'utf8');

  console.log(`Generated a QR code and individual print sheet for approved stall ${stall.stall_number}: ${join('public', 'qr', slug, safeStallNumber, 'index.html')}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
