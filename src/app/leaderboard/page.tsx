'use client';

import Link from 'next/link';

import { useEventData } from '@/lib/use-event-data';

export default function LeaderboardPage() {
  const { data, error, loading } = useEventData();
  const leaders = data?.leaderboard ?? [];
  const podium = [leaders[1], leaders[0], leaders[2]];

  return (
    <main className="game-shell mx-auto min-h-screen max-w-md px-4 py-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="pixel-link">← RETURN TO MAP</Link>
        <p className="pixel-eyebrow">HALL OF FAME</p>
      </header>

      <section className="pixel-panel p-4">
        <div className="mb-4 flex items-center justify-between border-b border-[#3b5749] pb-4">
          <div>
            <p className="pixel-eyebrow text-lime-300">LIVE EVENT</p>
            <h1 className="mt-1 text-xl font-black text-[#fff2c3]">{data?.event.name ?? 'Explorer rankings'}</h1>
          </div>
          <span className="vendor-tag">● LIVE</span>
        </div>

        {error && (
          <div className="mb-4 border border-rose-400/30 bg-rose-500/10 p-3" role="alert">
            <p className="pixel-eyebrow text-rose-300">RANKINGS UNAVAILABLE</p>
            <p className="mt-2 text-sm text-[#b8c6aa]">{error}</p>
          </div>
        )}
        {loading && (
          <div className="mb-4 border border-[#3b5749] bg-[#172b2b] p-3" role="status">
            <p className="pixel-eyebrow">LOADING EXPLORERS</p>
          </div>
        )}

        {leaders.length > 0 && (
          <div className="mb-4 grid grid-cols-3 items-end gap-2 text-center">
            {podium.map((entry, index) => (
              <div className={`leader-podium ${index === 1 ? 'podium-first' : index === 0 ? 'podium-second' : 'podium-third'}`} key={entry?.rank ?? index}>
                {entry ? (
                  <>
                    <span>{index === 1 ? '1ST' : index === 0 ? '2ND' : '3RD'}</span>
                    <b>{entry.name.toUpperCase()}</b>
                    <small>{entry.coins} ¢</small>
                  </>
                ) : (
                  <>
                    <span>{index === 1 ? '1ST' : index === 0 ? '2ND' : '3RD'}</span>
                    <b>—</b>
                    <small>—</small>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mb-2 flex justify-between px-2">
          <span className="pixel-eyebrow">PLAYER</span>
          <span className="pixel-eyebrow">STALLS / COINS</span>
        </div>
        {leaders.length === 0 && !loading && !error && (
          <p className="py-4 text-center text-sm text-[#b8c6aa]">No explorers have checked in yet.</p>
        )}
        <div className="space-y-2">
          {leaders.map((entry) => (
            <div key={`${entry.rank}-${entry.name}`} className="leader-row">
              <div className="flex items-center gap-3">
                <span className={`rank-token ${entry.rank === 1 ? 'rank-gold' : ''}`}>{entry.rank}</span>
                <div>
                  <p className="text-sm font-bold text-[#fff2c3]">{entry.name}</p>
                  <p className="hud-label">{entry.visited} STALLS FOUND</p>
                </div>
              </div>
              <p className="coin-text">{entry.coins} <span>¢</span></p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
