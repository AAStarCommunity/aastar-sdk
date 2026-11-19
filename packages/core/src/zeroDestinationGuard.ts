/**
 * Refuse, before anything is signed, a transaction whose destination is the zero address. An address book marks a
 * contract its deployment does not include with the zero address (e.g. sp550AddressSet for a coexisting stack), and an
 * action bound to it would otherwise build, sign and send a call there — with value or a token transfer, a burn.
 *
 * Applied as a viem client extension by the role-based client factories, so every action's write goes through it.
 */
import { sendCalls, sendCallsSync, sendTransaction, sendTransactionSync, signTransaction, writeContract, writeContractSync } from 'viem/actions';
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

/**
 * viem extension: every wallet action that builds, signs or sends a call to a destination — writeContract(Sync),
 * sendTransaction(Sync), sendCalls(Sync), signTransaction — throws ZeroAddressDestinationError first when that
 * destination is the zero address. (sendRawTransaction takes bytes already signed elsewhere: not covered.)
 */
export function zeroDestinationGuard(client: Client) {
    const byAddress = (method: string, run: (c: any, a: any) => Promise<any>) => (args: any): Promise<any> =>
        isZeroAddress(args?.address) ? Promise.reject(new ZeroAddressDestinationError(method, args?.functionName)) : run(client, args);
    const byTo = (method: string, run: (c: any, a: any) => Promise<any>) => (args: any): Promise<any> =>
        isZeroAddress(args?.to) ? Promise.reject(new ZeroAddressDestinationError(method)) : run(client, args);
    const byCalls = (method: string, run: (c: any, a: any) => Promise<any>) => (args: any): Promise<any> => {
        const i = (args?.calls ?? []).findIndex((c: any) => isZeroAddress(c?.to));
        return i >= 0 ? Promise.reject(new ZeroAddressDestinationError(method, `call ${i}`)) : run(client, args);
    };
    return {
        writeContract: byAddress('writeContract', writeContract as any),
        writeContractSync: byAddress('writeContractSync', writeContractSync as any),
        sendTransaction: byTo('sendTransaction', sendTransaction as any),
        sendTransactionSync: byTo('sendTransactionSync', sendTransactionSync as any),
        signTransaction: byTo('signTransaction', signTransaction as any),
        sendCalls: byCalls('sendCalls', sendCalls as any),
        sendCallsSync: byCalls('sendCallsSync', sendCallsSync as any),
    };
}
