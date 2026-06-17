/**
 * E2E acceptance verification — AXIS-1 (REAL) + persistent AXIS-2 (FEATURE-MET) data collector.
 *
 * Codex's sandbox has no outbound network, so it cannot confirm a tx exists or re-read chain
 * state. This script does both via live Sepolia RPC and writes the structured "verified records"
 * that Codex challenges for acceptance:
 *   - receipts: status / to / gasUsed / block / logs for every claimed tx (AXIS-1 REAL)
 *   - state:    re-read load-bearing on-chain state (recovery/weighted approvalBitmap, gasless acct ETH)
 *   - gates:    LIVE eth_call of executeRecovery/executeWeightChange — they STILL revert with the
 *               timelock selector (proposals pending, 2-day timelock unexpired) = hard ⛔ proof
 *
 *   pnpm exec tsx scripts/e2e-acceptance-verify.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { writeFileSync } from 'node:fs';
import {
    createPublicClient, http, fallback, parseAbi, encodeFunctionData, toFunctionSelector,
    type Hex, type Address,
} from 'viem';
import { sepolia } from 'viem/chains';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia'), quiet: true } as any);
const OUT_FILE = path.resolve(process.cwd(), 'docs/e2e/v0.20.1/logs/rpc-verify.json');

const urls = [process.env.SEPOLIA_RPC_URL, process.env.SEPOLIA_RPC_URL2, process.env.SEPOLIA_RPC_URL3]
    .map((u) => (u || '').trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
const pc = createPublicClient({ chain: sepolia, transport: fallback(urls.map((u) => http(u, { retryCount: 3 }))) });

const GASLESS_ACCT: Address = '0x5d310ba25fC9a4B28d154900C1258F78DD36D3C1';
const RECOVERY_ACCT: Address = '0x9144BCaf04ed1773eD7B9Aa3F7D57770619e7bB6';
const WEIGHTED_ACCT: Address = '0x69F57c9A08295266Dd947639EFC0EA7093e33289';

const SCENARIOS: Record<string, { label: string; hash: Hex }[]> = {
    agent: [
        { label: 'createAgentAccount', hash: '0x52b39e21cc1346ddd79f7d7a341e57cd9fdfbfd3de962f7a3720ded8d8017530' },
        { label: 'registerAgent (via SDK execute)', hash: '0xeed08f224961186406dacd6aa1511b295a465fea3c860459e7a3c39f60d709ee' },
        { label: 'revokeAgent (via SDK execute)', hash: '0xcc46a79d3f18bd35bdbc9f5f6dc9830082817229fba1f6fdce68a5c8ffa7895e' },
    ],
    gasless: [
        { label: 'depositFor', hash: '0xc30822336b7252abec851a6438ccd0a3781688ad787b554deafaf70d03f576ca' },
        { label: 'updatePrice', hash: '0x93a70bfab93cf15f9febc972aeb1f0f536d56bd7d638ec52099ecae6d02b4c05' },
        { label: 'sponsored UserOp bundle', hash: '0x0ba2f6dbfdb5bdf9a790d4400ed6afb26d2d46aae6b1217cbb14424c6e9c9b20' },
    ],
    session: [
        { label: 'createAccount', hash: '0xcc5e669df49cc8cb9db5d0d92ff34a9ddb8ed614ed9f622e42064ca7e09f336f' },
        { label: 'grantSessionDirect', hash: '0xe5f16c4ff1294bd41ebac02dbddd48c96ed03249b7074e075bae5f97a7aac6cb' },
        { label: 'revokeSession', hash: '0xfeb7bfa583de5c9bdfb865d96c89b7c982afeccf24f25a5c367dc3ae91e613d9' },
        { label: 'grantP256SessionDirect', hash: '0xa7a62f746f60fa10b1634c1f6d4c8493279b7b030cdc3254dcf071046e1c04cd' },
        { label: 'revokeP256Session', hash: '0xaa2885a64e64c888e0fe213306936dcc2ddd3ed6ea8127278202bf6b796f386a' },
    ],
    recovery: [
        { label: 'fund g1', hash: '0x98a350987bf6ee642ae7c53fb5fa689c108b84a480a1f9ba3162bccc7ea1681c' },
        { label: 'fund g2', hash: '0x1d4428b12cc13c12e46f5576607b372062776bfdca705d77f2c07cf13a1fc269' },
        { label: 'deploy account', hash: '0x2f95e3f19c8c1ac62d3358302a992f3092c30235ad965fc2c28d75cdae15ca0d' },
        { label: 'addGuardian g1', hash: '0xf3e971bacaef81e4085d2898315076314e44e1ff02d7be8cab0da76294eac577' },
        { label: 'addGuardian g2', hash: '0x09eafc3836b9403abb94c8b1bd6eb59c9c9e87d5ff0e4d1b25b51d56a974b6e5' },
        { label: 'proposeRecovery (g1)', hash: '0x3e298fba582c2afc5713cdcd07928c281219761785e60f2b4333caf7a896b466' },
        { label: 'approveRecovery (g2, 2-of-3)', hash: '0x5d19449d68f4193734dc3b41e8ec061fcbe72c299c20a327270ae8138e08a91e' },
    ],
    weighted: [
        { label: 'fund g1', hash: '0xc0cbc6058952ae719158c4d74ecf7e6795ac56fbe63ee441dc499d62082f0284' },
        { label: 'fund g2', hash: '0xff2e97f2a5be254ba39fd5746e6fc4735c567b67aeae4de2c8fbd10dbd0d1a7b' },
        { label: 'deploy account', hash: '0xe575aa95756153ff8a4af972e9a1ed3c9de774dc73bf1ae937e80e1d028eb17e' },
        { label: 'setWeightConfig(cfg1)', hash: '0xca75c46616a504fcf8dd51741c266bd3143be1d1f306bfd97735cb4b25e05833' },
        { label: 'proposeWeightChange(cfg2)', hash: '0x19aa9caa73a0ff91aa6b46db777863e886aec69f14cc81580aee410a2446a353' },
        { label: 'approveWeightChange (g1)', hash: '0x2b646b9108128881447d20442b3b8c228250de6abd955fa72cdc648058d69021' },
        { label: 'approveWeightChange (g2, 2-of-3)', hash: '0x77ea1725c1d9aaf3428cc9b4c1f942d0e67971cf8003ae23e3f831d639a24c21' },
    ],
};

const STATE_ABI = parseAbi([
    'struct WC { uint8 passkeyWeight; uint8 ecdsaWeight; uint8 blsWeight; uint8 guardian0Weight; uint8 guardian1Weight; uint8 guardian2Weight; uint8 _padding; uint8 tier1Threshold; uint8 tier2Threshold; uint8 tier3Threshold; }',
    'function activeRecovery() view returns (address newOwner, uint256 proposedAt, uint256 approvalBitmap, uint256 cancellationBitmap)',
    'function pendingWeightChange() view returns (WC proposed, uint256 proposedAt, uint256 approvalBitmap)',
    'function executeRecovery()',
    'function executeWeightChange()',
]);

/** eth_call a no-arg account fn that is expected to revert; capture + decode the revert selector. */
async function expectRevert(account: Address, fn: 'executeRecovery' | 'executeWeightChange', expectedSelector: string) {
    try {
        await pc.call({ to: account, data: encodeFunctionData({ abi: STATE_ABI, functionName: fn }) });
        return { reverted: false, note: 'DID NOT REVERT — timelock gate missing!' };
    } catch (e: any) {
        // walk the cause chain for the raw revert data (0x-prefixed selector)
        let raw: string | undefined; let node: any = e;
        for (let i = 0; node && i < 8; i++) { const d = node.data; if (typeof d === 'string' && d.startsWith('0x')) { raw = d; break; } node = node.cause; }
        const selector = raw ? raw.slice(0, 10) : undefined;
        return { reverted: true, revertData: raw, selector, expectedSelector, matches: selector === expectedSelector };
    }
}

async function main() {
    const out: any = { network: 'sepolia', chainId: 11155111, verifiedAt: new Date().toISOString(), receipts: {}, state: {}, gates: {} };

    for (const [scenario, txs] of Object.entries(SCENARIOS)) {
        out.receipts[scenario] = [];
        for (const { label, hash } of txs) {
            try {
                const r = await pc.getTransactionReceipt({ hash });
                out.receipts[scenario].push({ label, hash, status: r.status, to: r.to, gasUsed: r.gasUsed.toString(), block: Number(r.blockNumber), logs: r.logs.length });
            } catch { out.receipts[scenario].push({ label, hash, status: 'NOT_FOUND' }); }
        }
    }

    // AXIS-2 persistent state.
    out.state.gasless = { account: GASLESS_ACCT, ethBalance: (await pc.getBalance({ address: GASLESS_ACCT })).toString(), note: 'must be 0 — paymaster paid gas, account never held ETH' };
    try { const ar = await pc.readContract({ address: RECOVERY_ACCT, abi: STATE_ABI, functionName: 'activeRecovery' }) as any;
        out.state.recovery = { account: RECOVERY_ACCT, newOwner: ar[0], proposedAt: ar[1].toString(), approvalBitmap: `0x${ar[2].toString(16)}`, note: '0x3 == 2 guardian approvals (2-of-3)' };
    } catch (e: any) { out.state.recovery = { account: RECOVERY_ACCT, error: e?.shortMessage || e?.message }; }
    try { const pw = await pc.readContract({ address: WEIGHTED_ACCT, abi: STATE_ABI, functionName: 'pendingWeightChange' }) as any;
        out.state.weighted = { account: WEIGHTED_ACCT, proposedAt: pw[1].toString(), approvalBitmap: `0x${pw[2].toString(16)}`, note: '0x3 == 2 guardian approvals (2-of-3)' };
    } catch (e: any) { out.state.weighted = { account: WEIGHTED_ACCT, error: e?.shortMessage || e?.message }; }

    // AXIS-2 ⛔ timelock gates — LIVE eth_call must still revert with the exact selector.
    out.gates.recovery = { account: RECOVERY_ACCT, ...(await expectRevert(RECOVERY_ACCT, 'executeRecovery', toFunctionSelector('RecoveryTimelockNotExpired()'))), error: 'RecoveryTimelockNotExpired()' };
    out.gates.weighted = { account: WEIGHTED_ACCT, ...(await expectRevert(WEIGHTED_ACCT, 'executeWeightChange', toFunctionSelector('WeightChangeTimelockNotExpired()'))), error: 'WeightChangeTimelockNotExpired()' };

    writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n');
    for (const [s, rs] of Object.entries(out.receipts as Record<string, any[]>))
        for (const r of rs) console.log(`${r.status === 'success' ? '✅' : r.status === 'NOT_FOUND' ? '❌' : r.status} ${s}/${r.label} to=${(r.to || '').slice(0, 10)} gas=${r.gasUsed || '-'}`);
    console.log(`gasless.ethBalance=${out.state.gasless.ethBalance} · recovery.bitmap=${out.state.recovery.approvalBitmap} · weighted.bitmap=${out.state.weighted.approvalBitmap}`);
    console.log(`gate.recovery: reverted=${out.gates.recovery.reverted} selector=${out.gates.recovery.selector} matches=${out.gates.recovery.matches}`);
    console.log(`gate.weighted: reverted=${out.gates.weighted.reverted} selector=${out.gates.weighted.selector} matches=${out.gates.weighted.matches}`);
    console.log(`\nwrote ${OUT_FILE}`);
}

main().catch((e) => { console.error('verify failed:', e?.message || e); process.exit(1); });
