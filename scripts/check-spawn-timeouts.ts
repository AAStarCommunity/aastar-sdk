#!/usr/bin/env tsx
/**
 * Spawning tests must say how long they are allowed to take.
 *
 * vitest 4.0.17 (measured, see the SPAWN_VERDICT_TIMEOUT_MS notes in the suites this guards):
 * a describe-level `{ timeout }` applies to cases only. Hooks keep `hookTimeout`, default 10s.
 * A file that sets neither sits on the 5s test default. `execFileSync` / `spawnSync` block the
 * event loop the timer runs on, so the number bounds the VERDICT, not a hung child — a slow
 * spawn and a failed assertion are the same `×` line.
 *
 * Scope is the *.test.ts files CI actually executes under the root vitest config:
 * test:scripts (vitest run scripts, excluding the repcredit glob) UNION repcredit:test
 * (vitest run scripts/repcredit). The exclude exists so those files are not run twice;
 * repcredit:test is the job that runs them.
 *
 * A test file is a spawning file when it, or any repo-local module it reaches through a relative
 * import / export / require / string-literal dynamic import, touches `child_process`,
 * `node:child_process`, or `execa` (any import form, including type-only, `import *`, `require`,
 * and `import = require`). A relative specifier resolves only to a regular file (`index.ts` when
 * the path is a directory). One that does not resolve, and a `require` or
 * `import()` whose argument is not a string literal, make the file spawning too. The gate does
 * not follow non-relative packages and does not build a call graph: once the file is spawning,
 * how the spawn is written (`cp['execFileSync']`, a method on an object, a default parameter)
 * does not matter.
 *
 * In a spawning file, and only there, registrations are recognized by binding, not by spelling:
 * - a local name imported from `vitest` (`describe`, `suite`, `it`, `test`, the four hooks),
 *   including aliases (`describe as d`) and namespace access (`v.describe`, `import *` or
 *   `import = require`). `.skip` / `.only` / `.each` hang off that binding. `.each` may be a
 *   call or a tagged template. `skipIf` / `runIf` / `each` return a collector: that call is not
 *   a suite, and a `const` holding the result (or `describe.skip` / `describe.only`) is an alias.
 * - a vitest global of the same name, only when globals are on and no binding of that name is
 *   in scope at the call. A local function named `test`, or `pattern.test`, is not a registration.
 * - every top-level `describe` / `suite` needs an explicit timeout. A describe nested inside
 *   another describe's factory does not need its own.
 * - every `beforeAll` / `beforeEach` / `afterAll` / `afterEach` anywhere in the file needs its
 *   own explicit timeout in argument 2. A describe timeout does not cover hooks.
 * - every `it` / `test` that is not lexically inside a describe factory is a violation.
 *
 * An explicit timeout is a numeric literal (`30_000` included), parentheses, unary `+` / `-`,
 * binary `+` `-` `*` `/` of those, or the `const` the identifier resolves to at that spot
 * (never assigned, initializer one of those or another such const). An inner const shadows an
 * outer one. `let`, `var`, and a reassigned const do not count. For `describe` / `it` the
 * timeout is the options object in argument 2 or a number in argument 3 — the title is not a
 * timeout. In that object a plain `timeout` counts when no spread, computed key, or later
 * `timeout` follows it. Another plain property (`retry`) may follow it.
 *
 * `readVitestConfig` accepts `include` / `exclude` only as arrays of string literals. A spread,
 * a computed key, or a non-literal element fails closed: Vitest would run files the gate never
 * lists.
 *
 * Known false positives (these fail closed, i.e. the gate reports a violation; rewrite the file
 * into a supported form rather than widen the recognizer): a stored builder chain that mixes
 * calls and properties (`describe.skipIf(x).sequential`), `.sequential` / `.concurrent`
 * collectors, and `it.extend(...)` fixture builders.
 *
 * Run: `pnpm run check:spawn-timeouts`
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const SPAWN_SPECS = new Set(['child_process', 'node:child_process', 'execa']);
const API_ROLE: Record<string, 'describe' | 'test' | 'hook'> = {
    describe: 'describe',
    suite: 'describe',
    it: 'test',
    test: 'test',
    beforeAll: 'hook',
    beforeEach: 'hook',
    afterAll: 'hook',
    afterEach: 'hook',
};
/** Calls that return a collector. `describe.skip(name, fn)` registers; these do not. */
const BUILDER_CALLS = new Set(['skipIf', 'runIf', 'each']);
/** Properties that already are collectors. `describe.skip` is callable; `describe.skipIf` is not. */
const COLLECTOR_PROPS = new Set(['skip', 'only']);

export interface Violation {
    file: string;
    line: number;
    message: string;
}

export interface SpawnTimeoutReport {
    /** Spawning test files the rule actually judged. Zero is a failure, not a clean tree. */
    checked: number;
    violations: Violation[];
}

interface ModuleInfo {
    file: string;
    sf: ts.SourceFile;
    /** This module itself imports a spawn package, has a non-literal require/import, or a broken relative edge. */
    direct: boolean;
    /** Resolved relative modules in the file map. */
    edges: string[];
}

function propName(name: ts.PropertyName): string | undefined {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
    return undefined;
}

function unwrap(expr: ts.Expression): ts.Expression {
    let e = expr;
    while (
        ts.isParenthesizedExpression(e) ||
        ts.isAsExpression(e) ||
        ts.isSatisfiesExpression(e) ||
        ts.isNonNullExpression(e) ||
        ts.isTypeAssertionExpression(e)
    ) {
        e = e.expression;
    }
    return e;
}

/** Literal arithmetic only. An identifier is not folded. */
function foldNumber(expr: ts.Expression): number | undefined {
    const u = unwrap(expr);
    if (ts.isNumericLiteral(u)) {
        const n = Number(u.text.replace(/_/g, ''));
        return Number.isFinite(n) ? n : undefined;
    }
    if (ts.isPrefixUnaryExpression(u) && (u.operator === ts.SyntaxKind.PlusToken || u.operator === ts.SyntaxKind.MinusToken)) {
        const inner = foldNumber(u.operand);
        if (inner === undefined) return undefined;
        const n = u.operator === ts.SyntaxKind.MinusToken ? -inner : inner;
        return Number.isFinite(n) ? n : undefined;
    }
    if (ts.isBinaryExpression(u)) {
        const op = u.operatorToken.kind;
        // Arithmetic const. Removing this arm rejects `const timeout = 30 * 1000`, which vitest honors.
        if (op !== ts.SyntaxKind.PlusToken && op !== ts.SyntaxKind.MinusToken &&
            op !== ts.SyntaxKind.AsteriskToken && op !== ts.SyntaxKind.SlashToken) return undefined;
        const left = foldNumber(u.left);
        const right = foldNumber(u.right);
        if (left === undefined || right === undefined) return undefined;
        const n = op === ts.SyntaxKind.PlusToken ? left + right
            : op === ts.SyntaxKind.MinusToken ? left - right
            : op === ts.SyntaxKind.AsteriskToken ? left * right
            : left / right;
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function posixDir(p: string): string {
    const i = p.lastIndexOf('/');
    return i === -1 ? '' : p.slice(0, i);
}

function posixJoin(a: string, b: string): string {
    if (!a) return b;
    return `${a}/${b}`;
}

function posixNorm(p: string): string {
    const parts: string[] = [];
    for (const part of p.split('/')) {
        if (part === '' || part === '.') continue;
        if (part === '..') parts.pop();
        else parts.push(part);
    }
    const lead = p.startsWith('/') ? '/' : '';
    return lead + parts.join('/');
}

function relativeCandidates(from: string, spec: string): string[] {
    const dir = posixDir(from);
    const joined = posixNorm(posixJoin(dir, spec));
    const cands = [joined];
    if (joined.endsWith('.js')) {
        cands.push(joined.slice(0, -3) + '.ts', joined.slice(0, -3) + '.tsx', joined.slice(0, -3) + '.mts');
    }
    cands.push(joined + '.ts', joined + '.tsx', joined + '.mts', posixJoin(joined, 'index.ts'));
    return cands.filter(c => c !== '' && !c.startsWith('/') && !c.startsWith('..'));
}

function resolveRelative(from: string, spec: string, has: (path: string) => boolean): string | undefined {
    if (!spec.startsWith('.')) return undefined;
    for (const cand of relativeCandidates(from, spec)) {
        if (has(cand)) return cand;
    }
    return undefined;
}

function isRegularFile(abs: string): boolean {
    try {
        // existsSync is true for a directory. Removing isFile() resolves `../packages/core/src` to it,
        // and loadGraph's readFileSync throws EISDIR.
        return statSync(abs).isFile();
    } catch {
        return false;
    }
}

/** Relative specifier → repo-relative file, or undefined. Directories are not files. */
export function resolveRepoFile(repoRoot: string, from: string, spec: string): string | undefined {
    return resolveRelative(from, spec, cand => isRegularFile(join(repoRoot, cand)));
}

interface Refs {
    specs: string[];
    /** `require(...)` / `import(...)` whose argument is not a string literal. */
    nonLiteralDynamic: boolean;
}

function stringArg(expr: ts.Expression | undefined): string | undefined {
    if (!expr) return undefined;
    const u = unwrap(expr);
    return ts.isStringLiteral(u) ? u.text : undefined;
}

/** Static edges plus dynamic import / require. Non-literal dynamic forms are flagged, not guessed. */
function moduleRefs(sf: ts.SourceFile): Refs {
    const specs: string[] = [];
    let nonLiteralDynamic = false;
    for (const stmt of sf.statements) {
        if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
            specs.push(stmt.moduleSpecifier.text);
        } else if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
            specs.push(stmt.moduleSpecifier.text);
        } else if (
            ts.isImportEqualsDeclaration(stmt) &&
            ts.isExternalModuleReference(stmt.moduleReference) &&
            ts.isStringLiteral(stmt.moduleReference.expression)
        ) {
            // `import cp = require('node:child_process')`. Removing this arm misses that form.
            specs.push(stmt.moduleReference.expression.text);
        }
    }
    function visit(node: ts.Node): void {
        if (ts.isCallExpression(node)) {
            const callee = unwrap(node.expression);
            const dynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword || callee.kind === ts.SyntaxKind.ImportKeyword;
            const required = ts.isIdentifier(callee) && callee.text === 'require';
            if (dynamic || required) {
                const text = stringArg(node.arguments[0]);
                if (text === undefined) {
                    // `import(mod)` / `require(mod)`. The module is unknown, so the file is spawning.
                    nonLiteralDynamic = true;
                } else {
                    specs.push(text);
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sf);
    return { specs, nonLiteralDynamic };
}

function indexModules(files: Map<string, string>): Map<string, ModuleInfo> {
    const mods = new Map<string, ModuleInfo>();
    for (const [file, text] of files) {
        const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        const refs = moduleRefs(sf);
        const info: ModuleInfo = { file, sf, direct: refs.nonLiteralDynamic, edges: [] };
        for (const spec of refs.specs) {
            // Spawn package. Removing this arm lets `import { execFileSync } from 'node:child_process'` through.
            if (SPAWN_SPECS.has(spec)) {
                info.direct = true;
                continue;
            }
            if (!spec.startsWith('.')) continue;
            const resolved = resolveRelative(file, spec, path => files.has(path));
            // Broken relative edge. Removing this arm lets `import './missing.js'` through.
            if (!resolved) {
                info.direct = true;
                continue;
            }
            info.edges.push(resolved);
        }
        mods.set(file, info);
    }
    return mods;
}

function spawningSet(mods: Map<string, ModuleInfo>): Set<string> {
    const spawns = new Set<string>();
    for (const [file, info] of mods) {
        if (info.direct) spawns.add(file);
    }
    let changed = true;
    while (changed) {
        changed = false;
        for (const [file, info] of mods) {
            if (spawns.has(file)) continue;
            // Transitive relative import. Removing this arm hides a helper that imports child_process.
            if (info.edges.some(edge => spawns.has(edge))) {
                spawns.add(file);
                changed = true;
            }
        }
    }
    return spawns;
}

interface Bind {
    local: boolean;
    vitest?: { role: 'describe' | 'test' | 'hook'; api: string };
    namespace?: boolean;
    /** Set for a `const` with an identifier name. The initializer may still not be a number. */
    numberDecl?: ts.VariableDeclaration;
}

interface Scope {
    parent?: Scope;
    names: Map<string, Bind>;
}

interface BoundFile {
    isTimeoutValue(expr: ts.Expression): boolean;
    registration(call: ts.CallExpression): { role: 'describe' | 'test' | 'hook'; api: string } | undefined;
}

/**
 * Bindings vitest imports and consts actually have. A timeout identifier resolves to the const
 * in scope at the use, and a registration resolves to a vitest import or an unbound global.
 */
function bindFile(sf: ts.SourceFile, globals: boolean): BoundFile {
    const scopeOf = new WeakMap<ts.Node, Scope>();
    const declScope = new WeakMap<ts.VariableDeclaration, Scope>();
    const assigned = new Set<ts.VariableDeclaration>();
    const moduleScope: Scope = { names: new Map() };
    scopeOf.set(sf, moduleScope);

    function childScope(parent: Scope): Scope {
        return { parent, names: new Map() };
    }

    function lookup(scope: Scope | undefined, name: string): Bind | undefined {
        for (let s = scope; s; s = s.parent) {
            const found = s.names.get(name);
            if (found) return found;
        }
        return undefined;
    }

    function bindSimple(scope: Scope, name: string, bind: Bind): void {
        if (!scope.names.has(name)) scope.names.set(name, bind);
    }

    function bindPattern(scope: Scope, name: ts.BindingName): void {
        if (ts.isIdentifier(name)) {
            bindSimple(scope, name.text, { local: true });
            return;
        }
        for (const el of name.elements) {
            if (ts.isOmittedExpression(el)) continue;
            bindPattern(scope, el.name);
        }
    }

    function methodName(expr: ts.Expression): string | undefined {
        const e = unwrap(expr);
        if (ts.isPropertyAccessExpression(e)) return e.name.text;
        if (ts.isElementAccessExpression(e) && e.argumentExpression && ts.isStringLiteral(unwrap(e.argumentExpression))) {
            return unwrap(e.argumentExpression).text;
        }
        return undefined;
    }

    function receiverOf(expr: ts.Expression): ts.Expression | undefined {
        const e = unwrap(expr);
        if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) return e.expression;
        return undefined;
    }

    /** `describe.skipIf(cond)`, `describe.each(rows)`, `describe.skip` — a collector, not a call that registers. */
    function collectorOf(expr: ts.Expression, scope: Scope): { role: 'describe' | 'test' | 'hook'; api: string } | undefined {
        let current = unwrap(expr);
        while (true) {
            current = unwrap(current);
            if (ts.isCallExpression(current)) {
                const method = methodName(current.expression);
                if (!method || !BUILDER_CALLS.has(method)) return undefined;
                const receiver = receiverOf(unwrap(current.expression));
                if (!receiver) return undefined;
                current = receiver;
                continue;
            }
            if (ts.isTaggedTemplateExpression(current)) {
                if (methodName(current.tag) !== 'each') return undefined;
                const receiver = receiverOf(unwrap(current.tag));
                if (!receiver) return undefined;
                current = receiver;
                continue;
            }
            break;
        }
        const props: string[] = [];
        while (true) {
            current = unwrap(current);
            if (ts.isIdentifier(current)) break;
            if (ts.isPropertyAccessExpression(current)) {
                props.push(current.name.text);
                current = current.expression;
                continue;
            }
            if (
                ts.isElementAccessExpression(current) &&
                current.argumentExpression &&
                ts.isStringLiteral(unwrap(current.argumentExpression))
            ) {
                props.push(unwrap(current.argumentExpression).text);
                current = current.expression;
                continue;
            }
            return undefined;
        }
        if (!ts.isIdentifier(current)) return undefined;
        for (const prop of props) {
            if (API_ROLE[prop] !== undefined || COLLECTOR_PROPS.has(prop)) continue;
            return undefined;
        }
        const binding = lookup(scope, current.text);
        if (binding?.vitest) return binding.vitest;
        if (binding?.namespace) {
            const api = [...props].reverse().find(name => API_ROLE[name] !== undefined);
            if (!api) return undefined;
            return { role: API_ROLE[api]!, api };
        }
        if (binding || !globals) return undefined;
        const role = API_ROLE[current.text];
        if (!role) return undefined;
        return { role, api: current.text };
    }

    function bindConstLike(scope: Scope, decl: ts.VariableDeclaration, flags: ts.NodeFlags): void {
        // `let` / `var` are not timeouts. Removing the const test accepts `let timeout = 30000`.
        const isConst = (flags & ts.NodeFlags.Const) !== 0;
        if (!ts.isIdentifier(decl.name)) {
            bindPattern(scope, decl.name);
            return;
        }
        // `const suite = describe.skipIf(cond)` is a describe. Removing this arm misses `suite(...)`.
        if (isConst && decl.initializer) {
            const collector = collectorOf(decl.initializer, scope);
            if (collector) {
                bindSimple(scope, decl.name.text, { local: true, vitest: collector });
                return;
            }
        }
        if (isConst) declScope.set(decl, scope);
        bindSimple(scope, decl.name.text, { local: true, numberDecl: isConst ? decl : undefined });
    }

    function addImport(stmt: ts.ImportDeclaration, scope: Scope): void {
        if (!stmt.importClause || stmt.importClause.isTypeOnly) return;
        if (!ts.isStringLiteral(stmt.moduleSpecifier)) return;
        const fromVitest = stmt.moduleSpecifier.text === 'vitest';
        const clause = stmt.importClause;
        if (clause.name) {
            bindSimple(scope, clause.name.text, fromVitest ? { local: true, namespace: true } : { local: true });
        }
        const named = clause.namedBindings;
        if (!named) return;
        if (ts.isNamespaceImport(named)) {
            bindSimple(scope, named.name.text, fromVitest ? { local: true, namespace: true } : { local: true });
            return;
        }
        for (const el of named.elements) {
            if (el.isTypeOnly) continue;
            // `describe as d`: the vitest export is `describe`, the local name is `d`.
            // Using `el.name` alone misses the alias.
            const exported = (el.propertyName ?? el.name).text;
            const role = fromVitest ? API_ROLE[exported] : undefined;
            if (role) bindSimple(scope, el.name.text, { local: true, vitest: { role, api: exported } });
            else bindSimple(scope, el.name.text, { local: true });
        }
    }

    function addStatementBindings(statements: readonly ts.Statement[], scope: Scope): void {
        for (const stmt of statements) {
            if (ts.isFunctionDeclaration(stmt) && stmt.name) bindSimple(scope, stmt.name.text, { local: true });
            else if (ts.isClassDeclaration(stmt) && stmt.name) bindSimple(scope, stmt.name.text, { local: true });
            else if (ts.isVariableStatement(stmt)) {
                for (const decl of stmt.declarationList.declarations) bindConstLike(scope, decl, stmt.declarationList.flags);
            } else if (ts.isImportDeclaration(stmt)) addImport(stmt, scope);
            else if (
                ts.isImportEqualsDeclaration(stmt) &&
                ts.isExternalModuleReference(stmt.moduleReference) &&
                ts.isStringLiteral(stmt.moduleReference.expression)
            ) {
                const fromVitest = stmt.moduleReference.expression.text === 'vitest';
                bindSimple(scope, stmt.name.text, fromVitest ? { local: true, namespace: true } : { local: true });
            }
        }
    }

    function markTargets(node: ts.Expression, scope: Scope): void {
        const u = unwrap(node);
        if (ts.isIdentifier(u)) {
            const found = lookup(scope, u.text);
            if (found?.numberDecl) assigned.add(found.numberDecl);
            return;
        }
        if (ts.isObjectLiteralExpression(u)) {
            for (const p of u.properties) {
                if (ts.isShorthandPropertyAssignment(p)) {
                    // `({ timeout } = {})` writes the binding. Removing this arm keeps the const.
                    const found = lookup(scope, p.name.text);
                    if (found?.numberDecl) assigned.add(found.numberDecl);
                } else if (ts.isPropertyAssignment(p)) markTargets(p.initializer, scope);
                else if (ts.isSpreadAssignment(p)) markTargets(p.expression, scope);
            }
            return;
        }
        if (ts.isArrayLiteralExpression(u)) {
            for (const el of u.elements) {
                if (!el) continue;
                if (ts.isSpreadElement(el)) markTargets(el.expression, scope);
                else markTargets(el, scope);
            }
        }
    }

    function visitBlock(block: ts.Block, parent: Scope): void {
        const scope = childScope(parent);
        scopeOf.set(block, scope);
        addStatementBindings(block.statements, scope);
        for (const stmt of block.statements) visit(stmt, scope);
    }

    function visitFunction(fn: ts.SignatureDeclarationBase | ts.ArrowFunction, parent: Scope): void {
        const scope = childScope(parent);
        scopeOf.set(fn, scope);
        if (ts.isFunctionExpression(fn) && fn.name) bindSimple(scope, fn.name.text, { local: true });
        for (const param of fn.parameters) bindPattern(scope, param.name);
        for (const param of fn.parameters) {
            if (param.initializer) visit(param.initializer, scope);
        }
        if (fn.body) visit(fn.body, scope);
    }

    function visitFor(node: ts.ForStatement | ts.ForInStatement | ts.ForOfStatement, parent: Scope): void {
        const scope = childScope(parent);
        scopeOf.set(node, scope);
        const init = node.initializer;
        if (init && ts.isVariableDeclarationList(init)) {
            for (const decl of init.declarations) bindConstLike(scope, decl, init.flags);
            for (const decl of init.declarations) {
                if (decl.initializer) visit(decl.initializer, parent);
            }
        } else if (init) visit(init, parent);
        if (ts.isForStatement(node)) {
            if (node.condition) visit(node.condition, scope);
            if (node.incrementor) visit(node.incrementor, scope);
            visit(node.statement, scope);
            return;
        }
        visit(node.expression, parent);
        visit(node.statement, scope);
    }

    function visit(node: ts.Node, scope: Scope): void {
        if (ts.isFunctionLike(node)) {
            visitFunction(node, scope);
            return;
        }
        if (ts.isBlock(node)) {
            visitBlock(node, scope);
            return;
        }
        if (ts.isCaseBlock(node)) {
            const inner = childScope(scope);
            scopeOf.set(node, inner);
            for (const clause of node.clauses) addStatementBindings(clause.statements, inner);
            for (const clause of node.clauses) {
                for (const stmt of clause.statements) visit(stmt, inner);
            }
            return;
        }
        if (ts.isCatchClause(node)) {
            const inner = childScope(scope);
            scopeOf.set(node, inner);
            if (node.variableDeclaration) bindPattern(inner, node.variableDeclaration.name);
            visit(node.block, inner);
            return;
        }
        if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) {
            visitFor(node, scope);
            return;
        }
        scopeOf.set(node, scope);
        if (ts.isBinaryExpression(node) && ts.isAssignmentOperator(node.operatorToken.kind)) markTargets(node.left, scope);
        else if (
            (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
            (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
        ) {
            // `timeout++` writes the binding. Removing this arm accepts it as a timeout.
            markTargets(node.operand, scope);
        }
        ts.forEachChild(node, child => visit(child, scope));
    }

    addStatementBindings(sf.statements, moduleScope);
    for (const stmt of sf.statements) visit(stmt, moduleScope);

    function constIsTimeout(decl: ts.VariableDeclaration, stack: Set<ts.VariableDeclaration>): boolean {
        if (stack.has(decl)) return false;
        // A later write drops the const. Removing this arm accepts `const timeout = 30000; timeout = undefined`.
        if (assigned.has(decl)) return false;
        const init = decl.initializer;
        if (!init) return false;
        stack.add(decl);
        return exprIsTimeout(init, declScope.get(decl), stack);
    }

    function exprIsTimeout(expr: ts.Expression, scope: Scope | undefined, stack: Set<ts.VariableDeclaration>): boolean {
        const u = unwrap(expr);
        if (foldNumber(u) !== undefined) return true;
        if (!ts.isIdentifier(u) || !scope) return false;
        const found = lookup(scope, u.text);
        if (!found?.numberDecl) return false;
        return constIsTimeout(found.numberDecl, stack);
    }

    function isTimeoutValue(expr: ts.Expression): boolean {
        const u = unwrap(expr);
        if (foldNumber(u) !== undefined) return true;
        if (!ts.isIdentifier(u)) return false;
        // The const in scope here, not a same-named const further out.
        // Replacing `scopeOf.get(u)` with the module scope accepts `const timeout = undefined` inside the suite.
        const found = lookup(scopeOf.get(u) ?? moduleScope, u.text);
        if (!found?.numberDecl) return false;
        return constIsTimeout(found.numberDecl, new Set());
    }

    function calleeRoot(expr: ts.Expression): { id: ts.Identifier; props: string[] } | undefined {
        const props: string[] = [];
        let current = expr;
        while (true) {
            current = unwrap(current);
            if (ts.isIdentifier(current)) return { id: current, props };
            if (ts.isPropertyAccessExpression(current)) {
                props.push(current.name.text);
                current = current.expression;
                continue;
            }
            if (
                ts.isElementAccessExpression(current) &&
                current.argumentExpression &&
                ts.isStringLiteral(unwrap(current.argumentExpression))
            ) {
                props.push(unwrap(current.argumentExpression).text);
                current = current.expression;
                continue;
            }
            if (ts.isCallExpression(current)) {
                current = current.expression;
                continue;
            }
            // `describe.each\`row\``. Removing this arm drops tagged-template registrations.
            if (ts.isTaggedTemplateExpression(current)) {
                current = current.tag;
                continue;
            }
            return undefined;
        }
    }

    function registration(call: ts.CallExpression): { role: 'describe' | 'test' | 'hook'; api: string } | undefined {
        let cursor: ts.Node = call;
        while (ts.isParenthesizedExpression(cursor.parent)) cursor = cursor.parent;
        const parent = cursor.parent;
        if (ts.isCallExpression(parent) && parent.expression === cursor) return undefined;
        if (ts.isTaggedTemplateExpression(parent) && parent.tag === cursor) return undefined;
        const root = calleeRoot(call.expression);
        if (!root) return undefined;
        // `.skipIf` / `.runIf` / `.each` return a collector. Removing this arm flags `describe.skipIf(cond)`.
        const called = methodName(call.expression);
        if (called && BUILDER_CALLS.has(called)) return undefined;
        const binding = lookup(scopeOf.get(root.id), root.id.text);
        if (binding?.vitest) return binding.vitest;
        if (binding?.namespace) {
            const api = [...root.props].reverse().find(name => API_ROLE[name] !== undefined);
            if (!api) return undefined;
            return { role: API_ROLE[api]!, api };
        }
        // A local value is not a global, and a property (`pattern.test`) is not the global name.
        // Replacing this with a props scan flags `pattern.test` and a function named `test`.
        const globalApi = binding || !globals ? undefined : root.id.text;
        if (!globalApi) return undefined;
        const role = API_ROLE[globalApi];
        if (!role) return undefined;
        return { role, api: globalApi };
    }

    return { isTimeoutValue, registration };
}

type TimeoutFn = (expr: ts.Expression) => boolean;

function propertyKey(prop: ts.ObjectLiteralElementLike): string | undefined {
    if (ts.isShorthandPropertyAssignment(prop)) return prop.name.text;
    if (ts.isPropertyAssignment(prop) || ts.isMethodDeclaration(prop) || ts.isGetAccessor(prop) || ts.isSetAccessor(prop)) {
        return propName(prop.name);
    }
    return undefined;
}

/** A spread, a computed key, or another `timeout` after a real one replaces the value. `retry` does not. */
function overwritesTimeout(prop: ts.ObjectLiteralElementLike): boolean {
    if (ts.isSpreadAssignment(prop)) return true;
    const name = propertyKey(prop);
    // A computed key can replace `timeout`. Removing this arm accepts `{ timeout: 30000, ['timeout']: undefined }`.
    if (name === undefined) return true;
    // A later `timeout` replaces the earlier one. A plain `retry` does not.
    return name === 'timeout';
}

function plainTimeout(prop: ts.ObjectLiteralElementLike, isTimeout: TimeoutFn): boolean {
    if (ts.isShorthandPropertyAssignment(prop)) return prop.name.text === 'timeout' && isTimeout(prop.name);
    if (!ts.isPropertyAssignment(prop)) return false;
    if (propName(prop.name) !== 'timeout') return false;
    return isTimeout(prop.initializer);
}

function objectHasTimeout(obj: ts.ObjectLiteralExpression, isTimeout: TimeoutFn): boolean {
    const props = obj.properties;
    for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        if (!prop || !plainTimeout(prop, isTimeout)) continue;
        let later = false;
        for (let j = i + 1; j < props.length; j++) {
            const after = props[j];
            if (after && overwritesTimeout(after)) {
                later = true;
                break;
            }
        }
        if (!later) return true;
    }
    return false;
}

function callHasTimeout(call: ts.CallExpression, isTimeout: TimeoutFn, hook: boolean): boolean {
    if (hook) {
        const second = call.arguments[1];
        return second !== undefined && isTimeout(second);
    }
    const second = call.arguments[1];
    if (second && ts.isObjectLiteralExpression(unwrap(second)) && objectHasTimeout(unwrap(second), isTimeout)) return true;
    // Argument 3 only. The title (`describe(123, fn)`) is not a timeout.
    const third = call.arguments[2];
    return third !== undefined && isTimeout(third);
}

function factoryOf(call: ts.CallExpression): ts.Node | undefined {
    for (const arg of call.arguments) {
        const u = unwrap(arg);
        if (ts.isFunctionExpression(u) || ts.isArrowFunction(u)) return u;
    }
    return undefined;
}

function inside(node: ts.Node, factory: ts.Node): boolean {
    return node.pos >= factory.pos && node.end <= factory.end;
}

function judgeFile(info: ModuleInfo, globals: boolean): Violation[] {
    const bound = bindFile(info.sf, globals);
    const hits: { call: ts.CallExpression; role: 'describe' | 'test' | 'hook'; name: string; factory?: ts.Node }[] = [];
    function visit(node: ts.Node): void {
        if (ts.isCallExpression(node)) {
            const reg = bound.registration(node);
            if (reg) hits.push({ call: node, role: reg.role, name: reg.api, factory: factoryOf(node) });
        }
        ts.forEachChild(node, visit);
    }
    visit(info.sf);
    const describes = hits.filter(h => h.role === 'describe');
    const violations: Violation[] = [];
    for (const hit of hits) {
        if (hit.role === 'describe') {
            const nested = describes.some(other => other !== hit && other.factory && inside(hit.call, other.factory));
            if (nested) continue;
            if (!callHasTimeout(hit.call, bound.isTimeoutValue, false)) {
                violations.push({
                    file: info.file,
                    line: lineOf(info.sf, hit.call),
                    message: `top-level ${hit.name} has no explicit timeout ({ timeout } before any later spread or computed key, or a numeric third argument)`,
                });
            }
            continue;
        }
        if (hit.role === 'hook') {
            if (!callHasTimeout(hit.call, bound.isTimeoutValue, true)) {
                violations.push({
                    file: info.file,
                    line: lineOf(info.sf, hit.call),
                    message: `${hit.name} has no explicit timeout argument`,
                });
            }
            continue;
        }
        const nested = describes.some(other => other.factory && inside(hit.call, other.factory));
        // A case with no describe around it. Removing this arm accepts a top-level `it`.
        if (!nested) {
            violations.push({
                file: info.file,
                line: lineOf(info.sf, hit.call),
                message: 'top-level it/test is not inside a describe',
            });
        }
    }
    violations.sort((a, b) => a.line - b.line);
    return violations;
}

function analyze(files: Map<string, string>, entries: string[], globals: boolean): SpawnTimeoutReport {
    const mods = indexModules(files);
    const spawns = spawningSet(mods);
    const violations: Violation[] = [];
    let checked = 0;
    for (const entry of entries) {
        const info = mods.get(entry);
        if (!info || !spawns.has(entry)) continue;
        checked++;
        violations.push(...judgeFile(info, globals));
    }
    violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
    return { checked, violations };
}

export function verdict(report: SpawnTimeoutReport): { ok: boolean; lines: string[] } {
    const lines = report.violations.map(v => `${v.file}:${v.line}: ${v.message}`);
    lines.push(`checked ${report.checked} spawning test file(s)`);
    // Zero files is a failed detector, not a clean tree. `ok` is cleared here so dropping this
    // branch (and only this branch) turns "checked 0" into a pass.
    let ok = report.violations.length === 0;
    if (report.checked === 0) {
        ok = false;
        lines.push('the spawn-timeout gate saw no spawning test file — a detector that matches nothing is not a pass');
    } else if (ok) {
        lines.push('✅ spawn timeouts are explicit');
    }
    return { ok, lines };
}

/** Star globs only. A pattern without a leading double-star is anchored at the start of the repo-relative path. */
export function globMatch(glob: string, relPosix: string): boolean {
    let re = '^';
    let i = 0;
    const g = glob.replace(/\\/g, '/');
    while (i < g.length) {
        if (g.startsWith('**/', i)) {
            re += '(?:.*/)?';
            i += 3;
            continue;
        }
        if (g.startsWith('**', i)) {
            re += '.*';
            i += 2;
            continue;
        }
        const ch = g[i]!;
        if (ch === '*') re += '[^/]*';
        else if (ch === '?') re += '[^/]';
        else if ('\\^$.+()[]{}|'.includes(ch)) re += '\\' + ch;
        else re += ch;
        i++;
    }
    re += '$';
    return new RegExp(re).test(relPosix);
}

export interface VitestFileConfig {
    include: string[];
    exclude: string[];
    globals: boolean;
}

function assertStaticProperties(obj: ts.ObjectLiteralExpression, fileName: string, what: string): void {
    for (const p of obj.properties) {
        // A spread can replace include/exclude. Removing this arm returns the arrays written before it.
        if (ts.isSpreadAssignment(p)) {
            throw new Error(`${fileName}: ${what} has a spread — the gate cannot see what it overwrites`);
        }
        if (ts.isShorthandPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isAccessor(p)) {
            throw new Error(`${fileName}: ${what} is not a plain property list`);
        }
        if (!ts.isPropertyAssignment(p) || propName(p.name) === undefined) {
            throw new Error(`${fileName}: ${what} has a computed key`);
        }
    }
}

function stringArrayProp(obj: ts.ObjectLiteralExpression, name: string, fileName: string): string[] {
    let found: ts.Expression | undefined;
    for (const p of obj.properties) {
        if (!ts.isPropertyAssignment(p) || propName(p.name) !== name) continue;
        found = p.initializer;
    }
    if (!found || !ts.isArrayLiteralExpression(found)) {
        throw new Error(`${fileName}: test.${name} must be an array of string literals`);
    }
    const out: string[] = [];
    for (const el of found.elements) {
        if (!ts.isStringLiteral(el)) {
            throw new Error(`${fileName}: test.${name} must be an array of string literals`);
        }
        out.push(el.text);
    }
    return out;
}

function boolProp(obj: ts.ObjectLiteralExpression, name: string): boolean | undefined {
    let found: boolean | undefined;
    for (const p of obj.properties) {
        if (!ts.isPropertyAssignment(p) || propName(p.name) !== name) continue;
        if (p.initializer.kind === ts.SyntaxKind.TrueKeyword) found = true;
        else if (p.initializer.kind === ts.SyntaxKind.FalseKeyword) found = false;
        else throw new Error(`test.${name} is not a boolean literal`);
    }
    return found;
}

/** The object passed to `defineConfig({...})`. Fail closed on a spread or a computed key. */
export function readVitestConfig(text: string, fileName = 'vitest.config.ts'): VitestFileConfig {
    const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let configObj: ts.ObjectLiteralExpression | undefined;
    function visit(node: ts.Node): void {
        if (configObj) return;
        if (ts.isCallExpression(node) && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
            const callee = node.expression;
            const name = ts.isIdentifier(callee) ? callee.text : undefined;
            if (name === 'defineConfig') configObj = node.arguments[0];
        }
        ts.forEachChild(node, visit);
    }
    visit(sf);
    if (!configObj) throw new Error(`${fileName}: expected defineConfig({ ... }) with a static object`);
    assertStaticProperties(configObj, fileName, 'defineConfig');
    let testObj: ts.ObjectLiteralExpression | undefined;
    for (const p of configObj.properties) {
        if (ts.isPropertyAssignment(p) && propName(p.name) === 'test' && ts.isObjectLiteralExpression(p.initializer)) {
            testObj = p.initializer;
        }
    }
    if (!testObj) throw new Error(`${fileName}: defineConfig() has no static test: { ... }`);
    assertStaticProperties(testObj, fileName, 'test config');
    return {
        include: stringArrayProp(testObj, 'include', fileName),
        exclude: stringArrayProp(testObj, 'exclude', fileName),
        globals: boolProp(testObj, 'globals') ?? false,
    };
}

export interface VitestScriptTarget {
    script: string;
    dir: string;
    excludes: string[];
}

export function parseVitestScript(script: string, name: string): VitestScriptTarget {
    const tokens: string[] = [];
    const re = /'([^']*)'|"([^"]*)"|(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(script))) tokens.push(m[1] ?? m[2] ?? m[3] ?? '');
    if (tokens[0] !== 'vitest' || tokens[1] !== 'run') {
        throw new Error(`${name}: expected \`vitest run <dir>\`, got ${script}`);
    }
    const dirs: string[] = [];
    const excludes: string[] = [];
    for (let i = 2; i < tokens.length; i++) {
        const t = tokens[i]!;
        if (t === '--exclude') {
            const value = tokens[++i];
            if (!value) throw new Error(`${name}: --exclude without a glob`);
            excludes.push(value);
            continue;
        }
        if (t.startsWith('--exclude=')) {
            excludes.push(t.slice('--exclude='.length));
            continue;
        }
        if (t.startsWith('-')) throw new Error(`${name}: unrecognized vitest flag ${t} — the gate will not guess which files it drops`);
        dirs.push(t);
    }
    if (dirs.length !== 1) throw new Error(`${name}: expected exactly one directory, got ${dirs.join(', ') || '(none)'}`);
    return { script: name, dir: dirs[0]!, excludes };
}

function walkDir(abs: string, onFile: (absFile: string) => void): void {
    let entries: string[];
    try {
        entries = readdirSync(abs);
    } catch {
        return;
    }
    for (const name of entries) {
        if (name === 'node_modules' || name === 'dist') continue;
        const full = join(abs, name);
        let st;
        try {
            st = statSync(full);
        } catch {
            continue;
        }
        if (st.isDirectory()) walkDir(full, onFile);
        else if (st.isFile()) onFile(full);
    }
}

export function listScriptTestFiles(repoRoot: string): { files: string[]; globals: boolean } {
    const cfg = readVitestConfig(readFileSync(join(repoRoot, 'vitest.config.ts'), 'utf8'));
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
    const targets = ['test:scripts', 'repcredit:test'].map(name => {
        const script = pkg.scripts?.[name];
        if (!script) throw new Error(`package.json has no script ${name}`);
        return parseVitestScript(script, name);
    });
    const out = new Set<string>();
    for (const target of targets) {
        walkDir(join(repoRoot, target.dir), absFile => {
            const rel = relative(repoRoot, absFile).split('\\').join('/');
            if (!cfg.include.some(g => globMatch(g, rel))) return;
            if (cfg.exclude.some(g => globMatch(g, rel))) return;
            if (target.excludes.some(g => globMatch(g, rel))) return;
            out.add(rel);
        });
    }
    return { files: [...out].sort(), globals: cfg.globals };
}

function loadGraph(repoRoot: string, entries: string[]): Map<string, string> {
    const files = new Map<string, string>();
    const queue = [...entries];
    const seen = new Set<string>();
    while (queue.length) {
        const file = queue.pop()!;
        if (seen.has(file)) continue;
        seen.add(file);
        const abs = join(repoRoot, file);
        if (!existsSync(abs)) continue;
        const text = readFileSync(abs, 'utf8');
        files.set(file, text);
        const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        for (const spec of moduleRefs(sf).specs) {
            const target = resolveRelative(file, spec, cand => isRegularFile(join(repoRoot, cand)));
            if (target) queue.push(target);
        }
    }
    return files;
}

export function checkSources(files: Map<string, string>, entries: string[], globals = true): SpawnTimeoutReport {
    return analyze(files, entries, globals);
}

export function checkRepo(repoRoot: string): SpawnTimeoutReport {
    const { files: entries, globals } = listScriptTestFiles(repoRoot);
    const graph = loadGraph(repoRoot, entries);
    for (const entry of entries) {
        if (!graph.has(entry)) graph.set(entry, readFileSync(join(repoRoot, entry), 'utf8'));
    }
    return checkSources(graph, entries, globals);
}

function isDirectRun(): boolean {
    const entry = process.argv[1];
    if (!entry) return false;
    try {
        return pathToFileURL(resolve(entry)).href === import.meta.url;
    } catch {
        return false;
    }
}

if (isDirectRun()) {
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    let report: SpawnTimeoutReport;
    try {
        report = checkRepo(repoRoot);
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
    const { ok, lines } = verdict(report);
    for (const line of lines) (ok ? console.log : console.error)(line);
    if (!ok) process.exit(1);
}
