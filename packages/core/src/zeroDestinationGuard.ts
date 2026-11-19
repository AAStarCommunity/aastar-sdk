/**
 * Refuse, before anything is signed, a transaction whose destination is the zero address. An address book marks a
 * contract its deployment does not include with the zero address (e.g. sp550AddressSet for a coexisting stack), and an
 * action bound to it would otherwise build, sign and send a call there — with value or a token transfer, a burn.
 *
 * Applied as a viem client extension by the role-based client factories, so every action's write goes through it.
 */
import { deployContract, fillTransaction, prepareTransactionRequest, sendCalls, sendCallsSync, sendTransaction, sendTransactionSync, signTransaction, writeContract, writeContractSync } from 'viem/actions';
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
 * sendTransaction(Sync), sendCalls(Sync), signTransaction, prepareTransactionRequest, fillTransaction — throws
 * ZeroAddressDestinationError first when that destination is the zero address; deployContract refuses any `to`.
 * (sendRawTransaction takes bytes already signed elsewhere; signAuthorization is EIP-7702 delegation, where the zero
 * address means revoke: neither is a call to a destination.)
 */
export function zeroDestinationGuard(client: Client) {
    // A contract call's destination is `address`. viem spreads the rest of the request over { to: address }, so an extra
    // `to` would override the checked address (and viem's internal send is the unguarded one): a `to` field is refused.
    const byAddress = (method: string, run: (c: any, a: any) => Promise<any>) => (args: any): Promise<any> => {
        if (args?.to !== undefined) return Promise.reject(new ZeroAddressDestinationError(method, `${args.functionName ?? 'call'}: a contract call takes its destination from address, not to`));
        return isZeroAddress(args?.address) ? Promise.reject(new ZeroAddressDestinationError(method, args?.functionName)) : run(client, args);
    };
    // A deployment has no destination; viem spreads extra fields into a direct sendTransaction, so any `to` is refused.
    const noTo = (method: string, run: (c: any, a: any) => Promise<any>) => (args: any): Promise<any> =>
        args?.to !== undefined ? Promise.reject(new ZeroAddressDestinationError(method, 'a deployment carries no to')) : run(client, args);
    const byTo = (method: string, run: (c: any, a: any) => Promise<any>) => (args: any): Promise<any> =>
        isZeroAddress(args?.to) ? Promise.reject(new ZeroAddressDestinationError(method)) : run(client, args);
    const byCalls = (method: string, run: (c: any, a: any) => Promise<any>) => (args: any): Promise<any> => {
        const i = (args?.calls ?? []).findIndex((c: any) => isZeroAddress(c?.to));
        return i >= 0 ? Promise.reject(new ZeroAddressDestinationError(method, `call ${i}`)) : run(client, args);
    };
    return {
        deployContract: noTo('deployContract', deployContract as any),
        prepareTransactionRequest: byTo('prepareTransactionRequest', prepareTransactionRequest as any),
        fillTransaction: byTo('fillTransaction', fillTransaction as any),
        writeContract: byAddress('writeContract', writeContract as any),
        writeContractSync: byAddress('writeContractSync', writeContractSync as any),
        sendTransaction: byTo('sendTransaction', sendTransaction as any),
        sendTransactionSync: byTo('sendTransactionSync', sendTransactionSync as any),
        signTransaction: byTo('signTransaction', signTransaction as any),
        sendCalls: byCalls('sendCalls', sendCalls as any),
        sendCallsSync: byCalls('sendCallsSync', sendCallsSync as any),
    };
}
