#!/usr/bin/env tsx
/**
 * Provenance gate for SP's vendored DeployLive read-back tooling data (Part B1, DSR 2026-11-20).
 *
 * The data under packages/core/src/sp550-tooling comes from SP main 12b5ef80 (the #657 merge); the contracts it
 * describes stay on tag v5.5.0-rc.8 = 5a150f6a. Two pins are sound only if the contracts did not change between
 * them, which is checked here rather than assumed:
 *
 *   offline (always):
 *     - each vendored file's git blob id equals the pinned one, and the directory holds exactly those files;
 *     - the spec's sha256 equals SP550_READBACK_SPEC_SHA256;
 *     - the three chains' runtime-pins (and creation-pins) are byte-identical, and each runtime-pins file's
 *       creationPinsSha256 is the sha256 of its creation-pins file;
 *     - sp550ToolingProblems() is empty (schemas, the agreed rule text, the release table, providers);
 *   upstream (SP_REPO checkout; required with --strict or REQUIRE_UPSTREAM=1):
 *     - the tag still resolves to the contracts commit, and the tooling commit exists;
 *     - `contracts/src` is the same tree, and `foundry.toml` the same blob, at both commits;
 *     - each file's blob at the tooling commit is the pinned one.
 *
 *   pnpm run check:sp550-tooling
 *   SP_REPO=../SuperPaymaster pnpm run check:sp550-tooling --strict
 */
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
    SP550_READBACK_SPEC_SHA256, SP550_RUNTIME_PINS, SP550_TOOLING_CHAINS, SP550_TOOLING_FILES, SP550_TOOLING_PIN,
    sp550ToolingProblems,
} from '../packages/core/src/sp550Tooling.js';

/** The git object id of a blob: sha1("blob <len>\0" + bytes), as `git hash-object` computes it. */
export const gitBlobId = (b: Uint8Array) => createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** The directory core imports the data from: the only one the CLI checks (Codex B1 r1 M2). */
export const VENDORED_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/core/src/sp550-tooling');

/**
 * Offline problems for a tooling directory. `structural` is the data-level check (sp550ToolingProblems on what core
 * imports); a test passes another to prove it is wired in. Returns what it checked, too.
 */
export function offlineProblems(dir: string, structural: () => string[] = sp550ToolingProblems): { problems: string[]; checked: number } {
    const p: string[] = [];
    let checked = 0;
    const want = Object.keys(SP550_TOOLING_FILES).sort();
    const dirStat = fs.existsSync(dir) ? fs.lstatSync(dir) : undefined;
    if (!dirStat || !dirStat.isDirectory() || dirStat.isSymbolicLink()) return { problems: [`${dir} is not a real directory`], checked: 1 };
    const have = fs.readdirSync(dir).sort();
    for (const f of have) if (!want.includes(f)) p.push(`${f} is in ${path.basename(dir)}/ but not in SP550_TOOLING_FILES`);
    const bytes: Record<string, Buffer> = {};
    for (const f of want) {
        const file = path.join(dir, f);
        const st = fs.lstatSync(file, { throwIfNoEntry: false });
        if (!st) { p.push(`${f} is missing`); continue; }
        // A symlink to identical bytes would pass a content check, but git stores it as a path (Codex B1 r1 M1).
        if (!st.isFile() || st.isSymbolicLink()) { p.push(`${f} is not a regular file`); continue; }
        bytes[f] = fs.readFileSync(file);
        const id = gitBlobId(bytes[f]);
        checked++;
        if (id !== SP550_TOOLING_FILES[f].gitBlob) p.push(`${f}: blob ${id} is not the pinned ${SP550_TOOLING_FILES[f].gitBlob} (${SP550_TOOLING_FILES[f].upstream} at ${SP550_TOOLING_PIN.toolingCommit.slice(0, 8)})`);
    }
    const spec = bytes['deploylive-readback-runtime-pins.md'];
    if (spec) { checked++; if (sha256(spec) !== SP550_READBACK_SPEC_SHA256) p.push(`the spec's sha256 ${sha256(spec)} is not the pinned ${SP550_READBACK_SPEC_SHA256}`); }
    for (const kind of ['runtime-pins', 'creation-pins'] as const) {
        const files = SP550_TOOLING_CHAINS.map((c) => bytes[`${kind}.${c}.json`]);
        if (files.every(Boolean)) { checked++; if (!files.every((b) => b.equals(files[0]))) p.push(`the three ${kind} files are not byte-identical (the expectation is chain-independent)`); }
    }
    for (const c of SP550_TOOLING_CHAINS) {
        const cp = bytes[`creation-pins.${c}.json`];
        if (!cp) continue;
        checked++;
        const recorded = SP550_RUNTIME_PINS[c].creationPinsSha256;
        if (recorded !== `0x${sha256(cp)}`) p.push(`runtime-pins.${c} records creationPinsSha256 ${recorded}, but creation-pins.${c}.json hashes to 0x${sha256(cp)}`);
    }
    checked++;
    p.push(...structural());
    return { problems: p, checked };
}

/** `git -C <repo> <args>`, trimmed; throws on failure. Injected so the upstream rules can be tested without a checkout. */
export type Git = (args: string[]) => string;
export const gitIn = (repo: string): Git => (args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** Upstream problems, through `git`. */
export function upstreamProblems(git: Git): { problems: string[]; checked: number } {
    const p: string[] = [];
    let checked = 0;
    const { contractsTag, contractsCommit, toolingCommit } = SP550_TOOLING_PIN;
    const tryGit = (args: string[]): string | undefined => { try { return git(args); } catch { return undefined; } };
    const tag = tryGit(['rev-parse', `${contractsTag}^{commit}`]);
    checked++;
    if (tag !== contractsCommit) p.push(`tag ${contractsTag} resolves to ${tag ?? 'nothing'}, not ${contractsCommit} (a moved tag fails; it does not re-pin)`);
    const tooling = tryGit(['rev-parse', `${toolingCommit}^{commit}`]);
    checked++;
    if (tooling !== toolingCommit) { p.push(`the tooling commit ${toolingCommit} is not in the upstream checkout (fetch SP main)`); return { problems: p, checked }; }
    for (const sub of ['contracts/src', 'foundry.toml']) {
        const a = tryGit(['rev-parse', `${contractsCommit}:${sub}`]);
        const b = tryGit(['rev-parse', `${toolingCommit}:${sub}`]);
        checked++;
        if (!a || !b || a !== b) p.push(`${sub} differs between the contracts tag (${a ?? 'missing'}) and the tooling commit (${b ?? 'missing'}): the two pins are not about the same contracts`);
    }
    for (const [f, v] of Object.entries(SP550_TOOLING_FILES)) {
        const id = tryGit(['rev-parse', `${toolingCommit}:${v.upstream}`]);
        checked++;
        if (id !== v.gitBlob) p.push(`${v.upstream} at the tooling commit is blob ${id ?? 'missing'}, not the pinned ${v.gitBlob} (${f})`);
    }
    return { problems: p, checked };
}

function main() {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.some((a) => a !== '--strict')) { console.error(`FAIL: unknown argument(s) ${JSON.stringify(args)}; the only option is --strict`); process.exit(2); }
    const strict = args.length === 1;
    const requireUpstream = strict || process.env.REQUIRE_UPSTREAM === '1';
    const off = offlineProblems(VENDORED_DIR);
    const repo = path.resolve(process.env.SP_REPO ?? '../SuperPaymaster');
    let up: { problems: string[]; checked: number } | undefined;
    if (fs.existsSync(path.join(repo, '.git'))) up = upstreamProblems(gitIn(repo));
    else if (requireUpstream) { console.error(`FAIL: no SuperPaymaster checkout at ${repo} (--strict / REQUIRE_UPSTREAM=1 require it)`); process.exit(1); }
    const problems = [...off.problems, ...(up?.problems ?? [])];
    if (problems.length) { console.error(`check:sp550-tooling FAIL\n - ${problems.join('\n - ')}`); process.exit(1); }
    console.log(`check:sp550-tooling PASS — offline: ${off.checked} check(s); upstream: ${up ? `${up.checked} check(s) at ${SP550_TOOLING_PIN.toolingCommit.slice(0, 8)} vs ${SP550_TOOLING_PIN.contractsTag}` : 'SKIP (no SP checkout)'}`);
}

const invoked = process.argv[1] ? (() => { try { return fs.realpathSync(process.argv[1]); } catch { return undefined; } })() : undefined;
if (invoked && invoked === fs.realpathSync(fileURLToPath(import.meta.url))) main();
