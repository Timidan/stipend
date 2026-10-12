import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { app } from '@/lib/app';
import { useApp } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { MonadMark } from '@/components/brand';

const sheet = { initial: { y: '110%' }, animate: { y: 0 }, exit: { y: '110%' }, transition: { type: 'spring', stiffness: 380, damping: 36 } } as const;

function Spinner() {
  return <span aria-hidden="true" className="inline-block size-5 animate-spin rounded-full border-2 border-input border-t-foreground motion-reduce:animate-none" />;
}

export function Sheets() {
  const s = useApp();
  const open = !!s.error && !s.busy;
  // The page goes inert when the sheet opens, which blurs whatever had focus, so remember it beforehand.
  const last = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    const track = (e: FocusEvent) => { if (e.target instanceof HTMLElement && !e.target.closest('[role="alertdialog"]')) last.current = e.target; };
    document.addEventListener('focusin', track);
    return () => document.removeEventListener('focusin', track);
  }, []);
  useEffect(() => {
    if (open) { wasOpen.current = true; return; }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    requestAnimationFrame(() => { if (last.current?.isConnected) last.current.focus({ preventScroll: true }); });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') app.dismissError(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <AnimatePresence>
      {s.busy && (
        <motion.div key="busy" role="status" aria-live="polite" {...sheet}
          className="safe-bottom fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl border border-border bg-card px-5 pt-5 shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.25)]">
          <div className="flex items-center gap-3">
            <Spinner />
            <div className="min-w-0">
              <p className="font-semibold">{s.busy.action}</p>
              <p className="truncate text-sm text-muted-foreground">{s.busy.step ?? 'Working…'}</p>
            </div>
          </div>
          <p className="mt-4 flex items-center gap-1.5 pb-3 text-xs text-muted-foreground"><MonadMark className="size-3.5" />Each step settles on Monad testnet in about a second.</p>
        </motion.div>
      )}
      {!s.busy && s.error && (
        <motion.div key="error" role="alertdialog" aria-modal="true" aria-labelledby="stipend-error" {...sheet}
          className="safe-bottom fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl border border-bear/30 bg-card px-5 pt-5 shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.25)]">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-bear-soft text-bear"><Icon name="alert" size={16} /></span>
            <div className="min-w-0 flex-1">
              <p id="stipend-error" className="font-semibold">{s.error.message}</p>
              {s.error.detail && <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{s.error.detail}</p>}
            </div>
          </div>
          <Button autoFocus variant="outline" size="lg" className="mb-2 mt-4 w-full" onClick={() => app.dismissError()}>Got it</Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
