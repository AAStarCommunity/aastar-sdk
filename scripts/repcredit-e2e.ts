/**
 * RepCredit paper evidence orchestrator.
 *
 * Runs either a fresh Prague Anvil chain or an isolated Sepolia deployment and
 * the real cross-repository path:
 * YAAA structured BLS co-signing -> DVT -> Registry -> AirAccount UserOperation
 * -> EntryPoint -> SuperPaymaster -> xPNT burn or debt/automatic repayment.
 * Local mode also measures s={3,7,13} x B={1,10,50,100} x {Registry,DVT},
 * 10 times per cell from an identical EVM snapshot.
 *
 * This script never reads .env files. In Sepolia mode, the caller injects one
 * authorized experiment key and RPC URL through the process environment; both
 * are redacted from evidence output. Fresh validator keys are generated in a
 * temporary directory and deleted after their residual ETH is returned.
 */

import {
  AAStarAirAccountV7ABI,
  BLSAggregatorABI,
  DVTValidatorABI,
  EntryPointABI,
  GTokenABI,
  GTokenStakingABI,
  RegistryABI,
  SuperPaymasterABI,
  xPNTsTokenABI,
} from "@aastar/core";
// Experiment-only mocks. These deliberately do NOT come from @aastar/core: anything exported there
// ships in the published @aastar/sdk bundle and is drift-checked as a production interface (CC-50 B1/H2).
import { MockAgentIdentityRegistryABI, RepCreditCounterABI } from "./repcredit/abis/index.js";
import { verifyFixtures } from "./repcredit/sync-fixture-abis.js";
import { ExperimentSecrets, postSignedJson } from "./repcredit/experiment-auth.js";
import {
  assertHttpRejections,
  assertRevertedNotOutOfGas,
  expectCallRejected,
  expectViewRejected,
} from "./repcredit/negative-control.js";
import { bls12_381 } from "@noble/curves/bls12-381";
import {
  concat,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseEther,
  stringToHex,
  toHex,
  type Abi,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { performance } from "node:perf_hooks";
import { createServer } from "node:net";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const ZERO_BYTES32 = `0x${"00".repeat(32)}` as Hex;
const LOCAL_DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const DEFAULT_PORT = 18_547;
const DEFAULT_NODE_PORT = 29_301;
const ROLE_DVT = keccak256(stringToHex("DVT"));
const DVT_STAKE = parseEther("30");
const VALIDATOR_GT = parseEther("40");
let userOpMaxFeePerGas = 1_000_000_000n;
let userOpPriorityFeePerGas = 1_000_000_000n;

type Deployment = Record<string, Address>;
type AirDeployment = {
  version: string;
  contracts: {
    account: Address;
    counter: Address;
    factory: Address;
    implementation: Address;
  };
  transactions: Record<string, unknown>;
};
type Proposal = {
  schemaVersion: "repcredit-reputation-v1";
  proposalId: string;
  operator: Address;
  slashLevel: number;
  users: Address[];
  scores: string[];
  epoch: string;
  chainId: string;
  messageHash: Hex;
};
type SlashProposal = {
  schemaVersion: "repcredit-slash-v1";
  proposalId: string;
  operator: Address;
  slashLevel: number;
  epoch: string;
  chainId: string;
  evidenceHash: Hex;
  messageHash: Hex;
};
type CoSignResponse = {
  slot: number;
  signerNodeId: Hex;
  signerPublicKey: Hex;
  signatureCompact: Hex;
  messageHash: Hex;
};
type Aggregate = {
  signerMask: string;
  sigG2: Hex;
  signatureCompact: Hex;
  proof: Hex;
  messageHash: Hex;
  slots: number[];
};
type PackedUserOperation = {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex;
  preVerificationGas: bigint;
  gasFees: Hex;
  paymasterAndData: Hex;
  signature: Hex;
};

const sdkDir = resolve(import.meta.dirname, "..");
const worktreeRoot = resolve(process.env.REPCREDIT_WORKTREE_ROOT ?? join(sdkDir, ".."));
const superPaymasterDir = resolve(process.env.REPCREDIT_SUPERPAYMASTER_DIR ?? join(worktreeRoot, "SuperPaymaster"));
const yaaaDir = resolve(process.env.REPCREDIT_YAAA_DIR ?? join(worktreeRoot, "YetAnotherAA-Validator"));
const airDir = resolve(process.env.REPCREDIT_AIRACCOUNT_DIR ?? join(worktreeRoot, "airaccount-contract"));
const networkMode = process.env.REPCREDIT_NETWORK_MODE ?? "local";
if (!["local", "sepolia"].includes(networkMode)) throw new Error("REPCREDIT_NETWORK_MODE must be local or sepolia");
const isSepolia = networkMode === "sepolia";
const chainId = isSepolia ? 11_155_111 : 31_337;
const livePrivateKey = process.env.REPCREDIT_PRIVATE_KEY as Hex | undefined;
if (isSepolia && (!livePrivateKey || !/^0x[0-9a-fA-F]{64}$/.test(livePrivateKey))) {
  throw new Error("Sepolia mode requires REPCREDIT_PRIVATE_KEY as a 32-byte hex key");
}
const deployerAccount = privateKeyToAccount(isSepolia ? livePrivateKey! : LOCAL_DEPLOYER_KEY);
const DEPLOYER = deployerAccount.address;
const outputDirRaw = process.env.REPCREDIT_OUTPUT_DIR ?? "";
if (!outputDirRaw || !outputDirRaw.startsWith("/")) {
  throw new Error("REPCREDIT_OUTPUT_DIR must be a new absolute directory");
}
const outputDir = resolve(outputDirRaw);
if (existsSync(outputDir)) throw new Error(`refusing to overwrite existing output directory ${outputDir}`);
const rawDir = join(outputDir, "raw");
const derivedDir = join(outputDir, "derived");
const logDir = join(outputDir, "logs");
mkdirSync(rawDir, { recursive: true });
mkdirSync(derivedDir, { recursive: true });
mkdirSync(logDir, { recursive: true });

const port = Number(process.env.REPCREDIT_ANVIL_PORT ?? DEFAULT_PORT);
const nodePort = Number(process.env.REPCREDIT_NODE_PORT ?? DEFAULT_NODE_PORT);
const nodeCount = Number(process.env.REPCREDIT_NODE_COUNT ?? 13);
const skipMeasurements = process.env.REPCREDIT_SKIP_MEASUREMENTS === "true";
const measurementSmoke = process.env.REPCREDIT_MEASUREMENT_SMOKE === "true";
if (!Number.isInteger(port) || port < 1024 || port > 65_535) throw new Error("invalid Anvil port");
if (!Number.isInteger(nodePort) || nodePort < 1024 || nodePort + nodeCount > 65_535) throw new Error("invalid node port range");
if (![3, 13].includes(nodeCount)) throw new Error("REPCREDIT_NODE_COUNT must be 3 (smoke) or 13 (full)");
if (!skipMeasurements && nodeCount !== 13) throw new Error("full measurements require 13 nodes");
if (isSepolia && (!skipMeasurements || nodeCount !== 3)) {
  throw new Error("Sepolia evidence requires three nodes and REPCREDIT_SKIP_MEASUREMENTS=true");
}

const rpcUrl = isSepolia ? (process.env.REPCREDIT_RPC_URL ?? "") : `http://127.0.0.1:${port}`;
if (!rpcUrl) throw new Error("Sepolia mode requires REPCREDIT_RPC_URL");
const experimentChain = defineChain({
  id: chainId,
  name: isSepolia ? "RepCredit Sepolia Evidence" : "RepCredit Anvil Prague",
  nativeCurrency: isSepolia
    ? { name: "Sepolia Ether", symbol: "ETH", decimals: 18 }
    : { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});
const publicClient = createPublicClient({ chain: experimentChain, transport: http(rpcUrl) });
const deployerWallet = createWalletClient({ account: deployerAccount, chain: experimentChain, transport: http(rpcUrl) });
const children: ChildProcess[] = [];
/**
 * Per-node HMAC secrets for the YAAA experiment endpoints (CC-49 BLOCKER-1, synced from
 * YetAnotherAA-Validator 840bfdc). Minted here with the OS CSPRNG, handed to each node through
 * its ENVIRONMENT only — never argv, which `ps` exposes to every local user — and fed to the
 * evidence redactor so a secret cannot survive into the sealed artefacts.
 */
const experimentSecrets = new ExperimentSecrets();
/**
 * Address of the PRODUCTION (audit) BLSAggregator on the target chain, forwarded to every node so
 * it can refuse to co-sign with a key that is live there (CC-49 HIGH-A / MEDIUM-C). Never defaulted
 * here: guessing it is exactly the failure mode DVT closed.
 */
const auditBlsAggregatorAddress = process.env.REPCREDIT_AUDIT_BLS_AGGREGATOR_ADDRESS ?? "";
if (auditBlsAggregatorAddress && !isAddress(auditBlsAggregatorAddress)) {
  throw new Error("REPCREDIT_AUDIT_BLS_AGGREGATOR_ADDRESS must be a checksummed address");
}
const tempRoot = mkdtempSync(join(tmpdir(), "repcredit-e2e-"));
/**
 * Deployment config this run staged OUTSIDE the SDK, inside the SuperPaymaster checkout. It must be
 * removed on EVERY exit path (CC-50 M2): if it survives a failure, the next run can read stale
 * addresses whenever forge does not overwrite it, and the evidence then points at the wrong
 * deployment. Module-level so the top-level finally and the signal handlers can both reach it.
 */
let stagedDeploymentConfig: string | null = null;
const fraudVerifierAbi = [
  {
    type: "function",
    name: "evidenceHash",
    stateMutability: "pure",
    inputs: [
      { name: "disputedToken", type: "address" },
      { name: "operator", type: "address" },
      { name: "epoch", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "verify",
    stateMutability: "view",
    inputs: [
      { name: "fraudProofId", type: "uint256" },
      { name: "guiltyGuardians", type: "address[]" },
      { name: "fraudProof", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const satisfies Abi;

function safeEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: process.env.LANG ?? "C.UTF-8",
    ...extra,
  };
}

function assertRepo(path: string, marker: string): void {
  if (!existsSync(join(path, marker))) throw new Error(`repository marker missing: ${path}/${marker}`);
}

function runLogged(label: string, command: string, args: string[], cwd: string, env: Record<string, string> = {}): void {
  const logPath = join(logDir, `${label}.log`);
  const fd = openSync(logPath, "wx");
  try {
    const result = spawnSync(command, args, {
      cwd,
      env: safeEnv(env),
      stdio: ["ignore", fd, fd],
      timeout: 15 * 60_000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`${label} failed (${result.status}); inspect ${logPath}`);
    }
  } finally {
    closeSync(fd);
  }
}

function git(cwd: string, ...args: string[]): string {
  // safeEnv for the same reason every other child process gets it: git has no business inheriting
  // REPCREDIT_PRIVATE_KEY or the API-keyed RPC URL.
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env: safeEnv({}) });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}`);
  return result.stdout.trim();
}

function writeJsonExclusive(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, bigintReplacer, 2)}\n`, { flag: "wx" });
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

function appendJsonLine(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, bigintReplacer)}\n`, { flag: "a" });
}

function sha256(path: string): string {
  return createHash("sha256").update(new Uint8Array(readFileSync(path))).digest("hex");
}

function receiptRecord(receipt: TransactionReceipt) {
  return {
    transactionHash: receipt.transactionHash,
    blockHash: receipt.blockHash,
    blockNumber: receipt.blockNumber.toString(),
    status: receipt.status,
    gasUsed: receipt.gasUsed.toString(),
    effectiveGasPrice: receipt.effectiveGasPrice.toString(),
    logs: receipt.logs.map(log => ({ address: log.address, topics: (log as any).topics, data: log.data })),
  };
}

async function waitReceipt(hash: Hex, expected: "success" | "reverted" = "success"): Promise<TransactionReceipt> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== expected) throw new Error(`tx ${hash}: expected ${expected}, got ${receipt.status}`);
  return receipt;
}

async function sendContract(
  wallet: ReturnType<typeof createWalletClient>,
  address: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
): Promise<TransactionReceipt> {
  const hash = await (wallet as any).writeContract({ address, abi, functionName, args });
  return waitReceipt(hash);
}

async function sendExpectedRevert(
  wallet: ReturnType<typeof createWalletClient>,
  address: Address,
  data: Hex,
  label = "expected revert",
): Promise<TransactionReceipt> {
  const gas = isSepolia ? 4_000_000n : 8_000_000n;
  const hash = await (wallet as any).sendTransaction({ to: address, data, gas });
  const receipt = await waitReceipt(hash, "reverted");
  // `status: "reverted"` alone is not evidence: an out-of-gas transaction lands the same way.
  // Require that the revert refunded gas, i.e. a rule stopped it rather than the gas limit (CC-50).
  assertRevertedNotOutOfGas(label, { status: receipt.status, gasUsed: receipt.gasUsed }, gas);
  return receipt;
}

async function rpc(method: string, params: unknown[] = []): Promise<any> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }, bigintReplacer),
  });
  const json = await response.json() as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

async function snapshot(): Promise<string> {
  return String(await rpc("evm_snapshot"));
}

async function revertSnapshot(id: string): Promise<void> {
  if ((await rpc("evm_revert", [id])) !== true) throw new Error(`failed to revert snapshot ${id}`);
}

async function waitRpc(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      if (await publicClient.getChainId() === chainId) return;
    } catch { /* not ready */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  throw new Error(`Anvil did not start at ${rpcUrl}`);
}

async function assertPortAvailable(portToCheck: number): Promise<void> {
  await new Promise<void>((resolvePort, rejectPort) => {
    const server = createServer();
    server.once("error", () => rejectPort(new Error(`required local port ${portToCheck} is already in use`)));
    server.listen(portToCheck, "127.0.0.1", () => server.close(() => resolvePort()));
  });
}

async function waitNode(url: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    try {
      const response = await fetch(`${url}/node/info`);
      if (response.ok) return;
    } catch { /* not ready */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  throw new Error(`YAAA node did not start at ${url}`);
}

function loadDeployment(path: string): Deployment {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const required = [
    "entryPoint", "registry", "gToken", "staking", "superPaymaster", "aPNTs",
    "dvtValidator", "blsAggregator", "agentIdentityRegistry",
  ];
  const deployment: Deployment = {};
  for (const key of required) {
    if (!isAddress(parsed[key])) throw new Error(`SuperPaymaster deployment missing ${key}`);
    deployment[key] = getAddress(parsed[key]);
  }
  return deployment;
}

function g1Tuple(publicKeyHex: Hex) {
  const point = bls12_381.G1.ProjectivePoint.fromHex(publicKeyHex.replace(/^0x/, ""));
  const affine = point.toAffine();
  const x = affine.x.toString(16).padStart(128, "0");
  const y = affine.y.toString(16).padStart(128, "0");
  const word = (hex: string) => `0x${hex}` as Hex;
  return {
    x_a: word(x.slice(0, 64)),
    x_b: word(x.slice(64, 128)),
    y_a: word(y.slice(0, 64)),
    y_b: word(y.slice(64, 128)),
  };
}

function emptyG2() {
  return {
    x_c0_a: ZERO_BYTES32, x_c0_b: ZERO_BYTES32,
    x_c1_a: ZERO_BYTES32, x_c1_b: ZERO_BYTES32,
    y_c0_a: ZERO_BYTES32, y_c0_b: ZERO_BYTES32,
    y_c1_a: ZERO_BYTES32, y_c1_b: ZERO_BYTES32,
  };
}

const sepValidatorAccounts = new Map<number, PrivateKeyAccount>();

function validatorAccount(slot: number): PrivateKeyAccount {
  if (!isSepolia) return privateKeyToAccount(keccak256(stringToHex(`repcredit-local-validator-${slot}`)));
  const existing = sepValidatorAccounts.get(slot);
  if (existing) return existing;
  const created = privateKeyToAccount(toHex(Uint8Array.from(randomBytes(32))));
  sepValidatorAccounts.set(slot, created);
  return created;
}

function validatorWallet(account: PrivateKeyAccount) {
  return createWalletClient({ account, chain: experimentChain, transport: http(rpcUrl) });
}

async function setupValidators(deployment: Deployment, keyRoot: string): Promise<PrivateKeyAccount[]> {
  const validators: PrivateKeyAccount[] = [];
  const records: Record<string, unknown>[] = [];
  for (let slot = 1; slot <= nodeCount; slot++) {
    const account = validatorAccount(slot);
    const wallet = validatorWallet(account);
    validators.push(account);
    const funding = await waitReceipt(await (deployerWallet as any).sendTransaction({
      to: account.address,
      value: isSepolia ? parseEther("0.02") : parseEther("2"),
    }));
    const mint = await sendContract(deployerWallet, deployment.gToken, GTokenABI as Abi, "mint", [account.address, VALIDATOR_GT]);
    const approve = await sendContract(wallet, deployment.gToken, GTokenABI as Abi, "approve", [deployment.staking, VALIDATOR_GT]);
    const roleData = encodeAbiParameters([{ type: "uint256" }], [DVT_STAKE]);
    const registerRole = await sendContract(wallet, deployment.registry, RegistryABI as Abi, "registerRole", [ROLE_DVT, account.address, roleData]);
    const addValidator = await sendContract(deployerWallet, deployment.dvtValidator, DVTValidatorABI as Abi, "addValidator", [account.address]);
    const nodeState = JSON.parse(readFileSync(join(keyRoot, `node${slot}`, "node_state.json"), "utf8"));
    if (!isAddress(account.address) || typeof nodeState.publicKey !== "string") throw new Error(`invalid node state ${slot}`);
    const registerBls = await sendContract(
      deployerWallet,
      deployment.blsAggregator,
      BLSAggregatorABI as Abi,
      "registerBLSPublicKey",
      [account.address, g1Tuple(nodeState.publicKey as Hex), slot, emptyG2()],
    );
    records.push({
      slot,
      validator: account.address,
      funding: receiptRecord(funding),
      mintGToken: receiptRecord(mint),
      approveStake: receiptRecord(approve),
      registerRole: receiptRecord(registerRole),
      addValidator: receiptRecord(addValidator),
      registerBlsKey: receiptRecord(registerBls),
    });
  }
  writeJsonExclusive(join(rawDir, "validator-setup.json"), records);
  return validators;
}

async function startNodes(deployment: Deployment, keyRoot: string): Promise<string[]> {
  const urls: string[] = [];
  for (let slot = 1; slot <= nodeCount; slot++) {
    const portForNode = nodePort + slot - 1;
    const url = `http://127.0.0.1:${portForNode}`;
    // One secret per node, not one for the run: a shared secret would let a co-sign request
    // captured at one node be replayed at its peers, which is the property the quorum must not have.
    const experimentSecret = experimentSecrets.issue(url);
    const logPath = join(logDir, `yaaa-node-${slot}.log`);
    mkdirSync(join(keyRoot, `node${slot}`, "data"), { recursive: true });
    const fd = openSync(logPath, "wx");
    const child = spawn("node", [join(yaaaDir, "dist/main.js")], {
      cwd: join(keyRoot, `node${slot}`),
      env: safeEnv({
        NODE_ENV: "test",
        PORT: String(portForNode),
        PUBLIC_URL: url,
        ETH_RPC_URL: rpcUrl,
        VALIDATOR_CONTRACT_ADDRESS: deployment.dvtValidator,
        ENTRY_POINT_ADDRESS: deployment.entryPoint,
        REPCREDIT_EXPERIMENT_SIGNING: "true",
        REPCREDIT_BLS_AGGREGATOR_ADDRESS: deployment.blsAggregator,
        REPCREDIT_VALIDATOR_SLOT: String(slot),
        // Mandatory since YAAA 840bfdc: armed without a secret, every /repcredit request is 503.
        REPCREDIT_EXPERIMENT_AUTH_SECRET: experimentSecret,
        // YAAA's in-flight CC-49 round 2 (MEDIUM-C) refuses to arm unless the AUDIT aggregator is
        // named EXPLICITLY, because the built-in default is a Sepolia address that means nothing on
        // another chain. Passed through when set; on a chain with no production aggregator at all
        // (local Prague) DVT still has to say what the experiment should name here — see the
        // blocker note in the CC-49/CC-50 threads. Against committed 840bfdc this is optional.
        ...(auditBlsAggregatorAddress ? { AUDIT_BLS_AGGREGATOR_ADDRESS: auditBlsAggregatorAddress } : {}),
      }),
      stdio: ["ignore", fd, fd],
    });
    child.once("exit", () => closeSync(fd));
    children.push(child);
    urls.push(url);
    // Start sequentially so 13 NestJS processes do not contend during bootstrap.
    await waitNode(url);
  }
  return urls;
}

function proposal(proposalId: bigint, users: Address[], scores: bigint[], epoch: bigint): Proposal {
  const messageHash = keccak256(encodeAbiParameters(
    [
      { type: "uint256" }, { type: "address" }, { type: "uint8" },
      { type: "address[]" }, { type: "uint256[]" }, { type: "uint256" }, { type: "uint256" },
    ],
    [proposalId, ZERO_ADDRESS, 0, users, scores, epoch, BigInt(chainId)],
  ));
  return {
    schemaVersion: "repcredit-reputation-v1",
    proposalId: proposalId.toString(),
    operator: ZERO_ADDRESS,
    slashLevel: 0,
    users,
    scores: scores.map(String),
    epoch: epoch.toString(),
    chainId: String(chainId),
    messageHash,
  };
}

function slashProposal(
  proposalId: bigint,
  operator: Address,
  slashLevel: number,
  epoch: bigint,
  evidenceHash: Hex,
): SlashProposal {
  const messageHash = keccak256(encodeAbiParameters(
    [
      { type: "uint256" }, { type: "address" }, { type: "uint8" },
      { type: "address[]" }, { type: "uint256[]" }, { type: "uint256" },
      { type: "uint256" }, { type: "bytes32" },
    ],
    [proposalId, operator, slashLevel, [], [], epoch, BigInt(chainId), evidenceHash],
  ));
  return {
    schemaVersion: "repcredit-slash-v1",
    proposalId: proposalId.toString(),
    operator,
    slashLevel,
    epoch: epoch.toString(),
    chainId: String(chainId),
    evidenceHash,
    messageHash,
  };
}

/**
 * POST to a guarded `/repcredit/*` endpoint.
 *
 * Every request carries a per-node HMAC over the exact bytes sent, and every attempt (retries
 * included) mints a fresh timestamp + token because the node accepts each token only once. Non-2xx
 * responses come back as DATA so the negative controls can inspect them; an unreachable node throws.
 * Sending unsigned would now fail uniformly with 401/403 — the failure that would make every
 * negative control "pass" for the wrong reason (see `assertHttpRejections`).
 */
async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; body: T | any }> {
  return postSignedJson<T>(url, experimentSecrets.forEndpoint(url), body);
}

async function signAndAggregate(nodes: string[], value: Proposal, m: number) {
  const signStart = performance.now();
  const signed = await Promise.all(nodes.slice(0, m).map(url => postJson<CoSignResponse>(`${url}/repcredit/sign`, value)));
  const signMs = performance.now() - signStart;
  for (const response of signed) {
    if (!response.ok) throw new Error(`YAAA sign failed ${response.status}: ${JSON.stringify(response.body)}`);
  }
  const responses = signed.map(item => item.body as CoSignResponse);
  const aggregateStart = performance.now();
  const aggregated = await postJson<Aggregate>(`${nodes[0]}/repcredit/aggregate`, {
    proposal: value,
    responses,
    threshold: m,
  });
  const aggregateMs = performance.now() - aggregateStart;
  if (!aggregated.ok) throw new Error(`YAAA aggregate failed ${aggregated.status}: ${JSON.stringify(aggregated.body)}`);
  return { responses, aggregate: aggregated.body as Aggregate, signMs, aggregateMs };
}

async function signAndAggregateSlash(nodes: string[], value: SlashProposal, m: number) {
  const signStart = performance.now();
  const signed = await Promise.all(nodes.slice(0, m).map(url =>
    postJson<CoSignResponse>(`${url}/repcredit/slash/sign`, value)
  ));
  const signMs = performance.now() - signStart;
  for (const response of signed) {
    if (!response.ok) throw new Error(`YAAA slash sign failed ${response.status}: ${JSON.stringify(response.body)}`);
  }
  const responses = signed.map(item => item.body as CoSignResponse);
  const aggregateStart = performance.now();
  const aggregated = await postJson<Aggregate>(`${nodes[0]}/repcredit/slash/aggregate`, {
    proposal: value,
    responses,
    threshold: m,
  });
  const aggregateMs = performance.now() - aggregateStart;
  if (!aggregated.ok) {
    throw new Error(`YAAA slash aggregate failed ${aggregated.status}: ${JSON.stringify(aggregated.body)}`);
  }
  return { responses, aggregate: aggregated.body as Aggregate, signMs, aggregateMs };
}

async function createDvtProposal(deployment: Deployment, wallet: ReturnType<typeof createWalletClient>): Promise<{ id: bigint; receipt: TransactionReceipt }> {
  const id = await publicClient.readContract({
    address: deployment.dvtValidator,
    abi: DVTValidatorABI,
    functionName: "nextProposalId",
  }) as bigint;
  const receipt = await sendContract(wallet, deployment.dvtValidator, DVTValidatorABI as Abi, "createProposal", [
    ZERO_ADDRESS, 0, "repcredit-contribution",
  ]);
  return { id, receipt };
}

async function createDvtSlashProposal(
  deployment: Deployment,
  wallet: ReturnType<typeof createWalletClient>,
  operator: Address,
  slashLevel: number,
  evidenceHash: Hex,
): Promise<{ id: bigint; receipt: TransactionReceipt }> {
  const id = await publicClient.readContract({
    address: deployment.dvtValidator,
    abi: DVTValidatorABI,
    functionName: "nextProposalId",
  }) as bigint;
  const receipt = await sendContract(wallet, deployment.dvtValidator, DVTValidatorABI as Abi, "createProposal", [
    operator, slashLevel, "repcredit-guardian-exit-slash-race", evidenceHash,
  ]);
  return { id, receipt };
}

function pack128(high: bigint, low: bigint): Hex {
  return toHex((high << 128n) | low, { size: 32 });
}

async function buildUserOp(
  deployment: Deployment,
  air: AirDeployment,
  nonce: bigint,
): Promise<PackedUserOperation> {
  const increment = encodeFunctionData({ abi: RepCreditCounterABI, functionName: "increment" });
  const callData = encodeFunctionData({
    abi: AAStarAirAccountV7ABI,
    functionName: "execute",
    args: [air.contracts.counter, 0n, increment],
  });
  const paymasterAndData = concat([
    deployment.superPaymaster,
    toHex(400_000n, { size: 16 }),
    toHex(400_000n, { size: 16 }),
    DEPLOYER,
    toHex((1n << 256n) - 1n, { size: 32 }),
  ]);
  const userOp: PackedUserOperation = {
    sender: air.contracts.account,
    nonce,
    initCode: "0x",
    callData,
    accountGasLimits: pack128(500_000n, 250_000n),
    preVerificationGas: 100_000n,
    gasFees: pack128(userOpPriorityFeePerGas, userOpMaxFeePerGas),
    paymasterAndData,
    signature: "0x",
  };
  const userOpHash = await publicClient.readContract({
    address: deployment.entryPoint,
    abi: EntryPointABI,
    functionName: "getUserOpHash",
    args: [userOp],
  }) as Hex;
  const rawSignature = await (deployerWallet as any).signMessage({
    account: deployerAccount,
    message: { raw: userOpHash },
  }) as Hex;
  userOp.signature = concat(["0x02", rawSignature]);
  return userOp;
}

function eventNames(receipt: TransactionReceipt, abi: Abi): string[] {
  const names: string[] = [];
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi, data: log.data, topics: (log as any).topics });
      if (decoded.eventName) names.push(decoded.eventName);
    } catch { /* log belongs to another contract */ }
  }
  return names;
}

async function runAggregateUpliftCapAttack(
  deployment: Deployment,
  validator: PrivateKeyAccount,
  nodes: string[],
) {
  const wallet = validatorWallet(validator);
  const created = await createDvtProposal(deployment, wallet);
  const users = [syntheticUser(8_001), syntheticUser(8_002)];
  const value = proposal(created.id, users, [100n, 100n], 701n);
  const signed = await signAndAggregate(nodes, value, 3);
  const executeData = encodeFunctionData({
    abi: DVTValidatorABI,
    functionName: "executeWithProof",
    args: [created.id, users, [100n, 100n], 701n, signed.aggregate.proof],
  });
  const simulationError = await expectCallRejected(
    "aggregate uplift cap (simulation)",
    () => publicClient.call({ account: validator.address, to: deployment.dvtValidator, data: executeData }),
    sanitizeError,
  );
  const rejected = await sendExpectedRevert(wallet, deployment.dvtValidator, executeData, "aggregate uplift cap (tx)");
  const cap = await publicClient.readContract({
    address: deployment.registry,
    abi: RegistryABI,
    functionName: "maxAggregateCreditUpliftPerProposal",
  }) as bigint;
  const postState = await Promise.all(users.map(async user => ({
    user,
    reputation: await publicClient.readContract({
      address: deployment.registry,
      abi: RegistryABI,
      functionName: "globalReputation",
      args: [user],
    }) as bigint,
    creditLimit: await publicClient.readContract({
      address: deployment.registry,
      abi: RegistryABI,
      functionName: "getCreditLimit",
      args: [user],
    }) as bigint,
  })));
  if (cap !== parseEther("600") || postState.some(item => item.reputation !== 0n || item.creditLimit !== 0n)) {
    throw new Error("aggregate uplift cap did not preserve atomic zero state");
  }
  return {
    configuredCapWei: cap,
    attemptedAggregateUpliftWei: parseEther("1200"),
    proposal: value,
    signerMask: signed.aggregate.signerMask,
    createProposal: receiptRecord(created.receipt),
    simulationError,
    rejectedExecution: receiptRecord(rejected),
    postState,
  };
}

async function runE2E(
  deployment: Deployment,
  air: AirDeployment,
  validators: PrivateKeyAccount[],
  nodes: string[],
) {
  const validator0 = validatorWallet(validators[0]);
  const validator1 = validatorWallet(validators[1]);
  const e2e: Record<string, unknown> = {};

  e2e.aggregateUpliftCapAttack = await runAggregateUpliftCapAttack(
    deployment,
    validators[0],
    nodes,
  );

  e2e.agentRegistration = receiptRecord(await sendContract(
    deployerWallet,
    deployment.agentIdentityRegistry,
    MockAgentIdentityRegistryABI as Abi,
    "registerAgent",
    [air.contracts.account],
  ));

  const userOp = await buildUserOp(deployment, air, 0n);
  const userOpHash = await publicClient.readContract({
    address: deployment.entryPoint,
    abi: EntryPointABI,
    functionName: "getUserOpHash",
    args: [userOp],
  }) as Hex;
  const maxCost = 1_650_000n * userOpMaxFeePerGas;
  const preDryRun = await publicClient.readContract({
    address: deployment.superPaymaster,
    abi: SuperPaymasterABI,
    functionName: "dryRunValidation",
    args: [userOp, maxCost],
  }) as readonly [boolean, Hex];
  const handleOpsData = encodeFunctionData({
    abi: EntryPointABI,
    functionName: "handleOps",
    args: [[userOp], DEPLOYER],
  });
  const rejectedReceipt = await sendExpectedRevert(deployerWallet, deployment.entryPoint, handleOpsData, "over-limit UserOperation (tx)");
  e2e.beforeContribution = {
    userOpHash,
    creditLimit: (await publicClient.readContract({
      address: deployment.registry, abi: RegistryABI, functionName: "getCreditLimit", args: [air.contracts.account],
    }) as bigint).toString(),
    dryRun: { ok: preDryRun[0], reasonCode: preDryRun[1], reasonText: hexReason(preDryRun[1]) },
    handleOps: receiptRecord(rejectedReceipt),
  };
  if (preDryRun[0] || hexReason(preDryRun[1]) !== "CREDIT_EXCEEDED") {
    throw new Error(`pre-contribution gate did not return CREDIT_EXCEEDED: ${JSON.stringify(preDryRun)}`);
  }

  const created = await createDvtProposal(deployment, validator0);
  const contribution = proposal(created.id, [air.contracts.account], [100n], 1n);
  const signed = await signAndAggregate(nodes, contribution, 3);

  const wrongChain = { ...contribution, chainId: String(chainId + 1) };
  const wrongChainResult = await postJson(`${nodes[0]}/repcredit/sign`, wrongChain);
  const tamperedMessage = { ...contribution, messageHash: keccak256(stringToHex("tampered")) };
  const tamperedMessageResult = await postJson(`${nodes[0]}/repcredit/sign`, tamperedMessage);
  const belowThresholdResult = await postJson(`${nodes[0]}/repcredit/aggregate`, {
    proposal: contribution,
    responses: signed.responses.slice(0, 2),
    threshold: 3,
  });
  const duplicateSlotResult = await postJson(`${nodes[0]}/repcredit/aggregate`, {
    proposal: contribution,
    responses: [signed.responses[0], signed.responses[0], signed.responses[1]],
    threshold: 3,
  });
  const corrupted = structuredClone(signed.responses);
  const originalSignature = corrupted[0].signatureCompact.slice(2);
  const flippedFirstByte = (Number.parseInt(originalSignature.slice(0, 2), 16) ^ 1)
    .toString(16)
    .padStart(2, "0");
  corrupted[0].signatureCompact = `0x${flippedFirstByte}${originalSignature.slice(2)}` as Hex;
  const badSignatureResult = await postJson(`${nodes[0]}/repcredit/aggregate`, {
    proposal: contribution,
    responses: corrupted,
    threshold: 3,
  });
  assertHttpRejections({
    wrongChainResult, tamperedMessageResult, belowThresholdResult, duplicateSlotResult, badSignatureResult,
  });

  const tamperedCall = encodeFunctionData({
    abi: DVTValidatorABI,
    functionName: "executeWithProof",
    args: [created.id, contribution.users, [101n], 1n, signed.aggregate.proof],
  });
  const tamperedOnChain = await expectCallRejected(
    "tampered score (on-chain simulation)",
    () => publicClient.call({ account: validators[0].address, to: deployment.dvtValidator, data: tamperedCall }),
    sanitizeError,
  );

  const reputationReceipt = await sendContract(
    validator0,
    deployment.dvtValidator,
    DVTValidatorABI as Abi,
    "executeWithProof",
    [created.id, contribution.users, [100n], 1n, signed.aggregate.proof],
  );
  const replayData = encodeFunctionData({
    abi: DVTValidatorABI,
    functionName: "executeWithProof",
    args: [created.id, contribution.users, [100n], 1n, signed.aggregate.proof],
  });
  const replayReceipt = await sendExpectedRevert(validator0, deployment.dvtValidator, replayData, "proposal replay (tx)");

  const postDryRun = await publicClient.readContract({
    address: deployment.superPaymaster,
    abi: SuperPaymasterABI,
    functionName: "dryRunValidation",
    args: [userOp, maxCost],
  }) as readonly [boolean, Hex];
  if (!postDryRun[0]) throw new Error(`post-contribution dry run failed: ${hexReason(postDryRun[1])}`);
  e2e.contribution = {
    proposal: contribution,
    signerSlots: signed.aggregate.slots,
    signerMask: signed.aggregate.signerMask,
    signMs: signed.signMs,
    aggregateMs: signed.aggregateMs,
    createProposal: receiptRecord(created.receipt),
    execute: receiptRecord(reputationReceipt),
    executeEvents: eventNames(reputationReceipt, RegistryABI as Abi),
    reputation: (await publicClient.readContract({
      address: deployment.registry, abi: RegistryABI, functionName: "globalReputation", args: [air.contracts.account],
    }) as bigint).toString(),
    creditLimit: (await publicClient.readContract({
      address: deployment.registry, abi: RegistryABI, functionName: "getCreditLimit", args: [air.contracts.account],
    }) as bigint).toString(),
    postContributionDryRun: { ok: postDryRun[0], reasonCode: postDryRun[1] },
    negatives: {
      wrongChain: wrongChainResult,
      tamperedMessage: tamperedMessageResult,
      belowThreshold: belowThresholdResult,
      duplicateSlot: duplicateSlotResult,
      badSignature: badSignatureResult,
      tamperedScoreOnChain: tamperedOnChain,
      replay: receiptRecord(replayReceipt),
    },
  };

  // Arm A: balance-backed exact burn. The app call is Counter.increment(), not a token transfer.
  const armAMint = parseEther("1000");
  const armABalanceBeforeMint = await balanceOf(deployment.aPNTs, air.contracts.account);
  const armAMintReceipt = await sendContract(deployerWallet, deployment.aPNTs, xPNTsTokenABI as Abi, "mint", [air.contracts.account, armAMint]);
  const armABefore = await balanceOf(deployment.aPNTs, air.contracts.account);
  const armAHash = await (deployerWallet as any).sendTransaction({ to: deployment.entryPoint, data: handleOpsData, gas: 8_000_000n });
  const armAReceipt = await waitReceipt(armAHash);
  const armAAfter = await balanceOf(deployment.aPNTs, air.contracts.account);
  const armADebt = await debtOf(deployment.aPNTs, air.contracts.account);
  if (armADebt !== 0n || armABefore <= armAAfter) throw new Error("Arm A did not produce an exact balance burn");
  const burned = armABefore - armAAfter;
  e2e.armA = {
    applicationCall: "RepCreditCounter.increment()",
    balanceBeforeMint: armABalanceBeforeMint,
    mint: receiptRecord(armAMintReceipt),
    balanceBefore: armABefore,
    balanceAfter: armAAfter,
    burned,
    debtAfter: armADebt,
    handleOps: receiptRecord(armAReceipt),
    xPNTEvents: eventNames(armAReceipt, xPNTsTokenABI as Abi),
    counterAfter: await counterNumber(air.contracts.counter),
  };

  // Drain Arm A's unused balance through an owner-authorized direct account call.
  const transferOut = encodeFunctionData({
    abi: xPNTsTokenABI,
    functionName: "transfer",
    args: [DEPLOYER, armAAfter],
  });
  const cleanupReceipt = await sendContract(
    deployerWallet,
    air.contracts.account,
    AAStarAirAccountV7ABI as Abi,
    "execute",
    [deployment.aPNTs, 0n, transferOut],
  );
  if (await balanceOf(deployment.aPNTs, air.contracts.account) !== 0n) throw new Error("Arm A cleanup left a token balance");

  // Arm B: zero-balance credit-backed debt, followed by mint-triggered repayment.
  const nonceB = await publicClient.readContract({
    address: deployment.entryPoint, abi: EntryPointABI, functionName: "getNonce", args: [air.contracts.account, 0n],
  }) as bigint;
  const userOpB = await buildUserOp(deployment, air, nonceB);
  const handleOpsB = encodeFunctionData({ abi: EntryPointABI, functionName: "handleOps", args: [[userOpB], DEPLOYER] });
  const armBHash = await (deployerWallet as any).sendTransaction({ to: deployment.entryPoint, data: handleOpsB, gas: 8_000_000n });
  const armBReceipt = await waitReceipt(armBHash);
  const debtAfterRecord = await debtOf(deployment.aPNTs, air.contracts.account);
  if (debtAfterRecord === 0n) throw new Error("Arm B did not record debt");
  const exchangeRate = await publicClient.readContract({
    address: deployment.aPNTs, abi: xPNTsTokenABI, functionName: "exchangeRate",
  }) as bigint;
  const repaymentMint = (debtAfterRecord * exchangeRate + 10n ** 18n - 1n) / 10n ** 18n;
  const repayReceipt = await sendContract(
    deployerWallet, deployment.aPNTs, xPNTsTokenABI as Abi, "mint", [air.contracts.account, repaymentMint],
  );
  const debtAfterRepay = await debtOf(deployment.aPNTs, air.contracts.account);
  if (debtAfterRepay !== 0n) throw new Error("Arm B debt was not fully repaid");
  e2e.armB = {
    applicationCall: "RepCreditCounter.increment()",
    zeroBalanceBefore: true,
    cleanup: receiptRecord(cleanupReceipt),
    handleOps: receiptRecord(armBReceipt),
    xPNTEvents: eventNames(armBReceipt, xPNTsTokenABI as Abi),
    debtAfterRecord,
    repaymentMint,
    repayment: receiptRecord(repayReceipt),
    repaymentEvents: eventNames(repayReceipt, xPNTsTokenABI as Abi),
    debtAfterRepay,
    balanceAfterRepay: await balanceOf(deployment.aPNTs, air.contracts.account),
    counterAfter: await counterNumber(air.contracts.counter),
  };

  // The exited-validator check needs time travel and snapshot rollback, so it is
  // part of the controlled local experiment rather than the public-chain run.
  if (!isSepolia) {
    const exitSnapshot = await snapshot();
    const exitCreated = await createDvtProposal(deployment, validator0);
    const exitProposal = proposal(exitCreated.id, [syntheticUser(9_999)], [100n], 99n);
    const exitSigned = await signAndAggregate(nodes, exitProposal, 3);
    await rpc("evm_increaseTime", [31 * 24 * 60 * 60]);
    await rpc("evm_mine");
    const exitNotice = await sendContract(
      validator0,
      deployment.blsAggregator,
      BLSAggregatorABI as Abi,
      "requestGuardianExit",
      [],
    );
    await rpc("evm_increaseTime", [2 * 24 * 60 * 60]);
    await rpc("evm_mine");
    await sendContract(validator0, deployment.registry, RegistryABI as Abi, "exitRole", [ROLE_DVT]);
    const exitData = encodeFunctionData({
      abi: DVTValidatorABI,
      functionName: "executeWithProof",
      args: [exitCreated.id, exitProposal.users, [100n], 99n, exitSigned.aggregate.proof],
    });
    const exitedReceipt = await sendExpectedRevert(validator1, deployment.dvtValidator, exitData, "post-slash ejected signer (tx)");
    e2e.exitedValidatorNegative = {
      exitNotice: receiptRecord(exitNotice),
      rejectedExecution: receiptRecord(exitedReceipt),
    };
    await revertSnapshot(exitSnapshot);
  } else {
    e2e.exitedValidatorNegative = { status: "not-run", reason: "public chain has no snapshot/time-travel isolation" };
  }

  if (await counterNumber(air.contracts.counter) !== 2n) throw new Error("Counter must equal two after Arms A and B");
  writeJsonExclusive(join(rawDir, "e2e.json"), e2e);
  return e2e;
}

function hexReason(value: Hex): string {
  try {
    return Buffer.from(value.slice(2), "hex").toString("utf8").replace(/\0+$/g, "");
  } catch { return value; }
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .split(rpcUrl).join("[REDACTED_RPC_URL]")
    .replace(/0x[a-fA-F0-9]{64}/g, "0x<redacted-32-byte-value>")
    .slice(0, 2_000);
}

async function balanceOf(token: Address, user: Address): Promise<bigint> {
  return publicClient.readContract({ address: token, abi: xPNTsTokenABI, functionName: "balanceOf", args: [user] }) as Promise<bigint>;
}

async function debtOf(token: Address, user: Address): Promise<bigint> {
  return publicClient.readContract({ address: token, abi: xPNTsTokenABI, functionName: "getDebt", args: [user] }) as Promise<bigint>;
}

async function counterNumber(counter: Address): Promise<bigint> {
  return publicClient.readContract({ address: counter, abi: RepCreditCounterABI, functionName: "number" }) as Promise<bigint>;
}

function syntheticUser(index: number): Address {
  return getAddress(toHex(0x1000000000000000000000000000000000000000n + BigInt(index), { size: 20 }));
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function summarize(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  return { n: sorted.length, median: quantile(sorted, 0.5), q1, q3, iqr: q3 - q1, min: sorted[0], max: sorted.at(-1)! };
}

async function runMeasurements(
  deployment: Deployment,
  validators: PrivateKeyAccount[],
  nodes: string[],
) {
  const rawPath = join(rawDir, "measurements.jsonl");
  const cells: any[] = [];
  const mValues = measurementSmoke ? [3] : [3, 7, 13];
  const batchSizes = measurementSmoke ? [1] : [1, 10, 50, 100];
  const repetitions = measurementSmoke ? 2 : 10;
  const productionCap = await publicClient.readContract({
    address: deployment.registry,
    abi: RegistryABI,
    functionName: "maxAggregateCreditUpliftPerProposal",
  }) as bigint;
  const relaxCap = await sendContract(
    deployerWallet,
    deployment.registry,
    RegistryABI as Abi,
    "setMaxAggregateCreditUpliftPerProposal",
    [(1n << 256n) - 1n],
  );
  await sendContract(deployerWallet, deployment.registry, RegistryABI as Abi, "setReputationSource", [DEPLOYER, true]);
  const validator0 = validatorWallet(validators[0]);
  let cellIndex = 0;
  for (const path of ["registry", "dvt"] as const) {
    for (const m of mValues) {
      for (const batchSize of batchSizes) {
        cellIndex++;
        const users = Array.from({ length: batchSize }, (_, i) => syntheticUser(cellIndex * 1_000 + i));
        const scores = Array.from({ length: batchSize }, (_, i) => BigInt(50 + (i % 50)));
        let proposalId = 100_000n + BigInt(cellIndex);
        let createReceipt: TransactionReceipt | undefined;
        if (path === "dvt") {
          const created = await createDvtProposal(deployment, validator0);
          proposalId = created.id;
          createReceipt = created.receipt;
        }
        const epoch = 1_000n + BigInt(cellIndex);
        const value = proposal(proposalId, users, scores, epoch);
        let stateSnapshot = await snapshot();
        const rows: any[] = [];
        for (let repetition = 1; repetition <= repetitions; repetition++) {
          if (repetition > 1) {
            await revertSnapshot(stateSnapshot);
            stateSnapshot = await snapshot();
          }
          const preBlock = await publicClient.getBlock();
          const signed = await signAndAggregate(nodes, value, m);
          const submitStart = performance.now();
          const receipt = path === "registry"
            ? await sendContract(
                deployerWallet,
                deployment.registry,
                RegistryABI as Abi,
                "batchUpdateGlobalReputation",
                [proposalId, users, scores, epoch, signed.aggregate.proof],
              )
            : await sendContract(
                validator0,
                deployment.dvtValidator,
                DVTValidatorABI as Abi,
                "executeWithProof",
                [proposalId, users, scores, epoch, signed.aggregate.proof],
              );
          const submitMs = performance.now() - submitStart;
          const row = {
            schemaVersion: 1,
            path,
            m,
            batchSize,
            repetition,
            proposalId: proposalId.toString(),
            epoch: epoch.toString(),
            messageHash: value.messageHash,
            signerMask: signed.aggregate.signerMask,
            signerSlots: signed.aggregate.slots,
            proof: signed.aggregate.proof,
            preState: { blockNumber: preBlock.number.toString(), blockHash: preBlock.hash },
            timingMs: { sign: signed.signMs, aggregate: signed.aggregateMs, submit: submitMs, total: signed.signMs + signed.aggregateMs + submitMs },
            receipt: receiptRecord(receipt),
          };
          appendJsonLine(rawPath, row);
          rows.push(row);
        }
        await revertSnapshot(stateSnapshot);
        const gas = rows.map(row => Number(row.receipt.gasUsed));
        const totalMs = rows.map(row => Number(row.timingMs.total));
        const preStateHashes = [...new Set(rows.map(row => row.preState.blockHash))];
        if (preStateHashes.length !== 1) throw new Error(`cell ${cellIndex} did not reuse an identical pre-state`);
        cells.push({
          path,
          m,
          batchSize,
          repetitions,
          fixedPairingChecksPerRegistryVerification: 1,
          registryVerifications: path === "registry" ? 1 : 2,
          pkAggregation: "linear in signer-mask population, capped at 13",
          preStateBlockHash: preStateHashes[0],
          createProposal: createReceipt ? receiptRecord(createReceipt) : null,
          gas: summarize(gas),
          totalMs: summarize(totalMs),
          rawGas: gas,
          rawTotalMs: totalMs,
        });
      }
    }
  }
  const restoreCap = await sendContract(
    deployerWallet,
    deployment.registry,
    RegistryABI as Abi,
    "setMaxAggregateCreditUpliftPerProposal",
    [productionCap],
  );
  const restoredCap = await publicClient.readContract({
    address: deployment.registry,
    abi: RegistryABI,
    functionName: "maxAggregateCreditUpliftPerProposal",
  }) as bigint;
  if (restoredCap !== productionCap) throw new Error("measurement harness did not restore aggregate uplift cap");
  const summary = {
    schemaVersion: 1,
    design: {
      m: mValues,
      batchSize: batchSizes,
      paths: ["registry", "dvt"],
      repetitions,
      smoke: measurementSmoke,
      snapshotPolicy: "every repetition starts from the same pre-state block hash within its cell",
      directRegistrySource: DEPLOYER,
      directRegistrySourceNote: "fresh-chain owner-authorized measurement harness; no impersonation",
      dvtPath: "DVTValidator.executeWithProof -> BLSAggregator.verifyAndExecute -> Registry.batchUpdateGlobalReputation",
      maxValidators: 13,
      aggregateUpliftCapHarness: {
        productionCapWei: productionCap,
        rationale: "temporarily relaxed only for factorial batch measurement; restored before security experiment",
        relaxReceipt: receiptRecord(relaxCap),
        restoreReceipt: receiptRecord(restoreCap),
        restoredCapWei: restoredCap,
      },
    },
    cells,
  };
  writeJsonExclusive(join(derivedDir, "measurement-summary.json"), summary);
  return summary;
}

function deployFraudVerifier(deployment: Deployment): Address {
  const contractsDir = join(yaaaDir, "contracts");
  // RPC endpoint via the environment instead of argv: a provider-keyed URL on the command line is
  // readable by every local user through `ps` (CC-50 L1).
  //
  // It MUST be FOUNDRY_ETH_RPC_URL, not ETH_RPC_URL. Verified against foundry 1.7.1 on this
  // machine: with only ETH_RPC_URL set, `forge script --broadcast` prints "If you wish to simulate
  // on-chain transactions pass a RPC URL", writes no broadcast file and exits 0 — a silent
  // downgrade to a dry run. FOUNDRY_ETH_RPC_URL (the config-key env override for `eth_rpc_url`)
  // broadcasts normally. The runner still fails closed if this ever regresses: every forge step is
  // followed by a hard existence check on its broadcast/config output.
  runLogged("overissue-verifier-deploy", "forge", [
    "script",
    "script/DeployOverIssueVerifier.s.sol:DeployOverIssueVerifier",
    "--broadcast",
    "--slow",
  ], contractsDir, {
    FOUNDRY_ETH_RPC_URL: rpcUrl,
    AGGREGATOR: deployment.blsAggregator,
    EXPECTED_AGGREGATOR: deployment.blsAggregator,
    EXPECTED_CHAIN_ID: String(chainId),
    DEPLOYER_PRIVATE_KEY: isSepolia ? livePrivateKey! : LOCAL_DEPLOYER_KEY,
  });
  const broadcastPath = join(
    contractsDir,
    `broadcast/DeployOverIssueVerifier.s.sol/${chainId}/run-latest.json`,
  );
  if (!existsSync(broadcastPath)) throw new Error("OverIssue verifier Forge broadcast file is missing");
  const broadcast = JSON.parse(readFileSync(broadcastPath, "utf8")) as {
    transactions?: Array<{ contractName?: string; contractAddress?: string; transactionType?: string }>;
  };
  const create = broadcast.transactions?.find(tx =>
    tx.contractName === "OverIssueFraudProofVerifier"
      && tx.transactionType === "CREATE"
      && isAddress(tx.contractAddress ?? "")
  );
  if (!create?.contractAddress) throw new Error("OverIssue verifier address missing from Forge broadcast");
  copyFileSync(broadcastPath, join(rawDir, "overissue-verifier-broadcast.json"));
  return getAddress(create.contractAddress);
}

async function runGuardianExitSlashCompetition(
  deployment: Deployment,
  verifier: Address,
  validators: PrivateKeyAccount[],
  nodes: string[],
) {
  const operator = ZERO_ADDRESS;
  const slashLevel = 1;
  const epoch = 9_001n;
  const overIssued = await publicClient.readContract({
    address: deployment.aPNTs,
    abi: xPNTsTokenABI,
    functionName: "isOverIssued",
  }) as boolean;
  if (overIssued) throw new Error("fresh aPNTs is over-issued; cannot construct a truthful false-slash proof");

  const localEvidenceHash = keccak256(encodeAbiParameters(
    [{ type: "string" }, { type: "address" }, { type: "address" }, { type: "uint256" }],
    ["DVT_OVERISSUE_EVIDENCE_V1", deployment.aPNTs, operator, epoch],
  ));
  const verifierEvidenceHash = await publicClient.readContract({
    address: verifier,
    abi: fraudVerifierAbi as Abi,
    functionName: "evidenceHash",
    args: [deployment.aPNTs, operator, epoch],
  }) as Hex;
  if (localEvidenceHash.toLowerCase() !== verifierEvidenceHash.toLowerCase()) {
    throw new Error("off-chain evidence hash does not match the deployed verifier");
  }

  const proposer = validatorWallet(validators[0]);
  const created = await createDvtSlashProposal(
    deployment,
    proposer,
    operator,
    slashLevel,
    localEvidenceHash,
  );
  const value = slashProposal(created.id, operator, slashLevel, epoch, localEvidenceHash);
  const signed = await signAndAggregateSlash(nodes, value, 3);
  const executeProposal = await sendContract(
    proposer,
    deployment.dvtValidator,
    DVTValidatorABI as Abi,
    "executeWithProof",
    [created.id, [], [], epoch, signed.aggregate.proof],
  );
  const armVerifier = await sendContract(
    deployerWallet,
    deployment.blsAggregator,
    BLSAggregatorABI as Abi,
    "setFraudProofVerifier",
    [verifier],
  );

  const claimedSigners = validators.slice(0, 3).map(item => item.address)
    .sort((a, b) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0);
  const guiltyGuardians = [...claimedSigners];
  const signerMask = BigInt(signed.aggregate.signerMask);
  const fraudProofId = BigInt(keccak256(encodeAbiParameters(
    [{ type: "string" }, { type: "uint256" }],
    ["GUARDIAN_FRAUD_V1", created.id],
  )));
  const fraudProof = encodeAbiParameters(
    [
      { type: "uint256" }, { type: "address" }, { type: "uint8" },
      { type: "uint256" }, { type: "address" }, { type: "uint256" },
      { type: "address[]" },
    ],
    [created.id, operator, slashLevel, epoch, deployment.aPNTs, signerMask, claimedSigners],
  );
  const verifierAccepted = await publicClient.readContract({
    address: verifier,
    abi: fraudVerifierAbi as Abi,
    functionName: "verify",
    args: [fraudProofId, guiltyGuardians, fraudProof],
  }) as boolean;
  if (!verifierAccepted) throw new Error("real OverIssue verifier rejected the constructed fraud proof");

  const exitingGuardian = validators[0];
  const exitingWallet = validatorWallet(exitingGuardian);
  const requestExit = await sendContract(
    exitingWallet,
    deployment.blsAggregator,
    BLSAggregatorABI as Abi,
    "requestGuardianExit",
    [],
  );
  const exitRequest = await publicClient.readContract({
    address: deployment.blsAggregator,
    abi: BLSAggregatorABI,
    functionName: "guardianExitRequests",
    args: [exitingGuardian.address],
  });
  const queueSlash = await sendContract(
    deployerWallet,
    deployment.blsAggregator,
    BLSAggregatorABI as Abi,
    "queueGuardianSlash",
    [fraudProofId, guiltyGuardians, fraudProof],
  );
  const pendingBefore = await Promise.all(guiltyGuardians.map(guardian =>
    publicClient.readContract({
      address: deployment.blsAggregator,
      abi: BLSAggregatorABI,
      functionName: "pendingGuardianSlashCount",
      args: [guardian],
    }) as Promise<bigint>
  ));
  if (pendingBefore.some(count => count !== 1n)) throw new Error("queued fraud case did not freeze every accused guardian");

  const exitData = encodeFunctionData({
    abi: RegistryABI,
    functionName: "exitRole",
    args: [ROLE_DVT],
  });
  const exitSimulationError = await expectCallRejected(
    "guardian exit while slash pending (simulation)",
    () => publicClient.call({ account: exitingGuardian.address, to: deployment.registry, data: exitData }),
    sanitizeError,
  );
  const blockedExit = await sendExpectedRevert(exitingWallet, deployment.registry, exitData, "guardian exit while slash pending (tx)");
  const locksBefore = await Promise.all(guiltyGuardians.map(guardian =>
    publicClient.readContract({
      address: deployment.staking,
      abi: GTokenStakingABI,
      functionName: "roleLocks",
      args: [guardian, ROLE_DVT],
    })
  ));
  const executeSlash = await sendContract(
    deployerWallet,
    deployment.blsAggregator,
    BLSAggregatorABI as Abi,
    "executeGuardianSlash",
    [fraudProofId, guiltyGuardians, fraudProof],
  );
  const pendingAfter = await Promise.all(guiltyGuardians.map(guardian =>
    publicClient.readContract({
      address: deployment.blsAggregator,
      abi: BLSAggregatorABI,
      functionName: "pendingGuardianSlashCount",
      args: [guardian],
    }) as Promise<bigint>
  ));
  const locksAfter = await Promise.all(guiltyGuardians.map(guardian =>
    publicClient.readContract({
      address: deployment.staking,
      abi: GTokenStakingABI,
      functionName: "roleLocks",
      args: [guardian, ROLE_DVT],
    })
  ));
  const slashCase = await publicClient.readContract({
    address: deployment.blsAggregator,
    abi: BLSAggregatorABI,
    functionName: "guardianSlashCases",
    args: [fraudProofId],
  });
  if (pendingAfter.some(count => count !== 0n) || locksAfter.some(lock => (lock as readonly unknown[])[0] !== 0n)) {
    throw new Error("executed fraud case did not release pending counts and slash every DVT lock");
  }

  const cancelExitAfterSlash = await sendContract(
    exitingWallet,
    deployment.blsAggregator,
    BLSAggregatorABI as Abi,
    "cancelGuardianExit",
    [],
  );

  // `verify` RETURNS a bool: a slashed set that stayed eligible returns true without throwing, so a
  // try/catch cannot see it. expectViewRejected demands a revert or an explicit `false` (CC-50 H1).
  const postSlashLiveness = await expectViewRejected(
    "post-slash BLS liveness",
    () => publicClient.readContract({
      address: deployment.blsAggregator,
      abi: BLSAggregatorABI,
      functionName: "verify",
      args: [value.messageHash, signerMask, 3n, signed.aggregate.sigG2],
    }),
    sanitizeError,
  );
  const postSlashLivenessError = postSlashLiveness.reason;

  const evidence = {
    verifier,
    tokenOverIssuedAtProofTime: overIssued,
    evidenceHash: localEvidenceHash,
    proposal: value,
    signerMask: signed.aggregate.signerMask,
    signerSlots: signed.aggregate.slots,
    claimedSigners,
    guiltyGuardians,
    fraudProofId: fraudProofId.toString(),
    verifierAccepted,
    createProposal: receiptRecord(created.receipt),
    executeSlashOnlyProposal: receiptRecord(executeProposal),
    armVerifier: receiptRecord(armVerifier),
    requestExit: receiptRecord(requestExit),
    exitRequest,
    queueSlash: receiptRecord(queueSlash),
    pendingBefore,
    exitSimulationError,
    blockedExit: receiptRecord(blockedExit),
    locksBefore,
    executeSlash: receiptRecord(executeSlash),
    slashCase,
    pendingAfter,
    locksAfter,
    cancelExitAfterSlash: receiptRecord(cancelExitAfterSlash),
    postSlashLivenessError,
    postSlashLivenessOutcome: postSlashLiveness.outcome,
  };
  writeJsonExclusive(join(rawDir, "security-controls.json"), evidence);
  return evidence;
}

async function verifyPublicDeployment(deployment: Deployment) {
  const latest = await publicClient.getBlock();
  const addresses = Object.entries(deployment);
  const codeBytes: Record<string, number> = {};
  for (const [name, address] of addresses) {
    const code = await publicClient.getBytecode({ address });
    if (!code || code === "0x") throw new Error(`${name} ${address} has no deployed bytecode`);
    codeBytes[name] = (code.length - 2) / 2;
  }
  const preflight = {
    schemaVersion: 1,
    networkMode,
    chainId: await publicClient.getChainId(),
    deployer: DEPLOYER,
    deployerBalanceWei: (await publicClient.getBalance({ address: DEPLOYER })).toString(),
    observedGasPriceWei: (await publicClient.getGasPrice()).toString(),
    latestBlock: { number: latest.number.toString(), hash: latest.hash },
    entryPoint: deployment.entryPoint,
    codeBytes,
  };
  writeJsonExclusive(join(rawDir, "network-preflight.json"), preflight);
  return preflight;
}

async function refundValidatorEth(validators: PrivateKeyAccount[]) {
  const records: Record<string, unknown>[] = [];
  for (const account of validators) {
    const before = await publicClient.getBalance({ address: account.address });
    const reserve = 63_000n * await publicClient.getGasPrice();
    if (before <= reserve) {
      records.push({ validator: account.address, balanceBeforeWei: before, status: "below-refund-reserve" });
      continue;
    }
    const receipt = await waitReceipt(await (validatorWallet(account) as any).sendTransaction({
      to: DEPLOYER,
      value: before - reserve,
      gas: 21_000n,
    }));
    records.push({
      validator: account.address,
      balanceBeforeWei: before,
      returnedValueWei: before - reserve,
      receipt: receiptRecord(receipt),
      balanceAfterWei: await publicClient.getBalance({ address: account.address }),
    });
  }
  writeJsonExclusive(join(rawDir, "validator-refunds.json"), records);
}

/**
 * Secrets that must never survive into the sealed evidence.
 *
 * The experiment auth secrets are redacted in BOTH network modes: they are minted per run in local
 * mode too, and `logs/` holds each node's stdout. The RPC URL and deployer key stay Sepolia-only —
 * in local mode they are `http://127.0.0.1:PORT` and the well-known anvil key, and scrubbing those
 * would delete load-bearing, non-secret detail from the local evidence.
 */
function evidenceSecrets(): string[] {
  return [...experimentSecrets.values(), ...(isSepolia ? [rpcUrl, livePrivateKey!] : [])];
}

/** Redact every run secret from everything written under outputDir so far. Safe to call twice. */
function redactEvidence(): void {
  if (!existsSync(outputDir)) return;
  redactEvidenceSecrets(outputDir, evidenceSecrets());
}

function redactEvidenceSecrets(root: string, secrets: string[]): void {
  const activeSecrets = secrets.filter(secret => secret.length > 0);
  const visit = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
        visit(child);
        continue;
      }
      let content = readFileSync(child, "utf8");
      let redacted = content;
      for (const secret of activeSecrets) redacted = redacted.split(secret).join("[REDACTED]");
      if (redacted !== content) writeFileSync(child, redacted);
      content = readFileSync(child, "utf8");
      for (const secret of activeSecrets) {
        if (content.includes(secret)) throw new Error(`secret remained in evidence file ${child}`);
      }
    }
  };
  visit(root);
}

async function main(): Promise<void> {
  // Fail before touching a chain if the experiment ABI fixtures no longer match their recorded
  // hash / upstream artifact — a hand-edited or silently drifted mock ABI invalidates the run.
  const abiProblems = verifyFixtures();
  if (abiProblems.length) {
    throw new Error(
      `RepCredit experiment ABI fixtures are not trustworthy:\n  ${abiProblems.join("\n  ")}\n` +
        "Run `pnpm run repcredit:abi:sync` against the pinned upstream checkouts.",
    );
  }

  assertRepo(superPaymasterDir, "foundry.toml");
  assertRepo(yaaaDir, "package.json");
  assertRepo(airDir, "foundry.toml");
  assertRepo(sdkDir, "pnpm-workspace.yaml");
  if (!isSepolia) await assertPortAvailable(port);
  for (let slot = 0; slot < nodeCount; slot++) await assertPortAvailable(nodePort + slot);

  if (isSepolia) {
    await waitRpc();
    const observedGasPrice = await publicClient.getGasPrice();
    userOpPriorityFeePerGas = 1_000_000n;
    userOpMaxFeePerGas = observedGasPrice * 2n;
  }

  const manifest: Record<string, unknown> = {
    schemaVersion: 1,
    startedAt: new Date().toISOString(),
    command: isSepolia ? "pnpm repcredit:e2e:sepolia" : "pnpm repcredit:e2e",
    safety: {
      networkMode,
      chainId,
      hardfork: isSepolia ? "public-Sepolia" : "prague",
      mockPrecompiles: false,
      analyticalGasCorrection: false,
      envFilesReadByRunner: false,
      callerAuthorizedEnvironment: isSepolia,
      isolatedFreshDeployment: true,
      freshValidatorKeys: isSepolia,
      secretsWritten: false,
    },
    repositories: Object.fromEntries([
      ["SuperPaymaster", superPaymasterDir],
      ["YetAnotherAA-Validator", yaaaDir],
      ["aastar-sdk", sdkDir],
      ["airaccount-contract", airDir],
    ].map(([name, path]) => [name, {
      path,
      commit: git(path, "rev-parse", "HEAD"),
      branch: git(path, "branch", "--show-current"),
      porcelainAtStart: git(path, "status", "--short"),
    }])),
    parameters: {
      rpcUrl: isSepolia ? "[REDACTED]" : rpcUrl,
      nodePort,
      nodeCount,
      skipMeasurements,
      measurementSmoke,
      userOpMaxFeePerGas,
      userOpPriorityFeePerGas,
    },
  };
  writeJsonExclusive(join(outputDir, "manifest-start.json"), manifest);

  if (!isSepolia) {
    const anvilFd = openSync(join(logDir, "anvil.log"), "wx");
    const anvil = spawn("anvil", ["--port", String(port), "--chain-id", String(chainId), "--hardfork", "prague"], {
      env: safeEnv({}),
      stdio: ["ignore", anvilFd, anvilFd],
    });
    anvil.once("exit", () => closeSync(anvilFd));
    children.push(anvil);
    await waitRpc();
  }

  const superPaymasterConfig = isSepolia
    ? join(superPaymasterDir, "broadcast/repcredit-e2e-sepolia-deployment.json")
    : join(superPaymasterDir, "deployments/config.anvil.json");
  if (isSepolia) {
    // Delete any leftover from an earlier aborted run BEFORE deploying. Without this, a forge run
    // that fails to write the file leaves loadDeployment() silently reading last run's addresses.
    rmSync(superPaymasterConfig, { force: true });
    stagedDeploymentConfig = superPaymasterConfig;
    const entryPoint = process.env.REPCREDIT_ENTRYPOINT ?? "";
    const ethUsdFeed = process.env.REPCREDIT_ETH_USD_FEED ?? "";
    if (!isAddress(entryPoint) || !isAddress(ethUsdFeed)) {
      throw new Error("Sepolia mode requires valid REPCREDIT_ENTRYPOINT and REPCREDIT_ETH_USD_FEED addresses");
    }
    mkdirSync(dirname(superPaymasterConfig), { recursive: true });
    runLogged("superpaymaster-deploy", "forge", [
      "script", "contracts/script/v3/DeployRepCreditSepolia.s.sol:DeployRepCreditSepolia",
      "--broadcast", "--slow",
    ], superPaymasterDir, {
      FOUNDRY_ETH_RPC_URL: rpcUrl,
      DEPLOYER_PRIVATE_KEY: livePrivateKey!,
      ENTRY_POINT: entryPoint,
      ETH_USD_FEED: ethUsdFeed,
      REPCREDIT_SEPOLIA_CONFIG: superPaymasterConfig,
      REPCREDIT_ENTRYPOINT_DEPOSIT_WEI: "10000000000000000",
    });
  } else {
    runLogged("superpaymaster-deploy", "forge", [
      "script", "contracts/script/v3/DeployAnvil.s.sol:DeployAnvil", "--broadcast",
    ], superPaymasterDir, {
      FOUNDRY_ETH_RPC_URL: rpcUrl,
      REPCREDIT_EVIDENCE_MODE: "true",
      DEPLOY_TIME: "2026-08-23T23:35:00+07:00",
    });
  }
  // loadDeployment / copyFileSync can both throw; the staged file is cleared by the top-level
  // finally (and by the signal handlers) rather than by a statement that a throw can skip.
  const deployment = loadDeployment(superPaymasterConfig);
  copyFileSync(superPaymasterConfig, join(rawDir, "superpaymaster-deployment.json"));
  clearStagedDeploymentConfig();
  if (isSepolia) {
    const broadcastPath = join(superPaymasterDir, "broadcast/DeployRepCreditSepolia.s.sol/11155111/run-latest.json");
    if (!existsSync(broadcastPath)) throw new Error("Sepolia Forge broadcast receipt file is missing");
    copyFileSync(broadcastPath, join(rawDir, "superpaymaster-broadcast.json"));
  }
  if ((await publicClient.getChainId()) !== chainId) throw new Error("chain id changed after deploy");
  if ((await publicClient.readContract({
    address: deployment.blsAggregator, abi: BLSAggregatorABI, functionName: "defaultThreshold",
  }) as bigint) !== 3n) throw new Error("RepCredit default threshold is not three");

  const airOutput = join(rawDir, "airaccount-deployment.json");
  runLogged("airaccount-build", "forge", ["build"], airDir);
  runLogged("airaccount-deploy", "pnpm", [isSepolia ? "repcredit:deploy:sepolia" : "repcredit:deploy:local"], airDir, {
    REPCREDIT_RPC_URL: rpcUrl,
    REPCREDIT_ENTRYPOINT: deployment.entryPoint,
    REPCREDIT_OUTPUT: airOutput,
    ...(isSepolia ? { REPCREDIT_PRIVATE_KEY: livePrivateKey! } : {}),
  });
  const air = JSON.parse(readFileSync(airOutput, "utf8")) as AirDeployment;
  if (air.version !== "0.31.0") throw new Error(`unexpected AirAccount version ${air.version}`);

  runLogged("yaaa-build", "npm", ["run", "build"], yaaaDir);
  const keyRoot = join(tempRoot, "nodes");
  runLogged("yaaa-generate-ephemeral-keys", "node", ["scripts/e2e/gen-repcredit-nodes.mjs", keyRoot, String(nodeCount)], yaaaDir);
  const validators = await setupValidators(deployment, keyRoot);
  const nodes = await startNodes(deployment, keyRoot);
  const fraudVerifier = deployFraudVerifier(deployment);

  await verifyPublicDeployment(deployment);
  await runE2E(deployment, air, validators, nodes);
  if (!skipMeasurements) await runMeasurements(deployment, validators, nodes);
  await runGuardianExitSlashCompetition(deployment, fraudVerifier, validators, nodes);
  if (isSepolia) await refundValidatorEth(validators);

  redactEvidence();

  const materialFiles = [
    join(rawDir, "superpaymaster-deployment.json"),
    ...(isSepolia ? [join(rawDir, "superpaymaster-broadcast.json")] : []),
    join(rawDir, "airaccount-deployment.json"),
    join(rawDir, "network-preflight.json"),
    join(rawDir, "validator-setup.json"),
    join(rawDir, "e2e.json"),
    join(rawDir, "overissue-verifier-broadcast.json"),
    join(rawDir, "security-controls.json"),
    ...(isSepolia ? [join(rawDir, "validator-refunds.json")] : []),
    ...(skipMeasurements ? [] : [join(rawDir, "measurements.jsonl"), join(derivedDir, "measurement-summary.json")]),
  ];
  const completed = {
    ...manifest,
    completedAt: new Date().toISOString(),
    status: "passed",
    materialPassport: materialFiles.map(path => ({
      path: path.slice(outputDir.length + 1),
      bytes: statSync(path).size,
      sha256: sha256(path),
    })),
  };
  writeJsonExclusive(join(outputDir, "manifest.json"), completed);
  process.stdout.write(`${JSON.stringify({ status: "passed", outputDir, files: completed.materialPassport }, null, 2)}\n`);
}

function clearStagedDeploymentConfig(): void {
  if (!stagedDeploymentConfig) return;
  const path = stagedDeploymentConfig;
  stagedDeploymentConfig = null;
  rmSync(path, { force: true });
}

let cleanedUp = false;

/**
 * The single cleanup path, shared by normal exit and by SIGINT/SIGTERM (CC-50 M2/M3).
 *
 * Before this existed, cleanup lived only in the top-level `finally`, which a signal never runs:
 * Ctrl-C left the ephemeral BLS node keys in /tmp, orphaned anvil plus every YAAA child holding
 * ports 18547 / 29301+, and left the staged deployment config inside the SuperPaymaster checkout.
 * Idempotent, so running it from a handler and then again from `finally` is harmless.
 */
async function cleanup(): Promise<void> {
  if (cleanedUp) return;
  cleanedUp = true;
  await Promise.all(children.reverse().map(child => new Promise<void>(resolveExit => {
    if (child.exitCode !== null || child.signalCode !== null) return resolveExit();
    const timer = setTimeout(resolveExit, 2_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolveExit();
    });
    child.kill("SIGTERM");
  })));
  // Ephemeral validator keys live here; they must not outlive the run.
  rmSync(tempRoot, { recursive: true, force: true });
  clearStagedDeploymentConfig();
}

/**
 * Redact on the signal path too. The success and failure paths both redact, but an interrupted
 * Sepolia run would otherwise leave the live RPC URL and experiment key in the partial evidence —
 * the one exit path that used to skip it entirely, because a signal never reaches `finally`.
 */
function redactOnExit(): void {
  redactEvidence();
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.once(signal, () => {
    // 128 + signal number, the conventional shell encoding of "killed by <signal>".
    let code = signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 129;
    try {
      redactOnExit();
    } catch (error) {
      // Loud and distinct: partial evidence may still hold a secret, so the operator must know.
      process.stderr.write(`redaction failed on ${signal}: ${sanitizeError(error)}\n`);
      code = 1;
    }
    void cleanup().finally(() => process.exit(code));
  });
}

try {
  await main();
} catch (error) {
  redactEvidence();
  const sanitized = sanitizeError(error);
  writeJsonExclusive(join(outputDir, "failure.json"), {
    failedAt: new Date().toISOString(),
    error: sanitized,
  });
  throw new Error(sanitized);
} finally {
  await cleanup();
}
