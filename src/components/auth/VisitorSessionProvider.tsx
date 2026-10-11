'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type SessionStatus = 'loading' | 'ready' | 'unconfigured' | 'error';
type VisitorSessionContextValue = {
  status: SessionStatus;
  session: Session | null;
  error: string | null;
  retry: () => void;
};

const VisitorSessionContext = createContext<VisitorSessionContextValue | null>(null);

export function VisitorSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [retryIndex, setRetryIndex] = useState(0);

  const retry = useCallback(() => {
    setStatus('loading');
    setError(null);
    setRetryIndex((index) => index + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let client: SupabaseClient;
    try {
      client = getSupabaseBrowserClient();
    } catch (cause) {
      setStatus('unconfigured');
      setError(cause instanceof Error ? cause.message : 'Supabase visitor sign-in is not configured.');
      return;
    }

    const { data: authListener } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (nextSession) {
        setStatus('ready');
        setError(null);
      }
    });

    async function initializeSession() {
      try {
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        if (data.session) {
          setSession(data.session);
          setStatus('ready');
          return;
        }

        const { data: signInData, error: signInError } = await client.auth.signInAnonymously();
        if (signInError) throw signInError;
        if (!signInData.session) {
          throw new Error('Supabase returned no session after anonymous sign-in.');
        }
        if (!active) return;
        setSession(signInData.session);
        setStatus('ready');
      } catch (cause) {
        if (!active) return;
        setSession(null);
        setStatus('error');
        setError(cause instanceof Error ? cause.message : 'Could not start an anonymous visitor session.');
      }
    }

    void initializeSession();
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [retryIndex]);

  const value = useMemo(() => ({ status, session, error, retry }), [status, session, error, retry]);

  return (
    <VisitorSessionContext.Provider value={value}>
      {children}
    </VisitorSessionContext.Provider>
  );
}

export function useVisitorSession(): VisitorSessionContextValue {
  const value = useContext(VisitorSessionContext);
  if (!value) {
    throw new Error('useVisitorSession must be used inside VisitorSessionProvider.');
  }
  return value;
}
