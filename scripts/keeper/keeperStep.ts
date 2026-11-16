/**
 * One loop iteration. A failed identity refresh must not skip the price tick.
 */
import { loopErrorReport } from './priceConfirm.js';

const REFRESH_KEY = 'refreshIdentity failed';

export async function runKeeperStep(opts: {
    refreshIdentity: () => Promise<boolean>;
    tick: () => Promise<void>;
    pauseDue: boolean;
    onPause: () => Promise<void>;
    onPauseSkipped: (reason: string) => Promise<void>;
    alert: (msg: string) => void | Promise<void>;
    alerted: Set<string>;
    network?: string;
}): Promise<void> {
    let identityOk = false;
    try {
        identityOk = await opts.refreshIdentity();
        opts.alerted.delete(REFRESH_KEY);
    } catch (error) {
        identityOk = false;
        if (!opts.alerted.has(REFRESH_KEY)) {
            opts.alerted.add(REFRESH_KEY);
            await opts.alert(loopErrorReport(opts.network ?? 'keeper', error, 'error').stderr);
        }
    }
    if (opts.pauseDue) {
        if (!identityOk) await opts.onPauseSkipped('signer identity refused');
        else await opts.onPause();
    }
    await opts.tick();
}
