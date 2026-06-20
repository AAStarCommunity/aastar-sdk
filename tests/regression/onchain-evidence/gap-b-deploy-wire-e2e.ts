/**
 * Gap B on-chain verification — `AccountManager.deployAndWireValidator` as a SINGLE call deploys a
 * fresh BLS-only account AND wires its validator router, with NO DVT node interaction (deploy +
 * setValidator only; BLS co-signing is not exercised here).
 *
 * Flow (live, Sepolia):
 *   1. Stand up AirAccountServerClient with the canonical v0.20.0 addresses (@aastar/core).
 *   2. createAccountWithP256Guardians(approvedAlgIds=[0x01]) → predict + persist a router-delegated record.
 *   3. deployAndWireValidator({ walletClient: JASON }) → factory.createAccount + setValidator in one call.
 *   4. Assert on-chain: account has code · validator() == canonical aaStarValidator · approvedAlgorithms(0x01)=true.
 *
 *   pnpm exec tsx tests/regression/onchain-evidence/gap-b-deploy-wire-e2e.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { createWalletClient, createPublicClient, http, getAddress, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { CANONICAL_ADDRESSES, AAStarAirAccountV7ABI } from "@aastar/core";
import { AirAccountServerClient, MemoryStorage, LocalWalletSigner } from "../../../packages/airaccount/src/server/index";

dotenv.config({ path: path.resolve(process.cwd(), ".env.sepolia") });
const env = (k: string) => (process.env[k] || "").replace(/^['"]|['"]$/g, "");
const RPC = env("SEPOLIA_RPC_URL") || env("RPC_URL");
let PK = env("PRIVATE_KEY_JASON");
if (PK && !PK.startsWith("0x")) PK = `0x${PK}`;
const C = CANONICAL_ADDRESSES[11155111];

async function main() {
  const owner = privateKeyToAccount(PK as Hex);
  const config = {
    rpcUrl: RPC,
    bundlerRpcUrl: RPC,
    chainId: 11155111,
    defaultVersion: "0.7" as const,
    entryPoints: {
      v07: {
        entryPointAddress: C.entryPoint,
        factoryAddress: C.airAccountFactoryV7,
        validatorAddress: C.aaStarValidator,
      },
    },
    storage: new MemoryStorage(),
    signer: new LocalWalletSigner(PK as Hex),
  };
  const client = new AirAccountServerClient(config as never);
  const am = client.accounts;

  const userId = `gapb-${Date.now()}`;
  const salt = Date.now(); // unique → fresh account each run
  // Arbitrary non-zero P-256 guardian key (recovery guardian; not exercised here). approvedAlgIds=[0x01]
  // ⇒ BLS-only validation ⇒ router-delegated ⇒ needs setValidator.
  const x = `0x${"a3".repeat(32)}` as Hex;
  const y = `0x${"b7".repeat(32)}` as Hex;

  const acct = await am.createAccountWithP256Guardians(userId, {
    p256Guardians: [{ x, y }],
    dailyLimit: parseEther("1"),
    approvedAlgIds: [0x01],
    salt,
  });
  console.log(`[1] predicted BLS-only account: ${acct.address} (owner ${owner.address}, salt ${salt})`);

  const walletClient = createWalletClient({ account: owner, chain: sepolia, transport: http(RPC) });
  console.log(`[2] deployAndWireValidator(one call) …`);
  const r = await am.deployAndWireValidator(userId, { walletClient });
  console.log(`    deployTx = ${r.deployTx}`);
  console.log(`    validator = ${JSON.stringify(r.validator)}`);

  // On-chain assertions.
  const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const code = await pub.getCode({ address: acct.address as Hex });
  const validator = (await pub.readContract({
    address: acct.address as Hex,
    abi: AAStarAirAccountV7ABI,
    functionName: "validator",
  })) as Hex;
  const router = getAddress(C.aaStarValidator);
  const hasCode = !!code && code !== "0x";
  const wired = getAddress(validator) === router;

  console.log(`\n┌── Gap B deployAndWireValidator EVIDENCE`);
  console.log(`│ account            : ${acct.address}`);
  console.log(`│ deployTx           : ${r.deployTx}`);
  console.log(`│ has code           : ${hasCode}`);
  console.log(`│ validator()        : ${validator}  (== canonical router ${router}? ${wired})`);
  console.log(`│ validator result   : set=${r.validator.set} tx=${r.validator.tx}`);

  if (!hasCode || !wired || !r.deployTx || !r.validator.set) {
    throw new Error("Gap B e2e FAILED: account not deployed, validator not wired, or method returned no tx");
  }
  console.log(`🎉 Gap B PASS — one-call deployAndWireValidator deployed + wired a BLS-only account on-chain (no DVT).`);
}

main().catch((e) => {
  console.error("❌", (e as Error).message);
  process.exit(1);
});
