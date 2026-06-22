import { hashMessage } from "../../migration/viem/signatures";
import {
  ISignerAdapter,
  SignerAuthContext,
} from "../interfaces/signer-adapter";
import { KmsManager } from "../services/kms-signer";
import { commitChallenge } from "../services/webauthn-ceremony";

/** Resolves an app user id to its KMS key + EOA address. App-specific mapping. */
export type KmsKeyResolver = (
  userId: string
) => Promise<{ keyId: string; address: `0x${string}` }>;

/**
 * KMS-backed {@link ISignerAdapter} — the bridge between the SDK signing chain
 * (BLS / transfer pass a {@link SignerAuthContext}) and the KMS `/SignHash` API.
 *
 * This is the concrete adapter the BLS/transfer services expect: it unpacks the
 * per-call auth context and forwards it to the right KMS endpoint.
 *  - {@link WebAuthnCeremonyContext} (preferred) → `signHashWithWebAuthn`
 *    (one-time, challenge-bound; replay-safe — what KMS v0.20.0+ requires).
 *  - {@link PasskeyAssertionContext} (legacy, @deprecated) → `signHash`
 *    (rejected by KMS unless `KMS_ALLOW_LEGACY_PASSKEY=1`, test only).
 *
 * The frontend runs the BeginAuthentication ceremony with the user's device
 * passkey and passes the resulting `{ ChallengeId, Credential }` down as
 * `ctx.webAuthnAssertion`. Since each challenge is consumed once, a flow needing
 * N signatures must pass N assertions — use the tiered transfer path, which needs
 * only one owner signature.
 *
 * The `userId → { keyId, address }` mapping is app-specific; inject it via
 * {@link KmsKeyResolver}.
 */
export class KmsSignerAdapter implements ISignerAdapter {
  constructor(
    private readonly kms: KmsManager,
    private readonly resolveKey: KmsKeyResolver
  ) {}

  async getAddress(userId: string): Promise<`0x${string}`> {
    return (await this.resolveKey(userId)).address;
  }

  async ensureSigner(userId: string): Promise<{ address: `0x${string}` }> {
    return { address: (await this.resolveKey(userId)).address };
  }

  async signMessage(
    userId: string,
    message: `0x${string}` | Uint8Array,
    ctx?: SignerAuthContext
  ): Promise<`0x${string}`> {
    const { address } = await this.resolveKey(userId);
    const hash = hashMessage(message);
    const target = { Address: address };

    if (ctx && "webAuthnAssertion" in ctx) {
      const { ChallengeId, Credential } = ctx.webAuthnAssertion;
      const res = await this.kms.signHashWithWebAuthn(hash, ChallengeId, Credential, target);
      return ("0x" + res.Signature) as `0x${string}`;
    }

    if (ctx && "assertion" in ctx) {
      const res = await this.kms.signHash(hash, ctx.assertion, target);
      return ("0x" + res.Signature) as `0x${string}`;
    }

    throw new Error(
      "KmsSignerAdapter: KMS signing requires an auth context — pass a one-time " +
        "WebAuthnCeremonyContext { webAuthnAssertion } (preferred)."
    );
  }

  /**
   * Strict device-passkey path (two-phase transfer): start a KMS BeginAuthentication ceremony
   * and return options whose `challenge` is the WYSIWYS commitment over the EXACT digest
   * {@link signMessage} will sign — `SHA-256(nonce ‖ hashMessage(message))`. The SDK owns the
   * payload + commitChallenge; the frontend just runs `navigator.credentials.get`.
   */
  async beginCeremony(
    userId: string,
    message: `0x${string}` | Uint8Array
  ): Promise<{ challengeId: string; publicKeyOptions: PublicKeyCredentialRequestOptions }> {
    const { keyId } = await this.resolveKey(userId);
    // hashMessage(message) is exactly what signMessage() forwards to KMS /SignHash, so the
    // commitment must bind to THAT (the EIP-191 digest), not the raw message.
    const signDigest = hashMessage(message);
    const { ChallengeId, Options } = await this.kms.beginAuthentication({ KeyId: keyId });
    // Options.challenge is the raw nonce (base64url) from the KMS; replace it with the commitment.
    const nonce = (Options as unknown as { challenge: string }).challenge;
    const committed = commitChallenge(nonce, signDigest);
    return {
      challengeId: ChallengeId,
      publicKeyOptions: { ...Options, challenge: committed } as unknown as PublicKeyCredentialRequestOptions,
    };
  }
}
