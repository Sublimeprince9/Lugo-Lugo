import type { NextRequest } from 'next/server';

import { isOrganizerEmailAllowed } from '@/lib/organizer-access';
import {
  createAdminSupabaseClient,
  createRequestSupabaseClient,
  getSupabaseServerConfig,
  type SupabaseResponseCookie,
} from '@/lib/supabase/server';

export type OrganizerAccess =
  | {
    authorized: true;
    admin: ReturnType<typeof createAdminSupabaseClient>;
    userId: string;
  }
  | {
    authorized: false;
    status: 401 | 403 | 503;
    error: string;
  };

export async function authorizeOrganizer(
  request: NextRequest,
  onCookiesSet: (cookies: SupabaseResponseCookie[]) => void,
): Promise<OrganizerAccess> {
  let config;
  try {
    config = getSupabaseServerConfig();
  } catch (cause) {
    console.error('Organizer service is not configured.', cause);
    return {
      authorized: false,
      status: 503,
      error: 'Organizer tools are unavailable because the server is not configured.',
    };
  }

  const supabase = createRequestSupabaseClient(
    request,
    config.url,
    config.anonKey,
    onCookiesSet,
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { authorized: false, status: 401, error: 'Sign in with an organizer account.' };
  }
  if (!isOrganizerEmailAllowed(data.user.email)) {
    return { authorized: false, status: 403, error: 'This account is not authorized to review applications.' };
  }

  return {
    authorized: true,
    admin: createAdminSupabaseClient(config.url, config.serviceRoleKey),
    userId: data.user.id,
  };
}
