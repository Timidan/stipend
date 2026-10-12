import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { app } from '@/lib/app';
import { useApp } from '@/hooks';
import { AgoraMark, MeraMark, NetworkMark, PARTNERS, PerplMark, Wordmark } from '@/components/brand';
import { RingPuzzle } from '@/components/ring-puzzle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/icons';
import { AnatomyWeek } from '@/components/anatomy-week';
import { MachineLegend } from '@/components/machine-legend';


const STEPS = [
  { Mark: MeraMark, by: 'Mera passkeys', title: 'One passkey, two keys', body: 'Your passkey makes a savings key and a play key. Nothing is stored. Sign in on any device and both come back.' },
  { Mark: AgoraMark, by: 'AUSD by Agora', title: 'A weekly cap the money itself enforces', body: 'Your savings key signs four weekly allowances. AUSD enforces each one, not our app. Never more, never early, never twice.' },
  { Mark: PerplMark, by: 'Perpl perps', title: 'Trade the slice on Perpl', body: 'Your play key trades BTC, ETH or MON perps without prompts. The most you can lose is your play money, never your savings. Bank winnings from Home.' },
];

export function Welcome() {
  const s = useApp();
  const [name, setName] = useState('');
  const figure = useRef<HTMLElement>(null);
  const busy = s.phase === 'signing-in' || !!s.busy;

  return (
    <div className="min-h-svh overflow-x-clip pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <header className="safe-top mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Wordmark />
        <NetworkMark />
      </header>

      <main>
      <section className="mx-auto grid max-w-5xl items-center gap-6 px-5 pb-10 pt-2 md:min-h-[calc(100svh-4rem)] md:grid-cols-[1.05fr_1fr] md:gap-12">
        <div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="isolate text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[3.5rem] md:text-[4.5rem]">
            Savings that stay put. <span className="relative inline-block"><span className="absolute inset-x-[-0.04em] bottom-[0.06em] -z-10 h-[0.32em] -rotate-1 bg-event" />A weekly slice</span> to trade.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-5 max-w-md text-[1.0625rem] leading-relaxed text-ink-2">
            Keep your dollars in AUSD. Each week, a capped slice unlocks for trading on Perpl. Savings always ask for biometrics. Play money never does.
          </motion.p>

          <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-7 grid max-w-md gap-3" onSubmit={e => { e.preventDefault(); void app.create(name.trim()); }}>
            {!s.hasPasskey && (
              <label className="grid grid-cols-1 gap-1.5 text-sm">
                <span className="text-muted-foreground">Name for your passkey <span className="text-muted-foreground/70">(optional)</span></span>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ada’s Stipend" autoComplete="nickname" maxLength={40} className="h-12 text-base" />
              </label>
            )}
            {s.hasPasskey ? (
              <>
                <Button type="button" variant="event" size="lg" className="min-h-13 text-base" disabled={busy} onClick={() => void app.signIn()}><Icon name="key" size={18} />Sign in with your passkey</Button>
                <Button type="submit" variant="ghost" size="lg" disabled={busy}>Create a new one instead</Button>
              </>
            ) : (
              <>
                <Button type="submit" variant="event" size="lg" className="min-h-13 text-base" disabled={busy}><Icon name="key" size={18} />Create with passkey</Button>
                <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => void app.signIn()}>I already have one</Button>
              </>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">Uses your biometrics: Face ID or a fingerprint. On iPhone, use Safari with iCloud Keychain. On Android, use Chrome with Google Password Manager. No seed phrase. No extension.</p>
          </motion.form>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.92, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-[22rem] md:max-w-[30rem]">
          <RingPuzzle />
        </motion.div>
      </section>

      <section aria-labelledby="anatomy-title" className="mx-auto max-w-5xl px-5 pb-6">
        <motion.figure ref={figure} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl border border-border bg-card p-5 md:grid md:grid-cols-2 md:items-center md:gap-10 md:p-8">
          <div>
            <p className="label-mono text-xs text-muted-foreground">Fig. 1 · One week, start to finish</p>
            <h2 id="anatomy-title" className="mt-2 text-2xl font-semibold tracking-[-0.03em]">The weekly slice machine</h2>
            <AnatomyWeek />
          </div>
          <figcaption className="mt-4 md:mt-0">
            <MachineLegend figure={figure} />
          </figcaption>
        </motion.figure>
      </section>

      <section aria-label="How Stipend works" className="mx-auto max-w-5xl px-5 pb-16">
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.li key={step.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.55, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2.5">
                  <span className="grid size-11 place-items-center rounded-xl bg-muted"><step.Mark className="size-6" /></span>
                  <span className="text-xs font-medium text-muted-foreground">{step.by}</span>
                </span>
                <span className="label-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <h2 className="text-lg font-semibold tracking-[-0.02em]">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </motion.li>
          ))}
        </ol>
        <p className="label-mono mt-10 text-center text-[0.6875rem] text-muted-foreground">Built with</p>
        <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-ink-2">
          {PARTNERS.map(({ Mark, name }) => <li key={name} className="inline-flex items-center gap-2"><Mark className="size-5" />{name}</li>)}
        </ul>
      </section>
      </main>
    </div>
  );
}
