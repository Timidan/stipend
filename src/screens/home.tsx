import { motion } from 'motion/react';
import { cn } from 'cn';
import { app, type Snapshot, type Week } from '@/lib/app';
import { addressUrl, type Position } from '@/lib/stipend';
import { useApp, useNow } from '@/hooks';
import { ausd, price, short, until } from '@/format';
import { Screen } from '@/components/shell';
import { VaultArt } from '@/components/vault-art';
import { AgoraMark, PerplMark } from '@/components/brand';
import UnlockFaceId from '@/components/smoothui/unlock-face-id';
import BorderBeam from '@/components/smoothui/border-beam';
import { RollingNumber } from '@/components/rolling-number';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icons';
import { navigate } from '@/router';

const LOW_GAS = 10n ** 16n;

export function currentWeek(weeks: Week[], nowSec: bigint) {
  return weeks.find(w => w.start <= nowSec && nowSec < w.end);
}

function Card({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn('rounded-2xl border border-border bg-card p-5', className)}>
      {children}
    </motion.section>
  );
}

function SavingsCard({ s }: { s: Snapshot }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Savings</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[0.6875rem] font-medium text-ink-2"><Icon name="shield" size={12} />Biometrics to move</span>
      </div>
      <p className="mt-2 text-[2.75rem] font-semibold leading-none tracking-[-0.045em]">
        {s.savings == null ? <span className="text-muted-foreground">—</span> : <RollingNumber value={ausd(s.savings)} />}
        <span className="ml-2 inline-flex items-center gap-1 text-base font-medium tracking-normal text-muted-foreground"><AgoraMark className="size-4" />AUSD</span>
      </p>
      {s.vault && <a href={addressUrl(s.vault)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Savings key <span className="font-mono">{short(s.vault)}</span><Icon name="arrow-up-right" size={11} /></a>}
    </Card>
  );
}

function WeekCard({ s }: { s: Snapshot }) {
  const now = useNow();
  const nowSec = BigInt(Math.floor(now / 1000));
  const week = currentWeek(s.weeks, nowSec);
  const next = s.weeks.find(w => w.start > nowSec && w.state === 'upcoming');
  const play = (s.wallet ?? 0n) + (s.perpl?.free ?? 0n);
  const collected = week?.state === 'collected';

  let action: React.ReactNode;
  if (!s.weeks.length) action = <Button variant="event" size="lg" className="w-full" onClick={() => navigate('/weeks')}>Set your weekly allowance<Icon name="arrow-right" size={16} className="trail" /></Button>;
  else if (week?.state === 'open') action = s.phase === 'locked'
    ? <Button variant="event" size="lg" className="w-full" onClick={() => void app.signIn()}><Icon name="key" size={16} />Unlock to collect</Button>
    : s.savings != null && s.savings < week.value
      ? <p className="text-center text-sm text-muted-foreground">Savings hold {ausd(s.savings)} AUSD. This week needs {ausd(week.value)}.</p>
      : <Button variant="event" size="lg" className="w-full" onClick={() => void app.collect()}><Icon name="arrow-down" size={16} />Collect this week&rsquo;s {ausd(week.value)} AUSD</Button>;
  else if (play > 0n) action = <Button size="lg" className="w-full" onClick={() => navigate('/trade')}>Trade your slice<Icon name="arrow-right" size={16} className="trail" /></Button>;
  else if (next) action = <p className="text-center text-sm text-muted-foreground">Next slice opens in <span className="tnum font-medium text-foreground">{until(Number(next.start) * 1000 - now)}</span></p>;
  else action = <Button variant="outline" size="lg" className="w-full" onClick={() => navigate('/weeks')}>Sign more weeks</Button>;

  return (
    <BorderBeam active={week?.state === 'open'} radius={16} colorFrom="var(--event)" colorTo="var(--bull)">
    <Card delay={0.06}>
      <div className="grid grid-cols-[1fr_auto] items-center gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">This week&rsquo;s play money</p>
          <p className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.04em]"><RollingNumber value={ausd(play)} /><span className="ml-1.5 inline-flex items-center gap-1 text-sm font-medium tracking-normal text-muted-foreground"><AgoraMark className="size-3.5" />AUSD</span></p>
          <p className="mt-2 text-xs text-muted-foreground">
            {week ? (collected ? <>Collected · week closes in <span className="tnum">{until(Number(week.end) * 1000 - now)}</span></> : week.state === 'open' ? <>Ready · closes in <span className="tnum">{until(Number(week.end) * 1000 - now)}</span></> : 'This week was cancelled')
              : s.weeks.length ? 'No allowance this week' : 'No allowance yet'}
          </p>
        </div>
        <VaultArt out={collected ? 1 : 0} weeks={s.weeks.map(w => w.state)} className="size-24" label="This week's slice" />
      </div>
      <div className="mt-4">{action}</div>
    </Card>
    </BorderBeam>
  );
}

function PositionCard({ p, s }: { p: Position; s: Snapshot }) {
  const mark = s.marks[p.market.symbol as 'BTC' | 'ETH' | 'MON']?.price ?? Number(p.markPNS) / 10 ** p.priceDecimals;
  const entry = Number(p.entryPNS) / 10 ** p.priceDecimals, liq = Number(p.liqPNS) / 10 ** p.priceDecimals;
  const size = Number(p.lots) / 10 ** p.lotDecimals;
  const pnl = Number(p.pnlCNS) / 1e6;
  const away = mark > 0 ? Math.abs(mark - liq) / mark : 0;
  const up = p.side === 'long';
  return (
    <Card delay={0.12}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">{p.market.symbol}</span>
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', up ? 'bg-bull-soft text-bull' : 'bg-bear-soft text-bear')}>
            <Icon name={up ? 'arrow-up' : 'arrow-down'} size={12} />{up ? 'Up' : 'Down'}
          </span>
        </div>
        <span className={cn('tnum text-lg font-semibold', pnl >= 0 ? 'text-bull' : 'text-bear')}>{pnl >= 0 ? '+' : '−'}{Math.abs(pnl).toFixed(2)} <span className="text-xs font-medium">AUSD</span></span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">Size</dt><dd className="tnum font-medium">{size.toLocaleString('en-US', { maximumFractionDigits: p.lotDecimals })}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Entry</dt><dd className="tnum font-medium">{price(entry)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Now</dt><dd className="tnum font-medium"><RollingNumber value={price(mark)} /></dd></div>
      </dl>
      <div className="mt-4">
        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Liquidates at <span className="tnum text-foreground">{price(liq)}</span></span><span className="tnum text-muted-foreground">{(away * 100).toFixed(1)}% away</span></div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', away > 0.2 ? 'bg-bull' : away > 0.08 ? 'bg-wait' : 'bg-bear')} style={{ width: `${Math.min(100, away * 200)}%` }} /></div>
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><PerplMark className="size-3" />Perpl&rsquo;s liquidation formula, with funding paid.</p>
      </div>
      <Button variant="outline" size="lg" className="mt-4 w-full" onClick={() => void app.close(p.market.symbol as 'BTC' | 'ETH' | 'MON')}>Close {p.market.symbol}</Button>
    </Card>
  );
}

export function Home() {
  const s = useApp();
  const idle = (s.wallet ?? 0n) + (s.perpl?.free ?? 0n);
  const needsFunds = s.savings === 0n || (s.gas != null && s.gas < LOW_GAS);
  return (
    <Screen title="Your money" focusKey={s.phase} eyebrow={s.phase === 'locked' ? 'Locked · balances still visible' : new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}>
      <div className="grid grid-cols-1 gap-3">
        {(s.phase === 'locked' || s.phase === 'signing-in') && (
          <Card className="py-6" >
            <div style={{ '--color-brand': 'var(--event)', '--color-green': 'var(--bull)', '--color-destructive': 'var(--bear)' } as React.CSSProperties}>
              <UnlockFaceId size={88} label="Unlock with biometrics" status={s.phase === 'signing-in' ? 'scanning' : 'idle'} onScan={() => void app.signIn()} />
            </div>
          </Card>
        )}
        <SavingsCard s={s} />
        <WeekCard s={s} />
        {s.positions.map(p => <PositionCard key={p.market.symbol} p={p} s={s} />)}
        {!s.positions.length && idle > 0n && s.weeks.some(w => w.state === 'collected') && (
          <Button variant="ghost" size="lg" onClick={() => void app.bank()}><Icon name="bank" size={16} />Move {ausd(idle)} AUSD back to savings</Button>
        )}
        {needsFunds && (
          <Card delay={0.18} className="border-dashed">
            <p className="font-medium">Testnet money for the demo</p>
            <p className="mt-1 text-sm text-muted-foreground">Get 1,000 test AUSD for savings, plus test MON for gas. No real money.</p>
            <Button variant="outline" size="lg" className="mt-3 w-full" onClick={() => void app.requestTestFunds()}><Icon name="faucet" size={16} />Get test AUSD</Button>
          </Card>
        )}
      </div>
    </Screen>
  );
}
