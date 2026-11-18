import { type Abi, type Address, type Hash, type Hex, type PublicClient, isAddressEqual, encodeFunctionData, decodeFunctionResult } from 'viem';
import { getCanonicalAddresses } from '../addresses.js';
import { SimpleAccountFactoryABI, SimpleAccountABI } from '../abis/index.js';
import { AAStarError, ErrorCode } from '../errors/index.js';

/**
 * Per-chain deployment inputs that used to have a cross-chain default, resolved from the address book
 * by chainId and checked on the chain before use.
 *
 * Both defaults were testnet values that look fine on mainnet until something breaks: the ETH/USD feed
 * default was Sepolia's Chainlink feed (no code on OP Mainnet), and the account-factory default was the
 * EntryPoint v0.6 SimpleAccountFactory (it has code on every chain, so only reading its implementation's
 * entryPoint() shows that it builds v0.6 accounts while the SDK uses v0.7).
 */

/**
 * Every refusal carries a fixed `data.reason` (and, for an EntryPoint mismatch, the value read from the chain), so a
 * caller or a report can tell refusals apart without parsing messages that may embed provider text.
 */
export type DeploymentInputRefusal =
    | 'chain-mismatch' | 'signing-chain-unbound' | 'no-feed-in-book' | 'no-factory-in-book' | 'stale-head'
    | 'no-code' | 'not-an-aggregator' | 'wrong-decimals' | 'wrong-description' | 'non-positive-answer' | 'stale-feed'
    | 'no-account-implementation' | 'entrypoint-mismatch' | 'block-unavailable'
    | 'json-rpc-account' | 'tx-chain-unconfirmed' | 'tx-reverted' | 'tx-not-canonical';

const fail = (reason: DeploymentInputRefusal, msg: string, extra: Record<string, unknown> = {}, cause?: unknown): never => {
    throw new AAStarError(ErrorCode.INVALID_CONFIGURATION, msg, cause instanceof Error ? cause : undefined, { reason, ...extra });
};

// Reads pinned to one block HASH with EIP-1898 (`requireCanonical`), so every answer comes from the same state;
// viem's readContract/getCode only take a block number. A node without EIP-1898 support fails the read.
type Pin = { blockHash: Hash; requireCanonical: true };
const codeAt = async (client: PublicClient, address: Address, pin: Pin): Promise<Hex> =>
    client.request({ method: 'eth_getCode', params: [address, pin] } as any) as Promise<Hex>;
const callAt = async <T>(client: PublicClient, to: Address, abi: Abi, functionName: string, pin: Pin): Promise<T> => {
    const data = encodeFunctionData({ abi, functionName, args: [] } as any);
    const result = await client.request({ method: 'eth_call', params: [{ to, data }, pin] } as any) as Hex;
    return decodeFunctionResult({ abi, functionName, data: result } as any) as T;
};
const hasCode = async (client: PublicClient, address: Address, pin: Pin) => {
    let code: Hex;
    try {
        code = await codeAt(client, address, pin);
    } catch (e) {
        // An orphaned block (requireCanonical), a pruned state, or no EIP-1898 support: nothing can be checked.
        return fail('block-unavailable', `state at block ${pin.blockHash} could not be read for ${address} (${(e as Error).message.split('\n')[0]})`, { address }, e);
    }
    return code !== undefined && code !== '0x';
};

/**
 * The chain id both clients are on: the one that reads (and checks) and the one that signs. Different chains
 * throw. The signing client must also have a configured `chain` with that id. For a local account viem signs that
 * chain id into the transaction, so the send is bound to it. For a JSON-RPC account viem re-reads `eth_chainId`
 * before `eth_sendTransaction` but does not put the chain id in the request (viem 2.43.3), so a wallet that
 * switches chains between that read and the send is not caught.
 */
export async function assertSameChain(
    reader: { getChainId: () => Promise<number> },
    writer: { getChainId: () => Promise<number>; chain?: { id: number } },
): Promise<number> {
    const [r, w] = await Promise.all([reader.getChainId(), writer.getChainId()]);
    if (r !== w) fail('chain-mismatch', `the reading client is on chain ${r} but the signing client is on chain ${w}; refusing to continue`, { reader: r, writer: w });
    if (writer.chain?.id !== r) fail('signing-chain-unbound', `the signing client has no configured chain ${r} (it has ${writer.chain?.id ?? 'none'}), so the send would not be bound to the checked chain; refusing to continue`);
    return r;
}

// Chainlink AggregatorV3Interface (third-party; no Chainlink ABI is vendored in @aastar/core).
const AGGREGATOR_V3_ABI = [
    { type: 'function', name: 'decimals', inputs: [], outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view' },
    { type: 'function', name: 'description', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' },
    {
        type: 'function', name: 'latestRoundData', inputs: [], stateMutability: 'view',
        outputs: [
            { name: 'roundId', type: 'uint80' }, { name: 'answer', type: 'int256' }, { name: 'startedAt', type: 'uint256' },
            { name: 'updatedAt', type: 'uint256' }, { name: 'answeredInRound', type: 'uint80' },
        ],
    },
] as const;

/** Default freshness bound for the ETH/USD feed: Chainlink's ETH/USD heartbeat is 3600 s or less on the supported chains. */
export const ETH_USD_FEED_MAX_AGE_SECONDS = 3600;
/** How far the RPC's latest block may lag the wall clock before its state is not trusted for a live deployment. */
export const MAX_HEAD_LAG_SECONDS = 600;

/** The ETH/USD feed for `chainId`: the caller's value, else the address book's; neither → throws. */
export function resolveEthUsdFeedAddress(chainId: number, explicit?: Address): Address {
    if (explicit) return explicit;
    const fromBook = getCanonicalAddresses(chainId)?.priceFeed as Address | undefined;
    if (!fromBook) fail('no-feed-in-book', `no ETH/USD price feed for chain ${chainId} in the address book; pass ethUsdPriceFeedAddress`);
    return fromBook!;
}

/**
 * Check `feed` on the chain before it is written into a deployment: it has code, `decimals() == 8`,
 * `description() == "ETH / USD"`, a positive answer, and `updatedAt` within `maxAgeSeconds` of the latest
 * block's timestamp. Pass the staleness threshold the deployment itself will enforce as `maxAgeSeconds`.
 * All reads are pinned to that block's hash (EIP-1898, `requireCanonical`), and the block must be within
 * `maxHeadLagSeconds` of the wall clock (`Infinity` for a deliberately historical fork).
 *
 * What this does not establish: that the contract IS Chainlink's feed (any contract can answer these reads),
 * L2 sequencer health, or anything after this block. The address-book default is the trusted source; an
 * address the caller passes is the caller's to trust.
 */
export async function verifyEthUsdFeed(
    client: PublicClient,
    feed: Address,
    opts: { maxAgeSeconds?: number; maxHeadLagSeconds?: number; nowSeconds?: () => number } = {},
): Promise<{ decimals: number; description: string; answer: bigint; updatedAt: bigint }> {
    const maxAge = BigInt(opts.maxAgeSeconds ?? ETH_USD_FEED_MAX_AGE_SECONDS);
    const where = `ETH/USD feed ${feed}`;
    const block = await client.getBlock();
    const wall = opts.nowSeconds ? opts.nowSeconds() : Math.floor(Date.now() / 1000);
    const lag = wall - Number(block.timestamp);
    const maxLag = opts.maxHeadLagSeconds ?? MAX_HEAD_LAG_SECONDS;
    if (lag > maxLag) fail('stale-head', `the RPC's latest block ${block.number} is ${lag}s behind the clock (max ${maxLag}s); refusing to deploy`);
    const pin: Pin = { blockHash: block.hash!, requireCanonical: true };
    if (!(await hasCode(client, feed, pin))) fail('no-code', `${where} has no code on this chain; refusing to deploy`, { address: feed });
    let decimals: number, description: string, round: readonly [bigint, bigint, bigint, bigint, bigint];
    try {
        [decimals, description, round] = await Promise.all([
            callAt<number>(client, feed, AGGREGATOR_V3_ABI as unknown as Abi, 'decimals', pin),
            callAt<string>(client, feed, AGGREGATOR_V3_ABI as unknown as Abi, 'description', pin),
            callAt<readonly [bigint, bigint, bigint, bigint, bigint]>(client, feed, AGGREGATOR_V3_ABI as unknown as Abi, 'latestRoundData', pin),
        ]);
    } catch (e) {
        return fail('not-an-aggregator', `${where} could not be read as a Chainlink aggregator at block ${block.hash} (${(e as Error).message.split('\n')[0]}); refusing to deploy`, { address: feed }, e);
    }
    if (Number(decimals) !== 8) fail('wrong-decimals', `${where} reports decimals ${decimals}, expected 8; refusing to deploy`);
    if (description !== 'ETH / USD') fail('wrong-description', `${where} reports description ${JSON.stringify(description)}, expected "ETH / USD"; refusing to deploy`);
    const [, answer, , updatedAt] = round;
    if (answer <= 0n) fail('non-positive-answer', `${where} reports a non-positive answer ${answer}; refusing to deploy`);
    const now = block.timestamp;
    if (updatedAt === 0n || updatedAt > now || now - updatedAt > maxAge) {
        fail('stale-feed', `${where} last updated at ${updatedAt}, block time ${now} (max age ${maxAge}s); refusing to deploy`);
    }
    return { decimals: Number(decimals), description, answer, updatedAt };
}

/** The SimpleAccountFactory for `chainId`: the caller's value, else the address book's; neither → throws. */
export function resolveAccountFactoryAddress(chainId: number, explicit?: Address): Address {
    if (explicit && !isAddressEqual(explicit, '0x0000000000000000000000000000000000000000')) return explicit;
    const fromBook = getCanonicalAddresses(chainId)?.simpleAccountFactory as Address | undefined;
    if (!fromBook) fail('no-factory-in-book', `no simpleAccountFactory for chain ${chainId} in the address book; pass the factory address`);
    return fromBook!;
}

/**
 * Check that `factory` builds accounts for `entryPoint`: it has code, and its `accountImplementation()`
 * reports `entryPoint()` equal to `entryPoint`, all read at one block hash (EIP-1898). A v0.6 factory with a v0.7 EntryPoint
 * throws, naming both. This checks what the factory reports, not what `createAccount` will deploy.
 */
export async function verifyAccountFactory(client: PublicClient, factory: Address, entryPoint: Address): Promise<{ implementation: Address }> {
    const block = await client.getBlock();
    const pin: Pin = { blockHash: block.hash!, requireCanonical: true };
    if (!(await hasCode(client, factory, pin))) fail('no-code', `account factory ${factory} has no code on this chain`, { address: factory });
    let implementation: Address, implEntryPoint: Address;
    try {
        implementation = await callAt<Address>(client, factory, SimpleAccountFactoryABI as Abi, 'accountImplementation', pin);
        implEntryPoint = await callAt<Address>(client, implementation, SimpleAccountABI as Abi, 'entryPoint', pin);
    } catch (e) {
        return fail('no-account-implementation', `account factory ${factory}: accountImplementation().entryPoint() could not be read at block ${block.hash} (${(e as Error).message.split('\n')[0]})`, { address: factory }, e);
    }
    if (!isAddressEqual(implEntryPoint, entryPoint)) {
        fail('entrypoint-mismatch', `account factory ${factory} builds accounts for EntryPoint ${implEntryPoint}, but the SDK is configured for ${entryPoint}`, { address: factory, reported: implEntryPoint, expected: entryPoint });
    }
    return { implementation };
}

/**
 * Live-key deployment paths accept a local account (private key / keystore) by default. A JSON-RPC account (a
 * browser or node-managed wallet) is refused unless the caller opts in with `allowJsonRpcAccount: true`, because viem
 * 2.43.3 sends `eth_sendTransaction` without a chainId: a wallet that switches chains between viem's eth_chainId read
 * and the send puts the transaction on the new chain. {@link confirmSentOnChain} then stops the flow, but cannot undo
 * that transaction. Opting in logs this once per process.
 */
let jsonRpcWarned = false;
export function requireLocalSigner(
    account: { type?: string } | string | undefined,
    opts: { allowJsonRpcAccount?: boolean; path: string },
): void {
    const isLocal = typeof account === 'object' && account?.type === 'local';
    if (isLocal) return;
    if (!opts.allowJsonRpcAccount) {
        fail('json-rpc-account', `${opts.path}: the signer is not a local account; a JSON-RPC wallet's send is not bound to the checked chain (viem sends eth_sendTransaction without a chainId). Use a local/keystore account, or pass allowJsonRpcAccount: true to accept that window`, { path: opts.path });
    }
    if (!jsonRpcWarned) {
        jsonRpcWarned = true;
        console.warn(`[aastar] ${opts.path}: allowJsonRpcAccount is set. A wallet that switches chains between the chain check and eth_sendTransaction can send on another chain; the SDK stops after such a send but cannot prevent it.`);
    }
}

/**
 * After every send, before the next step: the transaction's receipt must be found through the client of the
 * checked chain, that client must still report `chainId`, the receipt must be successful, and its block must be
 * the canonical one at that height. Otherwise the flow stops: the transaction may have gone to another chain, or
 * may not be final there.
 */
export async function confirmSentOnChain(
    client: PublicClient,
    hash: Hash,
    chainId: number,
    opts: { timeoutMs?: number; confirmations?: number } = {},
): Promise<{ blockNumber: bigint; blockHash: Hash }> {
    const onChain = async () => {
        const now = await client.getChainId();
        if (now !== chainId) fail('tx-chain-unconfirmed', `transaction ${hash}: the checked client is now on chain ${now}, not ${chainId}; stopping (it may have been sent on another chain)`, { hash, chainId, now });
    };
    await onChain();
    let receipt: { status: string; blockNumber: bigint; blockHash: Hash };
    try {
        receipt = await client.waitForTransactionReceipt({ hash, timeout: opts.timeoutMs ?? 300_000, confirmations: opts.confirmations }) as any;
    } catch (e) {
        return fail('tx-chain-unconfirmed', `transaction ${hash} has no receipt on chain ${chainId}; stopping (it may have been sent on another chain)`, { hash, chainId }, e);
    }
    if (receipt.status !== 'success') fail('tx-reverted', `transaction ${hash} reverted on chain ${chainId}; stopping`, { hash, chainId });
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    if (block.hash !== receipt.blockHash) fail('tx-not-canonical', `transaction ${hash}'s block ${receipt.blockNumber} is no longer canonical on chain ${chainId}; stopping`, { hash, chainId });
    await onChain();
    return { blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
}
