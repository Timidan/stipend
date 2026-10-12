import { useEffect, useId, useRef, useState } from 'react';

export type TrendPoint = { at: number; value: number };

/** Interactive line chart: green when the period ends up, red when down. Hover, touch-drag or arrow keys move the crosshair. */
export function TrendChart({ name, points, height = 160, formatValue, formatTime, onHover }: {
  name: string; points: TrendPoint[]; height?: number; formatValue: (v: number) => string; formatTime: (at: number) => string;
  onHover?: (point: TrendPoint | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null), gradient = useId();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const show = (i: number | null) => { setIndex(i); onHover?.(i == null ? null : points[i]); };
  if (points.length < 2) return <div ref={ref} />;

  const axis = 64, top = 8, bottom = 22, plotW = Math.max(1, width - axis), plotH = height - top - bottom;
  const t0 = points[0].at, t1 = points[points.length - 1].at, values = points.map(p => p.value);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || Math.abs(max) * 0.01 || 1;
  const lo = min - span * 0.08, hi = max + span * 0.08;
  const x = (at: number) => (at - t0) / (t1 - t0 || 1) * plotW, y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * plotH;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const up = values[values.length - 1] >= values[0], color = up ? 'var(--bull)' : 'var(--bear)';
  const ticks = [0, 1, 2, 3].map(k => lo + (hi - lo) * (k + 0.5) / 4), stamps = [0, 1 / 3, 2 / 3, 1].map(f => t0 + (t1 - t0) * f);
  const nearest = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect(), at = t0 + Math.min(1, Math.max(0, (clientX - r.left) / plotW)) * (t1 - t0);
    let a = 0, b = points.length - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (points[m].at < at) a = m; else b = m; }
    return at - points[a].at <= points[b].at - at ? a : b;
  };
  const hovered = index == null ? null : points[index];
  return (
    <div ref={ref} tabIndex={0} role="img" aria-label={`${name}: ${formatValue(values[0])} to ${formatValue(values[values.length - 1])}. Use the arrow keys to read points.`}
      className="relative touch-pan-y rounded-md outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      onPointerMove={e => show(nearest(e.clientX))} onPointerDown={e => show(nearest(e.clientX))} onPointerLeave={() => show(null)} onBlur={() => show(null)}
      onKeyDown={e => {
        if (e.key === 'Escape') return show(null);
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        show(Math.min(points.length - 1, Math.max(0, (index ?? (e.key === 'ArrowLeft' ? points.length : -1)) + (e.key === 'ArrowLeft' ? -1 : 1))));
      }}>
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true" className="block overflow-visible">
          <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          {ticks.map(v => <g key={v}>
            <line x1={0} x2={plotW} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={plotW + 10} y={y(v)} dy="0.35em" className="fill-muted-foreground font-mono text-[0.6875rem] tnum">{formatValue(v)}</text>
          </g>)}
          {stamps.map((at, k) => <text key={at} x={x(at)} y={height - 4} textAnchor={k === 0 ? 'start' : k === 3 ? 'end' : 'middle'} className="fill-muted-foreground text-[0.6875rem]">{formatTime(at)}</text>)}
          <path d={`${line}L${plotW},${top + plotH}L0,${top + plotH}Z`} fill={`url(#${gradient})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hovered && <>
            <line x1={x(hovered.at)} x2={x(hovered.at)} y1={top} y2={top + plotH} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
            <circle cx={x(hovered.at)} cy={y(hovered.value)} r={4.5} fill={color} stroke="var(--card)" strokeWidth={2} />
          </>}
          {!hovered && <circle cx={x(t1)} cy={y(values[values.length - 1])} r={4} fill={color} stroke="var(--card)" strokeWidth={2} />}
        </svg>
      )}
    </div>
  );
}
