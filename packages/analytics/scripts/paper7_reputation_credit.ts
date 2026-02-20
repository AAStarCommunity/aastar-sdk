import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  keccak256,
  parseAbi,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import { loadNetworkConfig, type NetworkName } from '../tests/regression/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

type CliArgs = {
  network: NetworkName;
  out?: string;
  account?: Address;
  useCast?: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  let network: NetworkName = 'anvil';
  let out: string | undefined;
  let account: Address | undefined;
  let useCast: boolean | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--network') {
      network = argv[++i] as NetworkName;
    } else if (a === '--out') {
      out = argv[++i];
    } else if (a === '--account') {
      account = argv[++i] as Address;
    } else if (a === '--use-cast') {
      useCast = true;
    }
  }

  return { network, out, account, useCast };
}

const decryptedKeys: Record<string, Hex> = {};
function getPrivateKeyFromCast(accountName: string): Hex {
  if (decryptedKeys[accountName]) return decryptedKeys[accountName];

  let castCmd = 'cast';
  try {
    execSync('which cast', { stdio: 'ignore' });
  } catch {
    const commonPaths = [
      path.join(process.env.HOME || '', '.foundry/bin/cast'),
      '/usr/local/bin/cast',
      '/opt/homebrew/bin/cast',
    ];
    const found = commonPaths.find((p) => fs.existsSync(p));
    if (found) castCmd = found;
  }

  const result = execSync(`${castCmd} wallet decrypt-keystore ${accountName}`, {
    encoding: 'utf-8',
    stdio: ['inherit', 'pipe', 'inherit'],
    env: {
      ...process.env,
      PATH: `${process.env.PATH}:/usr/local/bin:${path.join(process.env.HOME || '', '.foundry/bin')}`,
    },
  }).trim();

  const match = result.match(/(?:0x)?([a-fA-F0-9]{64})/);
  if (!match) throw new Error(`No private key found in cast output for ${accountName}`);

  const key = `0x${match[1]}` as Hex;
  decryptedKeys[accountName] = key;
  return key;
}

function loadState(networkName: string): any {
  const stateFile = path.resolve(__dirname, `l4-state.${networkName}.json`);
  if (!fs.existsSync(stateFile)) return { operators: {}, aaAccounts: [] };
  return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadNetworkConfig(args.network);
  const state = loadState(args.network);

  const registry = config.contracts.registry;
  const reputationSystem = config.contracts.reputation as Address;
  const superPaymaster = config.contracts.superPaymaster;

  const defaultAccountC =
    (state?.aaAccounts?.[0]?.address as Address | undefined) ||
    ('0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address);
  const accountC = args.account ?? defaultAccountC;

  const shouldUseCast = args.useCast ?? (args.network !== 'anvil');
  const signerKey: Hex = shouldUseCast
    ? getPrivateKeyFromCast(process.env.DEPLOYER_ACCOUNT || 'optimism-deployer')
    : ((process.env.ADMIN_KEY ||
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex);

  const publicClient = createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });
  const signer = privateKeyToAccount(signerKey);
  const wallet = createWalletClient({ account: signer, chain: config.chain, transport: http(config.rpcUrl) });

  const regAbi = parseAbi([
    'function globalReputation(address) view returns (uint256)',
    'function getCreditLimit(address) view returns (uint256)',
  ]);

  const repAbi = parseAbi([
    'function computeScore(address, address[], bytes32[][], uint256[][]) view returns (uint256)',
    'function syncToRegistry(address, address[], bytes32[][], uint256[][], uint256, bytes)',
    'function setEntropyFactor(address, uint256)',
    'function setRule(bytes32, uint256, uint256, uint256, string)',
  ]);

  const pmAbi = parseAbi([
    'function operators(address) view returns (uint128 balance, uint96 exRate, bool isConfigured, bool isPaused, address xPNTsToken, uint32 reputation, address treasury, uint256 spent, uint256 txSponsored)',
  ]);

  const ruleId = keccak256(toHex('PAPER7_RULE'));
  const txRule = await wallet.writeContract({
    address: reputationSystem,
    abi: repAbi,
    functionName: 'setRule',
    args: [ruleId, 50n, 5n, 100n, 'Paper7 Rule'],
  });
  const setRuleReceipt = await publicClient.waitForTransactionReceipt({ hash: txRule });

  const abiRegSet = parseAbi(['function setReputationSource(address, bool)']);
  const txAuth = await wallet.writeContract({
    address: registry,
    abi: abiRegSet,
    functionName: 'setReputationSource',
    args: [reputationSystem, true],
  });
  const setRepSourceReceipt = await publicClient.waitForTransactionReceipt({ hash: txAuth });

  const txEntropy = await wallet.writeContract({
    address: reputationSystem,
    abi: repAbi,
    functionName: 'setEntropyFactor',
    args: [signer.address, 800000000000000000n],
  });
  const setEntropyReceipt = await publicClient.waitForTransactionReceipt({ hash: txEntropy });

  const communities = [signer.address];
  const ruleIds = [[ruleId]];
  const activities = [[10n]];
  const score = (await publicClient.readContract({
    address: reputationSystem,
    abi: repAbi,
    functionName: 'computeScore',
    args: [accountC, communities, ruleIds, activities],
  })) as bigint;

  const { encodeAbiParameters, parseAbiParameters } = await import('viem');
  const require = createRequire(import.meta.url);
  const { bls12_381 } = require('@noble/curves/bls12-381');

  const privKey = bls12_381.utils.randomPrivateKey();
  const pkPoint = bls12_381.G1.ProjectivePoint.fromPrivateKey(privKey);
  const pkRaw = pkPoint.toRawBytes(false);
  const pkX = pkRaw.slice(0, 48);
  const pkY = pkRaw.slice(48, 96);
  const pkX_padded = new Uint8Array(64);
  pkX_padded.set(pkX, 16);
  const pkY_padded = new Uint8Array(64);
  pkY_padded.set(pkY, 16);
  const pkHex = toHex(pkX_padded).slice(2) + toHex(pkY_padded).slice(2);

  function padG2(raw: Uint8Array): string {
    const x_c0 = raw.slice(0, 48);
    const x_c1 = raw.slice(48, 96);
    const y_c0 = raw.slice(96, 144);
    const y_c1 = raw.slice(144, 192);

    const x_c0_p = new Uint8Array(64);
    x_c0_p.set(x_c0, 16);
    const x_c1_p = new Uint8Array(64);
    x_c1_p.set(x_c1, 16);
    const y_c0_p = new Uint8Array(64);
    y_c0_p.set(y_c0, 16);
    const y_c1_p = new Uint8Array(64);
    y_c1_p.set(y_c1, 16);

    return (
      toHex(x_c1_p).slice(2) +
      toHex(x_c0_p).slice(2) +
      toHex(y_c1_p).slice(2) +
      toHex(y_c0_p).slice(2)
    );
  }

  const msgBytes = new TextEncoder().encode('Paper7 Reputation Update');
  const msgPoint = bls12_381.G2.hashToCurve(msgBytes);
  const msgRaw = msgPoint.toRawBytes(false);
  const sigPoint = msgPoint.multiply(BigInt(toHex(privKey)));
  const sigRaw = sigPoint.toRawBytes(false);

  const proof = encodeAbiParameters(parseAbiParameters('bytes, bytes, bytes, uint256'), [
    (`0x${pkHex}` as Hex),
    (`0x${padG2(sigRaw)}` as Hex),
    (`0x${padG2(msgRaw)}` as Hex),
    0xffffn,
  ]);

  const txSync = await wallet.writeContract({
    address: reputationSystem,
    abi: repAbi,
    functionName: 'syncToRegistry',
    args: [accountC, communities, ruleIds, activities, 1n, proof],
  });
  const syncReceipt = await publicClient.waitForTransactionReceipt({ hash: txSync });

  const opData = (await publicClient.readContract({
    address: superPaymaster,
    abi: pmAbi,
    functionName: 'operators',
    args: [signer.address],
  })) as unknown as any[];

  const globalRep = (await publicClient.readContract({
    address: registry,
    abi: regAbi,
    functionName: 'globalReputation',
    args: [accountC],
  })) as bigint;

  const creditLimit = (await publicClient.readContract({
    address: registry,
    abi: regAbi,
    functionName: 'getCreditLimit',
    args: [accountC],
  })) as bigint;

  const summary = {
    network: args.network,
    signer: signer.address,
    accountC,
    score: score.toString(),
    globalReputation: globalRep.toString(),
    creditLimitWei: creditLimit.toString(),
    creditLimitEth: formatEther(creditLimit),
    operatorReputation: opData?.[5]?.toString?.() ?? String(opData?.[5]),
    gasUsed: {
      setRule: setRuleReceipt.gasUsed.toString(),
      setReputationSource: setRepSourceReceipt.gasUsed.toString(),
      setEntropy: setEntropyReceipt.gasUsed.toString(),
      syncToRegistry: syncReceipt.gasUsed.toString(),
    },
    tx: {
      setRule: txRule,
      setReputationSource: txAuth,
      setEntropy: txEntropy,
      syncToRegistry: txSync,
    },
  };

  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(summary, null, 2));
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
