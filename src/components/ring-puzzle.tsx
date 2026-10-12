import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from 'cn';
import type { WeekState } from '@/lib/app';

const C = 200, STEP = 45;
const A0 = -90, A1 = -38, MID = (A0 + A1) / 2;
// Bands of the vault coin, outer first so the inner rings sit on top.
const BANDS = [[92, 118], [58, 88], [0, 54]] as const;
const NAMES = ['Outer ring', 'Middle ring', 'Inner ring'];
const tickTone: Record<WeekState, string> = {
  open: 'var(--event)', upcoming: 'var(--input)', collected: 'var(--foreground)', cancelled: 'var(--bear)', expired: 'var(--flat-light)',
};

const pt = (deg: number, r: number) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)] as const;
const norm = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;
const arc = (r: number, a0: number, a1: number) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1},${y1}`; };
const shortest = (from: number, to: number) => from + ((((to - from) % 360) + 540) % 360) - 180;

/** Annular sector from a0 to a1 degrees (clockwise) between radii r0 and r1; r0 = 0 draws a pie wedge. */
function sector(r0: number, r1: number, a0: number, a1: number) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = pt(a0, r1), [x1, y1] = pt(a1, r1);
  if (r0 === 0) return `M${C},${C} L${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} Z`;
  const [x2, y2] = pt(a1, r0), [x3, y3] = pt(a0, r0);
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
}
const PIECES = BANDS.map(([r0, r1]) => ({
  ink: sector(r0, r1, A1, A0 + 360), lime: sector(r0, r1, A0, A1),
  // Machined notches along each ring's outer edge.
  notches: Array.from({ length: r0 ? 36 : 12 }, (_, i) => { const a = (i * 360) / (r0 ? 36 : 12); const [x0, y0] = pt(a, r1 - (i % 3 ? 4 : 8)), [x1, y1] = pt(a, r1 - 1); return `M${x0},${y0} L${x1},${y1}`; }).join(''),
}));
const RULER = Array.from({ length: 120 }, (_, i) => { const a = i * 3, long = i % 10 === 0; const [x0, y0] = pt(a, long ? 140 : 145), [x1, y1] = pt(a, 151); return `M${x0},${y0} L${x1},${y1}`; }).join('');
const SEGMENTS = [[0, 52], [58, 64], [70, 118], [132, 140], [146, 214], [226, 232], [240, 300], [312, 352]].map(([a, b]) => arc(186, a, b)).join('');

const aligned = (r: number[]) => Math.max(...r.map(x => r.filter(y => norm(y) === norm(x)).length));

function scramble() {
  for (;;) {
    const r = BANDS.map(() => STEP * (1 + Math.floor(Math.random() * 7)));
    if (aligned(r) < 3) return r;
  }
}

/** Stipend's vault coin as a HUD dial. The rings keep trying to line up the weekly slice on their own; grab one to finish it yourself. */
export function RingPuzzle({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ ring: number; start: number; last: number; acc: number } | null>(null);
  const [rot, setRot] = useState(scramble);
  const rotRef = useRef(rot);
  rotRef.current = rot;
  const [dragging, setDragging] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [solved, setSolved] = useState(false);
  const [out, setOut] = useState(false);
  const [status, setStatus] = useState('SEARCHING');
  // Hover, touch or focus holds the dial; it resumes 3.6 s after the reader leaves.
  const [held, setHeld] = useState(false);
  const release = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hold = () => { clearTimeout(release.current); setHeld(true); };
  const letGo = () => { clearTimeout(release.current); release.current = setTimeout(() => setHeld(false), 3600); };
  useEffect(() => () => clearTimeout(release.current), []);

  const count = aligned(rot);

  useEffect(() => { if (touched && !solved && dragging === null && count === 3) setSolved(true); }, [touched, solved, dragging, count]);

  // Once lined up, the coin turns upright like the Stipend mark, then the slice comes out.
  useEffect(() => {
    if (!solved) return;
    setStatus('SLICE UNLOCKED');
    const upright = setTimeout(() => setRot(r => r.map(d => d - norm(d) + (norm(d) > 180 ? 360 : 0))), 250);
    const pop = setTimeout(() => setOut(true), reduced ? 300 : 850);
    return () => { clearTimeout(upright); clearTimeout(pop); };
  }, [solved, reduced]);

  // Autoplay: two rings lock onto a target, the third misses, one breaks away, and it tries again. It never quite solves.
  useEffect(() => {
    if (touched || solved || reduced || held) return;
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(() => { if (alive && !document.hidden) fn(); }, ms));
    // Autoplay may come close but never completes the line-up; that is left to whoever grabs a ring.
    const move = (ring: number, to: number) => setRot(r => {
      const next = r.map((d, i) => (i === ring ? to : d));
      return aligned(next) === 3 ? r.map((d, i) => (i === ring ? to + STEP : d)) : next;
    });
    const attempt = () => {
      const r = rotRef.current, lead = Math.floor(Math.random() * 3), [a, b] = [0, 1, 2].filter(i => i !== lead).sort(() => Math.random() - 0.5);
      const target = norm(r[lead]);
      setStatus('SEARCHING');
      later(700, () => { move(a, shortest(rotRef.current[a], target)); setStatus('LOCKING'); });
      later(1500, () => move(b, shortest(rotRef.current[b], target) + (Math.random() < 0.5 ? STEP : -STEP)));
      later(2100, () => setStatus('LOCK FAILED'));
      later(2700, () => move(b, rotRef.current[b] + (Math.random() < 0.5 ? 12 : -12)));
      later(3100, () => move(b, Math.round(rotRef.current[b] / STEP) * STEP));
      later(3700, () => { const k = Math.floor(Math.random() * 3); move(k, rotRef.current[k] + STEP * (Math.random() < 0.5 ? 2 : -3)); setStatus('RETRY'); });
      later(4600, attempt);
    };
    later(900, attempt);
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, [touched, solved, reduced, held]);

  const angleAt = (e: React.PointerEvent) => {
    const b = boxRef.current?.getBoundingClientRect();
    return b ? (Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180) / Math.PI : 0;
  };
  const take = () => { if (!touched) { setTouched(true); setStatus('MANUAL'); } };
  const turn = (ring: number, to: number) => { take(); setRot(r => r.map((d, i) => (i === ring ? to : d))); };

  const onDown = (ring: number) => (e: React.PointerEvent<SVGGElement>) => {
    if (solved) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    take();
    drag.current = { ring, start: Math.round(rotRef.current[ring] / STEP) * STEP, last: angleAt(e), acc: 0 };
    setDragging(ring);
  };
  const onMove = (e: React.PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d) return;
    const a = angleAt(e);
    let step = a - d.last;
    if (step > 180) step -= 360;
    if (step < -180) step += 360;
    d.acc += step; d.last = a;
    setRot(r => r.map((x, i) => (i === d.ring ? d.start + d.acc : x)));
  };
  const onUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(null);
    turn(d.ring, Math.round((Math.abs(d.acc) < 6 ? d.start + STEP : d.start + d.acc) / STEP) * STEP);
  };
  const onKey = (ring: number) => (e: React.KeyboardEvent) => {
    if (solved) return;
    const by = { ArrowRight: STEP, ArrowUp: STEP, Enter: STEP, ' ': STEP, ArrowLeft: -STEP, ArrowDown: -STEP }[e.key];
    if (!by) return;
    e.preventDefault();
    turn(ring, Math.round(rotRef.current[ring] / STEP) * STEP + by);
  };
  const shuffle = () => { setOut(false); setSolved(false); setTouched(false); setStatus('SEARCHING'); setRot(scramble()); };

  const weeks: WeekState[] = solved ? ['collected', 'open', 'upcoming', 'upcoming'] : ['upcoming', 'upcoming', 'upcoming', 'upcoming'];
  const [dx, dy] = out ? [Math.cos((MID * Math.PI) / 180) * 34, Math.sin((MID * Math.PI) / 180) * 34] : [0, 0];
  const [tx, ty] = pt(MID, 142);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div ref={boxRef} role="group" aria-label="Vault dial: line up this week's slice" className={cn('hud relative aspect-square w-full select-none', held && 'is-held')}
        onPointerEnter={hold} onPointerLeave={letGo} onFocus={hold} onBlur={letGo}>
        {/* Back: halo and shared defs. */}
        <svg viewBox="0 0 400 400" className="hud-layer" aria-hidden="true">
          <defs>
            <filter id="stp-hud-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <radialGradient id="stp-hud-halo"><stop offset="0.55" stopColor="var(--event)" stopOpacity="0.16" /><stop offset="1" stopColor="var(--event)" stopOpacity="0" /></radialGradient>
            <linearGradient id="stp-hud-comet" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="var(--event)" stopOpacity="0" /><stop offset="1" stopColor="var(--event)" stopOpacity="1" /></linearGradient>
          </defs>
          <circle cx={C} cy={C} r={196} fill="url(#stp-hud-halo)" />
        </svg>
        {/* Ruler with degree labels, slow spin; segmented bracket ring, counter-spin. */}
        <svg viewBox="0 0 400 400" className="hud-layer hud-spin" style={{ '--hud-t': '120s' } as React.CSSProperties} aria-hidden="true">
          <path d={RULER} stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeWidth={1} />
          {[0, 90, 180, 270].map(a => { const [x, y] = pt(a - 90, 160); return <text key={a} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="hud-label" transform={`rotate(${a} ${x} ${y})`}>{String(a).padStart(3, '0')}</text>; })}
        </svg>
        <svg viewBox="0 0 400 400" className="hud-layer hud-spin rev" style={{ '--hud-t': '70s' } as React.CSSProperties} aria-hidden="true">
          <path d={SEGMENTS} fill="none" stroke="var(--input)" strokeWidth={3} />
          {[20, 110, 200, 290].map(a => <path key={a} d={arc(192, a, a + 14)} fill="none" stroke="var(--event)" strokeWidth={1.5} filter="url(#stp-hud-glow)" />)}
        </svg>
        {/* Weeks, the coin bed and the lock target. */}
        <svg viewBox="0 0 400 400" className="hud-layer" aria-hidden="true">
          {weeks.map((state, i) => {
            const start = -60 + i * 75 + 6, end = start + 63, [lx, ly] = pt(start + 31, 177);
            return (
              <g key={`${i}-${state}`}>
                <motion.path d={arc(168, start, end)} fill="none" stroke={tickTone[state]} strokeWidth={6} strokeLinecap="round" filter={state === 'open' ? 'url(#stp-hud-glow)' : undefined}
                  initial={{ pathLength: solved ? 0 : 1 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: solved ? 0.9 + 0.15 * i : 0, ease: [0.16, 1, 0.3, 1] }} />
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="hud-label" transform={`rotate(${norm(start + 31) < 180 ? start + 31 - 90 : start + 31 + 90} ${lx} ${ly})`}>W{i + 1}</text>
              </g>
            );
          })}
          <circle cx={C} cy={C} r={130} fill="var(--card)" stroke="var(--border)" />
          <circle cx={C} cy={C} r={134} fill="none" stroke="var(--input)" strokeDasharray="1 5" />
          <path d={`M${pt(MID - 9, 136).join(',')} L${tx},${ty} L${pt(MID + 9, 136).join(',')}`} fill="none" stroke="var(--event)" strokeWidth={2.5} strokeLinejoin="round" filter="url(#stp-hud-glow)" />
        </svg>
        {/* Scanner comet. */}
        <svg viewBox="0 0 400 400" className="hud-layer hud-spin" style={{ '--hud-t': '7s' } as React.CSSProperties} aria-hidden="true">
          <path d={arc(160, -110, -20)} fill="none" stroke="url(#stp-hud-comet)" strokeWidth={2.5} strokeLinecap="round" filter="url(#stp-hud-glow)" />
        </svg>
        {/* The three coin rings, each its own rotating layer. */}
        {PIECES.map((p, i) => (
          <svg key={i} viewBox="0 0 400 400" className={cn('hud-layer ring-layer', dragging === i && 'is-dragging')} style={{ transform: `rotate(${rot[i]}deg)` }}>
            <g role="slider" tabIndex={solved ? -1 : 0} aria-label={NAMES[i]} aria-valuemin={0} aria-valuemax={315} aria-valuenow={norm(rot[i])} aria-valuetext={`${norm(rot[i])} degrees`}
              className={cn('ring-piece', solved ? 'cursor-default' : 'cursor-grab')}
              onPointerDown={onDown(i)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey(i)}>
              <path d={p.ink} fill="var(--foreground)" stroke="var(--card)" strokeWidth={2} />
              <path d={p.notches} stroke="var(--card)" strokeOpacity={0.35} strokeWidth={1} pointerEvents="none" />
              <motion.path d={p.lime} fill="var(--event)" stroke="var(--event-edge)" strokeWidth={1} filter={count >= 2 || solved ? 'url(#stp-hud-glow)' : undefined}
                animate={{ x: dx, y: dy }} transition={{ type: 'spring', stiffness: 120, damping: 14 }} />
            </g>
          </svg>
        ))}
        {/* Hub and readout. */}
        <svg viewBox="0 0 400 400" className="hud-layer" aria-hidden="true">
          <circle cx={C} cy={C} r={7} fill="var(--card)" stroke="var(--event)" strokeWidth={1.5} />
          <path d={`M${C - 14},${C} H${C - 9} M${C + 9},${C} H${C + 14} M${C},${C - 14} V${C - 9} M${C},${C + 9} V${C + 14}`} stroke="var(--card)" strokeWidth={1.5} />
          <text x={C} y={386} textAnchor="middle" className="hud-label hud-readout">{status} · ALIGN {solved ? 3 : count}/3</text>
        </svg>
      </div>
      <p aria-live="polite" className="mt-1 min-h-5 text-center text-sm text-muted-foreground">
        {solved ? <>Lined up. That&rsquo;s your weekly slice. <button type="button" onClick={shuffle} className="font-medium text-foreground underline underline-offset-2">Shuffle</button></>
          : touched ? 'Turn the rings to line up this week’s slice.' : 'The vault keeps trying. Grab a ring to finish it.'}
      </p>
    </div>
  );
}
