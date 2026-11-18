/**
 * Evidence: the per-chain deployment inputs (ETH/USD feed, SimpleAccountFactory) are resolved by chainId and
 * checked on the chain, and the old cross-chain defaults are refused.
 *
 * Part 1 runs against a local anvil fork of OP Mainnet (state read from a public RPC; no transaction is sent
 * anywhere, nothing is deployed). Part 2 is read-only eth_call / eth_getCode on the three public chains.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/deploy-inputs-op-fork.ts
 *
 * Output: docs/onchain-evidence/deploy-inputs-op-fork.md (no RPC URL).
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createPublicClient, http, type Address } from 'viem';
import { optimism, optimismSepolia, sepolia } from 'viem/chains';
import {
    resolveEthUsdFeedAddress, verifyEthUsdFeed, resolveAccountFactoryAddress, verifyAccountFactory, getCanonicalAddresses,
    AAStarError, ErrorCode, DEPLOYMENT_INPUT_REFUSALS,
} from '@aastar/core';

const PUBLIC = {
    10: process.env.OP_FORK_RPC ?? 'https://mainnet.optimism.io',
    11155111: process.env.SEPOLIA_PUBLIC_RPC ?? 'https://ethereum-sepolia-rpc.publicnode.com',
    11155420: process.env.OP_SEPOLIA_PUBLIC_RPC ?? 'https://sepolia.optimism.io',
} as const;
const CHAINS = { 10: optimism, 11155111: sepolia, 11155420: optimismSepolia } as const;
const SEPOLIA_FEED = '0x694AA1769357215DE4FAC081bf1f309aDC325306' as Address; // the old cross-chain default
const V06_FACTORY = '0x9406Cc6185a346906296840746125a0E44976454' as Address; // the old default factory
const OP_SEPOLIA_TYPO = '0x91E6060613810449d098b0b5EC8b51A0fe8C8985' as Address; // the old OP Sepolia book entry
const EP_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;
const OUT = 'docs/onchain-evidence/deploy-inputs-op-fork.md';

// Errors are written out only from the SDK's structured refusal (data.reason, plus data.reported for an EntryPoint
// mismatch, which the verifier sets from the value it read). No message, error name or provider text is copied;
// anything else is recorded as one constant.
const clean = (e: unknown) => {
    // Only a genuine SDK refusal (AAStarError, INVALID_CONFIGURATION, a reason from the SDK's own list) is recorded;
    // provider errors can carry arbitrary `data`, so anything else is one constant.
    if (!(e instanceof AAStarError) || e.code !== ErrorCode.INVALID_CONFIGURATION) return 'unexpected-error';
    const data = e.data as { reason?: unknown; reported?: unknown } | undefined;
    const reason = DEPLOYMENT_INPUT_REFUSALS.find((r) => r === data?.reason);
    if (!reason) return 'unexpected-error';
    if (reason === 'entrypoint-mismatch') {
        return typeof data?.reported === 'string' && /^0x[0-9a-fA-F]{40}$/.test(data.reported) ? `entrypoint-mismatch (factory reports ${data.reported})` : 'unexpected-error';
    }
    return reason;
};
const outcome = async (f: () => Promise<unknown>) => {
    try { const v = await f(); return { ok: true as const, text: typeof v === 'object' ? JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)) : String(v) }; }
    catch (e) { return { ok: false as const, text: clean(e) }; }
};

// Anvil binds port 0 itself and prints the port only after the bind succeeded; its stdout is parsed, never written out.
function startAnvil(bin: string, args: string[]): Promise<{ child: ReturnType<typeof spawn>; port: number }> {
    return new Promise((resolve, reject) => {
        const child = spawn(bin, [...args, '--host', '127.0.0.1', '--port', '0'], { stdio: ['ignore', 'pipe', 'ignore'] });
        let buf = '';
        const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('anvil did not report a listening port')); }, 120_000);
        child.stdout!.on('data', (d) => {
            buf += String(d);
            const m = buf.match(/Listening on 127\.0\.0\.1:(\d+)/);
            if (m) { clearTimeout(timer); child.stdout!.removeAllListeners('data'); child.stdout!.resume(); resolve({ child, port: Number(m[1]) }); }
        });
        child.once('exit', () => { clearTimeout(timer); reject(new Error('anvil exited before it was listening')); });
        child.once('error', (e) => { clearTimeout(timer); reject(e); });
    });
}

async function main() {
    const lines: string[] = [];
    const checks: Array<{ what: string; expect: 'pass' | RegExp; got: { ok: boolean; text: string } }> = [];

    // Every endpoint must report the chain it is labelled with before anything is recorded under that label.
    for (const id of [10, 11155111, 11155420] as const) {
        const got = await createPublicClient({ chain: CHAINS[id], transport: http(PUBLIC[id]) }).getChainId();
        if (got !== id) throw new Error(`the endpoint for chain ${id} reports chain ${got}`);
    }

    // Part 1: OP Mainnet fork (its upstream was just checked to be chain 10).
    const { child: anvil, port } = await startAnvil(process.env.ANVIL_BIN ?? join(homedir(), '.foundry/bin/anvil'), ['--fork-url', PUBLIC[10], '--chain-id', '10']);
    let forkBlock = 0n;
    try {
        const fork = createPublicClient({ chain: optimism, transport: http(`http://127.0.0.1:${port}`) });
        const info = await fork.request({ method: 'anvil_nodeInfo' as any }) as any;
        if (!info?.forkConfig?.forkBlockNumber || (await fork.getChainId()) !== 10) throw new Error('the endpoint is not the OP Mainnet fork this script started');
        forkBlock = BigInt(info.forkConfig.forkBlockNumber);

        const bookFeed = resolveEthUsdFeedAddress(10);
        checks.push({ what: `fork: no feed given → address book feed ${bookFeed}, verifyEthUsdFeed`, expect: 'pass', got: await outcome(() => verifyEthUsdFeed(fork as any, bookFeed)) });
        checks.push({ what: `fork: the old default ${SEPOLIA_FEED} (Sepolia's feed), verifyEthUsdFeed`, expect: /^no-code$/, got: await outcome(() => verifyEthUsdFeed(fork as any, SEPOLIA_FEED)) });
        const bookFactory = resolveAccountFactoryAddress(10);
        checks.push({ what: `fork: address book factory ${bookFactory} with EntryPoint v0.7`, expect: 'pass', got: await outcome(() => verifyAccountFactory(fork as any, bookFactory, EP_V07)) });
        checks.push({ what: `fork: the old default factory ${V06_FACTORY} with EntryPoint v0.7`, expect: /^entrypoint-mismatch \(factory reports 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789\)$/i, got: await outcome(() => verifyAccountFactory(fork as any, V06_FACTORY, EP_V07)) });
    } finally {
        anvil.kill('SIGTERM');
    }

    // Part 2: read-only on the three public chains.
    for (const id of [10, 11155111, 11155420] as const) {
        const c = createPublicClient({ chain: CHAINS[id], transport: http(PUBLIC[id]) });
        const book = getCanonicalAddresses(id)!;
        checks.push({ what: `chain ${id}: address book factory ${book.simpleAccountFactory}`, expect: 'pass', got: await outcome(() => verifyAccountFactory(c as any, book.simpleAccountFactory as Address, EP_V07)) });
        checks.push({ what: `chain ${id}: old default factory ${V06_FACTORY}`, expect: /^entrypoint-mismatch \(factory reports 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789\)$/i, got: await outcome(() => verifyAccountFactory(c as any, V06_FACTORY, EP_V07)) });
        checks.push({ what: `chain ${id}: old OP Sepolia book entry ${OP_SEPOLIA_TYPO}`, expect: /^no-code$/, got: await outcome(() => verifyAccountFactory(c as any, OP_SEPOLIA_TYPO, EP_V07)) });
        checks.push({ what: `chain ${id}: address book feed ${book.priceFeed}`, expect: 'pass', got: await outcome(() => verifyEthUsdFeed(c as any, book.priceFeed as Address)) });
    }

    const verdicts = checks.map((c) => (c.expect === 'pass' ? c.got.ok : !c.got.ok && c.expect.test(c.got.text)));
    const pass = verdicts.every(Boolean);
    lines.push(
        '# Deployment inputs (ETH/USD feed, account factory) on the chain',
        '',
        `Generated by \`tests/regression/onchain-evidence/deploy-inputs-op-fork.ts\` on ${new Date().toISOString()}.`,
        `Part 1: local anvil fork of OP Mainnet (chainId 10) at block ${forkBlock}, forked from a public RPC (URL not recorded); nothing was sent or deployed.`,
        'Part 2: read-only calls on public RPCs (URLs not recorded) for chains 10, 11155111, 11155420.',
        '',
        '| Check | Expected | Result | OK |',
        '|---|---|---|---|',
        ...checks.map((c, i) => `| ${c.what} | ${c.expect === 'pass' ? 'accepted' : `refused (${c.expect.source})`} | ${c.got.ok ? 'accepted' : 'refused'}: ${c.got.text.replace(/\|/g, '\\|')} | ${verdicts[i] ? 'yes' : '**NO**'} |`),
        '',
        `Verdict: ${pass ? 'PASS' : 'FAIL'}`,
        '',
    );
    writeFileSync(OUT, lines.join('\n'));
    console.log(lines.join('\n'));
    if (!pass) process.exitCode = 1;
}

main().catch((e) => {
    console.error(`deploy-inputs-op-fork: ${clean(e)}`);
    process.exitCode = 1;
});
