'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { z } from 'zod';

import { useVisitorSession } from '@/components/auth/VisitorSessionProvider';

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
  rewards: z.array(z.object({
    id: z.string().uuid(),
    title: z.string(),
    kind: z.enum(['coins', 'voucher', 'prize']),
    isActive: z.boolean(),
    requiresVerifiedPhone: z.boolean(),
    checkedInAtStall: z.boolean(),
    claimed: z.boolean(),
  })),
});

type ProfileData = z.infer<typeof profileSchema>;

export default function MePage() {
  const { status: sessionStatus, retry } = useVisitorSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        if (active) setProfile(parsed.data);
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

  const claimedRewardIds = new Set(profile?.rewards.filter((reward) => reward.claimed).map((reward) => reward.id));
  const availableRewards = profile?.rewards.filter((reward) => reward.isActive && !reward.claimed) ?? [];

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
            <p className="mt-1 truncate text-xs text-[#b8c6aa]">{profile?.username ?? 'Explorer'}</p>
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
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="pixel-eyebrow text-lime-300">REWARD INVENTORY</p>
            <h2 className="mt-1 text-base font-black text-[#fff2c3]">Available rewards</h2>
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
                  {reward.requiresVerifiedPhone ? 'PHONE VERIFICATION REQUIRED' : reward.checkedInAtStall ? 'READY' : 'VISIT THE STALL TO UNLOCK'}
                </p>
              </div>
              <span className="reward-status">
                {reward.requiresVerifiedPhone ? 'VERIFY' : reward.checkedInAtStall ? 'READY' : 'LOCKED'}
              </span>
            </div>
          ))}
        </div>
        {claimedRewardIds.size > 0 && (
          <p className="mt-3 text-xs text-[#b8c6aa]">{claimedRewardIds.size} reward{claimedRewardIds.size === 1 ? '' : 's'} already claimed.</p>
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
