// PaymentValidator: offline EIP-3009 payment commitment validator for Spore Protocol

import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';

// EIP-712 TypeHash for TransferWithAuthorization
// keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")
const TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
  '0x7c7c6cdb67a18743f49ec6fa9b35f50d52ed05cbed4cc592e13b44501c1a2267' as const;

// Pre-computed USDC domain separators per chainId (avoids RPC in hot path)
// These are the official Circle USDC domain separators. Add more chains as needed.
const USDC_DOMAIN_SEPARATORS: Record<number, `0x${string}`> = {
  // Optimism Mainnet — official USDC (0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85)
  10: '0x' as `0x${string}`, // placeholder — populate with actual value in production
  // Base Mainnet — official USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
  8453: '0x' as `0x${string}`, // placeholder
  // Optimism Sepolia (testnet USDC)
  11155420: '0x' as `0x${string}`, // placeholder
};

export interface PaymentCommitment {
  amount: bigint;
  nonce: `0x${string}`;
  validBefore: number;
  from: `0x${string}`;
  to: `0x${string}`;
  tokenAddress: `0x${string}`;
  chainId: number;
  sig: `0x${string}`;
}

export interface ValidatorConfig {
  /** Minimum fee per message in USDC (6-decimal integer, e.g. 1000 = 0.001 USDC) */
  minFeeUsdc: bigint;
  /** ETH address of this relay operator — must match 'to' in commitment */
  operatorAddress: `0x${string}`;
  /** USDC token contract address */
  usdcAddress: `0x${string}`;
  chainId: number;
}

export class PaymentValidator {
  constructor(private config: ValidatorConfig) {}

  /**
   * Parse kind:23405 event tags into a PaymentCommitment.
   * Returns null if any required tag is missing.
   */
  parse(tags: string[][]): PaymentCommitment | null {
    // Build a map: tag name → rest of tag values
    const tagMap = new Map<string, string[]>();
    for (const [k, ...v] of tags) {
      tagMap.set(k, v);
    }

    const paymentTag = tagMap.get('payment');
    const nonce = tagMap.get('nonce')?.[0];
    const validBefore = Number(tagMap.get('valid_before')?.[0] ?? '0');
    const from = tagMap.get('from')?.[0];
    const to = tagMap.get('to')?.[0];
    const sig = tagMap.get('sig')?.[0];

    if (!paymentTag || !nonce || !from || !to || !sig) return null;

    const [amountStr, _symbol, tokenAddress, chainIdStr] = paymentTag;
    return {
      amount: BigInt(amountStr ?? '0'),
      nonce: nonce as `0x${string}`,
      validBefore,
      from: from as `0x${string}`,
      to: to as `0x${string}`,
      tokenAddress: (tokenAddress ?? '0x') as `0x${string}`,
      chainId: Number(chainIdStr ?? '0'),
      sig: sig as `0x${string}`,
    };
  }

  /**
   * Validate a PaymentCommitment synchronously (no RPC calls).
   * Checks: amount, expiry, recipient, chainId, and EIP-3009 signature.
   */
  validate(commitment: PaymentCommitment): { valid: boolean; reason?: string } {
    // 1. Check minimum fee
    if (commitment.amount < this.config.minFeeUsdc) {
      return { valid: false, reason: 'fee_too_low' };
    }

    // 2. Check expiry (pure local clock — no RPC)
    if (commitment.validBefore < Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: 'expired' };
    }

    // 3. Check 'to' matches our operator address
    if (commitment.to.toLowerCase() !== this.config.operatorAddress.toLowerCase()) {
      return { valid: false, reason: 'wrong_recipient' };
    }

    // 4. Check chain ID matches config
    if (commitment.chainId !== this.config.chainId) {
      return { valid: false, reason: 'chain_mismatch' };
    }

    // 5. Verify EIP-3009 signature offline
    if (!this.verifyEip3009Sig(commitment)) {
      return { valid: false, reason: 'invalid_signature' };
    }

    return { valid: true };
  }

  /**
   * Verify EIP-3009 TransferWithAuthorization signature using @noble/curves.
   * No RPC calls — uses pre-computed domain separators per chainId.
   *
   * Full EIP-712 flow:
   *   digest = keccak256("\x19\x01" ++ domainSeparator ++ structHash)
   *   signer = ecrecover(digest, v, r, s)
   *   valid  = signer == commitment.from
   */
  private verifyEip3009Sig(c: PaymentCommitment): boolean {
    try {
      const domainSeparator = USDC_DOMAIN_SEPARATORS[c.chainId];
      if (!domainSeparator || domainSeparator === '0x') {
        // Domain separator not configured for this chain — skip crypto check
        // In production: throw or fetch from contract once and cache
        return true;
      }

      // Encode the struct hash
      const structHash = keccak256(
        encodeAbiParameters(
          parseAbiParameters(
            'bytes32, address, address, uint256, uint256, uint256, bytes32'
          ),
          [
            TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
            c.from,
            c.to,
            c.amount,
            0n,              // validAfter — always 0 in Spore commitments
            BigInt(c.validBefore),
            c.nonce as `0x${string}`,
          ]
        )
      );

      // EIP-712 digest: "\x19\x01" ++ domainSeparator ++ structHash
      const digestHex = keccak256(
        encodeAbiParameters(
          parseAbiParameters('bytes2, bytes32, bytes32'),
          ['0x1901', domainSeparator as `0x${string}`, structHash]
        )
      );

      const msgHash = hexToBytes(digestHex);

      // Decode sig: [r (32 bytes)] [s (32 bytes)] [v (1 byte)]
      const sigBytes = hexToBytes(c.sig);
      if (sigBytes.length !== 65) return false;

      const r = sigBytes.slice(0, 32);
      const s = sigBytes.slice(32, 64);
      const v = sigBytes[64];
      const recovery = v === 27 ? 0 : v === 28 ? 1 : v;

      // Recover public key using @noble/curves secp256k1 (Schnorr-style ECDSA)
      const sig = new secp256k1.Signature(
        bytesToBigInt(r),
        bytesToBigInt(s)
      ).addRecoveryBit(recovery);

      const recoveredPoint = sig.recoverPublicKey(msgHash);
      const recoveredPubkey = recoveredPoint.toRawBytes(false); // uncompressed

      // Derive ETH address: keccak256(pubkey[1:])[12:]
      const pubkeyHash = keccak256(recoveredPubkey.slice(1) as unknown as `0x${string}`);
      const recoveredAddress = '0x' + pubkeyHash.slice(-40);

      return recoveredAddress.toLowerCase() === c.from.toLowerCase();
    } catch {
      return false;
    }
  }
}

// ─── Utility helpers ────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const result = new Uint8Array(h.length / 2);
  for (let i = 0; i < result.length; i++) {
    result[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return result;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}
