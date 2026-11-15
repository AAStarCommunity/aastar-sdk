/**
 * Drives every exported write action with inputs synthesized from its declared TypeScript parameter types,
 * captures what it hands to viem, and encodes that for real against the ABI it passed. No mock of the action.
 *
 * Inputs: Address -> a fixed address, Hex / `0x${string}` -> a 32-byte marker word, bigint -> 1n, number -> 1,
 * string -> 'x', boolean -> true, arrays -> one element, objects -> their required properties. `account` is left out.
 * The marker word is resized only where the ABI parameter is `bytesN`; anywhere else it is encoded as given, so a
 * Hex passed where the ABI wants an address fails, as it should.
 */
import ts from 'typescript';
import { encodeFunctionData, type Abi, type AbiParameter } from 'viem';

export const ADDR = '0x1111111111111111111111111111111111111111' as const;
export const MARKER = `0x${'ab'.repeat(32)}` as const;

export type Outcome =
    | { kind: 'write'; calls: { functionName: string; ok: boolean; error?: string }[] }
    | { kind: 'not-implemented'; message: string }
    | { kind: 'read' }
    | { kind: 'undriven'; message: string };

export interface MethodResult { factory: string; method: string; outcome: Outcome }

function makeProgram(files: string[]): ts.Program {
    return ts.createProgram(files, {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
        strict: true, skipLibCheck: true, resolveJsonModule: true, noEmit: true,
    });
}

function signatureInputs(checker: ts.TypeChecker, sig: ts.Signature, at: ts.Node): unknown[] {
    return sig.getParameters().map((p) => {
        const decl = p.valueDeclaration ?? at;
        const optional = !!(decl as ts.ParameterDeclaration).questionToken || !!(decl as ts.ParameterDeclaration).initializer;
        const v = value(checker, checker.getTypeOfSymbolAtLocation(p, decl), p.name, 0, declaredText(decl));
        // An optional trailing `options` / `account` parameter is left to its default.
        return optional && /options|account|overrides/i.test(p.name) ? undefined : v;
    });
}

/**
 * Method name -> synthesized argument list for each public method of the named classes, inherited ones included.
 * Private, protected and `_`-prefixed members are skipped.
 */
export function synthesizeClassInputs(files: string[], classNames: string[]): Map<string, Map<string, unknown[]>> {
    const program = makeProgram(files);
    const checker = program.getTypeChecker();
    const out = new Map<string, Map<string, unknown[]>>();
    for (const file of files) {
        const sf = program.getSourceFile(file);
        if (!sf) throw new Error(`cannot load ${file}`);
        ts.forEachChild(sf, (node) => {
            if (!ts.isClassDeclaration(node) || !node.name || !classNames.includes(node.name.text)) return;
            const instance = checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(node.name)!);
            const methods = new Map<string, unknown[]>();
            for (const prop of checker.getPropertiesOfType(instance)) {
                if (prop.name.startsWith('_')) continue;
                const decl = prop.valueDeclaration ?? prop.declarations?.[0];
                if (!decl || !(ts.isMethodDeclaration(decl) || ts.isPropertyDeclaration(decl))) continue;
                const mods = ts.getCombinedModifierFlags(decl as ts.Declaration);
                if (mods & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) continue;
                const sig = checker.getTypeOfSymbolAtLocation(prop, decl).getCallSignatures()[0];
                if (!sig) continue;
                methods.set(prop.name, signatureInputs(checker, sig, decl));
            }
            out.set(node.name.text, methods);
        });
    }
    return out;
}

/** Method name -> synthesized argument list, per `<Name>Actions` type in the given source files. */
export function synthesizeInputs(files: string[], typeNames: string[]): Map<string, Map<string, unknown[]>> {
    const program = makeProgram(files);
    const checker = program.getTypeChecker();
    const out = new Map<string, Map<string, unknown[]>>();
    for (const file of files) {
        const sf = program.getSourceFile(file);
        if (!sf) throw new Error(`cannot load ${file}`);
        ts.forEachChild(sf, (node) => {
            if (!ts.isTypeAliasDeclaration(node) || !typeNames.includes(node.name.text)) return;
            const type = checker.getTypeAtLocation(node.name);
            const methods = new Map<string, unknown[]>();
            for (const prop of checker.getPropertiesOfType(type)) {
                const propType = checker.getTypeOfSymbolAtLocation(prop, node);
                const sig = propType.getCallSignatures()[0];
                if (!sig) continue;
                methods.set(prop.name, sig.getParameters().map((p) => {
                    const decl = p.valueDeclaration ?? node;
                    return value(checker, checker.getTypeOfSymbolAtLocation(p, decl), p.name, 0, declaredText(decl));
                }));
            }
            out.set(node.name.text, methods);
        });
    }
    return out;
}

/** The type as written at the declaration (`Address`, `Hex`, ...). Aliases of `0x${string}` are lost after resolution. */
function declaredText(decl: ts.Node | undefined): string | undefined {
    const t = decl && (decl as any).type as ts.TypeNode | undefined;
    return t ? t.getText().replace(/\s+/g, ' ') : undefined;
}

const ADDRESSY = /address|account|operator|user|owner|spender|recipient|^to$|^from$|token|validator|target|community|paymaster|factory|registry|wallet|signer|guardian|agent|implementation|receiver|beneficiary|treasury|^v$|admin/i;
const NOT_ADDRESS = /p256|hash|sig|root|salt|key|proof|data|nonce|selector/i;
const addressy = (name: string) => ADDRESSY.test(name) && !NOT_ADDRESS.test(name);

function value(checker: ts.TypeChecker, type: ts.Type, name: string, depth: number, written?: string): unknown {
    if (depth > 6) return undefined;
    const alias = type.aliasSymbol?.name ?? written;
    if (alias === 'Address' || alias === '`0x${string}` | Address') return ADDR;
    if (alias === 'Hex' || alias === 'Hash' || alias === '`0x${string}`') return alias === '`0x${string}`' && addressy(name) ? ADDR : MARKER;
    if (alias === 'Address[]') return [ADDR];
    if (alias === 'Hex[]' || alias === 'Hash[]') return [MARKER];
    if (type.isUnion()) {
        const members = type.types.filter((t) => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)));
        // Prefer a non-literal member (e.g. `Address` over a literal) only when every member is the same primitive.
        const pick = members.find((t) => !(t.flags & ts.TypeFlags.BooleanLiteral)) ?? members[0];
        if (members.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)) return true;
        return pick ? value(checker, pick, name, depth + 1) : undefined;
    }
    if (type.flags & ts.TypeFlags.TemplateLiteral) return addressy(name) ? ADDR : MARKER;
    if (type.isStringLiteral()) return type.value;
    if (type.isNumberLiteral()) return type.value;
    if (type.flags & ts.TypeFlags.BigIntLiteral) return BigInt((type as ts.BigIntLiteralType).value.base10Value);
    if (type.flags & ts.TypeFlags.String) return 'x';
    if (type.flags & ts.TypeFlags.Number) return 1;
    if (type.flags & ts.TypeFlags.BigInt) return 1n;
    if (type.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) return true;
    if (checker.isArrayType(type)) {
        const elem = (type as ts.TypeReference).typeArguments?.[0];
        return elem ? [value(checker, elem, name, depth + 1)] : [];
    }
    if (checker.isTupleType(type)) {
        return ((type as ts.TypeReference).typeArguments ?? []).map((t, i) => value(checker, t, `${name}${i}`, depth + 1));
    }
    if (type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) {
        if (type.getCallSignatures().length > 0) return undefined;
        const obj: Record<string, unknown> = {};
        for (const prop of checker.getPropertiesOfType(type)) {
            if (prop.flags & ts.SymbolFlags.Optional) continue;
            const decl = prop.valueDeclaration ?? prop.declarations?.[0];
            if (!decl) continue;
            obj[prop.name] = value(checker, checker.getTypeOfSymbolAtLocation(prop, decl), prop.name, depth + 1, declaredText(decl));
        }
        return obj;
    }
    return undefined;
}

/** Resize the marker word where the ABI parameter is bytesN; leave everything else as the SDK passed it. */
function fit(param: AbiParameter, v: unknown): unknown {
    const type = param.type;
    if (type.endsWith(']')) {
        const inner = { ...param, type: type.slice(0, type.lastIndexOf('[')) } as AbiParameter;
        return Array.isArray(v) ? v.map((x) => fit(inner, x)) : v;
    }
    if (type === 'tuple') {
        const comps = (param as any).components as AbiParameter[];
        if (Array.isArray(v)) return v.map((x, i) => (comps[i] ? fit(comps[i], x) : x));
        if (v && typeof v === 'object') {
            const o: Record<string, unknown> = { ...(v as Record<string, unknown>) };
            for (const c of comps) if (c.name && c.name in o) o[c.name] = fit(c, o[c.name]);
            return o;
        }
        return v;
    }
    const m = /^bytes(\d+)$/.exec(type);
    if (m && v === MARKER) return `0x${'ab'.repeat(Number(m[1]))}`;
    return v;
}

export function encodeCaptured(req: { abi: Abi; functionName: string; args?: readonly unknown[] }): { ok: boolean; error?: string } {
    const fns = (req.abi as any[]).filter((i) => i.type === 'function' && i.name === req.functionName);
    if (fns.length === 0) return { ok: false, error: `function ${req.functionName} not in the ABI it was sent with` };
    const args = req.args ?? [];
    const errors: string[] = [];
    for (const fn of fns) {
        if ((fn.inputs ?? []).length !== args.length) {
            errors.push(`arity ${args.length} vs ${(fn.inputs ?? []).length}`);
            continue;
        }
        const fitted = args.map((a, i) => fit(fn.inputs[i], a));
        try {
            encodeFunctionData({ abi: [fn], functionName: req.functionName, args: fitted } as any);
            return { ok: true };
        } catch (error) {
            errors.push(String((error as Error).message).split('\n')[0]!);
        }
    }
    return { ok: false, error: errors.join(' | ') };
}

/** A value of the ABI output type, shaped the way viem returns it (structs as objects keyed by component name). */
function synthOutput(param: AbiParameter, bools: boolean): unknown {
    const type = param.type;
    if (type.endsWith(']')) return [synthOutput({ ...param, type: type.slice(0, type.lastIndexOf('[')) } as AbiParameter, bools)];
    if (type === 'tuple') {
        const comps = (param as any).components as AbiParameter[];
        if (comps.every((c) => c.name)) return Object.fromEntries(comps.map((c) => [c.name, synthOutput(c, bools)]));
        return comps.map((c) => synthOutput(c, bools));
    }
    if (type === 'address') return ADDR;
    if (type === 'bool') return bools;
    if (type === 'string') return 'x';
    if (type === 'bytes') return '0x';
    const m = /^bytes(\d+)$/.exec(type);
    if (m) return `0x${'00'.repeat(Number(m[1]))}`;
    if (/^u?int/.test(type)) return 1n;
    return undefined;
}

/** A client that records writes and answers each read with a value of the ABI's declared output shape. */
export function capturingClient(answers: boolean | boolean[] = false) {
    const writes: any[] = [];
    const queue = Array.isArray(answers) ? [...answers] : null;
    const nextBool = () => (queue ? (queue.length > 1 ? queue.shift()! : queue[0] ?? false) : answers as boolean);
    const client: any = {
        account: { address: ADDR, type: 'json-rpc' },
        chain: { id: 11155111 },
        async writeContract(req: any) { writes.push(req); return `0x${'00'.repeat(32)}`; },
        async simulateContract(req: any) { writes.push(req); return { request: req, result: undefined }; },
        async readContract(req: any) {
            const fn = (req?.abi as any[] | undefined)?.find((i) => i.type === 'function' && i.name === req.functionName
                && (i.inputs ?? []).length === (req.args ?? []).length);
            if (!fn) return 1n;
            const outs = (fn.outputs ?? []) as AbiParameter[];
            if (outs.length === 0) return undefined;
            const bools = outs.length === 1 && outs[0]!.type === 'bool' ? nextBool() : (queue ? queue[0] ?? false : answers as boolean);
            return outs.length === 1 ? synthOutput(outs[0]!, bools) : outs.map((o) => synthOutput(o, bools));
        },
        async getChainId() { return 11155111; },
        async getBlockNumber() { return 1n; },
        async getLogs() { return []; },
        async getStorageAt() { return `0x${'00'.repeat(32)}`; },
        async call() { return { data: '0x' }; },
        async request() { return null; },
    };
    return { client, writes };
}

export async function drive(
    factory: string, make: (client: any) => Record<string, any>, inputs: Map<string, unknown[]>,
    overrides: Record<string, unknown[]> = {},
    /** Per method: the answers to successive boolean reads, for writes guarded by two different checks. */
    boolAnswers: Record<string, boolean[]> = {},
): Promise<MethodResult[]> {
    const results: MethodResult[] = [];
    for (const [method, synthesized] of inputs) {
        const args = overrides[method] ?? synthesized;
        // Reads answer `false` first, then `true`: a write guarded by a boolean read (e.g. "already registered") runs
        // under one of them. The first variant that reaches a write wins.
        let outcome: Outcome | null = null;
        for (const bools of (boolAnswers[method] ? [boolAnswers[method]!] : [false, true])) {
            const got = await attempt(make, method, args, bools);
            if (got === null) break;
            outcome = got;
            if (got.kind === 'write') break;
        }
        if (outcome) results.push({ factory, method, outcome });
    }
    return results;
}

async function attempt(make: (client: any) => Record<string, any>, method: string, args: unknown[], bools: boolean | boolean[]): Promise<Outcome | null> {
    {
        const { client, writes } = capturingClient(bools);
        const actions = make(client);
        if (typeof actions[method] !== 'function') return null;
        let outcome: Outcome;
        try {
            await actions[method](...args);
            outcome = writes.length === 0
                ? { kind: 'read' }
                : { kind: 'write', calls: writes.map((w) => ({ functionName: w.functionName, ...encodeCaptured(w) })) };
        } catch (error: any) {
            if (writes.length > 0) {
                outcome = { kind: 'write', calls: writes.map((w) => ({ functionName: w.functionName, ...encodeCaptured(w) })) };
            } else if (error?.code === 'E4001') {
                outcome = { kind: 'not-implemented', message: String(error.message).slice(0, 160) };
            } else {
                outcome = { kind: 'undriven', message: String(error?.message ?? error).split('\n')[0]!.slice(0, 200) };
            }
        }
        return outcome;
    }
}


/** A client config whose every `...Address` field is ADDR, with the capturing client as both clients. */
export function capturingConfig(client: any): any {
    return new Proxy({ client, publicClient: client, chainId: 11155111 } as Record<string, unknown>, {
        get(target, key) {
            if (typeof key === 'string' && key in target) return target[key];
            if (typeof key === 'string' && /Address$/.test(key)) return ADDR;
            return undefined;
        },
        has(target, key) { return typeof key === 'string' && (key in target || /Address$/.test(key)); },
    });
}
