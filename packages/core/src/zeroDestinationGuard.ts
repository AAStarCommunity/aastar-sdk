/**
 * Refuse, before anything is signed, a transaction whose destination is the zero address. An address book marks a
 * contract its deployment does not include with the zero address (e.g. sp550AddressSet for a coexisting stack), and an
 * action bound to it would otherwise build, sign and send a call there — with value or a token transfer, a burn.
 *
 * Applied as a viem client extension by the role-based client factories, so every action's write goes through it.
 *
 * Threat model (DSR 2026-11-19): an HONEST caller whose address set has a zero entry (the selected deployment does not
 * include that contract) must not send a transaction, or funds, to address zero by accident. It does not defend against
 * an adversary who controls the request object, the chain configuration or the process (those can send anywhere).
 */
import { deployContract, fillTransaction, prepareTransactionRequest, sendCalls, sendCallsSync, sendRawTransaction, sendRawTransactionSync, sendTransaction, sendTransactionSync, signTransaction, writeContract, writeContractSync } from 'viem/actions';
import { parseTransaction, type Client } from 'viem';

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
 * sendTransaction(Sync), sendCalls(Sync), signTransaction, prepareTransactionRequest, fillTransaction,
 * sendRawTransaction(Sync) — throws ZeroAddressDestinationError first when that destination is the zero address;
 * deployContract refuses any `to`. The request is copied once (plain data, no accessors) and that copy is both
 * checked and passed on, so what is checked is what viem receives.
 *
 * Trusted, not guarded: the client's chain configuration (a custom `chain.prepareTransactionRequest` or formatter can
 * rewrite a request after this check, as it can rewrite anything else — it is configuration, like the RPC URL), and
 * signAuthorization (EIP-7702 delegation, where the zero address means revoke, not a call).
 */
export function zeroDestinationGuard(client: Client) {
    // One snapshot of the caller's request: getters are read exactly once, and the batch's calls are copied too.
    const snap = (args: any): any => (args && typeof args === 'object'
        ? { ...args, ...(Array.isArray(args.calls) ? { calls: args.calls.map((c: any) => (c && typeof c === 'object' ? { ...c } : c)) } : {}) }
        : args);
    // A contract call's destination is `address`. viem spreads the rest of the request over { to: address }, so an extra
    // `to` would override the checked address (and viem's internal send is the unguarded one): a `to` field is refused.
    const byAddress = (method: string, run: (c: any, a: any) => Promise<any>) => (raw: any): Promise<any> => {
        const args = snap(raw);
        if (args?.to !== undefined) return Promise.reject(new ZeroAddressDestinationError(method, `${args.functionName ?? 'call'}: a contract call takes its destination from address, not to`));
        return isZeroAddress(args?.address) ? Promise.reject(new ZeroAddressDestinationError(method, args?.functionName)) : run(client, args);
    };
    // A deployment has no destination; viem spreads extra fields into a direct sendTransaction, so any `to` is refused.
    const noTo = (method: string, run: (c: any, a: any) => Promise<any>) => (raw: any): Promise<any> => {
        const args = snap(raw);
        return args?.to !== undefined ? Promise.reject(new ZeroAddressDestinationError(method, 'a deployment carries no to')) : run(client, args);
    };
    const byTo = (method: string, run: (c: any, a: any) => Promise<any>) => (raw: any): Promise<any> => {
        const args = snap(raw);
        return isZeroAddress(args?.to) ? Promise.reject(new ZeroAddressDestinationError(method)) : run(client, args);
    };
    const byCalls = (method: string, run: (c: any, a: any) => Promise<any>) => (raw: any): Promise<any> => {
        const args = snap(raw);
        const i = (args?.calls ?? []).findIndex((c: any) => isZeroAddress(c?.to));
        return i >= 0 ? Promise.reject(new ZeroAddressDestinationError(method, `call ${i}`)) : run(client, args);
    };
    // Bytes signed elsewhere: decoded, and refused when they would call the zero address.
    const byRaw = (method: string, run: (c: any, a: any) => Promise<any>) => (raw: any): Promise<any> => {
        const args = snap(raw);
        let to: unknown;
        try { to = parseTransaction(args?.serializedTransaction).to; }
        catch { return Promise.reject(new ZeroAddressDestinationError(method, 'unparseable serialized transaction')); }
        return isZeroAddress(to) ? Promise.reject(new ZeroAddressDestinationError(method)) : run(client, args);
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
        sendRawTransaction: byRaw('sendRawTransaction', sendRawTransaction as any),
        sendRawTransactionSync: byRaw('sendRawTransactionSync', sendRawTransactionSync as any),
        sendCalls: byCalls('sendCalls', sendCalls as any),
        sendCallsSync: byCalls('sendCallsSync', sendCallsSync as any),
    };
}
