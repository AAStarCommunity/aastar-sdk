import { http, type HttpTransportConfig, type Transport } from 'viem';

/**
 * Which chain a script's UserOperations would land on, asked of the endpoints themselves, and the per-UserOp cost
 * ceiling a script must carry outside the test chains (DSR, follow-up to #470). No side effects on import, so any
 * script can use it; tests/regression/config.ts builds loadGaslessNetworkConfig on it.
 */
/**
 * Chains where a UserOperation spends nothing real: anvil, Sepolia, OP Sepolia. An explicit allow-list: an unknown chain
 * counts as real money (DSR, follow-up to #470).
 */
export const TEST_CHAIN_IDS: ReadonlySet<number> = new Set([31337, 11155111, 11155420]);

/** How long one eth_chainId may take before the endpoint counts as unreachable. */
export const CHAIN_ID_TIMEOUT_MS = 15_000;

/** eth_chainId of a JSON-RPC endpoint (node or bundler). */
export type ChainIdReader = (url: string) => Promise<number>;
export const readChainIdOverRpc: ChainIdReader = async (url) => {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(CHAIN_ID_TIMEOUT_MS) });
    const body = (await res.json()) as { result?: string };
    if (typeof body.result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(body.result)) throw new Error('eth_chainId returned no chain id');
    return Number(BigInt(body.result));
};

/**
 * The chain ids the node and the bundler REPORT (not a name or a constant in the script). Throws if they differ from
 * each other or from `expected`, so a testnet name in front of a mainnet endpoint is refused.
 */
export async function reportedChainId(rpcUrl: string, bundlerUrl: string | undefined, expected?: number, read: ChainIdReader = readChainIdOverRpc): Promise<number> {
    const rpc = await read(rpcUrl);
    if (expected !== undefined && rpc !== expected) throw new Error(`the RPC reports chain ${rpc}, but the configuration is for chain ${expected}; refusing to sign`);
    if (bundlerUrl) {
        const b = await read(bundlerUrl);
        if (b !== rpc) throw new Error(`the bundler reports chain ${b}, but the RPC reports chain ${rpc}; refusing to sign`);
    }
    return rpc;
}

/**
 * The per-UserOp cost ceiling (wei) from `--max-userop-cost-wei <wei>` (or `=<wei>`), else AASTAR_MAX_USEROP_COST_WEI;
 * there is no default. Required unless `chainId` is in TEST_CHAIN_IDS. Read env only after the network's .env is loaded.
 */
export function resolveUserOpCostCap(chainId: number, argv: readonly string[] = process.argv, env: NodeJS.ProcessEnv = process.env): bigint | undefined {
    const flag = '--max-userop-cost-wei';
    const i = argv.indexOf(flag);
    const fromArg = i >= 0 ? (argv[i + 1] ?? '') : argv.find((a) => a.startsWith(`${flag}=`))?.slice(flag.length + 1);
    const raw = fromArg ?? env.AASTAR_MAX_USEROP_COST_WEI;
    let cap: bigint | undefined;
    if (raw !== undefined) {
        if (!/^[1-9][0-9]{0,40}$/.test(raw)) throw new Error(`${flag} / AASTAR_MAX_USEROP_COST_WEI must be a positive integer in wei (got ${JSON.stringify(raw)})`);
        cap = BigInt(raw);
    }
    if (!TEST_CHAIN_IDS.has(chainId) && cap === undefined) {
        throw new Error(`chain ${chainId} is not a test chain: a UserOperation there needs an explicit per-UserOp cost ceiling: pass ${flag} <wei> or set AASTAR_MAX_USEROP_COST_WEI (no default)`);
    }
    return cap;
}


/**
 * For scripts that sign or submit UserOperations WITHOUT the SDK's guarded send path (raw eth_sendUserOperation,
 * handleOps, hand-built hashes): refuse unless the RPC and the bundler both report a TEST_CHAIN_IDS chain. Such a
 * script cannot hold an op to a ceiling, so it does not run where an op costs real money.
 */
export async function refuseMainnetUserOps(rpcUrl: string, bundlerUrl?: string, read: ChainIdReader = readChainIdOverRpc): Promise<number> {
    const chainId = await reportedChainId(rpcUrl, bundlerUrl, undefined, read);
    if (!TEST_CHAIN_IDS.has(chainId)) throw new Error(`chain ${chainId} is not a test chain: this script signs UserOperations without a cost ceiling and refuses to run there`);
    return chainId;
}

/**
 * For a script that fails over across several RPCs, at startup: ask each one its chain. One that answers a non-test
 * chain, or a different chain from the rest, refuses the run; none answering refuses it too. One that does not answer
 * is NOT dropped (the fail-over order stays as configured): its transport must be testChainHttp, which verifies it
 * before it serves a request instead. Only a fully successful check is remembered.
 */
export async function verifiedTestChainEndpoints(urls: readonly (string | undefined)[], bundlerUrl?: string, read: ChainIdReader = readChainIdOverRpc): Promise<{ chainId: number }> {
    let chainId: number | undefined;
    const answered: [string, number][] = [];
    for (const u of urls) {
        if (!u) continue;
        let id: number;
        try { id = await read(u); } catch (e) { console.warn(`   ⚠️ RPC endpoint did not answer eth_chainId at startup; it is verified before it serves a request instead: ${(e as Error).message}`); continue; }
        if (!TEST_CHAIN_IDS.has(id)) throw new Error(`an RPC endpoint reports chain ${id}, not a test chain: this script signs UserOperations without a cost ceiling and refuses to run there`);
        if (chainId !== undefined && id !== chainId) throw new Error(`the RPC endpoints disagree (chain ${chainId} and chain ${id}); refusing to sign`);
        chainId = id;
        answered.push([u, id]);
    }
    if (chainId === undefined) throw new Error('no RPC endpoint answered eth_chainId; refusing to sign');
    if (bundlerUrl) {
        const b = await read(bundlerUrl);
        if (b !== chainId) throw new Error(`the bundler reports chain ${b}, but the RPC reports chain ${chainId}; refusing to sign`);
    }
    for (const [u, id] of answered) verified.set(u, id); // testChainHttp need not ask them again
    return { chainId };
}

/** The chain each endpoint reported, once it was on a test chain. */
const verified = new Map<string, number>();

/**
 * viem's `http(url, opts)`, except that no request is served until the endpoint has reported, through this same
 * transport (its headers, fetch options, timeout and retries), a test chain — and, when the client has a chain, that
 * chain (the one the signed hash binds). A failed or refused verification fails that request, so a fallback transport
 * moves on to its next endpoint, and the next request asks again: an endpoint that was down rejoins the fail-over order
 * once it answers, and one on another chain never serves a request.
 */
export function testChainHttp(url: string | undefined, opts?: HttpTransportConfig): Transport {
    const inner = http(url, opts);
    return ((args: Parameters<Transport>[0]) => {
        const t = inner(args);
        const want = args?.chain?.id;
        const ensure = async () => {
            if (!url) throw new Error('no RPC URL');
            let id = verified.get(url);
            if (id === undefined) {
                const hex = await (t.request as any)({ method: 'eth_chainId' });
                id = Number(BigInt(hex));
                if (!TEST_CHAIN_IDS.has(id)) throw new Error(`refusing to use an RPC endpoint on chain ${id}: not a test chain`);
                verified.set(url, id);
            }
            if (want !== undefined && id !== want) throw new Error(`refusing to use an RPC endpoint on chain ${id}: this client is for chain ${want}`);
        };
        return { ...t, request: (async (req: any, o?: any) => { await ensure(); return (t.request as any)(req, o); }) as typeof t.request };
    }) as Transport;
}

/** For tests: forget what this process has verified. */
export function resetVerifiedEndpoints(): void { verified.clear(); }
