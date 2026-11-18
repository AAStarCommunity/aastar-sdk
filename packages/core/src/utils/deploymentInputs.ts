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

const hasCode = async (client: PublicClient, address: Address) => {
    const code = await client.getCode({ address });
    return code !== undefined && code !== '0x';
};

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
export const ETH_USD_FEED_MAX_AGE_SECONDS = 7200;

/** The ETH/USD feed for `chainId`: the caller's value, else the address book's; neither → throws. */
export function resolveEthUsdFeedAddress(chainId: number, explicit?: Address): Address {
    if (explicit) return explicit;
    const fromBook = getCanonicalAddresses(chainId)?.priceFeed as Address | undefined;
    if (!fromBook) fail(`no ETH/USD price feed for chain ${chainId} in the address book; pass ethUsdPriceFeedAddress`);
    return fromBook!;
}

/**
 * Check `feed` on the chain before it is written into a deployment: it has code, `decimals() == 8`,
 * `description() == "ETH / USD"`, a positive answer, and `updatedAt` within `maxAgeSeconds` of the
 * latest block's timestamp (block time, so forks and slow clocks are judged by the chain).
 */
export async function verifyEthUsdFeed(
    client: PublicClient,
    feed: Address,
    opts: { maxAgeSeconds?: number } = {},
): Promise<{ decimals: number; description: string; answer: bigint; updatedAt: bigint }> {
    const maxAge = BigInt(opts.maxAgeSeconds ?? ETH_USD_FEED_MAX_AGE_SECONDS);
    const where = `ETH/USD feed ${feed}`;
    if (!(await hasCode(client, feed))) fail(`${where} has no code on this chain; refusing to deploy`);
    let decimals: number, description: string, round: readonly [bigint, bigint, bigint, bigint, bigint];
    try {
        [decimals, description, round] = await Promise.all([
            client.readContract({ address: feed, abi: AGGREGATOR_V3_ABI, functionName: 'decimals' }) as Promise<number>,
            client.readContract({ address: feed, abi: AGGREGATOR_V3_ABI, functionName: 'description' }) as Promise<string>,
            client.readContract({ address: feed, abi: AGGREGATOR_V3_ABI, functionName: 'latestRoundData' }) as Promise<readonly [bigint, bigint, bigint, bigint, bigint]>,
        ]);
    } catch (e) {
        return fail(`${where} could not be read as a Chainlink aggregator (${(e as Error).message.split('\n')[0]}); refusing to deploy`);
    }
    if (Number(decimals) !== 8) fail(`${where} reports decimals ${decimals}, expected 8; refusing to deploy`);
    if (description !== 'ETH / USD') fail(`${where} reports description ${JSON.stringify(description)}, expected "ETH / USD"; refusing to deploy`);
    const [, answer, , updatedAt] = round;
    if (answer <= 0n) fail(`${where} reports a non-positive answer ${answer}; refusing to deploy`);
    const now = (await client.getBlock()).timestamp;
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
 * reports `entryPoint()` equal to `entryPoint`. A v0.6 factory with a v0.7 EntryPoint throws, naming both.
 */
export async function verifyAccountFactory(client: PublicClient, factory: Address, entryPoint: Address): Promise<{ implementation: Address }> {
    if (!(await hasCode(client, factory))) fail(`account factory ${factory} has no code on this chain`);
    let implementation: Address, implEntryPoint: Address;
    try {
        implementation = await client.readContract({ address: factory, abi: SimpleAccountFactoryABI, functionName: 'accountImplementation' }) as Address;
        implEntryPoint = await client.readContract({ address: implementation, abi: SimpleAccountABI, functionName: 'entryPoint' }) as Address;
    } catch (e) {
        return fail(`account factory ${factory}: accountImplementation().entryPoint() could not be read (${(e as Error).message.split('\n')[0]})`);
    }
    if (!isAddressEqual(implEntryPoint, entryPoint)) {
        fail(`account factory ${factory} builds accounts for EntryPoint ${implEntryPoint}, but the SDK is configured for ${entryPoint}`);
    }
    return { implementation };
}
