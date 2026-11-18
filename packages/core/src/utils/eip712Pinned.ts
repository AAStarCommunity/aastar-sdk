import {
    type Abi, type Address, type Hash, type Hex, type PublicClient, type TypedDataDomain,
    decodeFunctionResult, domainSeparator, encodeFunctionData, isAddressEqual, keccak256, toHex,
} from 'viem';
import { GTokenAuthorizationABI } from '../abis/index.js';
import { AAStarError, ErrorCode } from '../errors/index.js';

/**
 * EIP-712 domains of contracts that do not expose the full pair `eip712Domain()` + `DOMAIN_SEPARATOR()`.
 *
 * {@link resolveEip712Domain} (./eip712Domain.ts) requires `DOMAIN_SEPARATOR()`. Two contracts the SDK signs for do
 * not have it today:
 * - MicroPaymentChannel exposes `eip712Domain()` only: its domain is taken as the contract reports it (EIP-5267),
 *   and checked against `DOMAIN_SEPARATOR()` only if that view exists.
 * - X402Facilitator exposes neither; its separator is computed in an internal function. Its domain is pinned
 *   ({ name: "X402Facilitator", version: "1" }, SP X402Facilitator.sol `_x402DomainSeparator`), and the deployed
 *   code at the address must contain the keccak256 of that name, that version, the EIP712Domain type string and the
 *   signed struct's type string. If the contract exposes `DOMAIN_SEPARATOR()` (SP plans to add it), that is compared
 *   as well.
 *
 * Every read is pinned to one block hash (EIP-1898, `requireCanonical`). Refusals carry `data.reason`.
 */

export type PinnedDomainRefusal =
    | 'chain-mismatch' | 'no-code' | 'block-unavailable' | 'no-eip712-domain' | 'unsupported-fields'
    | 'reported-chain-mismatch' | 'reported-contract-mismatch' | 'separator-mismatch' | 'code-lacks-domain-constants';

const fail = (reason: PinnedDomainRefusal, msg: string, extra: Record<string, unknown> = {}, cause?: unknown): never => {
    throw new AAStarError(ErrorCode.INVALID_CONFIGURATION, `${msg}; refusing to sign`, cause instanceof Error ? cause : undefined, { reason, ...extra });
};
const firstLine = (e: unknown) => {
    const m = (e as { message?: unknown } | null | undefined)?.message;
    return typeof m === 'string' ? m.split('\n')[0] : 'a non-Error rejection';
};

type Pin = { blockHash: Hash; requireCanonical: true };
const DOMAIN_TYPE = 'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';
const pick = (name: string) => (GTokenAuthorizationABI as any[]).find((e) => e.type === 'function' && e.name === name);
// eip712Domain() / DOMAIN_SEPARATOR() fragments from a vendored ABI (OpenZeppelin EIP712).
const READ_ABI = [pick('eip712Domain'), pick('DOMAIN_SEPARATOR')] as Abi;

async function pinLatest(client: PublicClient, expectedChainId?: number): Promise<{ chainId: number; pin: Pin }> {
    let chainId: number, hash: Hash;
    try {
        chainId = await client.getChainId();
        hash = (await client.getBlock()).hash!;
    } catch (e) {
        return fail('block-unavailable', `the latest block could not be read (${firstLine(e)})`, {}, e);
    }
    if (expectedChainId !== undefined && chainId !== expectedChainId) {
        fail('chain-mismatch', `the RPC is on chain ${chainId}, the signature is for chain ${expectedChainId}`, { chainId, expectedChainId });
    }
    return { chainId, pin: { blockHash: hash, requireCanonical: true } };
}

async function callAt<T>(client: PublicClient, to: Address, abi: Abi, functionName: string, pin: Pin): Promise<T> {
    const data = encodeFunctionData({ abi, functionName, args: [] } as any);
    const result = await client.request({ method: 'eth_call', params: [{ to, data }, pin] } as any) as Hex;
    return decodeFunctionResult({ abi, functionName, data: result } as any) as T;
}

// A contract-level revert (the view does not exist), as opposed to a transport or node failure.
const isRevert = (e: unknown): boolean => {
    for (let x: any = e, i = 0; x && i < 6; x = x.cause, i++) {
        if (x.code === 3 || /execution reverted|revert/i.test(String(x.message ?? ''))) return true;
    }
    return false;
};

/**
 * `DOMAIN_SEPARATOR()` at the pinned block, or undefined when the contract does not have it (the call reverts).
 * Any other failure refuses: a flaky node must not turn "checked" into "not present".
 */
async function separatorIfPresent(client: PublicClient, contract: Address, pin: Pin): Promise<Hex | undefined> {
    try {
        return await callAt<Hex>(client, contract, READ_ABI, 'DOMAIN_SEPARATOR', pin);
    } catch (e) {
        if (isRevert(e)) return undefined;
        return fail('block-unavailable', `DOMAIN_SEPARATOR() of ${contract} could not be read at block ${pin.blockHash} (${firstLine(e)})`, { address: contract }, e);
    }
}

async function codeAt(client: PublicClient, contract: Address, pin: Pin): Promise<Hex> {
    let code: Hex;
    try {
        code = await client.request({ method: 'eth_getCode', params: [contract, pin] } as any) as Hex;
    } catch (e) {
        return fail('block-unavailable', `state at block ${pin.blockHash} could not be read for ${contract} (${firstLine(e)})`, { address: contract }, e);
    }
    if (!code || code === '0x') fail('no-code', `${contract} has no code on this chain`, { address: contract });
    return code;
}

export type ReportedDomain = { domain: TypedDataDomain; separator: Hex; separatorChecked: boolean };

/**
 * The domain a contract reports through `eip712Domain()` (EIP-5267): its `fields` bitmap honoured, its chainId and
 * verifyingContract required to be the live chain and the contract. `separatorChecked` is true only when the
 * contract also exposes `DOMAIN_SEPARATOR()` and it matched; when it does not, the domain is the contract's own
 * report and nothing independent confirms it.
 */
export async function resolveReportedEip712Domain(
    client: PublicClient,
    contract: Address,
    opts: { expectedChainId?: number } = {},
): Promise<ReportedDomain> {
    const { chainId, pin } = await pinLatest(client, opts.expectedChainId);
    await codeAt(client, contract, pin);
    let reported: readonly [Hex, string, string, bigint, Address, Hex, readonly bigint[]];
    try {
        reported = await callAt(client, contract, READ_ABI, 'eip712Domain', pin);
    } catch (e) {
        return fail('no-eip712-domain', `${contract} does not answer eip712Domain() (${firstLine(e)})`, { address: contract }, e);
    }
    const [fields, name, version, reportedChainId, verifyingContract, salt, extensions] = reported;
    const bits = parseInt(fields, 16);
    if (extensions.length > 0 || bits & ~0x1f) fail('unsupported-fields', `${contract} reports EIP-5267 fields 0x${bits.toString(16)} / extensions this SDK does not support`, { address: contract });
    const domain: TypedDataDomain = {};
    if (bits & 0x01) domain.name = name;
    if (bits & 0x02) domain.version = version;
    if (bits & 0x04) {
        if (reportedChainId !== BigInt(chainId)) fail('reported-chain-mismatch', `${contract} reports chainId ${reportedChainId}, the RPC is on ${chainId}`, { address: contract });
        domain.chainId = chainId;
    }
    if (bits & 0x08) {
        if (!isAddressEqual(verifyingContract, contract)) fail('reported-contract-mismatch', `${contract} reports verifyingContract ${verifyingContract}`, { address: contract });
        domain.verifyingContract = contract;
    }
    if (bits & 0x10) domain.salt = salt;
    const separator = domainSeparator({ domain });
    const onChain = await separatorIfPresent(client, contract, pin);
    if (onChain !== undefined && onChain.toLowerCase() !== separator.toLowerCase()) {
        fail('separator-mismatch', `${contract}: eip712Domain() gives separator ${separator} but DOMAIN_SEPARATOR() is ${onChain}`, { address: contract });
    }
    return { domain, separator, separatorChecked: onChain !== undefined };
}

/**
 * A pinned { name, version } domain for a contract with no domain getters, checked against the deployed code: the
 * code must contain keccak256(name), keccak256(version), keccak256 of the EIP712Domain type string and keccak256 of
 * each of `typeStrings` (the signed structs). When the contract exposes `DOMAIN_SEPARATOR()`, it must equal the
 * pinned domain's separator. This shows the code commits to those constants; it does not prove how it uses them.
 */
export async function verifyPinnedEip712Domain(
    client: PublicClient,
    contract: Address,
    pinned: { name: string; version: string; typeStrings: readonly string[] },
    opts: { expectedChainId?: number } = {},
): Promise<{ domain: TypedDataDomain; separator: Hex; separatorChecked: boolean }> {
    const { chainId, pin } = await pinLatest(client, opts.expectedChainId);
    const code = (await codeAt(client, contract, pin)).toLowerCase();
    const constants = [pinned.name, pinned.version, DOMAIN_TYPE, ...pinned.typeStrings];
    const missing = constants.filter((c) => !code.includes(keccak256(toHex(c)).slice(2)));
    if (missing.length > 0) {
        fail('code-lacks-domain-constants', `the code at ${contract} does not contain keccak256 of ${missing.map((m) => JSON.stringify(m)).join(', ')}`, { address: contract });
    }
    const domain: TypedDataDomain = { name: pinned.name, version: pinned.version, chainId, verifyingContract: contract };
    const separator = domainSeparator({ domain });
    const onChain = await separatorIfPresent(client, contract, pin);
    if (onChain !== undefined && onChain.toLowerCase() !== separator.toLowerCase()) {
        fail('separator-mismatch', `${contract}: the pinned domain gives separator ${separator} but DOMAIN_SEPARATOR() is ${onChain}`, { address: contract });
    }
    return { domain, separator, separatorChecked: onChain !== undefined };
}
