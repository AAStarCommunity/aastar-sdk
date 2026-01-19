import { createPublicClient, http, parseAbiItem, formatEther, formatUnits } from 'viem';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load Env
const envPath = path.resolve(__dirname, '../../../../.env.sepolia');
dotenv.config({ path: envPath });

const RPC_URL = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.public.blastapi.io";

const client = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

// Hashes from logs
// Including both V4 (Community) and SuperPaymaster (Protocol) transactions
const TX_HASHES = [
  // SuperPaymaster Transactions (from l4_regression_sepolia_20260119_100638.log)
  "0x1d4ec2a01d53a4a4427474605cdac45d92706efe0facfb3ba932b97ff91194fc", 
  "0xba5115b3d53c823d148e91cb2bfb3a1d743c30ab82b5cec992e654954870827f",

  // V4 Transactions (from previous logs)
  "0x4e2fe9b95ddb6064905bb04657baeb633918e914b36f82afbbc7002c1ffc22dc",
  "0xef52f0e556415acbbd19220ff1c63cdbd5383cb50c02c7828dd5d2e3a818c3b6",
  "0xc6dc5467ae2b556982fac5892ce05abd28c5b58ffa66af0389a8662794079fec",
  "0xbf6124a30999c8fc24b027a17d28ae1085316deef7793c180b5e609363da231c",
  "0xf25491c67a995937efc37c910f92616587a498166cd3f822eb402e115dd6de4e",
  "0xc9973c7daf0d6b20c0d4c26f448d6bfb7b1e5678635996898f4b1ca932a7462f",
  "0xd275eacbb09c057bf20ca4816fa2cd8fde03f3a6975dc5caac22fac7521405ad",
  "0xac785945e54d3b25a1a7e67c255bc74afc927538646a8447f168c05cfc30e5bc",
  "0xdd1be04e642a8e90ef248309f2934b22b5d75f141ac1b20f30fef946233d7845",
  "0x7e9768afde560caf5d2cecd2a0a717b17b5bb6cdd67dd468f7ac9a22f0983659",
  "0x84905a03b76ef2b5daee282f440e71a2a735ae9ab055d16d56f5aa06ee46d2cb",
  "0xcefeeac7a65828be1d9aa5e71c90e6734a6c5e0072215dfbbfd38dfb5bc9bbbd",
  "0x8670eefee7e365b44520d61e4fa01cc7b4c65aa9e82f894abdd8434aa6bda4cb",
  "0x006079e61cde14f97c321a3327831d3e8c983fddfc238449ba6b60d261794606"
];

async function loadBaselines() {
    try {
        const dataPath = path.resolve(__dirname, '../../../../data/industry_baseline_latest.json');
        const content = fs.readFileSync(dataPath, 'utf8');
        const data = JSON.parse(content);
        const baselines: Record<string, number> = {};
        
        data.chains.forEach((c: any) => {
            if (c.perUserOp > 0) {
                baselines[c.name] = c.perUserOp;
            }
        });
        return baselines;
    } catch (e) {
        console.warn("⚠️ Failed to load baselines from file, using fallback.");
        return {
            "OP Mainnet": 0.02,
            "Arbitrum One": 0.64,
            "Starknet": 8.5
        };
    }
}

async function main() {
  const baselines = await loadBaselines();
  
  console.log("# 📊 AAStar Gasless Cost Analysis Report\n");
  console.log(`Analyzing ${TX_HASHES.length} transactions from Sepolia logs...\n`);

  let metrics = {
      v4: { count: 0, gasUsed: 0n, ethCost: 0n, pntUsed: 0n },
      super: { count: 0, gasUsed: 0n, ethCost: 0n, aPNTs: 0n, xPNTs: 0n }
  };

  for (const hash of TX_HASHES) {
    try {
      const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
      if (receipt.status !== 'success') continue;

      const gasUsed = receipt.gasUsed;
      const effectiveGasPrice = receipt.effectiveGasPrice;
      const nativeCost = gasUsed * effectiveGasPrice;

      // Identify Type & Parse Logs
      let isSuper = false;
      let pntV4 = 0n;
      let aPNTs = 0n;
      let xPNTs = 0n;

      for (const log of receipt.logs) {
          // Check for SuperPaymaster Event: TransactionSponsored
          if (log.topics.length === 3 && log.data.length === 130 && log.address.toLowerCase() === '0xe74304cc5860b950a45967e12321dff8b5cdcaa0') {
              isSuper = true;
              aPNTs = BigInt("0x" + log.data.slice(2, 66));
              xPNTs = BigInt("0x" + log.data.slice(66, 130));
          }
          
          // Check for V4 Event: GasPaymentProcessed
          if (!isSuper && log.topics.length === 3 && log.data.length === 194) {
             if (log.topics[0] === '0x62544d7f48b11c32334310ebd306b47224fca220163218d4a7264322c52ae073') {
                 pntV4 = BigInt("0x" + log.data.slice(2, 66));
             }
          }
      }

      if (isSuper) {
          metrics.super.count++;
          metrics.super.gasUsed += gasUsed;
          metrics.super.ethCost += nativeCost;
          metrics.super.aPNTs += aPNTs;
          metrics.super.xPNTs += xPNTs;
      } else {
          metrics.v4.count++;
          metrics.v4.gasUsed += gasUsed;
          metrics.v4.ethCost += nativeCost;
          metrics.v4.pntUsed += pntV4;
      }

    } catch (e) {
      console.error(`Error processing ${hash}:`, e);
    }
  }

  // --- Report Generation ---
  
  const ETH_PRICE = 3300;
  
  // Calculate Averages
  const superAvgGas = metrics.super.count > 0 ? Number(metrics.super.gasUsed) / metrics.super.count : 0;
  const superAvgEth = metrics.super.count > 0 ? Number(formatEther(metrics.super.ethCost)) / metrics.super.count : 0;
  const superAvgUsd = superAvgEth * ETH_PRICE;
  const superAvgApnts = metrics.super.count > 0 ? Number(formatUnits(metrics.super.aPNTs, 18)) / metrics.super.count : 0;
  const superAvgXpnts = metrics.super.count > 0 ? Number(formatUnits(metrics.super.xPNTs, 18)) / metrics.super.count : 0;

  const v4AvgGas = metrics.v4.count > 0 ? Number(metrics.v4.gasUsed) / metrics.v4.count : 0;
  const v4AvgEth = metrics.v4.count > 0 ? Number(formatEther(metrics.v4.ethCost)) / metrics.v4.count : 0;
  const v4AvgUsd = v4AvgEth * ETH_PRICE;
  const v4AvgPnt = metrics.v4.count > 0 ? Number(formatUnits(metrics.v4.pntUsed, 18)) / metrics.v4.count : 0;

  console.log("## 1. Cost Overview by Mode\n");
  console.log("| Metric | Paymaster V4 (Community) | SuperPaymaster (Protocol) |");
  console.log("| :--- | :--- | :--- |");
  console.log(`| **Sample Size** | ${metrics.v4.count} txs | ${metrics.super.count} txs |`);
  console.log(`| **Avg Gas Used** | ${v4AvgGas.toFixed(0)} | ${superAvgGas.toFixed(0)} |`);
  console.log(`| **L1 Cost (ETH)** | ${v4AvgEth.toFixed(6)} | ${superAvgEth.toFixed(6)} |`);
  console.log(`| **L1 Cost (USD)** | $${v4AvgUsd.toFixed(2)} | $${superAvgUsd.toFixed(2)} |`);
  console.log(`| **Protocol (aPNTs)** | ${v4AvgPnt.toFixed(4)} | ${superAvgApnts.toFixed(4)} |`);
  console.log(`| **User (xPNTs)** | N/A | ${superAvgXpnts.toFixed(4)} |`);

  const weightedAvgUsd = (metrics.v4.count * v4AvgUsd + metrics.super.count * superAvgUsd) / (metrics.v4.count + metrics.super.count);

  console.log("\n## 2. Comparative Analysis (vs Industry Baseline)\n");
  console.log(`*Baseline comparison based on weighted average cost: $${weightedAvgUsd.toFixed(2)}*`);
  console.log("| Chain / Solution | Cost per Op (USD) | vs AAStar |");
  console.log("| :--- | :--- | :--- |");
  
  // Sort baselines by cost
  const sortedBaselines = Object.entries(baselines).sort((a, b) => a[1] - b[1]);
  
  for (const [name, cost] of sortedBaselines) {
      const ratio = cost / weightedAvgUsd;
      const indicator = ratio > 1.0 ? "✅ Cheaper" : "❌ More Expensive";
      if (ratio > 0.8 && ratio < 1.2) {
           console.log(`| **${name}** | $${cost.toFixed(2)} | **~1.0x (Parity)** |`);
      } else {
           console.log(`| ${name} | $${cost.toFixed(2)} | ${ratio.toFixed(2)}x (${indicator}) |`);
      }
  }

  console.log("\n## 3. Gas Breakdown & Overhead\n");
  const overheadV4 = v4AvgGas - 21000;
  const overheadSuper = superAvgGas - 21000;
  
  console.log(`- **Vanilla Transfer:** ~21,000 gas`);
  console.log(`- **V4 Overhead:** ~${overheadV4.toFixed(0)} gas (${((overheadV4/v4AvgGas)*100).toFixed(1)}%)`);
  console.log(`- **SuperPM Overhead:** ~${overheadSuper.toFixed(0)} gas (${((overheadSuper/superAvgGas)*100).toFixed(1)}%)`);
  console.log(`  - *Note: SuperPM incurs additional logic for xPNTs->aPNTs conversion and Treasury checks.*
`);

  console.log("*(Generated via packages/analytics/src/gas-analyzer.ts)*");
}

main().catch(console.error);