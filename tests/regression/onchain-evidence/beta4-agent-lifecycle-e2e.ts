/**
 * Beta4 — Agent on-chain lifecycle evidence (REAL Sepolia txs, NOT a unit test).
 *
 * Proves the full agent-account lifecycle on live Sepolia v0.18 contracts using the
 * viem agent actions merged in Beta4 Phase 1
 * (packages/core/src/actions/airAccountFactory.ts + agentRegistry.ts):
 *
 *   1. createAgentAccount(...)  — JASON (human owner / msg.sender) deploys an agent AirAccount
 *                                 via the factory. guardian2 = ANNI, agentKey = fresh EOA.
 *                                 The factory marks the new account valid in the AgentRegistry.
 *                                 (predicted via getAgentAddress first, then confirm bytecode)
 *   2. registerAgent(agentWallet, agentWalletSig)  — the agent AirAccount (msg.sender) binds the
 *                                 fresh agentKey EOA as its agent wallet. registerAgent requires
 *                                 msg.sender to be a factory-created account (isValidAccount), so
 *                                 it is routed through agentAccount.execute(registry, 0, calldata),
 *                                 which JASON (the owner) signs/pays.
 *   3. on-chain reads — isRegisteredAgent / getHumanOwner / isValidAccount / getAgentCount / getAgents.
 *   4. revokeAgent(agentWallet) — same execute() routing; assert isRegisteredAgent flips to false.
 *
 * Signature schemes (from airaccount-contract src):
 *   AAStarAirAccountFactoryV7.createAgentAccount:
 *     agentKeySig   = sign( keccak256(abi.encodePacked("ACCEPT_AGENT_KEY",
 *                       chainId, factory, agentKey, humanOwner, agentId, deadline)) )  by agentKey
 *     guardian2Sig  = sign( keccak256(abi.encodePacked("ACCEPT_AGENT_GUARDIAN",
 *                       chainId, factory, agentKey, humanOwner, agentId, deadline)) )  by guardian2
 *   AgentRegistry.registerAgent:
 *     agentWalletSig= sign( keccak256(abi.encodePacked("REGISTER_AGENT",
 *                       chainId, registry, msg.sender(=agentAccount), agentWallet)) ) by agentWallet
 *   (all hashes are wrapped with the EIP-191 personal_sign prefix — toEthSignedMessageHash())
 *
 * Every state-changing tx is verified to status='success' before being reported.
 * Re-runnable: a UNIQUE agentId (timestamp-derived) deploys a fresh agent account each run.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/beta4-agent-lifecycle-e2e.ts
 *
 * Requires .env.sepolia with SEPOLIA_RPC_URL + PRIVATE_KEY_JASON (funded EOA) + PRIVATE_KEY_ANNI.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
    createPublicClient, createWalletClient, http, publicActions, parseEther, formatEther,
    encodeFunctionData, encodePacked, keccak256, getAddress,
    type Address, type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
    airAccountFactoryActions,
    agentRegistryActions,
    AgentRegistryABI,
    AAStarAirAccountV7ABI,
} from '../../../packages/core/src/index.js';
import { CANONICAL_ADDRESSES } from '../../../packages/core/src/addresses.js';
import { resilientSepoliaTransport } from './_rpc.js';

const SEPOLIA_CONTRACTS = CANONICAL_ADDRESSES[11155111];

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

const ETHERSCAN = (h: string) => `https://sepolia.etherscan.io/tx/${h}`;
const ZERO = '0x0000000000000000000000000000000000000000' as Address;

function clean(v?: string): string { return (v ?? '').replace(/^['"]|['"]$/g, '').trim(); }
function asPk(v?: string): Hex {
    const c = clean(v);
    return (c.startsWith('0x') ? c : `0x${c}`) as Hex;
}

interface StepRecord { step: string; actor: string; tx?: string; note?: string; }

async function main() {
    // ── Config & clients ─────────────────────────────────────────────────────
    const rpc = clean(process.env.SEPOLIA_RPC_URL || process.env.RPC_URL);
    const jasonPk = process.env.PRIVATE_KEY_JASON;
    const anniPk = process.env.PRIVATE_KEY_ANNI;
    if (!rpc) throw new Error('SEPOLIA_RPC_URL missing in .env.sepolia');
    if (!jasonPk) throw new Error('PRIVATE_KEY_JASON missing in .env.sepolia');
    if (!anniPk) throw new Error('PRIVATE_KEY_ANNI missing in .env.sepolia');

    const owner = privateKeyToAccount(asPk(jasonPk));       // human owner = msg.sender for createAgentAccount
    const guardian2 = privateKeyToAccount(asPk(anniPk));    // guardian2 (must sign ACCEPT_AGENT_GUARDIAN)
    const agentKey = privateKeyToAccount(generatePrivateKey()); // fresh agent signing key / agent wallet

    const FACTORY = getAddress(SEPOLIA_CONTRACTS.airAccountFactoryV7);
    const REGISTRY = getAddress(SEPOLIA_CONTRACTS.agentRegistry);

    // Single wallet client extended with publicActions → reads + writes + waitForTransactionReceipt.
    const client = createWalletClient({ account: owner, chain: sepolia, transport: resilientSepoliaTransport() }).extend(publicActions);
    const publicClient = createPublicClient({ chain: sepolia, transport: resilientSepoliaTransport() });

    const factory = airAccountFactoryActions(FACTORY)(client as any);
    const registryRead = agentRegistryActions(REGISTRY)(publicClient);

    const chainId = BigInt(sepolia.id);

    console.log('🧪 Beta4 agent-lifecycle on-chain evidence (Sepolia v0.19.0-beta.2)');
    console.log(`   Factory:       ${FACTORY}`);
    console.log(`   AgentRegistry: ${REGISTRY}`);
    console.log(`   Owner (JASON): ${owner.address}`);
    console.log(`   Guardian2 (ANNI): ${guardian2.address}`);
    console.log(`   AgentKey (fresh): ${agentKey.address}`);
    const startBal = await publicClient.getBalance({ address: owner.address });
    console.log(`   Owner balance: ${formatEther(startBal)} ETH`);

    const steps: StepRecord[] = [];
    const errors: string[] = [];

    const waitOk = async (hash: Hex, label: string): Promise<boolean> => {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const ok = receipt.status === 'success';
        console.log(`   ${ok ? '✅' : '❌'} ${label}: ${hash}  (status=${receipt.status})  gasUsed=${receipt.gasUsed}`);
        return ok;
    };

    // ── Preflight: factory ↔ registry binding (registerAgent depends on it) ───
    const boundRegistry = await factory.agentRegistry();
    const registryFactory = await (publicClient.readContract({ address: REGISTRY, abi: AgentRegistryABI, functionName: 'factory', args: [] }) as Promise<Address>);
    const communityGuardian = await factory.defaultCommunityGuardian();
    console.log(`\n   factory.agentRegistry()  = ${boundRegistry}`);
    console.log(`   registry.factory()       = ${registryFactory}`);
    console.log(`   defaultCommunityGuardian = ${communityGuardian}`);
    const bindingOk = getAddress(boundRegistry) === REGISTRY && getAddress(registryFactory) === FACTORY;
    if (!bindingOk) {
        console.log('   ⚠️  factory/registry NOT mutually bound — markValid will be skipped and registerAgent will revert CallerNotAirAccount.');
    }
    // Guardian-uniqueness preconditions enforced by the contract.
    for (const [name, addr] of [['owner', owner.address], ['guardian2', guardian2.address], ['agentKey', agentKey.address]] as const) {
        if (getAddress(addr) === getAddress(communityGuardian)) throw new Error(`${name} collides with defaultCommunityGuardian`);
    }

    // ── 1. createAgentAccount ────────────────────────────────────────────────
    // Unique agentId per run so the CREATE2 address is fresh.
    const agentId = keccak256(encodePacked(['string', 'uint256'], ['beta4-agent', BigInt(Date.now())])) as Hex;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // now + 1h (< 30d TTL cap)
    const dailyLimit = parseEther('1');

    // Predict the agent account address (getAgentAddress(humanOwner, agentKey, agentId)).
    const predicted = await factory.getAgentAddress({ humanOwner: owner.address, agentKey: agentKey.address, agentId });
    console.log(`\n   agentId:           ${agentId}`);
    console.log(`   deadline:          ${deadline}`);
    console.log(`   Predicted agent account: ${predicted}`);

    // Build EIP-191-wrapped signatures over the abi.encodePacked creation hashes.
    const agentKeyDigest = keccak256(encodePacked(
        ['string', 'uint256', 'address', 'address', 'address', 'bytes32', 'uint48'],
        ['ACCEPT_AGENT_KEY', chainId, FACTORY, agentKey.address, owner.address, agentId, Number(deadline)],
    ));
    const guardian2Digest = keccak256(encodePacked(
        ['string', 'uint256', 'address', 'address', 'address', 'bytes32', 'uint48'],
        ['ACCEPT_AGENT_GUARDIAN', chainId, FACTORY, agentKey.address, owner.address, agentId, Number(deadline)],
    ));
    // signMessage({ raw }) applies the personal_sign (EIP-191) prefix == toEthSignedMessageHash().
    const agentKeySig = await agentKey.signMessage({ message: { raw: agentKeyDigest } });
    const guardian2Sig = await guardian2.signMessage({ message: { raw: guardian2Digest } });

    let agentAccount: Address | undefined;
    try {
        const createTx = await factory.createAgentAccount({
            agentKey: agentKey.address,
            agentId,
            guardian2: guardian2.address,
            guardian2Sig,
            agentKeySig,
            deadline,
            dailyLimit,
            account: owner,
        });
        const ok = await waitOk(createTx, 'createAgentAccount');
        steps.push({ step: '1. createAgentAccount', actor: `JASON ${owner.address}`, tx: createTx, note: ok ? undefined : 'reverted' });
        if (ok) {
            const code = await publicClient.getBytecode({ address: predicted });
            const hasCode = !!code && code !== '0x';
            console.log(`   Bytecode at predicted address: ${hasCode ? `present (${(code!.length - 2) / 2} bytes)` : 'MISSING'}`);
            const onChainOwner = await publicClient.readContract({ address: predicted, abi: AAStarAirAccountV7ABI, functionName: 'owner', args: [] }) as Address;
            console.log(`   agentAccount.owner() = ${onChainOwner}  (expect JASON ${owner.address})`);
            if (!hasCode) throw new Error('no bytecode at predicted address after createAgentAccount');
            agentAccount = predicted;
        }
    } catch (e: any) {
        const msg = e?.shortMessage || e?.details || e?.message || String(e);
        console.log(`   ❌ createAgentAccount FAILED: ${msg}`);
        errors.push(`Step 1 createAgentAccount: ${msg}`);
    }

    // ── 2. registerAgent (routed through agentAccount.execute) ───────────────
    if (agentAccount) {
        const isValid = await registryRead.isValidAccount({ account: agentAccount });
        console.log(`\n   registry.isValidAccount(agentAccount) = ${isValid}`);
        if (!isValid) {
            errors.push('Step 2 precondition: agentAccount not isValidAccount — registerAgent would revert CallerNotAirAccount');
        }

        // agentWallet = the fresh agentKey EOA (distinct from the agentAccount contract).
        const agentWallet = agentKey.address;
        // REGISTER_AGENT digest: msg.sender is the agentAccount (the caller of registerAgent).
        const regDigest = keccak256(encodePacked(
            ['string', 'uint256', 'address', 'address', 'address'],
            ['REGISTER_AGENT', chainId, REGISTRY, agentAccount, agentWallet],
        ));
        const agentWalletSig = await agentKey.signMessage({ message: { raw: regDigest } });

        const registerCalldata = encodeFunctionData({
            abi: AgentRegistryABI, functionName: 'registerAgent', args: [agentWallet, agentWalletSig],
        });
        try {
            // agentAccount.execute(registry, 0, registerCalldata) — onlyOwnerOrEntryPoint; JASON is owner.
            const execTx = await client.writeContract({
                address: agentAccount, abi: AAStarAirAccountV7ABI, functionName: 'execute',
                args: [REGISTRY, 0n, registerCalldata], account: owner, chain: sepolia,
            });
            const ok = await waitOk(execTx, 'registerAgent (via agentAccount.execute)');
            steps.push({ step: '2. registerAgent', actor: `agentAccount ${agentAccount} (owner JASON)`, tx: execTx, note: ok ? undefined : 'reverted' });

            // ── 3. on-chain reads ────────────────────────────────────────────
            if (ok) {
                const isReg = await registryRead.isRegisteredAgent({ agentWallet });
                const humanOwner = await registryRead.getHumanOwner({ agentWallet });
                const count = await registryRead.getAgentCount({ owner: agentAccount });
                const agents = await registryRead.getAgents({ humanOwner: agentAccount });
                console.log(`\n   isRegisteredAgent(agentWallet) = ${isReg}  (expect true)`);
                console.log(`   getHumanOwner(agentWallet)     = ${humanOwner}  (expect agentAccount ${agentAccount})`);
                console.log(`   getAgentCount(agentAccount)    = ${count}  (expect 1)`);
                console.log(`   getAgents(agentAccount)        = ${JSON.stringify(agents)}`);
                const assertions = [
                    ['isRegisteredAgent==true', isReg === true],
                    ['getHumanOwner==agentAccount', getAddress(humanOwner) === getAddress(agentAccount)],
                    ['getAgentCount==1', count === 1n],
                    ['getAgents contains agentWallet', agents.map(a => getAddress(a)).includes(getAddress(agentWallet))],
                ] as const;
                for (const [name, pass] of assertions) {
                    console.log(`   ${pass ? '✅' : '❌'} assert ${name}`);
                    if (!pass) errors.push(`Step 3 read assertion failed: ${name}`);
                }
            }
        } catch (e: any) {
            const msg = e?.shortMessage || e?.details || e?.message || String(e);
            console.log(`   ❌ registerAgent FAILED: ${msg}`);
            errors.push(`Step 2 registerAgent: ${msg}`);
        }

        // ── 4. revokeAgent (routed through agentAccount.execute) ─────────────
        const stillReg = await registryRead.isRegisteredAgent({ agentWallet });
        if (stillReg) {
            const revokeCalldata = encodeFunctionData({ abi: AgentRegistryABI, functionName: 'revokeAgent', args: [agentWallet] });
            try {
                const revTx = await client.writeContract({
                    address: agentAccount, abi: AAStarAirAccountV7ABI, functionName: 'execute',
                    args: [REGISTRY, 0n, revokeCalldata], account: owner, chain: sepolia,
                });
                const ok = await waitOk(revTx, 'revokeAgent (via agentAccount.execute)');
                steps.push({ step: '4. revokeAgent', actor: `agentAccount ${agentAccount} (owner JASON)`, tx: revTx, note: ok ? undefined : 'reverted' });
                if (ok) {
                    const isRegAfter = await registryRead.isRegisteredAgent({ agentWallet });
                    console.log(`\n   isRegisteredAgent(agentWallet) after revoke = ${isRegAfter}  (expect false)`);
                    console.log(`   ${isRegAfter === false ? '✅' : '❌'} assert isRegisteredAgent==false after revoke`);
                    if (isRegAfter !== false) errors.push('Step 4 assertion failed: isRegisteredAgent still true after revoke');
                }
            } catch (e: any) {
                const msg = e?.shortMessage || e?.details || e?.message || String(e);
                console.log(`   ❌ revokeAgent FAILED: ${msg}`);
                errors.push(`Step 4 revokeAgent: ${msg}`);
            }
        } else {
            console.log('\n   ⚠️  agent not registered → skipping revoke.');
        }
    } else {
        console.log('\n   ⚠️  No agent account deployed → skipping register/reads/revoke.');
    }

    // ── Report ───────────────────────────────────────────────────────────────
    const endBal = await publicClient.getBalance({ address: owner.address });
    const spent = startBal - endBal;
    console.log('\n──────────────────────────────────────────────────────────────');
    console.log('📋 Beta4 agent-lifecycle evidence summary');
    console.log(`   Agent account: ${agentAccount ?? '(not deployed)'}`);
    console.log(`   Agent wallet:  ${agentKey.address}`);
    for (const s of steps) {
        console.log(`   • ${s.step}${s.note ? ` [${s.note}]` : ''}`);
        console.log(`       actor: ${s.actor}`);
        if (s.tx) console.log(`       tx:    ${ETHERSCAN(s.tx)}`);
    }
    console.log(`   ETH spent: ${formatEther(spent)} ETH`);
    if (errors.length) {
        console.log(`\n   ❌ ${errors.length} issue(s):`);
        for (const e of errors) console.log(`      - ${e}`);
        process.exitCode = 1;
    } else {
        console.log('\n   ✅ Full agent lifecycle verified on Sepolia.');
    }
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
