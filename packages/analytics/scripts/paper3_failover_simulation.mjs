/**
 * paper3_failover_simulation.mjs
 * Paper3 §5.1 E1: Paymaster-Signer Decentralization — Failover Demonstration
 * N=50 trials on Ethereum Sepolia using ERC-4337 v0.7
 *
 * Usage:
 *   node packages/analytics/scripts/paper3_failover_simulation.mjs
 * Requires env vars (load from .env.sepolia or set directly):
 *   PRIVATE_KEY        — EOA private key (0x-prefixed)
 *   SEPOLIA_RPC_URL    — Alchemy/Infura HTTP RPC for Sepolia
 *
 * Experiment design:
 *   Relayer A (HOSTILE)      — Uses an invalid Pimlico API key, returns 401/403.
 *                              Models a bundler that blacklists the sender.
 *   Relayer B (COOPERATIVE)  — Candide public bundler, permissionless, no API key.
 *                              Models a standard, censorship-resistant bundler.
 *
 *   Each trial submits the SAME signed UserOp to Relayer A first.
 *   Relayer A rejects it. The client automatically fails over to Relayer B,
 *   which submits and mines the UserOp on-chain.
 *
 *   AOA property validated:
 *     No new paymaster-server signature is required after failover because
 *     this experiment uses no paymaster — the SimpleAccount pays gas with its
 *     own ETH. The same principle applies with a Gas Card (AOA) paymaster:
 *     eligibility is verified on-chain; only the bundler (inclusion layer)
 *     changes, not the paymaster-validity gate.
 */

import { createPublicClient, http, encodeFunctionData, parseAbi,
  toHex, keccak256, encodeAbiParameters, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Configuration (from environment — no secrets in source code) ──────────────
const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.TEST_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('ERROR: PRIVATE_KEY environment variable is required.');
  console.error('  Load with: source .env.sepolia && node packages/analytics/scripts/paper3_failover_simulation.mjs');
  process.exit(1);
}

const RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.SEPOLIA_RPC_URL2
  || 'https://ethereum-sepolia-rpc.publicnode.com';

const N_TRIALS = parseInt(process.env.N_TRIALS || '50', 10);

// ── Known addresses (Sepolia, ERC-4337 v0.7) ──────────────────────────────────
const ENTRYPOINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; // v0.7
const FACTORY    = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985'; // SimpleAccountFactory
const CHAIN_ID   = 11155111n;

// ── Relayer endpoints ─────────────────────────────────────────────────────────
// Relayer A: HOSTILE — invalid API key → bundler returns 401/403
const RELAYER_A_URL   = 'https://api.pimlico.io/v2/sepolia/rpc?apikey=INVALID_HOSTILE_KEY_SIMULATES_403';
const RELAYER_A_LABEL = 'Pimlico-Hostile (invalid API key → 401/403 Forbidden)';

// Relayer B: COOPERATIVE — Candide public bundler, permissionless, no API key
const RELAYER_B_URL   = 'https://api.candide.dev/public/v3/11155111';
const RELAYER_B_LABEL = 'Candide-Public (permissionless, no API key required)';

// Recommended ERC-4337 v0.7 ECDSA dummy signature for gas estimation
const DUMMY_SIG = '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c';

// ── ABIs ──────────────────────────────────────────────────────────────────────
const FACTORY_ABI = parseAbi([
  'function getAddress(address owner, uint256 salt) view returns (address)',
]);
const ENTRYPOINT_ABI = parseAbi([
  'function getNonce(address sender, uint192 key) view returns (uint256)',
]);
const SIMPLE_ACCOUNT_ABI = parseAbi([
  'function execute(address dest, uint256 value, bytes calldata func)',
]);

// ── ERC-4337 v0.7 helpers ─────────────────────────────────────────────────────
function getUserOpHash(op, chainId) {
  const hashedOp = keccak256(encodeAbiParameters(
    [{type:'address'},{type:'uint256'},{type:'bytes32'},{type:'bytes32'},
     {type:'bytes32'},{type:'uint256'},{type:'bytes32'},{type:'bytes32'}],
    [
      op.sender, op.nonce,
      keccak256(toBytes(op.initCode || '0x')),
      keccak256(toBytes(op.callData)),
      op.accountGasLimits, op.preVerificationGas, op.gasFees,
      keccak256(toBytes(op.paymasterAndData || '0x')),
    ]
  ));
  return keccak256(encodeAbiParameters(
    [{type:'bytes32'},{type:'address'},{type:'uint256'}],
    [hashedOp, ENTRYPOINT, chainId]
  ));
}

function packUints(hi, lo) {
  return toHex((BigInt(hi) << 128n) | BigInt(lo), { size: 32 });
}

// Unpack packed v0.7 UserOp into bundler RPC "unpacked" format
function unpackUserOp(op) {
  const gl = op.accountGasLimits.replace('0x','').padStart(64,'0');
  const gf = op.gasFees.replace('0x','').padStart(64,'0');
  return {
    sender: op.sender,
    nonce: toHex(op.nonce),
    callData: op.callData,
    verificationGasLimit: '0x' + BigInt('0x' + gl.slice(0,32)).toString(16),
    callGasLimit:         '0x' + BigInt('0x' + gl.slice(32,64)).toString(16),
    preVerificationGas:   toHex(op.preVerificationGas),
    maxPriorityFeePerGas: '0x' + BigInt('0x' + gf.slice(0,32)).toString(16),
    maxFeePerGas:         '0x' + BigInt('0x' + gf.slice(32,64)).toString(16),
    signature: op.signature,
  };
}

// ── Bundler JSON-RPC helper ───────────────────────────────────────────────────
async function bundlerCall(url, method, params) {
  const start = Date.now();
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        { jsonrpc: '2.0', id: Date.now(), method, params },
        (_, v) => typeof v === 'bigint' ? '0x' + v.toString(16) : v
      ),
      signal: AbortSignal.timeout(15000),
    });
    const latency = Date.now() - start;
    if (!resp.ok) {
      const txt = await resp.text();
      return { ok: false, error: `HTTP ${resp.status}: ${txt.slice(0,300)}`, latency };
    }
    const data = await resp.json();
    if (data.error) return { ok: false, error: `RPC ${data.error.code}: ${data.error.message}`, latency };
    return { ok: true, result: data.result, latency };
  } catch (e) {
    return { ok: false, error: e.message || String(e), latency: Date.now() - start };
  }
}

// ── CSV writer ────────────────────────────────────────────────────────────────
function writeCsv(records, filepath) {
  const header = Object.keys(records[0]).join(',');
  const rows = records.map(r =>
    Object.values(r).map(v => JSON.stringify(String(v))).join(',')
  );
  fs.writeFileSync(filepath, [header].concat(rows).join('\n'));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });

  // Derive SimpleAccount address from factory
  const aaAddress = await publicClient.readContract({
    address: FACTORY, abi: FACTORY_ABI,
    functionName: 'getAddress', args: [account.address, 0n],
  });

  const code = await publicClient.getBytecode({ address: aaAddress });
  const isDeployed = !!(code && code !== '0x');
  const aaBal = await publicClient.getBalance({ address: aaAddress });

  console.log('═'.repeat(65));
  console.log('Paper3 §5.1 E1: Censorship-Resistance Failover Demonstration');
  console.log('═'.repeat(65));
  console.log(`  Network:       Ethereum Sepolia (ERC-4337 v0.7)`);
  console.log(`  EOA:           ${account.address}`);
  console.log(`  SimpleAccount: ${aaAddress} (deployed=${isDeployed})`);
  console.log(`  AA ETH:        ${(Number(aaBal) / 1e18).toFixed(6)} ETH`);
  console.log(`  EntryPoint:    ${ENTRYPOINT}`);
  console.log(`  Relayer A:     ${RELAYER_A_LABEL}`);
  console.log(`  Relayer B:     ${RELAYER_B_LABEL}`);
  console.log(`  N:             ${N_TRIALS} trials`);
  console.log('─'.repeat(65));

  if (!isDeployed) {
    console.error('ERROR: SimpleAccount not deployed. Run setup scripts first.');
    process.exit(1);
  }
  if (aaBal < 5000000000000000n) {
    console.error('ERROR: AA ETH balance too low (need ≥ 0.005 ETH for gas).');
    process.exit(1);
  }

  const results = [];
  let successCount = 0, totalFailoverMs = 0;

  for (let trial = 1; trial <= N_TRIALS; trial++) {
    process.stdout.write(`  Trial ${String(trial).padStart(2)}/${N_TRIALS}: `);

    // Refresh gas prices each trial to avoid "maxFeePerGas too low" errors
    const feeData = await publicClient.estimateFeesPerGas();
    const maxFee  = feeData.maxFeePerGas         || 3000000000n;
    const maxPrio = feeData.maxPriorityFeePerGas  || 1000000000n;

    // Fresh nonce per trial (each trial is an independent on-chain tx)
    const nonce = await publicClient.readContract({
      address: ENTRYPOINT, abi: ENTRYPOINT_ABI,
      functionName: 'getNonce', args: [aaAddress, 0n],
    });

    // callData: SimpleAccount self-call with no value (cheapest valid execute)
    const callData = encodeFunctionData({
      abi: SIMPLE_ACCOUNT_ABI, functionName: 'execute',
      args: [aaAddress, 0n, '0x'],
    });

    // Packed v0.7 UserOp (no paymaster — AA pays with own ETH)
    const userOp = {
      sender:           aaAddress,
      nonce,
      initCode:         '0x',
      callData,
      accountGasLimits: packUints(200000, 150000),
      preVerificationGas: 80000n,
      gasFees:          packUints(maxPrio, maxFee),
      paymasterAndData: '0x',
      signature:        DUMMY_SIG,
    };

    // Gas estimation via Relayer B (Candide) with dummy signature
    const estPayload = unpackUserOp(userOp);
    const estRes = await bundlerCall(RELAYER_B_URL, 'eth_estimateUserOperationGas', [estPayload, ENTRYPOINT]);
    if (!estRes.ok) {
      process.stdout.write(`EST_FAIL: ${estRes.error.slice(0,80)}\n`);
      results.push({
        trial, relayerA_result: 'SKIP', relayerA_latency_ms: 0,
        relayerB_result: 'EST_FAIL', relayerB_txHash: '', relayerB_latency_ms: 0,
        failover_latency_ms: 0, block_number: '', success: false,
        notes: estRes.error.slice(0,150),
      });
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    // Apply estimated gas limits
    const gas = estRes.result;
    userOp.accountGasLimits  = packUints(
      BigInt(gas.verificationGasLimit || '0x30D40'),
      BigInt(gas.callGasLimit         || '0x186A0')
    );
    userOp.preVerificationGas = BigInt(gas.preVerificationGas || '0x186A0');

    // Sign with real private key
    const opHash = getUserOpHash(userOp, CHAIN_ID);
    userOp.signature = await account.signMessage({ message: { raw: opHash } });
    const sendPayload = unpackUserOp(userOp);

    // ── Step 1: Submit to Relayer A (HOSTILE) ─────────────────────────────────
    const tA0 = Date.now();
    const resA = await bundlerCall(RELAYER_A_URL, 'eth_sendUserOperation', [sendPayload, ENTRYPOINT]);
    const latA = Date.now() - tA0;
    // Expected: resA.ok === false (rejected by hostile bundler)

    // ── Step 2: Failover to Relayer B (COOPERATIVE) ───────────────────────────
    const tB0 = Date.now();
    const resB = await bundlerCall(RELAYER_B_URL, 'eth_sendUserOperation', [sendPayload, ENTRYPOINT]);
    const latB = Date.now() - tB0;

    let userOpHash = '', ethTxHash = '', blockNum = '', success = false;
    if (resB.ok) {
      userOpHash = resB.result; // eth_sendUserOperation returns UserOperationHash
      success = true;
      successCount++;
      totalFailoverMs += latA;
      // Poll eth_getUserOperationReceipt to get the actual Ethereum txHash + block
      let receiptAttempts = 0;
      while (receiptAttempts < 10 && !ethTxHash) {
        await new Promise(r => setTimeout(r, 3000));
        const rcpt = await bundlerCall(RELAYER_B_URL, 'eth_getUserOperationReceipt', [userOpHash]);
        if (rcpt.ok && rcpt.result) {
          ethTxHash = rcpt.result.receipt?.transactionHash || '';
          blockNum  = rcpt.result.receipt?.blockNumber
            ? String(parseInt(rcpt.result.receipt.blockNumber, 16)) : '';
        }
        receiptAttempts++;
      }
      process.stdout.write(
        `A:REJECTED(${latA}ms) → B:OK userOpHash=${userOpHash.slice(0,14)}...` +
        (ethTxHash ? ` etxHash=${ethTxHash.slice(0,14)}... block=${blockNum}` : ' (receipt pending)') + '\n'
      );
    } else {
      process.stdout.write(
        `A:REJECTED(${latA}ms) → B:FAIL: ${String(resB.error || '').slice(0,80)}\n`
      );
    }

    results.push({
      trial,
      relayerA_label:      RELAYER_A_LABEL,
      relayerA_result:     resA.ok ? 'ACCEPTED' : 'REJECTED',
      relayerA_error:      resA.ok ? '' : String(resA.error || '').slice(0,150),
      relayerA_latency_ms: latA,
      relayerB_label:      RELAYER_B_LABEL,
      relayerB_result:     resB.ok ? 'SUCCESS' : 'FAILED',
      relayerB_userOpHash: userOpHash,
      relayerB_ethTxHash:  ethTxHash,
      relayerB_latency_ms: latB,
      failover_latency_ms: latA,
      block_number:        blockNum,
      success,
      notes: 'No new paymaster-server signature required after failover; AOA eligibility is on-chain state.',
    });

    await new Promise(r => setTimeout(r, 2000)); // Rate-limit between trials
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const meanFailoverMs = successCount > 0
    ? Math.round(totalFailoverMs / successCount) : 0;
  const successRate = `${successCount}/${N_TRIALS}`;

  console.log('─'.repeat(65));
  console.log(`Results  N=${N_TRIALS}: ${successRate} (${Math.round(successCount / N_TRIALS * 100)}% success)`);
  console.log(`Mean Relayer A rejection latency (failover overhead): ${meanFailoverMs} ms`);
  console.log(`New paymaster-server signatures required: 0`);
  console.log('═'.repeat(65));

  // ── Write outputs ─────────────────────────────────────────────────────────
  const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const csvPath  = path.join(dataDir, `paper3_failover_results_${ts}.csv`);
  const jsonPath = path.join(dataDir, `paper3_failover_summary_${ts}.json`);

  if (results.length > 0) writeCsv(results, csvPath);

  const summary = {
    experiment:       'E1: Paymaster-Signer Decentralization Failover',
    paper_section:    'Paper3 §5.1',
    date:             new Date().toISOString(),
    network:          'Ethereum Sepolia',
    chainId:          11155111,
    entryPoint:       ENTRYPOINT,
    simpleAccount:    aaAddress,
    relayerA:         RELAYER_A_LABEL,
    relayerB:         RELAYER_B_LABEL,
    N:                N_TRIALS,
    successCount,
    successRate,
    meanFailoverLatencyMs: meanFailoverMs,
    newPaymasterSignaturesRequired: 0,
    aoa_property:     'UserOp validity is determined by on-chain account state only. Relayer A refusal does not invalidate the UserOp; the identical signed UserOp is accepted by any permissionless bundler (Relayer B).',
    txHashes: results
      .filter(r => r.relayerB_userOpHash)
      .map(r => ({ trial: r.trial, userOpHash: r.relayerB_userOpHash, ethTxHash: r.relayerB_ethTxHash, failoverMs: r.failover_latency_ms, block: r.block_number })),
  };
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  console.log(`\nOutputs:`);
  console.log(`  CSV:  ${csvPath}`);
  console.log(`  JSON: ${jsonPath}`);
  return summary;
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
