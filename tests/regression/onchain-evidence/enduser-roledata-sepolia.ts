/**
 * Evidence: ROLE_ENDUSER role data and entry point against the deployed Registry. Part 1 (Sepolia) is read-only: every
 * row is an eth_call from an address with no GToken, pinned to one block; nothing is signed or sent there. The optional
 * Part 2 sends transactions, on a local anvil only.
 *
 * Part 1 (Sepolia, eth_call): what the calls prove is narrow. A registration that gets past Registry's EndUserRoleData
 * decode, the community check and the sender check next pulls GToken, so for this empty caller it reverts
 * ERC20InsufficientAllowance; a rejected role data reverts InvalidParam, a caller other than `user` Unauthorized. The
 * allowance error cannot show the stake (the ticket is pulled first), so Part 1 says nothing about stake handling.
 *
 * Part 2 (optional, LOCAL_ANVIL_CONFIG=<SP DeployLive config.json> on a local anvil, chain 31337): a real registration
 * through createEndUserClient().joinAndActivate with a stake distinct from the role's minStake, read back from the
 * chain (hasRole, Registry.getRoleStake), and a below-minimum stake refused. It runs inside an evm_snapshot that is
 * reverted afterwards and read back. Accounts come from anvil's public default mnemonic; local chain only.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/enduser-roledata-sepolia.ts
 *
 * Output: docs/onchain-evidence/enduser-roledata-sepolia.md (no RPC URL, no error text).
 */
import { writeFileSync } from 'node:fs';
import {
    createPublicClient, http, encodeAbiParameters, encodeFunctionData, decodeErrorResult, parseEther, toFunctionSelector,
    concat, type Address, type Hex,
} from 'viem';
// Part 2 dynamic imports: node:fs, viem/accounts, viem/chains (foundry), packages/sdk endUser client.
import { sepolia } from 'viem/chains';
import { getCanonicalAddresses, RegistryABI, ROLE_ENDUSER, ROLE_COMMUNITY, encodeEndUserRoleData, encodeCommunityRoleData } from '@aastar/core';
import { RoleDataFactory } from '../../../packages/sdk/src/utils/roleData.js';

const RPC = process.env.SEPOLIA_PUBLIC_RPC ?? 'https://ethereum-sepolia-rpc.publicnode.com'; // never written out
const OUT = 'docs/onchain-evidence/enduser-roledata-sepolia.md';
const COMMUNITY = '0xb5600060e6de5E11D3636731964218E53caadf0E' as Address; // holds ROLE_COMMUNITY on Sepolia (checked below)
const USER = '0x000000000000000000000000000000000000fa11' as Address; // no GToken, no allowance
const ERRORS = [
    { type: 'error', name: 'InvalidParam', inputs: [] },
    { type: 'error', name: 'Unauthorized', inputs: [] },
    { type: 'error', name: 'InsufficientStake', inputs: [{ type: 'uint256' }, { type: 'uint256' }] },
    { type: 'error', name: 'ERC20InsufficientAllowance', inputs: [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }] },
] as const;

async function main() {
    const c = createPublicClient({ chain: sepolia, transport: http(RPC) });
    if ((await c.getChainId()) !== sepolia.id) throw new Error('the endpoint is not Sepolia');
    const registry = getCanonicalAddresses(sepolia.id)!.registry as Address;
    const blockNumber = await c.getBlockNumber();
    const version = await c.readContract({ address: registry, abi: RegistryABI, functionName: 'version', blockNumber }) as string;
    const isCommunity = await c.readContract({ address: registry, abi: RegistryABI, functionName: 'hasRole', args: [ROLE_COMMUNITY, COMMUNITY], blockNumber }) as boolean;

    const outcome = (data: Hex) => outcomeFrom(USER, data);
    async function outcomeFrom(from: Address, data: Hex): Promise<string> {
        try {
            await c.call({ account: from, to: registry, data, blockNumber });
            return 'no revert';
        } catch (e) {
            const raw = executionRevertData(e);
            if (raw === undefined) return 'inconclusive: not an execution revert';
            if (raw === '0x') return 'revert without data';
            try { return decodeErrorResult({ abi: ERRORS, data: raw as Hex }).errorName; } catch { return `other revert ${String(raw).slice(0, 10)}`; }
        }
    }
    const register = (roleId: Hex, roleData: Hex) => encodeFunctionData({ abi: RegistryABI, functionName: 'registerRole', args: [roleId, USER, roleData] });

    // The encodings the SDK sent before this change, reproduced byte for byte.
    const oldFlat = encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'string' }, { type: 'string' }, { type: 'uint256' }], [USER, COMMUNITY, '', '', 0n]); // UserClient / joinAndActivate
    const oldTuple = encodeAbiParameters([{ type: 'tuple', components: [{ name: 'account', type: 'address' }, { name: 'community', type: 'address' }, { name: 'avatarURI', type: 'string' }, { name: 'ensName', type: 'string' }, { name: 'stakeAmount', type: 'uint256' }] }], [{ account: USER, community: COMMUNITY, avatarURI: '', ensName: '', stakeAmount: 0n }]); // RoleDataFactory.endUser
    const oldSelf = concat([toFunctionSelector('registerRoleSelf(bytes32,bytes)'), encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes' }], [ROLE_ENDUSER, oldFlat])]);

    const rows: Array<[string, string, string]> = [
        ['before: registerRole(ENDUSER) with the five-field data of UserClient.registerAsEndUser / joinAndActivate', await outcome(register(ROLE_ENDUSER, oldFlat)), 'InvalidParam'],
        ['before: registerRole(ENDUSER) with RoleDataFactory.endUser\'s five-field tuple', await outcome(register(ROLE_ENDUSER, oldTuple)), 'InvalidParam'],
        ['before: the registerRoleSelf(bytes32,bytes) selector those two clients called', await outcome(oldSelf), 'revert without data'],
        ['after: registerRole(ENDUSER, self, encodeEndUserRoleData({ community }))', await outcome(register(ROLE_ENDUSER, encodeEndUserRoleData({ community: COMMUNITY }))), 'ERC20InsufficientAllowance'],
        ['after: registerRole(ENDUSER, self, RoleDataFactory.endUser({ community, stakeAmount: 0.3 GT }))', await outcome(register(ROLE_ENDUSER, RoleDataFactory.endUser({ community: COMMUNITY, stakeAmount: parseEther('0.3') }))), 'ERC20InsufficientAllowance'],
        ['control: the same two-field data naming an address that is not a community', await outcome(register(ROLE_ENDUSER, encodeEndUserRoleData({ community: USER }))), 'InvalidParam'],
        ['control: the two-field data sent by a caller other than `user`', await outcomeFrom(COMMUNITY, register(ROLE_ENDUSER, encodeEndUserRoleData({ community: COMMUNITY }))), 'Unauthorized'],
        ['unchanged (checked): registerRole(COMMUNITY) with core encodeCommunityRoleData', await outcome(register(ROLE_COMMUNITY, encodeCommunityRoleData({ name: `zz-probe-${blockNumber}`, stakeAmount: parseEther('30') }))), 'ERC20InsufficientAllowance'],
    ];
    let pass = isCommunity && rows.every(([, got, want]) => got === want);
    const part2 = process.env.LOCAL_ANVIL_CONFIG ? await localRegistration(process.env.LOCAL_ANVIL_CONFIG) : undefined;
    if (part2) pass = pass && part2.ok;
    const lines = [
        '# ROLE_ENDUSER role data against the deployed Registry (Sepolia)',
        '',
        `Generated by \`tests/regression/onchain-evidence/enduser-roledata-sepolia.ts\` on ${new Date().toISOString()}. Read-only eth_call from ${USER} (no GToken) at block ${blockNumber}; Registry ${registry} reports \`${version}\`; community ${COMMUNITY} holds ROLE_COMMUNITY: ${isCommunity}.`,
        '',
        'Registry decodes `EndUserRoleData { address community; uint256 stakeAmount; }` (SuperPaymaster `contracts/src/core/Registry.sol` at d651646a, the revision that reports Registry-5.8.0). "ERC20InsufficientAllowance" means the call got past that decode, the community check and the sender check and stopped at the GToken pull, which this empty caller cannot pay; "InvalidParam" means the role data was rejected; "Unauthorized" means msg.sender != user. These rows do not show how the stake is handled; Part 2 does.',
        '',
        '| Call | Result | Expected |',
        '|---|---|---|',
        ...rows.map(([what, got, want]) => `| ${what} | ${got} | ${want}${got === want ? '' : ' **(differs)**'} |`),
        '',
        ...(part2 ? ['## Part 2 — a real registration on a local anvil (SP DeployLive, chain 31337)', '', ...part2.lines, ''] : ['Part 2 (local anvil registration) was not run in this generation.', '']),
        `Verdict: ${pass ? 'PASS' : 'FAIL'}`,
        '',
    ];
    writeFileSync(OUT, lines.join('\n'));
    console.log(lines.join('\n'));
    if (!pass) process.exitCode = 1;
}

/**
 * Revert data only from a JSON-RPC execution revert (code 3) in the error chain; any other failure (transport,
 * gateway, provider) is not evidence of what the contract did and yields undefined.
 */
function executionRevertData(e: unknown): Hex | undefined {
    for (let x: any = e, i = 0; x && i < 8; x = x.cause, i++) {
        if (x.code === 3 && typeof x.data === 'string' && /^0x([0-9a-fA-F]{2})*$/.test(x.data)) return x.data as Hex;
    }
    return undefined;
}

async function localRegistration(configPath: string): Promise<{ ok: boolean; lines: string[] }> {
    const { readFileSync } = await import('node:fs');
    const { createWalletClient, erc20Abi } = await import('viem');
    const { mnemonicToAccount } = await import('viem/accounts');
    const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk'; // anvil's public default mnemonic
    const { foundry } = await import('viem/chains');
    const { createEndUserClient } = await import('../../../packages/sdk/src/clients/endUser.js');
    const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
    const t = http(process.env.LOCAL_ANVIL_RPC ?? 'http://127.0.0.1:8545');
    const deployer = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 0 }); // DeployLive's deployer (Registry owner on the local non-production deploy)
    const community = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 1 }).address; // DeployLive's Mycelium community (anvil #1)
    const read = (c: any, functionName: string, args: unknown[] = []) => c.readContract({ address: cfg.registry, abi: RegistryABI, functionName, args });
    const probe: any = createEndUserClient({ chain: foundry, transport: t, addresses: { registry: cfg.registry } as any });
    if ((await probe.getChainId()) !== 31337) throw new Error('LOCAL_ANVIL_CONFIG: not a local anvil (chain 31337)');
    // Two fresh accounts: the first mnemonic indices from 10 up that hold no ENDUSER role yet.
    const fresh = [];
    for (let i = 10; fresh.length < 2 && i < 200; i++) {
        const a = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: i });
        if (!(await read(probe, 'hasRole', [ROLE_ENDUSER, a.address]))) fresh.push(a);
    }
    const [user, low] = fresh;
    const original = await read(probe, 'getRoleConfig', [ROLE_ENDUSER]) as any;
    const w = createWalletClient({ account: deployer, chain: foundry, transport: t });
    const wait = async (hash: Hex) => {
        const r = await probe.waitForTransactionReceipt({ hash });
        if (r.status !== 'success') throw new Error(`local tx ${hash} reverted`);
        return r;
    };

    // Everything below runs inside an anvil snapshot that is reverted afterwards, then read back: the run leaves no
    // registration, funding or config change behind, and the report says so only if the read-back agrees.
    const snapshot = await probe.request({ method: 'evm_snapshot', params: [] }) as Hex;
    let result: { ok: boolean; lines: string[] } | undefined;
    // Registry ignores the encoded stake when minStake is 0 (_enforceMinStake returns 0), and minStake − 1 means
    // "use the minimum" when minStake is 1, so neither case can show that the second word is decoded. Raise it for the run.
    const changedConfig = original.minStake < 2n;
    try {
        if (changedConfig) await wait(await w.writeContract({ address: cfg.registry, abi: RegistryABI, functionName: 'configureRole', args: [ROLE_ENDUSER, { ...original, minStake: parseEther('0.1') }] }));
        const role = await read(probe, 'getRoleConfig', [ROLE_ENDUSER]) as { minStake: bigint; ticketPrice: bigint };
        const stake = role.minStake + parseEther('0.27'); // neither 0 nor minStake
        const c: any = createEndUserClient({ chain: foundry, transport: t, account: user, addresses: { registry: cfg.registry, mySBT: cfg.sbt, superPaymaster: cfg.superPaymaster, xPNTsFactory: cfg.xPNTsFactory } as any });
        await wait(await w.sendTransaction({ to: user.address, value: parseEther('0.1') })); // gas for the fresh account
        await wait(await w.writeContract({ address: cfg.gToken, abi: erc20Abi, functionName: 'transfer', args: [user.address, stake + role.ticketPrice] }));
        await wait(await c.writeContract({ address: cfg.gToken, abi: erc20Abi, functionName: 'approve', args: [cfg.staking, stake + role.ticketPrice], account: user, chain: foundry }));
        const r = await c.joinAndActivate({ community, roleId: ROLE_ENDUSER, roleData: RoleDataFactory.endUser({ community, stakeAmount: stake }) });
        const after = await read(probe, 'hasRole', [ROLE_ENDUSER, user.address]) as boolean;
        const recorded = await read(probe, 'getRoleStake', [ROLE_ENDUSER, user.address]) as bigint;

        // A stake below minStake must be refused by Registry, which it can only do if it read the second word.
        const below = role.minStake - 1n;
        let refusal = 'no revert';
        try {
            await probe.call({ account: low.address, to: cfg.registry, data: encodeFunctionData({ abi: RegistryABI, functionName: 'registerRole', args: [ROLE_ENDUSER, low.address, RoleDataFactory.endUser({ community, stakeAmount: below })] }) });
        } catch (e) {
            const raw = executionRevertData(e);
            try { const d = decodeErrorResult({ abi: ERRORS, data: raw as Hex }); refusal = `${d.errorName}(${(d.args ?? []).map(String).join(', ')})`; } catch { refusal = 'other revert'; }
        }
        const wantRefusal = `InsufficientStake(${below}, ${role.minStake})`;
        const version = await read(probe, 'version') as string;
        result = { ok: after && recorded === stake && refusal === wantRefusal, lines: [
            `Registry ${cfg.registry} (\`${version}\`), community ${community}; ENDUSER ticket ${role.ticketPrice}; minStake ${role.minStake}${changedConfig ? ` (raised from ${original.minStake} with configureRole inside the snapshot)` : ''}.`,
            '',
            '| Check | Result | OK |', '|---|---|---|',
            `| ${user.address}: joinAndActivate with RoleDataFactory.endUser({ community, stakeAmount: ${stake} }) | tx ${r.tx} (reverted with the snapshot afterwards), SBT ${r.sbtId}, hasRole ${after} | ${after ? 'yes' : '**NO**'} |`,
            `| Registry.getRoleStake(ENDUSER, user) equals the encoded stake ${stake} | ${recorded} | ${recorded === stake ? 'yes' : '**NO**'} |`,
            `| ${low.address}: stake ${below} (minStake − 1), eth_call | ${refusal} | ${refusal === wantRefusal ? 'yes' : `**NO** (expected ${wantRefusal})`} |`,
        ] };
    } finally {
        const reverted = await probe.request({ method: 'evm_revert', params: [snapshot] });
        if (reverted !== true) throw new Error('evm_revert did not restore the snapshot');
    }
    // Read back after the revert: the config and the user's role must be what they were before the run.
    const restored = await read(probe, 'getRoleConfig', [ROLE_ENDUSER]) as any;
    const stillHas = await read(probe, 'hasRole', [ROLE_ENDUSER, user.address]) as boolean;
    const clean = restored.minStake === original.minStake && restored.ticketPrice === original.ticketPrice && !stillHas;
    result!.lines.push(`| after evm_revert: ENDUSER minStake / ticket back to ${original.minStake} / ${original.ticketPrice}, user has no role | ${restored.minStake} / ${restored.ticketPrice}, hasRole ${stillHas} | ${clean ? 'yes' : '**NO**'} |`);
    return { ok: result!.ok && clean, lines: result!.lines };
}

main().catch((e) => { console.error('enduser-roledata-sepolia: failed', process.env.DEBUG_EVIDENCE ? e : ''); process.exitCode = 1; });
