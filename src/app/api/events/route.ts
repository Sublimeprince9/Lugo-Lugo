import { NextResponse } from 'next/server';

import { eventStats, leaderboard, stalls } from '@/lib/event-data';

export async function GET() {
  return NextResponse.json({
    event: {
      name: 'UMA Fair 2026',
      venue: 'UMA Showgrounds, Lugogo',
    },
    stats: eventStats,
    leaderboard,
    stalls,
  });
}
