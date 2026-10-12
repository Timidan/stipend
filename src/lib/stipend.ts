import { createSecp256k1SigningSession } from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import {
  BaseError, concat, createPublicClient, createWalletClient, decodeErrorResult, encodePacked, hexToBytes, http, keccak256, parseAbi, sha256, toBytes,
  type Abi,
  type Address, type Hex, type LocalAccount,
} from 'viem';
import { monadTestnet } from 'viem/chains';
import perplErrors from './perpl-errors.json' with { type: 'json' };

const env: Record<string, string | undefined> = (import.meta as { env?: Record<string, string | undefined> }).env ?? (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
export const RPC = env.VITE_RPC_URL ?? 'https://testnet-rpc.monad.xyz';
export const DRIP_URL = env.VITE_DRIP_URL ?? '/drip';
export const TREASURY = (env.VITE_TREASURY ?? '0x000000000000000000000000000000000000bEEF') as Address;
export const EXPLORER = 'https://testnet.monadvision.com';

export const AUSD: Address = '0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC';
export const FAUCET: Address = '0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C';
export const PERPL: Address = '0x1964C32f0bE608E7D29302AFF5E61268E72080cc';
export const MARKETS = [{ id: 16n, symbol: 'BTC' }, { id: 32n, symbol: 'ETH' }, { id: 64n, symbol: 'MON' }] as const;
export type Market = (typeof MARKETS)[number];

export const AUSD_DECIMALS = 6;
export const WEEK = 604_800n;
export const FEE = 250_000n; // 0.25 AUSD per weekly collection
export const MIN_ACCOUNT = 100_000_000n; // Perpl testnet minimum to open an account
export const MAX_LEVERAGE = 3;
const SLIPPAGE_BPS = 50n;

const chain = { ...monadTestnet, rpcUrls: { default: { http: [RPC] } } };
export const client = createPublicClient({ chain, transport: http(RPC, { batch: { wait: 16 }, retryCount: 5, retryDelay: 600 }), batch: { multicall: { wait: 16 } }, pollingInterval: 1000 });

export const abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
  'function receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)',
  'function cancelAuthorization(address,bytes32,bytes)',
  'function authorizationState(address,bytes32) view returns (bool)',
  'function requestFunds(address)',
  'function createAccount(uint256) returns (uint256)',
  'function depositCollateral(uint256)',
  'function withdrawCollateral(uint256)',
  'function execOrder((uint256,uint256,uint8,uint256,uint256,uint256,uint256,bool,bool,bool,uint256,uint256,uint256,uint256,uint256)) returns ((uint256,uint256))',
  'function getAccountByAddr(address) view returns ((uint256 accountId,uint256 balanceCNS,uint256 lockedBalanceCNS,uint8 frozen,address accountAddr,(uint256,uint256,uint256,uint256) positions))',
  'function getPositionV2(uint256,uint256) view returns ((uint256 accountId,uint256 nextNodeId,uint256 prevNodeId,uint8 positionType,uint256 depositCNS,uint256 pricePNS,uint256 lotLNS,uint256 entryBlock,int256 pnlCNS,int256 deltaPnlCNS,int256 premiumPnlCNS,uint256 priceResiduePNSQ16),uint256 markPricePNS,bool markPriceValid)',
  'function getPerpetualInfoV2(uint256) view returns ((string name,string symbol,uint256 priceDecimals,uint256 lotDecimals,bytes32 linkFeedId,uint256 priceTolPer100K,uint256 marginTol,uint256 marginTolDecimals,uint256 refPriceMaxAgeSec,uint256 positionBalanceCNS,uint256 insuranceBalanceCNS,uint256 markPNS,uint256 markTimestamp,uint256 lastPNS,uint256 lastTimestamp,uint256 oraclePNS,uint256 oracleTimestampSec,uint256 longOpenInterestLNS,uint256 shortOpenInterestLNS,uint256 fundingStartBlock,int16 fundingRatePct100k,uint256 absFundingClampPctPer100K,uint8 status,uint256 basePricePNS,uint256 maxBidPriceONS,uint256 minBidPriceONS,uint256 maxAskPriceONS,uint256 minAskPriceONS,uint256 numOrders,bool ignOracle,uint256 fundingSumScalingExp))',
  'function getMarginFractions(uint256,uint256) view returns (uint256,uint256,uint256)',
]);

// Keys: one passkey PRF output, two unrelated secp256k1 keys. A leaked play key reveals nothing about the vault key.
export type KeyRole = 'vault' | 'play';
export const deriveKey = (prf: Uint8Array, role: KeyRole) => hexToBytes(sha256(concat([prf, toBytes(`stipend/${role}/v1`)])));
export function openKey(prf: Uint8Array, role: KeyRole): { account: LocalAccount; end: () => void } {
  const privateKey = deriveKey(prf, role);
  try {
    const session = createSecp256k1SigningSession({ privateKey });
    return { account: toViemAccount(session) as LocalAccount, end: () => session.end() };
  } finally { privateKey.fill(0); }
}

// Weeks start Monday 00:00 UTC (the Unix epoch was a Thursday).
const MONDAY_OFFSET = 345_600n;
export const weekStart = (t: bigint) => ((t - MONDAY_OFFSET) / WEEK) * WEEK + MONDAY_OFFSET;
export const now = () => BigInt(Math.floor(Date.now() / 1000));

export type Allowance = { from: Address; to: Address; value: bigint; validAfter: bigint; validBefore: bigint; nonce: Hex; signature: Hex };
const domain = { name: 'Agora Dollar', version: '1', chainId: chain.id, verifyingContract: AUSD } as const;
const receiveTypes = { ReceiveWithAuthorization: [
  { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
] } as const;
const cancelTypes = { CancelAuthorization: [{ name: 'authorizer', type: 'address' }, { name: 'nonce', type: 'bytes32' }] } as const;
export const allowanceNonce = (vault: Address, start: bigint) => keccak256(encodePacked(['string', 'address', 'uint256'], ['stipend', vault, start]));

/** The vault signs one capped, time-boxed transfer to the play key per week. AUSD itself enforces amount and window. */
export async function signAllowances(vault: LocalAccount, play: Address, value: bigint, weeks: number, from = weekStart(now())): Promise<Allowance[]> {
  const out: Allowance[] = [];
  for (let w = 0; w < weeks; w++) {
    const start = from + BigInt(w) * WEEK;
    const message = { from: vault.address, to: play, value, validAfter: start, validBefore: start + WEEK, nonce: allowanceNonce(vault.address, start) };
    out.push({ ...message, signature: await vault.signTypedData({ domain, types: receiveTypes, primaryType: 'ReceiveWithAuthorization', message }) });
  }
  return out;
}

export const signCancel = (vault: LocalAccount, nonce: Hex) =>
  vault.signTypedData({ domain, types: cancelTypes, primaryType: 'CancelAuthorization', message: { authorizer: vault.address, nonce } });

// Reads
export const ausdBalance = (who: Address) => client.readContract({ address: AUSD, abi, functionName: 'balanceOf', args: [who] });
export const monBalance = (who: Address) => client.getBalance({ address: who });
export const isUsed = (vault: Address, nonce: Hex) => client.readContract({ address: AUSD, abi, functionName: 'authorizationState', args: [vault, nonce] });

export async function perplAccount(play: Address) {
  try {
    const a = await client.readContract({ address: PERPL, abi, functionName: 'getAccountByAddr', args: [play] });
    return { id: a.accountId, balance: a.balanceCNS, locked: a.lockedBalanceCNS };
  } catch (error) {
    if (revertReason(error).includes('AccountDoesNotExist')) return null;
    throw error;
  }
}

export async function marketInfo(id: bigint) {
  const p = await client.readContract({ address: PERPL, abi, functionName: 'getPerpetualInfoV2', args: [id] });
  return { priceDecimals: Number(p.priceDecimals), lotDecimals: Number(p.lotDecimals), markPNS: p.markPNS, markTimestamp: p.markTimestamp, status: p.status };
}

export type Position = { market: Market; side: 'long' | 'short'; lots: bigint; entryPNS: bigint; depositCNS: bigint; pnlCNS: bigint; fundingCNS: bigint; markPNS: bigint; liqPNS: bigint; priceDecimals: number; lotDecimals: number };

export async function positions(accountId: bigint): Promise<Position[]> {
  const rows = await Promise.all(MARKETS.map(async market => {
    const [[p, mark], info] = await Promise.all([
      client.readContract({ address: PERPL, abi, functionName: 'getPositionV2', args: [market.id, accountId] }),
      marketInfo(market.id),
    ]);
    if (p.lotLNS === 0n) return null;
    const [, maint] = await client.readContract({ address: PERPL, abi, functionName: 'getMarginFractions', args: [market.id, p.lotLNS] });
    const side = p.positionType === 0 ? 'long' : 'short';
    return { market, side, lots: p.lotLNS, entryPNS: p.pricePNS, depositCNS: p.depositCNS, pnlCNS: p.pnlCNS, fundingCNS: p.premiumPnlCNS, markPNS: mark,
      liqPNS: liquidationPrice(side, p.pricePNS, p.lotLNS, p.depositCNS, p.premiumPnlCNS, maint, info), priceDecimals: info.priceDecimals, lotDecimals: info.lotDecimals } satisfies Position;
  }));
  return rows.filter(r => r !== null);
}

/** Perpl's SDK formula (checked against 18 real liquidations): entry + side × (entry × size / maintLeverage − deposit − funding) / size. */
export function liquidationPrice(side: 'long' | 'short', entryPNS: bigint, lots: bigint, depositCNS: bigint, fundingCNS: bigint, maintHdths: bigint, d: { priceDecimals: number; lotDecimals: number }) {
  const entry = Number(entryPNS) / 10 ** d.priceDecimals, size = Number(lots) / 10 ** d.lotDecimals;
  const sign = side === 'long' ? 1 : -1, maintLev = Number(maintHdths) / 100;
  const liq = entry + sign * (entry * size / maintLev - Number(depositCNS) / 1e6 - Number(fundingCNS) / 1e6) / size;
  return BigInt(Math.max(0, Math.round(liq * 10 ** d.priceDecimals)));
}

// Writes: everything below is signed by the play key, prompt-free.
export function playWallet(play: LocalAccount) {
  return createWalletClient({ account: play, chain, transport: http(RPC, { retryCount: 5, retryDelay: 600 }), pollingInterval: 1000 });
}

const tokenErrors = parseAbi(['error InvalidAuthorization()', 'error ExpiredAuthorization()', 'error UsedOrCanceledAuthorization()', 'error InvalidSignature()', 'error ERC20InsufficientBalance(address,uint256,uint256)', 'error ERC20InsufficientAllowance(address,uint256,uint256)']);
const errorAbi = [...tokenErrors, ...(perplErrors as Abi)];

/** Turn a revert into the contract's own error name and arguments, e.g. "MarkPriceAgeExceedsMax(16, …)". */
export function revertReason(e: unknown): string {
  const data = e instanceof BaseError ? (e.walk(x => typeof (x as { data?: unknown }).data === 'string') as { data?: Hex } | null)?.data : undefined;
  if (data) {
    try { const d = decodeErrorResult({ abi: errorAbi, data }); return `${d.errorName}(${(d.args ?? []).map(String).join(', ')})`; } catch { /* unknown selector */ }
  }
  return e instanceof BaseError ? e.shortMessage : String(e);
}

async function send(play: LocalAccount, address: Address, functionName: string, args: readonly unknown[]) {
  let request;
  try { ({ request } = await client.simulateContract({ account: play, address, abi, functionName: functionName as never, args: args as never })); }
  catch (e) { throw new Error(revertReason(e)); }
  const hash = await playWallet(play).writeContract(request as never);
  const receipt = await client.waitForTransactionReceipt({ hash, pollingInterval: 1000 });
  if (receipt.status !== 'success') throw new Error(`${functionName} reverted (${hash})`);
  return hash;
}

export type Step = { label: string; hash: Hex };

export async function collect(play: LocalAccount, a: Allowance, onStep?: (step: Step) => void): Promise<Step[]> {
  const steps: Step[] = [];
  steps.push({ label: 'Collected this week’s allowance', hash: await send(play, AUSD, 'receiveWithAuthorization', [a.from, a.to, a.value, a.validAfter, a.validBefore, a.nonce, a.signature]) });
  onStep?.(steps[steps.length - 1]);
  steps.push({ label: 'Paid the 0.25 AUSD weekly fee', hash: await send(play, AUSD, 'transfer', [TREASURY, FEE]) });
  onStep?.(steps[steps.length - 1]);
  return steps;
}

export const cancel = async (play: LocalAccount, vault: Address, nonce: Hex, signature: Hex) =>
  [{ label: 'Cancelled a future week', hash: await send(play, AUSD, 'cancelAuthorization', [vault, nonce, signature]) }];

/** Move AUSD from the play wallet into its Perpl account, opening the account on first use. */
export async function fundPerpl(play: LocalAccount, amount: bigint, onStep?: (step: Step) => void): Promise<Step[]> {
  const steps: Step[] = [];
  const existing = await perplAccount(play.address);
  if (!existing && amount < MIN_ACCOUNT) throw new Error('Perpl needs at least 100 AUSD to open an account on testnet.');
  steps.push({ label: 'Approved Perpl to use AUSD', hash: await send(play, AUSD, 'approve', [PERPL, amount]) });
  onStep?.(steps[steps.length - 1]);
  steps.push(existing
    ? { label: 'Added margin on Perpl', hash: await send(play, PERPL, 'depositCollateral', [amount]) }
    : { label: 'Opened a Perpl account', hash: await send(play, PERPL, 'createAccount', [amount]) });
  onStep?.(steps[steps.length - 1]);
  return steps;
}

const order = (type: number, perpId: bigint, pricePNS: bigint, lots: bigint, leverage: number) =>
  [[BigInt(Date.now()), perpId, type, 0n, pricePNS, lots, 0n, false, false, true, 100n, BigInt(leverage * 100), 0n, 0n, 1000n]] as const;

/** Size an IOC order from a margin in AUSD: lots = margin × leverage / mark. */
export async function open(play: LocalAccount, market: Market, side: 'long' | 'short', marginCNS: bigint, leverage: number): Promise<Step[]> {
  if (leverage < 1 || leverage > MAX_LEVERAGE) throw new Error(`Leverage must be 1x to ${MAX_LEVERAGE}x.`);
  const info = await marketInfo(market.id);
  const mark = Number(info.markPNS) / 10 ** info.priceDecimals;
  const lots = BigInt(Math.floor((Number(marginCNS) / 1e6) * leverage / mark * 10 ** info.lotDecimals));
  if (lots === 0n) throw new Error('That amount is too small for one lot.');
  const limit = side === 'long' ? info.markPNS * (10_000n + SLIPPAGE_BPS) / 10_000n : info.markPNS * (10_000n - SLIPPAGE_BPS) / 10_000n;
  return [{ label: `Opened ${side === 'long' ? 'Up' : 'Down'} on ${market.symbol} at ${leverage}x`, hash: await send(play, PERPL, 'execOrder', order(side === 'long' ? 0 : 1, market.id, limit, lots, leverage)) }];
}

export async function close(play: LocalAccount, p: Position): Promise<Step[]> {
  const info = await marketInfo(p.market.id);
  const band = SLIPPAGE_BPS * 2n;
  const limit = p.side === 'long' ? info.markPNS * (10_000n - band) / 10_000n : info.markPNS * (10_000n + band) / 10_000n;
  return [{ label: `Closed ${p.market.symbol}`, hash: await send(play, PERPL, 'execOrder', order(p.side === 'long' ? 2 : 3, p.market.id, limit, p.lots, 1)) }];
}

/** Withdraw free margin from Perpl and send everything in the play wallet back to savings. */
export async function bank(play: LocalAccount, vault: Address, onStep?: (step: Step) => void): Promise<Step[]> {
  const steps: Step[] = [];
  const acct = await perplAccount(play.address);
  const free = acct ? acct.balance - acct.locked : 0n;
  if (free > 0n) {
    steps.push({ label: 'Withdrew from Perpl', hash: await send(play, PERPL, 'withdrawCollateral', [free]) });
    onStep?.(steps[steps.length - 1]);
  }
  const held = await ausdBalance(play.address);
  if (held > 0n) {
    steps.push({ label: 'Moved winnings to savings', hash: await send(play, AUSD, 'transfer', [vault, held]) });
    onStep?.(steps[steps.length - 1]);
  }
  return steps;
}

export const formatAusd = (v: bigint) => (Number(v) / 10 ** AUSD_DECIMALS).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatPrice = (pns: bigint, decimals: number) => (Number(pns) / 10 ** decimals).toLocaleString('en-US', { maximumFractionDigits: decimals });
export const txUrl = (hash: Hex) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (a: Address) => `${EXPLORER}/address/${a}`;
