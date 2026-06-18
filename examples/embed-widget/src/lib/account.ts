import { createEndUserClient } from '@aastar/sdk';
import { http, formatEther, type Address } from 'viem';
import type { WidgetConfig } from '../config';

/**
 * Build a read-only EndUserClient. No `account` is passed, so this is safe in the
 * browser: it only exposes public reads (balance, address prediction). Contract
 * addresses auto-resolve from `chain.id` — no `addresses` object needed for the
 * supported chains (sepolia / optimism / optimismSepolia).
 */
export function getReadClient(config: WidgetConfig) {
  return createEndUserClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}

/** Native balance of an address, formatted as an ETH string. */
export async function getBalanceEth(config: WidgetConfig, address: Address): Promise<string> {
  const client = getReadClient(config);
  const wei = await client.getBalance({ address });
  return formatEther(wei);
}

/**
 * Predict the ERC-4337 SimpleAccount address for an owner EOA, without deploying.
 * Useful when the backend returns an owner key rather than the smart account address.
 */
export async function predictSmartAccount(
  config: WidgetConfig,
  owner: Address,
): Promise<{ accountAddress: Address; isDeployed: boolean }> {
  const client = getReadClient(config);
  const { accountAddress, isDeployed } = await client.createSmartAccount({ owner });
  return { accountAddress, isDeployed };
}
