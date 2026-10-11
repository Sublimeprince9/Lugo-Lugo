'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { categories, eventStats, leaderboard, stalls } from '@/lib/event-data';
import { MapCanvas } from '@/components/map/MapCanvas';
import { VendorDrawer } from '@/components/drawer/VendorDrawer';
import { StatCard } from '@/components/ui/StatCard';
import type { Category, Stall } from '@/types/event';

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [selectedStall, setSelectedStall] = useState<Stall>(stalls[0]);

  const filteredStalls = useMemo(
    () => (selectedCategory === 'All' ? stalls : stalls.filter((stall) => stall.category === selectedCategory)),
    [selectedCategory],
  );
  const selectStall = useCallback((stall: Stall) => setSelectedStall(stall), []);

  const currentSelection = filteredStalls.some((stall) => stall.id === selectedStall.id)
    ? selectedStall
    : filteredStalls[0] ?? stalls[0];

  return (
    <main className="game-shell mx-auto flex min-h-screen max-w-md flex-col text-slate-100">
      <header className="game-header sticky top-0 z-20 px-4 pb-3 pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="pixel-eyebrow text-lime-300">UMA SHOWGROUNDS · LUGOGO</p>
            <h1 className="game-title">LUGO <span>LUGO</span></h1>
          </div>
          <div className="game-avatar" aria-label="Visitor profile">
            <span>LV</span>
          </div>
        </div>

        <div className="game-hud">
          <div className="hud-player">
            <div className="player-sprite" aria-hidden="true"><span /></div>
            <div>
              <span className="hud-label">VISITOR LV. 03</span>
              <div className="xp-track"><span /></div>
            </div>
          </div>
          <div className="hud-stats">
            {eventStats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 pb-36 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="pixel-eyebrow text-slate-400">CURRENT QUEST</p>
            <h2 className="section-title">Find your next stop</h2>
          </div>
          <Link href="/scan" className="pixel-button scan-button">
            <span className="scan-icon" aria-hidden="true">▦</span>
            SCAN
          </Link>
        </div>

        <div className="category-scroll mb-3 overflow-x-auto pb-2">
          <div className="flex min-w-max gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`category-chip ${
                  selectedCategory === category
                    ? 'category-chip-selected'
                    : ''
                }`}
              >
                {category === 'All' && <span aria-hidden="true">✦ </span>}
                {category}
              </button>
            ))}
          </div>
        </div>

        <MapCanvas
          stalls={filteredStalls}
          selectedCategory={selectedCategory}
          selectedStall={currentSelection}
          onSelect={selectStall}
        />

        <div className="pixel-panel mt-4 p-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="pixel-eyebrow text-lime-300">TOP EXPLORERS</p>
              <h3 className="section-title text-base">Leaderboard</h3>
            </div>
            <Link href="/leaderboard" className="pixel-link">
              FULL BOARD ↗
            </Link>
          </div>

          <div className="space-y-2">
            {leaderboard.map((entry, index) => (
              <div key={entry.name} className={`leader-row ${entry.name === 'You' ? 'leader-row-you' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className={`rank-token ${index === 0 ? 'rank-gold' : ''}`}>
                    {index + 1}
                  </span>
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
        </div>
      </div>

      <VendorDrawer stall={currentSelection} />
    </main>
  );
}
