#!/usr/bin/env tsx
/**
 * Read-only post-deploy check (FU-91). Sends no transaction and needs no key.
 *
 *   pnpm exec tsx scripts/post-deploy-check/check.ts --expect <table.json> [--rpc-a <url>] [--rpc-b <url>]
 *
 * The two RPC URLs come from --rpc-a/--rpc-b or POST_DEPLOY_RPC_A/POST_DEPLOY_RPC_B (prefer the
 * environment: argv is visible in the process list). They must be two different endpoints. No URL
 * is ever printed: every output line goes through the redactor.
 *
 * Exit codes: 0 all PASS; 1 any FAIL (or bad input); 2 no FAIL but INCOMPLETE rows or a placeholder table.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { ExpectationsError, parseExpectations } from './expectations.js';
import { formatReport, runChecks } from './run.js';
import { httpProvider, makeRedactor, type FetchLike, type NamedProvider } from './rpc.js';

export interface Io {
    out(line: string): void;
    err(line: string): void;
    readFile(path: string): string;
    fetch?: FetchLike;
}

const USAGE = 'usage: check.ts --expect <table.json> [--rpc-a <url>] [--rpc-b <url>]  (or env POST_DEPLOY_RPC_A / POST_DEPLOY_RPC_B)';

function parseArgs(argv: string[]): { expect?: string; rpcA?: string; rpcB?: string; problem?: string } {
    const out: { expect?: string; rpcA?: string; rpcB?: string; problem?: string } = {};
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i];
        const val = argv[i + 1];
        const take = () => { i++; return val; };
        if (flag === '--expect' && val !== undefined) out.expect = take();
        else if (flag === '--rpc-a' && val !== undefined) out.rpcA = take();
        else if (flag === '--rpc-b' && val !== undefined) out.rpcB = take();
        // Never echo the offending token: it may be a URL.
        else return { problem: `unrecognized or incomplete argument at position ${i + 1}` };
    }
    return out;
}

export async function main(argv: string[], env: Record<string, string | undefined>, io: Io): Promise<number> {
    const args = parseArgs(argv);
    const rpcA = args.rpcA ?? env.POST_DEPLOY_RPC_A;
    const rpcB = args.rpcB ?? env.POST_DEPLOY_RPC_B;
    const redact = makeRedactor([
        ...(rpcA ? [{ label: 'A' as const, url: rpcA }] : []),
        ...(rpcB ? [{ label: 'B' as const, url: rpcB }] : []),
    ]);
    const out = (s: string) => io.out(redact(s));
    const err = (s: string) => io.err(redact(s));

    try {
        if (args.problem) { err(args.problem); err(USAGE); return 1; }
        if (!args.expect) { err('missing --expect'); err(USAGE); return 1; }
        if (!rpcA || !rpcB) { err('two RPC endpoints are required (provider A and provider B)'); err(USAGE); return 1; }
        if (rpcA.trim() === rpcB.trim()) { err('provider A and provider B are the same endpoint; a dual-provider check needs two'); return 1; }

        let table;
        try {
            table = parseExpectations(io.readFile(args.expect));
        } catch (e) {
            if (e instanceof ExpectationsError) { err(e.message); return 1; }
            throw e;
        }
        out(`expectations: ${args.expect}${table.note ? ` (${table.note})` : ''}`);
        const providers: [NamedProvider, NamedProvider] = [
            { label: 'A', provider: httpProvider(rpcA, io.fetch) },
            { label: 'B', provider: httpProvider(rpcB, io.fetch) },
        ];
        const report = await runChecks(table, providers);
        for (const line of formatReport(report)) out(line);
        return report.exitCode;
    } catch (e) {
        err(`post-deploy-check aborted: ${e instanceof Error ? e.message : String(e)}`);
        return 1;
    }
}

const isEntry = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
    main(process.argv.slice(2), process.env, {
        out: s => console.log(s),
        err: s => console.error(s),
        readFile: p => readFileSync(p, 'utf8'),
    }).then(code => { process.exitCode = code; });
}
