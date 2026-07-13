/**
 * viem custom LocalAccount backed by the KMS-TEE keeper signer (CC-34 / CC-37).
 *
 * The A-board operator EOA (`0xca23b643…`) is TEE-hosted — its secp256k1 private key never leaves the
 * TEE, so there is NO raw key to hand to `privateKeyToAccount`. Instead the TEE signs a 32-byte hash over
 * the loopback keeper endpoint (`:3100/kms/sign`, byte-identical to wallet.rs `sign_hash`). This wraps that
 * endpoint as a viem `toAccount(...)` custom LOCAL account: viem prepares the tx, calls our
 * `signTransaction`, we serialize → keccak256 → ask the TEE to sign → assemble the signed tx →
 * viem broadcasts via `sendRawTransaction`. `onboardDvtNode` only ever needs `signTransaction`.
 *
 * ⚠️ ONE adapter to confirm with @repo:kms: the exact `/kms/sign` request/response JSON shape below
 * (`signHashViaKms`). It is the SAME endpoint DVT `register-node.mjs` consumes via KEEPER_SIGNER_URL/TOKEN,
 * so mirror that shape if it differs. Everything else (RLP → digest → assemble) is standard viem and fixed.
 */
import {
  keccak256, serializeTransaction, hashMessage, hashTypedData,
  type Address, type Hex, type LocalAccount, type SerializeTransactionFn,
} from 'viem';
import { toAccount } from 'viem/accounts';

export interface KmsKeeperAccountOpts {
  /** Keeper signer base URL, e.g. http://127.0.0.1:3100 (loopback on the board). */
  url: string;
  /** The keeper EOA address (msg.sender for stake+register). Must match the TEE-held key. */
  address: Address;
  /** X-Signer-Token (same token as BLS /pop and /sign). */
  token?: string;
  /** Sign path. Default '/kms/sign'. */
  signPath?: string;
}

/** Parse a keeper sign response into an r/s/yParity signature viem's serializer accepts. */
function parseKeeperSig(raw: unknown): { r: Hex; s: Hex; yParity: 0 | 1 } {
  // Accept: { signature|sig: '0x…65B' } | { r, s, v|yParity|recid } | a bare '0x…65B' string.
  let r: Hex | undefined;
  let s: Hex | undefined;
  let vRaw: number | undefined;

  const asObj = raw as Record<string, unknown> | string;
  const hex =
    typeof asObj === 'string' ? asObj
    : typeof (asObj as any).signature === 'string' ? (asObj as any).signature
    : typeof (asObj as any).sig === 'string' ? (asObj as any).sig
    : undefined;

  if (hex) {
    const h = (hex.startsWith('0x') ? hex.slice(2) : hex);
    if (h.length !== 130) throw new Error(`kms sign: expected 65-byte signature, got ${h.length / 2} bytes`);
    r = `0x${h.slice(0, 64)}`;
    s = `0x${h.slice(64, 128)}`;
    vRaw = parseInt(h.slice(128, 130), 16);
  } else {
    const o = asObj as any;
    r = o.r; s = o.s;
    vRaw = typeof o.yParity === 'number' ? o.yParity
      : typeof o.v === 'number' ? o.v
      : typeof o.recid === 'number' ? o.recid
      : undefined;
  }
  if (!r || !s || vRaw === undefined) throw new Error(`kms sign: could not parse signature from ${JSON.stringify(raw)}`);
  // Normalize v/recid → yParity ∈ {0,1}. 27/28 (EIP-155-free), 0/1 (recid), 0x1b/0x1c already handled.
  const yParity = (vRaw === 27 || vRaw === 28) ? (vRaw - 27) : (vRaw & 1);
  return { r, s, yParity: yParity as 0 | 1 };
}

export function kmsKeeperAccount(opts: KmsKeeperAccountOpts): LocalAccount {
  const signPath = opts.signPath ?? '/kms/sign';
  const endpoint = `${opts.url.replace(/\/$/, '')}${signPath}`;

  // ⚠️ The one adapter to confirm with @repo:kms (req/resp shape). Signs a 32-byte hash in the TEE.
  async function signHashViaKms(hash: Hex): Promise<{ r: Hex; s: Hex; yParity: 0 | 1 }> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(opts.token ? { 'X-Signer-Token': opts.token } : {}),
      },
      // Confirmed by @repo:kms (CC-37): KMS /kms/sign body field is `digest` (32B hex), no `address`.
      body: JSON.stringify({ digest: hash }),
    });
    if (!res.ok) throw new Error(`kms /kms/sign ${res.status}: ${await res.text().catch(() => '')}`);
    return parseKeeperSig(await res.json().catch(() => null));
  }

  return toAccount({
    address: opts.address,
    async signTransaction(transaction, options) {
      const serializer = (options?.serializer ?? serializeTransaction) as SerializeTransactionFn;
      const unsigned = await serializer(transaction);  // RLP over the prepared (typed) tx
      const digest = keccak256(unsigned);              // 32-byte tx hash the TEE signs
      const sig = await signHashViaKms(digest);
      return await serializer(transaction, sig);       // assemble the signed tx
    },
    // onboardDvtNode never calls these; the operator only sends transactions. Implemented for completeness.
    async signMessage({ message }) {
      const sig = await signHashViaKms(hashMessage(message));
      return `0x${sig.r.slice(2)}${sig.s.slice(2)}${(sig.yParity + 27).toString(16).padStart(2, '0')}` as Hex;
    },
    async signTypedData(typedData) {
      const sig = await signHashViaKms(hashTypedData(typedData as any));
      return `0x${sig.r.slice(2)}${sig.s.slice(2)}${(sig.yParity + 27).toString(16).padStart(2, '0')}` as Hex;
    },
  });
}
