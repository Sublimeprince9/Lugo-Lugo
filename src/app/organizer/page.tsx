'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const applicationSchema = z.object({
  id: z.string().uuid(),
  businessName: z.string(),
  contactName: z.string(),
  contactEmail: z.string(),
  whatsapp: z.string(),
  websiteUrl: z.string().nullable(),
  stallNumber: z.string(),
  category: z.string(),
  description: z.string(),
  zoneName: z.string(),
  mapX: z.number().int(),
  mapY: z.number().int(),
  photoConsent: z.boolean(),
  photos: z.array(z.string().url()),
  giftTitle: z.string().nullable(),
  giftDetails: z.string().nullable(),
  giftQuantity: z.number().int().nullable(),
  status: z.enum(['pending_review', 'needs_changes', 'approved', 'rejected']),
  reviewNotes: z.string().nullable(),
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
});
const listSchema = z.object({
  success: z.literal(true),
  applications: z.array(applicationSchema),
});
const errorSchema = z.object({ error: z.string() });
const updateSchema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(['needs_changes', 'approved', 'rejected']),
  reviewNotes: z.string().max(1000),
});

type Application = z.infer<typeof applicationSchema>;

export default function OrganizerPage() {
  const [email, setEmail] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [busyApplication, setBusyApplication] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    const response = await fetch('/api/organizer/applications', { cache: 'no-store' });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const parsedError = errorSchema.safeParse(payload);
      throw new Error(parsedError.success ? parsedError.data.error : 'Could not load applications.');
    }
    const parsed = listSchema.safeParse(payload);
    if (!parsed.success) {
      console.error('Organizer application API returned invalid data.', parsed.error);
      throw new Error('The application list returned an unexpected response.');
    }
    setApplications(parsed.data.applications);
    setAuthorized(true);
  }, []);

  useEffect(() => {
    let active = true;
    getSupabaseBrowserClient().auth.getUser()
      .then(async ({ data, error: authError }) => {
        if (authError) throw authError;
        if (!data.user?.email) return;
        if (active) setUserEmail(data.user.email);
        await loadApplications();
      })
      .catch((cause: unknown) => {
        if (active && cause instanceof Error) {
          setError(cause.message);
        }
      })
      .finally(() => {
        if (active) setCheckingAccess(false);
      });
    return () => { active = false; };
  }, [loadApplications]);

  async function requestSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendingLink(true);
    setError(null);
    setLinkSent(false);
    try {
      const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/organizer`,
        },
      });
      if (signInError) throw signInError;
      setLinkSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the organizer sign-in link.');
    } finally {
      setSendingLink(false);
    }
  }

  async function reviewApplication(applicationId: string, status: 'needs_changes' | 'approved' | 'rejected') {
    setBusyApplication(applicationId);
    setError(null);
    try {
      const body = updateSchema.parse({
        applicationId,
        status,
        reviewNotes: reviewNotes[applicationId] ?? '',
      });
      const response = await fetch('/api/organizer/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const parsedError = errorSchema.safeParse(payload);
        throw new Error(parsedError.success ? parsedError.data.error : 'Could not update this application.');
      }
      await loadApplications();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this application.');
    } finally {
      setBusyApplication(null);
    }
  }

  async function signOut() {
    const { error: signOutError } = await getSupabaseBrowserClient().auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    setAuthorized(false);
    setUserEmail(null);
    setApplications([]);
  }

  const pendingCount = applications.filter((application) =>
    application.status === 'pending_review' || application.status === 'needs_changes',
  ).length;

  return (
    <main className="game-shell mx-auto min-h-screen max-w-2xl px-4 py-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="pixel-link">← RETURN TO MAP</Link>
        <p className="pixel-eyebrow">ORGANIZER REVIEW</p>
      </header>

      <section className="pixel-panel mb-4 p-4">
        <p className="pixel-eyebrow text-lime-300">UMA FAIR 2026</p>
        <h1 className="mt-1 text-xl font-black text-[#fff2c3]">Vendor applications</h1>
        <p className="mt-2 text-xs leading-5 text-[#b8c6aa]">
          Check stall ownership and map placement before approving. Approval publishes the listing and activates its proposed limited gift.
        </p>
      </section>

      {checkingAccess ? (
        <p className="pixel-panel p-4 text-sm text-[#b8c6aa]" role="status">Checking organizer access…</p>
      ) : !authorized ? (
        <form className="pixel-panel space-y-3 p-4" onSubmit={requestSignIn}>
          <p className="pixel-eyebrow text-lime-300">ORGANIZER SIGN-IN</p>
          <label className="form-field">
            <span>Allowlisted organizer email</span>
            <input
              className="game-input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button className="pixel-button w-full" type="submit" disabled={sendingLink}>
            {sendingLink ? 'SENDING SIGN-IN LINK…' : 'EMAIL ME A SECURE SIGN-IN LINK'}
          </button>
          {linkSent && <p className="text-sm text-lime-200" role="status">If this email is an organizer account, a secure sign-in link is on its way.</p>}
          <p className="text-[10px] leading-4 text-[#829984]">
            Organizer accounts must already exist in Supabase Auth and be listed in the server&apos;s ORGANIZER_EMAILS setting.
          </p>
        </form>
      ) : (
        <section className="space-y-4">
          <div className="pixel-panel flex items-center justify-between gap-3 p-3">
            <p className="min-w-0 truncate text-xs text-[#b8c6aa]">
              {userEmail} · {pendingCount} awaiting review
            </p>
            <button className="pixel-link shrink-0" type="button" onClick={() => void signOut()}>SIGN OUT</button>
          </div>

          {applications.length === 0 && (
            <p className="pixel-panel p-4 text-sm text-[#b8c6aa]">No vendor applications have been submitted.</p>
          )}

          {applications.map((application) => (
            <article className="pixel-panel space-y-3 p-4" key={application.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="pixel-eyebrow text-lime-300">STALL {application.stallNumber} · {application.category}</p>
                  <h2 className="mt-1 text-lg font-black text-[#fff2c3]">{application.businessName}</h2>
                  <p className="text-xs text-[#8fa18a]">{application.zoneName} · pin {application.mapX}%, {application.mapY}%</p>
                  <p className="mt-1 break-all font-mono text-[9px] text-[#829984]">Application ID: {application.id}</p>
                </div>
                <span className="shrink-0 border border-[#526b50] px-2 py-1 text-[9px] font-bold uppercase text-lime-200">
                  {application.status.replace('_', ' ')}
                </span>
              </div>

              <p className="text-sm leading-5 text-[#b8c6aa]">{application.description}</p>
              <div className="grid gap-1 text-xs text-[#b8c6aa]">
                <p>Contact: {application.contactName} · <a className="underline" href={`mailto:${application.contactEmail}`}>{application.contactEmail}</a></p>
                <p>WhatsApp: <a className="underline" href={`https://wa.me/${application.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{application.whatsapp}</a></p>
                {application.websiteUrl && <p>Website: <a className="underline" href={application.websiteUrl} target="_blank" rel="noreferrer">{application.websiteUrl}</a></p>}
              </div>

              {application.photos.length > 0 && (
                <div>
                  <p className="hud-label">PRIVATE PHOTO PREVIEWS · {application.photoConsent ? 'PUBLICATION CONSENT GIVEN' : 'NO PUBLICATION CONSENT'}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {application.photos.map((photo, index) => (
                      <a className="vendor-cta" href={photo} target="_blank" rel="noreferrer" key={photo}>
                        OPEN PHOTO {index + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {application.giftTitle && (
                <div className="border border-[#8b703a] bg-[#3a3425] p-3 text-xs text-[#f6cb65]">
                  <p className="font-bold">PROPOSED GIFT: {application.giftTitle} · LIMIT {application.giftQuantity}</p>
                  <p className="mt-1 leading-5">{application.giftDetails}</p>
                  <p className="mt-1 text-[10px]">Approval creates an active voucher reward with these terms and quantity.</p>
                </div>
              )}

              <label className="form-field">
                <span>Organizer note for vendor follow-up</span>
                <textarea
                  className="game-input min-h-16"
                  maxLength={1000}
                  value={reviewNotes[application.id] ?? application.reviewNotes ?? ''}
                  onChange={(event) => setReviewNotes((current) => ({ ...current, [application.id]: event.target.value }))}
                />
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  className="vendor-cta"
                  type="button"
                  disabled={busyApplication !== null || application.status === 'approved'}
                  onClick={() => void reviewApplication(application.id, 'needs_changes')}
                >REQUEST CHANGES</button>
                <button
                  className="vendor-cta"
                  type="button"
                  disabled={busyApplication !== null || application.status === 'approved'}
                  onClick={() => void reviewApplication(application.id, 'rejected')}
                >REJECT</button>
                <button
                  className="pixel-button"
                  type="button"
                  disabled={busyApplication !== null || application.status === 'approved'}
                  onClick={() => void reviewApplication(application.id, 'approved')}
                >{busyApplication === application.id ? 'SAVING…' : 'APPROVE & PUBLISH'}</button>
              </div>
            </article>
          ))}
        </section>
      )}

      {error && <p className="pixel-panel mt-4 p-3 text-sm text-rose-200" role="alert">{error}</p>}
    </main>
  );
}
