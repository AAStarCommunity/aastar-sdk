/**
 * macOS ACL metadata. `ls -led` prints the name and ACL entries. It does not read file bytes.
 * Any `allow` entry fails, including inherited ones. Deny-only entries pass.
 * Unparseable output, a non-zero exit, or a timeout fails closed.
 * On non-darwin platforms this is a no-op pass: Linux CI has no `ls -e`.
 */
import { spawnSync } from 'node:child_process';

const ACL_TIMEOUT_MS = 2_000;
const ACL_OUT_CAP = 65_536;
const ACL_LINE_CAP = 4_608;
const ACL_LINE_MAX = 256;
const PATH_MAX = 4_096;

/** True when the listing grants any allow, or cannot be parsed. Deny-only is false. */
export function aclListingAllowsOthers(stdout: string): boolean {
    if (typeof stdout !== 'string' || stdout.length === 0 || stdout.length > ACL_OUT_CAP) return true;
    let start = 0;
    let lines = 0;
    let sawListing = false;
    let sawAcl = false;
    while (start <= stdout.length) {
        let end = stdout.indexOf('\n', start);
        if (end < 0) end = stdout.length;
        if (end - start > ACL_LINE_CAP) return true;
        let line = stdout.slice(start, end);
        start = end + 1;
        if (line.endsWith('\r')) line = line.slice(0, -1);
        lines += 1;
        if (lines > ACL_LINE_MAX) return true;
        if (line.length === 0) {
            if (start > stdout.length) break;
            continue;
        }
        const kind = classifyAclLine(line);
        if (kind === 'allow') return true;
        if (kind === 'deny') {
            sawAcl = true;
            continue;
        }
        if (kind === 'listing') {
            if (sawListing || sawAcl) return true;
            sawListing = true;
            continue;
        }
        return true;
    }
    return !sawListing;
}

/**
 * True when another principal is allowed, or the metadata cannot be trusted.
 * False on deny-only ACLs, on a listing with no ACL entries, and on every non-darwin host.
 */
export function aclAllowsOthers(filePath: string): boolean {
    if (process.platform !== 'darwin') return false;
    if (typeof filePath !== 'string' || filePath.length === 0 || filePath.length > PATH_MAX) return true;
    if (!filePath.startsWith('/') || filePath.includes('\0')) return true;
    try {
        const result = spawnSync('/bin/ls', ['-led', filePath], {
            encoding: 'utf8',
            timeout: ACL_TIMEOUT_MS,
            maxBuffer: ACL_OUT_CAP,
            shell: false,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        if (result.error || result.status !== 0) return true;
        const stdout = typeof result.stdout === 'string' ? result.stdout : '';
        if (stdout.length > ACL_OUT_CAP) return true;
        return aclListingAllowsOthers(stdout);
    } catch {
        return true;
    }
}

function classifyAclLine(line: string): 'allow' | 'deny' | 'listing' | 'bad' {
    let i = 0;
    while (i < line.length && (line.charCodeAt(i) === 32 || line.charCodeAt(i) === 9)) i += 1;
    if (i >= line.length) return 'bad';
    const head = line.charCodeAt(i);
    if (head < 48 || head > 57) {
        if (i !== 0) return 'bad';
        if (!isListingType(line.charCodeAt(0)) || line.length < 10) return 'bad';
        return 'listing';
    }
    while (i < line.length && line.charCodeAt(i) >= 48 && line.charCodeAt(i) <= 57) i += 1;
    if (i >= line.length || line.charCodeAt(i) !== 58) return 'bad';
    i += 1;
    if (i >= line.length || line.charCodeAt(i) !== 32) return 'bad';
    while (i < line.length && line.charCodeAt(i) === 32) i += 1;
    const principal = i;
    while (i < line.length && line.charCodeAt(i) !== 32 && line.charCodeAt(i) !== 9) i += 1;
    if (i === principal || i >= line.length) return 'bad';
    if (!hasColon(line, principal, i)) return 'bad';
    while (i < line.length && line.charCodeAt(i) === 32) i += 1;
    if (startsWith(line, i, 'inherited')) {
        i += 'inherited'.length;
        if (i >= line.length || line.charCodeAt(i) !== 32) return 'bad';
        while (i < line.length && line.charCodeAt(i) === 32) i += 1;
    }
    let action: 'allow' | 'deny' | null = null;
    if (startsWith(line, i, 'allow')) {
        action = 'allow';
        i += 'allow'.length;
    } else if (startsWith(line, i, 'deny')) {
        action = 'deny';
        i += 'deny'.length;
    } else {
        return 'bad';
    }
    if (i >= line.length || line.charCodeAt(i) !== 32) return 'bad';
    while (i < line.length && line.charCodeAt(i) === 32) i += 1;
    if (i >= line.length) return 'bad';
    const perms = i;
    while (i < line.length) {
        const c = line.charCodeAt(i);
        const ok = (c >= 97 && c <= 122) || c === 44 || c === 95;
        if (!ok) return 'bad';
        i += 1;
    }
    if (i === perms) return 'bad';
    return action;
}

function isListingType(c: number): boolean {
    return c === 45 || c === 100 || c === 108 || c === 98 || c === 99 || c === 112 || c === 115;
}

function hasColon(line: string, from: number, to: number): boolean {
    for (let i = from; i < to; i += 1) {
        if (line.charCodeAt(i) === 58) return true;
    }
    return false;
}

function startsWith(line: string, at: number, word: string): boolean {
    if (at + word.length > line.length) return false;
    for (let i = 0; i < word.length; i += 1) {
        if (line.charCodeAt(at + i) !== word.charCodeAt(i)) return false;
    }
    return true;
}
