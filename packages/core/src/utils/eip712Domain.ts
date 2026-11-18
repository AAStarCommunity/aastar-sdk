import { type Address, type Hex, type PublicClient, type TypedDataDomain, domainSeparator, isAddressEqual } from 'viem';
import { GTokenAuthorizationABI, BuyHelperABI } from '../abis/index.js';
import { AAStarError, ErrorCode } from '../errors/index.js';

/**
 * Read a contract's EIP-712 domain from the chain instead of hard-coding it.
 *
 * Hard-coded domains fail silently: the SDK signs, the contract rejects. USDC is the case that
 * forced this: its domain name is "USDC" on Sepolia / OP Sepolia but "USD Coin" on OP Mainnet,
 * so a `{ name: 'USDC', version: '2' }` default signs authorizations that only testnets accept.
 *
 * How the domain is obtained, in order:
 * 1. `eip712Domain()` (EIP-5267), honouring its `fields` bitmap.
 * 2. Otherwise the contract's name and version getters (`name()`/`version()`, or `NAME()`/`VERSION()`
 *    with `getters: 'constants'`), with the live `eth_chainId` and the contract address.
 *
 * Either way the local separator must equal the contract's `DOMAIN_SEPARATOR()`; a mismatch, or a
 * getter that cannot be read, throws and nothing is signed. There is no default value anywhere.
 * `expected` (e.g. a configured token name) is checked against what the chain reports and throws on
 * a difference; it never replaces the chain's value.
 *
 * Results are cached per (chainId, contract, getters) only after the separator check passed. The cache
 * lives for the process; a proxy upgrade that renames a token is picked up after a restart or
 * {@link clearEip712DomainCache}.
 */
export type ResolvedEip712Domain = {
    domain: TypedDataDomain;
    separator: Hex;
    source: 'eip5267' | 'getters';
};

export type ResolveEip712DomainOptions = {
    /** Which getters to use when `eip712Domain()` is not exposed. Default `'erc20'` (`name()`/`version()`). */
    getters?: 'erc20' | 'constants';
    /** Values the caller expects (e.g. from configuration). A difference from the chain throws. */
    expected?: { name?: string; version?: string };
};

const pick = (abi: readonly any[], name: string) => {
    const item = abi.find((e: any) => e.type === 'function' && e.name === name);
    if (!item) throw new Error(`vendored ABI has no ${name}()`);
    return item;
};
// Fragments taken from vendored ABIs: eip712Domain/DOMAIN_SEPARATOR/name/version from
// GTokenAuthorization (OpenZeppelin EIP712 + ERC20), NAME/VERSION from BuyHelper.
const DOMAIN_READ_ABI = [
    pick(GTokenAuthorizationABI, 'eip712Domain'),
    pick(GTokenAuthorizationABI, 'DOMAIN_SEPARATOR'),
    pick(GTokenAuthorizationABI, 'name'),
    pick(GTokenAuthorizationABI, 'version'),
    pick(BuyHelperABI, 'NAME'),
    pick(BuyHelperABI, 'VERSION'),
] as const;

const cache = new Map<string, ResolvedEip712Domain>();

/** Drop every cached domain (tests, or after a known proxy upgrade). */
export function clearEip712DomainCache(): void {
    cache.clear();
}

export async function resolveEip712Domain(
    client: PublicClient,
    contract: Address,
    opts: ResolveEip712DomainOptions = {},
): Promise<ResolvedEip712Domain> {
    const getters = opts.getters ?? 'erc20';
    const chainId = await client.getChainId();
    const key = `${chainId}:${contract.toLowerCase()}:${getters}`;
    const fail = (msg: string, cause?: unknown): never => {
        const detail = cause instanceof Error ? ` (${cause.message.split('\n')[0]})` : '';
        throw new AAStarError(ErrorCode.INVALID_CONFIGURATION, `EIP-712 domain of ${contract} on chain ${chainId}: ${msg}${detail}; refusing to sign`);
    };
    const read = <T>(functionName: string) =>
        client.readContract({ address: contract, abi: DOMAIN_READ_ABI as any, functionName, args: [] }) as Promise<T>;

    let resolved = cache.get(key);
    if (!resolved) {
        let domain: TypedDataDomain;
        let source: ResolvedEip712Domain['source'];
        let reported: readonly [Hex, string, string, bigint, Address, Hex, readonly bigint[]] | undefined;
        try {
            reported = await read('eip712Domain');
        } catch {
            reported = undefined; // not exposed (or unreadable): the getters below are still checked against DOMAIN_SEPARATOR
        }
        if (reported) {
            const [fields, name, version, reportedChainId, verifyingContract, salt, extensions] = reported;
            const bits = parseInt(fields, 16);
            if (extensions.length > 0) fail('eip712Domain() reports extensions, which this SDK does not support');
            if (bits & ~0x1f) fail(`eip712Domain() reports unknown fields 0x${bits.toString(16)}`);
            domain = {};
            if (bits & 0x01) domain.name = name;
            if (bits & 0x02) domain.version = version;
            if (bits & 0x04) {
                if (reportedChainId !== BigInt(chainId)) fail(`eip712Domain() reports chainId ${reportedChainId}, the RPC is on ${chainId}`);
                domain.chainId = chainId;
            }
            if (bits & 0x08) {
                if (!isAddressEqual(verifyingContract, contract)) fail(`eip712Domain() reports verifyingContract ${verifyingContract}`);
                domain.verifyingContract = contract;
            }
            if (bits & 0x10) domain.salt = salt;
            source = 'eip5267';
        } else {
            const [nameFn, versionFn] = getters === 'constants' ? ['NAME', 'VERSION'] : ['name', 'version'];
            let name: string, version: string;
            try {
                [name, version] = await Promise.all([read<string>(nameFn), read<string>(versionFn)]);
            } catch (e) {
                return fail(`neither eip712Domain() nor ${nameFn}()/${versionFn}() could be read`, e);
            }
            domain = { name, version, chainId, verifyingContract: contract };
            source = 'getters';
        }

        let onChain: Hex;
        try {
            onChain = await read<Hex>('DOMAIN_SEPARATOR');
        } catch (e) {
            return fail('DOMAIN_SEPARATOR() could not be read, so the domain cannot be checked', e);
        }
        const separator = domainSeparator({ domain });
        if (separator.toLowerCase() !== onChain.toLowerCase()) {
            fail(`local separator ${separator} for ${JSON.stringify(domain)} does not match DOMAIN_SEPARATOR() ${onChain}`);
        }
        resolved = { domain, separator, source };
        cache.set(key, resolved);
    }

    const { expected } = opts;
    if (expected?.name !== undefined && expected.name !== resolved.domain.name) {
        fail(`expected name ${JSON.stringify(expected.name)}, the contract's domain has ${JSON.stringify(resolved.domain.name)}`);
    }
    if (expected?.version !== undefined && expected.version !== resolved.domain.version) {
        fail(`expected version ${JSON.stringify(expected.version)}, the contract's domain has ${JSON.stringify(resolved.domain.version)}`);
    }
    // A copy, so a caller mutating the domain cannot change what later callers get from the cache.
    return { ...resolved, domain: { ...resolved.domain } };
}
