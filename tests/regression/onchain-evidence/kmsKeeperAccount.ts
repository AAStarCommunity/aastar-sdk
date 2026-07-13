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
  keccak256, serializeTransaction, hashMessage, hashTypedData, recoverAddress, isHex, size,
  type Address, type Hex, type LocalAccount, type SerializeTransactionFn,
} from 'viem';
import { toAccount } from 'viem/accounts';

// secp256k1 group order — used to enforce low-S (EIP-2); high-S signatures are rejected by Ethereum nodes.
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const SECP256K1_HALF_N = SECP256K1_N >> 1n;

function assert32ByteHex(v: unknown, label: string): Hex {
  if (typeof v !== 'string' || !isHex(v) || size(v as Hex) !== 32)
    throw new Error(`kms sign: ${label} is not a 32-byte hex value (got ${String(v)})`);
  return v as Hex;
}

/** recid 0/1, legacy 27/28, or EIP-155 (chainId*2+35+recid) → yParity ∈ {0,1}; reject anything else. */
function toParity(vRaw: number): 0 | 1 {
  if (vRaw === 0 || vRaw === 1) return vRaw;
  if (vRaw === 27 || vRaw === 28) return (vRaw - 27) as 0 | 1;
  if (vRaw >= 35) return ((vRaw - 35) & 1) as 0 | 1; // EIP-155: parity of (v - 35), NOT v & 1
  throw new Error(`kms sign: unexpected v/recid ${vRaw}`);
}

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

/** Parse a keeper sign response into a validated, low-S r/s/yParity signature viem's serializer accepts. */
function parseKeeperSig(raw: unknown): { r: Hex; s: Hex; yParity: 0 | 1 } {
  // Accept: { signature|sig: '0x…65B' } | { r, s, v|yParity|recid } | a bare '0x…65B' string.
  if (raw == null || (typeof raw !== 'string' && typeof raw !== 'object'))
    throw new Error(`kms sign: empty/invalid response ${JSON.stringify(raw)}`);

  let r: Hex;
  let s: Hex;
  let vRaw: number;

  const hex =
    typeof raw === 'string' ? raw
    : typeof (raw as any).signature === 'string' ? (raw as any).signature
    : typeof (raw as any).sig === 'string' ? (raw as any).sig
    : undefined;

  if (hex) {
    const h = (hex.startsWith('0x') ? hex.slice(2) : hex);
    if (!/^[0-9a-fA-F]{130}$/.test(h)) throw new Error(`kms sign: expected 65-byte hex signature, got ${h.length / 2} bytes`);
    r = `0x${h.slice(0, 64)}`;
    s = `0x${h.slice(64, 128)}`;
    vRaw = parseInt(h.slice(128, 130), 16);
  } else {
    const o = raw as any;
    r = assert32ByteHex(o.r, 'r');
    s = assert32ByteHex(o.s, 's');
    vRaw = typeof o.yParity === 'number' ? o.yParity
      : typeof o.v === 'number' ? o.v
      : typeof o.recid === 'number' ? o.recid
      : NaN;
    if (Number.isNaN(vRaw)) throw new Error(`kms sign: no v/yParity/recid in ${JSON.stringify(raw)}`);
  }

  let yParity = toParity(vRaw);
  // Enforce low-S (EIP-2): negating a high-S value flips the recovery parity.
  let sBig = BigInt(s);
  if (sBig > SECP256K1_HALF_N) {
    sBig = SECP256K1_N - sBig;
    s = `0x${sBig.toString(16).padStart(64, '0')}`;
    yParity = (yParity ^ 1) as 0 | 1;
  }
  return { r, s, yParity };
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
    const sig = parseKeeperSig(await res.json().catch(() => null));
    // fail-closed: the signature MUST recover to the keeper address — else the key/recid is wrong and we
    // must NOT broadcast a tx that would be sent from an unexpected sender.
    const recovered = await recoverAddress({ hash, signature: sig });
    if (recovered.toLowerCase() !== opts.address.toLowerCase())
      throw new Error(`kms sign: signature recovers to ${recovered}, expected keeper ${opts.address} (wrong key or recid)`);
    return sig;
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
