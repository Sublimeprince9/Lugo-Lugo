'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { MapCanvas } from '@/components/map/MapCanvas';
import { VendorDrawer } from '@/components/drawer/VendorDrawer';
import { StatCard } from '@/components/ui/StatCard';
import { useVisitorSession } from '@/components/auth/VisitorSessionProvider';
import { categories } from '@/lib/event-data';
import { useEventData } from '@/lib/use-event-data';
import type { Category, Stall } from '@/types/event';

const profileStatsSchema = z.object({
  coins: z.number().int().nonnegative(),
  stallsVisited: z.number().int().nonnegative(),
  totalStalls: z.number().int().nonnegative(),
  visitedStalls: z.array(z.string()),
});

export default function HomePage() {
  const { data: eventData, error: eventError, loading: eventLoading } = useEventData();
  const { status: sessionStatus } = useVisitorSession();
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [selectedStall, setSelectedStall] = useState<Stall | null>(null);
  const [profileStats, setProfileStats] = useState<z.infer<typeof profileStatsSchema> | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus !== 'ready') return;
    let active = true;

    fetch('/api/profile', { cache: 'no-store' })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok) {
          const errorBody = z.object({ error: z.string() }).safeParse(body);
          throw new Error(errorBody.success ? errorBody.data.error : 'Could not load visitor progress.');
        }
        const result = profileStatsSchema.safeParse(body);
        if (!result.success) {
          console.error('Profile API returned invalid home stats.', result.error);
          throw new Error('Visitor progress returned an unexpected response.');
        }
        if (active) setProfileStats(result.data);
      })
      .catch((cause: unknown) => {
        if (active) setProfileError(cause instanceof Error ? cause.message : 'Could not load visitor progress.');
      });

    return () => {
      active = false;
    };
  }, [sessionStatus]);

  const filteredStalls = useMemo(
    () => {
      const eventStalls = eventData?.stalls ?? [];
      return selectedCategory === 'All'
        ? eventStalls
        : eventStalls.filter((stall) => stall.category === selectedCategory);
    },
    [eventData?.stalls, selectedCategory],
  );
  const currentSelection = filteredStalls.find((stall) => stall.id === selectedStall?.id)
    ?? filteredStalls[0]
    ?? null;
  const selectStall = useCallback((stall: Stall) => setSelectedStall(stall), []);
  const stats = [
    { label: 'Coins', value: profileStats ? String(profileStats.coins) : '—', tone: 'amber' as const },
    {
      label: 'Visited',
      value: profileStats ? `${profileStats.stallsVisited}/${profileStats.totalStalls}` : '—',
      tone: 'cyan' as const,
    },
    { label: 'Rank', value: '—', tone: 'violet' as const },
  ];

  return (
    <main className="game-shell mx-auto flex min-h-screen max-w-md flex-col text-slate-100">
      <header className="game-header sticky top-0 z-20 px-4 pb-3 pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="pixel-eyebrow text-lime-300">{eventData?.event.venue?.toUpperCase() ?? 'UMA SHOWGROUNDS'}</p>
            <h1 className="game-title">LUGO <span>LUGO</span></h1>
          </div>
          <Link href="/me" className="game-avatar" aria-label="Visitor profile">
            <span>LV</span>
          </Link>
        </div>

        <div className="game-hud">
          <div className="hud-player">
            <div className="player-sprite" aria-hidden="true"><span /></div>
            <div>
              <span className="hud-label">VISITOR PASSPORT</span>
              <div className="xp-track"><span style={{ width: `${profileStats ? (profileStats.stallsVisited % 3) * 33.333 : 0}%` }} /></div>
            </div>
          </div>
          <div className="hud-stats">
            {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 pb-36 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="pixel-eyebrow text-slate-400">{eventLoading ? 'LOADING EVENT' : eventData?.event.name.toUpperCase() ?? 'EVENT UNAVAILABLE'}</p>
            <h2 className="section-title">Find your next stop</h2>
          </div>
          <Link href="/scan" className="pixel-button scan-button">
            <span className="scan-icon" aria-hidden="true">▦</span>
            SCAN
          </Link>
        </div>

        {(eventError || profileError) && (
          <section className="pixel-panel mb-3 p-3" role="alert">
            <p className="pixel-eyebrow text-rose-300">{eventError ? 'EVENT DATA UNAVAILABLE' : 'PASSPORT SYNC UNAVAILABLE'}</p>
            <p className="mt-2 text-sm text-[#b8c6aa]">{eventError ?? profileError}</p>
          </section>
        )}

        {!eventData && eventLoading && (
          <section className="pixel-panel p-4" role="status">
            <p className="pixel-eyebrow">SYNCING EVENT MAP</p>
            <p className="mt-2 text-sm text-[#b8c6aa]">Loading published stalls and explorer rankings…</p>
          </section>
        )}

        {eventData && (
          <>
            <div className="category-scroll mb-3 overflow-x-auto pb-2">
              <div className="flex min-w-max gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`category-chip ${selectedCategory === category ? 'category-chip-selected' : ''}`}
                  >
                    {category === 'All' && <span aria-hidden="true">✦ </span>}
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {currentSelection ? (
              <MapCanvas
                stalls={filteredStalls}
                selectedCategory={selectedCategory}
                selectedStall={currentSelection}
                onSelect={selectStall}
                visitedStallNumbers={profileStats?.visitedStalls ?? null}
              />
            ) : (
              <section className="pixel-panel p-4" role="status">
                <p className="pixel-eyebrow">NO STALLS IN THIS CATEGORY</p>
              </section>
            )}

            <div className="pixel-panel mt-4 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="pixel-eyebrow text-lime-300">TOP EXPLORERS</p>
                  <h3 className="section-title text-base">Leaderboard</h3>
                </div>
                <Link href="/leaderboard" className="pixel-link">FULL BOARD ↗</Link>
              </div>

              {eventData.leaderboard.length === 0 ? (
                <p className="text-sm text-[#b8c6aa]">No explorers have checked in yet.</p>
              ) : (
                <div className="space-y-2">
                  {eventData.leaderboard.slice(0, 3).map((entry) => (
                    <div key={`${entry.rank}-${entry.name}`} className="leader-row">
                      <div className="flex items-center gap-3">
                        <span className={`rank-token ${entry.rank === 1 ? 'rank-gold' : ''}`}>{entry.rank}</span>
                        <div>
                          <p className="text-sm font-bold text-slate-100">{entry.name}</p>
                          <p className="hud-label">{entry.visited} STALLS FOUND</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="coin-text">{entry.coins} <span>¢</span></p>
                        <p className="hud-label">COINS</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {currentSelection && <VendorDrawer stall={currentSelection} />}
    </main>
  );
}
