/**
 * Codified on-chain evidence verifier for an upstream sync (RELEASE-CHECKLIST §4).
 *
 * `status=0x1` does NOT prove the SDK encoded correctly — a factory can tolerate a malformed
 * config and still deploy. This DECODES the real tx and asserts the integration is correct:
 *   1. createAccount tx.to == the canonical factory                        (right contract)
 *   2. createAccount calldata decodes against the NEW factory ABI and the
 *      InitConfig tuple carries the expected fields (8: incl guardianP256X/Y) (right encoding)
 *   3. the deployed account == factory.getAddress(owner, salt, config)      (CREATE2 consistency)
 *   4. the recovery tx's RecoveryProposed log topic0 == the NEW event sig    (right event shape)
 *
 * Usage:
 *   pnpm exec tsx scripts/upstream/verify-onchain-evidence.ts \
 *     --deploy <createAccountTx> --account <addr> --recovery <proposeRecoveryTx>
 * Defaults to the v0.20.0 Sepolia recovery-E2E run. Reads RPC from .env.sepolia.
 */
import * as fs from "fs";
import * as path from "path";
import {
  createPublicClient, http, decodeFunctionData, getAddress, keccak256, toHex,
  type Address, type Hex,
} from "viem";
import { AAStarAirAccountFactoryV7ABI } from "../../packages/core/src/abis/index.js";
import { CANONICAL_ADDRESSES } from "../../packages/core/src/addresses.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// Defaults: the v0.20.0 Sepolia recovery-E2E run (salt 1781930442).
const DEPLOY_TX = arg("deploy", "0x39e5a39c8c9e541d7190fe7b936a8d8d53af1c5c99afab966451e9b5ce77f775") as Hex;
const ACCOUNT = arg("account", "0xa44805888d95Fd557b0B81612b08Dcf48ad807aE") as Address;
const RECOVERY_TX = arg("recovery", "0x5521880f37fa153a2deecf5d7defafb0bed1b980b83318575dd16acab40b43fe") as Hex;
const CHAIN_ID = Number(arg("chainId", "11155111"));

function rpcUrl(): string {
  const env = fs.readFileSync(path.resolve(process.cwd(), ".env.sepolia"), "utf8");
  const m = env.match(/^(?:SEPOLIA_RPC_URL|RPC_URL)=(.+)$/m);
  return (m?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
}

let failures = 0;
const ok = (c: boolean, msg: string) => { console.log(`${c ? "✅" : "❌"} ${msg}`); if (!c) failures++; };

async function main() {
  const client = createPublicClient({ transport: http(rpcUrl()) });
  const factory = getAddress(CANONICAL_ADDRESSES[CHAIN_ID as 11155111].airAccountFactoryV7);

  // ── createAccount: right contract + right encoding ──────────────────────────────
  const tx = await client.getTransaction({ hash: DEPLOY_TX });
  ok(getAddress(tx.to as Address) === factory, `createAccount tx.to == canonical factory ${factory}`);

  const decoded = decodeFunctionData({ abi: AAStarAirAccountFactoryV7ABI, data: tx.input });
  ok(decoded.functionName === "createAccount", `calldata decodes as createAccount (got ${decoded.functionName})`);
  const [owner, salt, config] = decoded.args as [Address, bigint, any];
  const fields = Object.keys(config);
  ok("guardianP256X" in config && "guardianP256Y" in config,
     `InitConfig carries guardianP256X/Y (8-field v0.20.0 shape) — fields: ${fields.join(",")}`);

  // ── CREATE2 consistency: deployed == predicted ──────────────────────────────────
  const predicted = await client.readContract({
    address: factory, abi: AAStarAirAccountFactoryV7ABI, functionName: "getAddress", args: [owner, salt, config],
  }) as Address;
  ok(getAddress(predicted) === getAddress(ACCOUNT),
     `deployed account == getAddress() prediction (${predicted})`);
  const code = await client.getCode({ address: ACCOUNT });
  ok(!!code && code !== "0x", `account has bytecode on-chain`);

  // ── recovery event: new topic0 (RecoveryProposed gained uint8 guardianIdx) ───────
  const rcpt = await client.getTransactionReceipt({ hash: RECOVERY_TX });
  const newTopic0 = keccak256(toHex("RecoveryProposed(address,address,uint8)"));
  const oldTopic0 = keccak256(toHex("RecoveryProposed(address,address)"));
  const topics = rcpt.logs.flatMap((l) => l.topics[0] ? [l.topics[0]] : []);
  ok(topics.includes(newTopic0), `RecoveryProposed log uses NEW topic0 (with guardianIdx)`);
  ok(!topics.includes(oldTopic0), `no log uses the OLD 2-arg RecoveryProposed topic0`);

  console.log(failures === 0
    ? "\n✅ On-chain evidence DECODE-verified — encoding/CREATE2/event all match the synced contracts."
    : `\n❌ ${failures} check(s) failed — evidence does NOT prove the sync.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("verifier error:", e?.shortMessage ?? e?.message ?? e); process.exit(2); });
