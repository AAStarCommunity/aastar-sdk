/**
 * L4 beta.4 bundler-compat E2E (self-funded).
 *
 * Proves the v0.17.2-beta.4 fix end-to-end on live Sepolia: a GUARD-enabled AirAccount
 * routes a UserOp through `executeUserOp` (callData wrapped with the executeUserOp selector)
 * so the account re-derives the signature algId in-frame — which previously made guard
 * accounts fail bundler gas estimation with AlgorithmNotApproved(0).
 *
 * Self-funded: the account pays its own gas (no paymaster). Run:
 *   pnpm tsx tests/regression/l4-beta4-gasless.ts
 * Requires .env.sepolia with SEPOLIA_RPC_URL, a Pimlico bundler URL, and a funded EOA key.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
    createPublicClient, createWalletClient, http, parseEther, formatEther,
    encodeFunctionData, concat, getContract, type Address, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { UserOperationBuilder } from '../../packages/sdk/src/index.js';
import { wrapExecuteUserOp } from '../../packages/airaccount/src/server/utils/execute-user-op.js';
import { CANONICAL_ADDRESSES } from '../../packages/core/src/addresses.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

// ── Sepolia addresses (v0.20.0 canonical — single source of truth in @aastar/core) ──
const FACTORY: Address = CANONICAL_ADDRESSES[11155111].airAccountFactoryV7 as Address;
const ENTRY_POINT: Address = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; // EntryPoint v0.7
const ALG_ECDSA = 2;
// v0.20.0 (#120): InitConfig guardianP256X/Y (bytes32[3]) — zero for ECDSA-only accounts.
const ZERO32 = `0x${'00'.repeat(32)}` as Hex;

const FACTORY_ABI = [
    { type: 'function', name: 'getAddress', stateMutability: 'view',
      inputs: [{ name: 'owner', type: 'address' }, { name: 'salt', type: 'uint256' },
        { name: 'config', type: 'tuple', components: [
          { name: 'guardians', type: 'address[3]' },
          { name: 'guardianP256X', type: 'bytes32[3]' }, { name: 'guardianP256Y', type: 'bytes32[3]' },
          { name: 'dailyLimit', type: 'uint256' },
          { name: 'approvedAlgIds', type: 'uint8[]' }, { name: 'minDailyLimit', type: 'uint256' },
          { name: 'initialTokens', type: 'address[]' },
          { name: 'initialTokenConfigs', type: 'tuple[]', components: [
            { name: 'tier1Limit', type: 'uint128' }, { name: 'tier2Limit', type: 'uint128' }, { name: 'dailyLimit', type: 'uint256' }] }] }],
      outputs: [{ type: 'address' }] },
    { type: 'function', name: 'createAccount', stateMutability: 'nonpayable',
      inputs: [{ name: 'owner', type: 'address' }, { name: 'salt', type: 'uint256' },
        { name: 'config', type: 'tuple', components: [
          { name: 'guardians', type: 'address[3]' },
          { name: 'guardianP256X', type: 'bytes32[3]' }, { name: 'guardianP256Y', type: 'bytes32[3]' },
          { name: 'dailyLimit', type: 'uint256' },
          { name: 'approvedAlgIds', type: 'uint8[]' }, { name: 'minDailyLimit', type: 'uint256' },
          { name: 'initialTokens', type: 'address[]' },
          { name: 'initialTokenConfigs', type: 'tuple[]', components: [
            { name: 'tier1Limit', type: 'uint128' }, { name: 'tier2Limit', type: 'uint128' }, { name: 'dailyLimit', type: 'uint256' }] }] },
        // v0.22.0: createAccount gained ownerP256X/Y + nonce/deadline/ownerSig (passkey + relay support).
        { name: 'ownerP256X', type: 'bytes32' }, { name: 'ownerP256Y', type: 'bytes32' },
        { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'ownerSig', type: 'bytes' }],
      outputs: [{ type: 'address' }] },
] as const;

const ACCOUNT_ABI = [
    { type: 'function', name: 'execute', stateMutability: 'nonpayable',
      inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'func', type: 'bytes' }], outputs: [] },
] as const;

const EP_ABI = [
    { type: 'function', name: 'getNonce', stateMutability: 'view',
      inputs: [{ name: 'sender', type: 'address' }, { name: 'key', type: 'uint192' }], outputs: [{ type: 'uint256' }] },
] as const;

async function main() {
    const rpc = (process.env.SEPOLIA_RPC_URL || process.env.RPC_URL)!.replace(/^['"]|['"]$/g, '');
    const bundlerUrl = (process.env.PIMLICO_BUNDLER_URL || process.env.PIMLICO_RPC_URL || process.env.BUNDLER_URL)!.replace(/^['"]|['"]$/g, '');
    const pk = (process.env.PRIVATE_KEY_JASON || process.env.TEST_PRIVATE_KEY || process.env.PRIVATE_KEY)!.replace(/^['"]|['"]$/g, '') as Hex;
    const owner = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));

    console.log('🧪 beta.4 bundler-compat gasless E2E (self-funded)');
    console.log(`   Owner EOA: ${owner.address}`);

    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc) });
    const walletClient = createWalletClient({ account: owner, chain: sepolia, transport: http(rpc) });
    const bundler = createPublicClient({ chain: sepolia, transport: http(bundlerUrl) });

    // GUARD-enabled config: dailyLimit > 0 + ECDSA whitelisted → exercises the executeUserOp path.
    const config = {
        guardians: ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000'] as readonly [Address, Address, Address],
        guardianP256X: [ZERO32, ZERO32, ZERO32] as readonly [Hex, Hex, Hex],
        guardianP256Y: [ZERO32, ZERO32, ZERO32] as readonly [Hex, Hex, Hex],
        dailyLimit: parseEther('1'),
        approvedAlgIds: [ALG_ECDSA] as readonly number[],
        minDailyLimit: 0n,
        initialTokens: [] as readonly Address[],
        initialTokenConfigs: [] as readonly { tier1Limit: bigint; tier2Limit: bigint; dailyLimit: bigint }[],
    };
    const salt = BigInt(Math.floor(Date.now() / 1000)); // unique-ish per run (stamped at runtime)

    const factory = getContract({ address: FACTORY, abi: FACTORY_ABI, client: publicClient });
    const sender = await factory.read.getAddress([owner.address, salt, config as any]) as Address;
    console.log(`   Predicted account: ${sender}`);

    // 1. Deploy the account directly via the owner EOA (separates deploy from the UserOp).
    const deployedCode = await publicClient.getBytecode({ address: sender });
    if (!deployedCode || deployedCode === '0x') {
        console.log('   Deploying beta.4 account via factory.createAccount...');
        const Z32 = `0x${'00'.repeat(32)}` as `0x${string}`; // no passkey; direct mode (ownerSig "0x")
        const deployData = encodeFunctionData({ abi: FACTORY_ABI, functionName: 'createAccount', args: [owner.address, salt, config as any, Z32, Z32, 0n, 0n, '0x'] });
        const txHash = await walletClient.sendTransaction({ to: FACTORY, data: deployData });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log(`   ✅ Account deployed (tx ${txHash})`);
    } else {
        console.log('   Account already deployed.');
    }

    // 2. Fund the account so it can self-pay gas (missingAccountFunds during validation).
    const bal = await publicClient.getBalance({ address: sender });
    if (bal < parseEther('0.003')) {
        console.log('   Funding account with 0.005 ETH for self-paid gas...');
        const fundHash = await walletClient.sendTransaction({ to: sender, value: parseEther('0.005') });
        await publicClient.waitForTransactionReceipt({ hash: fundHash });
    }
    console.log(`   Account balance: ${formatEther(await publicClient.getBalance({ address: sender }))} ETH`);

    // 3. Build callData: executeUserOp-wrapped execute(owner, 0, 0x) — a trivial self-call.
    const inner = encodeFunctionData({ abi: ACCOUNT_ABI, functionName: 'execute', args: [owner.address, 0n, '0x'] });
    const callData = wrapExecuteUserOp(inner) as Hex;
    console.log(`   callData (executeUserOp-wrapped): ${callData.slice(0, 10)}...`);

    // 4. Build the v0.7 PackedUserOperation.
    const ep = getContract({ address: ENTRY_POINT, abi: EP_ABI, client: publicClient });
    const nonce = await ep.read.getNonce([sender, 0n]) as bigint;
    const gasPrice = await (bundler as any).request({ method: 'pimlico_getUserOperationGasPrice', params: [] }).catch(() => null);
    const maxFeePerGas = gasPrice ? BigInt(gasPrice.fast.maxFeePerGas) : parseEther('0.000000003');
    const maxPriorityFeePerGas = gasPrice ? BigInt(gasPrice.fast.maxPriorityFeePerGas) : parseEther('0.000000002');

    const userOp: any = {
        sender, nonce, initCode: '0x' as Hex, callData,
        accountGasLimits: UserOperationBuilder.packAccountGasLimits(300000n, 200000n),
        preVerificationGas: 100000n,
        gasFees: UserOperationBuilder.packGasFees(maxPriorityFeePerGas, maxFeePerGas),
        paymasterAndData: '0x' as Hex,
        signature: ('0x' + 'fa'.repeat(65)) as Hex, // dummy for hashing/estimation
    };

    const dumpRpcErr = (label: string, e: any) => {
        console.error(`   ↳ ${label} error:`, e?.shortMessage || e?.message);
        if (e?.details) console.error('     details:', e.details);
        if (e?.cause?.message) console.error('     cause:', e.cause.message);
        if (e?.metaMessages) console.error('     meta:', e.metaMessages.join(' | '));
        const data = e?.cause?.data || e?.data || e?.cause?.cause?.data;
        if (data) console.error('     revert data:', data);
    };

    // 4b. Gas estimation via bundler (with a dummy sig). This is the step the beta.4 fix
    // unblocks for guard accounts (previously reverted AlgorithmNotApproved(0)).
    const userOpHash0 = await UserOperationBuilder.getUserOpHash({ userOp, entryPoint: ENTRY_POINT, chainId: sepolia.id, publicClient });
    userOp.signature = await owner.signMessage({ message: { raw: userOpHash0 } });
    try {
        const est = await (bundler as any).request({ method: 'eth_estimateUserOperationGas', params: [UserOperationBuilder.toAlchemyUserOperation(userOp), ENTRY_POINT] });
        console.log(`   ✅ Gas estimation succeeded: ${JSON.stringify(est)}`);
        userOp.accountGasLimits = UserOperationBuilder.packAccountGasLimits(BigInt(est.verificationGasLimit), BigInt(est.callGasLimit));
        userOp.preVerificationGas = BigInt(est.preVerificationGas);
    } catch (e: any) {
        dumpRpcErr('eth_estimateUserOperationGas', e);
        throw new Error('gas estimation failed (this is the beta.4 bundler-compat path)');
    }

    // 5. Re-sign over the final (post-estimation) UserOp — raw 65-byte ECDSA, no algId prefix (beta.4).
    const userOpHash = await UserOperationBuilder.getUserOpHash({ userOp, entryPoint: ENTRY_POINT, chainId: sepolia.id, publicClient });
    userOp.signature = await owner.signMessage({ message: { raw: userOpHash } });
    console.log(`   userOpHash: ${userOpHash}`);

    // 6. Submit via the bundler.
    const alchemyOp = UserOperationBuilder.toAlchemyUserOperation(userOp);
    console.log('   Submitting UserOp to bundler...');
    const opHash = await (bundler as any).request({ method: 'eth_sendUserOperation', params: [alchemyOp, ENTRY_POINT] }).catch((e: any) => { dumpRpcErr('eth_sendUserOperation', e); throw e; });
    console.log(`   ✅ UserOp accepted: ${opHash}`);

    // 7. Wait for the receipt.
    let receipt: any = null;
    for (let i = 0; i < 30; i++) {
        receipt = await (bundler as any).request({ method: 'eth_getUserOperationReceipt', params: [opHash] }).catch(() => null);
        if (receipt) break;
        await new Promise((r) => setTimeout(r, 3000));
    }
    if (!receipt) throw new Error('UserOp receipt timeout');
    const ok = receipt.success === true || receipt.success === 'true';
    console.log(`   Receipt: success=${receipt.success} tx=${receipt.receipt?.transactionHash}`);
    if (!ok) throw new Error(`UserOp executed but success=false (tx ${receipt.receipt?.transactionHash})`);
    console.log('\n✅ beta.4 executeUserOp gasless E2E PASSED — guard account UserOp landed via bundler.');
}

main().catch((e) => { console.error('\n❌ beta.4 E2E FAILED:', e?.shortMessage || e?.message || e); process.exit(1); });
