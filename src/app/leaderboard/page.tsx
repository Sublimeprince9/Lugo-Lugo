import Link from 'next/link';

const entries = [
  { name: 'Amina', coins: 920, stalls: 18 },
  { name: 'Joel', coins: 820, stalls: 16 },
  { name: 'You', coins: 640, stalls: 12 },
  { name: 'Cynthia', coins: 550, stalls: 11 },
  { name: 'Peter', coins: 510, stalls: 10 },
];

export default function LeaderboardPage() {
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
            <h1 className="mt-1 text-xl font-black text-[#fff2c3]">UMA Fair 2026</h1>
          </div>
          <span className="vendor-tag">● LIVE</span>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="leader-podium podium-second"><span>2ND</span><b>JOEL</b><small>820 ¢</small></div>
          <div className="leader-podium podium-first"><span>1ST</span><b>AMINA</b><small>920 ¢</small></div>
          <div className="leader-podium podium-third"><span>3RD</span><b>YOU</b><small>640 ¢</small></div>
        </div>

        <div className="mb-2 flex justify-between px-2">
          <span className="pixel-eyebrow">PLAYER</span>
          <span className="pixel-eyebrow">STALLS / COINS</span>
        </div>
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div key={entry.name} className={`leader-row ${entry.name === 'You' ? 'leader-row-you' : ''}`}>
              <div className="flex items-center gap-3">
                <span className={`rank-token ${index === 0 ? 'rank-gold' : ''}`}>{index + 1}</span>
                <div>
                  <p className="text-sm font-bold text-[#fff2c3]">{entry.name}</p>
                  <p className="hud-label">{entry.stalls} STALLS FOUND</p>
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
