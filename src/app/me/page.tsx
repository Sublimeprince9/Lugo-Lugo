import Link from 'next/link';

export default function MePage() {
  return (
    <main className="game-shell mx-auto min-h-screen max-w-md px-4 py-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="pixel-link">← RETURN TO MAP</Link>
        <p className="pixel-eyebrow">PLAYER MENU</p>
      </header>

      <section className="pixel-panel p-4">
        <div className="flex items-center gap-3">
          <div className="profile-sprite" aria-hidden="true"><span>LV</span></div>
          <div className="min-w-0 flex-1">
            <p className="pixel-eyebrow text-lime-300">VISITOR · LEVEL 03</p>
            <h1 className="mt-1 truncate text-xl font-black text-[#fff2c3]">Your Adventure</h1>
            <div className="xp-track mt-2 w-full"><span /></div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="profile-stat">
            <p className="pixel-eyebrow">TOTAL COINS</p>
            <p className="mt-1 text-2xl font-black text-[#f6cb65]">640 <span>¢</span></p>
          </div>
          <div className="profile-stat">
            <p className="pixel-eyebrow">STALLS FOUND</p>
            <p className="mt-1 text-2xl font-black text-[#c6e877]">12<span className="text-sm text-[#9db39a]"> / 30</span></p>
          </div>
        </div>
      </section>

      <section className="pixel-panel mt-4 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="pixel-eyebrow text-lime-300">REWARD INVENTORY</p>
            <h2 className="mt-1 text-base font-black text-[#fff2c3]">Voucher quests</h2>
          </div>
          <span className="rank-token">02</span>
        </div>
        <div className="space-y-2">
          <div className="reward-row">
            <span className="reward-icon">★</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#fff2c3]">Gate Pass Reward</p>
              <p className="hud-label">PHONE VERIFICATION REQUIRED</p>
            </div>
            <span className="reward-status">READY</span>
          </div>
          <div className="reward-row">
            <span className="reward-icon reward-icon-purple">✦</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#fff2c3]">Exhibitor Coupon</p>
              <p className="hud-label">TWO OF THREE STALLS VISITED</p>
            </div>
            <span className="reward-status reward-progress">2/3</span>
          </div>
        </div>
      </section>
    </main>
  );
}
