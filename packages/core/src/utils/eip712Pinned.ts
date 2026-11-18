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
 * (X402Facilitator exposes neither getter; @aastar/x402's verifyFacilitatorDomain asks its verifier instead.)
 *
 * Every read is pinned to one block hash (EIP-1898, `requireCanonical`). Refusals carry `data.reason`.
 */

export type PinnedDomainRefusal =
    | 'chain-mismatch' | 'no-code' | 'block-unavailable' | 'no-eip712-domain' | 'unsupported-fields'
    | 'reported-chain-mismatch' | 'reported-contract-mismatch' | 'separator-mismatch';

const fail = (reason: PinnedDomainRefusal, msg: string, extra: Record<string, unknown> = {}, cause?: unknown): never => {
    throw new AAStarError(ErrorCode.INVALID_CONFIGURATION, `${msg}; refusing to sign`, cause instanceof Error ? cause : undefined, { reason, ...extra });
};
const firstLine = (e: unknown) => {
    const m = (e as { message?: unknown } | null | undefined)?.message;
    return typeof m === 'string' ? m.split('\n')[0] : 'a non-Error rejection';
};

type Pin = { blockHash: Hash; requireCanonical: true };
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

// An execution revert with no revert data (what a call to a selector the contract does not have produces), decided
// only from the structured JSON-RPC error (code 3), never from message text.
const isEmptyRevert = (e: unknown): boolean => {
    for (let x: any = e, i = 0; x && i < 8; x = x.cause, i++) {
        if (x.code !== 3) continue;
        const d = typeof x.data === 'string' ? x.data : typeof x.data?.data === 'string' ? x.data.data : undefined;
        return d === undefined || d === '0x';
    }
    return false;
};

/**
 * `DOMAIN_SEPARATOR()` at the pinned block. "Absent" (undefined) only when the caller says the contract may lack the
 * view AND the call is an execution revert with no revert data (a missing selector). A getter that exists and
 * reverts (with data), any other failure, or a revert where absence was not allowed, refuses.
 */
async function separatorIfPresent(client: PublicClient, contract: Address, pin: Pin, mayLackSeparator: boolean): Promise<Hex | undefined> {
    try {
        return await callAt<Hex>(client, contract, READ_ABI, 'DOMAIN_SEPARATOR', pin);
    } catch (e) {
        if (mayLackSeparator && isEmptyRevert(e)) return undefined;
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

export type ReportedDomain = { domain: TypedDataDomain; separator: Hex; separatorChecked: boolean; blockHash: Hash };

/**
 * The domain a contract reports through `eip712Domain()` (EIP-5267): its `fields` bitmap honoured, its chainId and
 * verifyingContract, when present, required to be the live chain and the contract. `DOMAIN_SEPARATOR()` must be readable
 * and match, unless the caller passes `mayLackSeparator` for a contract known not to have it (MicroPaymentChannel):
 * then a missing selector (empty revert) gives `separatorChecked: false`, and the domain is the contract's own report. `blockHash` is the block every read was pinned to, for callers that
 * read more from the same contract (e.g. a type hash) and must read it from the same state.
 */
export async function resolveReportedEip712Domain(
    client: PublicClient,
    contract: Address,
    opts: { expectedChainId?: number; mayLackSeparator?: boolean } = {},
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
    const onChain = await separatorIfPresent(client, contract, pin, opts.mayLackSeparator === true);
    if (onChain !== undefined && onChain.toLowerCase() !== separator.toLowerCase()) {
        fail('separator-mismatch', `${contract}: eip712Domain() gives separator ${separator} but DOMAIN_SEPARATOR() is ${onChain}`, { address: contract });
    }
    return { domain, separator, separatorChecked: onChain !== undefined, blockHash: pin.blockHash };
}
