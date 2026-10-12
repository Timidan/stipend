import { motion } from 'motion/react';
import { cn } from 'cn';
import type { WeekState } from '@/lib/app';

const C = 200, R = 118;
const pt = (deg: number, r = R) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)] as const;
const A0 = -90, A1 = -38, MID = (A0 + A1) / 2;

const coin = (() => { const [x1, y1] = pt(A1), [x0, y0] = pt(A0); return `M${C},${C} L${x1},${y1} A${R},${R} 0 1 1 ${x0},${y0} Z`; })();
const slice = (() => { const [x0, y0] = pt(A0), [x1, y1] = pt(A1); return `M${C},${C} L${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1} Z`; })();

const tickTone: Record<WeekState, string> = {
  open: 'var(--event)', upcoming: 'var(--input)', collected: 'var(--foreground)', cancelled: 'var(--bear)', expired: 'var(--flat-light)',
};

/** Savings as a ring of ink; this week's allowance as a lemon slice that slides out once it is collected. */
export function VaultArt({ out = 0, weeks = [], className, label = 'Savings with a weekly slice' }: { out?: number; weeks?: WeekState[]; className?: string; label?: string }) {
  const [dx, dy] = [Math.cos((MID * Math.PI) / 180) * 34 * out, Math.sin((MID * Math.PI) / 180) * 34 * out];
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label={label} className={cn('vault-art overflow-visible', className)}>
      {[150, 170, 188].map((r, i) => (
        <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="var(--input)" strokeWidth={i === 1 ? 1 : 0.75}
          strokeDasharray={i === 0 ? '2 7' : i === 1 ? '1 0' : '18 10'} className={cn('vault-orbit', i === 2 && 'vault-orbit-rev')} style={{ animationDuration: `${60 + i * 25}s` }} />
      ))}
      {weeks.slice(0, 8).map((state, i, all) => {
        const span = 300 / Math.max(all.length, 4), start = -60 + i * span + 6, end = start + span - 12;
        const [x0, y0] = pt(start, 170), [x1, y1] = pt(end, 170);
        return <motion.path key={i} d={`M${x0},${y0} A170,170 0 0 1 ${x1},${y1}`} fill="none" stroke={tickTone[state]} strokeWidth={6} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.15 * i, ease: [0.16, 1, 0.3, 1] }} />;
      })}
      <circle cx={C} cy={C} r={R + 10} fill="var(--card)" stroke="var(--border)" />
      <path d={coin} fill="var(--foreground)" />
      <g stroke="var(--background)" strokeOpacity={0.12} fill="none">
        {[96, 74, 52].map(r => <circle key={r} cx={C} cy={C} r={r} />)}
      </g>
      <motion.path d={slice} fill="var(--event)" stroke="var(--event-edge)" strokeWidth={1}
        animate={{ x: dx, y: dy }} transition={{ type: 'spring', stiffness: 120, damping: 14 }} />
    </svg>
  );
}
