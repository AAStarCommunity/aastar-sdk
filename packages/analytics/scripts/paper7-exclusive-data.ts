import * as fs from 'fs';
import * as path from 'path';
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';

import { loadNetworkConfig, type NetworkName } from '../tests/regression/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type CliArgs = {
  network: NetworkName;
  cycles: number;
  outDir: string;
  skipCredit: boolean;
  skipReputation: boolean;
  skipSim: boolean;
  deployIfMissing: boolean;
  keepAnvil: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  let network: NetworkName = 'anvil';
  let cycles = 1;
  const defaultOutDir = path.resolve(
    __dirname,
    `../packages/analytics/data/paper7_exclusive/${new Date().toISOString().replace(/[:.]/g, '')}`,
  );
  let outDir = defaultOutDir;
  let skipCredit = false;
  let skipReputation = false;
  let skipSim = false;
  let deployIfMissing: boolean | undefined;
  let keepAnvil = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--network') network = argv[++i] as NetworkName;
    else if (a === '--cycles') cycles = Math.max(1, Number(argv[++i] ?? 1));
    else if (a === '--out-dir') outDir = argv[++i];
    else if (a === '--skip-credit') skipCredit = true;
    else if (a === '--skip-reputation') skipReputation = true;
    else if (a === '--skip-sim') skipSim = true;
    else if (a === '--deploy-if-missing') deployIfMissing = true;
    else if (a === '--skip-deploy') deployIfMissing = false;
    else if (a === '--keep-anvil') keepAnvil = true;
  }

  return {
    network,
    cycles,
    outDir,
    skipCredit,
    skipReputation,
    skipSim,
    deployIfMissing: deployIfMissing ?? network === 'anvil',
    keepAnvil,
  };
}

function run(cmd: string, args: string[], cwd: string, env: Record<string, string | undefined>) {
  const res = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(' ')}`);
  }
}

async function rpcRequest(url: string, method: string, params: unknown[]) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result as unknown;
}

async function isRpcUp(url: string): Promise<boolean> {
  try {
    await rpcRequest(url, 'eth_blockNumber', []);
    return true;
  } catch {
    return false;
  }
}

async function waitForRpc(url: string, attempts: number, delayMs: number) {
  for (let i = 0; i < attempts; i++) {
    if (await isRpcUp(url)) return;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`RPC not reachable: ${url}`);
}

function startAnvil(outDir: string): ChildProcess {
  const logFile = path.resolve(outDir, 'anvil.log');
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');
  const proc = spawn('anvil', ['--port', '8545', '--chain-id', '31337'], {
    stdio: ['ignore', out, err],
    env: process.env,
  });
  fs.writeFileSync(path.resolve(outDir, 'anvil.pid'), String(proc.pid ?? ''));
  return proc;
}

async function ensureAnvil(url: string, outDir: string): Promise<{ started: boolean; proc?: ChildProcess }> {
  if (await isRpcUp(url)) return { started: false };
  const proc = startAnvil(outDir);
  await waitForRpc(url, 30, 500);
  return { started: true, proc };
}

async function ethGetCode(url: string, address: string): Promise<string> {
  const result = await rpcRequest(url, 'eth_getCode', [address, 'latest']);
  return typeof result === 'string' ? result : '';
}

function deploySuperPaymasterAnvil(outDir: string) {
  const superPaymasterDir = path.resolve(__dirname, '../../SuperPaymaster');
  if (!fs.existsSync(superPaymasterDir)) {
    throw new Error(`SuperPaymaster repo not found at ${superPaymasterDir}`);
  }

  const logFile = path.resolve(outDir, 'deploy.log');
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');

  const res = spawnSync(
    'forge',
    [
      'script',
      'contracts/script/v3/DeployAnvil.s.sol:DeployAnvil',
      '--rpc-url',
      'http://127.0.0.1:8545',
      '--broadcast',
      '--private-key',
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    ],
    { cwd: superPaymasterDir, stdio: ['ignore', out, err], env: process.env },
  );
  if (res.status !== 0) {
    throw new Error(`Deploy failed. See ${logFile}`);
  }
}

function syncAnvilConfigFromSuperPaymaster(outDir: string) {
  const superPaymasterConfig = path.resolve(__dirname, '../../SuperPaymaster/deployments/config.anvil.json');
  if (!fs.existsSync(superPaymasterConfig)) {
    throw new Error(`SuperPaymaster anvil config not found at ${superPaymasterConfig}`);
  }
  const sdkConfig = path.resolve(__dirname, '../config.anvil.json');
  const content = fs.readFileSync(superPaymasterConfig, 'utf-8');
  fs.writeFileSync(sdkConfig, content);
  fs.writeFileSync(path.resolve(outDir, 'synced_config.anvil.json'), content);
}

function writeLiquidityVelocityCsv(outFile: string) {
  const T = 60;
  const steps = Array.from({ length: T + 1 }, (_, i) => i);

  const simulate = (mode: 'gas_redeemable' | 'baseline') => {
    let points = 100.0;
    const series: number[] = [];
    for (const t of steps) {
      const activity = 1.0 + 0.015 * t;
      const minted = 4.0 * activity;
      const decay = 0.035 * points;
      const redeem = (mode === 'gas_redeemable' ? 0.11 : 0.04) * points;
      points = Math.max(0.0, points + minted - decay - redeem);
      series.push(points);
    }
    return series;
  };

  const withGas = simulate('gas_redeemable');
  const baseline = simulate('baseline');
  const lines: string[] = [];
  lines.push('day,points_gas_redeemable,points_baseline');
  for (let i = 0; i < steps.length; i++) {
    lines.push(`${steps[i]},${withGas[i].toFixed(6)},${baseline[i].toFixed(6)}`);
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${lines.join('\n')}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let config = loadNetworkConfig(args.network);

  fs.mkdirSync(args.outDir, { recursive: true });

  if (args.network !== 'anvil' && !args.skipCredit) {
    console.log(`WARN: --network ${args.network} does not support credit loop. Skipping credit.`);
    args.skipCredit = true;
  }

  let anvilProc: ChildProcess | undefined;
  if (args.network === 'anvil') {
    const rpcUrl = config.rpcUrl || 'http://127.0.0.1:8545';
    const ensured = await ensureAnvil(rpcUrl, args.outDir);
    if (ensured.started) {
      anvilProc = ensured.proc;
      if (!args.keepAnvil) {
        const kill = () => {
          try {
            anvilProc?.kill('SIGTERM');
          } catch {}
        };
        process.on('exit', kill);
        process.on('SIGINT', () => {
          kill();
          process.exit(130);
        });
        process.on('SIGTERM', () => {
          kill();
          process.exit(143);
        });
      }
    }

    const currentRegistry = config.contracts.registry;
    const currentCode = await ethGetCode(rpcUrl, currentRegistry);
    if (!currentCode || currentCode === '0x') {
      if (!args.deployIfMissing) {
        throw new Error(
          `Registry has no code at ${currentRegistry}. Start anvil + deploy first, or pass --deploy-if-missing.`,
        );
      }
      deploySuperPaymasterAnvil(args.outDir);
      syncAnvilConfigFromSuperPaymaster(args.outDir);
      config = loadNetworkConfig(args.network);
    }

    const registry = config.contracts.registry;
    const code = await ethGetCode(rpcUrl, registry);
    if (!code || code === '0x') {
      throw new Error(`Registry has no code at ${registry} after deploy+sync`);
    }
  }

  if (!args.skipCredit) {
    for (let i = 1; i <= args.cycles; i++) {
      const out = path.resolve(args.outDir, `credit_cycle_${i}.json`);
      run(
        'pnpm',
        ['exec', 'tsx', 'scripts/paper7_credit_loop.ts', '--network', args.network, '--out', out],
        path.resolve(__dirname, '..'),
        {},
      );
    }
  }

  if (!args.skipReputation) {
    const out = path.resolve(args.outDir, `reputation_credit.json`);
    run(
      'pnpm',
      ['exec', 'tsx', 'scripts/paper7_reputation_credit.ts', '--network', args.network, '--out', out],
      path.resolve(__dirname, '..'),
      {},
    );
  }

  if (!args.skipSim) {
    writeLiquidityVelocityCsv(path.resolve(args.outDir, 'liquidity_velocity_simulation.csv'));
  }

  console.log(`OK: outputs in ${args.outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
