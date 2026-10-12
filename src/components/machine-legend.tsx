import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from 'cn';
import { AgoraMark, MeraMark, MonadMark, PerplMark } from '@/components/brand';
import { Icon } from '@/components/icons';

type Mark = typeof AgoraMark;
export type Part = { id: string; Mark: Mark | null; part: string; text: string; phases: number[] };

// Each part owns the machine's phases it carries, so the legend can follow the tour (phase indices from iso/week-model.mjs).
export const PARTS: Part[] = [
  { id: 'lock', Mark: MeraMark, part: 'Lock and key', text: 'Your passkey is the key. One biometric check turns the lock and makes both keys, on your device.', phases: [0, 8] },
  { id: 'vault', Mark: AgoraMark, part: 'Savings vault', text: 'Your savings, in AUSD. Nothing moves without the key.', phases: [] },
  { id: 'escapement', Mark: AgoraMark, part: 'Four-pocket escapement', text: 'Four signed weekly allowances. AUSD enforces each one: once, in its week.', phases: [1, 2, 9] },
  { id: 'slice', Mark: null, part: 'Lime slice', text: 'This week’s play money. Your play key collects it, no biometrics. 0.25 AUSD fee.', phases: [3, 4] },
  { id: 'roller', Mark: PerplMark, part: 'Trading roller', text: 'Trade BTC, ETH or MON on Perpl. Lose at most your play money.', phases: [5, 6] },
  { id: 'lift', Mark: null, part: 'Banking lift', text: 'Close and bank from Home. Free AUSD returns to savings.', phases: [7] },
  { id: 'base', Mark: MonadMark, part: 'Base plate', text: 'Every step settles on Monad in about a second.', phases: [] },
];

function PartMark({ p, className }: { p: Part; className?: string }) {
  if (p.Mark) return <p.Mark className={className} />;
  if (p.id === 'slice') return <span className={cn('rounded-full bg-event', className)} style={{ width: '0.75em', height: '0.75em' }} />;
  return <Icon name="bank" size={14} className={className} />;
}

/** Watches the machine's data-phase (written by its animation loop) without re-rendering per frame. */
function useMachinePhase(figure: React.RefObject<HTMLElement | null>) {
  const [phase, setPhase] = useState(-1);
  useEffect(() => {
    const stage = figure.current?.querySelector<HTMLElement>('.aw');
    if (!stage) return;
    const read = () => setPhase(Number(stage.dataset.phase ?? -1));
    read();
    const mo = new MutationObserver(read);
    mo.observe(stage, { attributes: true, attributeFilter: ['data-phase'] });
    return () => mo.disconnect();
  }, [figure]);
  return phase;
}

/** The seven parts of the machine. Phones get chips plus one panel that follows the tour; wider screens get the full list. */
export function MachineLegend({ figure }: { figure: React.RefObject<HTMLElement | null> }) {
  const phase = useMachinePhase(figure);
  const live = PARTS.find(p => p.phases.includes(phase))?.id;
  const [pinned, setPinned] = useState<string | null>(null);
  const activeId = pinned ?? live ?? PARTS[0].id;
  const active = PARTS.find(p => p.id === activeId) ?? PARTS[0];
  const row = useRef<HTMLDivElement>(null);

  // Keep the active chip in view as the tour moves on. Scroll the chip row only: scrollIntoView would also move the page.
  useEffect(() => {
    const r = row.current, chip = r?.querySelector<HTMLElement>(`[data-id="${activeId}"]`);
    if (!r || !chip) return;
    r.scrollTo({ left: chip.offsetLeft - (r.clientWidth - chip.offsetWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [activeId]);

  const pick = (p: Part) => {
    setPinned(p.id);
    // Jump the machine to the part's first phase.
    if (p.phases.length) figure.current?.querySelector<HTMLElement>('.aw')?.dispatchEvent(new CustomEvent('aw:seek', { detail: p.phases[0] }));
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const by = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: PARTS.length - 1 - i }[e.key];
    if (by === undefined) return;
    e.preventDefault();
    const next = PARTS[(i + by + PARTS.length) % PARTS.length];
    pick(next);
    row.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus();
  };

  return (
    <>
      {/* Phones: chips in a scroll row, one panel. */}
      <div className="md:hidden">
        <div ref={row} role="tablist" aria-label="Parts of the machine" className="-mx-5 flex gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PARTS.map((p, i) => {
            const on = p.id === activeId;
            return (
              <button key={p.id} type="button" role="tab" data-id={p.id} aria-selected={on} aria-controls="machine-part" tabIndex={on ? 0 : -1} onClick={() => pick(p)} onKeyDown={e => onKey(e, i)}
                className={cn('tap relative inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors', on ? 'border-foreground text-foreground' : 'border-border text-muted-foreground')}>
                {on && <motion.span layoutId="machine-chip" className="absolute inset-0 -z-10 rounded-full bg-card" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                <PartMark p={p} className="size-4" />{p.part}
              </button>
            );
          })}
        </div>
        <motion.p key={active.id} id="machine-part" role="tabpanel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mt-3 min-h-[3.25rem] text-sm leading-relaxed">
          <b className="font-semibold">{active.part}.</b> <span className="text-muted-foreground">{active.text}</span>
          {!pinned && live && <span className="sr-only"> (now in the figure)</span>}
        </motion.p>
      </div>

      {/* Wider screens: the whole list, the live part marked. */}
      <ol className="hidden grid-cols-1 gap-3 text-sm md:grid">
        {PARTS.map(p => (
          <li key={p.id} className={cn('flex gap-3 rounded-xl px-2 py-1.5 -mx-2 transition-colors', p.id === live && 'bg-muted/70')} aria-current={p.id === live ? 'true' : undefined}>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted"><PartMark p={p} className="size-4" /></span>
            <span><b className="font-semibold">{p.part}.</b> <span className="text-muted-foreground">{p.text}</span></span>
          </li>
        ))}
      </ol>
    </>
  );
}
