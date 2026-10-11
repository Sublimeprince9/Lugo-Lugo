import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export type SupabaseServerConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  qrSigningSecret: string;
};

export type SupabaseResponseCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

export function getSupabaseServerConfig(): SupabaseServerConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const qrSigningSecret = process.env.QR_SIGNING_SECRET;

  const missing = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !anonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
    !qrSigningSecret && 'QR_SIGNING_SECRET',
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Missing server configuration: ${missing.join(', ')}`);
  }
  if (!url || !anonKey || !serviceRoleKey || !qrSigningSecret) {
    throw new Error('Supabase server configuration is incomplete.');
  }
  if (Buffer.byteLength(qrSigningSecret, 'utf8') < 32) {
    throw new Error('QR_SIGNING_SECRET must contain at least 32 bytes.');
  }

  return {
    url,
    anonKey,
    serviceRoleKey,
    qrSigningSecret,
  };
}

export function createRequestSupabaseClient(
  request: NextRequest,
  url: string,
  anonKey: string,
  onCookiesSet: (cookies: SupabaseResponseCookie[]) => void,
) {
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        onCookiesSet(cookiesToSet);
      },
    },
  });
}

export function createAdminSupabaseClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
