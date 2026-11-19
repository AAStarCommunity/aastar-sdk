#!/usr/bin/env tsx
/**
 * No UserOperation from a repo script on a chain that costs real money without a per-UserOp cost ceiling (DSR,
 * follow-up to #470). Parsed with the TypeScript compiler, not matched as text.
 *
 * A script / test / example file is a UserOp SENDER if it references any UserOp primitive (USEROP_PRIMITIVES: the
 * SDK's guarded send APIs, raw eth_sendUserOperation, handleOps, hashes read from the EntryPoint,
 * UserOpScenarioBuilder…), or imports a local module that is one. Every sender satisfies one of:
 *   R. every use of a hand-signing primitive is reached only after an awaited chain gate (CHAIN_GATES,
 *      tests/regression/userop-chain-gate.ts): earlier in the same function, or — for a non-exported local function —
 *      at every call site, or — for an anonymous callback / IIFE — where it is written. Exported functions, default
 *      exports and class methods need their own gate. The script refuses to run unless the endpoints report a test
 *      chain, so its signatures need no ceiling;
 *   L. its only primitives are the SDK send APIs, and EVERY send call passes `maxUserOpCostWei: <x>.maxUserOpCostWei`
 *      in its options argument, as the last word on that key, where <x> resolves (lexically) to a `const` initialised
 *      by a CAP_LOADERS call, to the parameter of a `.then` on one, or to a GaslessNetworkConfig parameter whose
 *      function first awaits assertGaslessNetworkConfig on it;
 *   G. every signature (signMessage / signTypedData / signUserOperation) is reached, in the same sense, only after an
 *      awaited guardUserOpSignature whose `maxUserOpCostWei` is a `const` from resolveUserOpCostCap;
 *   V. it is a reviewed exception (REVIEWED_SENDERS, with why).
 * A gate (or guard) counts only as a direct statement of its function body or of the top level (`await g(…);`,
 * `const x = await g(…);`): inside an if / try / loop it may not run, or its refusal may be swallowed. Without a cap
 * loader, the SDK send calls are uses rule R must cover, like hand-signing ones.
 *
 * Scope: this is a tripwire for the ways ordinary script code omits or misplaces the ceiling, not a proof about any
 * program (dynamic property access, eval, monkey-patching a client are beyond a syntactic check). What protects a run is
 * the runtime: the chain gate refuses non-test chains, and the SDK refuses an op above maxUserOpCostWei.
 * Rule L's per-call check applies to the send calls of any file that uses a cap loader, whichever of R / G / V holds;
 * writing to `.maxUserOpCostWei` (assignment, delete, Object.assign onto a bound config) fails anywhere.
 *
 * And one catch-all over packages/*\/src: a function whose name contains gasless / submit is either a send API or a
 * reviewed non-sender (NOT_GASLESS_SENDERS, with why), so a new send entry point cannot be added unclassified.
 *
 *   pnpm run check:gasless-cost-cap
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

/** The SDK's guarded send entry points, with the index of their options argument (maxUserOpCostWei goes there). */
export const GASLESS_SEND_APIS: Readonly<Record<string, number>> = {
    submitGaslessUserOperation: 8,
    submitGaslessTransaction: 5,
    executeGasless: 0,
    executeGaslessTx: 0,
};

/**
 * Names whose reference makes a file a UserOp sender (beyond the send APIs): `getUserOpHash*` matches by prefix, and any
 * `to…SmartAccount` (viem / permissionless account factories) by pattern. A smart-account client sends through generic
 * names (`sendTransaction`, `writeContract`), so the account / client factory is what marks the file.
 */
export const USEROP_PRIMITIVES = ['handleOps', 'signUserOperation', 'sendUserOperation', 'UserOpScenarioBuilder', 'getUserOpHash',
    'getUserOperationHash', 'createSmartAccountClient', 'AirAccountEIP1193Provider'] as const;
const SMART_ACCOUNT_FACTORY = /^to[A-Za-z0-9]*SmartAccount$/;
/** Modules every value import from which is a UserOp primitive (smart-account clients; the dapp EIP-1193 provider turns eth_sendTransaction into a UserOp). */
export const USEROP_MODULES = [/^permissionless(\/|$)/, /^@aastar\/dapp(\/|$)/] as const;
/** String literals whose presence makes a file a UserOp sender (a raw bundler call). */
export const USEROP_PRIMITIVE_STRINGS = ['eth_sendUserOperation'] as const;

/** The signer calls rule G holds to a guard. */
const SIGNING_CALLS = ['signMessage', 'signTypedData', 'signUserOperation'] as const;

/** Where a sending script gets its ceiling. */
export const CAP_LOADERS = ['loadGaslessNetworkConfig', 'gaslessCostCapFromEnv'] as const;
/** The chain gates of rule R (each refuses unless the endpoints report a test chain). */
export const CHAIN_GATES = ['refuseMainnetUserOps', 'verifiedTestChainEndpoints'] as const;

/** Senders that need none of R / L / G, each with why. An entry that no longer exists or no longer sends fails. */
export const REVIEWED_SENDERS: Readonly<Record<string, string>> = {
    'scripts/sp550-live-e2e.ts': 'the SP 5.5.0 live runner: maxUserOpCostWei = opMaxCostWei, required and equal to the frozen plan (#470)',
    'scripts/sp550-e2e-checks.ts': 'a module of the SP 5.5.0 runners (live / fork); the live runner holds every op to the plan (#470)',
    'scripts/sp550-local-e2e.ts': 'local anvil only: refuses any chain id other than 31337',
    'scripts/cc128/renew-funding-probe.ts': 'local anvil only: refuses any chain id other than 31337',
    'scripts/sp550-fork-542-compat.ts': 'local anvil fork only: refuses a node that does not answer anvil_nodeInfo with a fork',
    'scripts/sp550-fork-e2e.ts': 'local fork only: refuses a non-loopback RPC or bundler URL, and a chain other than the Sepolia fork',
    'tests/regression/onchain-evidence/gas-policy-local.ts': 'local anvil only: refuses an RPC or bundler not on chain 31337',
    'scripts/cc128/count-signatures.ts': 'stub public client and bundler; nothing is sent to a network',
    'packages/analytics/scripts/collect_paymaster_baselines.ts': 'read-only: decodes past handleOps transactions and reads their hashes (getUserOpHash); no signer, nothing sent',
    'tests/regression/l4-runner.ts': 'an orchestrator: runGaslessTests (l4-gasless.ts, exported) awaits refuseMainnetUserOps first',
    'scripts/repcredit-e2e.ts': 'its gate is conditional on the live modes (sepolia / deployed), where the RPC exists before main(); local mode starts its own anvil and waitRpc() requires it to report chain 31337 before anything is sent',
    'tests/utils/userOpHelper.ts': 'a signing helper module; a file that imports it is a sender itself and is held to these rules',
};

/** Functions whose name contains gasless / submit and that are NOT script-side gasless senders, each with why. */
export const NOT_GASLESS_SENDERS: Readonly<Record<string, string>> = {
    submitGaslessUserOperationGuarded: 'private; reached only through submitGaslessUserOperation, which carries the options',
    enableGasless: 'stores the gasless configuration; sends nothing',
    checkGaslessReadiness: 'read-only readiness checks',
    prepareGaslessEnvironment: 'operator setup (stake / deposit) as ordinary transactions; signs no UserOperation',
    buyGasless: 'signs EIP-712 typed data that a relayer submits; not a UserOperation',
    assertCommitteeSubmittable: 'a precondition check; sends nothing',
    encodeSubmitAgentReputation: 'a calldata encoder; sends nothing',
    submitAgentReputation: 'an ABI fragment string (AirAccountExtension), not an SDK function',
    submitDvtConfirmation: 'an HTTP POST to a DVT node; no UserOperation',
    submitReputationProof: 'refuses (an unimplemented placeholder); signs nothing',
    finalizeAndSubmit: 'AirAccount server: the owner signs via KMS / WebAuthn on the device; outside this script-side check (FU-130)',
    submitPreparedTransfer: 'AirAccount server: as finalizeAndSubmit (FU-130)',
    submitPreparedCreateAccount: 'AirAccount server: a relayed passkey account deploy; outside this check (FU-130)',
};

const SELF = new Set(['scripts/check-gasless-cost-cap.ts']);
/** Own keys only: `toString in {}` is true. */
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const inList = (l: readonly string[], n: string | undefined) => n !== undefined && l.includes(n);

const nameOfMember = (n: ts.Node): string | undefined => {
    if (ts.isPropertyAccessExpression(n)) return n.name.text;
    if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression)) return n.argumentExpression.text;
    return undefined;
};
const unwrap = (e: ts.Expression): ts.Expression => {
    while (ts.isParenthesizedExpression(e) || ts.isAwaitExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) e = e.expression;
    return e;
};
const calleeName = (c: ts.CallExpression): string | undefined => {
    const e = unwrap(c.expression);
    return ts.isIdentifier(e) ? e.text : nameOfMember(e);
};
const isPrimitiveName = (n: string) => SMART_ACCOUNT_FACTORY.test(n) || (USEROP_PRIMITIVES as readonly string[]).some((p) => n === p || (p === 'getUserOpHash' && n.startsWith(p)));
const isFunctionLike = (n: ts.Node): n is ts.FunctionLikeDeclaration =>
    ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n);
const enclosingFunction = (n: ts.Node): ts.FunctionLikeDeclaration | undefined => {
    for (let p = n.parent; p; p = p.parent) if (isFunctionLike(p)) return p;
    return undefined;
};
const isAwaited = (c: ts.CallExpression) => {
    let p: ts.Node = c.parent;
    while (ts.isParenthesizedExpression(p)) p = p.parent;
    return ts.isAwaitExpression(p);
};
const isExported = (n: ts.Node) => !!(ts.canHaveModifiers(n) && ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
/**
 * An awaited call that is a direct statement of its function body (or of the top level): `await g(…);` or
 * `const x = await g(…);`. Not inside an if / try / loop / && — there it may not run, or its refusal may be swallowed.
 */
function unconditional(c: ts.CallExpression): boolean {
    if (!isAwaited(c)) return false;
    let n: ts.Node = c.parent; // the await
    while (ts.isParenthesizedExpression(n.parent) || ts.isPropertyAccessExpression(n.parent)) n = n.parent;
    let st: ts.Node = n.parent;
    if (ts.isVariableDeclaration(st)) st = st.parent.parent; // VariableDeclarationList → VariableStatement
    if (!(ts.isExpressionStatement(st) || ts.isVariableStatement(st))) return false;
    const holder = st.parent;
    if (ts.isSourceFile(holder)) return true;
    return ts.isBlock(holder) && isFunctionLike(holder.parent);
}
const lineOf = (n: ts.Node) => n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1;

/** The nearest lexical declaration of an identifier (a parameter or a variable), or undefined. */
export function resolveDecl(id: ts.Identifier): ts.ParameterDeclaration | ts.VariableDeclaration | undefined {
    const name = id.text;
    const inList = (decls: ts.VariableDeclarationList | undefined) => decls?.declarations.find((d) => ts.isIdentifier(d.name) && d.name.text === name);
    for (let p: ts.Node | undefined = id.parent; p; p = p.parent) {
        if (isFunctionLike(p)) {
            const prm = p.parameters.find((q) => ts.isIdentifier(q.name) && q.name.text === name);
            if (prm) return prm;
        }
        if (ts.isBlock(p) || ts.isSourceFile(p) || ts.isModuleBlock(p) || ts.isCaseClause(p) || ts.isDefaultClause(p)) {
            for (const st of p.statements) {
                if (ts.isVariableStatement(st)) { const d = inList(st.declarationList); if (d) return d; }
            }
        }
        if ((ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isForInStatement(p)) && p.initializer && ts.isVariableDeclarationList(p.initializer)) {
            const d = inList(p.initializer); if (d) return d;
        }
    }
    return undefined;
}

/** Is this declaration a ceiling the loaders vouch for? */
function isCapBound(decl: ts.ParameterDeclaration | ts.VariableDeclaration | undefined, sf: ts.SourceFile, usePos = Infinity): boolean {
    if (!decl) return false;
    if (ts.isVariableDeclaration(decl)) {
        const isConst = ts.isVariableDeclarationList(decl.parent) && (decl.parent.flags & ts.NodeFlags.Const) !== 0;
        // The loaders are async: without `await` the binding is a Promise and `.maxUserOpCostWei` is undefined.
        let e: ts.Expression | undefined = decl.initializer;
        while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e))) e = e.expression;
        if (!e || !ts.isAwaitExpression(e)) return false;
        const init = unwrap(e.expression);
        return isConst && ts.isCallExpression(init) && inList(CAP_LOADERS, calleeName(init));
    }
    const fn = decl.parent;
    // `.then((cfg) => …)` directly on a loader call.
    if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && fn.parameters[0] === decl && ts.isCallExpression(fn.parent) && fn.parent.arguments[0] === fn) {
        const call = fn.parent;
        if (ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === 'then') {
            const target = unwrap(call.expression.expression);
            if (ts.isCallExpression(target) && inList(CAP_LOADERS, calleeName(target))) return true;
        }
    }
    // A GaslessNetworkConfig parameter whose function body first awaits assertGaslessNetworkConfig(<it>).
    const body = isFunctionLike(fn) ? fn.body : undefined;
    if (decl.type?.getText(sf) === 'GaslessNetworkConfig' && ts.isIdentifier(decl.name) && body && ts.isBlock(body)) {
        const name = decl.name.text;
        return body.statements.some((st: ts.Statement) => {
            if (st.end > usePos) return false; // the check must run before the ceiling is read
            if (!ts.isExpressionStatement(st) || !ts.isAwaitExpression(st.expression)) return false;
            const c = st.expression.expression;
            return ts.isCallExpression(c) && calleeName(c) === 'assertGaslessNetworkConfig' && !!c.arguments[0] && ts.isIdentifier(c.arguments[0]) && c.arguments[0].text === name;
        });
    }
    return false;
}

/** A primitive's name as a string counts where it names an operation: `functionName: '…'`, `method: '…'`, a call argument. */
function isOperationString(n: ts.StringLiteralLike): boolean {
    const p = n.parent;
    if (ts.isPropertyAssignment(p) && p.initializer === n && ts.isIdentifier(p.name) && (p.name.text === 'functionName' || p.name.text === 'method')) return true;
    return ts.isCallExpression(p) && p.arguments.includes(n as ts.Expression);
}
/** An identifier that USES a name: not an import, a declaration's own name, a type position or an object-literal key. */
function isUse(n: ts.Identifier): boolean {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
        if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isTypeNode(p) || ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p)) return false;
        if (ts.isExpression(p) || ts.isStatement(p)) break;
    }
    const p = n.parent;
    if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p) || ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isClassDeclaration(p) || ts.isParameter(p) || ts.isPropertySignature(p) || ts.isMethodSignature(p)) && (p as any).name === n) return false;
    return true;
}

export type Scan = {
    sf: ts.SourceFile;
    apiCalls: { api: string; node: ts.CallExpression }[];
    apiNonCallRefs: { api: string; node: ts.Node }[];
    raw: ts.Node[];
    calls: ts.CallExpression[];
    mutations: ts.Node[];
    imports: string[];
    exportedNames: Set<string>;
    signerRefs: ts.Node[];
};

const scriptKind = (f: string) => (/\.(mjs|cjs|js)$/.test(f) ? ts.ScriptKind.JS : ts.ScriptKind.TS);

/** `senderNames`: local names this file imports from a local module that is itself a sender (their uses are uses). */
export function scan(fileName: string, src: string, senderNames: ReadonlySet<string> = new Set()): Scan {
    const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, scriptKind(fileName));
    const out: Scan = { sf, apiCalls: [], apiNonCallRefs: [], raw: [], calls: [], mutations: [], imports: [], exportedNames: new Set(), signerRefs: [] };
    // `import { getUserOpHashV07 as hash }`: the alias is the primitive under another name.
    const aliases = new Set<string>();
    for (const st of sf.statements) {
        if (ts.isImportDeclaration(st) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) {
            for (const el of st.importClause.namedBindings.elements) if (isPrimitiveName((el.propertyName ?? el.name).text) && el.propertyName) aliases.add(el.name.text);
        }
        // Every value import from a smart-account module is a primitive under its local name.
        if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && USEROP_MODULES.some((m) => m.test((st.moduleSpecifier as ts.StringLiteral).text)) && st.importClause && !st.importClause.isTypeOnly) {
            const ic = st.importClause;
            if (ic.name) aliases.add(ic.name.text);
            if (ic.namedBindings && ts.isNamespaceImport(ic.namedBindings)) aliases.add(ic.namedBindings.name.text);
            if (ic.namedBindings && ts.isNamedImports(ic.namedBindings)) for (const el of ic.namedBindings.elements) if (!el.isTypeOnly) aliases.add(el.name.text);
        }
        // `export { x } from 'permissionless'` / `export * from '@aastar/dapp'` hands a smart-account sender on.
        if (ts.isExportDeclaration(st) && !st.isTypeOnly && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) && USEROP_MODULES.some((m) => m.test((st.moduleSpecifier as ts.StringLiteral).text))) out.raw.push(st);
        // `export { send }` / `export default send`: those local functions are entry points.
        if (ts.isExportDeclaration(st) && !st.moduleSpecifier && st.exportClause && ts.isNamedExports(st.exportClause)) {
            for (const el of st.exportClause.elements) out.exportedNames.add((el.propertyName ?? el.name).text);
        }
        if (ts.isExportAssignment(st) && ts.isIdentifier(st.expression)) out.exportedNames.add(st.expression.text);
    }
    const capWrite = (e: ts.Expression) => { const u = unwrap(e); return (ts.isPropertyAccessExpression(u) || ts.isElementAccessExpression(u)) && nameOfMember(u) === 'maxUserOpCostWei'; };
    const visit = (n: ts.Node) => {
        if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) out.imports.push(n.moduleSpecifier.text);
        if (ts.isCallExpression(n)) {
            out.calls.push(n);
            const name = calleeName(n);
            if (name && has(GASLESS_SEND_APIS, name) && !ts.isIdentifier(unwrap(n.expression))) out.apiCalls.push({ api: name, node: n });
            if (name === 'assign' && ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'Object') {
                const t = n.arguments[0] && unwrap(n.arguments[0]);
                if (t && ts.isIdentifier(t) && isCapBound(resolveDecl(t), sf)) out.mutations.push(n);
            }
        }
        if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment && capWrite(n.left)) out.mutations.push(n);
        if (ts.isDeleteExpression(n) && capWrite(n.expression)) out.mutations.push(n);
        // A string that IS a primitive's name is one too: `readContract({ functionName: 'getUserOpHash' })`,
        // `writeContract({ functionName: 'handleOps' })`. An ABI fragment or a log line is never exactly the name.
        if (ts.isStringLiteralLike(n) && ((USEROP_PRIMITIVE_STRINGS as readonly string[]).includes(n.text) || (isPrimitiveName(n.text) && isOperationString(n)))) out.raw.push(n);
        if (ts.isIdentifier(n)) {
            const t = n.text;
            if ((isPrimitiveName(t) || aliases.has(t) || senderNames.has(t)) && isUse(n)) out.raw.push(n);
            // A signer method used other than as a direct call (`acc.signMessage.bind(acc)`, `const s = acc.signMessage`).
            if (inList(SIGNING_CALLS, t) && ts.isPropertyAccessExpression(n.parent) && n.parent.name === n && !(ts.isCallExpression(n.parent.parent) && n.parent.parent.expression === n.parent)) out.signerRefs.push(n);
            if (has(GASLESS_SEND_APIS, t)) {
                const p = n.parent;
                const member = (ts.isPropertyAccessExpression(p) && p.name === n) ? p : undefined;
                const called = member && ts.isCallExpression(member.parent) && member.parent.expression === member;
                if (!called) out.apiNonCallRefs.push({ api: t, node: n });
            }
        }
        if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression) && has(GASLESS_SEND_APIS, n.argumentExpression.text)) {
            if (!(ts.isCallExpression(n.parent) && n.parent.expression === n)) out.apiNonCallRefs.push({ api: n.argumentExpression.text, node: n });
        }
        ts.forEachChild(n, visit);
    };
    visit(sf);
    return out;
}

/** Why one send call's options argument does not carry a loader-bound ceiling, or undefined if it does. */
export function sendCallProblem(api: string, call: ts.CallExpression, sf: ts.SourceFile): string | undefined {
    const idx = GASLESS_SEND_APIS[api];
    const arg = call.arguments[idx];
    if (!arg) return `has no options argument (argument ${idx + 1}) to carry maxUserOpCostWei`;
    const obj = unwrap(arg);
    if (!ts.isObjectLiteralExpression(obj)) return `options argument ${idx + 1} is not an object literal, so the ceiling cannot be checked`;
    let lastCap = -1, lastSpread = -1, lastCapNode: ts.ObjectLiteralElementLike | undefined;
    obj.properties.forEach((p, i) => {
        if (ts.isSpreadAssignment(p)) lastSpread = i;
        const key = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name)) ? p.name.text : undefined;
        if (key === 'maxUserOpCostWei') { lastCap = i; lastCapNode = p; }
    });
    if (lastCap < 0) return 'does not pass maxUserOpCostWei';
    if (lastSpread > lastCap) return 'a spread after maxUserOpCostWei can override it';
    if (!lastCapNode || !ts.isPropertyAssignment(lastCapNode)) return 'maxUserOpCostWei is not written as `maxUserOpCostWei: <x>.maxUserOpCostWei`';
    const v = unwrap(lastCapNode.initializer);
    if (!ts.isPropertyAccessExpression(v) || v.name.text !== 'maxUserOpCostWei' || !ts.isIdentifier(v.expression)) return 'maxUserOpCostWei is not `<x>.maxUserOpCostWei`';
    if (!isCapBound(resolveDecl(v.expression), sf, v.getStart())) return `maxUserOpCostWei comes from \`${v.expression.text}\`, which does not resolve to a const from ${CAP_LOADERS.join(' / ')}, a .then on one, or a GaslessNetworkConfig parameter checked by assertGaslessNetworkConfig`;
    return undefined;
}

/** The name a local function is called by (a declaration, or a const / let initialised with a function), if any. */
function localName(fn: ts.Node): string | undefined {
    if (ts.isFunctionDeclaration(fn) && fn.name) return fn.name.text;
    if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isVariableDeclaration(fn.parent) && fn.parent.initializer === fn && ts.isIdentifier(fn.parent.name)) return fn.parent.name.text;
    return undefined;
}
const exportedFn = (fn: ts.Node, s: Scan) => isExported(fn) || (ts.isVariableDeclaration(fn.parent) && ts.isVariableDeclarationList(fn.parent.parent) && isExported(fn.parent.parent.parent))
    || ts.isExportAssignment(fn.parent) || (localName(fn) !== undefined && s.exportedNames.has(localName(fn)!));

/**
 * Is `pos` inside `fn` (undefined = the top level) reached only after an awaited gate? True when a gate sits earlier in
 * the same function; or `fn` is a non-exported named local function every reference to which is a call that is itself
 * covered (an unreferenced one never runs); or `fn` is an anonymous callback / IIFE, judged where it is written.
 * Exported functions, default exports and class methods are entry points an importer can reach: only their own gate
 * counts.
 */
function coveredAt(s: Scan, gates: ts.CallExpression[], fn: ts.FunctionLikeDeclaration | undefined, pos: number, memo = new Map<ts.Node, boolean | 'busy'>()): boolean {
    if (gates.some((g) => enclosingFunction(g) === fn && g.end <= pos)) return true;
    if (!fn) return false;
    // Whether every way into `fn` is covered does not depend on `pos`: memoise it; a cycle in progress counts as no.
    const m = memo.get(fn);
    if (m !== undefined) return m === true;
    memo.set(fn, 'busy');
    let ok = false;
    const name = localName(fn);
    if (name && !exportedFn(fn, s)) {
        const refs: ts.Identifier[] = [];
        const visit = (n: ts.Node) => { if (ts.isIdentifier(n) && n.text === name && isUse(n) && resolveFn(n) === fn) refs.push(n); ts.forEachChild(n, visit); };
        visit(s.sf);
        ok = refs.every((r) => {
            const call = r.parent;
            if (!ts.isCallExpression(call) || call.expression !== r) return false; // passed as a value: it may run anywhere
            return coveredAt(s, gates, enclosingFunction(call), call.getStart(), memo);
        });
    } else if (!name && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && !exportedFn(fn, s)) {
        ok = coveredAt(s, gates, enclosingFunction(fn), fn.getStart(), memo);
    }
    memo.set(fn, ok);
    return ok;
}
/** The local function an identifier names, by declaration (FunctionDeclaration, or a variable initialised with one). */
function resolveFn(id: ts.Identifier): ts.Node | undefined {
    for (let p: ts.Node | undefined = id.parent; p; p = p.parent) {
        if (ts.isBlock(p) || ts.isSourceFile(p) || ts.isModuleBlock(p)) {
            for (const st of p.statements) {
                if (ts.isFunctionDeclaration(st) && st.name?.text === id.text) return st;
                if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === id.text && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) return d.initializer;
            }
        }
    }
    return undefined;
}

/**
 * The rules for one file. `senderNames`: names it imports from local sender modules (their uses are hand-signing uses);
 * `sideEffectSender`: it imports a local sender module for its side effects only, which no rule can see into.
 */
export function fileProblems(file: string, src: string, senderNames: ReadonlySet<string> = new Set(), sideEffectSender = false): string[] {
    if (SELF.has(file)) return [];
    const s = scan(file, src, senderNames);
    const sends = s.apiCalls.length > 0 || s.apiNonCallRefs.length > 0;
    const hasRaw = s.raw.length > 0 || sideEffectSender;
    if (!sends && !hasRaw) return [];
    const p: string[] = [];
    for (const m of s.mutations) p.push(`${file}:${lineOf(m)}: writes maxUserOpCostWei after it was resolved; a ceiling must not be changed between the loader and the send`);
    const reviewed = has(REVIEWED_SENDERS, file);
    const gates = s.calls.filter((c) => inList(CHAIN_GATES, calleeName(c)) && unconditional(c));
    const usesLoader = s.calls.some((c) => inList(CAP_LOADERS, calleeName(c)));
    // A send method taken as a value (`u.executeGasless.bind(u)`) is called where neither rule can see it.
    if (!reviewed) for (const r of s.apiNonCallRefs) p.push(`${file}:${lineOf(r.node)}: ${r.api} is referenced without being called directly, so its options and its gate cannot be checked`);
    if (usesLoader || (sends && !reviewed && !gates.length)) {
        for (const c of s.apiCalls) {
            const why = sendCallProblem(c.api, c.node, s.sf);
            if (why) p.push(`${file}:${lineOf(c.node)}: ${c.api} ${why}`);
        }
    }
    if (reviewed) return p;
    if (!hasRaw) {
        if (usesLoader) return p; // rule L, checked per call above
        // No loader: every SDK send must be reached after an awaited chain gate (rule R), like a hand-signed one.
        const open = s.apiCalls.filter((c) => !coveredAt(s, gates, enclosingFunction(c.node), c.node.getStart()));
        if (open.length || !s.apiCalls.length) p.push(`${file}${open.length ? `:${lineOf(open[0].node)}` : ''}: sends gasless without a cost ceiling loader (${CAP_LOADERS.join(' / ')}) and not after an awaited chain gate; use a loader, or gate it, or add it to REVIEWED_SENDERS with why`);
        return p;
    }
    if (sideEffectSender && !s.raw.length) {
        p.push(`${file}: imports a local module that signs UserOperations for its side effects only: add it to REVIEWED_SENDERS with why`);
        return p;
    }
    // Rule R: every hand-signing use is reached only after an awaited chain gate.
    const uses: ts.Node[] = usesLoader ? s.raw : [...s.raw, ...s.apiCalls.map((c) => c.node)];
    const uncovered = uses.filter((r) => !coveredAt(s, gates, enclosingFunction(r), r.getStart()));
    if (!uncovered.length) return p;
    // Rule G: every signature is reached only after an awaited guardUserOpSignature whose ceiling is a const from resolveUserOpCostCap.
    const guards = s.calls.filter((c) => calleeName(c) === 'guardUserOpSignature' && guardHasResolvedCap(c));
    const signs = s.calls.filter((c) => inList(SIGNING_CALLS, calleeName(c)));
    if (guards.length && signs.length && !s.signerRefs.length && signs.every((c) => guards.some((g) => guardDominates(g, c)))) return p;
    const first = uncovered[0];
    const what = ts.isStringLiteralLike(first) ? first.text : ts.isIdentifier(first) ? first.text : ts.isCallExpression(first) ? `${calleeName(first)}(…)`
        : ts.isExportDeclaration(first) ? 're-export of a smart-account module' : 'a UserOp primitive';
    p.push(`${file}:${lineOf(first)}: ${what} signs / submits a UserOperation on a path that no awaited chain gate (${CHAIN_GATES.join(' / ')}) precedes${uncovered.length > 1 ? ` (and ${uncovered.length - 1} more)` : ''}: gate it before this point (an exported function, class method or default export needs its own gate), or guard every signature with guardUserOpSignature and a const from resolveUserOpCostCap, or add the file to REVIEWED_SENDERS with why`);
    return p;
}

/**
 * The guard runs, and its refusal is not swallowed, before `sign`: it is a direct `await guard(…);` statement of a block
 * that also contains `sign` in a later statement, in the same function (a throw skips the rest of that block).
 */
function guardDominates(g: ts.CallExpression, sign: ts.CallExpression): boolean {
    if (!isAwaited(g) || enclosingFunction(g) !== enclosingFunction(sign)) return false;
    let st: ts.Node = g.parent.parent;
    if (ts.isVariableDeclaration(st)) st = st.parent.parent;
    if (!(ts.isExpressionStatement(st) || ts.isVariableStatement(st))) return false;
    const block = st.parent;
    if (!(ts.isBlock(block) || ts.isSourceFile(block))) return false;
    for (let p: ts.Node | undefined = sign.parent; p; p = p.parent) {
        if (p.parent === block) return (block.statements as ts.NodeArray<ts.Statement>).indexOf(p as ts.Statement) > (block.statements as ts.NodeArray<ts.Statement>).indexOf(st as ts.Statement);
    }
    return false;
}

function guardHasResolvedCap(c: ts.CallExpression): boolean {
    const o = c.arguments[1] && unwrap(c.arguments[1]);
    if (!o || !ts.isObjectLiteralExpression(o)) return false;
    const keyOf = (pp: ts.ObjectLiteralElementLike) => (pp.name && (ts.isIdentifier(pp.name) || ts.isStringLiteralLike(pp.name)) ? pp.name.text : undefined);
    const idx = o.properties.map(keyOf).lastIndexOf('maxUserOpCostWei');
    if (idx < 0 || o.properties.slice(idx + 1).some((pp) => ts.isSpreadAssignment(pp))) return false;
    return [o.properties[idx]].some((pp) => {
        const id = ts.isShorthandPropertyAssignment(pp) && pp.name.text === 'maxUserOpCostWei' ? pp.name
            : ts.isPropertyAssignment(pp) && ts.isIdentifier(pp.name) && pp.name.text === 'maxUserOpCostWei' && ts.isIdentifier(unwrap(pp.initializer)) ? unwrap(pp.initializer) as ts.Identifier : undefined;
        const d = id && resolveDecl(id);
        if (!d || !ts.isVariableDeclaration(d) || !d.initializer || !ts.isVariableDeclarationList(d.parent) || !(d.parent.flags & ts.NodeFlags.Const)) return false;
        let found = false;
        const look = (n: ts.Node) => { if (ts.isCallExpression(n) && calleeName(n) === 'resolveUserOpCostCap') found = true; ts.forEachChild(n, look); };
        look(d.initializer);
        return found;
    });
}

const resolveImport = (files: ReadonlyMap<string, string>, from: string, spec: string): string | undefined => {
    if (!spec.startsWith('.')) return undefined;
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)).replace(/\.(js|mjs|cjs|ts|mts|cts)$/, '');
    return ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs', '/index.ts', '/index.js'].map((e) => base + e).find((c) => files.has(c));
};

/**
 * Over the scanned script files: which are senders, directly or through an import of another; and, per file, the local
 * names it imports from a sender module, and whether it imports one for its side effects only.
 */
export function senderClosure(files: ReadonlyMap<string, string>): { senders: Set<string>; names: Map<string, Set<string>>; sideEffect: Set<string> } {
    const scans = new Map([...files].map(([f, src]) => [f, scan(f, src)]));
    const senders = new Set([...scans].filter(([, s]) => s.raw.length || s.apiCalls.length || s.apiNonCallRefs.length).map(([f]) => f));
    const bindings = (f: string) => {
        const out: { target: string; names: string[] }[] = [];
        for (const st of scans.get(f)!.sf.statements) {
            if (!(ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) || !st.moduleSpecifier || !ts.isStringLiteral(st.moduleSpecifier)) continue;
            const target = resolveImport(files, f, st.moduleSpecifier.text);
            if (!target || target === f) continue;
            const names: string[] = [];
            if (ts.isImportDeclaration(st) && st.importClause && !st.importClause.isTypeOnly) {
                const ic = st.importClause;
                if (ic.name) names.push(ic.name.text);
                if (ic.namedBindings && ts.isNamespaceImport(ic.namedBindings)) names.push(ic.namedBindings.name.text);
                if (ic.namedBindings && ts.isNamedImports(ic.namedBindings)) for (const el of ic.namedBindings.elements) if (!el.isTypeOnly) names.push(el.name.text);
            }
            out.push({ target, names });
        }
        return out;
    };
    for (let changed = true; changed; ) {
        changed = false;
        for (const f of scans.keys()) {
            if (senders.has(f)) continue;
            if (bindings(f).some((b) => senders.has(b.target))) { senders.add(f); changed = true; }
        }
    }
    const names = new Map<string, Set<string>>();
    const sideEffect = new Set<string>();
    for (const f of scans.keys()) {
        const bs = bindings(f).filter((b) => senders.has(b.target));
        names.set(f, new Set(bs.flatMap((b) => b.names)));
        if (bs.some((b) => b.names.length === 0)) {
            const st = scans.get(f)!.sf.statements.find((x) => ts.isImportDeclaration(x) && !x.importClause && ts.isStringLiteral(x.moduleSpecifier) && senders.has(resolveImport(files, f, (x.moduleSpecifier as ts.StringLiteral).text) ?? ''));
            if (st) sideEffect.add(f);
        }
    }
    return { senders, names, sideEffect };
}

/**
 * Library sources: every call of a send API passes `maxUserOpCostWei` on (any value but a literal undefined), so a
 * ceiling a caller gives reaches the signing site (DSR's read-only review of #471, M1: TrafficGenerator dropped it).
 */
export function libraryForwardingProblems(file: string, src: string): string[] {
    const s = scan(file, src);
    const p: string[] = [];
    for (const c of s.apiCalls) {
        const arg = c.node.arguments[GASLESS_SEND_APIS[c.api]];
        const o = arg && unwrap(arg);
        const prop = o && ts.isObjectLiteralExpression(o) ? o.properties.find((pp) => pp.name && (ts.isIdentifier(pp.name) || ts.isStringLiteralLike(pp.name)) && pp.name.text === 'maxUserOpCostWei') : undefined;
        const v = prop && (ts.isPropertyAssignment(prop) ? unwrap(prop.initializer) : ts.isShorthandPropertyAssignment(prop) ? prop.name : undefined);
        if (!v || (ts.isIdentifier(v) && v.text === 'undefined')) p.push(`${file}:${lineOf(c.node)}: ${c.api} does not forward maxUserOpCostWei in its options (a caller's ceiling would not reach the signing site)`);
    }
    return p;
}

/** The catch-all: a gasless / submit function in packages/*\/src that is neither a send API nor a reviewed non-sender. */
export function unclassifiedSenders(files: { path: string; src: string }[]): string[] {
    const out = new Set<string>();
    const named = (n: string | undefined, f: string) => {
        if (n && /gasless|submit/i.test(n) && !has(GASLESS_SEND_APIS, n) && !has(NOT_GASLESS_SENDERS, n)) out.add(`${n} (${f})`);
    };
    for (const { path: f, src } of files) {
        const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, scriptKind(f));
        const visit = (n: ts.Node) => {
            if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name && (ts.isIdentifier(n.name) || ts.isStringLiteralLike(n.name))) named(n.name.text, f);
            if ((ts.isVariableDeclaration(n) || ts.isPropertyAssignment(n) || ts.isPropertyDeclaration(n)) && n.name && ts.isIdentifier(n.name) && n.initializer) {
                const init = unwrap(n.initializer);
                if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) named(n.name.text, f);
            }
            ts.forEachChild(n, visit);
        };
        visit(sf);
    }
    return [...out].sort();
}

const SCRIPT_GLOBS = ['scripts', 'tests', 'examples', 'packages/*/scripts', 'packages/*/tests', 'packages/*/examples'];
const CODE = /\.(ts|mts|cts|mjs|cjs|js)$/;

function main() {
    // `:(glob)dir/**` so a wildcard directory (packages/*/src) is listed recursively.
    const ls = (dirs: string[]) => execFileSync('git', ['ls-files', ...dirs.map((d) => `:(glob)${d}/**`)], { encoding: 'utf8' }).split('\n')
        .filter((f) => f && CODE.test(f) && !/\.(test|spec)\.[cm]?[jt]s$/.test(f) && !/\.d\.[cm]?ts$/.test(f) && !/(^|\/)(node_modules|dist)\//.test(f));
    const scriptFiles = [...new Set(ls(SCRIPT_GLOBS))];
    const libFileList = ls(['packages/*/src']);
    const srcs = new Map([...scriptFiles, ...libFileList].map((f) => [f, fs.readFileSync(f, 'utf8')]));
    // The closure is over the scripts. Library sources are held by their own rule (every send-API call forwards the
    // ceiling), and their hand-signers are a library concern (FU-131): a script importing any SDK name is not a sender.
    const { senders, names, sideEffect } = senderClosure(new Map(scriptFiles.map((f) => [f, srcs.get(f)!])));
    const problems: string[] = [];
    for (const f of scriptFiles) problems.push(...fileProblems(f, srcs.get(f)!, names.get(f), sideEffect.has(f)));
    for (const f of Object.keys(REVIEWED_SENDERS)) {
        if (!senders.has(f) || !scriptFiles.includes(f)) problems.push(`REVIEWED_SENDERS lists ${f}, which no longer exists or no longer signs / submits UserOperations: remove the entry`);
    }
    const libFiles = libFileList.map((f) => ({ path: f, src: srcs.get(f)! }));
    for (const { path: f, src } of libFiles) problems.push(...libraryForwardingProblems(f, src));
    for (const u of unclassifiedSenders(libFiles)) problems.push(`unclassified gasless / submit function ${u}: add it to GASLESS_SEND_APIS (and pass the ceiling) or to NOT_GASLESS_SENDERS with why`);
    if (problems.length) { console.error(`check:gasless-cost-cap FAIL\n - ${problems.join('\n - ')}`); process.exit(1); }
    console.log(`check:gasless-cost-cap PASS — ${scriptFiles.length} script file(s) scanned, ${[...senders].filter((f) => scriptFiles.includes(f)).length} UserOp sender(s) held to the rules, ${libFiles.length} library file(s) checked`);
}

// Run main only when executed directly. Compare real paths: a path with spaces, or a symlink (macOS /tmp), would
// otherwise skip main and exit 0 silently; CI also asserts the PASS line (DSR's read-only review of #471, L1).
const invoked = process.argv[1] ? (() => { try { return fs.realpathSync(process.argv[1]); } catch { return undefined; } })() : undefined;
if (invoked && invoked === fs.realpathSync(fileURLToPath(import.meta.url))) main();
