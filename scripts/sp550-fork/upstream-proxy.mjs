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
const UPSTREAM_TIMEOUT_MS = 120_000;
// fetch() refuses a URL with credentials: they travel as a Basic Authorization header, the fetch URL carries none.
const auth = upstream.username || upstream.password
    ? 'Basic ' + Buffer.from(`${decodeURIComponent(upstream.username)}:${decodeURIComponent(upstream.password)}`).toString('base64') : undefined;
const target = new URL(upstream.href); target.username = ''; target.password = '';
// Every part of the URL that could carry a key, scrubbed from anything the upstream sends back.
const secrets = [upstream.href, target.href, `${target.pathname}${target.search}`, upstream.username, upstream.password]
    .filter((x) => x && x.length >= 6 && x !== '/').sort((a, b) => b.length - a.length);
const scrub = (t) => secrets.reduce((acc, x) => acc.split(x).join('…'), t);
const rpcError = (message) => JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message } });

const server = http.createServer(async (req, res) => {
    // The whole request lifecycle is inside one catch: an aborted upload or a dead upstream answers, never crashes.
    try {
        if (req.method !== 'POST') { res.writeHead(405).end(); return; }
        const parts = [];
        let size = 0;
        for await (const c of req) { size += c.length; if (size > MAX_BODY) { res.writeHead(413).end(); return; } parts.push(c); }
        const r = await fetch(target, {
            method: 'POST', body: Buffer.concat(parts), signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
            headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
        });
        const text = await r.text();
        // JSON = the body parses as JSON (a node may omit or mislabel the content-type).
        let json = true; try { JSON.parse(text); } catch { json = false; }
        // A non-JSON page (a provider's HTML error) is replaced; a JSON body is passed on with any URL part scrubbed.
        const body = json ? scrub(text) : rpcError(`upstream HTTP ${r.status} (non-JSON body withheld)`);
        res.writeHead(json ? r.status : 502, { 'content-type': 'application/json' }).end(body);
    } catch (e) {
        // The error text of a failed fetch can quote the URL: answer with its class only.
        if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' }).end(rpcError(`upstream unreachable (${e?.name ?? 'error'})`));
        else res.destroy();
    }
});
server.on('clientError', (_e, sock) => sock.destroy());
server.listen(port, '127.0.0.1', () => console.log(`READY ${port}`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
