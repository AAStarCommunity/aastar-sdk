/**
 * Price and pause scopes after a signer-identity check.
 * The clock is injected. Six hours is measured from the last successful check.
 */
import type { IdentityResult } from './signerGuard.js';

export const IDENTITY_GRACE_MS = 6 * 60 * 60 * 1000;

const SCOPE_ALL = 'price updates have also stopped';
const SCOPE_PAUSE = 'pause only; price updates continue';
const RECOVERY = 'signer identity recovered; price and pause resumed';

export interface GateDecision {
    price: boolean;
    pause: boolean;
    key: string;
    alert: string | null;
    lastOkAt: number;
    /** Exclusive millisecond deadline. Zero means the gate authorizes nothing. */
    validUntil: number;
    reason: string;
}

function clockOk(now: number): boolean {
    return Number.isSafeInteger(now) && now >= 0;
}

function graceOpen(now: number, lastOkAt: number): boolean {
    return Number.isSafeInteger(lastOkAt) && lastOkAt > 0 && now >= lastOkAt && now - lastOkAt < IDENTITY_GRACE_MS;
}

function addGrace(from: number): number {
    if (!Number.isSafeInteger(from) || from <= 0) return 0;
    const until = from + IDENTITY_GRACE_MS;
    return Number.isSafeInteger(until) ? until : 0;
}

/**
 * Branch (1) closes price and pause and clears the grace entitlement.
 * Branch (2) leaves price open until the previous successful check's grace ends.
 * Branch (3) leaves price open. The same key does not alert again.
 * Recovery alerts only when a closed key becomes open.
 * `nowMs` is the time after the ownership reads have finished.
 */
export function decideIdentityGate(input: {
    nowMs: number;
    lastOkAt: number;
    previousKey: string;
    verdict: IdentityResult;
}): GateDecision {
    const now = input.nowMs;
    const previousKey = typeof input.previousKey === 'string' ? input.previousKey : '';
    let lastOkAt = Number.isSafeInteger(input.lastOkAt) ? input.lastOkAt : 0;
    let price = false;
    let pause = false;
    let validUntil = 0;
    let key = 'all-closed:clock';
    let reason = 'sender: gate closed';
    let body = `signer identity clock invalid; ${SCOPE_ALL}`;

    if (!clockOk(now)) {
        key = 'all-closed:clock';
    } else if (input.verdict.ok) {
        price = true;
        pause = true;
        key = 'open';
        reason = '';
        lastOkAt = now;
        validUntil = addGrace(now);
        body = RECOVERY;
    } else if (input.verdict.kind === 'privileged') {
        // A confirmed privilege ends the previous success. A later read failure cannot reopen it.
        lastOkAt = 0;
        key = 'all-closed:privileged';
        body = `signer identity refused\n${input.verdict.problems.join('\n')}\n${SCOPE_ALL}`;
    } else if (input.verdict.kind === 'read-failed') {
        const until = addGrace(lastOkAt);
        if (graceOpen(now, lastOkAt) && until > now) {
            price = true;
            pause = false;
            validUntil = until;
            key = 'pause-only:read';
            reason = 'sender: pause gate closed';
            body = `signer identity read failed; ${SCOPE_PAUSE}`;
        } else {
            key = 'all-closed:read-expired';
            body = `signer identity read failed; ${SCOPE_ALL}`;
        }
    } else if (input.verdict.kind === 'sp-mismatch') {
        price = true;
        pause = false;
        validUntil = addGrace(now);
        key = 'pause-only:sp';
        reason = 'sender: pause gate closed';
        body = `superpaymaster identity mismatch; ${SCOPE_PAUSE}`;
    } else {
        key = 'all-closed:clock';
        body = `signer identity refused; ${SCOPE_ALL}`;
    }
    if (validUntil === 0) {
        price = false;
        pause = false;
    }

    let alert: string | null = body;
    if (previousKey === key) alert = null;
    else if (key === 'open' && previousKey === '') alert = null;
    return { price, pause, key, alert, lastOkAt, validUntil, reason };
}

/**
 * The decision clock is read after `read` resolves. A check that starts inside the grace
 * and finishes after it must see the later time.
 */
export async function gateAfterIdentityRead(input: {
    read: () => Promise<IdentityResult>;
    lastOkAt: number;
    previousKey: string;
    now: () => number;
}): Promise<GateDecision> {
    const verdict = await input.read();
    return decideIdentityGate({
        nowMs: input.now(),
        lastOkAt: input.lastOkAt,
        previousKey: input.previousKey,
        verdict,
    });
}
