/**
 * Minimal EIP-1193 surface plus an HTTP JSON-RPC transport that never puts its URL in an error.
 *
 * RPC URLs often embed an API key (path segment or query string), so the URL is a secret here.
 * Two layers keep it out of the output: the transport builds its own error messages without the
 * URL, and `makeRedactor` scrubs every line before it is printed, because lower layers (fetch /
 * undici `cause` text) can still echo the host or the full URL.
 */

export interface Eip1193Provider {
    request(args: { method: string; params?: readonly unknown[] }): Promise<unknown>;
}

export type ProviderLabel = 'A' | 'B';
export interface NamedProvider { label: ProviderLabel; provider: Eip1193Provider }

export type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
}>;

function errorText(e: unknown): string {
    if (!(e instanceof Error)) return String(e);
    const cause = (e as { cause?: unknown }).cause;
    return cause instanceof Error ? `${e.message} (${cause.message})` : e.message;
}

export function httpProvider(url: string, fetchImpl: FetchLike = fetch as unknown as FetchLike, timeoutMs = 30_000): Eip1193Provider {
    let id = 0;
    return {
        async request({ method, params }) {
            let res;
            try {
                res = await fetchImpl(url, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: params ?? [] }),
                    signal: AbortSignal.timeout(timeoutMs),
                });
            } catch (e) {
                // The underlying message may name the host or the URL; the caller's redactor scrubs it.
                throw new Error(`transport error on ${method}: ${errorText(e)}`);
            }
            if (!res.ok) throw new Error(`HTTP ${res.status} on ${method}`);
            const body = (await res.json()) as { result?: unknown; error?: { code?: number; message?: string } };
            if (body && body.error) throw new Error(`RPC error ${body.error.code ?? '?'} on ${method}: ${body.error.message ?? ''}`);
            return body?.result;
        },
    };
}

/**
 * Every substring of `url` that could identify the endpoint or its credentials: the URL itself,
 * its origin, host, userinfo, and every path segment / query value of 6+ characters.
 */
export function secretFragments(url: string): string[] {
    const out = new Set<string>([url, url.replace(/\/+$/, '')]);
    try {
        const u = new URL(url);
        out.add(u.href);
        out.add(u.origin);
        out.add(u.host);
        if (u.hostname) out.add(u.hostname);
        if (u.username) out.add(u.username);
        if (u.password) out.add(u.password);
        for (const seg of u.pathname.split('/')) if (seg.length >= 6) { out.add(seg); out.add(decodeURIComponent(seg)); }
        for (const [k, v] of u.searchParams) { if (v.length >= 6) out.add(v); if (k.length >= 6) out.add(k); }
        if (u.search.length > 1) out.add(u.search);
    } catch {
        // Not parseable: only the literal string is known.
    }
    return [...out].filter(s => s.length >= 4).sort((x, y) => y.length - x.length);
}

export function makeRedactor(endpoints: { label: ProviderLabel; url: string }[]): (text: string) => string {
    const pairs = endpoints.flatMap(({ label, url }) => secretFragments(url).map(s => [s, `<rpc-${label}>`] as const));
    pairs.sort((x, y) => y[0].length - x[0].length);
    return (text: string) => {
        let t = text;
        for (const [s, r] of pairs) t = t.split(s).join(r);
        return t;
    };
}
