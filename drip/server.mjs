import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createPublicClient, createWalletClient, http, isAddress, parseAbi, parseEther, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from 'viem/chains';

const AUSD = '0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC';
const FAUCET = '0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C';
const abi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)', 'function requestFunds(address)', 'error MaxFrequencyExceeded()']);
const DAY = 24 * 60 * 60 * 1000;
let lastBroadcast = 0;

export function validateRecipients(body) {
  if (!body || typeof body.vault !== 'string' || typeof body.play !== 'string' || !isAddress(body.vault) || !isAddress(body.play) || body.vault.toLowerCase() === zeroAddress || body.play.toLowerCase() === zeroAddress || body.vault.toLowerCase() === body.play.toLowerCase()) {
    throw new Error('Provide two different, valid savings and play addresses.');
  }
  return { vault: body.vault, play: body.play };
}

export function startDrip() {
  const { DRIP_PRIVATE_KEY, ALLOW_ORIGIN, RPC_URL = 'https://testnet-rpc.monad.xyz', PORT = '8797' } = process.env;
  if (!/^0x[\da-f]{64}$/i.test(DRIP_PRIVATE_KEY ?? '')) throw new Error('Set DRIP_PRIVATE_KEY to a testnet key in the environment.');
  if (!ALLOW_ORIGIN || new URL(ALLOW_ORIGIN).origin !== ALLOW_ORIGIN) throw new Error('Set ALLOW_ORIGIN to the exact app origin.');
  const port = Number(PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  const transport = http(RPC_URL);
  const client = createPublicClient({ chain: monadTestnet, transport });
  const wallet = createWalletClient({ chain: monadTestnet, transport, account: privateKeyToAccount(DRIP_PRIVATE_KEY) });
  const claimed = new Map();
  let working = false;
  const server = createServer(async (req, res) => {
    const txs = [];
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    if (req.headers.origin && req.headers.origin !== ALLOW_ORIGIN) return reply(403, { error: 'This origin is not allowed.' });
    res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.url !== '/drip') return reply(404, { error: 'Not found.' });
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method !== 'POST') return reply(405, { error: 'Use POST /drip.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'Send JSON.' });
    let recipients;
    try {
      let text = '';
      for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 1024) return reply(413, { error: 'Request is too large.' }); }
      recipients = validateRecipients(JSON.parse(text));
    } catch { return reply(400, { error: 'Provide two different, valid savings and play addresses as JSON.' }); }
    if (working) return reply(503, { error: 'The drip is serving another wallet. Try again in a few seconds.' });
    const ids = [recipients.vault.toLowerCase(), recipients.play.toLowerCase()];
    for (const [id, at] of claimed) if (Date.now() - at >= DAY) claimed.delete(id);
    if (ids.some(id => claimed.has(id))) return reply(429, { error: 'These addresses can receive test tokens once every 24 hours.' });
    working = true;
    const confirm = async (label, hash) => {
      for (const id of ids) claimed.set(id, Date.now());
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Test-token transfer reverted.');
      txs.push({ label, hash });
    };
    try {
      if (await client.getChainId() !== 10143) throw new Error('Drip RPC must be Monad testnet.');
      const [gas, savings] = await Promise.all([client.getBalance({ address: recipients.play }), client.readContract({ address: AUSD, abi, functionName: 'balanceOf', args: [recipients.vault] })]);
      if (gas < parseEther('0.05')) {
        const wait = 2500 - (Date.now() - lastBroadcast);
        if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
        const hash = await wallet.sendTransaction({ to: recipients.play, value: parseEther('0.2') });
        lastBroadcast = Date.now();
        await confirm('Received 0.2 test MON for gas', hash);
      }
      if (savings < 200_000_000n) {
        const stock = await client.readContract({ address: AUSD, abi, functionName: 'balanceOf', args: [wallet.account.address] });
        if (stock < 5_000_000_000n) {
          try {
            const { request } = await client.simulateContract({ account: wallet.account, address: FAUCET, abi, functionName: 'requestFunds', args: [wallet.account.address] });
            const hash = await wallet.writeContract(request);
            lastBroadcast = Date.now();
            const receipt = await client.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') throw new Error('Faucet refill reverted.');
            txs.push({ label: 'Refilled the test AUSD drip stock', hash });
          } catch (error) {
            if (!error?.walk?.(cause => cause?.data?.errorName === 'MaxFrequencyExceeded')) throw error;
          }
        }
        const { request } = await client.simulateContract({ account: wallet.account, address: AUSD, abi, functionName: 'transfer', args: [recipients.vault, 1_000_000_000n] });
        const hash = await wallet.writeContract(request);
        lastBroadcast = Date.now();
        await confirm('Received 1,000 test AUSD in savings', hash);
      }
      for (const id of ids) claimed.set(id, Date.now());
      reply(200, { txs });
    } catch (error) {
      console.error('drip failed:', error?.shortMessage ?? error?.message);
      reply(503, { error: 'The drip could not finish. Try again in a minute.', txs });
    } finally { working = false; }
  });
  server.requestTimeout = 10000;
  server.listen(port, '127.0.0.1', () => console.log(`Stipend testnet drip listening on 127.0.0.1:${port}`));
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startDrip();
