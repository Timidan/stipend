import { formatAusd } from '@/lib/stipend';

export const ausd = (v: bigint | null | undefined) => (v == null ? '—' : formatAusd(v));

export function until(ms: number) {
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export const day = (sec: bigint) => new Date(Number(sec) * 1000).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export const price = (v: number | null | undefined, digits = 2) =>
  v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: v < 1 ? 5 : digits, maximumFractionDigits: v < 1 ? 5 : digits });

export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

export function parseAusd(text: string): bigint | null {
  const t = text.trim();
  if (!/^\d+(\.\d{0,6})?$/.test(t)) return null;
  const [w, f = ''] = t.split('.');
  return BigInt(w) * 1_000_000n + BigInt((f + '000000').slice(0, 6));
}
