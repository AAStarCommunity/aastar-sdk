/**
 * v0.22.0 account guard-checker / prepareTransfer read-path regression guard (aastar-sdk#254).
 *
 * WHY THIS EXISTS: #254 was a production-bricking regression where the SDK read a contract function
 * (`getConfigDescription()`) that v0.22.0 accounts REMOVED. It reverted inside guard-checker — which
 * `prepareTransfer` runs on EVERY transfer + config op — so ALL v0.22.0 transfers were blocked. It escaped
 * because (a) the v0.22.0 sync didn't grep every caller of the removed function, and (b) no on-chain e2e
 * exercised the full `prepareTransfer → guard-checker` read path (unit tests mock the provider, so a
 * revert-on-missing-function can't surface).
 *
 * This e2e drives the REAL guard-checker against a REAL deployed v0.22.0 account, exercising every account
 * / guard read `prepareTransfer` depends on: `guard()` (was `getConfigDescription().guardAddress`),
 * `tier1Limit`/`tier2Limit`, the guard's daily allowance, and `approvedAlgorithms`. If any account/guard
 * function is removed by a future contract sync and a caller isn't updated, THIS reverts — before release,
 * not in production. Add it to RELEASE-CHECKLIST §4 for any v0.22.0-account-touching change.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/v022-preparetransfer-guard-read-e2e.ts
 *
 * Requires: .env.sepolia (SEPOLIA_RPC_URL). Read-only — no funds / no tx.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { getAddress } from 'viem';
import { CANONICAL_ADDRESSES } from '@aastar/core';
import { EthereumProvider } from '../../../packages/airaccount/src/server/providers/ethereum-provider';
import { GuardChecker } from '../../../packages/airaccount/src/server/services/guard-checker';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const SEPOLIA = 11155111;
const A = CANONICAL_ADDRESSES[SEPOLIA];
// A deployed v0.22.0 account (WebAuthn passkey-at-birth, has a GlobalGuard + approvedAlgIds [0x0a]).
const ACCOUNT = getAddress('0x7c458906B849820b72D6Ef0e06CEB9422997f5bd');
const ZERO = '0x0000000000000000000000000000000000000000';

async function main() {
    const rpc = process.env.SEPOLIA_RPC_URL;
    if (!rpc) throw new Error('SEPOLIA_RPC_URL required');

    const ethereum = new EthereumProvider({
        rpcUrl: rpc,
        bundlerRpcUrl: rpc, // guard-checker only uses the main provider
        chainId: SEPOLIA,
        entryPoints: {
            v07: {
                entryPointAddress: getAddress(A.entryPoint),
                factoryAddress: getAddress(A.airAccountFactoryV7),
                validatorAddress: getAddress(A.aaStarValidator),
            },
        },
        defaultVersion: '0.7',
    } as never);
    const gc = new GuardChecker(ethereum, { log() { }, error() { }, warn() { }, debug() { }, info() { } } as never);

    // (1) The EXACT #254 read path: fetchGuardStatus → readAccountGuardAddress → guard().
    //     Pre-fix this reverted (getConfigDescription absent on v0.22.0).
    const status = await gc.fetchGuardStatus(ACCOUNT);
    console.log(`[1] fetchGuardStatus: hasGuard=${status.hasGuard} guard=${status.guardAddress} dailyLimit=${status.dailyLimit} remaining=${status.dailyRemaining}`);
    if (!status.hasGuard || status.guardAddress === ZERO) {
        throw new Error(`expected a non-zero guard on this v0.22.0 account (got ${status.guardAddress}) — guard() read broken?`);
    }

    // (2) The FULL prepareTransfer tiering pre-check: tier limits + guard + algorithm approval. Any removed
    //     account/guard function on this path reverts HERE (exactly what #254 would have been caught by).
    const pre = await gc.preCheck(ACCOUNT, 1n);
    console.log(`[2] preCheck: ok=${pre.ok} tier=${pre.tier} algId=0x${(pre.algId ?? 0).toString(16)} errors=${JSON.stringify(pre.errors)}`);
    if (pre.tier === undefined || pre.tier === null || pre.algId === undefined) {
        throw new Error('preCheck did not resolve tier/algId — an account/guard read reverted');
    }

    console.log('\n🎉 PASS — v0.22.0 guard-checker / prepareTransfer read path resolves on-chain (no removed-function revert). #254 regression guard.');
}

main().catch((e) => { console.error('❌ FAILED:', e?.shortMessage || e?.message || e); process.exit(1); });
