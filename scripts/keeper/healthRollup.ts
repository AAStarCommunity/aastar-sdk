/**
 * Heartbeat participation. An unconfigured target is off and is not a failure.
 */

export interface HealthRollupInput {
    superDisabled: boolean;
    superCacheOk: boolean;
    paymasterDisabled: boolean;
    paymasterConfigured: boolean;
    paymasterCacheOk: boolean | null;
}

export interface HealthRollup {
    superOk: boolean;
    paymasterOk: boolean;
    heartbeat: boolean;
    paymaster: 'disabled' | 'off' | 'ok' | 'not-ok';
}

export function rollupHealth(input: HealthRollupInput): HealthRollup {
    const superOk = input.superDisabled ? true : input.superCacheOk === true;
    let paymaster: HealthRollup['paymaster'];
    if (input.paymasterDisabled) paymaster = 'disabled';
    else if (!input.paymasterConfigured) paymaster = 'off';
    else paymaster = input.paymasterCacheOk ? 'ok' : 'not-ok';
    const paymasterOk = paymaster !== 'not-ok';
    return {
        superOk,
        paymasterOk,
        heartbeat: superOk && paymasterOk,
        paymaster,
    };
}
