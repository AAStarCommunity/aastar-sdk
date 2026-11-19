/**
 * Refuse, before anything is signed, a transaction whose destination is the zero address. An address book marks a
 * contract its deployment does not include with the zero address (e.g. sp550AddressSet for a coexisting stack), and an
 * action bound to it would otherwise build, sign and send a call there — with value or a token transfer, a burn.
 *
 * Applied as a viem client extension by the role-based client factories, so every action's write goes through it.
 */
import { sendCalls, sendTransaction, writeContract } from 'viem/actions';
import type { Client } from 'viem';

const ZERO = /^0x0{40}$/i;

export class ZeroAddressDestinationError extends Error {
    constructor(readonly method: string, readonly functionName?: string) {
        super(`refusing ${method}${functionName ? ` ${functionName}` : ''} to the zero address: the selected deployment does not include that contract; nothing was signed or sent`);
        this.name = 'ZeroAddressDestinationError';
    }
}

/** True for an address that names "not deployed". */
export const isZeroAddress = (a: unknown): boolean => typeof a === 'string' && ZERO.test(a);

/** viem extension: writeContract / sendTransaction / sendCalls with a zero destination throw ZeroAddressDestinationError first. */
export function zeroDestinationGuard(client: Client) {
    return {
        writeContract: (args: any) => {
            if (isZeroAddress(args?.address)) return Promise.reject(new ZeroAddressDestinationError('writeContract', args?.functionName));
            return writeContract(client as any, args);
        },
        sendTransaction: (args: any) => {
            if (isZeroAddress(args?.to)) return Promise.reject(new ZeroAddressDestinationError('sendTransaction'));
            return sendTransaction(client as any, args);
        },
        sendCalls: (args: any) => {
            const i = (args?.calls ?? []).findIndex((c: any) => isZeroAddress(c?.to));
            if (i >= 0) return Promise.reject(new ZeroAddressDestinationError('sendCalls', `call ${i}`));
            return sendCalls(client as any, args);
        },
    };
}
