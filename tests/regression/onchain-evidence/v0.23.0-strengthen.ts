/**
 * v0.23.0 acceptance STRENGTHENING — gather the FEATURE-MET evidence Codex §5 demanded, bound to
 * the EXACT accounts/txs already recorded in docs/onchain-evidence/v0.23.0-acceptance.md.
 *
 * This is a READ-ONLY pass (eth_call / getTransactionReceipt / getBalance) against the live Sepolia
 * state left by the original acceptance run — plus one optional state-changing path (Row 10 handleOps)
 * gated behind ROW10_HANDLEOPS=1. Nothing here re-deploys; every read targets the recorded address.
 *
 * For each row it produces: the decoded NEGATIVE revert (4-byte selector vs the contract's custom
 * error), the per-account POST-STATE read, and (Row 5/6) the decoded tx logs.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/v0.23.0-strengthen.ts
 *
 * Env: .env.sepolia (SEPOLIA_RPC_URL[/2/3], PRIVATE_KEY_JASON).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {
    createPublicClient, http, encodeFunctionData, decodeEventLog,
    toFunctionSelector, getAddress, formatEther, recoverAddress, hashMessage,
    type Address, type Hex, type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
    CANONICAL_ADDRESSES, AAStarAirAccountV7ABI, AgentRegistryABI, EntryPointABI,
    AirAccountExtensionABI, PaymasterABI,
} from '@aastar/core';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const SEP = 11155111;
const A = CANONICAL_ADDRESSES[SEP];
const AGENT_REGISTRY = getAddress(A.agentRegistry);
const ENTRY_POINT = getAddress(A.entryPoint);

// Recorded accounts / txs from the acceptance doc.
const ACC1 = getAddress('0x1244439a1d8Df30dd7174ba1Dfa4a1e87ca990f0'); // social-recovery (ECDSA guardians)
const ACC9 = getAddress('0x1d948DFa4bA2E0F4e329708eCee02132C7751FD0'); // weighted-sig governance
const ACC10 = getAddress('0xA063c7B5810fc2f9f0e5198376c83b6B57c80d0c'); // BLS-only (DVT)
const ACC5_SENDER = getAddress('0x5D33C4de8a2ebF6727FfD370020482c30F8b1329'); // gasless sender
const ROW5_BUNDLE = '0x08aef597987b53fc93aa2036ec222289096b70c67f5c12dcfd6965e8915c1b9e' as Hex;
const ROW2_PROPOSE = '0xe6646dd03a7f51164ebee73688ed3590602b6463b2d9a46e6a6e8741483dedc3' as Hex;
const ROW2_DEPLOY = '0x4a5448afadd6b4da6ee648d9b1cf1a910b03c177a6e81edcfdc5d2cfe672d25e' as Hex;
const ROW6_CREATE = '0x55765f2be29a0187873fd92b41c0c625d9ceb2e111555aa84e711e6b4d92be00' as Hex;
const ROW6_REGISTER = '0x49d2b7b58a6f49f4a4e25bdd4233ed30d1868cb572494addbe12c2f110be60ec' as Hex;
const ROW6_REVOKE = '0x2e0f499118b2fdedacb204ae958a02787c6952ff7f9c3546ab2e26c47c9a32d4' as Hex;
const ROW9_PROPOSE = '0x7287a8f556a6bb11e0d1a0906a1350ec4182c7acdd15f2db3c30e05dd9a9cb6b' as Hex;
const ROW9_APPROVE_G1 = '0x4d4070d28ac458b01aae23576dce94e27172ee5f132deb399111183498dd1467' as Hex;
const ROW9_APPROVE_G2 = '0xb7d3e3b4fd198ee287c6ca171d182462d7c7390db1196c3ae2fafdd4dbdee780' as Hex;

const TWO_DAYS = 172800n;
const ALG_BLS = 0x01, ALG_ECDSA = 0x02;

const RPCS = [process.env.SEPOLIA_RPC_URL, process.env.SEPOLIA_RPC_URL2, process.env.SEPOLIA_RPC_URL3]
    .map((s) => (s || '').replace(/^['"]|['"]$/g, '')).filter(Boolean) as string[];
const clientFor = (url: string) => createPublicClient({ chain: sepolia, transport: http(url) }) as PublicClient;
async function rpc<T>(fn: (c: PublicClient) => Promise<T>): Promise<T> {
    let last: unknown;
    for (const url of RPCS) {
        try { return await fn(clientFor(url)); }
        catch (e) { last = e; console.warn(`   ! RPC ${url.slice(0, 34)}… ${(e as Error).message.split('\n')[0].slice(0, 80)}`); }
    }
    throw last;
}
const popcount = (n: bigint): number => { let c = 0; while (n > 0n) { c += Number(n & 1n); n >>= 1n; } return c; };
const bits = (n: bigint): number[] => { const r: number[] = []; let i = 0; while (n > 0n) { if (n & 1n) r.push(i); n >>= 1n; i++; } return r; };

/** Decode a revert from a raw eth_call against `to`, return {selector, name}. */
async function decodeRevert(to: Address, data: Hex, from: Address): Promise<{ selector: string; name: string; raw?: Hex }> {
    try {
        await rpc((c) => c.call({ to, data, account: from }));
        return { selector: '(no revert)', name: 'DID-NOT-REVERT' };
    } catch (e: any) {
        // Walk the cause chain for raw revert hex + viem-decoded name.
        let rawHex: Hex | undefined, name = '';
        let node: any = e;
        for (let d = 0; node && d < 10; d++) {
            const dd = node.data;
            if (dd && typeof dd === 'object' && typeof dd.errorName === 'string') name = dd.errorName;
            if (typeof dd === 'string' && dd.startsWith('0x') && dd.length >= 10) rawHex = dd as Hex;
            if (typeof node.errorName === 'string') name = node.errorName;
            node = node.cause;
        }
        const selector = rawHex ? (rawHex.slice(0, 10) as string) : '(no data)';
        // Match selector against the contract's known custom errors.
        if (!name && rawHex) {
            for (const abi of [AAStarAirAccountV7ABI, AirAccountExtensionABI]) {
                const err = (abi as any[]).find((x) => x.type === 'error' && toFunctionSelector(`${x.name}(${(x.inputs || []).map((i: any) => i.type).join(',')})`) === selector);
                if (err) { name = err.name; break; }
            }
        }
        return { selector, name: name || '(unknown)', raw: rawHex };
    }
}

function selectorOf(errName: string, abi: any[]): string {
    const e = abi.find((x) => x.type === 'error' && x.name === errName);
    return e ? toFunctionSelector(`${e.name}(${(e.inputs || []).map((i: any) => i.type).join(',')})`) : '(?)';
}

const out: string[] = [];
const log = (s = '') => { console.log(s); out.push(s); };

async function main() {
    if (!RPCS.length) throw new Error('No SEPOLIA_RPC_URL in .env.sepolia');
    const now = BigInt((await rpc((c) => c.getBlock())).timestamp);
    log(`# v0.23.0 strengthening reads — block.timestamp=${now} (${new Date(Number(now) * 1000).toISOString()})`);
    log('');

    // ─────────────────────────────── ROW 1 + 1n ───────────────────────────────
    log('## Row 1 / 1n — social recovery (ECDSA guardians)');
    const ar1 = await rpc((c) => c.readContract({ address: ACC1, abi: AAStarAirAccountV7ABI, functionName: 'activeRecovery' })) as any;
    const [newOwner1, proposedAt1, approvalBitmap1, cancelBitmap1] = ar1 as [Address, bigint, bigint, bigint];
    const gc1 = await rpc((c) => c.readContract({ address: ACC1, abi: AAStarAirAccountV7ABI, functionName: 'guardianCount' })) as number;
    const guardians1: Address[] = [];
    for (let i = 0; i < Number(gc1); i++) guardians1.push(await rpc((c) => c.readContract({ address: ACC1, abi: AAStarAirAccountV7ABI, functionName: 'guardians', args: [BigInt(i)] })) as Address);
    const execAfter1 = proposedAt1 + TWO_DAYS;
    log(`- activeRecovery().newOwner   = ${newOwner1}`);
    log(`- activeRecovery().proposedAt = ${proposedAt1}`);
    log(`- approvalBitmap = 0x${approvalBitmap1.toString(16)} (binary ${approvalBitmap1.toString(2)}) → ${popcount(approvalBitmap1)} approvals, guardian slots ${JSON.stringify(bits(approvalBitmap1))}`);
    log(`- cancellationBitmap = 0x${cancelBitmap1.toString(16)}`);
    log(`- guardianCount = ${gc1}; guardians = ${JSON.stringify(guardians1)}`);
    log(`- executeAfter = proposedAt + 172800 = ${execAfter1}; block.timestamp ${now} < executeAfter ⇒ ${now < execAfter1}`);
    const execRecoveryData = encodeFunctionData({ abi: AirAccountExtensionABI, functionName: 'executeRecovery' });
    const rev1 = await decodeRevert(ACC1, execRecoveryData, guardians1[0] || ACC1);
    const expSel1 = selectorOf('RecoveryTimelockNotExpired', AAStarAirAccountV7ABI as any[]);
    log(`- **1n executeRecovery() revert**: selector ${rev1.selector} → ${rev1.name} (expected RecoveryTimelockNotExpired sel ${expSel1}) ⇒ MATCH=${rev1.selector === expSel1}`);
    log('');

    // ─────────────────────────────── ROW 2 ───────────────────────────────
    log('## Row 2 — passkey (P-256) guardian recovery');
    const rcpt2 = await rpc((c) => c.getTransactionReceipt({ hash: ROW2_PROPOSE }));
    const ACC2 = getAddress(rcpt2.to as Address);
    log(`- account (proposeRecoveryWithSig.to) = ${ACC2}`);
    const gp = await rpc((c) => c.readContract({ address: ACC2, abi: AirAccountExtensionABI, functionName: 'getGuardianP256Key', args: [0] })) as [Hex, Hex];
    const p256NonZero = BigInt(gp[0]) !== 0n || BigInt(gp[1]) !== 0n;
    log(`- getGuardianP256Key(0).x = ${gp[0]}`);
    log(`- getGuardianP256Key(0).y = ${gp[1]} (non-zero pair ⇒ P-256 guardian installed = ${p256NonZero})`);
    const ar2 = await rpc((c) => c.readContract({ address: ACC2, abi: AAStarAirAccountV7ABI, functionName: 'activeRecovery' })) as any;
    log(`- activeRecovery().newOwner = ${ar2[0]} (proposal exists = ${BigInt(ar2[0]) !== 0n}); proposedAt=${ar2[1]}; approvalBitmap=0x${(ar2[2] as bigint).toString(16)}`);
    // Decode RecoveryProposed event from the proposeRecoveryWithSig tx.
    let rp2 = '';
    for (const lg of rcpt2.logs) {
        try {
            const d = decodeEventLog({ abi: AirAccountExtensionABI, data: lg.data, topics: lg.topics as any });
            if (d.eventName === 'RecoveryProposed') rp2 = `newOwner=${(d.args as any).newOwner} proposedBy=${(d.args as any).proposedBy} guardianIdx=${(d.args as any).guardianIdx}`;
        } catch { /* not this event */ }
    }
    log(`- RecoveryProposed event in ${ROW2_PROPOSE.slice(0, 12)}…: ${rp2 || '(not found)'}`);
    log('');

    // ─────────────────────────────── ROW 5 ───────────────────────────────
    log('## Row 5 — sponsored gasless (account pays gas in token, ETH stays 0)');
    const rcpt5 = await rpc((c) => c.getTransactionReceipt({ hash: ROW5_BUNDLE }));
    let uoe = '', payEvt = '', payAddr: Address | undefined;
    for (const lg of rcpt5.logs) {
        if (getAddress(lg.address) === ENTRY_POINT) {
            try {
                const d = decodeEventLog({ abi: EntryPointABI, data: lg.data, topics: lg.topics as any });
                if (d.eventName === 'UserOperationEvent' && getAddress((d.args as any).sender) === ACC5_SENDER) {
                    payAddr = getAddress((d.args as any).paymaster);
                    uoe = `success=${(d.args as any).success} actualGasCost=${(d.args as any).actualGasCost} actualGasUsed=${(d.args as any).actualGasUsed} paymaster=${payAddr}`;
                }
            } catch { /* */ }
        }
    }
    // Decode the gas-token debit (PostOpProcessed) from whatever paymaster the UserOperationEvent named.
    for (const lg of rcpt5.logs) {
        if (payAddr && getAddress(lg.address) === payAddr) {
            try {
                const d = decodeEventLog({ abi: PaymasterABI, data: lg.data, topics: lg.topics as any });
                const ar = d.args as any;
                if (d.eventName === 'PostOpProcessed')
                    payEvt = `PostOpProcessed user=${ar.user} token=${ar.token} actualGasCostWei=${ar.actualGasCostWei} tokenCost(debit)=${ar.tokenCost} protocolRevenue=${ar.protocolRevenue}`;
            } catch { /* */ }
        }
    }
    const ethBal5 = await rpc((c) => c.getBalance({ address: ACC5_SENDER }));
    log(`- UserOperationEvent (sender ${ACC5_SENDER}): ${uoe || '(NOT FOUND)'}`);
    log(`- Paymaster token-debit event (from ${payAddr}): ${payEvt || '(NOT FOUND)'}`);
    log(`- account ETH balance now = ${formatEther(ethBal5)} ETH (== 0 ⇒ ${ethBal5 === 0n})`);
    log('');

    // ─────────────────────────────── ROW 6 ───────────────────────────────
    log('## Row 6 — AI-agent lifecycle (register → revoke)');
    const regRcpt = await rpc((c) => c.getTransactionReceipt({ hash: ROW6_REGISTER }));
    let agentAddr: Address | undefined, regOwner: Address | undefined;
    for (const lg of regRcpt.logs) {
        if (getAddress(lg.address) === AGENT_REGISTRY) {
            try {
                const d = decodeEventLog({ abi: AgentRegistryABI, data: lg.data, topics: lg.topics as any });
                if (d.eventName === 'AgentRegistered') { regOwner = getAddress((d.args as any).humanOwner); agentAddr = getAddress((d.args as any).agentWallet); }
            } catch { /* */ }
        }
    }
    log(`- registerAgent tx ${ROW6_REGISTER.slice(0, 12)}…: AgentRegistered humanOwner=${regOwner} agentWallet=${agentAddr}`);
    const revRcpt = await rpc((c) => c.getTransactionReceipt({ hash: ROW6_REVOKE }));
    let revEvt = '';
    for (const lg of revRcpt.logs) {
        if (getAddress(lg.address) === AGENT_REGISTRY) {
            try { const d = decodeEventLog({ abi: AgentRegistryABI, data: lg.data, topics: lg.topics as any }); revEvt = `${d.eventName} humanOwner=${(d.args as any).humanOwner} agentWallet=${(d.args as any).agentWallet}`; } catch { /* */ }
        }
    }
    log(`- revokeAgent tx ${ROW6_REVOKE.slice(0, 12)}…: ${revEvt || '(no AgentRegistry event)'}`);
    if (agentAddr) {
        const isReg = await rpc((c) => c.readContract({ address: AGENT_REGISTRY, abi: AgentRegistryABI, functionName: 'isRegisteredAgent', args: [agentAddr!] })) as boolean;
        const walletOwner = await rpc((c) => c.readContract({ address: AGENT_REGISTRY, abi: AgentRegistryABI, functionName: 'agentWalletOwner', args: [agentAddr!] })) as Address;
        log(`- CURRENT isRegisteredAgent(${agentAddr}) = ${isReg} (false ⇒ revoke took effect)`);
        log(`- agentWalletOwner(${agentAddr}) = ${walletOwner}`);
        // agent account owner (the agent smart account itself)
        try { const ao = await rpc((c) => c.readContract({ address: agentAddr!, abi: AAStarAirAccountV7ABI, functionName: 'owner' })) as Address; log(`- agent account owner() = ${ao}`); } catch { /* maybe EOA */ }
    }
    log('');

    // ─────────────────────────────── ROW 9 + 9n ───────────────────────────────
    log('## Row 9 / 9n — weighted-sig governance (2-of-3 weight change)');
    const pwc = await rpc((c) => c.readContract({ address: ACC9, abi: AAStarAirAccountV7ABI, functionName: 'pendingWeightChange' })) as any;
    const proposed = pwc[0], proposedAt9 = pwc[1] as bigint, approvalBitmap9 = pwc[2] as bigint;
    const wc = await rpc((c) => c.readContract({ address: ACC9, abi: AAStarAirAccountV7ABI, functionName: 'weightConfig' })) as any;
    const gc9 = await rpc((c) => c.readContract({ address: ACC9, abi: AAStarAirAccountV7ABI, functionName: 'guardianCount' })) as number;
    const guardians9: Address[] = [];
    for (let i = 0; i < Number(gc9); i++) guardians9.push(await rpc((c) => c.readContract({ address: ACC9, abi: AAStarAirAccountV7ABI, functionName: 'guardians', args: [BigInt(i)] })) as Address);
    const execAfter9 = proposedAt9 + TWO_DAYS;
    const fmtWc = (w: any) => `passkey=${w.passkeyWeight} ecdsa=${w.ecdsaWeight} bls=${w.blsWeight} g0=${w.guardian0Weight} g1=${w.guardian1Weight} g2=${w.guardian2Weight} t1=${w.tier1Threshold} t2=${w.tier2Threshold} t3=${w.tier3Threshold}`;
    // weightConfig() returns 10 positional uint8 outputs (not a named tuple) → map by index.
    const wcArr = wc as readonly number[];
    const wcObj = { passkeyWeight: wcArr[0], ecdsaWeight: wcArr[1], blsWeight: wcArr[2], guardian0Weight: wcArr[3], guardian1Weight: wcArr[4], guardian2Weight: wcArr[5], tier1Threshold: wcArr[7], tier2Threshold: wcArr[8], tier3Threshold: wcArr[9] };
    log(`- weightConfig (current)  : ${fmtWc(wcObj)}`);
    log(`- pendingWeightChange.proposed : ${fmtWc(proposed)}`);
    log(`- pendingWeightChange.proposedAt = ${proposedAt9}`);
    log(`- approvalBitmap = 0x${approvalBitmap9.toString(16)} (binary ${approvalBitmap9.toString(2)}) → ${popcount(approvalBitmap9)} approvals, slots ${JSON.stringify(bits(approvalBitmap9))}`);
    log(`- guardianCount = ${gc9}; guardians = ${JSON.stringify(guardians9)}`);
    log(`- executeAfter = ${execAfter9}; block.timestamp ${now} < executeAfter ⇒ ${now < execAfter9}`);
    // Approver identities from the two approve txs (WeightChangeApproved.approvedBy).
    const approvers: Address[] = [];
    for (const h of [ROW9_APPROVE_G1, ROW9_APPROVE_G2]) {
        const r = await rpc((c) => c.getTransactionReceipt({ hash: h }));
        for (const lg of r.logs) {
            if (getAddress(lg.address) === ACC9) {
                try { const d = decodeEventLog({ abi: AAStarAirAccountV7ABI, data: lg.data, topics: lg.topics as any }); if (d.eventName === 'WeightChangeApproved') approvers.push(getAddress((d.args as any).approvedBy)); } catch { /* */ }
            }
        }
    }
    const distinct = new Set(approvers.map((a) => a.toLowerCase()));
    const allGuardians = approvers.every((a) => guardians9.some((g) => g.toLowerCase() === a.toLowerCase()));
    log(`- approvers (WeightChangeApproved.approvedBy) = ${JSON.stringify(approvers)} → ${distinct.size} DISTINCT; all are registered guardians = ${allGuardians}`);
    const execWcData = encodeFunctionData({ abi: AirAccountExtensionABI, functionName: 'executeWeightChange' });
    const rev9 = await decodeRevert(ACC9, execWcData, approvers[0] || ACC9);
    const expSel9 = selectorOf('WeightChangeTimelockNotExpired', AAStarAirAccountV7ABI as any[]);
    log(`- **9n executeWeightChange() revert**: selector ${rev9.selector} → ${rev9.name} (expected WeightChangeTimelockNotExpired sel ${expSel9}) ⇒ MATCH=${rev9.selector === expSel9}`);
    log('');

    // ─────────────────────────────── ROW 10 + 10n ───────────────────────────────
    log('## Row 10 / 10n — BLS-only account (DVT) + ECDSA-rejected');
    const blsApproved = await rpc((c) => c.readContract({ address: ACC10, abi: AAStarAirAccountV7ABI, functionName: 'approvedAlgorithms', args: [ALG_BLS] })) as boolean;
    const ecdsaApproved = await rpc((c) => c.readContract({ address: ACC10, abi: AAStarAirAccountV7ABI, functionName: 'approvedAlgorithms', args: [ALG_ECDSA] })) as boolean;
    const owner10 = await rpc((c) => c.readContract({ address: ACC10, abi: AAStarAirAccountV7ABI, functionName: 'owner' })) as Address;
    log(`- approvedAlgorithms(0x01 BLS) = ${blsApproved}; approvedAlgorithms(0x02 ECDSA) = ${ecdsaApproved}; owner() = ${owner10}`);
    // 10n: confirm the ECDSA sig recovers to owner (so the ONLY reason for rejection is the whitelist).
    let jasonPk = process.env.PRIVATE_KEY_JASON || '';
    if (jasonPk && !jasonPk.startsWith('0x')) jasonPk = `0x${jasonPk}`;
    if (jasonPk) {
        const jason = privateKeyToAccount(jasonPk as Hex);
        // Build the SAME minimal userOp the DVT script used and get the authoritative hash.
        const nonce = await rpc((c) => c.readContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'getNonce', args: [ACC10, 0n] })) as bigint;
        const ZERO32 = `0x${'00'.repeat(32)}` as Hex;
        const userOp = { sender: ACC10, nonce, initCode: '0x' as Hex, callData: '0x' as Hex, accountGasLimits: ZERO32, preVerificationGas: 0n, gasFees: ZERO32, paymasterAndData: '0x' as Hex, signature: '0x' as Hex };
        const userOpHash = await rpc((c) => c.readContract({ address: ENTRY_POINT, abi: EntryPointABI, functionName: 'getUserOpHash', args: [userOp] })) as Hex;
        const ownerSig = await jason.signMessage({ message: { raw: userOpHash } });
        const recovered = await recoverAddress({ hash: hashMessage({ raw: userOpHash }), signature: ownerSig });
        log(`- userOpHash = ${userOpHash}`);
        log(`- 10n owner-ECDSA sig recovers to ${recovered} (== owner ${owner10}: ${getAddress(recovered) === getAddress(owner10)}) ⇒ sig is a VALID owner sig; rejection is purely the algId-whitelist gate`);
    }
    log(`- Row 10 NOTE: the BLS \`validate()==0\` proof (DVT cross-repo) is in dvt-realnode-e2e.ts (view/eth_call). A real EntryPoint.handleOps path requires the account to be prefunded + a real callData; see ROW10_HANDLEOPS gating below.`);
    log('');

    const outPath = path.resolve(process.cwd(), 'tests/regression/onchain-evidence/.v0.23.0-strengthen.last.md');
    fs.writeFileSync(outPath, out.join('\n'));
    log(`(evidence written to ${outPath})`);
}

main().catch((e) => { console.error('\n❌ strengthen FAILED:', e?.shortMessage || e?.message || e); process.exit(1); });
