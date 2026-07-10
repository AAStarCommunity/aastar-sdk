/**
 * CLI — one-click DVT node onboarding (stake ROLE_DVT + registerWithProof) via the SDK's
 * {@link onboardDvtNode} L2 workflow (CC-36). The node counterpart to DVT `register-node.mjs`, but the
 * SDK holds the operator (and optional funder) keys so it can stake an unstaked operator, which the DVT
 * script cannot. Idempotent: re-running a fully-onboarded node is a no-op.
 *
 *   pnpm exec tsx scripts/onboard_dvt_node.ts --network sepolia [--dry-run]
 *
 * Key sources (mirrors register-node.mjs — env OR forge cast wallet):
 *   operator EOA (msg.sender that stakes + registers):
 *     --operator-cast "--account dvt-op"   (forge cast wallet; password via OPERATOR_CAST_PASSWORD)
 *     else env OPERATOR_PRIVATE_KEY | ETH_PRIVATE_KEY | PRIVATE_KEY
 *   funder/owner EOA (optional "owner 代付" — tops up operator ETH + GToken):
 *     --funder-cast "--account owner"      (password via FUNDER_CAST_PASSWORD)
 *     else env FUNDER_PRIVATE_KEY (unset → no auto-funding; operator must be pre-funded)
 *   BLS node secret key (generates the public key being registered — cast cannot hold BLS keys):
 *     --bls-secret 0x...  else env DVT_BLS_SECRET_KEY
 *
 * Reads .env.<network> for RPC_URL. Requires `cast` (Foundry) on PATH only when a --*-cast flag is used.
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createPublicClient, createWalletClient, http, formatEther, type Hex } from 'viem';
import { anvil, mainnet, optimism, optimismSepolia, sepolia } from 'viem/chains';
import { onboardDvtNode, resolveEoaAccount, type EoaKeySource } from '@aastar/operator';

const CHAINS = {
    anvil,
    sepolia,
    'op-sepolia': optimismSepolia,
    'op-mainnet': optimism,
    mainnet,
} as const;
type NetworkName = keyof typeof CHAINS;

function argValue(argv: string[], flag: string): string | undefined {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}
function hasFlag(argv: string[], flag: string): boolean {
    return argv.includes(flag);
}

/** Build an EoaKeySource from a `--*-cast "<args>"` flag or, failing that, env private-key vars. */
function eoaSource(castArgs: string | undefined, password: string | undefined, envVars: string[]): EoaKeySource | undefined {
    if (castArgs !== undefined) {
        return { type: 'cast', args: castArgs.trim().split(/\s+/).filter(Boolean), password };
    }
    for (const v of envVars) {
        if (process.env[v]?.trim()) return { type: 'env', var: v };
    }
    return undefined;
}

async function main() {
    const argv = process.argv.slice(2);
    const network = (argValue(argv, '--network') || 'sepolia') as NetworkName;
    const chain = CHAINS[network];
    if (!chain) throw new Error(`unknown --network ${network} (one of: ${Object.keys(CHAINS).join(', ')})`);

    dotenv.config({ path: path.resolve(process.cwd(), `.env.${network}`) });
    const rpcUrl = process.env.RPC_URL || process.env.SEPOLIA_RPC_URL;
    if (!rpcUrl) throw new Error(`no RPC_URL in .env.${network}`);

    // operator (required).
    const operatorSource = eoaSource(
        argValue(argv, '--operator-cast'),
        process.env.OPERATOR_CAST_PASSWORD,
        ['OPERATOR_PRIVATE_KEY', 'ETH_PRIVATE_KEY', 'PRIVATE_KEY'],
    );
    if (!operatorSource) throw new Error('no operator key — set OPERATOR_PRIVATE_KEY or pass --operator-cast');

    // funder (optional).
    const funderSource = eoaSource(
        argValue(argv, '--funder-cast'),
        process.env.FUNDER_CAST_PASSWORD,
        ['FUNDER_PRIVATE_KEY'],
    );

    // BLS node secret key (required for the local-key path).
    const blsSecretKey = (argValue(argv, '--bls-secret') || process.env.DVT_BLS_SECRET_KEY) as Hex | undefined;
    if (!blsSecretKey) throw new Error('no BLS secret key — set DVT_BLS_SECRET_KEY or pass --bls-secret');

    const transport = http(rpcUrl);
    const publicClient = createPublicClient({ chain, transport });

    const operatorAccount = await resolveEoaAccount(operatorSource);
    const operatorWallet = createWalletClient({ account: operatorAccount, chain, transport });
    const funderWallet = funderSource
        ? createWalletClient({ account: await resolveEoaAccount(funderSource), chain, transport })
        : undefined;

    const dryRun = hasFlag(argv, '--dry-run');
    console.log(`network=${network} chainId=${chain.id}`);
    console.log(`operator=${operatorAccount.address}${funderWallet ? `  funder=${funderWallet.account.address}` : '  (no funder — operator must be pre-funded)'}`);
    console.log(`dryRun=${dryRun}\n`);

    const result = await onboardDvtNode({ publicClient, operatorWallet, funderWallet, blsSecretKey, dryRun });

    console.log('\n=== RESULT ===');
    console.log(`nodeId            = ${result.nodeId}`);
    console.log(`operator          = ${result.operator}`);
    console.log(`alreadyRegistered = ${result.alreadyRegistered}`);
    console.log(`staked (new)      = ${result.staked}`);
    console.log(`registered (new)  = ${result.registered}`);
    console.log(`effectiveStake    = ${formatEther(result.effectiveStake)}  (minStake ${formatEther(result.minStake)})`);
    if (result.plan) {
        const p = result.plan;
        console.log('plan (no tx sent) =', {
            requireStake: p.requireStake,
            needGToken: formatEther(p.needGToken),
            wouldFundEth: formatEther(p.wouldFundEth),
            wouldFundGToken: formatEther(p.wouldFundGToken),
            wouldApprove: p.wouldApprove,
            wouldRegisterRole: p.wouldRegisterRole,
            registerSimulated: p.registerSimulated,
        });
    } else {
        console.log('hashes            =', result.hashes);
    }
    if (result.registered) console.log(`\n✅ DVT node onboarded — register tx ${result.hashes.register}`);
    else if (result.alreadyRegistered) console.log('\n✅ already onboarded (idempotent no-op)');
    else if (dryRun) console.log('\n✅ dry run — plan computed, NO transactions sent');
}

main().catch((e) => {
    console.error('onboard_dvt_node FAIL:', e?.shortMessage || e?.message || e);
    process.exit(1);
});
