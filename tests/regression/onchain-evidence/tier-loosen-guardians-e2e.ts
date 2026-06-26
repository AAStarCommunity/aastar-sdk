/**
 * On-chain E2E (#188 / #176 phase 5): RAISE tier limits via guardian co-signatures.
 *
 * Proves the full guardian-loosening path against the LIVE airaccount-contract v0.20.1 on Sepolia
 * (the deployment that added the tierLimitNonce() getter — #132):
 *   1. Deploy a fresh AirAccount via the v0.20.1 factory with 2 ECDSA guardians (owner=JASON).
 *   2. setTierLimits(low) as the owner EOA (onlyOwner = msg.sender==owner; initializes the tiers).
 *   3. Read tierLimitNonce() + build the guardian digest with the SDK (modifyTierLimitsGuardianDigest-
 *      FromChain) — the #188 enablement.
 *   4. Two guardians sign the digest (EIP-191 raw; the contract recovers via toEthSignedMessageHash).
 *   5. owner calls modifyTierLimitsWithGuardians(high, high, deadline, [sig1, sig2]).
 *   6. Verify tier1Limit/tier2Limit are now the RAISED values on-chain.
 *
 * Env: .env.sepolia (SEPOLIA_RPC_URL, PRIVATE_KEY_JASON owner, PRIVATE_KEY_ANNI/BOB guardians).
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.sepolia' });
import { createPublicClient, createWalletClient, http, parseEther, getAddress, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { AAStarAirAccountV7ABI, AAStarAirAccountFactoryV7ABI, buildInitConfig, getCanonicalAddresses } from '../../../packages/core/src/index.js';
import { modifyTierLimitsGuardianDigest, modifyTierLimitsGuardianDigestFromChain } from '../../../packages/airaccount/src/core/tier/profile.js';

const RPC = process.env.SEPOLIA_RPC_URL!;
const pk = (k: string) => (k.startsWith('0x') ? k : `0x${k}`) as `0x${string}`;
const owner = privateKeyToAccount(pk(process.env.PRIVATE_KEY_JASON!));
const g1 = privateKeyToAccount(pk(process.env.PRIVATE_KEY_ANNI!));
const g2 = privateKeyToAccount(pk(process.env.PRIVATE_KEY_BOB!));

const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
const wallet = createWalletClient({ account: owner, chain: sepolia, transport: http(RPC) });
const FACTORY = getAddress(getCanonicalAddresses(11155111).airAccountFactoryV7 as string);

const read = (account: Address, functionName: string, args: readonly unknown[] = []) =>
  pub.readContract({ address: account, abi: AAStarAirAccountV7ABI as never, functionName, args });
const send = async (to: Address, functionName: string, args: readonly unknown[], abi: unknown = AAStarAirAccountV7ABI) => {
  const hash = await wallet.writeContract({ address: to, abi: abi as never, functionName, args, account: owner, chain: sepolia });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== 'success') throw new Error(`${functionName} reverted: ${hash}`);
  return hash;
};

async function main() {
  console.log(`owner(JASON)=${owner.address}  guardians=[ANNI ${g1.address}, BOB ${g2.address}]`);
  console.log(`factory(v0.20.1)=${FACTORY}`);

  // 1. Fresh account with 2 ECDSA guardians (unique salt → clean state each run).
  const salt = BigInt(Date.now());
  const config = buildInitConfig({
    guardians: [{ ecdsa: g1.address }, { ecdsa: g2.address }],
    dailyLimit: parseEther('10'),
    minDailyLimit: parseEther('0.1'),
    approvedAlgIds: [0x02, 0x03], // ECDSA + P256 (never BLS in defaults)
  });
  const account = getAddress((await pub.readContract({
    address: FACTORY, abi: AAStarAirAccountFactoryV7ABI as never, functionName: 'getAddress', args: [owner.address, salt, config],
  })) as string);
  console.log(`\n1) predicted account=${account} (salt=${salt})`);
  await send(FACTORY, 'createAccount', [owner.address, salt, config], AAStarAirAccountFactoryV7ABI);
  const gc = Number(await read(account, 'guardianCount'));
  const gAddrs = [await read(account, 'guardians', [0n]), await read(account, 'guardians', [1n])];
  console.log(`   deployed; guardianCount=${gc}; guardians=${JSON.stringify(gAddrs)}`);
  if (gc < 2) throw new Error(`expected 2 guardians, got ${gc}`);

  // 2. setTierLimits(low) — owner EOA direct call (initializes tiers).
  const LOW1 = parseEther('0.01'), LOW2 = parseEther('0.1');
  await send(account, 'setTierLimits', [LOW1, LOW2]);
  console.log(`\n2) setTierLimits(low) → tier1=${await read(account, 'tier1Limit')} tier2=${await read(account, 'tier2Limit')}`);

  // 3. Read nonce + build the guardian digest with the SDK (the #188 path).
  const HIGH1 = parseEther('1'), HIGH2 = parseEther('5');
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const nonceOnChain = (await read(account, 'tierLimitNonce')) as bigint;
  const digest = await modifyTierLimitsGuardianDigestFromChain({
    client: pub as never, account, chainId: 11155111n, tier1Limit: HIGH1, tier2Limit: HIGH2, deadline,
  });
  // cross-check the from-chain helper == the pure builder with the read nonce
  const pureDigest = modifyTierLimitsGuardianDigest({ chainId: 11155111n, account, tierLimitNonce: nonceOnChain, tier1Limit: HIGH1, tier2Limit: HIGH2, deadline });
  console.log(`\n3) tierLimitNonce=${nonceOnChain}; SDK digest=${digest} (matches pure builder: ${digest === pureDigest})`);
  if (digest !== pureDigest) throw new Error('FromChain digest != pure builder');

  // 4. Two guardians sign the digest (EIP-191 raw — contract recovers via toEthSignedMessageHash).
  const sig1 = await g1.signMessage({ message: { raw: digest } });
  const sig2 = await g2.signMessage({ message: { raw: digest } });
  console.log(`\n4) guardian sigs collected (ANNI + BOB)`);

  // 5. owner RAISES the limits with the guardian co-signatures.
  const raiseTx = await send(account, 'modifyTierLimitsWithGuardians', [HIGH1, HIGH2, deadline, [sig1, sig2]]);
  console.log(`\n5) modifyTierLimitsWithGuardians tx=${raiseTx}`);

  // 6. Verify on-chain.
  const [newT1, newT2, newNonce] = [await read(account, 'tier1Limit'), await read(account, 'tier2Limit'), await read(account, 'tierLimitNonce')];
  console.log(`\n6) RAISED → tier1=${newT1} tier2=${newT2}; nonce ${nonceOnChain}→${newNonce}`);
  if (BigInt(newT1 as bigint) !== HIGH1 || BigInt(newT2 as bigint) !== HIGH2) throw new Error('tier limits not raised as expected');
  if (BigInt(newNonce as bigint) !== nonceOnChain + 1n) throw new Error('nonce not bumped');
  console.log(`\n✅ E2E PASS — guardian-cosigned tier-limit RAISE verified on live Sepolia v0.20.1. account=${account} tx=${raiseTx}`);
}

main().catch((e) => { console.error('❌ E2E FAIL:', e.shortMessage || e.message); process.exit(1); });
