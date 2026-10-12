import { motion } from 'motion/react';
import type { ActivityKind } from '@/lib/app';
import { addressUrl, txUrl } from '@/lib/stipend';
import { useApp } from '@/hooks';
import { short } from '@/format';
import { Screen } from '@/components/shell';
import { TimeAgo } from '@/components/time-ago';
import { Icon, type IconName } from '@/components/icons';
import { AgoraMark, MeraMark, PerplMark } from '@/components/brand';
import ButtonCopy from '@/components/smoothui/button-copy';

const KIND: Record<ActivityKind, IconName> = {
  passkey: 'key', drip: 'faucet', allowance: 'shield', collect: 'arrow-down', fee: 'gauge',
  perpl: 'bank', trade: 'order', close: 'check', bank: 'bank', cancel: 'close',
};
const MARK: Partial<Record<ActivityKind, typeof AgoraMark>> = {
  passkey: MeraMark, allowance: AgoraMark, collect: AgoraMark, fee: AgoraMark, perpl: PerplMark, trade: PerplMark, close: PerplMark,
};

function KeyRow({ label, note, address }: { label: string; note: string; address?: string }) {
  if (!address) return null;
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <span className="font-mono text-xs">{short(address)}</span>
      <ButtonCopy label={`${label} address`} loadingDuration={150} duration={1400} onCopy={() => navigator.clipboard.writeText(address)} />
      <a href={addressUrl(address as `0x${string}`)} target="_blank" rel="noreferrer" className="tap grid size-9 place-items-center rounded-md hover:bg-muted" aria-label={`${label} on the explorer`}><Icon name="arrow-up-right" size={14} /></a>
    </div>
  );
}

export function Activity() {
  const s = useApp();
  return (
    <Screen title="Activity" eyebrow="Every step, on-chain">
      <section className="rounded-2xl border border-border bg-card px-4 divide-y divide-border">
        <KeyRow label="Savings key" note="Asks for biometrics every time" address={s.vault} />
        <KeyRow label="Play key" note="Signs trades without prompts, capped weekly" address={s.play} />
      </section>
      {s.activity.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nothing yet. Your first collect, trade or bank shows up here with its transaction.</p>
      ) : (
        <ol className="mt-4 grid grid-cols-1 gap-2">
          {s.activity.map((a, i) => { const Mark = MARK[a.kind]; return (
            <motion.li key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.3 }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">{Mark ? <Mark className="size-4" /> : <Icon name={KIND[a.kind]} size={16} />}</span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium">{a.label}</p>
                <TimeAgo at={a.at} className="text-xs text-muted-foreground" />
              </div>
              {a.hash && <a href={txUrl(a.hash)} target="_blank" rel="noreferrer" className="tap inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[0.6875rem] text-muted-foreground hover:bg-muted hover:text-foreground">{a.hash.slice(0, 8)}<Icon name="arrow-up-right" size={11} /></a>}
            </motion.li>
          ); })}
        </ol>
      )}
    </Screen>
  );
}
