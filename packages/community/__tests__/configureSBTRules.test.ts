import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseEther, type Address } from 'viem';
import { CORE_ADDRESSES, MySBTABI } from '@aastar/core';
import { CommunityClient, type SBTRuleConfig } from '../src/index';

// Deterministic fixtures
const SBT_ADDRESS = '0x5555555555555555555555555555555555555555' as Address;
const ACCOUNT_ADDRESS = '0x2222222222222222222222222222222222222222' as Address;
const LOCK_TX = '0xaaa0000000000000000000000000000000000000000000000000000000000aaa';
const FEE_TX = '0xbbb0000000000000000000000000000000000000000000000000000000000bbb';

describe('CommunityClient.configureSBTRules', () => {
    let writeContract: ReturnType<typeof vi.fn>;
    let waitForTransactionReceipt: ReturnType<typeof vi.fn>;
    let walletClient: any;
    let publicClient: any;
    let client: CommunityClient;
    const originalSBT = (CORE_ADDRESSES as any).mySBT;

    beforeEach(() => {
        // Ensure the MySBT address resolves regardless of test env.
        (CORE_ADDRESSES as any).mySBT = SBT_ADDRESS;

        // setMinLockAmount returns LOCK_TX first, setMintFee returns FEE_TX second.
        writeContract = vi
            .fn()
            .mockResolvedValueOnce(LOCK_TX)
            .mockResolvedValueOnce(FEE_TX);
        waitForTransactionReceipt = vi.fn().mockResolvedValue({ status: 'success' });

        walletClient = {
            account: { address: ACCOUNT_ADDRESS },
            chain: { id: 31337 },
            writeContract,
        };
        publicClient = { waitForTransactionReceipt };

        client = new CommunityClient(publicClient, walletClient);
    });

    afterEach(() => {
        (CORE_ADDRESSES as any).mySBT = originalSBT;
        vi.clearAllMocks();
    });

    const RULES: SBTRuleConfig = {
        minStake: parseEther('10'),
        maxSupply: 0n, // 0n => skip the unconfigurable max-supply field
        mintPrice: parseEther('1'),
    };

    it('throws a contract-gap error when maxSupply is non-zero (no writes sent)', async () => {
        await expect(
            client.configureSBTRules({ ...RULES, maxSupply: 1000n })
        ).rejects.toThrow(/maxSupply is not configurable on-chain/);
        expect(writeContract).not.toHaveBeenCalled();
    });

    it('sends setMinLockAmount then setMintFee via the core MySBT ABI and returns the fee tx hash', async () => {
        const result = await client.configureSBTRules(RULES);

        expect(writeContract).toHaveBeenCalledTimes(2);

        const lockCall = writeContract.mock.calls[0][0];
        expect(lockCall.functionName).toBe('setMinLockAmount');
        expect(lockCall.address).toBe(SBT_ADDRESS);
        expect(lockCall.args).toEqual([RULES.minStake]);
        // Must use the centralized core ABI, not an inline parseAbi fragment.
        expect(lockCall.abi).toBe(MySBTABI);

        const feeCall = writeContract.mock.calls[1][0];
        expect(feeCall.functionName).toBe('setMintFee');
        expect(feeCall.address).toBe(SBT_ADDRESS);
        expect(feeCall.args).toEqual([RULES.mintPrice]);
        expect(feeCall.abi).toBe(MySBTABI);

        // Both writes are awaited for their receipts.
        expect(waitForTransactionReceipt).toHaveBeenCalledTimes(2);

        // Returns the final (mint-fee) tx hash.
        expect(result).toBe(FEE_TX);
    });

    it('throws when no wallet account is present', async () => {
        const noAccountClient = new CommunityClient(
            publicClient,
            { ...walletClient, account: undefined } as any
        );
        await expect(noAccountClient.configureSBTRules(RULES)).rejects.toThrow(
            /Wallet account not found/
        );
        expect(writeContract).not.toHaveBeenCalled();
    });
});
