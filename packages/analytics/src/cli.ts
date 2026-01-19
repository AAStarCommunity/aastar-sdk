#!/usr/bin/env node

/**
 * Analytics CLI
 * Usage: npx tsx packages/analytics/src/cli.ts analyze <txHash>
 */

import { TransactionAnalyzer } from './analyzers/TransactionAnalyzer.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.sepolia' });

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'analyze') {
    const txHash = args[1] as `0x${string}`;
    if (!txHash) {
      console.error('Please provide a transaction hash');
      process.exit(1);
    }
    
    const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL_SEPOLIA;
    if (!rpcUrl) throw new Error('Missing RPC URL');
    
    const analyzer = new TransactionAnalyzer(rpcUrl);
    const report = await analyzer.analyze(txHash);
    console.log(report);
    
  } else {
    console.log(`
Usage:
  npx tsx packages/analytics/src/cli.ts analyze <txHash>
    `);
  }
}

main().catch(console.error);
