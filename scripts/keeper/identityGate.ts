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
    reason: string;
}

function clockOk(now: number): boolean {
    return Number.isSafeInteger(now) && now >= 0;
}

function graceOpen(now: number, lastOkAt: number): boolean {
    return Number.isSafeInteger(lastOkAt) && lastOkAt > 0 && now >= lastOkAt && now - lastOkAt < IDENTITY_GRACE_MS;
}

/**
 * Branch (1) closes price and pause. Branch (2) leaves price open until the grace ends.
 * Branch (3) leaves price open with no grace. The same key does not alert again.
 * Recovery alerts only when a closed key becomes open.
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
        body = RECOVERY;
    } else if (input.verdict.kind === 'privileged') {
        key = 'all-closed:privileged';
        body = `signer identity refused\n${input.verdict.problems.join('\n')}\n${SCOPE_ALL}`;
    } else if (input.verdict.kind === 'read-failed') {
        if (graceOpen(now, lastOkAt)) {
            price = true;
            pause = false;
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
        key = 'pause-only:sp';
        reason = 'sender: pause gate closed';
        body = `superpaymaster identity mismatch; ${SCOPE_PAUSE}`;
    } else {
        key = 'all-closed:clock';
        body = `signer identity refused; ${SCOPE_ALL}`;
    }

    let alert: string | null = body;
    if (previousKey === key) alert = null;
    else if (key === 'open' && previousKey === '') alert = null;
    return { price, pause, key, alert, lastOkAt, reason };
}
