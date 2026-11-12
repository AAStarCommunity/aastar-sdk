/**
 * Admin client for scripts/21_test_paymasterv4_complete.ts.
 *
 * Paymaster actions close over the address passed here. `CORE_ADDRESSES.paymasterV4`
 * is `PAYMASTER_V4` / `PAYMASTER_V4_PROXY`, captured when that module loads — before
 * this script's dotenv reads `.env.anvil` — and it is not `PAYMASTER_V4_ADDRESS`.
 */
import { type Account, type Address, type Hash, type Transport } from 'viem';
import { foundry } from 'viem/chains';
import { CORE_ADDRESSES } from '../packages/core/src/contract-addresses.js';
import { createAdminClient, type AdminClient } from '../packages/sdk/src/clients/admin.js';

export type MinedReceipt = { status: 'success' | 'reverted' };

export type StepCount = { testsPassed: number; testsFailed: number; error?: unknown };

type WaitForReceipt = (hash: Hash) => Promise<MinedReceipt>;

export function requireMinedSuccess(receipt: MinedReceipt, label: string, hash: Hash): void {
    if (receipt.status !== 'success') {
        throw new Error(`${label} reverted: ${hash}`);
    }
}

/**
 * Test 5.1 treats a missing SDK method as a skip. `AlreadyExists` stays idempotent.
 * A mined revert, a timeout, a network error, and any other message fail the step.
 */
export function classifySbtActivityError(message: string | undefined): 'idempotent' | 'failed' | 'skipped' {
    if (message?.includes('AlreadyExists')) return 'idempotent';
    if (message?.includes('is not a function')) return 'skipped';
    return 'failed';
}

export function adminClientForPaymaster(args: {
    transport: Transport;
    account: Account;
    paymasterV4Address: Address;
}): AdminClient {
    return createAdminClient({
        chain: foundry,
        transport: args.transport,
        account: args.account,
        addresses: {
            ...CORE_ADDRESSES,
            paymasterV4: args.paymasterV4Address,
        },
    });
}

/** Test 2 of the anvil script. Price scale matches scripts/l4-setup.ts ($1.00, 8 decimals). */
export async function registerGasToken(args: {
    adminClient: { setTokenPrice: (a: { token: Address; price: bigint }) => Promise<Hash> };
    token: Address;
    waitForReceipt: WaitForReceipt;
}): Promise<Hash> {
    const hash = await args.adminClient.setTokenPrice({
        token: args.token,
        price: 100_000_000n,
    });
    requireMinedSuccess(await args.waitForReceipt(hash), 'setTokenPrice', hash);
    return hash;
}

/**
 * Test 13 of the anvil script. A thrown call or a mined revert is a failure:
 * an empty EntryPoint deposit must not be counted as a pass.
 */
export async function withdrawPaymasterDeposit(args: {
    adminClient: { withdrawTo: (a: { to: Address; amount: bigint }) => Promise<Hash> };
    to: Address;
    waitForReceipt: WaitForReceipt;
}): Promise<StepCount> {
    try {
        const hash = await args.adminClient.withdrawTo({
            to: args.to,
            amount: 1n,
        });
        requireMinedSuccess(await args.waitForReceipt(hash), 'withdrawTo', hash);
        return { testsPassed: 1, testsFailed: 0 };
    } catch (error) {
        return { testsPassed: 0, testsFailed: 1, error };
    }
}
