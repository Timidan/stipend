import { useEffect, useRef } from 'react';
import { cn } from 'cn';
import { motion } from 'motion/react';
import { app } from '@/lib/app';
import { useApp, useNow } from '@/hooks';
import { until } from '@/format';
import { NetworkMark, Wordmark } from '@/components/brand';
import { Icon, type IconName } from '@/components/icons';
import { Link, usePath } from '@/router';

export const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/trade', label: 'Trade', icon: 'order' },
  { to: '/weeks', label: 'Weeks', icon: 'calendar' },
  { to: '/activity', label: 'Activity', icon: 'activity' },
];

function SessionPill() {
  const s = useApp(), now = useNow();
  if (s.phase === 'locked') {
    return (
      <button type="button" onClick={() => void app.signIn()} className="tap inline-flex h-9 items-center gap-1.5 rounded-full border border-input bg-card px-3 text-xs font-medium">
        <Icon name="key" size={14} />Unlock
      </button>
    );
  }
  if (s.phase !== 'ready') return null;
  const left = s.lockAt ? s.lockAt - now : 0;
  return (
    <button type="button" onClick={() => app.lock()} aria-label={`Play key unlocked, locks in ${until(left)}. Lock now.`}
      className="tap inline-flex h-9 items-center gap-1.5 rounded-full border border-input bg-card px-3 text-xs font-medium">
      <span className="tnum font-mono">Locks in {until(left)}</span>
      <Icon name="key" size={14} className="text-muted-foreground" />
    </button>
  );
}

export function Header() {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        <Link to="/" ariaLabel="Stipend home"><Wordmark /></Link>
        <div className="flex items-center gap-2">
          <NetworkMark />
          <SessionPill />
        </div>
      </div>
    </header>
  );
}

export function TabBar() {
  const path = usePath();
  return (
    <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/90 backdrop-blur-md">
      <ul className="mx-auto grid max-w-md grid-cols-4 px-2 pt-1.5">
        {TABS.map(t => {
          const active = path === t.to;
          return (
            <li key={t.to}>
              <Link to={t.to} ariaCurrent={active ? 'page' : undefined}
                className={cn('relative flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-[0.6875rem] font-medium transition-colors', active ? 'text-foreground' : 'text-muted-foreground')}>
                {active && <motion.span layoutId="tab-pill" className="absolute inset-x-3 inset-y-1 -z-10 rounded-lg bg-muted" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                <Icon name={t.icon} size={18} weight={active ? 'fill' : 'bold'} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Screen({ title, eyebrow, children, action, focusKey }: { title: string; eyebrow?: string; children: React.ReactNode; action?: React.ReactNode; focusKey?: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { document.title = `${title} · Stipend`; }, [title]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [title, focusKey]);
  return (
    <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-md px-4 pb-32 pt-5">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          {eyebrow && <p className="label-mono mb-1 text-xs text-muted-foreground">{eyebrow}</p>}
          <h1 ref={heading} tabIndex={-1} className="text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] outline-none">{title}</h1>
        </div>
        {action}
      </div>
      {children}
    </motion.main>
  );
}
