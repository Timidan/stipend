import { type Address, type Hex } from 'viem';
import * as s from './stipend';
import type { Market, Position } from './stipend';
import { IDLE_MS, signIn, withVault, type PlaySession } from './session';
import { plainError, readAllowances, saveAllowances } from './app-data';

export type Symbol = 'BTC' | 'ETH' | 'MON';
export type WeekState = 'open' | 'upcoming' | 'collected' | 'cancelled' | 'expired';
export type Week = { start: bigint; end: bigint; value: bigint; state: WeekState; nonce: Hex };
export type MarkRow = { market: Market; pns: bigint; price: number; priceDecimals: number; lotDecimals: number; at: number; history: { t: number; price: number }[] };
export type ActivityKind = 'passkey' | 'drip' | 'allowance' | 'collect' | 'fee' | 'perpl' | 'trade' | 'close' | 'bank' | 'cancel';
export type ActivityItem = { id: string; kind: ActivityKind; label: string; hash?: Hex; at: number };
export type Estimate = { lots: bigint; notional: number; liquidation: number | null; maxLoss: bigint; tooSmall: boolean };
export type Snapshot = {
  phase: 'signed-out' | 'signing-in' | 'ready' | 'locked';
  hasPasskey: boolean;
  vault?: Address; play?: Address; lockAt?: number;
  savings: bigint | null; wallet: bigint | null;
  perpl: { id: bigint; free: bigint; locked: bigint } | null;
  gas: bigint | null; weeks: Week[]; positions: Position[];
  marks: Partial<Record<Symbol, MarkRow>>; activity: ActivityItem[];
  busy: null | { action: string; step?: string };
  error: null | { message: string; detail?: string };
  updatedAt: number;
};

function hint() { try { return localStorage.getItem('stipend:hint') === 'yes'; } catch { return false; } }
let snapshot: Snapshot = { phase: 'signed-out', hasPasskey: hint(), savings: null, wallet: null, perpl: null, gas: null, weeks: [], positions: [], marks: {}, activity: [], busy: null, error: null, updatedAt: 0 };
let key: PlaySession | undefined;
let allowances: s.Allowance[] = [];
let generation = 0;
let hiddenAt: number | undefined;
let lockTimer: ReturnType<typeof setTimeout> | undefined;
let balanceTimer: ReturnType<typeof setInterval> | undefined;
let markTimer: ReturnType<typeof setInterval> | undefined;
let balanceRead: Promise<void> | undefined;
let markRead: Promise<void> | undefined;
const maintenance = new Map<Symbol, bigint>();
const listeners = new Set<() => void>();
const visible = () => typeof document === 'undefined' || !document.hidden;
const update = (patch: Partial<Snapshot>) => { snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()); };
const step = (label: string) => { if (snapshot.busy) update({ busy: { ...snapshot.busy, step: label } }); };
function storageError(error: unknown) { update({ error: { message: 'Local storage is unavailable. Signed weeks won’t be saved on this device. Sign them again next visit.', detail: String(error) } }); }
function activity(kind: ActivityKind, label: string, hash?: Hex, id: string = hash ?? crypto.randomUUID()) {
  const rows = [{ id, kind, label, hash, at: Date.now() }, ...snapshot.activity.filter(row => row.id !== id)].slice(0, 50);
  update({ activity: rows });
  try { localStorage.setItem(`stipend:activity:${snapshot.play!.toLowerCase()}`, JSON.stringify(rows)); } catch (error) { storageError(error); }
}
function readActivity(play: Address): ActivityItem[] {
  const rows: unknown = JSON.parse(localStorage.getItem(`stipend:activity:${play.toLowerCase()}`) ?? '[]');
  const kinds = ['passkey', 'drip', 'allowance', 'collect', 'fee', 'perpl', 'trade', 'close', 'bank', 'cancel'];
  if (!Array.isArray(rows)) throw new Error('Saved activity could not be read.');
  return rows.filter(row => row && typeof row.id === 'string' && kinds.includes(row.kind) && typeof row.label === 'string' && Number.isFinite(row.at) && (!row.hash || /^0x[\da-f]{64}$/i.test(row.hash))).sort((a, b) => b.at - a.at).slice(0, 50);
}
function receipt(kind: ActivityKind, row: s.Step, id?: string) { activity(kind, row.label, row.hash, id); step(row.label); }
function stopPolling() { clearInterval(balanceTimer); clearInterval(markTimer); balanceTimer = markTimer = undefined; }
function lock() {
  generation++;
  key?.end(); key = undefined;
  clearTimeout(lockTimer); stopPolling();
  update({ phase: snapshot.play ? 'locked' : 'signed-out', lockAt: undefined });
}
function expired() { return (snapshot.lockAt !== undefined && Date.now() >= snapshot.lockAt) || (hiddenAt !== undefined && Date.now() - hiddenAt >= 120_000); }
function armLock() {
  clearTimeout(lockTimer);
  if (!key || snapshot.lockAt === undefined) return;
  const due = Math.min(snapshot.lockAt, hiddenAt === undefined ? Infinity : hiddenAt + 120_000);
  lockTimer = setTimeout(lock, Math.max(0, due - Date.now()));
}
function touch() {
  if (!key || !visible()) return;
  if (expired()) { lock(); return; }
  if (snapshot.lockAt && snapshot.lockAt - Date.now() > IDLE_MS - 1000) return;
  update({ lockAt: Date.now() + IDLE_MS }); armLock();
}
function requireKey() {
  if (expired()) lock();
  if (!key || snapshot.phase !== 'ready' || !visible()) throw new Error('Your play key is locked. Unlock to continue.');
  return key;
}
function checkSession(active: PlaySession) { if (requireKey() !== active) throw new Error('Your play key locked mid-step. Unlock and try again.'); }
function poll(task: () => Promise<void>) { void task().catch(error => { if (key && visible()) update({ error: plainError(error) }); }); }
function startPolling() {
  stopPolling();
  if (!key || !visible()) return;
  balanceTimer = setInterval(() => { if (!balanceRead && !snapshot.busy) poll(refreshBalances); }, 5000);
  markTimer = setInterval(() => { if (!markRead && !snapshot.busy) poll(refreshMarks); }, 3000);
}
async function refreshBalances() {
  if (balanceRead) await balanceRead;
  if (!key || !visible()) return;
  const epoch = generation, vault = snapshot.vault!, play = snapshot.play!;
  const saved = allowances;
  const task = (async () => {
    const [savings, wallet, gas, account, used] = await Promise.all([s.ausdBalance(vault), s.ausdBalance(play), s.monBalance(play), s.perplAccount(play), Promise.all(saved.map(a => s.isUsed(vault, a.nonce)))]);
    const positions = account ? await s.positions(account.id) : [];
    const now = s.now();
    const weeks = saved.map((a, i): Week => ({ start: a.validAfter, end: a.validBefore, value: a.value, nonce: a.nonce,
      state: used[i] ? (snapshot.activity.some(row => row.kind === 'cancel' && row.id === `cancel:${a.nonce}`) ? 'cancelled' : 'collected') : now <= a.validAfter ? 'upcoming' : now >= a.validBefore ? 'expired' : 'open' }));
    if (epoch === generation && visible()) update({ savings, wallet, gas, perpl: account ? { id: account.id, free: account.balance - account.locked, locked: account.locked } : null, positions, weeks, updatedAt: Date.now() });
  })();
  balanceRead = task;
  try { await task; } finally { if (balanceRead === task) balanceRead = undefined; }
}
async function refreshMarks() {
  if (markRead) return markRead;
  if (!key || !visible()) return;
  const epoch = generation;
  const task = (async () => {
    const rows = await Promise.all(s.MARKETS.map(async market => {
      const info = await s.marketInfo(market.id);
      if (!maintenance.has(market.symbol)) {
        const [, maint] = await s.client.readContract({ address: s.PERPL, abi: s.abi, functionName: 'getMarginFractions', args: [market.id, 1n] });
        maintenance.set(market.symbol, maint);
      }
      const price = Number(info.markPNS) / 10 ** info.priceDecimals, at = Number(info.markTimestamp) * 1000;
      const previous = snapshot.marks[market.symbol]?.history ?? [];
      const history = previous.at(-1)?.t === at ? previous : [...previous, { t: at, price }].slice(-120);
      return { market, pns: info.markPNS, price, priceDecimals: info.priceDecimals, lotDecimals: info.lotDecimals, at, history };
    }));
    if (epoch === generation && visible()) update({ marks: Object.fromEntries(rows.map(row => [row.market.symbol, row])) });
  })();
  markRead = task;
  try { await task; } finally { if (markRead === task) markRead = undefined; }
}
async function refreshAll() { await Promise.all([refreshBalances(), refreshMarks()]); }
async function run<T>(action: string, work: () => Promise<T>): Promise<T> {
  if (snapshot.busy) throw new Error('Wait for the current action to finish.');
  touch(); update({ busy: { action, step: action }, error: null });
  try { return await work(); }
  catch (error) { update({ error: plainError(error) }); throw error; }
  finally {
    try { await refreshAll(); } catch (error) { if (!snapshot.error) update({ error: plainError(error) }); }
    update({ busy: null });
  }
}
async function enter(create: boolean, displayName?: string) {
  return run('Opening passkey', async () => {
    key?.end(); key = undefined; stopPolling(); clearTimeout(lockTimer);
    const epoch = ++generation;
    update({ phase: 'signing-in', lockAt: undefined });
    try {
      const opened = await signIn(create, displayName);
      if (epoch !== generation || !visible()) { opened.end(); throw new Error('Return to Stipend and sign in again.'); }
      key = opened; allowances = [];
      update({ phase: 'ready', vault: opened.vault, play: opened.account.address, hasPasskey: true, lockAt: Date.now() + IDLE_MS, savings: null, wallet: null, gas: null, perpl: null, positions: [], weeks: [], activity: [], updatedAt: 0 });
      try { localStorage.setItem('stipend:hint', 'yes'); } catch (error) { storageError(error); }
      try { allowances = readAllowances(opened.vault, opened.account.address); } catch (error) { update({ error: plainError(error) }); }
      try { update({ activity: readActivity(opened.account.address) }); } catch (error) { update({ error: plainError(error) }); }
      activity('passkey', create ? 'Created Stipend passkey' : 'Signed in with passkey');
      hiddenAt = undefined; armLock(); startPolling();
    } catch (error) { if (!key) update({ phase: snapshot.play ? 'locked' : 'signed-out' }); throw error; }
  });
}
function marketFor(symbol: Symbol) {
  const market = s.MARKETS.find(row => row.symbol === symbol);
  if (!market) throw new Error('Choose BTC, ETH or MON.');
  return market;
}
function validateTrade(margin: bigint, leverage: number) {
  if (margin <= 0n) throw new Error('Enter an amount above zero.');
  if (!Number.isFinite(leverage) || leverage < 1 || leverage > s.MAX_LEVERAGE || !Number.isInteger(leverage * 100)) throw new Error('Choose leverage from 1x to 3x, with at most two decimal places.');
}
function estimate(symbol: Symbol, side: 'long' | 'short', margin: bigint, leverage: number): Estimate | null {
  const mark = snapshot.marks[symbol], maint = maintenance.get(symbol);
  if (!mark || mark.pns <= 0n || !maint || margin <= 0n || !Number.isFinite(leverage) || leverage < 1 || leverage > s.MAX_LEVERAGE || !Number.isInteger(leverage * 100)) return null;
  const lots = margin * BigInt(leverage * 100) * 10n ** BigInt(mark.lotDecimals + mark.priceDecimals) / (100_000_000n * mark.pns);
  return { lots, notional: Number(lots) / 10 ** mark.lotDecimals * mark.price, liquidation: lots === 0n ? null : Number(s.liquidationPrice(side, mark.pns, lots, margin, 0n, maint, mark)) / 10 ** mark.priceDecimals, maxLoss: margin, tooSmall: lots === 0n };
}

export const app = {
  subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot(): Snapshot { return snapshot; },
  create(displayName: string): Promise<void> { return enter(true, displayName); },
  signIn(): Promise<void> { return enter(false); },
  lock,
  refresh(): Promise<void> { return run('Refreshing', refreshAll); },
  requestTestFunds(): Promise<void> {
    return run('Requesting test funds', async () => {
      const active = requireKey();
      const response = await fetch(s.DRIP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vault: snapshot.vault, play: active.account.address }) });
      const body = await response.json();
      if (!Array.isArray(body.txs) || !body.txs.every((row: s.Step) => typeof row?.label === 'string' && /^0x[\da-f]{64}$/i.test(row.hash))) throw new Error(body.error ?? 'The drip returned an invalid response.');
      for (const row of body.txs) receipt('drip', row);
      if (!response.ok) throw new Error(body.error ?? 'Test funds are unavailable. Try again later.');
    });
  },
  setAllowance(weekly: bigint, weeks: number): Promise<void> {
    return run('Signing allowance', async () => {
      const active = requireKey(), vault = snapshot.vault!;
      if (weekly <= s.FEE) throw new Error('The allowance must exceed the 0.25 AUSD collection fee.');
      if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) throw new Error('Choose between 1 and 52 weeks.');
      step('Confirm with your passkey');
      const signed = await withVault(active.account.address, account => { checkSession(active); return s.signAllowances(account, active.account.address, weekly, weeks); }, vault);
      checkSession(active);
      allowances = [...allowances.filter(a => !signed.some(row => row.nonce === a.nonce)), ...signed].sort((a, b) => a.validAfter < b.validAfter ? -1 : 1).slice(-52);
      try { saveAllowances(vault, allowances); } catch (error) { storageError(error); }
      activity('allowance', `Signed ${weeks} weekly allowance${weeks === 1 ? '' : 's'}`);
    });
  },
  cancelWeek(start: bigint): Promise<void> {
    return run('Cancelling week', async () => {
      const active = requireKey(), vault = snapshot.vault!;
      const allowance = allowances.find(a => a.validAfter === start);
      if (!allowance) throw new Error('No signed allowance was found for that week.');
      step('Confirm with your passkey');
      const signature = await withVault(active.account.address, account => { checkSession(active); return s.signCancel(account, allowance.nonce); }, vault);
      checkSession(active); step('Cancelling on chain');
      for (const row of await s.cancel(active.account, vault, allowance.nonce, signature)) receipt('cancel', row, `cancel:${allowance.nonce}`);
    });
  },
  collect(): Promise<void> {
    return run('Collecting allowance', async () => {
      const active = requireKey(), now = s.now();
      const allowance = allowances.find(a => a.validAfter < now && now < a.validBefore);
      if (!allowance) throw new Error("This week’s allowance isn’t open yet.");
      step('Collecting on chain');
      await s.collect(active.account, allowance, row => receipt(row.label.includes('fee') ? 'fee' : 'collect', row));
    });
  },
  trade(symbol: Symbol, side: 'long' | 'short', margin: bigint, leverage: number): Promise<{ filled: boolean; lots: bigint }> {
    return run('Placing order', async () => {
      const active = requireKey(), market = marketFor(symbol);
      validateTrade(margin, leverage);
      if (side !== 'long' && side !== 'short') throw new Error('Choose Up or Down.');
      const [wallet, existing] = await Promise.all([s.ausdBalance(active.account.address), s.perplAccount(active.account.address)]);
      if (!existing && wallet < s.MIN_ACCOUNT) throw new Error('Perpl needs 100 AUSD of play money to open your account.');
      checkSession(active);
      if (wallet > 0n) { step('Moving play money to Perpl'); await s.fundPerpl(active.account, wallet, row => receipt('perpl', row)); }
      const account = await s.perplAccount(active.account.address);
      if (!account || account.balance - account.locked < margin) throw new Error('Not enough play money on Perpl for that stake.');
      const before = (await s.positions(account.id)).find(p => p.market.symbol === symbol)?.lots ?? 0n;
      checkSession(active); step('Submitting order');
      const rows = await s.open(active.account, market, side, margin, leverage);
      for (const row of rows) receipt('trade', { ...row, label: `Submitted ${symbol} ${side === 'long' ? 'Up' : 'Down'} order` });
      const after = (await s.positions(account.id)).find(p => p.market.symbol === symbol)?.lots ?? 0n;
      const filled = after > before;
      if (!filled) activity('trade', "Order didn’t fill. Nothing was spent.");
      return { filled, lots: filled ? after - before : 0n };
    });
  },
  close(symbol: Symbol): Promise<void> {
    return run('Closing position', async () => {
      const active = requireKey(); marketFor(symbol);
      const account = await s.perplAccount(active.account.address);
      const position = account && (await s.positions(account.id)).find(p => p.market.symbol === symbol);
      if (!position) throw new Error('There is no open position in that market.');
      checkSession(active); step('Submitting close order');
      const rows = await s.close(active.account, position);
      for (const row of rows) receipt('close', { ...row, label: `Submitted ${symbol} close order` });
      if ((await s.positions(account!.id)).some(p => p.market.symbol === symbol)) throw new Error('The close order did not fully fill. Try closing the remaining position again.');
    });
  },
  bank(): Promise<void> {
    return run('Moving to savings', async () => {
      const active = requireKey(); step('Moving play money to savings');
      await s.bank(active.account, snapshot.vault!, row => receipt('bank', row));
    });
  },
  estimate,
  dismissError(): void { update({ error: null }); },
};

if (typeof document !== 'undefined') {
  for (const event of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll']) document.addEventListener(event, touch, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); stopPolling(); armLock(); }
    else {
      if (expired()) lock();
      hiddenAt = undefined; armLock(); startPolling();
      if (key) poll(refreshAll);
    }
  });
  window.addEventListener('pagehide', lock);
}
