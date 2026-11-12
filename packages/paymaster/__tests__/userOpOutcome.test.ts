import { describe, it, expect } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, type Address, type Hex } from 'viem';
import { EntryPointABI } from '@aastar/core';
import {
    PaymasterClient,
    UserOperationFailedError,
    UserOperationReceiptError,
    readUserOperationResult,
} from '../src/index';

const EP = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;
const SENDER = '0x00000000000000000000000000000000000000c3' as Address;
const PM = '0x00000000000000000000000000000000000000b2' as Address;
const OTHER = '0x00000000000000000000000000000000000000d4' as Address;
const HASH = ('0x' + '11'.repeat(32)) as Hex;
const OTHER_HASH = ('0x' + '22'.repeat(32)) as Hex;
const TX = ('0x' + 'ab'.repeat(32)) as Hex;
const REVERT_DATA = '0x08c379a0' as Hex;

function userOpEvent(
    hash: Hex,
    success: boolean,
    actualGasCost = 100n,
    actualGasUsed = 40n,
    address: Address = EP,
) {
    const topics = encodeEventTopics({
        abi: EntryPointABI as any,
        eventName: 'UserOperationEvent',
        args: { userOpHash: hash, sender: SENDER, paymaster: PM },
    });
    const data = encodeAbiParameters(
        [
            { type: 'uint256' },
            { type: 'bool' },
            { type: 'uint256' },
            { type: 'uint256' },
        ],
        [7n, success, actualGasCost, actualGasUsed],
    );
    return { address, topics, data };
}

function revertEvent(hash: Hex, revertReason: Hex, address: Address = EP) {
    const topics = encodeEventTopics({
        abi: EntryPointABI as any,
        eventName: 'UserOperationRevertReason',
        args: { userOpHash: hash, sender: SENDER },
    });
    const data = encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'bytes' }],
        [7n, revertReason],
    );
    return { address, topics, data };
}

/** Raw handleOps receipt: the transaction succeeded, the inner call did not. */
function revertedBundle() {
    return {
        status: 'success' as const,
        transactionHash: TX,
        logs: [
            userOpEvent(OTHER_HASH, true, 1n, 1n),
            revertEvent(OTHER_HASH, '0xabcd' as Hex),
            userOpEvent(HASH, false, 7298n, 21000n),
            revertEvent(HASH, REVERT_DATA),
        ],
    };
}

describe('readUserOperationResult', () => {
    it('decodes the UserOperationEvent for this hash, not the first log and not the tx status', () => {
        const result = readUserOperationResult(revertedBundle(), HASH, EP);
        expect(result.success).toBe(false);
        expect(result.userOpHash).toBe(HASH);
        expect(result.transactionHash).toBe(TX);
        expect(result.actualGasCost).toBe(7298n);
        expect(result.actualGasUsed).toBe(21000n);
        expect(result.sender?.toLowerCase()).toBe(SENDER.toLowerCase());
        expect(result.paymaster?.toLowerCase()).toBe(PM.toLowerCase());
        expect(result.nonce).toBe(7n);
        expect(result.revertReason).toBe(REVERT_DATA);
    });

    it('ignores a same-hash UserOperationEvent emitted by a contract that is not the entryPoint', () => {
        const receipt = {
            entryPoint: EP,
            receipt: { transactionHash: TX },
            logs: [
                userOpEvent(HASH, true, 9n, 9n, OTHER),
                userOpEvent(HASH, false, 3n, 4n, EP),
            ],
        };
        const result = readUserOperationResult(receipt, HASH);
        expect(result.success).toBe(false);
        expect(result.actualGasCost).toBe(3n);
        expect(result.actualGasUsed).toBe(4n);
    });

    it('uses a boolean success and gas already on the receipt', () => {
        const receipt = {
            success: false,
            actualGasCost: '0x10',
            actualGasUsed: '0x20',
            sender: SENDER,
            nonce: '0x7',
            reason: 'execution reverted',
            receipt: { transactionHash: TX },
        };
        const result = readUserOperationResult(receipt, HASH);
        expect(result.success).toBe(false);
        expect(result.actualGasCost).toBe(16n);
        expect(result.actualGasUsed).toBe(32n);
        expect(result.nonce).toBe(7n);
        expect(result.reason).toBe('execution reverted');
        expect(result.transactionHash).toBe(TX);
    });

    it('treats the same event duplicated on logs and receipt.logs as one', () => {
        const log = userOpEvent(HASH, true, 8n, 9n);
        const result = readUserOperationResult({
            entryPoint: EP,
            logs: [log],
            receipt: { transactionHash: TX, logs: [log] },
        }, HASH);
        expect(result.success).toBe(true);
        expect(result.actualGasCost).toBe(8n);
    });

    it('throws when receipt.success disagrees with the matching log', () => {
        const receipt = {
            success: true,
            actualGasCost: 5n,
            actualGasUsed: 6n,
            entryPoint: EP,
            receipt: { transactionHash: TX },
            logs: [userOpEvent(HASH, false, 5n, 6n)],
        };
        expect(() => readUserOperationResult(receipt, HASH)).toThrow(UserOperationReceiptError);
    });

    it('throws when nothing identifies this op, even if the transaction status is success', () => {
        const receipt = {
            entryPoint: EP,
            status: 'success',
            transactionHash: TX,
            logs: [userOpEvent(OTHER_HASH, true, 1n, 1n)],
        };
        expect(() => readUserOperationResult(receipt, HASH)).toThrow(UserOperationReceiptError);
        expect(() => readUserOperationResult(receipt, HASH)).toThrow(/no boolean success and no matching UserOperationEvent/);
    });

    it('rejects a receipt whose userOpHash is a different operation', () => {
        const other = {
            userOpHash: OTHER_HASH,
            success: true,
            actualGasCost: 1n,
            actualGasUsed: 2n,
            receipt: { transactionHash: TX },
        };
        expect(() => readUserOperationResult(other, HASH)).toThrow(UserOperationReceiptError);
        expect(() => readUserOperationResult(other, HASH)).toThrow(new RegExp(OTHER_HASH));

        const mixed = ('0x' + 'ab'.repeat(32)) as Hex;
        const same = {
            userOpHash: ('0x' + 'AB'.repeat(32)) as Hex,
            success: true,
            actualGasCost: 1n,
            actualGasUsed: 2n,
            receipt: { transactionHash: TX },
        };
        expect(readUserOperationResult(same, mixed).success).toBe(true);
        expect(readUserOperationResult(same, mixed).userOpHash).toBe(mixed);
    });

    it('does not accept a UserOperationEvent from an arbitrary contract on a raw receipt', () => {
        const spoofed = {
            status: 'success' as const,
            transactionHash: TX,
            logs: [
                userOpEvent(HASH, true, 9n, 9n, OTHER),
                revertEvent(HASH, '0xdead' as Hex, OTHER),
            ],
        };
        expect(() => readUserOperationResult(spoofed, HASH)).toThrow(/no EntryPoint address/);
        expect(() => readUserOperationResult(spoofed, HASH, EP)).toThrow(/no matching UserOperationEvent/);

        const result = readUserOperationResult({
            transactionHash: TX,
            logs: [
                userOpEvent(HASH, true, 9n, 9n, OTHER),
                revertEvent(HASH, '0xdead' as Hex, OTHER),
                userOpEvent(HASH, false, 3n, 4n, EP),
                revertEvent(HASH, REVERT_DATA, EP),
            ],
        }, HASH, EP);
        expect(result.success).toBe(false);
        expect(result.actualGasCost).toBe(3n);
        expect(result.actualGasUsed).toBe(4n);
        expect(result.revertReason).toBe(REVERT_DATA);
    });

    it('rejects an entryPoint argument that disagrees with the receipt', () => {
        const receipt = {
            entryPoint: EP,
            success: true,
            actualGasCost: 1n,
            actualGasUsed: 2n,
            receipt: { transactionHash: TX },
        };
        expect(() => readUserOperationResult(receipt, HASH, OTHER)).toThrow(/does not match the entryPoint argument/);
    });
});

describe('PaymasterClient.waitForUserOperationResult', () => {
    it('returns success=false without throwing, and throwOnFailure raises UserOperationFailedError', async () => {
        const raw = revertedBundle();
        const client = {
            waitForUserOperationReceipt: async () => raw,
        };
        const result = await PaymasterClient.waitForUserOperationResult(client, HASH, { entryPoint: EP });
        expect(result.success).toBe(false);
        expect(result.actualGasCost).toBe(7298n);

        await expect(PaymasterClient.waitForUserOperationResult(client, HASH, { throwOnFailure: true, entryPoint: EP }))
            .rejects.toBeInstanceOf(UserOperationFailedError);
        try {
            await PaymasterClient.waitForUserOperationResult(client, HASH, { throwOnFailure: true, entryPoint: EP });
        } catch (error) {
            const failed = error as UserOperationFailedError;
            expect(failed.success).toBe(false);
            expect(failed.userOpHash).toBe(HASH);
            expect(failed.transactionHash).toBe(TX);
            expect(failed.actualGasCost).toBe(7298n);
            expect(failed.actualGasUsed).toBe(21000n);
            expect(failed.result.revertReason).toBe(REVERT_DATA);
        }
    });

    it('forwards a numeric timeout and does not swallow a wait failure', async () => {
        let seen: unknown;
        const ok = {
            success: true,
            actualGasCost: 1n,
            actualGasUsed: 2n,
            receipt: { transactionHash: TX },
        };
        const client = {
            waitForUserOperationReceipt: async (args: unknown) => {
                seen = args;
                return ok;
            },
        };
        const result = await PaymasterClient.waitForUserOperationResult(client, HASH, 5000);
        expect(seen).toEqual({ hash: HASH, timeout: 5000 });
        expect(result.success).toBe(true);

        const timeout = new Error('Wait for User Operation Receipt timed out');
        timeout.name = 'TimeoutError';
        const failing = {
            waitForUserOperationReceipt: async () => { throw timeout; },
        };
        await expect(PaymasterClient.waitForUserOperationResult(failing, HASH)).rejects.toBe(timeout);
    });

    it('waitForUserOperation still returns the raw receipt when success is false', async () => {
        const raw = { success: false, actualGasCost: 1n, actualGasUsed: 2n, receipt: { transactionHash: TX } };
        const client = { waitForUserOperationReceipt: async () => raw };
        await expect(PaymasterClient.waitForUserOperation(client, HASH)).resolves.toBe(raw);

        const timeout = new Error('timed out');
        timeout.name = 'TimeoutError';
        const failing = { waitForUserOperationReceipt: async () => { throw timeout; } };
        await expect(PaymasterClient.waitForUserOperation(failing, HASH)).resolves.toEqual({ timeout: true, hash: HASH });
    });
});
