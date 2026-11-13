/**
 * structuredClone restricted to plain data. A clone must not alias the caller (#445 Codex M3, R2):
 * structuredClone keeps SharedArrayBuffer and shared WebAssembly.Memory pointing at the same storage,
 * and preserves containers (Error.cause, Map, ...) whose contents a key walk can miss. So instead of
 * hunting shared types, only these are accepted after cloning: primitives (including bigint), plain
 * objects, arrays, and Uint8Array over a non-shared ArrayBuffer. Anything else throws.
 */
export function isolatedClone<T>(value: T): T {
    const out = structuredClone(value);
    assertPlainData(out);
    return out;
}

function assertPlainData(root: unknown): void {
    const seen = new Set<object>();
    const stack: unknown[] = [root];
    while (stack.length > 0) {
        const v = stack.pop();
        if (v === null || typeof v !== 'object') {
            if (typeof v === 'function' || typeof v === 'symbol') throw new TypeError('only plain data is allowed');
            continue;
        }
        if (seen.has(v)) continue;
        seen.add(v);
        const proto = Object.getPrototypeOf(v);
        if (proto === Uint8Array.prototype) {
            if (Object.getPrototypeOf((v as Uint8Array).buffer) !== ArrayBuffer.prototype) {
                throw new TypeError('shared memory is not allowed');
            }
            continue;
        }
        if (proto !== Object.prototype && proto !== null && proto !== Array.prototype) {
            throw new TypeError('only plain data is allowed');
        }
        for (const key of Reflect.ownKeys(v)) {
            if (typeof key === 'symbol') throw new TypeError('only plain data is allowed');
            stack.push((v as Record<string, unknown>)[key]);
        }
    }
}
