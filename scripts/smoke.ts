// Start fresh: anvil --fork-url https://testnet-rpc.monad.xyz --port 8551 --chain-id 10143 --disable-code-size-limit
// Run: VITE_RPC_URL=http://127.0.0.1:8551 node --experimental-strip-types scripts/smoke.ts
import assert from 'node:assert/strict';
import { createTestClient, createWalletClient, decodeFunctionData, http, parseAbi } from 'viem';
import { monadTestnet } from 'viem/chains';
import * as s from '../src/lib/stipend.ts';

const rpc = s.RPC;
assert.equal(new URL(rpc).hostname, '127.0.0.1', 'point VITE_RPC_URL at the anvil fork');
const chain = { ...monadTestnet, rpcUrls: { default: { http: [rpc] } } };
const test = createTestClient({ chain, mode: 'anvil', transport: http(rpc) });
const node = await test.transport.request({ method: 'anvil_nodeInfo', params: [] }) as { environment: { chainId: number }; forkConfig: { forkUrl?: string } };
assert.equal(node.environment.chainId, 10143);
assert.ok(node.forkConfig.forkUrl, 'Anvil must be forking testnet');
const fork = await s.client.getBlock();
// Advance one second per mined block, independent of slow upstream reads; keep Perpl's price checks intact.
await test.setBlockTimestampInterval({ interval: 1 });
const info = await s.client.readContract({ address: s.PERPL, abi: s.abi, functionName: 'getPerpetualInfoV2', args: [16n] });
console.log('fork', fork.number, 'timestamp', fork.timestamp, 'BTC mark age', fork.timestamp - info.markTimestamp, 'oracle age', fork.timestamp - info.oracleTimestampSec);
assert.ok(fork.timestamp - info.markTimestamp + 10n <= info.refPriceMaxAgeSec, 'restart with a fresh fork: BTC mark needs time for the trading loop');
assert.ok(fork.timestamp - info.oracleTimestampSec + 10n <= info.refPriceMaxAgeSec, 'restart with a fresh fork: BTC oracle needs time for the trading loop');
const minimum = await s.client.readContract({ address: s.PERPL, abi: parseAbi(['function getMinAccountOpenCNS() view returns (uint256)']), functionName: 'getMinAccountOpenCNS' });
assert.equal(minimum, s.MIN_ACCOUNT);
console.log('minimum account', s.formatAusd(minimum), 'AUSD');
for (const market of s.MARKETS) {
  const d = await s.marketInfo(market.id);
  console.log(market.symbol, 'id', market.id, 'price decimals', d.priceDecimals, 'lot decimals', d.lotDecimals);
}

const prf = crypto.getRandomValues(new Uint8Array(32));
const vault = s.openKey(prf, 'vault'), play = s.openKey(prf, 'play');
assert.notEqual(vault.account.address, play.account.address);
const restored = s.openKey(prf, 'play');
assert.equal(restored.account.address, play.account.address, 'same passkey output gives the same play address');
restored.end();
console.log('keys: distinct vault/play; play restored');

await test.setBalance({ address: play.account.address, value: 10n ** 22n });
// Impersonate the faucet balance only on this fork, avoiding its requestFunds rate limit.
await test.impersonateAccount({ address: s.FAUCET }); await test.setBalance({ address: s.FAUCET, value: 10n ** 22n });
const drip = createWalletClient({ account: s.FAUCET, chain, transport: http(rpc) });
const fundingHash = await drip.writeContract({ address: s.AUSD, abi: s.abi, functionName: 'transfer', args: [vault.account.address, 1_000_000_000n] });
// Finish mining before reading: Viem replacement detection can miss the only new block on a quiet fork.
await test.mine({ blocks: 1 });
assert.equal((await s.client.getTransactionReceipt({ hash: fundingHash })).status, 'success');
await test.stopImpersonatingAccount({ address: s.FAUCET });
const savings0 = await s.ausdBalance(vault.account.address);
console.log('vault', vault.account.address, 'savings', s.formatAusd(savings0));
assert.equal(savings0, 1_000_000_000n, 'faucet funded the vault');

const weekly = 150_000_000n;
const allowances = await s.signAllowances(vault.account, play.account.address, weekly, 4, s.weekStart(fork.timestamp));
assert.equal(allowances.length, 4);
console.log('signed 4 weekly allowances of', s.formatAusd(weekly), 'AUSD');
vault.end();

const treasury0 = await s.ausdBalance(s.TREASURY);
const steps = await s.collect(play.account, allowances[0]);
console.log('collect:', steps.map(x => x.label).join(' | '));
assert.equal(await s.ausdBalance(play.account.address), weekly - s.FEE);
assert.equal(await s.ausdBalance(s.TREASURY), treasury0 + s.FEE);
assert.equal(await s.ausdBalance(vault.account.address), savings0 - weekly);
assert.equal(await s.isUsed(vault.account.address, allowances[0].nonce), true);
await assert.rejects(s.collect(play.account, allowances[0]), /UsedOrCanceledAuthorization/);
await assert.rejects(s.collect(play.account, allowances[1]), /InvalidAuthorization/);
console.log('fee received; week 0 replay refused; week 1 early collection refused');

console.log(await s.fundPerpl(play.account, 140_000_000n).then(x => x.map(y => y.label).join(' | ')));
const acct = await s.perplAccount(play.account.address);
assert.ok(acct, 'Perpl account exists');
assert.equal(acct.balance, 140_000_000n);
const orderStart = BigInt(Date.now());
const opened = await s.open(play.account, s.MARKETS[0], 'long', 50_000_000n, 2);
console.log(opened.map(x => x.label).join(' | '));
const openTx = await s.client.getTransaction({ hash: opened[0].hash });
const [openOrder] = decodeFunctionData({ abi: s.abi, data: openTx.input }).args as readonly [readonly unknown[]];
const expectedLots = 50_000_000n * 2n * 10n ** info.lotDecimals * 10n ** info.priceDecimals / (1_000_000n * info.markPNS);
assert.ok(typeof openOrder[0] === 'bigint' && openOrder[0] >= orderStart && openOrder[0] <= BigInt(Date.now()), 'descriptor uses Date.now()');
assert.deepEqual(openOrder.slice(1), [16n, 0, 0n, info.markPNS * 10050n / 10000n, expectedLots, 0n, false, false, true, 100n, 200n, 0n, 0n, 1000n]);
const [pos] = await s.positions(acct.id);
assert.ok(pos && pos.lots > 0n, 'the IOC order filled');
assert.equal(pos.lots, expectedLots, 'the entire requested size filled');
assert.equal(pos.side, 'long');
console.log('position', pos.market.symbol, pos.side, 'lots', pos.lots, 'entry', s.formatPrice(pos.entryPNS, pos.priceDecimals), 'mark', s.formatPrice(pos.markPNS, pos.priceDecimals), 'liq', s.formatPrice(pos.liqPNS, pos.priceDecimals));
assert.ok(pos.liqPNS > 0n && pos.liqPNS < pos.markPNS, 'a 2x long liquidates below the mark');

const closed = await s.close(play.account, pos);
console.log(closed.map(x => x.label).join(' | '));
const closeTx = await s.client.getTransaction({ hash: closed[0].hash });
const [closeOrder] = decodeFunctionData({ abi: s.abi, data: closeTx.input }).args as readonly [readonly unknown[]];
assert.deepEqual(closeOrder.slice(1), [16n, 2, 0n, info.markPNS * 9900n / 10000n, pos.lots, 0n, false, false, true, 100n, 100n, 0n, 0n, 1000n]);
assert.equal((await s.positions(acct.id)).length, 0, 'position closed');
const free = await s.perplAccount(play.account.address);
assert.ok(free);
assert.equal(free.locked, 0n);
const savingsBeforeBank = await s.ausdBalance(vault.account.address);
const walletBeforeBank = await s.ausdBalance(play.account.address);
const snapshot = await test.snapshot();
const restingHash = await s.playWallet(play.account).writeContract({ address: s.PERPL, abi: s.abi, functionName: 'execOrder', args: [[BigInt(Date.now()), 16n, 0, 0n, info.markPNS * 9000n / 10000n, expectedLots, 0n, true, false, false, 100n, 200n, 0n, 0n, 1000n]] });
assert.equal((await s.client.waitForTransactionReceipt({ hash: restingHash })).status, 'success');
const locked = await s.perplAccount(play.account.address);
assert.ok(locked && locked.locked > 0n, 'resting order locks collateral');
await s.bank(play.account, vault.account.address);
assert.equal((await s.perplAccount(play.account.address))?.balance, locked.locked, 'bank leaves locked collateral on Perpl');
assert.equal(await s.ausdBalance(vault.account.address), savingsBeforeBank + locked.balance - locked.locked + walletBeforeBank);
await test.revert({ id: snapshot });
console.log('bank with resting order: withdrew only free margin; snapshot restored');
console.log((await s.bank(play.account, vault.account.address)).map(x => x.label).join(' | '));
assert.equal(await s.ausdBalance(play.account.address), 0n, 'play wallet emptied into savings');
assert.equal((await s.perplAccount(play.account.address))?.balance, 0n, 'Perpl free margin withdrawn');
assert.equal(await s.ausdBalance(vault.account.address), savingsBeforeBank + free.balance + walletBeforeBank);
console.log('positions empty; Perpl balance 0; play AUSD 0; vault credited exactly');

const v2 = s.openKey(prf, 'vault');
const sig = await s.signCancel(v2.account, allowances[2].nonce); v2.end();
await s.cancel(play.account, vault.account.address, allowances[2].nonce, sig);
assert.equal(await s.isUsed(vault.account.address, allowances[2].nonce), true, 'week 2 cancelled');
await test.setNextBlockTimestamp({ timestamp: allowances[2].validAfter + 1n });
await test.mine({ blocks: 1 });
await assert.rejects(s.collect(play.account, allowances[2]), /UsedOrCanceledAuthorization/);
console.log('week 2 cancelled; collection refused inside its valid window');
console.log('savings now', s.formatAusd(await s.ausdBalance(vault.account.address)), '— smoke passed');
play.end();
