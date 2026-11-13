/**
 * Replay check for a journal raw. A mismatch is false. Nothing from the decoder is forwarded.
 */
import {
    parseTransaction,
    recoverTransactionAddress,
    type Address,
    type Hex,
    type TransactionSerialized,
} from 'viem';
import type { JournalKind } from './journal.js';

export interface ReplayIdentity {
    chainId: number;
    signer: Address;
}

export interface ReplayEntry {
    nonce: number;
    kind: JournalKind;
    to: Hex;
    data: Hex;
    gasLimit: bigint;
}

export type ReplayIntent = (kind: JournalKind, decoded: { to: Address; data: Hex; gas: bigint }) => boolean;

function norm(value: string): string {
    return value.toLowerCase();
}

/** True only when the raw is our type-2 transaction and the keeper's intent accepts it. */
export async function replayRawAllowed(
    raw: Hex,
    entry: ReplayEntry,
    identity: ReplayIdentity,
    intent: ReplayIntent,
): Promise<boolean> {
    if (typeof raw !== 'string' || raw.length < 4 || raw.length > 200_000) return false;
    if (typeof intent !== 'function') return false;
    let tx;
    try {
        tx = parseTransaction(raw as TransactionSerialized);
    } catch {
        return false;
    }
    let from: Address;
    try {
        from = await recoverTransactionAddress({ serializedTransaction: raw as TransactionSerialized });
    } catch {
        return false;
    }
    if (!tx.to || tx.type !== 'eip1559') return false;
    const data = norm(tx.data ?? '0x');
    const accessEmpty = !tx.accessList || tx.accessList.length === 0;
    const value = tx.value ?? 0n;
    const gas = tx.gas ?? 0n;
    if (value !== 0n || !accessEmpty) return false;
    if (norm(from) !== norm(identity.signer)) return false;
    if (tx.chainId !== identity.chainId || tx.nonce !== entry.nonce) return false;
    if (norm(tx.to) !== norm(entry.to) || data !== norm(entry.data) || gas !== entry.gasLimit) return false;
    try {
        return intent(entry.kind, { to: tx.to, data: (tx.data ?? '0x') as Hex, gas }) === true;
    } catch {
        return false;
    }
}
