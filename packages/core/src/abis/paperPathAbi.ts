/**
 * The ABI entries the paper's four gasless paths (T1, T2_SP_Credit, T2.1_SP_Normal, T5) and the xPNTs v2 credit API
 * use, per vendored file. scripts/paper-path-abi-pin.ts records their SuperPaymaster signatures in
 * fixtures/paper-path-abi.json; paperPathAbi.test.ts checks the vendored files still match.
 */
import { toEventSelector, toFunctionSelector } from 'viem';

type Want = { type: 'function' | 'event'; name: string };
const fns = (...names: string[]): Want[] => names.map((name) => ({ type: 'function', name }));
const evs = (...names: string[]): Want[] => names.map((name) => ({ type: 'event', name }));

export const PAPER_PATH_ENTRIES: Record<string, { upstream: string; entries: Want[] }> = {
    'SuperPaymaster-5.5.0.full.json': {
        upstream: 'abis/SuperPaymaster.full.json',
        entries: [
            ...fns('version', 'operators', 'gasParams', 'cachedPrice', 'priceStalenessThreshold', 'updatePrice', 'isEligibleForSponsorship'),
            ...evs('TransactionSponsored'),
        ],
    },
    'SuperPaymasterLens.json': { upstream: 'abis/SuperPaymasterLens.json', entries: fns('dryRunValidation') },
    'xPNTsTokenV2.full.json': {
        upstream: 'abis/xPNTsTokenV2.full.json',
        entries: [
            ...fns('balanceOf', 'transfer', 'exchangeRate', 'previewLock', 'previewCredit', 'renewForSelf', 'debts', 'repayDebt',
                'requestCredit', 'revokeCredit', 'approveCredit', 'queueCreditPolicy', 'executeCreditPolicy', 'cancelCreditPolicy',
                'effectiveCreditCap', 'creditPolicy', 'policyEpoch', 'pendingPolicyEta', 'creditTierSource'),
            ...evs('CreditSettled', 'DebtRepaid', 'LockSettled', 'Transfer'),
        ],
    },
};

const typeOf = (p: any): string => p.type.startsWith('tuple') ? `(${(p.components ?? []).map(typeOf).join(',')})${p.type.slice(5)}` : p.type;
/** Type plus name, recursively: decoders that read named `args` / tuple fields depend on the names too. */
const named = (p: any): string => p.type.startsWith('tuple')
    ? `(${(p.components ?? []).map(named).join(',')})${p.type.slice(5)}${p.name ? ` ${p.name}` : ''}`
    : `${p.type}${p.name ? ` ${p.name}` : ''}`;

/**
 * Full signature and selector of one entry. Functions: inputs and outputs with their names, state mutability.
 * Events: inputs with names and indexed flags, and whether the event is anonymous (that changes the topic layout).
 */
export function canonicalEntry(abi: any[], want: Want): { signature: string; selector: string } | undefined {
    const matches = abi.filter((e) => e.type === want.type && e.name === want.name);
    if (matches.length !== 1) return undefined; // missing or overloaded: not comparable as one entry
    const e = matches[0];
    const inputs = (e.inputs ?? []).map(typeOf).join(',');
    if (want.type === 'function') {
        return {
            signature: `${e.name}(${(e.inputs ?? []).map(named).join(',')}) returns (${(e.outputs ?? []).map(named).join(',')}) ${e.stateMutability}`,
            selector: toFunctionSelector(`${e.name}(${inputs})`),
        };
    }
    return {
        signature: `${e.anonymous ? 'anonymous ' : ''}${e.name}(${(e.inputs ?? []).map((i: any) => `${named(i)}${i.indexed ? ' indexed' : ''}`).join(',')})`,
        selector: toEventSelector(`${e.name}(${inputs})`),
    };
}
