import { createEndUserClient } from '@aastar/sdk';
import { http, formatEther, type Address } from 'viem';
import { runtime } from '../config';

/**
 * Read-only EndUserClient. No `account` passed -> browser-safe public reads only.
 * Contract addresses auto-resolve from `chain.id` (no `addresses` object needed for
 * the supported chains: sepolia / optimism / optimismSepolia).
 */
export function getReadClient() {
  return createEndUserClient({ chain: runtime.chain, transport: http(runtime.rpcUrl) });
}

export async function getBalanceEth(address: Address): Promise<string> {
  const wei = await getReadClient().getBalance({ address });
  return formatEther(wei);
}

export async function predictSmartAccount(
  owner: Address,
): Promise<{ accountAddress: Address; isDeployed: boolean }> {
  const { accountAddress, isDeployed } = await getReadClient().createSmartAccount({ owner });
  return { accountAddress, isDeployed };
}
