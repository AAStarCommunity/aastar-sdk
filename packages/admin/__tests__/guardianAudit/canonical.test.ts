import { describe, expect, it } from 'vitest';
import { GuardianAuditInputError, canonicalJson, exceedsUtf8Bytes, snapshotPlain } from '../../src/guardianAudit/canonical';
import { validateRuleset } from '../../src/guardianAudit/rules';

describe('guardian-audit canonical json (unit, not acceptance)', () => {
    it('sorts object keys by UTF-16 code unit and omits undefined properties', () => {
        expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
        expect(canonicalJson({ a: 1, b: undefined, c: 2 })).toBe('{"a":1,"c":2}');
        expect(canonicalJson({ b: undefined })).toBe('{}');
        const shared = { n: 1 };
        expect(canonicalJson({ b: shared, a: shared })).toBe('{"a":{"n":1},"b":{"n":1}}');
        expect(canonicalJson({ b: { d: 1, c: [true, null] }, a: 'x' })).toBe('{"a":"x","b":{"c":[true,null],"d":1}}');
    });

    it('encodes bigint as a decimal string and lowercases only 0x-prefixed hex', () => {
        expect(canonicalJson(1n)).toBe('"1"');
        expect(canonicalJson(-42n)).toBe('"-42"');
        expect(canonicalJson(123456789012345678901234567890n)).toBe('"123456789012345678901234567890"');
        expect(canonicalJson('0xAbC')).toBe('"0xabc"');
        expect(canonicalJson('0XAbC')).toBe('"0XAbC"');
        expect(canonicalJson('AbC')).toBe('"AbC"');
        expect(canonicalJson('zz 0xAB')).toBe('"zz 0xAB"');
        expect(canonicalJson(0)).toBe('0');
        expect(canonicalJson(-0)).toBe('0');
        expect(canonicalJson([1, 2])).toBe('[1,2]');
    });

    it('rejects NaN, non-integers, Map, Date, functions, class instances, and undefined array elements', () => {
        expect(() => canonicalJson(Number.NaN)).toThrow(/safe integer/);
        expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow(/safe integer/);
        expect(() => canonicalJson(1.5)).toThrow(/safe integer/);
        expect(() => canonicalJson(new Map())).toThrow(/^input rejected$/);
        expect(() => canonicalJson(new Set())).toThrow(/^input rejected$/);
        expect(() => canonicalJson(new Date())).toThrow(/^input rejected$/);
        expect(() => canonicalJson(() => 1)).toThrow(/unsupported/);
        class Box { x = 1; }
        expect(() => canonicalJson(new Box())).toThrow(/^input rejected$/);
        expect(() => canonicalJson([1, undefined])).toThrow(/^input rejected$/);
        const hole: unknown[] = [];
        hole.length = 1;
        expect(() => canonicalJson(hole)).toThrow(/^input rejected$/);
    });

    it('throws on a cycle instead of hanging', () => {
        const arr: unknown[] = [];
        arr.push(arr);
        expect(() => canonicalJson(arr)).toThrow(/^input rejected$/);
        const obj: Record<string, unknown> = {};
        obj.self = obj;
        expect(() => canonicalJson(obj)).toThrow(/^input rejected$/);
        const a: Record<string, unknown> = {};
        const b: Record<string, unknown> = { a };
        a.b = b;
        expect(() => canonicalJson(a)).toThrow(/^input rejected$/);
    });

    it('bounds a string before the hex regex and a bigint before toString', () => {
        expect(() => canonicalJson(`a${'b'.repeat(1_048_576)}`)).toThrow(/^input rejected$/);
        expect(() => canonicalJson({ ['k'.repeat(1_048_577)]: 1 })).toThrow(/^input rejected$/);
        expect(() => canonicalJson(1n << 2000n)).toThrow(/bigint too long/);
        expect(canonicalJson(1n << 1023n).length).toBeGreaterThan(2);
    });

    it('throws when the node count exceeds 1_000_000', () => {
        const wide = new Array<number>(1_000_000).fill(1);
        expect(() => canonicalJson(wide)).toThrow(/^input rejected$/);
    });

    it('collides a bigint with its decimal string and not with a JSON number', () => {
        expect(canonicalJson(123n)).toBe(canonicalJson('123'));
        expect(canonicalJson(123n)).not.toBe(canonicalJson(123));
        expect(canonicalJson(1n)).toBe('"1"');
        expect(canonicalJson(1)).toBe('1');
    });

    it('reads each property value once', () => {
        let n = 0;
        const obj = {};
        Object.defineProperty(obj, 'a', { enumerable: true, get() { n += 1; return 1; } });
        expect(canonicalJson(obj)).toBe('{"a":1}');
        expect(n).toBe(1);
    });

    it('canonicalises a null-prototype object and an own __proto__ key', () => {
        const obj = Object.create(null) as Record<string, number>;
        obj.b = 1;
        obj.a = 2;
        expect(canonicalJson(obj)).toBe('{"a":2,"b":1}');
        const proto = Object.create(null) as Record<string, unknown>;
        Object.defineProperty(proto, '__proto__', { value: { p: 1 }, enumerable: true });
        expect(canonicalJson(proto)).toBe('{"__proto__":{"p":1}}');
        expect((Object.prototype as { p?: number }).p).toBeUndefined();
    });

    it('snapshots array length before a getter appends elements', () => {
        const items: number[] = [];
        Object.defineProperty(items, '0', {
            enumerable: true,
            configurable: true,
            get() {
                for (let i = 1; i <= 1_000_000; i++) items.push(i);
                return 1;
            },
        });
        items.length = 1;
        expect(canonicalJson(items)).toBe('[1]');
    });

    it('stops encoding once the UTF-8 size passes 64 MiB', () => {
        let reads = 0;
        const obj: Record<string, string> = {};
        const blob = 'a'.repeat(1_000_000);
        for (let i = 0; i < 80; i++) {
            const key = `b${String(i).padStart(2, '0')}`;
            Object.defineProperty(obj, key, {
                enumerable: true,
                get() {
                    reads += 1;
                    return blob;
                },
            });
        }
        expect(() => canonicalJson(obj)).toThrow(/^input rejected$/);
        expect(reads).toBeGreaterThan(10);
        expect(reads).toBeLessThan(80);
    });

    it('stops encoding once escaped output passes 64 MiB', () => {
        const blob = '\u0000'.repeat(1_000_000);
        const obj: Record<string, string> = {};
        for (let i = 0; i < 12; i++) obj[`n${i}`] = blob;
        expect(() => canonicalJson(obj)).toThrow(/^canonical: output too large$/);
    }, 120_000);

    it('rejects a non-integer byte limit and a NaN node budget', () => {
        expect(() => exceedsUtf8Bytes('abc', Number.NaN)).toThrow(/^input rejected$/);
        expect(() => exceedsUtf8Bytes('abc', Number.POSITIVE_INFINITY)).toThrow(/^input rejected$/);
        expect(() => exceedsUtf8Bytes('abc', -1)).toThrow(/^input rejected$/);
        expect(exceedsUtf8Bytes('abc', 2)).toBe(true);
        expect(exceedsUtf8Bytes('abc', 3)).toBe(false);
        const huge = Array<number>(1_000_001).fill(0);
        expect(() => snapshotPlain(huge, { nodes: Number.NaN, bytes: Number.NaN })).toThrow(/^input rejected$/);
        expect(() => snapshotPlain(huge, { nodes: 0, bytes: 0 })).toThrow(/^input rejected$/);
        let reads = 0;
        const budget = {} as { nodes: number; bytes: number };
        Object.defineProperty(budget, 'nodes', {
            configurable: true,
            get() { reads += 1; return 0; },
            set() { /* write-back must not read */ },
        });
        Object.defineProperty(budget, 'bytes', {
            configurable: true,
            get() { reads += 1; return 0; },
            set() { /* write-back must not read */ },
        });
        expect(snapshotPlain({ a: 1 }, budget)).toEqual({ a: 1 });
        expect(reads).toBe(2);
        const shared = { nodes: 0, bytes: 0 };
        snapshotPlain({ a: 1 }, shared);
        expect(shared.nodes).toBeGreaterThan(0);
        expect(shared.bytes).toBeGreaterThan(0);
    });

    it('replaces a foreign GuardianAuditInputError and a prototype-trap proxy with a fresh input error', () => {
        const secret = 'https://secret/token';
        const planted = new GuardianAuditInputError();
        planted.message = secret;
        (planted as { cause?: unknown }).cause = new Error(secret);
        const trap = new Error(secret);
        (trap as { cause?: unknown }).cause = new Error(secret);
        const proxy = new Proxy(trap, { getPrototypeOf() { throw trap; } });
        const assertFresh = (run: () => unknown): void => {
            try {
                run();
                throw new Error('expected rejection');
            } catch (e) {
                const err = e as Error & { cause?: unknown };
                const causeText = err.cause instanceof Error ? `${err.cause.message} ${err.cause.stack ?? ''}` : String(err.cause ?? '');
                expect(`${err.name} ${err.message} ${err.stack ?? ''} ${causeText}`).not.toContain('secret');
                expect(err.message).toBe('input rejected');
                expect(err.cause).toBeUndefined();
            }
        };
        const viaKeys = (thrown: unknown): object => new Proxy({ a: 1 }, { ownKeys() { throw thrown; } });
        assertFresh(() => canonicalJson(viaKeys(planted)));
        assertFresh(() => validateRuleset(viaKeys(planted)));
        assertFresh(() => canonicalJson(viaKeys(proxy)));
        assertFresh(() => validateRuleset(viaKeys(proxy)));
        const box: Record<string, unknown> = {};
        Object.defineProperty(box, 'a', { enumerable: true, get() { throw planted; } });
        assertFresh(() => canonicalJson(box));
        const hostile = {} as { nodes: number; bytes: number };
        Object.defineProperty(hostile, 'nodes', { get() { throw planted; } });
        Object.defineProperty(hostile, 'bytes', { get() { return 0; } });
        assertFresh(() => snapshotPlain({ a: 1 }, hostile));
        const setter = { nodes: 0, bytes: 0 };
        Object.defineProperty(setter, 'bytes', { configurable: true, get() { return 0; }, set() { throw proxy; } });
        assertFresh(() => snapshotPlain({ a: 1 }, setter));
    });
});
