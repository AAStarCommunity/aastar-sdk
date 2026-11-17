// Test-only preload (NODE_OPTIONS=--import=<this file>) for spawned keeper.ts runs. It records every attempt to
// leave the process in $NO_EGRESS_LOG and refuses it:
// - TCP (net.Socket#connect, which fetch/undici, http, https, tls and http2 all use): allowed only to a loopback IP
//   on a port in $NO_EGRESS_ALLOW_PORTS (the test's own JSON-RPC server). Unix sockets (except tsx's own
//   <tmp>/tsx-<uid>/<pid>.pipe IPC) and custom `lookup` functions are refused, so a name cannot be resolved to a non-loopback address behind this check.
// - DNS (dns / dns.promises lookup and resolve*): allowed only for `localhost`.
// - UDP (dgram.createSocket): always refused.
// - Subprocesses (child_process): allowed only for node itself (tsx re-executes it); anything else, e.g. `cast`,
//   is refused.
// It is a test guard for this process tree, not OS-level isolation.
import net from 'node:net';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

const LOG = process.env.NO_EGRESS_LOG;
const ALLOW_PORTS = new Set((process.env.NO_EGRESS_ALLOW_PORTS ?? '').split(',').filter(Boolean).map(Number));
const LOOPBACK_IP = new Set(['127.0.0.1', '::1', '[::1]']);
const TSX_IPC = /\/tsx-\d+\/\d+\.pipe$/;
const record = (what) => { if (LOG) appendFileSync(LOG, `${what}\n`); };
const refuse = (what) => { record(what); return new Error(`no-egress: refused ${what}`); };

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
    const first = args[0];
    const o = Array.isArray(first) ? first[0] : first;
    let host, port, path, lookup;
    if (o !== null && typeof o === 'object') ({ host, port, path, lookup } = o);
    else if (typeof first === 'string' && Number.isNaN(Number(first))) path = first;
    else { port = first; host = typeof args[1] === 'string' ? args[1] : undefined; }
    host = host === undefined || host === 'localhost' ? '127.0.0.1' : String(host);
    // tsx's own parent/child IPC pipe is local IPC, not egress; any other unix socket could front a proxy.
    if (path !== undefined && lookup === undefined && TSX_IPC.test(String(path))) return connect.apply(this, args);
    const ok = path === undefined && lookup === undefined && LOOPBACK_IP.has(host) && ALLOW_PORTS.has(Number(port));
    if (!ok) {
        const err = refuse(path !== undefined ? `tcp unix:${path}` : `tcp ${host}:${port}${lookup ? ' (custom lookup)' : ''}`);
        process.nextTick(() => this.destroy(err));
        return this;
    }
    return connect.apply(this, args);
};

const isLocalName = (name) => name === 'localhost' || LOOPBACK_IP.has(String(name));
const wrapDns = (obj, names, isPromise) => {
    for (const n of names) {
        const orig = obj[n];
        if (typeof orig !== 'function') continue;
        obj[n] = function (name, ...rest) {
            if (isLocalName(name)) return orig.call(this, name, ...rest);
            const err = refuse(`dns ${n} ${String(name)}`);
            if (isPromise) return Promise.reject(err);
            const cb = rest.find((x) => typeof x === 'function');
            if (cb) { process.nextTick(() => cb(err)); return undefined; }
            throw err;
        };
    }
};
const DNS_FNS = ['lookup', 'lookupService', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveNs', 'resolveTxt', 'resolveSrv', 'resolvePtr', 'resolveNaptr', 'resolveSoa', 'resolveCaa', 'reverse'];
wrapDns(dns, DNS_FNS, false);
wrapDns(dns.promises, DNS_FNS, true);
if (dns.Resolver) wrapDns(dns.Resolver.prototype, DNS_FNS.filter((n) => n.startsWith('resolve') || n === 'reverse'), false);
if (dns.promises.Resolver) wrapDns(dns.promises.Resolver.prototype, DNS_FNS.filter((n) => n.startsWith('resolve') || n === 'reverse'), true);

dgram.createSocket = function () { throw refuse('udp socket'); };

const isNode = (cmd) => cmd === process.execPath || cmd === 'node';
for (const n of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
    const orig = childProcess[n];
    childProcess[n] = function (cmd, ...rest) {
        if (n === 'fork' || isNode(cmd)) return orig.call(this, cmd, ...rest);
        throw refuse(`subprocess ${String(cmd).split(/\s/)[0]}`);
    };
}

// ESM named imports of builtins (`import { spawn } from 'child_process'`) only see the patches after this.
syncBuiltinESMExports();
