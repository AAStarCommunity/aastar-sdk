import { type Address, type PublicClient, isAddressEqual } from 'viem';
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

const fail = (msg: string): never => {
    throw new AAStarError(ErrorCode.INVALID_CONFIGURATION, msg);
};

const hasCode = async (client: PublicClient, address: Address, blockNumber?: bigint) => {
    const code = await client.getCode({ address, blockNumber });
    return code !== undefined && code !== '0x';
};

/**
 * The chain id both clients are on: the one that reads (and checks) and the one that signs. Different chains
 * throw. The signing client must also have a configured `chain` with that id: viem's writeContract passes it and
 * re-checks `eth_chainId` against it at send time, so a wallet that switches chains after this check fails to send
 * instead of sending on the new chain.
 */
export async function assertSameChain(
    reader: { getChainId: () => Promise<number> },
    writer: { getChainId: () => Promise<number>; chain?: { id: number } },
): Promise<number> {
    const [r, w] = await Promise.all([reader.getChainId(), writer.getChainId()]);
    if (r !== w) fail(`the reading client is on chain ${r} but the signing client is on chain ${w}; refusing to continue`);
    if (writer.chain?.id !== r) fail(`the signing client has no configured chain ${r} (it has ${writer.chain?.id ?? 'none'}), so the send would not be bound to the checked chain; refusing to continue`);
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
    if (!fromBook) fail(`no ETH/USD price feed for chain ${chainId} in the address book; pass ethUsdPriceFeedAddress`);
    return fromBook!;
}

/**
 * Check `feed` on the chain before it is written into a deployment: it has code, `decimals() == 8`,
 * `description() == "ETH / USD"`, a positive answer, and `updatedAt` within `maxAgeSeconds` of the latest
 * block's timestamp. Pass the staleness threshold the deployment itself will enforce as `maxAgeSeconds`.
 * All reads are pinned to that one block, and the block must be within `maxHeadLagSeconds` of the wall clock
 * (`Infinity` for a deliberately historical fork).
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
    if (lag > maxLag) fail(`the RPC's latest block ${block.number} is ${lag}s behind the clock (max ${maxLag}s); refusing to deploy`);
    const blockNumber = block.number!;
    // Reads are pinned by number; the block hash is read again afterwards, so a reorg at that height during the
    // check (different state under the same number) throws instead of mixing two states.
    const sameBlock = async () => {
        const again = await client.getBlock({ blockNumber });
        if (again.hash !== block.hash) fail(`block ${blockNumber} changed from ${block.hash} to ${again.hash} during the check; refusing to deploy`);
    };
    if (!(await hasCode(client, feed, blockNumber))) fail(`${where} has no code on this chain; refusing to deploy`);
    let decimals: number, description: string, round: readonly [bigint, bigint, bigint, bigint, bigint];
    try {
        [decimals, description, round] = await Promise.all([
            client.readContract({ address: feed, abi: AGGREGATOR_V3_ABI, functionName: 'decimals', blockNumber }) as Promise<number>,
            client.readContract({ address: feed, abi: AGGREGATOR_V3_ABI, functionName: 'description', blockNumber }) as Promise<string>,
            client.readContract({ address: feed, abi: AGGREGATOR_V3_ABI, functionName: 'latestRoundData', blockNumber }) as Promise<readonly [bigint, bigint, bigint, bigint, bigint]>,
        ]);
    } catch (e) {
        return fail(`${where} could not be read as a Chainlink aggregator (${(e as Error).message.split('\n')[0]}); refusing to deploy`);
    }
    if (Number(decimals) !== 8) fail(`${where} reports decimals ${decimals}, expected 8; refusing to deploy`);
    if (description !== 'ETH / USD') fail(`${where} reports description ${JSON.stringify(description)}, expected "ETH / USD"; refusing to deploy`);
    const [, answer, , updatedAt] = round;
    if (answer <= 0n) fail(`${where} reports a non-positive answer ${answer}; refusing to deploy`);
    await sameBlock();
    const now = block.timestamp;
    if (updatedAt === 0n || updatedAt > now || now - updatedAt > maxAge) {
        fail(`${where} last updated at ${updatedAt}, block time ${now} (max age ${maxAge}s); refusing to deploy`);
    }
    return { decimals: Number(decimals), description, answer, updatedAt };
}

/** The SimpleAccountFactory for `chainId`: the caller's value, else the address book's; neither → throws. */
export function resolveAccountFactoryAddress(chainId: number, explicit?: Address): Address {
    if (explicit && !isAddressEqual(explicit, '0x0000000000000000000000000000000000000000')) return explicit;
    const fromBook = getCanonicalAddresses(chainId)?.simpleAccountFactory as Address | undefined;
    if (!fromBook) fail(`no simpleAccountFactory for chain ${chainId} in the address book; pass the factory address`);
    return fromBook!;
}

/**
 * Check that `factory` builds accounts for `entryPoint`: it has code, and its `accountImplementation()`
 * reports `entryPoint()` equal to `entryPoint`, all read at one block. A v0.6 factory with a v0.7 EntryPoint
 * throws, naming both. This checks what the factory reports, not what `createAccount` will deploy.
 */
export async function verifyAccountFactory(client: PublicClient, factory: Address, entryPoint: Address): Promise<{ implementation: Address }> {
    const block = await client.getBlock();
    const blockNumber = block.number!;
    if (!(await hasCode(client, factory, blockNumber))) fail(`account factory ${factory} has no code on this chain`);
    let implementation: Address, implEntryPoint: Address;
    try {
        implementation = await client.readContract({ address: factory, abi: SimpleAccountFactoryABI, functionName: 'accountImplementation', blockNumber }) as Address;
        implEntryPoint = await client.readContract({ address: implementation, abi: SimpleAccountABI, functionName: 'entryPoint', blockNumber }) as Address;
    } catch (e) {
        return fail(`account factory ${factory}: accountImplementation().entryPoint() could not be read (${(e as Error).message.split('\n')[0]})`);
    }
    if (!isAddressEqual(implEntryPoint, entryPoint)) {
        fail(`account factory ${factory} builds accounts for EntryPoint ${implEntryPoint}, but the SDK is configured for ${entryPoint}`);
    }
    const again = await client.getBlock({ blockNumber });
    if (again.hash !== block.hash) fail(`block ${blockNumber} changed from ${block.hash} to ${again.hash} while checking account factory ${factory}`);
    return { implementation };
}
