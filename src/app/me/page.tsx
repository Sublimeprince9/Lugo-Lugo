'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';

import { useVisitorSession } from '@/components/auth/VisitorSessionProvider';
import { usernameSchema } from '@/lib/profile-validation';

const profileSchema = z.object({
  success: z.literal(true),
  username: z.string(),
  coins: z.number().int().nonnegative(),
  stallsVisited: z.number().int().nonnegative(),
  totalStalls: z.number().int().nonnegative(),
  checkins: z.array(z.object({
    stallNumber: z.string(),
    title: z.string(),
    checkedInAt: z.string(),
  })),
  zones: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    visited: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })),
  rewards: z.array(z.object({
    id: z.string().uuid(),
    title: z.string(),
    kind: z.enum(['coins', 'voucher', 'prize']),
    isActive: z.boolean(),
    requiresVerifiedPhone: z.boolean(),
    checkedInAtStall: z.boolean(),
    claimed: z.boolean(),
    claimCode: z.string().nullable(),
    redeemed: z.boolean(),
  })),
});
const claimResponseSchema = z.object({
  success: z.literal(true),
  claimId: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  alreadyClaimed: z.boolean(),
  redeemed: z.boolean(),
});

type ProfileData = z.infer<typeof profileSchema>;

export default function MePage() {
  const { status: sessionStatus, retry } = useVisitorSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [claimingRewardId, setClaimingRewardId] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus !== 'ready') return;

    let active = true;
    setLoading(true);
    setProfileError(null);

    fetch('/api/profile', { cache: 'no-store' })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) {
          const message = z.object({ error: z.string() }).safeParse(payload);
          throw new Error(message.success ? message.data.error : 'Could not load your visitor profile.');
        }
        const parsed = profileSchema.safeParse(payload);
        if (!parsed.success) {
          console.error('Profile API returned an invalid response.', parsed.error);
          throw new Error('Your visitor profile returned an unexpected response.');
        }
        if (active) {
          setProfile(parsed.data);
          setUsernameDraft(parsed.data.username);
        }
      })
      .catch((cause: unknown) => {
        if (active) setProfileError(cause instanceof Error ? cause.message : 'Could not load your visitor profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sessionStatus]);

  async function claimReward(rewardId: string) {
    setClaimingRewardId(rewardId);
    setClaimMessage(null);
    try {
      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const errorPayload = z.object({ error: z.string() }).safeParse(payload);
        throw new Error(errorPayload.success ? errorPayload.data.error : 'Could not claim this reward.');
      }
      const result = claimResponseSchema.safeParse(payload);
      if (!result.success) {
        console.error('Claim API returned an invalid response.', result.error);
        throw new Error('The reward claim returned an unexpected response.');
      }
      setProfile((current) => current ? {
        ...current,
        rewards: current.rewards.map((reward) => reward.id === rewardId ? {
          ...reward,
          claimed: true,
          claimCode: result.data.code,
          redeemed: result.data.redeemed,
        } : reward),
      } : current);
      setClaimMessage(result.data.alreadyClaimed
        ? `${result.data.title} was already claimed. Your code is shown below.`
        : `${result.data.title} claimed! Show its code at the stall.`);
    } catch (cause) {
      setClaimMessage(cause instanceof Error ? cause.message : 'Could not claim this reward.');
    } finally {
      setClaimingRewardId(null);
    }
  }

  async function saveUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedUsername = usernameSchema.safeParse(usernameDraft);
    if (!parsedUsername.success) {
      setUsernameMessage(parsedUsername.error.issues[0]?.message ?? 'Enter a valid username.');
      return;
    }

    setUsernameSaving(true);
    setUsernameMessage(null);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: parsedUsername.data }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const errorPayload = z.object({ error: z.string() }).safeParse(payload);
        throw new Error(errorPayload.success ? errorPayload.data.error : 'Could not save your username.');
      }
      const result = z.object({ success: z.literal(true), username: z.string() }).safeParse(payload);
      if (!result.success) {
        console.error('Profile update API returned an invalid response.', result.error);
        throw new Error('The profile update returned an unexpected response.');
      }
      setProfile((current) => current ? { ...current, username: result.data.username } : current);
      setUsernameDraft(result.data.username);
      setUsernameMessage('Username saved.');
    } catch (cause) {
      setUsernameMessage(cause instanceof Error ? cause.message : 'Could not save your username.');
    } finally {
      setUsernameSaving(false);
    }
  }

  const activeRewards = profile?.rewards.filter((reward) => reward.isActive) ?? [];
  const availableRewards = activeRewards.filter((reward) => !reward.claimed);
  const claimedRewards = profile?.rewards.filter((reward) => reward.claimed) ?? [];

  return (
    <main className="game-shell mx-auto min-h-screen max-w-md px-4 py-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="pixel-link">← RETURN TO MAP</Link>
        <p className="pixel-eyebrow">PLAYER MENU</p>
      </header>

      {sessionStatus === 'loading' && (
        <section className="pixel-panel mb-4 p-4" role="status">
          <p className="pixel-eyebrow">CONNECTING VISITOR SESSION</p>
          <p className="mt-2 text-sm text-[#b8c6aa]">Loading your saved adventure…</p>
        </section>
      )}
      {(sessionStatus === 'error' || sessionStatus === 'unconfigured') && (
        <section className="pixel-panel mb-4 p-4" role="alert">
          <p className="pixel-eyebrow text-rose-300">VISITOR SESSION UNAVAILABLE</p>
          <p className="mt-2 text-sm text-[#b8c6aa]">Connect your visitor session to view saved progress.</p>
          <button type="button" className="pixel-button mt-3 px-3" onClick={retry}>RETRY</button>
        </section>
      )}
      {profileError && (
        <section className="pixel-panel mb-4 p-4" role="alert">
          <p className="pixel-eyebrow text-rose-300">PROFILE UNAVAILABLE</p>
          <p className="mt-2 text-sm text-[#b8c6aa]">{profileError}</p>
        </section>
      )}
      {sessionStatus === 'ready' && loading && !profile && (
        <section className="pixel-panel mb-4 p-4" role="status">
          <p className="pixel-eyebrow">SYNCING YOUR PASSPORT</p>
        </section>
      )}

      <section className="pixel-panel p-4">
        <div className="flex items-center gap-3">
          <div className="profile-sprite" aria-hidden="true"><span>LV</span></div>
          <div className="min-w-0 flex-1">
            <p className="pixel-eyebrow text-lime-300">VISITOR · LEVEL {profile ? String(Math.floor(profile.stallsVisited / 3) + 1).padStart(2, '0') : '--'}</p>
            <h1 className="mt-1 truncate text-xl font-black text-[#fff2c3]">Your Adventure</h1>
            {profile ? (
              <form className="mt-2 flex gap-2" onSubmit={saveUsername}>
                <label className="sr-only" htmlFor="visitor-username">Display name</label>
                <input
                  id="visitor-username"
                  className="game-input min-w-0 flex-1"
                  value={usernameDraft}
                  onChange={(event) => setUsernameDraft(event.target.value)}
                  maxLength={24}
                  minLength={2}
                  autoComplete="nickname"
                  aria-describedby="username-help"
                />
                <button type="submit" className="pixel-button px-3" disabled={usernameSaving}>
                  {usernameSaving ? 'SAVING' : 'SAVE'}
                </button>
                <p id="username-help" className="sr-only">2 to 24 English letters, numbers, spaces, dots, underscores, or hyphens.</p>
              </form>
            ) : (
              <p className="mt-1 truncate text-xs text-[#b8c6aa]">Explorer</p>
            )}
            {usernameMessage && (
              <p className="mt-1 text-[10px] text-[#c6e877]" role="status">{usernameMessage}</p>
            )}
            <div className="xp-track mt-2 w-full"><span style={{ width: `${profile ? (profile.stallsVisited % 3) * 33.333 : 0}%` }} /></div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="profile-stat">
            <p className="pixel-eyebrow">TOTAL COINS</p>
            <p className="mt-1 text-2xl font-black text-[#f6cb65]">{profile?.coins ?? '--'} <span>¢</span></p>
          </div>
          <div className="profile-stat">
            <p className="pixel-eyebrow">STALLS FOUND</p>
            <p className="mt-1 text-2xl font-black text-[#c6e877]">
              {profile?.stallsVisited ?? '--'}<span className="text-sm text-[#9db39a]"> / {profile?.totalStalls ?? '--'}</span>
            </p>
          </div>
        </div>
      </section>

      <section className="pixel-panel mt-4 p-4">
        <div className="mb-4">
          <p className="pixel-eyebrow text-lime-300">ZONE EXPLORATION</p>
          <h2 className="mt-1 text-base font-black text-[#fff2c3]">Discover the fair</h2>
        </div>
        {!profile && <p className="text-sm text-[#b8c6aa]">Zone progress appears with your visitor passport.</p>}
        {profile && profile.zones.length === 0 && (
          <p className="text-sm text-[#b8c6aa]">No mapped zones are available for this event.</p>
        )}
        <div className="space-y-3">
          {profile?.zones.map((zone) => {
            const percentage = zone.total > 0 ? Math.round((zone.visited / zone.total) * 100) : 0;
            return (
              <div key={zone.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-bold text-[#fff2c3]">{zone.name}</p>
                  <span className="hud-label">{zone.visited}/{zone.total} · {percentage}%</span>
                </div>
                <div
                  className="reward-progress-track"
                  role="progressbar"
                  aria-label={`${zone.name} explored`}
                  aria-valuemin={0}
                  aria-valuemax={zone.total}
                  aria-valuenow={zone.visited}
                >
                  <span style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="pixel-panel mt-4 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="pixel-eyebrow text-lime-300">REWARD INVENTORY</p>
            <h2 className="mt-1 text-base font-black text-[#fff2c3]">Stall rewards</h2>
          </div>
          <span className="rank-token">{String(availableRewards.length).padStart(2, '0')}</span>
        </div>
        {!profile && <p className="text-sm text-[#b8c6aa]">Rewards appear here when your passport is connected.</p>}
        {profile && availableRewards.length === 0 && (
          <p className="text-sm text-[#b8c6aa]">No active rewards are available right now.</p>
        )}
        <div className="space-y-2">
          {availableRewards.map((reward) => (
            <div className="reward-row" key={reward.id}>
              <span className="reward-icon">{reward.kind === 'voucher' ? '★' : '✦'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#fff2c3]">{reward.title}</p>
                <p className="hud-label">
                  {reward.kind === 'coins'
                    ? 'COINS AWARDED AUTOMATICALLY'
                    : reward.requiresVerifiedPhone
                    ? 'PHONE VERIFICATION REQUIRED'
                    : reward.checkedInAtStall ? 'READY TO CLAIM' : 'VISIT THE STALL TO UNLOCK'}
                </p>
              </div>
              {reward.kind !== 'coins' && reward.checkedInAtStall && !reward.requiresVerifiedPhone ? (
                <button
                  type="button"
                  className="reward-status"
                  disabled={claimingRewardId !== null}
                  onClick={() => void claimReward(reward.id)}
                >
                  {claimingRewardId === reward.id ? 'CLAIMING' : 'CLAIM'}
                </button>
              ) : (
                <span className="reward-status">
                  {reward.kind === 'coins' ? 'AUTO' : reward.requiresVerifiedPhone ? 'VERIFY' : 'LOCKED'}
                </span>
              )}
            </div>
          ))}
        </div>
        {claimMessage && <p className="mt-3 text-sm text-[#c6e877]" role="status">{claimMessage}</p>}
        {claimedRewards.length > 0 && (
          <div className="mt-4 border-t border-[#3b5749] pt-3">
            <p className="pixel-eyebrow mb-2">CLAIMED CODES</p>
            <div className="space-y-2">
              {claimedRewards.map((reward) => (
                <div className="reward-row" key={reward.id}>
                  <span className="reward-icon reward-icon-purple">★</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#fff2c3]">{reward.title}</p>
                    <p className="hud-label">{reward.redeemed ? 'REDEEMED' : `CODE ${reward.claimCode ?? 'UNAVAILABLE'}`}</p>
                  </div>
                  <span className="reward-status">{reward.redeemed ? 'USED' : 'CLAIMED'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="pixel-panel mt-4 p-4">
        <div className="mb-4">
          <p className="pixel-eyebrow text-lime-300">RECENT DISCOVERIES</p>
          <h2 className="mt-1 text-base font-black text-[#fff2c3]">Your stall passport</h2>
        </div>
        {!profile && <p className="text-sm text-[#b8c6aa]">Your checked-in stalls appear here.</p>}
        {profile && profile.checkins.length === 0 && (
          <p className="text-sm text-[#b8c6aa]">No stalls checked in yet. Scan a signed stall QR to start your passport.</p>
        )}
        <div className="space-y-2">
          {profile?.checkins.map((checkin) => (
            <div className="reward-row" key={`${checkin.stallNumber}-${checkin.checkedInAt}`}>
              <span className="rank-token">{checkin.stallNumber}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#fff2c3]">{checkin.title}</p>
                <p className="hud-label">{new Date(checkin.checkedInAt).toLocaleDateString()}</p>
              </div>
              <span className="reward-status">FOUND</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
