import { isAddress, parseUnits, type Address } from 'viem';
import { revertReason, type Allowance, type Step } from './stipend';

export function amount(text: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(text)) throw new Error('Enter an AUSD amount with up to six decimal places.');
  const value = parseUnits(text, 6);
  if (value <= 0n) throw new Error('Enter an amount above zero.');
  return value;
}

export function readAllowances(owner: Address, play: Address = owner): Allowance[] {
  const data: unknown = JSON.parse(localStorage.getItem(`stipend:allowances:${owner.toLowerCase()}`) ?? '[]');
  if (!Array.isArray(data) || data.length > 52) throw new Error('Saved allowances could not be read. Sign four weeks again.');
  return data.map(a => {
    if (!a || (owner !== play && a.from?.toLowerCase() !== owner.toLowerCase()) || !isAddress(a.from) || !isAddress(a.to) || a.to.toLowerCase() !== play.toLowerCase()
      || !/^0x[\da-f]{64}$/i.test(a.nonce) || !/^0x[\da-f]{130}$/i.test(a.signature)
      || ![a.value, a.validAfter, a.validBefore].every(v => typeof v === 'string' && /^\d+$/.test(v))) {
      throw new Error('Saved allowances could not be read. Sign four weeks again.');
    }
    const row = { ...a, value: BigInt(a.value), validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore) } as Allowance;
    if (row.value <= 0n || row.validBefore <= row.validAfter) throw new Error('Saved allowance has an invalid amount or window.');
    return row;
  });
}
export function saveAllowances(owner: Address, rows: Allowance[]) {
  localStorage.setItem(`stipend:allowances:${owner.toLowerCase()}`, JSON.stringify(rows, (_, v) => typeof v === 'bigint' ? v.toString() : v));
}

export type Activity = Step & { at: number; owner: Address };
export async function history(owner: Address, add: Activity[] = []): Promise<Activity[]> {
  const key = `stipend:activity:${owner.toLowerCase()}`;
  const stored = JSON.parse(localStorage.getItem(key) ?? '[]') as Activity[];
  const rows = [...add, ...stored].filter((row, i, all) => all.findIndex(x => x.hash === row.hash) === i).sort((a, b) => b.at - a.at).slice(0, 50);
  if (add.length) localStorage.setItem(key, JSON.stringify(rows));
  return rows;
}

export function plainError(error: unknown): { message: string; detail?: string } {
  const raw = revertReason(error);
  const detail = `${(error as { code?: string })?.code ?? ''} ${raw}`.trim();
  const code = (error as { code?: string })?.code;
  if (code === 'PRF_UNAVAILABLE' || /PRF/i.test(raw)) return { message: "This passkey can’t make Stipend keys here. On iPhone, use Safari with iCloud Keychain. On Android, use Chrome with Google Password Manager.", detail };
  if (code === 'PASSKEY_OPERATION_FAILED' || /NotAllowedError/.test(raw)) return { message: 'The passkey prompt was cancelled or unavailable. Try again on HTTPS with your saved passkey.', detail };
  if (code === 'SESSION_ENDED') return { message: 'Your play key is locked. Unlock to continue.' };
  const messages: Record<string, string> = {
    MarkPriceAgeExceedsMax: "Perpl’s price feed is a few seconds behind. Try again.",
    InvalidAuthorization: "This week’s allowance isn’t open yet.",
    UsedOrCanceledAuthorization: 'That week was already collected or cancelled.',
    ERC20InsufficientBalance: 'Savings don’t cover this week’s allowance. Add AUSD to savings, then collect.',
    ExpiredAuthorization: "That week’s allowance has expired. Sign a new week.",
  };
  for (const [name, message] of Object.entries(messages)) if (raw.includes(name)) return { message, detail };
  if (error instanceof Error && !(error as { shortMessage?: string }).shortMessage) return { message: error.message };
  return { message: 'That didn’t go through. Try again in a moment.', detail };
}
