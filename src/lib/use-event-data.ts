'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';

import type { Stall } from '@/types/event';

export const eventDataSchema = z.object({
  event: z.object({
    name: z.string(),
    venue: z.string().nullable(),
    slug: z.string(),
  }),
  stalls: z.array(z.object({
    id: z.string(),
    title: z.string(),
    category: z.enum(['Luxury', 'Food', 'Drinks', 'Science', 'Farming', 'Tech', 'Other']),
    zone: z.string(),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    description: z.string(),
    whatsapp: z.string(),
    price: z.string(),
    hasGiftReward: z.boolean().default(false),
  })),
  leaderboard: z.array(z.object({
    name: z.string(),
    coins: z.number().int().nonnegative(),
    visited: z.number().int().nonnegative(),
    rank: z.number().int().positive(),
  })),
});

export type EventData = {
  event: z.infer<typeof eventDataSchema>['event'];
  stalls: Stall[];
  leaderboard: z.infer<typeof eventDataSchema>['leaderboard'];
};

export function useEventData() {
  const [data, setData] = useState<EventData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/events', { cache: 'no-store' })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) {
          const errorPayload = z.object({ error: z.string() }).safeParse(payload);
          throw new Error(errorPayload.success ? errorPayload.data.error : 'Could not load event data.');
        }
        const parsed = eventDataSchema.safeParse(payload);
        if (!parsed.success) {
          console.error('Event API returned an invalid response.', parsed.error);
          throw new Error('Event data returned an unexpected response.');
        }
        if (active) setData(parsed.data);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load event data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { data, error, loading };
}
