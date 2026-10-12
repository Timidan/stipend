import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from 'cn';
import { app, type Week, type WeekState } from '@/lib/app';
import { useApp, useNow } from '@/hooks';
import { ausd, day, parseAusd, until } from '@/format';
import { Screen } from '@/components/shell';
import { VaultArt } from '@/components/vault-art';
import { AgoraMark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/icons';

const MIN_WEEKLY = 120_000_000n;
const WEEKS = 4;

const CHIP: Record<WeekState, { label: string; tone: string }> = {
  open: { label: 'Open now', tone: 'bg-event text-event-foreground' },
  upcoming: { label: 'Upcoming', tone: 'bg-muted text-ink-2' },
  collected: { label: 'Collected', tone: 'bg-bull-soft text-bull' },
  cancelled: { label: 'Cancelled', tone: 'bg-bear-soft text-bear' },
  expired: { label: 'Missed', tone: 'bg-muted text-muted-foreground' },
};

function Setup() {
  const s = useApp();
  const [text, setText] = useState('120');
  const weekly = parseAusd(text);
  const valid = weekly != null && weekly >= MIN_WEEKLY;
  const field = useRef<HTMLInputElement>(null);
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <label className="block">
        <span className="text-sm text-muted-foreground">Play money per week</span>
        <div className="relative mt-1.5">
          <Input ref={field} inputMode="decimal" value={text} onChange={e => setText(e.target.value.replace(',', '.'))} className="h-14 pr-16 text-2xl font-semibold tnum" aria-invalid={!valid || undefined} aria-describedby="weekly-hint" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">AUSD</span>
        </div>
      </label>
      <p id="weekly-hint" className={cn('mt-2 text-xs', valid ? 'text-muted-foreground' : 'text-bear')}>{valid ? 'Minimum 120 on testnet. Perpl needs 100 AUSD to open an account. Each collection costs 0.25 AUSD.' : 'Enter at least 120 AUSD.'}</p>
      <ol className="mt-5 grid grid-cols-1 gap-3 text-sm">
        <li className="flex gap-3"><Icon name="key" size={16} className="mt-0.5 shrink-0" /><span>Your savings key signs {WEEKS} allowances in one biometric check.</span></li>
        <li className="flex gap-3"><AgoraMark className="mt-0.5 size-4" /><span>Each one lets your play key take that amount once, in its week. <b>AUSD enforces this, not our app.</b></span></li>
        <li className="flex gap-3"><Icon name="close" size={16} className="mt-0.5 shrink-0" /><span>Cancel any future week. Savings never move without biometrics.</span></li>
      </ol>
      <Button variant="event" size="lg" className="mt-5 min-h-14 w-full text-base" disabled={!!s.busy || s.phase !== 'ready'}
        onClick={() => { if (!valid || !weekly) { field.current?.focus(); return; } void app.setAllowance(weekly, WEEKS); }}>
        <Icon name="key" size={18} />Sign {WEEKS} weeks with biometrics
      </Button>
      {weekly != null && s.savings != null && s.savings < weekly && <p className="mt-2 text-center text-xs text-wait">Savings hold {ausd(s.savings)} AUSD. Each week needs {ausd(weekly)} in savings when you collect it.</p>}
    </section>
  );
}

function WeekRow({ w, i }: { w: Week; i: number }) {
  const s = useApp(), now = useNow(30_000);
  const chip = CHIP[w.state];
  const ms = w.state === 'open' ? Number(w.end) * 1000 - now : Number(w.start) * 1000 - now;
  return (
    <motion.li initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, duration: 0.35 }}
      className={cn('flex items-center gap-3 rounded-2xl border bg-card p-4', w.state === 'open' ? 'border-foreground' : 'border-border')}>
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-sm font-semibold tnum">W{i + 1}</div>
      <div className="min-w-0 flex-1">
        <p className="font-medium tnum">{ausd(w.value)} AUSD</p>
        <p className="text-xs text-muted-foreground">{day(w.start)} – {day(w.end - 1n)}{(w.state === 'open' || w.state === 'upcoming') && <span className="whitespace-nowrap"> · {w.state === 'open' ? 'closes' : 'opens'} in <span className="tnum">{until(ms)}</span></span>}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className={cn('rounded-full px-2 py-0.5 text-[0.6875rem] font-medium', chip.tone)}>{chip.label}</span>
        {w.state === 'upcoming' && (
          <button type="button" disabled={!!s.busy || s.phase !== 'ready'} onClick={() => void app.cancelWeek(w.start)} className="text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-40">Cancel week</button>
        )}
      </div>
    </motion.li>
  );
}

export function Weeks() {
  const s = useApp();
  const live = s.weeks.filter(w => w.state === 'open' || w.state === 'upcoming');
  return (
    <Screen title="Weekly allowance" eyebrow="Signed by your savings key">
      <div className="mx-auto mb-4 w-44"><VaultArt out={s.weeks.some(w => w.state === 'collected') ? 1 : 0} weeks={s.weeks.map(w => w.state)} label="Your signed weeks around your savings" /></div>
      {s.weeks.length > 0 && (
        <ul className="grid grid-cols-1 gap-2">{s.weeks.map((w, i) => <WeekRow key={String(w.start)} w={w} i={i} />)}</ul>
      )}
      {!live.length && <div className="mt-3"><Setup /></div>}
      {s.weeks.length > 0 && (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Each week is an AUSD <span className="font-mono">ReceiveWithAuthorization</span>, signed by your savings key. This device keeps them. Cleared your browser? Sign in and sign the weeks again.</p>
      )}
    </Screen>
  );
}
