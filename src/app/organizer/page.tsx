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
  stallNumber: z.string().nullable(),
  category: z.string(),
  description: z.string(),
  zoneId: z.string().uuid().nullable(),
  zoneName: z.string().nullable(),
  mapX: z.number().int().nullable(),
  mapY: z.number().int().nullable(),
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
  zones: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
  applications: z.array(applicationSchema),
});
const errorSchema = z.object({ error: z.string() });
const updateSchema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(['needs_changes', 'approved', 'rejected']),
  reviewNotes: z.string().max(1000),
  stallNumber: z.string().max(32).nullable(),
  zoneId: z.string().uuid().nullable(),
  mapX: z.number().int().min(0).max(100),
  mapY: z.number().int().min(0).max(100),
});

type Application = z.infer<typeof applicationSchema>;
type Zone = z.infer<typeof listSchema>['zones'][number];
type Assignment = { stallNumber: string; zoneId: string; mapX: number; mapY: number };

export default function OrganizerPage() {
  const [email, setEmail] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
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
    setZones(parsed.data.zones);
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

  function assignmentFor(application: Application): Assignment {
    return assignments[application.id] ?? {
      stallNumber: application.stallNumber ?? '',
      zoneId: application.zoneId ?? '',
      mapX: application.mapX ?? 50,
      mapY: application.mapY ?? 50,
    };
  }

  function updateAssignment(applicationId: string, update: Partial<Assignment>) {
    setAssignments((current) => {
      const application = applications.find((entry) => entry.id === applicationId);
      if (!application) return current;
      const currentAssignment = current[applicationId] ?? {
        stallNumber: application.stallNumber ?? '',
        zoneId: application.zoneId ?? '',
        mapX: application.mapX ?? 50,
        mapY: application.mapY ?? 50,
      };
      return {
        ...current,
        [applicationId]: { ...currentAssignment, ...update },
      };
    });
  }

  async function reviewApplication(application: Application, status: 'needs_changes' | 'approved' | 'rejected') {
    const assignment = assignmentFor(application);
    setBusyApplication(application.id);
    setError(null);
    try {
      const body = updateSchema.parse({
        applicationId: application.id,
        status,
        reviewNotes: reviewNotes[application.id] ?? '',
        stallNumber: assignment.stallNumber.trim() || null,
        zoneId: assignment.zoneId || null,
        mapX: assignment.mapX,
        mapY: assignment.mapY,
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
                  <p className="pixel-eyebrow text-lime-300">
                    {application.stallNumber
                      ? `VENDOR-PROVIDED STALL ${application.stallNumber} · ${application.category} · VERIFY`
                      : `STALL TO BE ASSIGNED · ${application.category}`}
                  </p>
                  <h2 className="mt-1 text-lg font-black text-[#fff2c3]">{application.businessName}</h2>
                      <p className="text-xs text-[#8fa18a]">
                        {application.zoneName
                          ? `${application.zoneName} · pin ${application.mapX}%, ${application.mapY}%`
                          : 'Map position not assigned'}
                      </p>
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

              {application.status !== 'approved' && (
                <div className="space-y-3 border border-[#526b50] bg-[#172b2b] p-3">
                  <div>
                    <p className="pixel-eyebrow text-lime-300">ORGANIZER ASSIGNMENT</p>
                    <p className="mt-1 text-[10px] leading-4 text-[#8fa18a]">
                      Verify the official stall number and map location. Vendors can apply before these are assigned.
                    </p>
                  </div>
                  <label className="form-field">
                    <span>Official stall number</span>
                    <input
                      className="game-input"
                      maxLength={32}
                      value={assignmentFor(application).stallNumber}
                      onChange={(event) => updateAssignment(application.id, { stallNumber: event.target.value })}
                    />
                  </label>
                  <label className="form-field">
                    <span>Event map zone</span>
                    <select
                      className="game-input"
                      value={assignmentFor(application).zoneId}
                      onChange={(event) => updateAssignment(application.id, { zoneId: event.target.value })}
                    >
                      <option value="">Assign a zone</option>
                      {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                    </select>
                  </label>
                  {zones.length === 0 && (
                    <p className="text-xs text-amber-200">Upload/configure event map zones before approving vendor listings.</p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="form-field">
                      <span>Map X: {assignmentFor(application).mapX}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={assignmentFor(application).mapX}
                        onChange={(event) => updateAssignment(application.id, { mapX: Number(event.target.value) })}
                      />
                    </label>
                    <label className="form-field">
                      <span>Map Y: {assignmentFor(application).mapY}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={assignmentFor(application).mapY}
                        onChange={(event) => updateAssignment(application.id, { mapY: Number(event.target.value) })}
                      />
                    </label>
                  </div>
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
                  onClick={() => void reviewApplication(application, 'needs_changes')}
                >REQUEST CHANGES</button>
                <button
                  className="vendor-cta"
                  type="button"
                  disabled={busyApplication !== null || application.status === 'approved'}
                  onClick={() => void reviewApplication(application, 'rejected')}
                >REJECT</button>
                <button
                  className="pixel-button"
                  type="button"
                  disabled={
                    busyApplication !== null
                    || application.status === 'approved'
                    || !assignmentFor(application).stallNumber.trim()
                    || !assignmentFor(application).zoneId
                    || zones.length === 0
                  }
                  onClick={() => void reviewApplication(application, 'approved')}
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
