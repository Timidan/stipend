import { createPasskeyWithPrfOutput, getPasskeyPrfOutput } from '@category-labs/mera';
import type { Address, LocalAccount } from 'viem';
import { openKey } from './stipend';

export const IDLE_MS = 15 * 60 * 1000;
export type PlaySession = ReturnType<typeof openKey>;

export async function signIn(create: boolean, displayName = 'Stipend'): Promise<PlaySession & { vault: Address }> {
  const name = displayName || 'Stipend';
  const { prfOutput } = create
    ? await createPasskeyWithPrfOutput({ rp: { id: location.hostname, name: 'Stipend' }, user: { name, displayName: name } })
    : await getPasskeyPrfOutput({ rpId: location.hostname });
  try {
    const vault = openKey(prfOutput, 'vault');
    const address = vault.account.address;
    vault.end();
    return { ...openKey(prfOutput, 'play'), vault: address };
  } finally { prfOutput.fill(0); }
}

export async function withVault<T>(play: Address, action: (vault: LocalAccount) => Promise<T>, expectedVault?: Address): Promise<T> {
  const { prfOutput } = await getPasskeyPrfOutput({ rpId: location.hostname });
  let vault: PlaySession | undefined;
  try {
    const check = openKey(prfOutput, 'play');
    const matches = check.account.address.toLowerCase() === play.toLowerCase();
    check.end();
    if (!matches) throw new Error('Choose the same passkey you used to sign in.');
    vault = openKey(prfOutput, 'vault');
    prfOutput.fill(0);
    if (expectedVault && vault.account.address.toLowerCase() !== expectedVault.toLowerCase()) throw new Error('Choose the same passkey you used to sign in.');
    return await action(vault.account);
  } finally { prfOutput.fill(0); vault?.end(); }
}
