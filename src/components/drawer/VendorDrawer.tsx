'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Stall } from '@/types/event';

export function VendorDrawer({ stall }: { stall: Stall }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [stall.id]);

  return (
    <aside className="vendor-drawer fixed inset-x-0 bottom-0 z-30 px-4 pb-4 pt-3">
      <div className="mx-auto max-w-md">
        <button
          type="button"
          className="vendor-drawer-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((isExpanded) => !isExpanded)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="vendor-tag">{stall.category}</span>
            <span className="pixel-eyebrow truncate">{stall.zone}</span>
          </span>
          <span className="vendor-expand-label">{expanded ? 'CLOSE ▲' : 'STALL INFO ▼'}</span>
        </button>

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="pixel-eyebrow text-lime-300">STALL {stall.id}</p>
            <h3 className="truncate text-base font-black leading-tight text-[#fff2c3]">{stall.title}</h3>
          </div>
          <span className="vendor-reward">
            <span>+60 COINS</span>
            {stall.hasGiftReward && <span>✦ GIFT READY</span>}
          </span>
        </div>

        {expanded && (
          <>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#bac8aa]">{stall.description}</p>

            {stall.hasGiftReward && (
              <p className="mt-2 border border-[#8b703a] bg-[#3a3425] p-2 text-[10px] font-bold leading-4 text-[#f6cb65]">
                GIFT AVAILABLE · SCAN THIS STALL&apos;S QR TO EARN YOUR CHECK-IN COINS, THEN CLAIM THE GIFT IN YOUR PASSPORT.
              </p>
            )}

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="border border-[#3a5546] bg-[#172b2b] p-2">
                <p className="hud-label">PRICE RANGE</p>
                <p className="mt-1 font-bold text-[#f1e5bc]">{stall.price}</p>
              </div>
              <div className="border border-[#3a5546] bg-[#172b2b] p-2">
                <p className="hud-label">QUEST STATUS</p>
                <p className="mt-1 font-bold text-[#c6e877]">READY TO VISIT</p>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <a
                href={`https://wa.me/${stall.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="vendor-cta flex-1"
              >
                CHAT WITH EXHIBITOR
              </a>
              <Link href="/me" className="vendor-cta vendor-cta-secondary flex-1">
                MY PASSPORT
              </Link>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
