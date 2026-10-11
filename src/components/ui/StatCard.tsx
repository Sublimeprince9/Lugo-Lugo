import type { EventStat } from '@/types/event';

export function StatCard({ label, value, tone }: EventStat) {
  const tones = {
    amber: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
    cyan: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
    violet: 'border-violet-400/30 bg-violet-500/10 text-violet-200',
  };

  return (
    <div className={`rounded-2xl border p-2 ${tones[tone]}`}>
      <p className="text-[10px] uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
