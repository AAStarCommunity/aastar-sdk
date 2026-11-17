// Test-only preload (NODE_OPTIONS=--import=<this file>): every outbound TCP connection to a non-loopback host is
// recorded in $NO_EGRESS_LOG and then refused. Loopback (the test's own JSON-RPC server) is allowed through.
// fetch (undici), http, https and tls all end in net.Socket#connect, so this sees Telegram and any public RPC.
import net from 'node:net';
import { appendFileSync } from 'node:fs';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const log = process.env.NO_EGRESS_LOG;
const original = net.Socket.prototype.connect;

net.Socket.prototype.connect = function connect(...args) {
    const first = args[0];
    const opts = Array.isArray(first) ? first[0] : first;
    const host = typeof opts === 'object' && opts !== null ? (opts.host ?? opts.hostname ?? 'localhost') : (typeof args[1] === 'string' ? args[1] : 'localhost');
    const isPipe = typeof opts === 'object' && opts !== null && typeof opts.path === 'string';
    if (!isPipe && !LOOPBACK.has(String(host))) {
        if (log) appendFileSync(log, `${String(host)}\n`);
        process.nextTick(() => this.destroy(new Error(`no-egress: blocked connection to ${String(host)}`)));
        return this;
    }
    return original.apply(this, args);
};
