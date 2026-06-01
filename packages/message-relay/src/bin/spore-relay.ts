#!/usr/bin/env node
// spore-relay: CLI entry point for the Spore Protocol Relay Node
// Environment variables:
//   PORT                    WebSocket server port (default: 7777)
//   SPORE_OPERATOR_ADDRESS  ETH address that receives USDC payment commitments
//   SPORE_MIN_FEE_USDC      Minimum fee per message in 6-decimal USDC (default: 1000 = 0.001 USDC)
//   SPORE_REQUIRE_PAYMENT   "true"|"false" — enable EIP-3009 payment gating (default: "false")
//   SPORE_DB_PATH           SQLite database file path (default: ./spore-relay.db)
//   SPORE_CHAIN_ID          Chain ID for EIP-3009 verification (default: 10 = Optimism)
//   SPORE_USDC_ADDRESS      USDC token contract address on target chain
//   SPORE_REGISTER          If set to "true", register to RelayRegistry.sol on startup (requires REGISTRY_ADDRESS + PRIVATE_KEY)
//   REGISTRY_ADDRESS        SporeRelayRegistry contract address
//   PRIVATE_KEY             Operator private key (0x-prefixed) for on-chain registration
//   RPC_URL                 JSON-RPC endpoint for on-chain registration (default: Optimism public)
//   DEBUG                   "true"|"false" — verbose logging

import { SporeRelayNode } from '../SporeRelayNode.js';
import { SqliteEventStore } from '../storage/SqliteEventStore.js';
import { PaymentValidator } from '../middleware/PaymentValidator.js';
import { RelayRegistryClient } from '../registry/RelayRegistryClient.js';

// ─── Configuration from environment ──────────────────────────────────────

const PORT = parseInt(process.env['PORT'] ?? '7777', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const DB_PATH = process.env['SPORE_DB_PATH'] ?? './spore-relay.db';
const REQUIRE_PAYMENT = process.env['SPORE_REQUIRE_PAYMENT'] === 'true';
const DEBUG = process.env['DEBUG'] === 'true';
const OPERATOR_ADDRESS = (process.env['SPORE_OPERATOR_ADDRESS'] ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;
const MIN_FEE_USDC = BigInt(process.env['SPORE_MIN_FEE_USDC'] ?? '1000');
const CHAIN_ID = parseInt(process.env['SPORE_CHAIN_ID'] ?? '10', 10);
const USDC_ADDRESS = (process.env['SPORE_USDC_ADDRESS'] ?? '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85') as `0x${string}`;
const SHOULD_REGISTER = process.env['SPORE_REGISTER'] === 'true';

// ─── Startup ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      Spore Protocol Relay Node           ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  Port        : ${PORT}`);
  console.log(`  DB path     : ${DB_PATH}`);
  console.log(`  Payment gate: ${REQUIRE_PAYMENT ? 'ENABLED' : 'disabled (dev mode)'}`);
  if (REQUIRE_PAYMENT) {
    console.log(`  Operator    : ${OPERATOR_ADDRESS}`);
    console.log(`  Min fee     : ${MIN_FEE_USDC} USDC-wei (${Number(MIN_FEE_USDC) / 1e6} USDC)`);
    console.log(`  Chain ID    : ${CHAIN_ID}`);
  }
  console.log('');

  // Initialize storage
  const store = new SqliteEventStore(DB_PATH);

  // Optionally enable payment validation
  const paymentValidator = REQUIRE_PAYMENT
    ? new PaymentValidator({
        minFeeUsdc: MIN_FEE_USDC,
        operatorAddress: OPERATOR_ADDRESS,
        usdcAddress: USDC_ADDRESS,
        chainId: CHAIN_ID,
      })
    : undefined;

  // Start relay
  const relay = new SporeRelayNode({
    port: PORT,
    host: HOST,
    store,
    paymentValidator,
    debug: DEBUG,
  });

  relay.start();
  console.log(`Relay listening at ws://${HOST}:${PORT}`);
  console.log(`Connect any NIP-01 client or nostr-tools WebSocket to this URL.`);
  console.log('');

  // Optional on-chain registration
  if (SHOULD_REGISTER) {
    await registerOnChain();
  }

  // ─── Graceful shutdown ─────────────────────────────────────────────────

  async function shutdown(signal: string): Promise<void> {
    console.log(`\nReceived ${signal}. Shutting down...`);

    const stats = relay.operator.getPendingStats();
    if (stats.count > 0) {
      console.log(`Settling ${stats.count} pending vouchers before exit...`);
      await relay.operator.settleNow();
    }

    await relay.stop();
    console.log('Relay stopped cleanly.');
    process.exit(0);
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

async function registerOnChain(): Promise<void> {
  const registryAddress = process.env['REGISTRY_ADDRESS'] as `0x${string}` | undefined;
  const privateKey = process.env['PRIVATE_KEY'] as `0x${string}` | undefined;
  const rpcUrl = process.env['RPC_URL'] ?? 'https://mainnet.optimism.io';
  const wsUrl = process.env['SPORE_WS_URL'] ?? `ws://localhost:${PORT}`;

  if (!registryAddress || !privateKey) {
    console.warn('[register] REGISTRY_ADDRESS or PRIVATE_KEY not set — skipping on-chain registration.');
    return;
  }

  try {
    const { privateKeyToAccount } = await import('viem/accounts');
    const account = privateKeyToAccount(privateKey);

    const registry = new RelayRegistryClient(registryAddress, rpcUrl, account);
    const txHash = await registry.register({
      wsUrl,
      minFeeUsdc: MIN_FEE_USDC,
      supportedKinds: [1, 4, 1059, 23405], // text notes, DMs, gift-wrap, payment commitments
    });

    console.log(`[register] On-chain registration submitted: ${txHash}`);
  } catch (err) {
    console.error(`[register] Failed to register on-chain: ${err}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
