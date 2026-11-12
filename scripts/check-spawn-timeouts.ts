#!/usr/bin/env tsx
/**
 * Spawning tests must say how long they are allowed to take.
 *
 * vitest 4.0.17 (measured, see the SPAWN_VERDICT_TIMEOUT_MS notes in the suites this guards):
 * a describe-level `{ timeout }` applies to cases only. Hooks keep `hookTimeout`, default 10s.
 * A file that sets neither sits on the 5s test default. `execFileSync` / `spawnSync` block the
 * event loop the timer runs on, so the number bounds the VERDICT, not a hung child — a slow
 * spawn and a failed assertion are the same `×` line. FU-47 is that rule applied by hand to the
 * suites that had already hurt, and not to their siblings.
 *
 * Scope is the *.test.ts files CI actually executes under the root vitest config:
 * test:scripts (vitest run scripts, excluding the repcredit glob) UNION repcredit:test
 * (vitest run scripts/repcredit). The exclude exists so those files are not run twice;
 * repcredit:test is the job that runs them. Watching only test:scripts would leave out the
 * four files the follow-up names.
 *
 * A call counts when it resolves to `child_process`'s exec / execFile / spawn / execSync /
 * execFileSync / spawnSync / fork, or to any value import from `execa`, or to a function in this
 * repo whose body reaches one of those (a helper). Resolution is the TypeScript AST plus bindings
 * this file builds from it — not a regex over the source.
 *
 * Run: `pnpm run check:spawn-timeouts`
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const SPAWN_NAMES = new Set(['exec', 'execFile', 'spawn', 'execSync', 'execFileSync', 'spawnSync', 'fork']);
const CHILD_PROCESS = new Set(['child_process', 'node:child_process']);
const VITEST_HOOKS = new Set(['beforeAll', 'beforeEach', 'afterAll', 'afterEach']);
const VITEST_TESTS = new Set(['it', 'test']);

export interface Violation {
    file: string;
    line: number;
    message: string;
}

export interface SpawnHelper {
    /** Repo-relative file that defines the helper, posix. */
    file: string;
    /** Binding name, when it has one. */
    name: string;
    /** How it reaches a spawn API: `execFileSync` or `calls <other helper>`. */
    via: string;
}

export interface SpawnTimeoutReport {
    /** Spawning test files the rule actually judged. Zero is a failure, not a clean tree. */
    checked: number;
    violations: Violation[];
    helpers: SpawnHelper[];
}

type Role = 'describe' | 'test' | 'hook';

interface Fn {
    file: string;
    node: ts.SignatureDeclaration;
    name?: string;
    calls: CallSite[];
    /** Set during the fixed point. Direct spawn calls are noted separately for the helper list. */
    directSpawn: boolean;
    reachesSpawn: boolean;
    /** Named helpers this function calls that themselves reach a spawn. */
    viaHelper?: string;
}

interface CallSite {
    expr: ts.CallExpression;
    scope: Scope;
}

interface Scope {
    parent?: Scope;
    bindings: Map<string, Binding>;
}

type Binding =
    | { kind: 'fn'; fn: Fn }
    | { kind: 'spawn'; api: string }
    | { kind: 'spawn-ns'; from: 'child_process' | 'execa' }
    | { kind: 'ns'; exports: Map<string, Binding> }
    | { kind: 'vitest'; role: Role; hook?: string }
    | { kind: 'value' };

interface PendingImport {
    local: string;
    imported: string;
    specifier: string;
    form: 'named' | 'namespace' | 'default';
    typeOnly: boolean;
}

interface PendingReexport {
    specifier: string;
    /** undefined means `export *`. */
    names?: { exported: string; imported: string }[];
}

interface Module {
    file: string;
    sf: ts.SourceFile;
    scope: Scope;
    exports: Map<string, Binding>;
    fns: Fn[];
    imports: PendingImport[];
    reexports: PendingReexport[];
    fnByNode: Map<ts.Node, Fn>;
}

function newScope(parent?: Scope): Scope {
    return { parent, bindings: new Map() };
}

function lookup(scope: Scope | undefined, name: string): Binding | undefined {
    for (let s = scope; s; s = s.parent) {
        const b = s.bindings.get(name);
        if (b) return b;
    }
    return undefined;
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

function hasExportModifier(node: ts.Node): boolean {
    return ts.canHaveModifiers(node)
        ? (ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false)
        : false;
}

function isFnLike(node: ts.Node): node is ts.SignatureDeclaration {
    return ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node);
}

/** `{ timeout: ... }` or `{ timeout }`, including through `as` / parentheses. Not a spread. */
function objectHasTimeout(expr: ts.Expression): boolean {
    const u = unwrap(expr);
    if (!ts.isObjectLiteralExpression(u)) return false;
    return u.properties.some(p => {
        if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) return propName(p.name) === 'timeout';
        return false;
    });
}

/**
 * A timeout argument that is present as a value: a number, arithmetic on numbers, or a name
 * (the SPAWN_VERDICT_TIMEOUT_MS form). `undefined` and a function (the suite callback) do not count.
 */
function isTimeoutValue(expr: ts.Expression, scope: Scope): boolean {
    const u = unwrap(expr);
    if (ts.isNumericLiteral(u)) return true;
    if (ts.isPrefixUnaryExpression(u)) return isTimeoutValue(u.operand, scope);
    if (ts.isBinaryExpression(u)) return isTimeoutValue(u.left, scope) && isTimeoutValue(u.right, scope);
    if (!ts.isIdentifier(u)) return false;
    if (u.text === 'undefined') return false;
    const b = lookup(scope, u.text);
    if (!b || b.kind === 'value') return true;
    return false;
}

function leftmost(expr: ts.Expression): ts.Identifier | undefined {
    const e = unwrap(expr);
    if (ts.isIdentifier(e)) return e;
    if (ts.isPropertyAccessExpression(e)) return leftmost(e.expression);
    if (ts.isCallExpression(e) || ts.isTaggedTemplateExpression(e)) return leftmost(e.expression);
    return undefined;
}

function calleeRoot(expr: ts.Expression): string | undefined {
    return leftmost(expr)?.text;
}

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function createFn(file: string, node: ts.SignatureDeclaration, name?: string): Fn {
    return { file, node, name, calls: [], directSpawn: false, reachesSpawn: false };
}

function bindFunctionDecl(mod: Module, node: ts.FunctionDeclaration, scope: Scope): void {
    if (!node.name) return;
    let fn = mod.fnByNode.get(node);
    if (!fn) {
        fn = createFn(mod.file, node, node.name.text);
        mod.fnByNode.set(node, fn);
        mod.fns.push(fn);
    }
    const binding: Binding = { kind: 'fn', fn };
    scope.bindings.set(node.name.text, binding);
    if (hasExportModifier(node)) mod.exports.set(node.name.text, binding);
}

/** Function declarations that are direct statements. ES modules are strict, so nested blocks keep theirs. */
function hoistFunctionDecls(stmts: readonly ts.Statement[], mod: Module, scope: Scope): void {
    for (const stmt of stmts) {
        if (ts.isFunctionDeclaration(stmt)) bindFunctionDecl(mod, stmt, scope);
    }
}

function bindImports(mod: Module): void {
    for (const stmt of mod.sf.statements) {
        if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
        const specifier = stmt.moduleSpecifier.text;
        const clause = stmt.importClause;
        if (!clause) continue;
        const stmtTypeOnly = clause.isTypeOnly;
        if (clause.name) {
            mod.imports.push({
                local: clause.name.text,
                imported: 'default',
                specifier,
                form: 'default',
                typeOnly: stmtTypeOnly,
            });
        }
        if (!clause.namedBindings) continue;
        if (ts.isNamespaceImport(clause.namedBindings)) {
            mod.imports.push({
                local: clause.namedBindings.name.text,
                imported: '*',
                specifier,
                form: 'namespace',
                typeOnly: stmtTypeOnly,
            });
            continue;
        }
        for (const el of clause.namedBindings.elements) {
            mod.imports.push({
                local: el.name.text,
                imported: el.propertyName ? el.propertyName.text : el.name.text,
                specifier,
                form: 'named',
                typeOnly: stmtTypeOnly || el.isTypeOnly,
            });
        }
    }
    for (const stmt of mod.sf.statements) {
        if (!ts.isExportDeclaration(stmt) || !stmt.moduleSpecifier || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
        if (!stmt.exportClause) {
            mod.reexports.push({ specifier: stmt.moduleSpecifier.text });
            continue;
        }
        if (!ts.isNamedExports(stmt.exportClause)) continue;
        mod.reexports.push({
            specifier: stmt.moduleSpecifier.text,
            names: stmt.exportClause.elements
                .filter(el => !el.isTypeOnly)
                .map(el => ({
                    exported: el.name.text,
                    imported: el.propertyName ? el.propertyName.text : el.name.text,
                })),
        });
    }
}

function walk(mod: Module, node: ts.Node, scope: Scope, owner: Fn | undefined): void {
    if (ts.isFunctionDeclaration(node)) {
        const fn = node.name ? mod.fnByNode.get(node) : undefined;
        const fnScope = newScope(scope);
        const bodyOwner = fn ?? owner;
        if (fn && node.body) {
            hoistFunctionDecls(node.body.statements, mod, fnScope);
            for (const stmt of node.body.statements) walk(mod, stmt, fnScope, fn);
        }
        if (!fn && node.body) walk(mod, node.body, fnScope, bodyOwner);
        return;
    }
    if (ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)) {
        let fn = mod.fnByNode.get(node);
        if (!fn) {
            const name = ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) ? node.name.text : undefined;
            fn = createFn(mod.file, node, name);
            mod.fnByNode.set(node, fn);
            mod.fns.push(fn);
        }
        const fnScope = newScope(scope);
        const body = node.body;
        if (body && ts.isBlock(body)) {
            hoistFunctionDecls(body.statements, mod, fnScope);
            for (const stmt of body.statements) walk(mod, stmt, fnScope, fn);
        } else if (body) {
            walk(mod, body, fnScope, fn);
        }
        return;
    }
    if (ts.isBlock(node)) {
        const blockScope = newScope(scope);
        hoistFunctionDecls(node.statements, mod, blockScope);
        for (const stmt of node.statements) walk(mod, stmt, blockScope, owner);
        return;
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isFnLike(node.initializer)) {
        walk(mod, node.initializer, scope, owner);
        const fn = mod.fnByNode.get(node.initializer);
        if (fn) {
            fn.name = node.name.text;
            const binding: Binding = { kind: 'fn', fn };
            scope.bindings.set(node.name.text, binding);
            const list = node.parent;
            const stmt = list?.parent;
            if (stmt && ts.isVariableStatement(stmt) && hasExportModifier(stmt)) mod.exports.set(node.name.text, binding);
        }
        return;
    }
    if (ts.isCallExpression(node)) {
        if (owner) owner.calls.push({ expr: node, scope });
        // Calls at module scope still need their argument functions walked; the call itself is not a test body.
    }
    ts.forEachChild(node, child => walk(mod, child, scope, owner));
}

function parseModule(file: string, text: string): Module {
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const mod: Module = {
        file,
        sf,
        scope: newScope(),
        exports: new Map(),
        fns: [],
        imports: [],
        reexports: [],
        fnByNode: new Map(),
    };
    bindImports(mod);
    hoistFunctionDecls(sf.statements, mod, mod.scope);
    for (const stmt of sf.statements) walk(mod, stmt, mod.scope, undefined);
    // `export { localName }` after the local binding exists.
    for (const stmt of sf.statements) {
        if (!ts.isExportDeclaration(stmt) || stmt.moduleSpecifier || !stmt.exportClause || !ts.isNamedExports(stmt.exportClause)) continue;
        for (const el of stmt.exportClause.elements) {
            if (el.isTypeOnly) continue;
            const imported = el.propertyName ? el.propertyName.text : el.name.text;
            const b = lookup(mod.scope, imported);
            if (b) mod.exports.set(el.name.text, b);
        }
    }
    return mod;
}

function spawnBindingForImport(im: PendingImport): Binding | undefined {
    if (im.typeOnly) return undefined;
    if (CHILD_PROCESS.has(im.specifier)) {
        if (im.form === 'named') {
            return SPAWN_NAMES.has(im.imported) ? { kind: 'spawn', api: im.imported } : { kind: 'value' };
        }
        return { kind: 'spawn-ns', from: 'child_process' };
    }
    if (im.specifier === 'execa') {
        if (im.form === 'named' || im.form === 'default') return { kind: 'spawn', api: im.imported === 'default' ? 'execa' : im.imported };
        return { kind: 'spawn-ns', from: 'execa' };
    }
    if (im.specifier === 'vitest' && im.form === 'named') {
        if (im.imported === 'describe') return { kind: 'vitest', role: 'describe' };
        if (VITEST_TESTS.has(im.imported)) return { kind: 'vitest', role: 'test' };
        if (VITEST_HOOKS.has(im.imported)) return { kind: 'vitest', role: 'hook', hook: im.imported };
    }
    return undefined;
}

function resolveExport(mod: Module, name: string, modules: Map<string, Module>, stack: Set<string>): Binding | undefined {
    const direct = mod.exports.get(name);
    if (direct) return direct;
    const key = `${mod.file}#${name}`;
    if (stack.has(key)) return undefined;
    stack.add(key);
    for (const rex of mod.reexports) {
        const other = modules.get(rex.specifierResolved ?? '');
        if (!other) continue;
        if (!rex.names) {
            const b = resolveExport(other, name, modules, stack);
            if (b) return b;
            continue;
        }
        for (const n of rex.names) {
            if (n.exported === name) return resolveExport(other, n.imported, modules, stack);
        }
    }
    return undefined;
}

interface ResolvedReexport extends PendingReexport {
    specifierResolved?: string;
}

const NON_CODE = /\.(json|md|node|css|svg|png|txt)$/;

function linkModules(modules: Map<string, Module>, resolvePath: (from: string, spec: string) => string | undefined, unresolved: Violation[]): void {
    for (const mod of modules.values()) {
        for (const rex of mod.reexports as ResolvedReexport[]) {
            rex.specifierResolved = resolvePath(mod.file, rex.specifier);
        }
    }
    for (const mod of modules.values()) {
        for (const im of mod.imports) {
            const known = spawnBindingForImport(im);
            if (known) {
                mod.scope.bindings.set(im.local, known);
                continue;
            }
            if (im.typeOnly || !im.specifier.startsWith('.')) continue;
            if (NON_CODE.test(im.specifier)) continue;
            const target = resolvePath(mod.file, im.specifier);
            if (!target || !modules.has(target)) {
                unresolved.push({
                    file: mod.file,
                    line: 1,
                    message: `unresolved import '${im.specifier}' — the gate cannot see whether it spawns`,
                });
                continue;
            }
            const other = modules.get(target)!;
            if (im.form === 'namespace') {
                mod.scope.bindings.set(im.local, { kind: 'ns', exports: other.exports });
                continue;
            }
            const exportedName = im.form === 'default' ? 'default' : im.imported;
            const b = resolveExport(other, exportedName, modules, new Set());
            mod.scope.bindings.set(im.local, b ?? { kind: 'value' });
        }
    }
}

function resolveCallee(expr: ts.Expression, scope: Scope): Binding | undefined {
    const e = unwrap(expr);
    if (ts.isIdentifier(e)) return lookup(scope, e.text);
    if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression)) {
        const obj = lookup(scope, e.expression.text);
        if (!obj) return undefined;
        const prop = e.name.text;
        if (obj.kind === 'spawn-ns') {
            if (obj.from === 'execa') return { kind: 'spawn', api: prop };
            if (SPAWN_NAMES.has(prop)) return { kind: 'spawn', api: prop };
            return undefined;
        }
        if (obj.kind === 'ns') return obj.exports.get(prop);
    }
    return undefined;
}

function fixedPoint(fns: Fn[]): void {
    let changed = true;
    while (changed) {
        changed = false;
        for (const fn of fns) {
            if (fn.reachesSpawn) continue;
            for (const site of fn.calls) {
                const b = resolveCallee(site.expr.expression, site.scope);
                if (!b) continue;
                if (b.kind === 'spawn') {
                    fn.directSpawn = true;
                    fn.reachesSpawn = true;
                    fn.viaHelper = b.api;
                    changed = true;
                    break;
                }
                // Helper edge. Removing this arm makes a spawn wrapped in a local or imported
                // function invisible to the describe / hook that calls it.
                if (b.kind === 'fn' && b.fn.reachesSpawn) {
                    fn.reachesSpawn = true;
                    fn.viaHelper = b.fn.name ?? '(anonymous)';
                    changed = true;
                    break;
                }
            }
        }
    }
}

function vitestRole(call: ts.CallExpression, scope: Scope, globals: boolean): { role: Role; hook?: string } | undefined {
    const id = leftmost(call.expression);
    if (!id) return undefined;
    const root = id.text;
    const b = lookup(scope, root);
    if (b?.kind === 'vitest') return { role: b.role, hook: b.hook ?? root };
    if (b || !globals) return undefined;
    if (root === 'describe') return { role: 'describe' };
    if (VITEST_TESTS.has(root)) return { role: 'test' };
    if (VITEST_HOOKS.has(root)) return { role: 'hook', hook: root };
    return undefined;
}

function callbackOf(call: ts.CallExpression, scope: Scope, mod: Module): Fn | undefined {
    for (const arg of call.arguments) {
        const u = unwrap(arg);
        if (isFnLike(u)) return mod.fnByNode.get(u);
        if (ts.isIdentifier(u)) {
            const b = lookup(scope, u.text);
            if (b?.kind === 'fn') return b.fn;
        }
    }
    return undefined;
}

function describeHasTimeout(call: ts.CallExpression, scope: Scope): boolean {
    for (const arg of call.arguments) {
        if (objectHasTimeout(arg)) return true;
    }
    const third = call.arguments[2];
    return third ? isTimeoutValue(third, scope) : false;
}

function hookHasTimeout(call: ts.CallExpression, scope: Scope): boolean {
    const second = call.arguments[1];
    return second ? isTimeoutValue(second, scope) : false;
}

/** Calls inside functions carry the scope from the binding walk. Module-level calls do not, so they are collected here against `mod.scope`. */
function collectAllCalls(mod: Module): { expr: ts.CallExpression; scope: Scope }[] {
    const seen = new Set<ts.CallExpression>();
    const out: { expr: ts.CallExpression; scope: Scope }[] = [];
    for (const fn of mod.fns) {
        for (const site of fn.calls) {
            if (seen.has(site.expr)) continue;
            seen.add(site.expr);
            out.push(site);
        }
    }
    // Module-scope calls: replay only the top-level statements against mod.scope, and do not
    // descend into functions (their calls are already stored). Descend into blocks so a top-level
    // `if` still counts, and into non-function expressions.
    function visit(node: ts.Node, scope: Scope): void {
        if (isFnLike(node) && !ts.isSourceFile(node)) return;
        if (ts.isBlock(node)) {
            const blockScope = newScope(scope);
            // consts inside a top-level block are rare for describe(); copy nothing, lookup walks parent.
            for (const stmt of node.statements) visit(stmt, blockScope);
            return;
        }
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            const existing = scope.bindings.get(node.name.text);
            if (!existing) {
                const fn = node.initializer && isFnLike(node.initializer) ? mod.fnByNode.get(node.initializer) : undefined;
                if (fn) scope.bindings.set(node.name.text, { kind: 'fn', fn });
            }
        }
        if (ts.isCallExpression(node) && !seen.has(node)) {
            seen.add(node);
            out.push({ expr: node, scope });
        }
        ts.forEachChild(node, child => visit(child, scope));
    }
    visit(mod.sf, mod.scope);
    return out;
}

function factoryNode(call: ts.CallExpression, scope: Scope): ts.Node | undefined {
    for (const arg of call.arguments) {
        const u = unwrap(arg);
        if (isFnLike(u)) return u;
        if (ts.isIdentifier(u)) {
            const b = lookup(scope, u.text);
            if (b?.kind === 'fn') return b.fn.node;
        }
    }
    return undefined;
}

function isInsideFactory(node: ts.Node, factory: ts.Node): boolean {
    let cur: ts.Node | undefined = node;
    while (cur) {
        if (cur === factory) return true;
        cur = cur.parent;
    }
    return false;
}

function analyze(files: Map<string, string>, entries: string[], globals: boolean): SpawnTimeoutReport {
    const resolvePath = (from: string, spec: string): string | undefined => {
        if (!spec.startsWith('.')) return undefined;
        const dir = posixDir(from);
        const joined = posixNorm(posixJoin(dir, spec));
        const cands: string[] = [joined];
        if (joined.endsWith('.js')) {
            cands.push(joined.slice(0, -3) + '.ts', joined.slice(0, -3) + '.tsx', joined.slice(0, -3) + '.mts');
        }
        cands.push(joined + '.ts', joined + '.tsx', joined + '.mts', posixJoin(joined, 'index.ts'));
        for (const c of cands) if (files.has(c)) return c;
        return undefined;
    };

    const modules = new Map<string, Module>();
    const queue = [...entries];
    while (queue.length) {
        const file = queue.pop()!;
        if (modules.has(file)) continue;
        const text = files.get(file);
        if (text === undefined) continue;
        const mod = parseModule(file, text);
        modules.set(file, mod);
        for (const im of mod.imports) {
            if (im.typeOnly || !im.specifier.startsWith('.')) continue;
            const target = resolvePath(file, im.specifier);
            if (target && !modules.has(target)) queue.push(target);
        }
        for (const rex of mod.reexports) {
            const target = resolvePath(file, rex.specifier);
            if (target && !modules.has(target)) queue.push(target);
        }
    }

    const unresolved: Violation[] = [];
    linkModules(modules, resolvePath, unresolved);
    const allFns: Fn[] = [];
    for (const mod of modules.values()) allFns.push(...mod.fns);
    fixedPoint(allFns);

    const violations: Violation[] = [];
    const helpers: SpawnHelper[] = [];
    const helperSeen = new Set<string>();
    let checked = 0;

    for (const entry of entries) {
        const mod = modules.get(entry);
        if (!mod) continue;
        const calls = collectAllCalls(mod);
        const describes: { expr: ts.CallExpression; scope: Scope }[] = [];
        const hooks: { expr: ts.CallExpression; scope: Scope; name: string }[] = [];
        const tests: { expr: ts.CallExpression; scope: Scope }[] = [];
        for (const c of calls) {
            const role = vitestRole(c.expr, c.scope, globals);
            if (!role) continue;
            if (role.role === 'describe') describes.push(c);
            else if (role.role === 'test') tests.push(c);
            else hooks.push({ ...c, name: role.hook ?? calleeRoot(c.expr.expression) ?? 'hook' });
        }

        const spawningTests = tests.filter(t => {
            const fn = callbackOf(t.expr, t.scope, mod);
            return Boolean(fn?.reachesSpawn);
        });
        const spawningHooks = hooks.filter(h => {
            const fn = callbackOf(h.expr, h.scope, mod);
            return Boolean(fn?.reachesSpawn);
        });

        const directInFile = mod.fns.some(fn => fn.directSpawn) || spawningTests.length > 0 || spawningHooks.length > 0;
        if (!directInFile && !mod.fns.some(fn => fn.reachesSpawn)) continue;
        // A file that only reaches a spawn through a helper still counts: the helper's fn lives
        // in another module, and the test callback in THIS file reaches it.
        const fileSpawns = spawningTests.length > 0 || spawningHooks.length > 0 || mod.fns.some(fn => fn.directSpawn);
        if (!fileSpawns) continue;
        checked++;

        const topLevel = describes.filter(d => {
            const parentFactories = describes
                .filter(other => other.expr !== d.expr)
                .map(other => factoryNode(other.expr, other.scope))
                .filter((n): n is ts.Node => Boolean(n));
            return !parentFactories.some(factory => isInsideFactory(d.expr, factory));
        });

        for (const d of topLevel) {
            const factory = factoryNode(d.expr, d.scope);
            const contains = spawningTests.some(t => (factory ? isInsideFactory(t.expr, factory) : false));
            if (!contains) continue;
            if (!describeHasTimeout(d.expr, d.scope)) {
                violations.push({
                    file: entry,
                    line: lineOf(mod.sf, d.expr),
                    message: 'top-level describe contains a spawning test but has no explicit timeout ({ timeout } or a numeric third argument)',
                });
            }
        }
        for (const h of spawningHooks) {
            if (!hookHasTimeout(h.expr, h.scope)) {
                violations.push({
                    file: entry,
                    line: lineOf(mod.sf, h.expr),
                    message: `${h.name} spawns but has no explicit timeout argument`,
                });
            }
        }

        const reached = new Set<Fn>();
        const stack: Fn[] = [];
        for (const t of spawningTests) {
            const fn = callbackOf(t.expr, t.scope, mod);
            if (fn) stack.push(fn);
        }
        for (const h of spawningHooks) {
            const fn = callbackOf(h.expr, h.scope, mod);
            if (fn) stack.push(fn);
        }
        while (stack.length) {
            const fn = stack.pop()!;
            if (reached.has(fn)) continue;
            reached.add(fn);
            for (const site of fn.calls) {
                const b = resolveCallee(site.expr.expression, site.scope);
                if (b?.kind === 'fn') stack.push(b.fn);
            }
        }
        for (const fn of reached) {
            if (!fn.name) continue;
            if (!fn.directSpawn && !fn.viaHelper) continue;
            // The test/hook callback itself is not a helper.
            if (spawningTests.some(t => callbackOf(t.expr, t.scope, mod) === fn)) continue;
            if (spawningHooks.some(h => callbackOf(h.expr, h.scope, mod) === fn)) continue;
            const id = `${fn.file}#${fn.name}`;
            if (helperSeen.has(id)) continue;
            helperSeen.add(id);
            const via = fn.directSpawn ? (fn.viaHelper ?? 'spawn') : `calls ${fn.viaHelper}`;
            helpers.push({ file: fn.file, name: fn.name, via });
        }
    }

    violations.push(...unresolved.filter(v => entries.includes(v.file)));
    violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
    helpers.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
    return { checked, violations, helpers };
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

export function verdict(report: SpawnTimeoutReport): { ok: boolean; lines: string[] } {
    const lines = report.violations.map(v => `${v.file}:${v.line}: ${v.message}`);
    if (report.helpers.length) {
        lines.push('helpers: ' + report.helpers.map(h => `${h.file}#${h.name} (${h.via})`).join(', '));
    }
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

function stringArrayProp(obj: ts.ObjectLiteralExpression, name: string): string[] | undefined {
    for (const p of obj.properties) {
        if (!ts.isPropertyAssignment(p) || propName(p.name) !== name) continue;
        if (!ts.isArrayLiteralExpression(p.initializer)) return undefined;
        const out: string[] = [];
        for (const el of p.initializer.elements) {
            if (!ts.isStringLiteral(el)) return undefined;
            out.push(el.text);
        }
        return out;
    }
    return undefined;
}

function boolProp(obj: ts.ObjectLiteralExpression, name: string): boolean | undefined {
    for (const p of obj.properties) {
        if (!ts.isPropertyAssignment(p) || propName(p.name) !== name) continue;
        if (p.initializer.kind === ts.SyntaxKind.TrueKeyword) return true;
        if (p.initializer.kind === ts.SyntaxKind.FalseKeyword) return false;
    }
    return undefined;
}

/** The object passed to `defineConfig({...})` or a top-level object export. Fail closed on anything else. */
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
    let testObj: ts.ObjectLiteralExpression | undefined;
    for (const p of configObj.properties) {
        if (ts.isPropertyAssignment(p) && propName(p.name) === 'test' && ts.isObjectLiteralExpression(p.initializer)) {
            testObj = p.initializer;
        }
    }
    if (!testObj) throw new Error(`${fileName}: defineConfig() has no static test: { ... }`);
    const include = stringArrayProp(testObj, 'include');
    const exclude = stringArrayProp(testObj, 'exclude');
    if (!include || !exclude) throw new Error(`${fileName}: test.include and test.exclude must be string arrays`);
    return { include, exclude, globals: boolProp(testObj, 'globals') ?? false };
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
    const resolvePath = (from: string, spec: string): string | undefined => {
        if (!spec.startsWith('.')) return undefined;
        const dir = posixDir(from);
        const joined = posixNorm(posixJoin(dir, spec));
        const cands = [joined];
        if (joined.endsWith('.js')) {
            cands.push(joined.slice(0, -3) + '.ts', joined.slice(0, -3) + '.tsx', joined.slice(0, -3) + '.mts');
        }
        cands.push(joined + '.ts', joined + '.tsx', joined + '.mts', posixJoin(joined, 'index.ts'));
        for (const c of cands) {
            if (files.has(c) || existsSync(join(repoRoot, c))) return c;
        }
        return undefined;
    };
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
        const specs: string[] = [];
        for (const stmt of sf.statements) {
            if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) specs.push(stmt.moduleSpecifier.text);
            if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) specs.push(stmt.moduleSpecifier.text);
        }
        for (const spec of specs) {
            const target = resolvePath(file, spec);
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
    return analyze(graph, entries, globals);
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
