/**
 * PaymasterV4 resolution for the price keeper.
 *
 * The keeper used to resolve V4 exactly once at startup and turn ANY error into "not found". After
 * a host reboot the RPC was not reachable yet, getBytecode threw, and every later tick logged
 * `paymaster decision=skip reason=not-found` forever, with no alert (Mini, 2026-11-02 / 11-04: V4
 * 0x2118…a4B6 went unrefreshed until a manual restart; SuperPaymaster was unaffected).
 *
 * Two things are kept apart here:
 *   - transient: an RPC / network error — nothing was learned, retry on the next tick;
 *   - absent:    the chain answered and there is no usable V4 (no candidate, empty bytecode, or the
 *                factory maps the paymaster to a different operator).
 * Both are re-resolved every tick until a V4 is found; only the log reason differs. Staying
 * unresolved past a threshold raises an alert (see PaymasterTracker).
 */

export type PaymasterResolution =
    | { kind: 'found'; address: `0x${string}` }
    | { kind: 'absent'; reason: 'no-candidate' | 'no-bytecode' | 'operator-mismatch'; detail?: string }
    | { kind: 'transient'; error: string };

/** The three chain reads resolution needs (a viem PublicClient satisfies this). */
export interface PaymasterResolverClient {
    getBytecode(args: { address: `0x${string}` }): Promise<`0x${string}` | undefined>;
    readContract(args: any): Promise<unknown>;
}

export interface PaymasterResolverParams {
    /** Explicit V4 address (args / canonical / config). Without one, derive it from the factory. */
    candidate: `0x${string}` | null;
    factory: `0x${string}`;
    factoryAbi: readonly unknown[];
    operator: `0x${string}`;
    /** Check factory.getOperatorByPaymaster(candidate) == operator. */
    verifyOperatorMapping: boolean;
}

const ZERO = '0x0000000000000000000000000000000000000000';
const errMsg = (e: unknown) => ((e as any)?.shortMessage || (e as any)?.message || String(e)).split('\n')[0];

export async function resolvePaymasterV4(
    client: PaymasterResolverClient,
    p: PaymasterResolverParams,
): Promise<PaymasterResolution> {
    let address = p.candidate;
    // An explicitly configured zero address means "no V4", not "derive one": deriving would pick a
    // target the configuration never named, possibly without the operator check derived targets get.
    if (address && address.toLowerCase() === ZERO) {
        return { kind: 'absent', reason: 'no-candidate', detail: 'configured as the zero address' };
    }
    if (!address) {
        try {
            const derived = (await client.readContract({
                address: p.factory,
                abi: p.factoryAbi,
                functionName: 'paymasterByOperator',
                args: [p.operator],
            })) as `0x${string}`;
            if (!derived || derived.toLowerCase() === ZERO) return { kind: 'absent', reason: 'no-candidate' };
            address = derived;
        } catch (e) {
            return { kind: 'transient', error: `paymasterByOperator: ${errMsg(e)}` };
        }
    }

    let bytecode: `0x${string}` | undefined;
    try {
        bytecode = await client.getBytecode({ address });
    } catch (e) {
        return { kind: 'transient', error: `getBytecode(${address}): ${errMsg(e)}` };
    }
    if (!bytecode || bytecode === '0x') return { kind: 'absent', reason: 'no-bytecode', detail: address };

    if (p.verifyOperatorMapping) {
        let mapped: `0x${string}`;
        try {
            mapped = (await client.readContract({
                address: p.factory,
                abi: p.factoryAbi,
                functionName: 'getOperatorByPaymaster',
                args: [address],
            })) as `0x${string}`;
        } catch (e) {
            return { kind: 'transient', error: `getOperatorByPaymaster: ${errMsg(e)}` };
        }
        if (mapped.toLowerCase() !== p.operator.toLowerCase()) {
            return { kind: 'absent', reason: 'operator-mismatch', detail: `${address} -> ${mapped}` };
        }
    }
    return { kind: 'found', address };
}

/** One-line description of an unresolved state, for logs / health / alerts. */
export function describeUnresolved(r: Exclude<PaymasterResolution, { kind: 'found' }>): string {
    return r.kind === 'transient'
        ? `transient error=${r.error}`
        : `absent:${r.reason}${r.detail ? ` (${r.detail})` : ''}`;
}

/**
 * Keeps the resolved V4 across ticks and re-resolves while unresolved. `ensure()` is called once per
 * tick; once a V4 is found it is kept (no further reads).
 */
export class PaymasterTracker {
    private address: `0x${string}` | null = null;
    private last: PaymasterResolution | null = null;
    private unresolvedSinceSec: bigint | null = null;
    private lastAlertSec: bigint | null = null;
    private resolvedAfterSec = 0n;
    private resolvedAfterAlert = false;

    constructor(
        private readonly client: PaymasterResolverClient,
        private readonly params: PaymasterResolverParams,
        /** Alert once unresolved for this long, then at most once per this interval. 0 disables. */
        private readonly alertAfterSec: bigint,
    ) {}

    get current(): `0x${string}` | null {
        return this.address;
    }

    get lastResult(): PaymasterResolution | null {
        return this.last;
    }

    /** How long the V4 had been unresolved when it was finally found (0 if found on the first try). */
    get lastResolvedAfterSec(): bigint {
        return this.resolvedAfterSec;
    }

    /**
     * Whether a not-found alert was attempted before the V4 was finally found. Attempted, not
     * confirmed: a notify that timed out may still arrive late, and the Telegram sender swallows
     * errors, so delivery is unknowable here. An extra recovery notice is noise; a missing one
     * leaves the operator believing the V4 is still unrefreshed.
     */
    get lastResolvedAfterAlert(): boolean {
        return this.resolvedAfterAlert;
    }

    /** Seconds the V4 has been unresolved (0 when resolved or never tried). */
    unresolvedForSec(nowSec: bigint): bigint {
        return this.unresolvedSinceSec === null ? 0n : nowSec - this.unresolvedSinceSec;
    }

    async ensure(nowSec: bigint): Promise<PaymasterResolution> {
        if (this.address) return { kind: 'found', address: this.address };
        const r = await resolvePaymasterV4(this.client, this.params);
        this.last = r;
        if (r.kind === 'found') {
            this.address = r.address;
            this.resolvedAfterSec = this.unresolvedSinceSec === null ? 0n : nowSec - this.unresolvedSinceSec;
            this.resolvedAfterAlert = this.lastAlertSec !== null;
            this.unresolvedSinceSec = null;
            this.lastAlertSec = null;
        } else if (this.unresolvedSinceSec === null) {
            this.unresolvedSinceSec = nowSec;
        }
        return r;
    }

    /** True when an alert is due now (and records it). */
    alertDue(nowSec: bigint): boolean {
        if (this.alertAfterSec <= 0n || this.address || this.unresolvedSinceSec === null) return false;
        if (nowSec - this.unresolvedSinceSec < this.alertAfterSec) return false;
        if (this.lastAlertSec !== null && nowSec - this.lastAlertSec < this.alertAfterSec) return false;
        this.lastAlertSec = nowSec;
        return true;
    }
}

export interface PaymasterStepContext {
    /** Upper bound on one notification; the step never waits longer (default 15s). */
    notifyTimeoutMs?: number;
    network: string;
    /** For the alert text: the configured candidate, or how it is derived. */
    candidateLabel: string;
    operator: string;
    log: (line: string) => void;
    notify: (text: string) => Promise<void>;
}

/**
 * The per-tick V4 step: returns the V4 to refresh this tick, or null to skip it. While unresolved
 * it re-resolves, logs why it is skipping, and alerts once the threshold is crossed; when a V4 is
 * found after a not-found alert was attempted, it says so (a slow first read alone stays in the log).
 */
/**
 * Fire a notification without letting it hold the tick: it runs before every price read, so a
 * notifier that never settles would otherwise stop BOTH paymasters from being refreshed.
 */
async function notifyBounded(ctx: PaymasterStepContext, text: string): Promise<void> {
    const ms = ctx.notifyTimeoutMs ?? 15_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((r) => { timer = setTimeout(() => r('timeout'), ms); });
    try {
        const outcome = await Promise.race([ctx.notify(text).then(() => 'sent' as const), timeout]);
        if (outcome === 'timeout') ctx.log(`paymaster notify timed out after ${ms}ms (continuing)`);
    } catch (e) {
        ctx.log(`paymaster notify failed: ${(e as any)?.message ?? String(e)} (continuing)`);
    } finally {
        clearTimeout(timer);
    }
}

export async function paymasterTickStep(
    tracker: PaymasterTracker,
    nowSec: bigint,
    ctx: PaymasterStepContext,
): Promise<`0x${string}` | null> {
    const wasResolved = tracker.current !== null;
    const r = await tracker.ensure(nowSec);
    if (r.kind === 'found') {
        if (!wasResolved) {
            const after = tracker.lastResolvedAfterSec;
            ctx.log(`paymaster resolved=${r.address} afterSec=${after.toString()}`);
            if (tracker.lastResolvedAfterAlert) {
                await notifyBounded(ctx, 
                    `[keeper] paymaster resolved\nnetwork=${ctx.network}\npaymaster=${r.address}\nunresolvedSec=${after.toString()}`,
                );
            }
        }
        return r.address;
    }
    const why = describeUnresolved(r);
    const forSec = tracker.unresolvedForSec(nowSec);
    ctx.log(`paymaster decision=skip reason=not-found ${why} unresolvedSec=${forSec.toString()}`);
    if (tracker.alertDue(nowSec)) {
        ctx.log(`alert kind=paymaster reason=not-found unresolvedSec=${forSec.toString()}`);
        await notifyBounded(ctx, 
            `[keeper] paymaster not found\nnetwork=${ctx.network}\n${why}\nunresolvedSec=${forSec.toString()}\n` +
                `candidate=${ctx.candidateLabel}\noperator=${ctx.operator}`,
        );
    }
    return null;
}
