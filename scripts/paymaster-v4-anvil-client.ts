/**
 * Admin client for scripts/21_test_paymasterv4_complete.ts.
 *
 * Paymaster actions close over the address passed here. `CORE_ADDRESSES.paymasterV4`
 * is `PAYMASTER_V4` / `PAYMASTER_V4_PROXY`, captured when that module loads — before
 * this script's dotenv reads `.env.anvil` — and it is not `PAYMASTER_V4_ADDRESS`.
 */
import { type Account, type Address, type Transport } from 'viem';
import { foundry } from 'viem/chains';
import { CORE_ADDRESSES } from '../packages/core/src/contract-addresses.js';
import { createAdminClient, type AdminClient } from '../packages/sdk/src/clients/admin.js';

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
