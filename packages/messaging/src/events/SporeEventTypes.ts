// SporeEventTypes — full Nostr event kind type system for Spore Protocol M2.
// Covers kind:23402 (x402 payment), 23403 (channel voucher),
// 23404 (gasless UserOp trigger), and 23405 (pay-per-store commitment).

// ─── kind:23402 — x402 Payment Request ───────────────────────────────────────

/**
 * Parsed tag fields for kind:23402 x402 payment events.
 * Tags are public and relay-indexable; sensitive data goes in NIP-44 content.
 */
export interface X402PaymentTags {
  p: string;            // payee pubkey
  asset: string;        // ERC20 address
  amount: string;       // uint string (atomic units)
  chain: string;        // chainId
  nonce: string;        // EIP-3009 nonce (32-byte hex)
  from: string;         // EIP-3009 from address
  to: string;           // EIP-3009 to address
  valid_before: string; // unix timestamp string
  sig: string;          // EIP-3009 sig hex
  e?: string;           // optional: reply thread event id
}

/** NIP-44 encrypted content of a kind:23402 payment request */
export interface X402PaymentContent {
  memo?: string;
  refId?: string;
}

/** Content of a kind:23402 payment reply (success or failure) */
export interface X402PaymentReplyContent {
  success: boolean;
  txHash?: string;
  error?: string;
}

// ─── kind:23403 — Channel Voucher ────────────────────────────────────────────

/**
 * Parsed tag fields for kind:23403 channel voucher events.
 */
export interface ChannelVoucherTags {
  p: string;          // payee pubkey
  channel: string;    // channelId
  cumulative: string; // cumulative amount string
  chain: string;
}

/** NIP-44 encrypted content of a kind:23403 channel voucher */
export interface ChannelVoucherContent {
  voucherSig: string; // hex EIP-712 sig
}

// ─── kind:23404 — Gasless UserOp Trigger ─────────────────────────────────────

/**
 * Parsed tag fields for kind:23404 gasless UserOp trigger events.
 */
export interface UserOpTriggerTags {
  p: string;       // agent pubkey
  chain: string;   // chainId
  ep: string;      // entryPoint address
}

/** ERC-4337 UserOperation fields — all bigint values encoded as hex strings */
export interface UserOpFields {
  sender: string;
  nonce: string;        // hex
  callData: string;     // hex
  callGasLimit: string; // hex
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData?: string;
  signature?: string;
}

/** NIP-44 encrypted content of a kind:23404 UserOp trigger */
export interface UserOpTriggerContent {
  userOp: UserOpFields;
  authorizationSig: string;  // hex — over keccak256(chainId, ep, userOpHash, triggerNonce)
  triggerNonce: string;      // hex — consumed after use
}

// ─── kind:23405 — Pay-per-Store Commitment (M3) ───────────────────────────────

/**
 * Parsed tag fields for kind:23405 storage payment commitment events.
 * Prepared for M3 pay-per-store functionality.
 */
export interface StorageCommitmentTags {
  payment: [amount: string, symbol: string, tokenAddress: string, chainId: string];
  ttl: string;
  nonce: string;
  valid_before: string;
  from: string;
  to: string;
  sig: string;
}

// ─── Tag Utilities ────────────────────────────────────────────────────────────

/**
 * Convert a Nostr tags array into a key → values map.
 * For tags like ["asset", "0xUSDC..."], result is { asset: ["0xUSDC..."] }.
 */
export function parseTagsToObject(tags: string[][]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, ...values] of tags) {
    if (key !== undefined) {
      result[key] = values;
    }
  }
  return result;
}

/**
 * Validate that all required x402 tags are present and non-empty.
 * Returns true if all required fields have at least one value.
 */
export function validateX402Tags(
  tags: Record<string, string[]>
): tags is Record<keyof X402PaymentTags, string[]> {
  const required = ['p', 'asset', 'amount', 'chain', 'nonce', 'from', 'to', 'valid_before', 'sig'];
  return required.every(k => tags[k]?.[0] !== undefined && tags[k]![0] !== '');
}
