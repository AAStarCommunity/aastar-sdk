/**
 * PaymasterV4 resolution for the price keeper.
 *
 * The keeper calls this once, at startup. A transient RPC error and an absent answer are both
 * unresolved. Nothing here retries, and a V4 that appears later is not adopted until the process
 * restarts. SuperPaymaster price updates do not depend on this result.
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
