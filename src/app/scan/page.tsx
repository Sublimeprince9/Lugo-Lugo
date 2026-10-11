'use client';

import Link from 'next/link';
import { Html5Qrcode } from 'html5-qrcode';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import { useVisitorSession } from '@/components/auth/VisitorSessionProvider';
import { stalls } from '@/lib/event-data';
import type { Stall } from '@/types/event';

const READER_ID = 'stall-qr-reader';
const checkinResponseSchema = z.object({
  success: z.literal(true),
  stall: z.object({
    stallNumber: z.string(),
    title: z.string(),
  }),
  coinsAwarded: z.number().int().nonnegative(),
  stallsVisited: z.number().int().nonnegative(),
  zoneProgress: z.object({
    visited: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    percentage: z.number().int().min(0).max(100),
  }).nullable(),
  voucherAvailable: z.boolean(),
});
const apiErrorSchema = z.object({ error: z.string() });

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('Camera access timed out. Check camera permission and try again.')),
      timeoutMs,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function resolveStallCode(value: string): Stall | undefined {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;

  const directMatch = stalls.find((stall) => stall.id.toUpperCase() === normalized);
  if (directMatch) return directMatch;

  try {
    const parsed = new URL(value);
    const queryCode = parsed.searchParams.get('stall') ?? parsed.searchParams.get('id');
    const pathCode = parsed.pathname.match(/\/s\/([a-z0-9-]+)/i)?.[1];
    const code = (queryCode ?? pathCode)?.toUpperCase();
    return stalls.find((stall) => stall.id.toUpperCase() === code);
  } catch {
    return undefined;
  }
}

export default function ScanPage() {
  const { status: sessionStatus, error: sessionError, retry: retrySession } = useVisitorSession();
  const [manualCode, setManualCode] = useState('');
  const [scannedContent, setScannedContent] = useState('');
  const [recognizedStall, setRecognizedStall] = useState<Stall | null>(null);
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'scanning' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [checkinState, setCheckinState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledQueryTokenRef = useRef<string | null>(null);
  const scanHandledRef = useRef(false);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    if (scanner.isScanning) {
      await scanner.stop();
    }
    scanner.clear();
    scannerRef.current = null;
    setCameraState('idle');
  }, []);

  const checkIn = useCallback(async (value: string) => {
    const scannedValue = value.trim();
    let token = scannedValue;
    try {
      token = new URL(scannedValue).searchParams.get('t') ?? scannedValue;
    } catch {
      // Raw signed QR tokens are also valid input.
    }

    setScannedContent(scannedValue);
    setRecognizedStall(null);
    setCheckinState('submitting');
    setMessage('');
    if (sessionStatus !== 'ready') {
      setCheckinState('error');
      setMessage(sessionError ?? 'Visitor session is not ready. Reconnect before checking in.');
      return;
    }

    try {
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const errorPayload = apiErrorSchema.safeParse(payload);
        throw new Error(errorPayload.success ? errorPayload.data.error : 'Check-in could not be completed.');
      }

      const result = checkinResponseSchema.safeParse(payload);
      if (!result.success) {
        console.error('Check-in API returned an invalid response.', result.error);
        throw new Error('Check-in returned an unexpected response. Please try again.');
      }

      setRecognizedStall(stalls.find((stall) => stall.id === result.data.stall.stallNumber) ?? null);
      setCheckinState('success');
      setMessage(
        `+${result.data.coinsAwarded} coins earned. You have visited ${result.data.stallsVisited} stalls.`
        + (result.data.zoneProgress
          ? ` Zone progress: ${result.data.zoneProgress.visited}/${result.data.zoneProgress.total} (${result.data.zoneProgress.percentage}%).`
          : '')
        + (result.data.voucherAvailable ? ' A voucher is available at this stall.' : ''),
      );
    } catch (cause) {
      setCheckinState('error');
      setMessage(cause instanceof Error ? cause.message : 'Check-in could not be completed.');
    }
  }, [sessionStatus, sessionError]);

  const lookupManualCode = useCallback((value: string) => {
    const code = value.trim();
    const stall = resolveStallCode(code);
    setScannedContent(code);
    setRecognizedStall(stall ?? null);
    setCheckinState('idle');
    setMessage(
      stall
        ? `${stall.id} matches ${stall.title}. A stall ID is not a signed QR token and cannot award a check-in.`
        : 'No sample stall matches that ID. Manual IDs are for lookup only; scan a signed stall QR to check in.',
    );
  }, []);

  const handleScannedCode = useCallback(async (value: string) => {
    const scannedValue = value.trim();
    let token: string | null = null;
    try {
      token = new URL(scannedValue).searchParams.get('t');
    } catch {
      token = scannedValue.includes('.') ? scannedValue : null;
    }
    if (token) {
      await checkIn(token);
      return;
    }
    lookupManualCode(scannedValue);
  }, [checkIn, lookupManualCode]);

  const startCamera = useCallback(async () => {
    if (cameraState === 'starting' || cameraState === 'scanning' || sessionStatus !== 'ready') return;
    setCameraState('starting');
    setMessage('');
    scanHandledRef.current = false;

    try {
      const cameras = await withTimeout(Html5Qrcode.getCameras(), 12000);
      if (cameras.length === 0) {
        throw new Error('No camera was found on this device.');
      }
      const camera = cameras.find(({ label }) => /back|rear|environment/i.test(label))
        ?? cameras[cameras.length - 1];
      const scanner = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { deviceId: camera.id },
        { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
        (decodedText) => {
          if (scanHandledRef.current) return;
          scanHandledRef.current = true;
          void stopCamera().catch((error: unknown) => {
            console.error('Could not stop the QR scanner after reading a code.', error);
          });
          void handleScannedCode(decodedText);
        },
        () => undefined,
      );
      setCameraState('scanning');
    } catch (error) {
      const failedScanner = scannerRef.current;
      scannerRef.current = null;
      if (failedScanner) {
        try {
          if (failedScanner.isScanning) await failedScanner.stop();
          failedScanner.clear();
        } catch (cleanupError) {
          console.error('Could not clean up the QR scanner after startup failed.', cleanupError);
        }
      }
      setCameraState('error');
      setMessage(error instanceof Error ? error.message : 'Could not start the camera scanner.');
    }
  }, [cameraState, handleScannedCode, sessionStatus, stopCamera]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('t');
    if (!token || handledQueryTokenRef.current === token || sessionStatus === 'loading') return;
    if (sessionStatus !== 'ready') {
      setCheckinState('error');
      setMessage(sessionError ?? 'Connect a visitor session before checking in.');
      return;
    }
    handledQueryTokenRef.current = token;
    void checkIn(token);
  }, [checkIn, sessionError, sessionStatus]);

  useEffect(() => () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    void (async () => {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    })().catch((error: unknown) => {
      console.error('Could not clean up the QR scanner.', error);
    });
  }, []);

  const submitManualCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualCode.trim()) {
      setMessage('Enter a stall ID to look up a booth.');
      return;
    }
    lookupManualCode(manualCode);
  };

  return (
    <main className="game-shell mx-auto flex min-h-screen max-w-md flex-col px-4 py-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="pixel-link">← RETURN TO MAP</Link>
        <p className="pixel-eyebrow">CHECK-IN QUEST</p>
      </header>

      {sessionStatus !== 'ready' && (
        <section className="scan-result mb-4" role={sessionStatus === 'error' ? 'alert' : 'status'}>
          <p className="pixel-eyebrow text-lime-300">
            {sessionStatus === 'loading' ? 'CONNECTING VISITOR SESSION' : 'VISITOR SESSION UNAVAILABLE'}
          </p>
          <p className="mt-2 text-xs leading-5 text-[#c2cfb0]">
            {sessionError ?? 'Starting a secure anonymous visitor session…'}
          </p>
          {sessionStatus === 'error' && (
            <button type="button" className="pixel-button mt-3 px-3" onClick={retrySession}>RETRY</button>
          )}
          {sessionStatus === 'unconfigured' && (
            <p className="mt-2 text-[10px] leading-4 text-[#b6c4a4]">
              Add the Supabase URL and anon key to .env.local, enable anonymous sign-ins, then restart the app.
            </p>
          )}
        </section>
      )}

      <div className="pixel-panel p-4">
        <div className="mb-5 flex items-center justify-between border-b border-[#3b5749] pb-3">
          <div>
            <p className="pixel-eyebrow text-lime-300">STALL PASSPORT</p>
            <h1 className="mt-1 text-xl font-black text-[#fff2c3]">Scan to discover</h1>
          </div>
          <div className="rank-token rank-gold" aria-hidden="true">✦</div>
        </div>

        <div className="scanner-frame">
          <div id={READER_ID} className="camera-reader" aria-label="QR camera reader" />
          {cameraState !== 'scanning' && (
            <>
              <div className="scanner-corners" aria-hidden="true">
                <span /><span /><span /><span />
              </div>
              <div className="qr-pixel-art" aria-hidden="true">
                <span className="qr-finder qr-one" /><span className="qr-finder qr-two" /><span className="qr-finder qr-three" />
                <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
              </div>
              <span className="scanner-scanline" aria-hidden="true" />
              <p className="scanner-caption">
                {cameraState === 'starting' ? 'STARTING CAMERA…' : 'CAMERA SCANNER · READY'}
              </p>
            </>
          )}
        </div>

        <button
          type="button"
          className="pixel-button mt-4 w-full"
          disabled={cameraState === 'starting' || (cameraState !== 'scanning' && sessionStatus !== 'ready')}
          onClick={() => {
            if (cameraState === 'scanning') {
              void stopCamera().catch((error: unknown) => {
                console.error('Could not stop the QR scanner.', error);
                setMessage('Could not stop the camera. Please close this page to release it.');
              });
            } else {
              void startCamera();
            }
          }}
        >
          {cameraState === 'starting' ? 'OPENING CAMERA…' : cameraState === 'scanning' ? 'STOP CAMERA' : 'START CAMERA SCAN'}
        </button>

        <div className="mt-5 text-center">
          <p className="pixel-eyebrow">POINT AT A STALL QR CODE</p>
          <p className="mt-2 text-xs leading-5 text-[#b6c4a4]">
            {sessionStatus === 'ready'
              ? 'Camera access requires permission and a secure connection (HTTPS or localhost).'
              : 'Connect a visitor session before scanning a check-in QR code.'}
          </p>
        </div>
      </div>

      <form className="pixel-panel mt-4 p-4" onSubmit={submitManualCode}>
        <label htmlFor="stall-code" className="pixel-eyebrow text-lime-300">NO CAMERA? ENTER STALL ID</label>
        <div className="mt-3 flex gap-2">
          <input
            id="stall-code"
            className="game-input min-w-0 flex-1"
            placeholder="e.g. A12"
            autoComplete="off"
            maxLength={64}
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
          />
          <button type="submit" className="pixel-button px-3">LOOK UP</button>
        </div>
      </form>

      {message && (
        <section
          className={`scan-result mt-4 ${checkinState === 'success' || (recognizedStall && checkinState === 'idle') ? 'scan-result-found' : ''}`}
          role={checkinState === 'success' || (recognizedStall && checkinState === 'idle') ? 'status' : 'alert'}
          aria-live="polite"
        >
          <p className="pixel-eyebrow text-lime-300">
            {checkinState === 'submitting' ? 'VERIFYING SIGNED QR' : checkinState === 'success' ? 'CHECK-IN SAVED' : recognizedStall ? 'STALL FOUND' : 'SCAN STATUS'}
          </p>
          {recognizedStall && (
            <h2 className="mt-1 text-base font-black text-[#fff2c3]">
              {recognizedStall.id} · {recognizedStall.title}
            </h2>
          )}
          <p className="mt-2 text-xs leading-5 text-[#c2cfb0]">{message}</p>
          {scannedContent && !recognizedStall && (
            <p className="mt-2 break-all font-mono text-[10px] text-[#8fa18a]">
              Captured: {scannedContent.slice(0, 160)}{scannedContent.length > 160 ? '…' : ''}
            </p>
          )}
          {checkinState === 'error' && scannedContent && (
            <button type="button" className="pixel-button mt-3 px-3" onClick={() => void checkIn(scannedContent)}>
              RETRY CHECK-IN
            </button>
          )}
        </section>
      )}

      <p className="mt-auto pt-6 text-center text-[10px] font-bold tracking-[0.1em] text-[#829984]">
        SIGNED QR REQUIRED · MANUAL IDS ARE LOOKUP ONLY
      </p>
    </main>
  );
}
