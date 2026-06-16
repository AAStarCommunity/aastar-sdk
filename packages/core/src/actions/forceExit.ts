import { type Address, type PublicClient, type WalletClient, type Hex } from 'viem';
import { ForceExitModuleABI } from '../abis/index.js';
import { validateAddress } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

// pendingExit() tuple result — a queued guardian-driven force-exit transaction.
export type PendingExit = {
    target: Address;
    value: bigint;
    data: Hex;
    proposedAt: bigint;
    approvalBitmap: bigint;
};

export type ForceExitActions = {
    pendingExit: (args: { account: Address }) => Promise<PendingExit>;
};

const ABI = ForceExitModuleABI;

export const forceExitActions = (address: Address) => (client: PublicClient | WalletClient): ForceExitActions => ({
    async pendingExit({ account }) {
        try {
            validateAddress(account, 'account');
            const r = await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'pendingExit', args: [account]
            }) as readonly [Address, bigint, Hex, bigint, bigint];
            return {
                target: r[0],
                value: r[1],
                data: r[2],
                proposedAt: r[3],
                approvalBitmap: r[4],
            };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'pendingExit');
        }
    },
});
