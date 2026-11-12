import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/guardianAudit/canonical';

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
        expect(() => canonicalJson(new Map())).toThrow(/unsupported/);
        expect(() => canonicalJson(new Set())).toThrow(/unsupported/);
        expect(() => canonicalJson(new Date())).toThrow(/unsupported/);
        expect(() => canonicalJson(() => 1)).toThrow(/unsupported/);
        class Box { x = 1; }
        expect(() => canonicalJson(new Box())).toThrow(/unsupported/);
        expect(() => canonicalJson([1, undefined])).toThrow(/undefined array element/);
        const hole: unknown[] = [];
        hole.length = 1;
        expect(() => canonicalJson(hole)).toThrow(/undefined array element/);
    });

    it('throws on a cycle instead of hanging', () => {
        const arr: unknown[] = [];
        arr.push(arr);
        expect(() => canonicalJson(arr)).toThrow(/cycle/);
        const obj: Record<string, unknown> = {};
        obj.self = obj;
        expect(() => canonicalJson(obj)).toThrow(/cycle/);
        const a: Record<string, unknown> = {};
        const b: Record<string, unknown> = { a };
        a.b = b;
        expect(() => canonicalJson(a)).toThrow(/cycle/);
    });

    it('bounds a string before the hex regex and a bigint before toString', () => {
        expect(() => canonicalJson(`a${'b'.repeat(1_048_576)}`)).toThrow(/string too long/);
        expect(() => canonicalJson({ ['k'.repeat(1_048_577)]: 1 })).toThrow(/string too long/);
        expect(() => canonicalJson(1n << 2000n)).toThrow(/bigint too long/);
        expect(canonicalJson(1n << 1023n).length).toBeGreaterThan(2);
    });

    it('throws when the node count exceeds 1_000_000', () => {
        const wide = new Array<number>(1_000_000).fill(1);
        expect(() => canonicalJson(wide)).toThrow(/node budget/);
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
});
