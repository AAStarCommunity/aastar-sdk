/**
 * check:browser — guard against Node-only builtins leaking into a browser-facing @aastar/sdk subpath.
 *
 * Why this exists: 0.42.0 shipped a regression where `resolveSigner`'s Foundry-cast path imported
 * `node:child_process`, and the tsup-bundled `@aastar/sdk/operator` subpath dragged it into browser builds —
 * a broad `export * from '@aastar/sdk/operator'` failed to bundle. Unit tests run in Node (child_process
 * exists) and the one browser smoke used narrow imports that tree-shook it out, so nothing caught it before
 * publish. This scans each browser-facing subpath's built chunk closure for a STATIC import/require of a
 * dangerous Node builtin and fails the build — the pre-publish check the CI was missing.
 *
 * It is deliberately a static scan (no bundler): deterministic, fast, and immune to "warning vs error"
 * differences between consumer bundlers. A runtime-computed specifier (e.g. the intentional
 * `import(['node','child_process'].join(':'))` escape hatch) is NOT a static literal and is allowed.
 *
 * Run: `pnpm --filter @aastar/sdk build && pnpm run check:browser`
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DIST = resolve(process.cwd(), 'packages/sdk/dist');

/** Subpaths that MUST bundle in a browser. Excludes `email` (server-side Resend) and the node-only entry. */
const BROWSER_SUBPATHS = [
    'core', 'account', 'paymaster', 'identity', 'tokens', 'dapp',
    'x402', 'channel', 'enduser', 'operator', 'admin',
];

/**
 * Node builtins with no browser implementation whose STATIC import breaks a browser bundle. `crypto` is
 * intentionally allowed — @noble guards it and falls back to `globalThis.crypto` in the browser.
 */
const DANGEROUS = [
    'child_process', 'fs', 'fs/promises', 'worker_threads', 'cluster', 'net', 'tls',
    'dgram', 'dns', 'http2', 'module', 'v8', 'inspector', 'repl', 'readline',
];

/** A static import/require of a bare or `node:`-prefixed builtin — NOT a runtime-computed specifier. */
function staticImportRegex(builtin: string): RegExp {
    const b = builtin.replace('/', '\\/');
    return new RegExp(`(?:from|require\\(|import\\()\\s*["'\`](?:node:)?${b}["'\`]`);
}

/** Follow relative `./chunk-*.js` imports from an entry to gather its full bundled closure. */
function closure(entry: string): string[] {
    const seen = new Set<string>();
    const stack = [entry];
    while (stack.length) {
        const file = stack.pop()!;
        if (seen.has(file) || !existsSync(file)) continue;
        seen.add(file);
        const src = readFileSync(file, 'utf8');
        const dir = dirname(file);
        for (const m of src.matchAll(/(?:from|import|require\()\s*["'`](\.\.?\/[^"'`]+?\.js)["'`]/g)) {
            stack.push(resolve(dir, m[1]));
        }
    }
    return [...seen];
}

let failed = false;
for (const sub of BROWSER_SUBPATHS) {
    const entry = resolve(DIST, `${sub}.js`);
    if (!existsSync(entry)) {
        console.error(`❌ ${sub}: dist entry missing (${entry}) — run the @aastar/sdk build first`);
        failed = true;
        continue;
    }
    const files = closure(entry);
    const hits: string[] = [];
    for (const file of files) {
        const src = readFileSync(file, 'utf8');
        for (const b of DANGEROUS) {
            if (staticImportRegex(b).test(src)) hits.push(`${file.replace(DIST + '/', '')} → node:${b}`);
        }
    }
    if (hits.length) {
        console.error(`❌ @aastar/sdk/${sub} leaks a Node builtin into the browser bundle:`);
        for (const h of [...new Set(hits)]) console.error(`     ${h}`);
        failed = true;
    } else {
        console.log(`✅ @aastar/sdk/${sub} — browser-safe (${files.length} chunks scanned)`);
    }
}

if (failed) {
    console.error('\ncheck:browser FAILED — a browser-facing subpath statically imports a Node-only builtin.');
    console.error('Move the Node-only code behind a runtime-computed dynamic import, or off the browser barrel.');
    process.exit(1);
}
console.log('\n✅ check:browser PASS — no Node-only builtin leaks in browser-facing subpaths.');
