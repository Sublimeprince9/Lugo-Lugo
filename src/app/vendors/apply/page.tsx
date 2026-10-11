'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { z } from 'zod';

import { useEventData } from '@/lib/use-event-data';
import { categories } from '@/lib/event-data';

const responseSchema = z.object({
  success: z.literal(true),
  applicationId: z.string().uuid(),
});
const errorSchema = z.object({ error: z.string() });
const offeredCategories = categories.filter((category) => category !== 'All');
const maximumPhotos = 3;
const maximumPhotoBytes = 5 * 1024 * 1024;

export default function VendorApplicationPage() {
  const { data: eventData, error: eventError, loading: eventLoading } = useEventData();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [mapX, setMapX] = useState(50);
  const [mapY, setMapY] = useState(50);
  const zones = useMemo(
    () => Array.from(new Set(eventData?.stalls.map((stall) => stall.zone) ?? [])).sort(),
    [eventData?.stalls],
  );

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    form.set('mapX', String(mapX));
    form.set('mapY', String(mapY));
    try {
      const response = await fetch('/api/vendor-applications', {
        method: 'POST',
        body: form,
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const result = errorSchema.safeParse(payload);
        throw new Error(result.success ? result.data.error : 'Could not submit your application.');
      }
      const result = responseSchema.safeParse(payload);
      if (!result.success) {
        console.error('Vendor application API returned an invalid response.', result.error);
        throw new Error('The application response was unexpected. Contact the event organizer before trying again.');
      }
      setApplicationId(result.data.applicationId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your application.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="game-shell mx-auto min-h-screen max-w-md px-4 py-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="pixel-link">← RETURN TO MAP</Link>
        <p className="pixel-eyebrow">VENDOR ONBOARDING</p>
      </header>

      <section className="pixel-panel mb-4 p-4">
        <p className="pixel-eyebrow text-lime-300">JOIN THE FAIR</p>
        <h1 className="mt-1 text-xl font-black text-[#fff2c3]">Vendor application</h1>
        <p className="mt-2 text-xs leading-5 text-[#b8c6aa]">
          Submit your stall details for organizer review. Your listing will not appear on the visitor map until it is approved.
        </p>
      </section>

      {(eventLoading || eventError) && (
        <section className="pixel-panel mb-4 p-4" role={eventError ? 'alert' : 'status'}>
          <p className="pixel-eyebrow">{eventError ? 'EVENT MAP UNAVAILABLE' : 'LOADING EVENT MAP'}</p>
          <p className="mt-2 text-xs text-[#b8c6aa]">{eventError ?? 'Loading event zones for stall placement…'}</p>
        </section>
      )}

      {applicationId ? (
        <section className="pixel-panel p-5" role="status">
          <p className="pixel-eyebrow text-lime-300">APPLICATION RECEIVED</p>
          <h2 className="mt-2 text-lg font-black text-[#fff2c3]">Thanks for applying</h2>
          <p className="mt-2 text-sm leading-6 text-[#b8c6aa]">
            An organizer will verify your stall details and contact you using the information provided. Your application reference is:
          </p>
          <p className="mt-3 break-all font-mono text-xs text-lime-300">{applicationId}</p>
          <Link href="/" className="pixel-button mt-5 px-4">RETURN TO MAP</Link>
        </section>
      ) : (
        <form className="space-y-4" onSubmit={submitApplication}>
          <section className="pixel-panel space-y-3 p-4">
            <div>
              <p className="pixel-eyebrow text-lime-300">01 · BUSINESS DETAILS</p>
              <h2 className="mt-1 font-black text-[#fff2c3]">Tell us about your stall</h2>
            </div>
            <label className="form-field">
              <span>Business / display name</span>
              <input name="businessName" className="game-input" minLength={2} maxLength={100} required />
            </label>
            <label className="form-field">
              <span>Stall number from your organizer</span>
              <input name="stallNumber" className="game-input" maxLength={32} required />
            </label>
            <p className="text-[10px] leading-4 text-[#8fa18a]">Entering a stall number does not grant ownership. The event organizer will verify it.</p>
            <label className="form-field">
              <span>Category</span>
              <select name="category" className="game-input" required defaultValue="">
                <option value="" disabled>Select a category</option>
                {offeredCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Short description</span>
              <textarea name="description" className="game-input min-h-24" minLength={10} maxLength={1200} required />
            </label>
          </section>

          <section className="pixel-panel space-y-3 p-4">
            <div>
              <p className="pixel-eyebrow text-lime-300">02 · CONTACT</p>
              <h2 className="mt-1 font-black text-[#fff2c3]">How can the organizer reach you?</h2>
            </div>
            <label className="form-field">
              <span>Contact person</span>
              <input name="contactName" className="game-input" autoComplete="name" maxLength={100} required />
            </label>
            <label className="form-field">
              <span>Email address</span>
              <input name="contactEmail" className="game-input" type="email" autoComplete="email" maxLength={254} required />
            </label>
            <label className="form-field">
              <span>WhatsApp number</span>
              <input name="whatsapp" className="game-input" type="tel" autoComplete="tel" maxLength={32} required />
            </label>
            <label className="form-field">
              <span>Website (optional)</span>
              <input name="websiteUrl" className="game-input" type="url" placeholder="https://" maxLength={2048} />
            </label>
          </section>

          <section className="pixel-panel space-y-3 p-4">
            <div>
              <p className="pixel-eyebrow text-lime-300">03 · MAP PLACEMENT</p>
              <h2 className="mt-1 font-black text-[#fff2c3]">Where is your stall?</h2>
            </div>
            <label className="form-field">
              <span>Event zone</span>
              <select name="zoneName" className="game-input" required defaultValue="">
                <option value="" disabled>Select the closest zone</option>
                {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
              </select>
            </label>
            <p className="text-[10px] leading-4 text-[#8fa18a]">
              Place the marker approximately on the event map. An organizer will confirm the exact position before publishing.
            </p>
            <div className="vendor-location-preview" aria-label={`Approximate map position, horizontal ${mapX} percent, vertical ${mapY} percent`}>
              <span className="vendor-map-road vendor-map-road-horizontal" />
              <span className="vendor-map-road vendor-map-road-vertical" />
              <span className="vendor-map-pin" style={{ left: `${mapX}%`, top: `${mapY}%` }}>★</span>
            </div>
            <label className="form-field">
              <span>Horizontal position: {mapX}%</span>
              <input name="mapX" type="range" min="0" max="100" value={mapX} onChange={(event) => setMapX(Number(event.target.value))} />
            </label>
            <label className="form-field">
              <span>Vertical position: {mapY}%</span>
              <input name="mapY" type="range" min="0" max="100" value={mapY} onChange={(event) => setMapY(Number(event.target.value))} />
            </label>
          </section>

          <section className="pixel-panel space-y-3 p-4">
            <div>
              <p className="pixel-eyebrow text-lime-300">04 · STALL PHOTOS</p>
              <h2 className="mt-1 font-black text-[#fff2c3]">Add a few photos</h2>
            </div>
            <label className="form-field">
              <span>Choose photos or take a picture (up to 3, 5 MB each)</span>
              <input
                name="photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length > maximumPhotos || files.some((file) => file.size > maximumPhotoBytes)) {
                    event.target.setCustomValidity('Choose up to 3 JPEG, PNG, or WebP photos, each no larger than 5 MB.');
                  } else {
                    event.target.setCustomValidity('');
                  }
                }}
              />
            </label>
            <label className="flex items-start gap-2 text-xs leading-5 text-[#b8c6aa]">
              <input name="photoConsent" type="checkbox" value="true" className="mt-1 accent-lime-300" />
              <span>If I add photos, I confirm I may share them and allow the organizer to publish approved photos with my stall listing.</span>
            </label>
          </section>

          <section className="pixel-panel space-y-3 p-4">
            <div>
              <p className="pixel-eyebrow text-lime-300">05 · OPTIONAL VISITOR GIFT</p>
              <h2 className="mt-1 font-black text-[#fff2c3]">Offer a limited gift or voucher</h2>
            </div>
            <label className="form-field">
              <span>Gift / voucher name</span>
              <input name="giftTitle" className="game-input" maxLength={100} />
            </label>
            <label className="form-field">
              <span>What does the visitor receive? Include any terms.</span>
              <textarea name="giftDetails" className="game-input min-h-20" maxLength={600} />
            </label>
            <label className="form-field">
              <span>Available quantity</span>
              <input name="giftQuantity" className="game-input" type="number" min="1" max="10000" step="1" />
            </label>
            <p className="text-[10px] leading-4 text-[#8fa18a]">
              Gift offers are proposals, not live rewards. The organizer must approve the terms and quantity. An approved offer shows a floating coin on your map stall; visitors scan the stall QR for the usual check-in coins, then claim the gift separately in their passport.
            </p>
          </section>

          {error && <p className="pixel-panel p-3 text-sm text-rose-200" role="alert">{error}</p>}
          <button type="submit" className="pixel-button w-full" disabled={submitting || !eventData || zones.length === 0}>
            {submitting ? 'SENDING APPLICATION…' : 'SUBMIT FOR ORGANIZER REVIEW'}
          </button>
          <p className="pb-4 text-center text-[10px] leading-4 text-[#829984]">
            By applying, you agree that the organizer may use these details to review your stall listing. Your email is for organizer contact; WhatsApp may be shown publicly if your listing is approved.
          </p>
        </form>
      )}
    </main>
  );
}
