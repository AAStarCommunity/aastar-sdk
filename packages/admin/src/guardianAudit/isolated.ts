/**
 * structuredClone that refuses shared memory. structuredClone keeps a SharedArrayBuffer (and views
 * over one) pointing at the same backing store, so a "copy" would still alias the caller (#445 Codex M3).
 */
export function isolatedClone<T>(value: T): T {
    const out = structuredClone(value);
    assertNoSharedMemory(out);
    return out;
}

const SAB: (new (n: number) => unknown) | undefined = (globalThis as { SharedArrayBuffer?: new (n: number) => unknown }).SharedArrayBuffer;

function isShared(v: unknown): boolean {
    if (SAB === undefined) return false;
    if (v instanceof SAB) return true;
    return ArrayBuffer.isView(v) && v.buffer instanceof SAB;
}

function assertNoSharedMemory(root: unknown): void {
    const seen = new Set<object>();
    const stack: unknown[] = [root];
    while (stack.length > 0) {
        const v = stack.pop();
        if (typeof v !== 'object' || v === null) continue;
        if (seen.has(v)) continue;
        seen.add(v);
        if (isShared(v)) throw new TypeError('shared memory is not allowed');
        if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer) continue;
        if (v instanceof Map) {
            for (const [k, item] of v) stack.push(k, item);
            continue;
        }
        if (v instanceof Set) {
            for (const item of v) stack.push(item);
            continue;
        }
        for (const key of Object.keys(v)) stack.push((v as Record<string, unknown>)[key]);
    }
}
