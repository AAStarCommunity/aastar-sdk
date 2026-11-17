// Run under no-egress.preload.mjs by keeperKey.test.ts: every attempt below must be recorded and must fail.
// Targets are unroutable or reserved (RFC 5737 TEST-NET, .invalid), so a broken guard still reaches nothing real.
import net from 'node:net';
import dns from 'node:dns';
import dgram from 'node:dgram';
import { spawn } from 'node:child_process';

const results = {};
const attempt = async (name, fn) => {
    try { await fn(); results[name] = 'SUCCEEDED'; } catch { results[name] = 'refused'; }
};
await attempt('fetch', () => fetch('http://192.0.2.1:80/', { signal: AbortSignal.timeout(3000) }));
await attempt('tcp-other-loopback-port', () => new Promise((res, rej) => {
    const s = net.connect({ host: '127.0.0.1', port: 1 }); s.on('connect', res); s.on('error', rej);
}));
await attempt('tcp-custom-lookup', () => new Promise((res, rej) => {
    const s = net.connect({ host: 'localhost', port: Number(process.env.NO_EGRESS_ALLOW_PORTS), lookup: (_h, _o, cb) => cb(null, '192.0.2.1', 4) });
    s.on('connect', res); s.on('error', rej);
}));
await attempt('dns-resolve', () => dns.promises.resolve4('egress-selftest.invalid'));
await attempt('dns-lookup', () => new Promise((res, rej) => dns.lookup('egress-selftest.invalid', (e) => (e ? rej(e) : res()))));
await attempt('udp', () => { dgram.createSocket('udp4'); });
await attempt('subprocess', () => new Promise((res, rej) => { const c = spawn('cast', ['--version']); c.on('spawn', res); c.on('error', rej); }));
await attempt('allowed-loopback', () => fetch(`http://127.0.0.1:${process.env.NO_EGRESS_ALLOW_PORTS}/`, { method: 'POST', body: '{}' }).then((r) => r.text()));
console.log(JSON.stringify(results));
