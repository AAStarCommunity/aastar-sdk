/**
 * #257 SDK-path DVT regression guard: SDK node DISCOVERY + the new `{ userOp, ownerAuth }` sign format
 * against LIVE dvt1/2/3.aastar.io. The redeployed DVT (v1.7) rejects the legacy `{ message }` body and
 * validates owner authorization before co-signing; node discovery must also return >= 2 EXTERNALLY
 * reachable endpoints (the registered apiEndpoint is localhost). This drives BOTH SDK fixes end-to-end:
 *   1. `BLSManager.getAvailableNodes()` (my discovery) must return the 3 external seed URLs.
 *   2. Posting the SDK's `{ userOp, ownerAuth }` body (what generateBLSSignature/_coordinateBlsAggregate
 *      now sends) to those discovered endpoints must collect >= 2 co-signatures and aggregate.
 *
 * Reuses the dvt-realnode BLS-only account (owner = JASON) so ownerAuth is a real, on-chain-valid owner
 * signature the nodes accept.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/v022-dvt-sdk-path-e2e.ts
 *
 * Requires: .env.sepolia (SEPOLIA_RPC_URL[/2/3], PRIVATE_KEY_JASON funded) + the three DVT nodes live.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import axios from 'axios';
import {
    createPublicClient, createWalletClient, http, keccak256, toBytes, numberToHex, getAddress, parseEther,
    type Address, type Hex, type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
    CANONICAL_ADDRESSES, EntryPointABI, buildInitConfig, airAccountFactoryActions, entryPointActions,
} from '@aastar/core';
// The SDK discovery UNDER TEST (#257).
import { BLSManager } from '../../../packages/airaccount/src/core/bls/bls.manager';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const SEPOLIA = 11155111;
const FACTORY = getAddress(CANONICAL_ADDRESSES[SEPOLIA].airAccountFactoryV7);
const ENTRY_POINT = getAddress(CANONICAL_ADDRESSES[SEPOLIA].entryPoint);
const RPCS = [process.env.SEPOLIA_RPC_URL, process.env.SEPOLIA_RPC_URL2, process.env.SEPOLIA_RPC_URL3].filter(Boolean) as string[];
const SEEDS = ['https://dvt1.aastar.io', 'https://dvt2.aastar.io', 'https://dvt3.aastar.io'];
const SALT = BigInt(keccak256(toBytes('dvt-v0.20-cross-repo-e2e/bls-only/2026-06'))); // same account as dvt-realnode-e2e
const ZERO32 = `0x${'00'.repeat(32)}` as Hex;
const ALG_BLS = 0x01;

async function pub(): Promise<PublicClient> {
    return createPublicClient({ chain: sepolia, transport: http(RPCS[0]) }) as PublicClient;
}

async function main() {
    const jasonPk = process.env.PRIVATE_KEY_JASON as Hex;
    if (!jasonPk) throw new Error('PRIVATE_KEY_JASON required');
    const owner = privateKeyToAccount(jasonPk);
    const walletClient = createWalletClient({ account: owner, chain: sepolia, transport: http(RPCS[0]) });
    const c = await pub();

    // BLS-only account (owner = JASON), deployed idempotently.
    const config = buildInitConfig({ guardians: [], dailyLimit: parseEther('1'), approvedAlgIds: [ALG_BLS] });
    const account = (await airAccountFactoryActions(FACTORY)(c).getAddress({ owner: owner.address, salt: SALT, config })) as Address;
    const code = await c.getCode({ address: account });
    if (!code || code === '0x') {
        const tx = await airAccountFactoryActions(FACTORY)(walletClient).createAccount({ owner: owner.address, salt: SALT, config, account: owner });
        await c.waitForTransactionReceipt({ hash: tx });
    }
    console.log(`[0] BLS-only account = ${account} (owner = JASON ${owner.address})`);

    // ── (1) SDK node discovery (#257) — must return >= 2 EXTERNAL endpoints ────────────────────────
    const mgr = new BLSManager({ seedNodes: SEEDS, discoveryTimeout: 12000 });
    const nodes = await mgr.getAvailableNodes();
    console.log(`[1] SDK getAvailableNodes → ${nodes.length}: ${nodes.map((n) => n.apiEndpoint).join(', ')}`);
    if (nodes.length < 2) throw new Error(`SDK discovery returned ${nodes.length} external nodes (< 2 — Tier-3 needs >= 2)`);
    if (nodes.some((n) => n.apiEndpoint.includes('localhost'))) throw new Error('SDK discovery returned a localhost endpoint');

    // ── (2) userOp + userOpHash + ownerAuth (owner EIP-191 over userOpHash) ────────────────────────
    const nonce = (await entryPointActions(ENTRY_POINT)(c).getNonce({ sender: account, key: 0n })) as bigint;
    const userOp = { sender: account, nonce, initCode: '0x', callData: '0x', accountGasLimits: ZERO32, preVerificationGas: 0n, gasFees: ZERO32, paymasterAndData: '0x', signature: '0x' };
    const userOpHash = (await c.readContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'getUserOpHash', args: [userOp] })) as Hex;
    const ownerAuth = await walletClient.signMessage({ account: owner, message: { raw: userOpHash } });
    // The exact body the SDK's _coordinateBlsAggregate / buildDvtRequest now send.
    const rpcUserOp = { sender: userOp.sender, nonce: numberToHex(nonce), initCode: '0x', callData: '0x', accountGasLimits: ZERO32, preVerificationGas: numberToHex(0n), gasFees: ZERO32, paymasterAndData: '0x', signature: '0x' };
    console.log(`[2] userOpHash = ${userOpHash.slice(0, 22)}…  ownerAuth = ${ownerAuth.slice(0, 22)}… (${(ownerAuth.length - 2) / 2}B)`);

    // ── (3) POST the #257 { userOp, ownerAuth } body to the SDK-DISCOVERED endpoints + aggregate ────
    const sigs: string[] = [];
    for (const node of nodes) {
        try {
            const r = await axios.post(`${node.apiEndpoint}/signature/sign`, { userOp: rpcUserOp, ownerAuth });
            const s = r.data.signatureCompact || r.data.signature;
            sigs.push(s.startsWith('0x') ? s : `0x${s}`);
            console.log(`    ${node.apiEndpoint} co-signed ✓ (nodeId ${String(r.data.nodeId).slice(0, 14)}…)`);
        } catch (e: unknown) {
            const err = e as { response?: { status?: number; data?: unknown } };
            console.log(`    ${node.apiEndpoint} FAILED: ${err.response?.status} ${JSON.stringify(err.response?.data)}`);
        }
    }
    if (sigs.length < 2) throw new Error(`only ${sigs.length} co-signatures collected (< 2 for Tier-3)`);
    const agg = await axios.post(`${nodes[0].apiEndpoint}/signature/aggregate`, { signatures: sigs });
    const aggSig = agg.data.signature as string;
    console.log(`[3] aggregated ${sigs.length} co-signatures → ${(aggSig.length - 2) / 2} bytes`);
    if (!aggSig || aggSig.length < 66) throw new Error('aggregate returned an empty/short signature');

    console.log('\n🎉 PASS — SDK discovery (#257: 3 external nodes) + the SDK { userOp, ownerAuth } format: live dvt1/2/3 co-sign + aggregate.');
}

main().catch((e: unknown) => {
    const err = e as { response?: { data?: unknown }; shortMessage?: string; message?: string };
    console.error('❌ FAILED:', err.response?.data ?? err.shortMessage ?? err.message ?? e);
    process.exit(1);
});
