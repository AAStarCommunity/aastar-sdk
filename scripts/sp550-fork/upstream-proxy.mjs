#!/usr/bin/env node
/**
 * A loopback JSON-RPC forwarder in front of the fork source (Daybreak #468 M3). The upstream URL usually embeds a
 * provider key; anvil takes its fork source only as `--fork-url` (argv: visible to `ps`, anvil 1.7.1 --help lists no
 * env or file form), and the read-back child needs it as SP550_FORK_URL. With this proxy both get
 * http://127.0.0.1:<port> instead, and the URL itself lives only in this process's memory: it is read from stdin
 * (never argv, never env), and no log line, error or response ever contains it.
 *
 *   printf '%s\n' "$FORK_URL" | node upstream-proxy.mjs <port>     # prints "READY <port>" once listening
 */
import http from 'node:http';

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) { console.error('usage: upstream-proxy.mjs <port 1024..65535> (URL on stdin)'); process.exit(2); }

let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) { input += chunk; if (input.length > 4096) break; }
const raw = input.split('\n')[0].trim();
let upstream;
try { upstream = new URL(raw); } catch { console.error('upstream-proxy: stdin is not a URL'); process.exit(2); }
if (!['http:', 'https:'].includes(upstream.protocol)) { console.error('upstream-proxy: the upstream must be http(s)'); process.exit(2); }
// --test-loopback-upstream: the proxy's own test only (its fake upstream is local); the flag carries no secret.
if (!process.argv.includes('--test-loopback-upstream') && ['127.0.0.1', 'localhost', '[::1]'].includes(upstream.hostname)) { console.error('upstream-proxy: the upstream is a loopback address; it must be the remote fork source'); process.exit(2); }
const MAX_BODY = 16 << 20;

const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    const parts = [];
    let size = 0;
    for await (const c of req) { size += c.length; if (size > MAX_BODY) { res.writeHead(413).end(); return; } parts.push(c); }
    try {
        const r = await fetch(upstream, { method: 'POST', headers: { 'content-type': 'application/json' }, body: Buffer.concat(parts) });
        const body = Buffer.from(await r.arrayBuffer());
        res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'application/json' }).end(body);
    } catch (e) {
        // The error text of a failed fetch can quote the URL: answer with its class only.
        res.writeHead(502, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: `upstream unreachable (${e?.name ?? 'error'})` } }));
    }
});
server.listen(port, '127.0.0.1', () => console.log(`READY ${port}`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
