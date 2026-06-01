/**
 * Spore Protocol POC — end-to-end demo script
 *
 * Demonstrates:
 *   1. AirAccount EOA → Nostr identity (same private key, zero conversion)
 *   2. NIP-17 gift-wrap DM: Agent A sends encrypted message to Agent B
 *   3. SporeAgent event API (mirrors XMTP agent-sdk)
 *   4. kind:23405 Pay-per-Store commitment tag
 *   5. M2 bridge registration: enableX402 / enableChannel / enableUserOp
 *
 * Usage:
 *   export SPORE_WALLET_KEY=0x<64-hex-chars>
 *   pnpm exec tsx scripts/spore_poc.ts
 *
 * For two-agent demo, run two terminals with different SPORE_WALLET_KEY values
 * and set SPORE_RECIPIENT_PUBKEY to the other agent's pubkey in each terminal.
 */

import { SporeAgent } from '../packages/messaging/src/index.js';
import { createIdentityFromEnv } from '../packages/messaging/src/identity/AirAccountIdentity.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const DEMO_MODE = process.env['SPORE_DEMO_MODE'] ?? 'echo'; // 'echo' | 'send'
const RECIPIENT_PUBKEY = process.env['SPORE_RECIPIENT_PUBKEY']; // optional

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Spore Protocol POC ===\n');

  // 1. Derive identity
  const identity = await createIdentityFromEnv();
  console.log(`EOA Address  : ${identity.address}`);
  console.log(`Nostr Pubkey : ${identity.pubkey}`);
  console.log(`  (same secp256k1 key serves both Ethereum and Nostr)\n`);

  // 2. Create agent
  const agent = await SporeAgent.createFromEnv();
  console.log('SporeAgent created.');
  console.log(`Relays       : ${process.env['SPORE_RELAYS'] ?? 'default (damus, nostr.band, nos.lol)'}`);
  console.log('');

  // 3. Register event handlers
  agent.on('text', async (ctx) => {
    const { message } = ctx;
    console.log(`\n[RECV] from ${message.senderPubkey.slice(0, 16)}... | conv: ${message.conversation.id.slice(0, 12)}...`);
    console.log(`       content: "${message.content}"`);

    // Echo back
    if (DEMO_MODE === 'echo') {
      const reply = `Echo @ ${new Date().toISOString()}: ${message.content}`;
      await ctx.conversation.sendText(reply);
      console.log(`[SEND] echo reply sent`);
    }
  });

  agent.on('conversation', async (ctx) => {
    console.log(`[NEW CONV] ${ctx.conversation.type} | id: ${ctx.conversation.id.slice(0, 16)}...`);
  });

  agent.on('unhandledError', (err) => {
    console.error('[ERROR]', err.message);
  });

  // 4. Start
  await agent.start();
  console.log(`Agent started. Listening for messages...`);
  console.log(`Share your pubkey with other agents: ${agent.pubkey}\n`);

  // 5. Demo: send a message if RECIPIENT_PUBKEY is set
  if (RECIPIENT_PUBKEY && DEMO_MODE === 'send') {
    console.log(`\nSending DM to ${RECIPIENT_PUBKEY.slice(0, 16)}...`);

    // Plain text DM
    const eventId = await agent.sendDm(RECIPIENT_PUBKEY, 'Hello from Spore Protocol!');
    console.log(`[SEND] DM sent | event: ${eventId.slice(0, 16)}...`);

    // Simulate kind:23405 Pay-per-Store commitment tag
    console.log('\n[M3 Demo] kind:23405 Pay-per-Store commitment:');
    const commitment = buildPaymentCommitment({
      from: agent.address,
      amount: 1_000n, // 0.001 USDC
      chainId: 10,    // Optimism
    });
    console.log(JSON.stringify(commitment, null, 2));
  }

  // 6. Keep running (Ctrl+C to stop)
  console.log('\nPress Ctrl+C to stop.\n');

  process.on('SIGINT', async () => {
    console.log('\nStopping agent...');
    await agent.stop();
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface PaymentCommitment {
  kind: 23405;
  tags: string[][];
  content: string;
}

function buildPaymentCommitment(params: {
  from: string;
  amount: bigint;
  chainId: number;
  relayOperator?: string;
}): PaymentCommitment {
  const nonce = `0x${crypto.randomUUID().replace(/-/g, '').padEnd(64, '0')}`;
  const validBefore = Math.floor(Date.now() / 1000) + 300; // 5 min window

  // In production: compute real EIP-3009 signature here
  const mockSig = '0x' + '0'.repeat(130); // placeholder

  return {
    kind: 23405,
    tags: [
      ["payment", params.amount.toString(), "USDC", "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", params.chainId.toString()],
      ["ttl", "300"],
      ["nonce", nonce],
      ["valid_before", validBefore.toString()],
      ["from", params.from],
      ["to", params.relayOperator ?? "0x0000000000000000000000000000000000000001"],
      ["sig", mockSig],
    ],
    content: "",
  };
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
