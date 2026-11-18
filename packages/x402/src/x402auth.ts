import {
  type Address, type Hex, type TypedDataDomain, type WalletClient,
  encodeAbiParameters, keccak256,
} from 'viem';

// ============================================================
// x402 settlement-authorization signing — aligned with the deployed
// SuperPaymaster `X402Facilitator.sol` (DVT#130 / aastar-sdk#39).
//
// Two settlement paths, two distinct signatures:
//   - "direct"   (xPNTs): payer signs an X402PaymentAuthorization (EIP-712 over the
//                 facilitator), submitted via settleX402PaymentDirect(..., signature).
//   - "eip-3009" (USDC):  payer signs an EIP-3009 ReceiveWithAuthorization over the
//                 TOKEN, with recipient = the facilitator and a DERIVED nonce that binds
//                 the final recipient (payTo) + maxFee + salt — the C-03 recipient-lock.
// ============================================================

/** EIP-712 type for the direct-settlement payer authorization (X402Facilitator domain). */
export const X402_PAYMENT_AUTHORIZATION_TYPES = {
  X402PaymentAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'asset', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'maxFee', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

/**
 * X402Facilitator's EIP-712 name/version, pinned to SP `contracts/src/paymasters/superpaymaster/v3/X402Facilitator.sol`
 * `_x402DomainSeparator()`. The contract exposes no domain getter; `verifyFacilitatorDomain` asks its verifier (a
 * simulated settle) whether a signature under this domain passes before X402Client signs.
 */
export const X402_FACILITATOR_DOMAIN = { name: 'X402Facilitator', version: '1' } as const;
/** The signed struct's EIP-712 type string (X402Facilitator `X402_AUTH_TYPEHASH`). */
export const X402_PAYMENT_AUTHORIZATION_TYPE_STRING =
  `X402PaymentAuthorization(${X402_PAYMENT_AUTHORIZATION_TYPES.X402PaymentAuthorization.map((f) => `${f.type} ${f.name}`).join(',')})`;

/**
 * Derived EIP-3009 nonce for the USDC settle path — MUST equal the contract's
 * `keccak256(abi.encode(to, maxFee, salt))` (`X402Facilitator.settleX402Payment`), where
 * `to` is the FINAL recipient (payTo). Binding the recipient into the nonce is the C-03 fix
 * (a facilitator can't redirect the payout without invalidating the signature).
 */
export function deriveEip3009Nonce(payTo: Address, maxFee: bigint, salt: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }],
      [payTo, maxFee, salt],
    ),
  );
}

/**
 * Sign the direct-path `X402PaymentAuthorization` (EIP-712). Domain is the FACILITATOR
 * contract — `{ name: "X402Facilitator", version: "1", chainId, verifyingContract: facilitator }`
 * (matches `X402Facilitator._x402DomainSeparator()`; verified on-chain via settleX402PaymentDirect).
 * EOA or AirAccount passkey (ERC-1271) — the contract uses `SignatureCheckerLib.isValidSignatureNow`.
 */
export async function signX402PaymentAuthorization(
  walletClient: WalletClient,
  params: {
    from: Address; to: Address; asset: Address; amount: bigint;
    maxFee: bigint; validBefore: bigint; nonce: Hex;
    chainId: number; facilitator: Address;
    /** The domain checked on the chain (X402Client passes it). Without it, the pinned domain is used unchecked. */
    domain?: TypedDataDomain;
  },
): Promise<Hex> {
  const account = walletClient.account;
  if (!account) throw new Error('WalletClient must have an account');
  if (account.address.toLowerCase() !== params.from.toLowerCase()) {
    throw new Error(`Signer ${account.address} does not match from ${params.from}`);
  }
  return walletClient.signTypedData({
    account,
    domain: params.domain ?? { ...X402_FACILITATOR_DOMAIN, chainId: params.chainId, verifyingContract: params.facilitator },
    types: X402_PAYMENT_AUTHORIZATION_TYPES,
    primaryType: 'X402PaymentAuthorization',
    message: {
      from: params.from, to: params.to, asset: params.asset, amount: params.amount,
      maxFee: params.maxFee, validBefore: params.validBefore, nonce: params.nonce,
    },
  });
}
