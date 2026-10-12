import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from 'cn';
import { app, type MarkRow, type Symbol } from '@/lib/app';
import { MAX_LEVERAGE, MIN_ACCOUNT } from '@/lib/stipend';
import { useApp } from '@/hooks';
import { ausd, parseAusd, price } from '@/format';
import { Screen } from '@/components/shell';
import { RollingNumber } from '@/components/rolling-number';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/icons';
import { PerplMark } from '@/components/brand';
import { currentWeek } from '@/screens/home';
import { until } from '@/format';
import { navigate } from '@/router';

const SYMBOLS: Symbol[] = ['BTC', 'ETH', 'MON'];
const NAMES: Record<Symbol, string> = { BTC: 'Bitcoin', ETH: 'Ether', MON: 'Monad' };

const distinct = (row?: MarkRow) => (row?.history ?? []).filter((p, i, all) => i === 0 || p.t !== all[i - 1].t);

function Sparkline({ row, up }: { row?: MarkRow; up: boolean }) {
  const pts = distinct(row);
  if (pts.length < 2) return null;
  const xs = pts.map(p => p.t), ys = pts.map(p => p.price);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(((p.t - x0) / Math.max(1, x1 - x0)) * 300).toFixed(1)},${(52 - ((p.price - y0) / Math.max(1e-9, y1 - y0)) * 48).toFixed(1)}`).join('');
  return (
    <svg viewBox="0 0 300 56" preserveAspectRatio="none" className="h-14 w-full" aria-hidden="true">
      <path d={d} fill="none" stroke={up ? 'var(--bull)' : 'var(--bear)'} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Trade() {
  const s = useApp();
  const [symbol, setSymbol] = useState<Symbol>('BTC');
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [text, setText] = useState('');
  const [leverage, setLeverage] = useState(2);
  const [result, setResult] = useState<null | { filled: boolean; symbol: Symbol }>(null);

  const row = s.marks[symbol];
  const first = row?.history[0]?.price, last = row?.price;
  const trendUp = first == null || last == null ? true : last >= first;
  const available = (s.wallet ?? 0n) + (s.perpl?.free ?? 0n);
  const margin = parseAusd(text);
  const est = useMemo(() => (margin && margin > 0n ? app.estimate(symbol, side, margin, leverage) : null), [margin, symbol, side, leverage, s.marks]);
  const open = s.positions.find(p => p.market.symbol === symbol);
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const week = currentWeek(s.weeks, nowSec), next = s.weeks.find(w => w.start > nowSec && w.state === 'upcoming');
  const needsAccount = !s.perpl && available < MIN_ACCOUNT;
  const tooMuch = margin != null && margin > available;
  const stakeError = est?.tooSmall ? `That stake is too small for one ${symbol} lot. Add a little more.` : tooMuch ? 'That’s more than this week’s play money.' : null;
  const stakeRef = useRef<HTMLInputElement>(null);
  const liqAway = est?.liquidation && last ? Math.abs(last - est.liquidation) / last : null;

  const place = async () => {
    if (!margin) return;
    setResult(null);
    try { const r = await app.trade(symbol, side, margin, leverage); setResult({ filled: r.filled, symbol }); if (r.filled) setText(''); } catch { /* shown in the error sheet */ }
  };

  return (
    <Screen title="Trade your slice" focusKey={s.phase} eyebrow={`Play money ${ausd(available)} AUSD`}>
      <div role="group" aria-label="Market" className="grid grid-cols-3 gap-2">
        {SYMBOLS.map(m => (
          <button key={m} type="button" aria-pressed={m === symbol} onClick={() => setSymbol(m)}
            className={cn('tap rounded-xl border px-3 py-2.5 text-left transition-colors', m === symbol ? 'border-foreground bg-card' : 'border-border bg-card/60 text-muted-foreground')}>
            <span className="block text-sm font-semibold text-foreground">{m}</span>
            <span className="tnum block text-xs">{price(s.marks[m]?.price)}</span>
          </button>
        ))}
      </div>

      <section className="mt-3 rounded-2xl border border-border bg-card p-5">
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">{NAMES[symbol]} · <PerplMark className="size-3.5" />Perpl perp</p>
        <p className="mt-1 text-[2.25rem] font-semibold leading-none tracking-[-0.04em]">{last ? <RollingNumber value={price(last)} /> : '—'}</p>
        {distinct(row).length > 1 ? <div className="mt-3"><Sparkline row={row} up={trendUp} /><p className="mt-1 text-xs text-muted-foreground">Since you opened Stipend</p></div> : <p className="mt-2 text-xs text-muted-foreground">The chart fills in as Perpl&rsquo;s price updates.</p>}
      </section>

      {open && (
        <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-sm">You already hold {symbol} {open.side === 'long' ? 'Up' : 'Down'}. A new order adds to it. <button className="font-medium underline underline-offset-2" onClick={() => navigate('/')}>See it on Home</button></p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {(['long', 'short'] as const).map(d => (
          <button key={d} type="button" onClick={() => setSide(d)} aria-pressed={side === d}
            className={cn('tap flex h-16 items-center justify-center gap-2 rounded-2xl border text-lg font-semibold transition-colors',
              side === d ? (d === 'long' ? 'border-bull bg-bull text-background' : 'border-bear bg-bear text-background') : 'border-border bg-card text-ink-2')}>
            <Icon name={d === 'long' ? 'arrow-up' : 'arrow-down'} size={18} />{d === 'long' ? 'Up' : 'Down'}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="text-sm text-muted-foreground">Stake from this week&rsquo;s play money</span>
        <div className="relative mt-1.5">
          <Input ref={stakeRef} inputMode="decimal" value={text} onChange={e => setText(e.target.value.replace(',', '.'))} placeholder="0.00" aria-invalid={!!stakeError || undefined} aria-describedby={stakeError ? 'stake-error' : undefined}
            className="h-14 pr-16 text-2xl font-semibold tnum" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">AUSD</span>
        </div>
      </label>
      {stakeError && <p id="stake-error" className="mt-2 text-sm text-bear">{stakeError}</p>}
      <div className="mt-2 flex gap-2">
        {[25, 50, 100].map(pct => (
          <button key={pct} type="button" className="tap h-9 flex-1 rounded-lg border border-border bg-card text-sm font-medium"
            onClick={() => setText((Number(available * BigInt(pct) / 100n) / 1e6).toFixed(2))}>{pct === 100 ? 'All' : `${pct}%`}</button>
        ))}
      </div>

      <div className="mt-4">
        <span id="leverage-label" className="text-sm text-muted-foreground">Leverage</span>
        <div role="group" aria-labelledby="leverage-label" className="mt-1.5 grid grid-cols-3 gap-2">
          {Array.from({ length: MAX_LEVERAGE }, (_, i) => i + 1).map(l => (
            <button key={l} type="button" aria-pressed={leverage === l} onClick={() => setLeverage(l)}
              className={cn('tap h-11 rounded-lg border text-sm font-semibold', leverage === l ? 'border-foreground bg-foreground text-background' : 'border-border bg-card')}>{l}x</button>
          ))}
        </div>
      </div>

      <section aria-label="Before you confirm" className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm">
        <div className="flex items-center justify-between"><span className="text-muted-foreground">Most you can lose</span><span className="tnum font-semibold">{est ? ausd(est.maxLoss) : '—'} AUSD</span></div>
        <div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Savings</span><span className="inline-flex items-center gap-1 font-medium"><Icon name="shield" size={13} />Untouched</span></div>
        <div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Liquidates near</span><span className="tnum font-medium">{est?.liquidation ? `${price(est.liquidation)}${liqAway != null ? ` · ${(liqAway * 100).toFixed(0)}% away` : ''}` : '—'}</span></div>
        <div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Order</span><span className="font-medium">Fills now or cancels</span></div>
        {needsAccount && <p className="mt-3 text-wait">Perpl needs 100 AUSD of play money to open your account.</p>}
        {!s.perpl && !needsAccount && <p className="mt-3 text-muted-foreground">Your first trade opens a Perpl account. This week&rsquo;s play money moves into it.</p>}
      </section>

      {s.phase === 'locked' ? (
        <Button variant="event" size="lg" className="mt-4 min-h-14 w-full text-base" onClick={() => void app.signIn()}><Icon name="key" size={18} />Unlock to trade</Button>
      ) : available === 0n ? (
        !s.weeks.length ? <Button size="lg" className="mt-4 min-h-14 w-full text-base" onClick={() => navigate('/weeks')}>Set your weekly allowance</Button>
          : week?.state === 'open' ? <Button variant="event" size="lg" className="mt-4 min-h-14 w-full text-base" onClick={() => void app.collect()}>Collect this week&rsquo;s {ausd(week.value)} AUSD</Button>
          : <p className="mt-4 text-center text-sm text-muted-foreground">{next ? <>Next slice opens in <span className="tnum font-medium text-foreground">{until(Number(next.start) * 1000 - Date.now())}</span></> : 'No slice left this week. Sign more weeks.'}</p>
      ) : (
        <Button variant="event" size="lg" className="mt-4 min-h-14 w-full text-base" disabled={!!s.busy || s.phase !== 'ready' || needsAccount || !margin}
          onClick={() => { if (stakeError) { stakeRef.current?.focus(); return; } void place(); }}>
          Place {side === 'long' ? 'Up' : 'Down'} on {symbol}{margin ? ` · ${ausd(margin)} at ${leverage}x` : ''}
        </Button>
      )}
      <p className="mt-2 text-center text-xs text-muted-foreground">Signed by your play key. No biometrics needed.</p>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status"
            ref={el => el?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
            className={cn('mt-4 rounded-2xl border p-4 text-sm', result.filled ? 'border-bull/30 bg-bull-soft text-bull' : 'border-wait/30 bg-wait-soft text-wait')}>
            {result.filled ? <>Filled on Perpl. <button className="font-medium underline underline-offset-2" onClick={() => navigate('/')}>See your {result.symbol} position</button></> : 'The order didn’t fill at this price. Nothing was spent. Try again.'}
          </motion.div>
        )}
      </AnimatePresence>
    </Screen>
  );
}
