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

/** Why a request was refused: the reason decides the wording (only 'zero' is about a missing contract). */
export type ZeroDestinationReason = 'zero' | 'no-destination' | 'not-plain' | 'conflicting-to' | 'unreadable-raw';
const REASON: Record<ZeroDestinationReason, string> = {
    'zero': 'to the zero address: the selected deployment does not include that contract',
    'no-destination': 'with no destination (a missing address-book entry would make it a contract creation)',
    'not-plain': 'with a request that is not a plain object (its copy would not be what viem reads)',
    'conflicting-to': 'with a `to` field the destination is not taken from',
    'unreadable-raw': "with a serialized transaction viem's generic parser does not read (e.g. a ZKsync 0x71 transaction)",
};

export class ZeroAddressDestinationError extends Error {
    constructor(readonly method: string, readonly functionName?: string, readonly reason: ZeroDestinationReason = 'zero') {
        super(`refusing ${method}${functionName ? ` ${functionName}` : ''} ${REASON[reason]}; nothing was signed or sent`);
        this.name = 'ZeroAddressDestinationError';
    }
}

/** True for an address that names "not deployed". */
export const isZeroAddress = (a: unknown): boolean => typeof a === 'string' && ZERO.test(a);

/**
 * viem extension: every wallet action that builds, signs or sends a call to a destination — writeContract(Sync),
 * sendTransaction(Sync), sendCalls(Sync), signTransaction, prepareTransactionRequest, fillTransaction,
 * sendRawTransaction(Sync) — throws ZeroAddressDestinationError first when that destination is the zero address;
 * deployContract refuses any `to`; a contract write without an address is refused. Requests must be plain objects
 * (a class instance or Object.create(...) is refused): for a plain object the one copy that is checked is the one viem
 * receives. Raw transactions viem's generic parser cannot read (e.g. ZKsync 0x71) are refused, not sent.
 *
 * Trusted, not guarded: the client's chain configuration (a custom `chain.prepareTransactionRequest` or formatter can
 * rewrite a request after this check, as it can rewrite anything else — it is configuration, like the RPC URL), and
 * signAuthorization (EIP-7702 delegation, where the zero address means revoke, not a call).
 */
export function zeroDestinationGuard(client: Client) {
    // One copy of the caller's request, checked and passed on. Only a PLAIN object is accepted (prototype
    // Object.prototype or null): a copy of a class instance or an Object.create(...) request would drop the inherited
    // fields viem reads (e.g. a `to` getter), turning a call into a contract creation (clestons #466 B1).
    // Plain = prototype Object.prototype or null AND every own key enumerable (string or symbol): a spread copies exactly
    // the own enumerable keys, so only then is the copy all that viem can read (clestons #466 B2: a non-enumerable `to`).
    const plain = (o: object) => {
        const p = Object.getPrototypeOf(o);
        return (p === Object.prototype || p === null) && Reflect.ownKeys(o).every((k) => Object.prototype.propertyIsEnumerable.call(o, k));
    };
    const snap = (method: string) => (args: any): any => {
        if (args === undefined || args === null || typeof args !== 'object') return args;
        if (!plain(args)) throw new ZeroAddressDestinationError(method, 'pass a plain object (no class instance, Object.create or non-enumerable fields)', 'not-plain');
        const copy = { ...args };
        if (copy.calls !== undefined) {
            if (!Array.isArray(copy.calls)) throw new ZeroAddressDestinationError(method, 'calls must be an array', 'not-plain');
            copy.calls = Array.from(copy.calls, (c: any, i: number) => {
                if (!c || typeof c !== 'object' || !plain(c)) throw new ZeroAddressDestinationError(method, `call ${i}: pass a plain object`, 'not-plain');
                return { ...c };
            });
        }
        return copy;
    };
    // A contract call's destination is `address`. viem spreads the rest of the request over { to: address }, so an extra
    // `to` would override the checked address (and viem's internal send is the unguarded one): a `to` field is refused.
    const byAddress = (method: string, run: (c: any, a: any) => Promise<any>) => (raw: any): Promise<any> => {
        let args: any;
        try { args = snap(method)(raw); } catch (e) { return Promise.reject(e); }
        if (args?.to !== undefined) return Promise.reject(new ZeroAddressDestinationError(method, `${args.functionName ?? 'call'}: a contract call takes its destination from address`, 'conflicting-to'));
        // A missing address (a book key absent) would make viem send a contract creation: refused like zero.
        if (typeof args?.address !== 'string') return Promise.reject(new ZeroAddressDestinationError(method, args?.functionName, 'no-destination'));
        return isZeroAddress(args.address) ? Promise.reject(new ZeroAddressDestinationError(method, args?.functionName)) : run(client, args);
    };
    // A deployment has no destination; viem spreads extra fields into a direct sendTransaction, so any `to` is refused.
    const noTo = (method: string, run: (c: any, a: any) => Promise<any>) => (raw: any): Promise<any> => {
        let args: any;
        try { args = snap(method)(raw); } catch (e) { return Promise.reject(e); }
        return args?.to !== undefined ? Promise.reject(new ZeroAddressDestinationError(method, 'a deployment carries no to', 'conflicting-to')) : run(client, args);
    };
    const byTo = (method: string, run: (c: any, a: any) => Promise<any>) => (raw: any): Promise<any> => {
        let args: any;
        try { args = snap(method)(raw); } catch (e) { return Promise.reject(e); }
        return isZeroAddress(args?.to) ? Promise.reject(new ZeroAddressDestinationError(method)) : run(client, args);
    };
    const byCalls = (method: string, run: (c: any, a: any) => Promise<any>) => (raw: any): Promise<any> => {
        let args: any;
        try { args = snap(method)(raw); } catch (e) { return Promise.reject(e); }
        const calls: any[] = args?.calls ?? [];
        // A call without a destination would be a contract creation (viem's Call type requires `to`): refused, like a missing address.
        const noTo = calls.findIndex((c) => typeof c?.to !== 'string');
        if (noTo >= 0) return Promise.reject(new ZeroAddressDestinationError(method, `call ${noTo}`, 'no-destination'));
        const i = calls.findIndex((c) => isZeroAddress(c?.to));
        return i >= 0 ? Promise.reject(new ZeroAddressDestinationError(method, `call ${i}`)) : run(client, args);
    };
    // Bytes signed elsewhere: decoded, and refused when they would call the zero address.
    const byRaw = (method: string, run: (c: any, a: any) => Promise<any>) => (raw: any): Promise<any> => {
        let args: any;
        try { args = snap(method)(raw); } catch (e) { return Promise.reject(e); }
        let to: unknown;
        try { to = parseTransaction(args?.serializedTransaction).to; }
        catch { return Promise.reject(new ZeroAddressDestinationError(method, undefined, 'unreadable-raw')); }
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
