/**
 * AirAccount v0.20.2 module-governance ON-CHAIN E2E (Sepolia, #209 acceptance).
 *
 * Proves the SDK's new mixed-sig install/uninstall encoding is accepted by the live
 * deployed AirAccountExtension — the breaking encoding rewritten in PR #210:
 *   install:   abi.encode(uint8[] signerIdxs, bytes[] sigs, bytes moduleInitData)  (sigsRequired=1)
 *   uninstall: abi.encode(uint8[] signerIdxs, bytes[] sigs)                         (sigsRequired=2)
 *   digest:    keccak256(abi.encode(GUARDIAN_SIG_VERSION=4, chainId, account, opLabel, opData))
 *              folding the on-chain moduleManagementNonce() (#75), signed personal_sign by guardians.
 *
 * Flow (Anni = owner, Bob = guardian slot 0, Charlie = guardian slot 1; all .env.sepolia EOAs):
 *   1. factory.createAccountWithDefaults → deploy a guardianed v0.20.2 account (Anni pays gas)
 *   2. installModule(ForceExitModule, EXECUTOR) with 1 guardian sig (Bob)  → isModuleInstalled==true
 *   3. uninstallModule with 2 guardian sigs (Bob+Charlie)                   → isModuleInstalled==false
 *
 * ForceExitModule.onInstall("0x") only checks the account has a guardian at slot 0, so it
 * succeeds cleanly — isolating the guardian-sig encoding as the thing under test.
 *
 * Run: pnpm exec tsx tests/regression/onchain-evidence/v0202-module-install-e2e.ts
 */
import {
  createPublicClient, createWalletClient, http, parseAbi, parseEther,
  encodePacked, keccak256, formatEther, type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import * as dotenv from "dotenv";
import * as path from "node:path";
import {
  ModuleManager, buildInstallModuleHash, buildUninstallModuleHash,
} from "../../../packages/airaccount/src/server/services/module-manager.ts";

dotenv.config({ path: path.resolve(process.cwd(), ".env.sepolia") });

const CHAIN_ID = 11155111;
const FACTORY = "0xe9ea2D29F2De1be80BEdb8A284ad4f98e6dAb6a1" as Address; // airAccountFactoryV7 v0.20.2
const FORCE_EXIT = "0x3fDe77868b74a7979A40a2293a1CD265fbe66EEc" as Address; // ForceExitModule (EXECUTOR)
const EXECUTOR = 2 as const;
const DAILY_LIMIT = parseEther("0.01");

const norm = (k?: string) => (k ? (k.startsWith("0x") ? k : `0x${k}`) : k) as Hex;
const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

const FACTORY_ABI = parseAbi([
  "function createAccountWithDefaults(address owner, uint256 salt, address guardian1, bytes guardian1Sig, address guardian2, bytes guardian2Sig, uint256 dailyLimit) returns (address)",
  "function getAddressWithDefaults(address owner, uint256 salt, address g1, address g2, uint256 dailyLimit) view returns (address)",
]);
const ACCOUNT_ABI = parseAbi([
  "function owner() view returns (address)",
  "function guardians(uint256) view returns (address)",
  "function moduleManagementNonce() view returns (uint256)",
  "function isModuleInstalled(uint256 moduleTypeId, address module, bytes additionalContext) view returns (bool)",
]);

async function main() {
  const anni = privateKeyToAccount(norm(process.env.PRIVATE_KEY_ANNI)!);
  const bob = privateKeyToAccount(norm(process.env.PRIVATE_KEY_BOB)!);
  const charlie = privateKeyToAccount(norm(process.env.PRIVATE_KEY_CHARLIE)!);

  const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const wallet = createWalletClient({ account: anni, chain: sepolia, transport: http(RPC) });
  const mm = new ModuleManager(pub as never, CHAIN_ID);
  const evidence: Record<string, string> = {};

  console.log(`\n🔧 v0.20.2 module-governance E2E (Sepolia)`);
  console.log(`   owner(Anni)=${anni.address}  g0(Bob)=${bob.address}  g1(Charlie)=${charlie.address}`);
  console.log(`   Anni ETH: ${formatEther(await pub.getBalance({ address: anni.address }))}`);

  // ── 1. Deploy a guardianed v0.20.2 account ─────────────────────────────────
  const salt = BigInt(Math.floor(Date.now()));
  const predicted = await pub.readContract({
    address: FACTORY, abi: FACTORY_ABI, functionName: "getAddressWithDefaults",
    args: [anni.address, salt, bob.address, charlie.address, DAILY_LIMIT],
  }) as Address;
  console.log(`\n[1] deploy account (salt=${salt}) → predicted ${predicted}`);

  // ACCEPT_GUARDIAN: keccak256(abi.encodePacked("ACCEPT_GUARDIAN", chainId, factory, owner, salt, dailyLimit)).toEthSignedMessageHash()
  const acceptInner = keccak256(encodePacked(
    ["string", "uint256", "address", "address", "uint256", "uint256"],
    ["ACCEPT_GUARDIAN", BigInt(CHAIN_ID), FACTORY, anni.address, salt, DAILY_LIMIT],
  ));
  const bobAccept = await bob.signMessage({ message: { raw: acceptInner } });
  const charlieAccept = await charlie.signMessage({ message: { raw: acceptInner } });

  const deployTx = await wallet.writeContract({
    address: FACTORY, abi: FACTORY_ABI, functionName: "createAccountWithDefaults",
    args: [anni.address, salt, bob.address, bobAccept, charlie.address, charlieAccept, DAILY_LIMIT],
  });
  await pub.waitForTransactionReceipt({ hash: deployTx });
  evidence.deploy = deployTx;
  const account = predicted;
  const [owner, g0, g1, nonce0] = await Promise.all([
    pub.readContract({ address: account, abi: ACCOUNT_ABI, functionName: "owner" }),
    pub.readContract({ address: account, abi: ACCOUNT_ABI, functionName: "guardians", args: [0n] }),
    pub.readContract({ address: account, abi: ACCOUNT_ABI, functionName: "guardians", args: [1n] }),
    pub.readContract({ address: account, abi: ACCOUNT_ABI, functionName: "moduleManagementNonce" }),
  ]);
  console.log(`    ✅ deployed ${account}  tx ${deployTx}`);
  console.log(`       owner=${owner} g0=${g0} g1=${g1} nonce=${nonce0}`);
  if (owner !== anni.address || g0 !== bob.address || g1 !== charlie.address) throw new Error("account setup mismatch");

  // ── 2. installModule (sigsRequired=1: Bob, slot 0) ────────────────────────
  const nInstall = await mm.readModuleNonce(account);
  const installDigest = buildInstallModuleHash(CHAIN_ID, account, EXECUTOR, FORCE_EXIT, nInstall, "0x");
  const bobInstallSig = await bob.signMessage({ message: { raw: installDigest as Hex } });
  const installData = mm.encodeInstall({
    account, moduleTypeId: EXECUTOR, module: FORCE_EXIT,
    signerIdxs: [0], guardianSigs: [bobInstallSig], moduleInitData: "0x",
  }) as Hex;
  console.log(`\n[2] installModule(ForceExit, EXECUTOR) nonce=${nInstall} sig=Bob(slot0)`);
  await pub.call({ account: anni.address, to: account, data: installData }); // simulate (throws on revert)
  const installTx = await wallet.sendTransaction({ to: account, data: installData });
  await pub.waitForTransactionReceipt({ hash: installTx });
  evidence.install = installTx;
  const installed = await pub.readContract({ address: account, abi: ACCOUNT_ABI, functionName: "isModuleInstalled", args: [BigInt(EXECUTOR), FORCE_EXIT, "0x"] });
  console.log(`    ✅ installed=${installed}  tx ${installTx}`);
  if (installed !== true) throw new Error("installModule did not register the module");

  // ── 3. uninstallModule (sigsRequired=2: Bob slot0 + Charlie slot1) ─────────
  const nUninstall = await mm.readModuleNonce(account);
  const uninstallDigest = buildUninstallModuleHash(CHAIN_ID, account, EXECUTOR, FORCE_EXIT, nUninstall);
  const bobU = await bob.signMessage({ message: { raw: uninstallDigest as Hex } });
  const charlieU = await charlie.signMessage({ message: { raw: uninstallDigest as Hex } });
  const uninstallData = mm.encodeUninstall({
    account, moduleTypeId: EXECUTOR, module: FORCE_EXIT,
    signerIdxs: [0, 1], guardianSigs: [bobU, charlieU],
  }) as Hex;
  console.log(`\n[3] uninstallModule nonce=${nUninstall} sigs=Bob(0)+Charlie(1)`);
  await pub.call({ account: anni.address, to: account, data: uninstallData });
  const uninstallTx = await wallet.sendTransaction({ to: account, data: uninstallData });
  await pub.waitForTransactionReceipt({ hash: uninstallTx });
  evidence.uninstall = uninstallTx;
  const stillInstalled = await pub.readContract({ address: account, abi: ACCOUNT_ABI, functionName: "isModuleInstalled", args: [BigInt(EXECUTOR), FORCE_EXIT, "0x"] });
  console.log(`    ✅ installed=${stillInstalled} (expect false)  tx ${uninstallTx}`);
  if (stillInstalled !== false) throw new Error("uninstallModule did not remove the module");

  console.log(`\n🎉 v0.20.2 module-governance E2E PASSED — account ${account}`);
  console.log(`   deploy:    https://sepolia.etherscan.io/tx/${evidence.deploy}`);
  console.log(`   install:   https://sepolia.etherscan.io/tx/${evidence.install}`);
  console.log(`   uninstall: https://sepolia.etherscan.io/tx/${evidence.uninstall}`);
}

main().catch((e) => { console.error("❌ E2E FAILED:", e); process.exit(1); });
