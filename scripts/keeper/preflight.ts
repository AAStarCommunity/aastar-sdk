/**
 * preflight guards against operator mistakes; it is not a security boundary
 *
 * The operator runs this with the pinned node before launchd loads the plist.
 * It stats paths and bind-tests lock ports. It does not read secret file contents.
 */
import { lstatSync, opendirSync, readlinkSync, realpathSync, type Dirent, type Stats } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aclAllowsOthers } from './acl.js';
import { envFileRefusal, type ModeStat } from './startupGuards.js';
import { journalFileLockPort, keeperLockPort } from './journal.js';
import { keystoreRefusal, passwordRefusal, type NodeMeta } from './secretMode.js';

export const PREFLIGHT_BANNER = 'preflight guards against operator mistakes; it is not a security boundary';
export const ENTRY_CAP = 300_000;
const PATH_MAX = 4_096;
const NAME_MAX = 255;
const ARG_MAX = 64;
const HOPS_MAX = 64;
const SYMLINK_HOPS = 40;

const NETWORKS: Readonly<Record<string, number>> = Object.freeze({
    anvil: 31_337,
    sepolia: 11_155_111,
    'op-sepolia': 11_155_420,
    'op-mainnet': 10,
    mainnet: 1,
});

const REQUIRED_FILES = ['package.json', 'pnpm-lock.yaml', 'tsconfig.json'] as const;

export interface PreflightConfig {
    readonly repo: string;
    readonly node: string;
    readonly castBin: string;
    readonly journalDir: string;
    readonly envFile: string;
    readonly keystore: string;
    readonly passwordFile: string;
    readonly network: string;
    readonly chainId: number;
    readonly signer: string;
    readonly maxEntries: number;
}

export interface PreflightReport {
    readonly code: number;
    readonly lines: readonly string[];
}

function frozenConfig(config: PreflightConfig): PreflightConfig {
    return Object.freeze({ ...config });
}

function hexAddress(value: string): boolean {
    if (value.length !== 42) return false;
    if (value.charCodeAt(0) !== 48) return false;
    const x = value.charCodeAt(1);
    if (x !== 120 && x !== 88) return false;
    for (let i = 2; i < value.length; i++) {
        const c = value.charCodeAt(i);
        const ok = (c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70);
        if (!ok) return false;
    }
    return true;
}

function badToken(value: string): boolean {
    return value.length === 0 || value.length > PATH_MAX || value.includes('\0');
}

/** Validate every flag before any filesystem or network call. The result is frozen. */
export function parsePreflightArgs(argv: readonly string[], maxEntries = ENTRY_CAP): PreflightConfig | 'help' | null {
    if (!Array.isArray(argv) || argv.length > ARG_MAX) return null;
    if (!Number.isInteger(maxEntries) || maxEntries <= 0 || maxEntries > ENTRY_CAP) return null;
    const values = new Map<string, string>();
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i] ?? '';
        if (typeof token !== 'string' || token.length > PATH_MAX || token.includes('\0')) return null;
        if (token === '--help' || token === '-h') return 'help';
        if (!token.startsWith('--') || token.includes('=')) return null;
        const next = argv[i + 1];
        if (typeof next !== 'string' || next.startsWith('--') || badToken(next)) return null;
        if (values.has(token)) return null;
        values.set(token, next);
        i += 1;
    }
    const repo = values.get('--repo');
    const node = values.get('--node');
    const castBin = values.get('--cast-bin');
    const journalDir = values.get('--journal-dir');
    const envFile = values.get('--env-file');
    const keystore = values.get('--keystore');
    const passwordFile = values.get('--password-file');
    const network = values.get('--network');
    const signer = values.get('--signer');
    if (!repo || !node || !castBin || !journalDir || !envFile || !keystore || !passwordFile || !network || !signer) {
        return null;
    }
    if (values.size !== 9) return null;
    for (const path of [repo, node, castBin, journalDir, envFile, keystore, passwordFile]) {
        if (!isAbsolute(path)) return null;
    }
    const chainId = NETWORKS[network];
    if (chainId === undefined) return null;
    if (!hexAddress(signer)) return null;
    return frozenConfig({
        repo, node, castBin, journalDir, envFile, keystore, passwordFile, network, chainId, signer, maxEntries,
    });
}

function show(repo: string, abs: string): string {
    const rel = relative(repo, abs);
    if (rel.length === 0) return basename(abs);
    if (rel.startsWith('..') || isAbsolute(rel)) return abs;
    return rel;
}

class Report {
    readonly lines: string[] = [];
    fails = 0;
    pass(label: string): void {
        this.lines.push(`PASS ${label}`);
    }
    fail(label: string, why: string): void {
        this.fails += 1;
        this.lines.push(`FAIL ${label} ${why}`);
    }
}

function trustedNode(st: Stats, uid: number): boolean {
    return (st.uid === uid || st.uid === 0) && (st.mode & 0o022) === 0;
}

type AclCache = Map<string, boolean>;

function aclDenied(cache: AclCache, filePath: string): boolean {
    const hit = cache.get(filePath);
    if (hit !== undefined) return hit;
    const denied = aclAllowsOthers(filePath);
    cache.set(filePath, denied);
    return denied;
}

function checkAncestors(report: Report, filePath: string, uid: number, label: string, cache: AclCache): boolean {
    let dir = dirname(filePath);
    const seen = new Set<string>();
    let hops = 0;
    while (hops < HOPS_MAX && !seen.has(dir)) {
        seen.add(dir);
        hops += 1;
        let st: Stats;
        try {
            st = lstatSync(dir);
        } catch {
            report.fail(label, 'ancestor');
            return false;
        }
        if (!st.isDirectory() || st.isSymbolicLink() || !trustedNode(st, uid)) {
            report.fail(label, 'ancestor');
            return false;
        }
        if (aclDenied(cache, dir)) {
            report.fail(label, 'acl');
            return false;
        }
        if (dir === '/') return true;
        dir = dirname(dir);
    }
    report.fail(label, 'ancestor');
    return false;
}

interface Walk {
    entries: number;
    capped: boolean;
    seen: Set<string>;
    max: number;
}

function statOf(abs: string): Stats | null {
    try {
        return lstatSync(abs);
    } catch {
        return null;
    }
}

function metaOf(st: Stats): NodeMeta {
    return {
        isFile: st.isFile(),
        isDirectory: st.isDirectory(),
        isSymbolicLink: st.isSymbolicLink(),
        uid: st.uid,
        mode: st.mode,
    };
}

function modeStat(st: Stats): ModeStat {
    return metaOf(st);
}

function readHop(linkPath: string): string | null {
    let text: string;
    try {
        text = readlinkSync(linkPath);
    } catch {
        return null;
    }
    if (text.length === 0 || text.length > PATH_MAX || text.includes('\0')) return null;
    if (isAbsolute(text)) return text;
    return join(dirname(linkPath), text);
}

function considerFile(report: Report, walk: Walk, repo: string, abs: string, uid: number, mode: 'exact-0600' | 'file' | 'keystore' | 'env', cache: AclCache): void {
    if (walk.capped) return;
    const label = show(repo, abs);
    if (!checkAncestors(report, abs, uid, label, cache)) return;
    let current = abs;
    const seen = new Set<string>();
    for (let hop = 0; hop <= SYMLINK_HOPS; hop += 1) {
        const st = statOf(current);
        if (!st) {
            report.fail(label, 'unreadable');
            return;
        }
        if (aclDenied(cache, current)) {
            report.fail(label, 'acl');
            return;
        }
        if (st.isSymbolicLink()) {
            if (mode === 'exact-0600' || mode === 'keystore' || mode === 'env') {
                report.fail(label, 'not a regular file');
                return;
            }
            if (hop === SYMLINK_HOPS || seen.has(current)) {
                report.fail(label, 'symlink');
                return;
            }
            seen.add(current);
            const next = readHop(current);
            if (!next || next.length > PATH_MAX) {
                report.fail(label, 'unreadable');
                return;
            }
            if (!checkAncestors(report, next, uid, label, cache)) return;
            current = next;
            continue;
        }
        if (st.isDirectory()) {
            walkDir(report, walk, repo, current, label, uid, cache);
            return;
        }
        judgeFile(report, st, uid, label, mode);
        return;
    }
    report.fail(label, 'symlink');
}

function judgeFile(report: Report, st: Stats, uid: number, label: string, mode: 'exact-0600' | 'file' | 'keystore' | 'env'): void {
    if (!st.isFile() || st.isSymbolicLink()) {
        report.fail(label, 'not a regular file');
        return;
    }
    if (mode === 'exact-0600' || mode === 'keystore' || mode === 'env') {
        const file = metaOf(st);
        const dummyParent: NodeMeta = { isFile: false, isDirectory: true, isSymbolicLink: false, uid, mode: 0o40700 };
        const reason = mode === 'keystore'
            ? keystoreRefusal(file, dummyParent, uid)
            : mode === 'env'
                ? envFileRefusal(modeStat(st), { isFile: false, isDirectory: true, isSymbolicLink: false, uid, mode: 0o40700 }, uid)
                : passwordRefusal(file, dummyParent, uid);
        if (reason && (reason.includes('mode') || reason.includes('owner') || reason.includes('not a regular file'))) {
            report.fail(label, reason.includes('owner') ? 'owner' : reason.includes('not a regular file') ? 'not a regular file' : 'mode');
            return;
        }
    } else if (!trustedNode(st, uid)) {
        report.fail(label, 'writable');
        return;
    }
    report.pass(label);
}

function walkDir(report: Report, walk: Walk, repo: string, abs: string, label: string, uid: number, cache: AclCache): void {
    if (walk.capped) return;
    const st = statOf(abs);
    if (!st || !st.isDirectory() || st.isSymbolicLink()) {
        report.fail(label, 'directory');
        return;
    }
    const id = `${st.dev}:${st.ino}`;
    if (walk.seen.has(id)) return;
    walk.seen.add(id);
    if (!trustedNode(st, uid)) {
        report.fail(label, 'writable');
        return;
    }
    if (aclDenied(cache, abs)) {
        report.fail(label, 'acl');
        return;
    }
    if (!checkAncestors(report, abs, uid, label, cache)) return;
    report.pass(label);
    let dir: ReturnType<typeof opendirSync>;
    try {
        dir = opendirSync(abs);
    } catch {
        report.fail(label, 'unreadable');
        return;
    }
    try {
        let entry: Dirent | null = dir.readSync();
        while (entry) {
            walk.entries += 1;
            if (walk.entries > walkLimit(walk)) {
                walk.capped = true;
                report.fail('entry-cap', 'too many');
                return;
            }
            const name = entry.name;
            if (name.length === 0 || name.length > NAME_MAX || name === '.' || name === '..' || name.includes('\0')) {
                report.fail(label, 'unreadable');
                return;
            }
            const child = join(abs, name);
            if (child.length > PATH_MAX) {
                report.fail(label, 'unreadable');
                return;
            }
            const childLabel = label.startsWith('/') ? show(repo, child) : `${label}/${name}`;
            if (name === '.git' && !entry.isSymbolicLink()) {
                const git = statOf(child);
                if (!git || !git.isDirectory() || git.isSymbolicLink()) {
                    report.fail(childLabel, 'directory');
                } else if (!trustedNode(git, uid)) {
                    report.fail(childLabel, 'writable');
                } else if (aclDenied(cache, child)) {
                    report.fail(childLabel, 'acl');
                } else {
                    report.pass(childLabel);
                }
            } else if (entry.isSymbolicLink()) {
                considerFile(report, walk, repo, child, uid, 'file', cache);
            } else if (entry.isDirectory()) {
                walkDir(report, walk, repo, child, childLabel, uid, cache);
            } else if (entry.isFile()) {
                considerFile(report, walk, repo, child, uid, 'file', cache);
            } else {
                report.fail(childLabel, 'not a regular file');
            }
            if (walk.capped) return;
            entry = dir.readSync();
        }
    } finally {
        dir.closeSync();
    }
}

function walkLimit(walk: Walk): number {
    return walk.max;
}

function listenOnce(port: number): Promise<'free' | 'busy' | 'unreadable'> {
    const server: Server = createServer();
    return new Promise((resolve) => {
        const done = (kind: 'free' | 'busy' | 'unreadable') => {
            server.removeAllListeners();
            if (kind === 'free') {
                server.close(() => resolve('free'));
                return;
            }
            resolve(kind);
        };
        server.once('error', (error: NodeJS.ErrnoException) => {
            done(error.code === 'EADDRINUSE' ? 'busy' : 'unreadable');
        });
        server.once('listening', () => done('free'));
        server.listen({ port, host: '127.0.0.1', exclusive: true });
    });
}

function secretParent(report: Report, filePath: string, uid: number, label: string, kind: 'password' | 'keystore' | 'env', cache: AclCache): void {
    const parent = dirname(filePath);
    const st = statOf(parent);
    const file = statOf(filePath);
    const shown = `${label} parent`;
    if (!st || !file) {
        report.fail(shown, 'parent');
        return;
    }
    const reason = kind === 'password'
        ? passwordRefusal(metaOf(file), metaOf(st), uid)
        : kind === 'keystore'
            ? keystoreRefusal(metaOf(file), metaOf(st), uid)
            : envFileRefusal(modeStat(file), modeStat(st), uid);
    if (reason) {
        const why = reason.includes('owner') ? 'owner' : reason.includes('writable') || reason.includes('0700') || reason.includes('mode') ? 'writable' : 'parent';
        if (reason.includes('directory') || reason.includes('parent')) report.fail(shown, why);
        else report.fail(label, why);
        return;
    }
    if (aclDenied(cache, parent) || aclDenied(cache, filePath)) {
        report.fail(shown, 'acl');
        return;
    }
    report.pass(shown);
    checkAncestors(report, parent, uid, shown, cache);
}

/** Stat the configured paths and bind-test the lock ports. Exit code 0 only when every line is PASS. */
export async function runPreflight(config: PreflightConfig): Promise<PreflightReport> {
    const cfg = frozenConfig(config);
    const report = new Report();
    const uid = process.getuid?.();
    if (uid === undefined) {
        report.fail('uid', 'owner');
        return { code: 1, lines: report.lines };
    }
    const walk: Walk = { entries: 0, capped: false, seen: new Set<string>(), max: cfg.maxEntries };
    const cache: AclCache = new Map();

    considerFile(report, walk, cfg.repo, cfg.node, uid, 'file', cache);
    considerFile(report, walk, cfg.repo, cfg.castBin, uid, 'file', cache);

    const repoSt = statOf(cfg.repo);
    let repoReal = '';
    if (!repoSt) {
        report.fail(show(cfg.repo, cfg.repo), 'directory');
    } else if (repoSt.isSymbolicLink() || repoSt.isDirectory()) {
        if (repoSt.isSymbolicLink()) considerFile(report, walk, cfg.repo, cfg.repo, uid, 'file', cache);
        else walkDir(report, walk, cfg.repo, cfg.repo, cfg.repo, uid, cache);
        try {
            repoReal = realpathSync(cfg.repo);
        } catch {
            report.fail('repo', 'unreadable');
        }
    } else {
        report.fail(show(cfg.repo, cfg.repo), 'directory');
    }
    if (repoReal) {
        for (const rel of REQUIRED_FILES) {
            considerFile(report, walk, repoReal, join(repoReal, rel), uid, 'file', cache);
        }
        considerFile(report, walk, repoReal, join(repoReal, 'scripts', 'keeper.ts'), uid, 'file', cache);
        const configName = `config.${cfg.network}.json`;
        const configPath = join(repoReal, configName);
        const configSt = statOf(configPath);
        if (!configSt) {
            const dirLabel = `${configName} directory`;
            const dirSt = statOf(repoReal);
            if (!dirSt || !dirSt.isDirectory() || dirSt.isSymbolicLink() || !trustedNode(dirSt, uid)) {
                report.fail(dirLabel, 'directory');
            } else if (aclDenied(cache, repoReal)) {
                report.fail(dirLabel, 'acl');
            } else if (checkAncestors(report, repoReal, uid, dirLabel, cache)) {
                report.pass(dirLabel);
            }
        } else {
            considerFile(report, walk, repoReal, configPath, uid, 'file', cache);
        }
    }

    const journalSt = statOf(cfg.journalDir);
    if (!journalSt) {
        report.fail('journal-dir', 'missing');
    } else if (journalSt.isSymbolicLink()) {
        considerFile(report, walk, cfg.repo, cfg.journalDir, uid, 'file', cache);
    } else {
        walkDir(report, walk, cfg.repo, cfg.journalDir, 'journal-dir', uid, cache);
    }

    considerFile(report, walk, cfg.repo, cfg.envFile, uid, 'env', cache);
    secretParent(report, cfg.envFile, uid, 'env-file', 'env', cache);
    considerFile(report, walk, cfg.repo, cfg.keystore, uid, 'keystore', cache);
    secretParent(report, cfg.keystore, uid, 'keystore', 'keystore', cache);
    considerFile(report, walk, cfg.repo, cfg.passwordFile, uid, 'exact-0600', cache);
    secretParent(report, cfg.passwordFile, uid, 'password-file', 'password', cache);

    let journalReal: string | null = null;
    try {
        if (journalSt && (journalSt.isDirectory() || journalSt.isSymbolicLink())) journalReal = realpathSync(cfg.journalDir);
    } catch {
        journalReal = null;
    }
    const signerPort = keeperLockPort(cfg.chainId, cfg.signer);
    const signerLock = await listenOnce(signerPort);
    if (signerLock === 'free') report.pass('signer-lock');
    else report.fail('signer-lock', signerLock);
    if (!journalReal) {
        report.fail('journal-lock', 'unreadable');
    } else {
        const journalFile = join(journalReal, `${cfg.network}.journal.json`);
        const journalLock = await listenOnce(journalFileLockPort(journalFile));
        if (journalLock === 'free') report.pass('journal-lock');
        else report.fail('journal-lock', journalLock);
    }

    return { code: report.fails === 0 ? 0 : 1, lines: report.lines };
}

function usage(): string {
    return [
        PREFLIGHT_BANNER,
        'usage: preflight --repo --node --cast-bin --journal-dir --env-file --keystore --password-file --network --signer',
        'The journal file lock is <journal-dir>/<network>.journal.json. Paths are absolute. Signer is an address.',
    ].join('\n');
}

async function main(): Promise<void> {
    const parsed = parsePreflightArgs(process.argv.slice(2));
    if (parsed === 'help') {
        console.log(usage());
        return;
    }
    console.log(PREFLIGHT_BANNER);
    if (!parsed) {
        console.log('FAIL arguments');
        process.exitCode = 1;
        return;
    }
    const report = await runPreflight(parsed);
    for (const line of report.lines) console.log(line);
    process.exitCode = report.code;
}

const entry = process.argv[1] ? realpathSync(process.argv[1]) : '';
if (entry && entry === fileURLToPath(import.meta.url)) {
    main().catch(() => {
        console.log(PREFLIGHT_BANNER);
        console.log('FAIL arguments');
        process.exitCode = 1;
    });
}
