import { vi } from "vitest";
import { createHash } from "node:crypto";
import { p256 } from "@noble/curves/nist.js";

// Mock axios so KmsManager / services use a controllable HTTP transport.
const { mockPost, mockGet, mockAxiosCreate } = vi.hoisted(() => {
  const mockPost = vi.fn();
  const mockGet = vi.fn();
  const mockAxiosCreate = vi.fn(() => ({ post: mockPost, get: mockGet }));
  return { mockPost, mockGet, mockAxiosCreate };
});

vi.mock("axios", () => ({
  default: { create: mockAxiosCreate },
  create: mockAxiosCreate,
}));

import { KmsManager } from "../services/kms-signer";
import { KmsAgentService } from "../services/kms-agent-service";
import { KmsSessionService } from "../services/kms-session-service";
import { SilentLogger } from "../interfaces/logger";
import {
  P256PasskeySigner,
  PasskeyCeremonySigner,
  buildClientDataJSON,
  buildAuthenticatorData,
  buildAuthenticationCredential,
  runWebAuthnCeremony,
  commitChallenge,
  base64UrlDecode,
  base64UrlEncode,
  DEFAULT_RP_ID,
  DEFAULT_ORIGIN,
} from "../services/webauthn-ceremony";

const ENDPOINT = "https://kms.test.example";

// Deterministic P-256 fixture key (32-byte scalar).
const FIXTURE_PRIV = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const CHALLENGE = "dGVzdC1jaGFsbGVuZ2U"; // base64url("test-challenge")
const CHALLENGE_ID = "challenge-id-123";
const CRED_ID = "Y3JlZC1pZA"; // base64url("cred-id")

/** Decode the base64url clientDataJSON of an assertion's credential into an object. */
function decodeClientData(credential: unknown): Record<string, unknown> {
  const response = (credential as { response: { clientDataJSON: string } }).response;
  const json = Buffer.from(base64UrlDecode(response.clientDataJSON)).toString("utf8");
  return JSON.parse(json);
}

// ── Pure builders ──────────────────────────────────────────────────────

describe("webauthn-ceremony builders", () => {
  it("buildClientDataJSON embeds the challenge in compact webauthn.get JSON", () => {
    const bytes = buildClientDataJSON(CHALLENGE);
    const json = Buffer.from(bytes).toString("utf8");
    // Compact (no spaces), field order type/challenge/origin, embedding the challenge.
    expect(json).toBe(
      `{"type":"webauthn.get","challenge":"${CHALLENGE}","origin":"${DEFAULT_ORIGIN}"}`
    );
    expect(JSON.parse(json).challenge).toBe(CHALLENGE);
  });

  it("buildAuthenticatorData uses SHA-256(rpId) || flags(0x05) || signCount(BE)", () => {
    const authData = buildAuthenticatorData(DEFAULT_RP_ID, 7);
    expect(authData.length).toBe(37);
    const expectedRpHash = createHash("sha256").update(DEFAULT_RP_ID).digest();
    expect(Buffer.from(authData.subarray(0, 32))).toEqual(expectedRpHash);
    expect(authData[32]).toBe(0x05); // UP | UV
    expect(new DataView(authData.buffer).getUint32(33, false)).toBe(7);
  });
});

// ── P256PasskeySigner ───────────────────────────────────────────────────

describe("P256PasskeySigner", () => {
  it("exposes the uncompressed (0x04…) public key hex", () => {
    const signer = new P256PasskeySigner(FIXTURE_PRIV, CRED_ID);
    expect(signer.publicKeyHex).toMatch(/^0x04[0-9a-f]{128}$/);
    expect(signer.credentialId).toBe(CRED_ID);
  });

  it("produces an ES256 DER signature verifiable over SHA-256(message)", () => {
    const signer = new P256PasskeySigner(FIXTURE_PRIV, CRED_ID);
    const message = new TextEncoder().encode("the-webauthn-message");
    const sig = signer.sign(message);
    expect(sig[0]).toBe(0x30); // DER SEQUENCE tag
    const pub = base64UrlDecode(base64UrlEncode(Buffer.from(signer.publicKeyHex.slice(2), "hex")));
    const ok = p256.verify(sig, message, pub, { prehash: true, format: "der" });
    expect(ok).toBe(true);
  });
});

// ── buildAuthenticationCredential ───────────────────────────────────────

describe("buildAuthenticationCredential", () => {
  it("returns AuthenticationResponseJSON whose clientDataJSON embeds the challenge", async () => {
    const signer = new P256PasskeySigner(FIXTURE_PRIV, CRED_ID);
    const cred = await buildAuthenticationCredential({ challenge: CHALLENGE, signer });

    expect(cred.id).toBe(CRED_ID);
    expect(cred.rawId).toBe(CRED_ID);
    expect(cred.type).toBe("public-key");
    expect(cred.response.clientDataJSON).toBeDefined();
    expect(cred.response.authenticatorData).toBeDefined();
    expect(cred.response.signature).toBeDefined();

    expect(decodeClientData(cred).challenge).toBe(CHALLENGE);
  });

  it("signs the WebAuthn message (authData || SHA-256(clientDataJSON))", async () => {
    const captured: Uint8Array[] = [];
    const fakeSigner: PasskeyCeremonySigner = {
      credentialId: CRED_ID,
      sign(message) {
        captured.push(message);
        return new Uint8Array([0xaa, 0xbb]);
      },
    };
    await buildAuthenticationCredential({ challenge: CHALLENGE, signer: fakeSigner, signCount: 3 });

    const clientDataJSON = buildClientDataJSON(CHALLENGE);
    const authData = buildAuthenticatorData(DEFAULT_RP_ID, 3);
    const cdh = createHash("sha256").update(clientDataJSON).digest();
    const expected = new Uint8Array([...authData, ...cdh]);
    expect(captured).toHaveLength(1);
    expect(Buffer.from(captured[0])).toEqual(Buffer.from(expected));
  });
});

// ── runWebAuthnCeremony ─────────────────────────────────────────────────

describe("runWebAuthnCeremony", () => {
  it("fetches the challenge first, then builds the assertion embedding it", async () => {
    const order: string[] = [];
    const begin = vi.fn(async () => {
      order.push("begin");
      return { ChallengeId: CHALLENGE_ID, Options: { challenge: CHALLENGE } };
    });
    const signer: PasskeyCeremonySigner = {
      credentialId: CRED_ID,
      sign() {
        order.push("sign");
        return new Uint8Array([1]);
      },
    };

    const assertion = await runWebAuthnCeremony(begin, { signer });

    expect(order).toEqual(["begin", "sign"]); // challenge fetched BEFORE signing
    expect(begin).toHaveBeenCalledTimes(1);
    expect(assertion.ChallengeId).toBe(CHALLENGE_ID);
    expect(decodeClientData(assertion.Credential).challenge).toBe(CHALLENGE);
  });

  it("throws when the begin endpoint returns no ChallengeId/challenge", async () => {
    const signer = new P256PasskeySigner(FIXTURE_PRIV, CRED_ID);
    await expect(
      runWebAuthnCeremony(async () => ({ ChallengeId: "", Options: { challenge: "" } }), { signer })
    ).rejects.toThrow(/ChallengeId/);
  });
});

// ── KmsManager integration (mocked axios) ───────────────────────────────

describe("KmsManager challenge-binding signing paths", () => {
  let manager: KmsManager;
  const signer = new P256PasskeySigner(FIXTURE_PRIV, CRED_ID);
  const beginAuthResponse = { data: { ChallengeId: CHALLENGE_ID, Options: { challenge: CHALLENGE } } };

  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
    manager = new KmsManager({ kmsEndpoint: ENDPOINT, kmsEnabled: true, logger: new SilentLogger() });
  });

  it("runAuthenticationCeremony POSTs /BeginAuthentication with KeyId first", async () => {
    mockPost.mockResolvedValueOnce(beginAuthResponse);
    const assertion = await manager.runAuthenticationCeremony("key-1", signer);

    expect(mockPost).toHaveBeenCalledWith("/BeginAuthentication", { KeyId: "key-1" });
    expect(assertion.ChallengeId).toBe(CHALLENGE_ID);
    expect(decodeClientData(assertion.Credential).challenge).toBe(CHALLENGE);
  });

  it("deriveAddressWithCeremony: challenge first, then /DeriveAddress with WebAuthn", async () => {
    mockPost
      .mockResolvedValueOnce(beginAuthResponse) // /BeginAuthentication
      .mockResolvedValueOnce({ data: { Address: "0xabc" } }); // /DeriveAddress

    await manager.deriveAddressWithCeremony({ KeyId: "key-1", DerivationPath: "m/44'/60'/0'/0/0" }, signer);

    expect(mockPost.mock.calls[0][0]).toBe("/BeginAuthentication");
    const [path, body] = mockPost.mock.calls[1];
    expect(path).toBe("/DeriveAddress");
    expect(body.WebAuthn.ChallengeId).toBe(CHALLENGE_ID);
    expect(decodeClientData(body.WebAuthn.Credential).challenge).toBe(CHALLENGE);
  });

  it("signWithCeremony: sends WebAuthn assertion on /Sign", async () => {
    mockPost
      .mockResolvedValueOnce(beginAuthResponse)
      .mockResolvedValueOnce({ data: { Signature: "0xsig" } });

    await manager.signWithCeremony({ KeyId: "key-1", Message: "0x48656c6c6f" }, signer);

    const [path, body] = mockPost.mock.calls[1];
    expect(path).toBe("/Sign");
    expect(body.WebAuthn.ChallengeId).toBe(CHALLENGE_ID);
    expect(decodeClientData(body.WebAuthn.Credential).challenge).toBe(CHALLENGE);
  });

  it("signHashWithCeremony: sends WebAuthn assertion on /SignHash", async () => {
    mockPost
      .mockResolvedValueOnce(beginAuthResponse)
      .mockResolvedValueOnce({ data: { Signature: "0xsig" } });

    await manager.signHashWithCeremony("0x" + "ab".repeat(32), { KeyId: "key-1" }, signer);

    const [path, body] = mockPost.mock.calls[1];
    expect(path).toBe("/SignHash");
    expect(body.WebAuthn.ChallengeId).toBe(CHALLENGE_ID);
    expect(decodeClientData(body.WebAuthn.Credential).challenge).toBe(CHALLENGE);
  });

  it("signTypedDataWithCeremony: sends webAuthnAssertion on /kms/SignTypedData", async () => {
    mockPost
      .mockResolvedValueOnce(beginAuthResponse)
      .mockResolvedValueOnce({ data: { keyId: "key-1", signature: "0xsig" } });

    await manager.signTypedDataWithCeremony(
      { keyId: "key-1", domain: {}, primaryType: "Mail", types: [], message: [] },
      signer
    );

    const [path, body] = mockPost.mock.calls[1];
    expect(path).toBe("/kms/SignTypedData");
    expect(body.webAuthnAssertion.ChallengeId).toBe(CHALLENGE_ID);
    expect(decodeClientData(body.webAuthnAssertion.Credential).challenge).toBe(CHALLENGE);
  });

  it("signGrantSessionWithCeremony: GETs begin-grant-session-auth then posts webAuthnAssertion", async () => {
    mockGet.mockResolvedValueOnce(beginAuthResponse); // GET /kms/begin-grant-session-auth
    mockPost.mockResolvedValueOnce({ data: { keyId: "key-1", signature: "0xsig" } });

    await manager.signGrantSessionWithCeremony(
      {
        keyId: "key-1",
        chainId: 1,
        verifyingContract: "0x0",
        account: "0x0",
        sessionKey: "0x0",
        expiry: 1,
        contractScope: "0x0",
        selectorScope: "0x0",
        velocityLimit: 1,
        velocityWindow: 1,
        callTargets: [],
        selectorAllowlist: [],
        nonce: 0,
      },
      signer
    );

    expect(mockGet).toHaveBeenCalledWith("/kms/begin-grant-session-auth", {
      params: { keyId: "key-1" },
    });
    const [path, body] = mockPost.mock.calls[0];
    expect(path).toBe("/kms/sign-grant-session");
    expect(body.webAuthnAssertion.ChallengeId).toBe(CHALLENGE_ID);
    expect(decodeClientData(body.webAuthnAssertion.Credential).challenge).toBe(CHALLENGE);
  });

  it("signP256GrantSessionWithCeremony: GETs begin-grant-session-auth then posts webAuthnAssertion", async () => {
    const order: string[] = [];
    mockGet.mockImplementationOnce(async () => {
      order.push("begin");
      return beginAuthResponse; // GET /kms/begin-grant-session-auth
    });
    mockPost.mockImplementationOnce(async () => {
      order.push("sign");
      return { data: { keyId: "key-1", signature: "0xsig" } };
    });

    await manager.signP256GrantSessionWithCeremony(
      {
        keyId: "key-1",
        chainId: 1,
        verifyingContract: "0x0",
        account: "0x0",
        keyX: "0x0",
        keyY: "0x0",
        expiry: 1,
        contractScope: "0x0",
        selectorScope: "0x0",
        velocityLimit: 1,
        velocityWindow: 1,
        callTargets: [],
        selectorAllowlist: [],
        nonce: 0,
      },
      signer
    );

    expect(order).toEqual(["begin", "sign"]); // challenge fetched BEFORE signing
    expect(mockGet).toHaveBeenCalledWith("/kms/begin-grant-session-auth", {
      params: { keyId: "key-1" },
    });
    const [path, body] = mockPost.mock.calls[0];
    expect(path).toBe("/kms/sign-p256-grant-session");
    expect(body.webAuthnAssertion.ChallengeId).toBe(CHALLENGE_ID);
    expect(decodeClientData(body.webAuthnAssertion.Credential).challenge).toBe(CHALLENGE);
  });
});

// ── Agent / Session service integration (mocked axios) ──────────────────

describe("Agent + Session ceremony variants", () => {
  const signer = new P256PasskeySigner(FIXTURE_PRIV, CRED_ID);
  const beginAuthResponse = { data: { ChallengeId: CHALLENGE_ID, Options: { challenge: CHALLENGE } } };
  let manager: KmsManager;

  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
    manager = new KmsManager({ kmsEndpoint: ENDPOINT, kmsEnabled: true, logger: new SilentLogger() });
  });

  it("createAgentKeyWithCeremony: challenge bound to humanKeyId, posts webAuthnAssertion", async () => {
    const agent = new KmsAgentService(manager.httpClient);
    mockPost
      .mockResolvedValueOnce(beginAuthResponse)
      .mockResolvedValueOnce({ data: { keyId: "h:0", agentCredential: "jwt" } });

    await agent.createAgentKeyWithCeremony({ humanKeyId: "human-1", label: "x" }, signer);

    expect(mockPost.mock.calls[0]).toEqual(["/BeginAuthentication", { KeyId: "human-1" }]);
    const [path, body] = mockPost.mock.calls[1];
    expect(path).toBe("/kms/create-agent-key");
    expect(body.humanKeyId).toBe("human-1");
    expect(body.webAuthnAssertion.ChallengeId).toBe(CHALLENGE_ID);
    expect(decodeClientData(body.webAuthnAssertion.Credential).challenge).toBe(CHALLENGE);
  });

  it("createP256SessionKeyWithCeremony: posts webAuthnAssertion with clientDataJSON", async () => {
    const session = new KmsSessionService(manager.httpClient);
    mockPost
      .mockResolvedValueOnce(beginAuthResponse)
      .mockResolvedValueOnce({ data: { keyId: "h:0", agentCredential: "jwt" } });

    await session.createP256SessionKeyWithCeremony({ humanKeyId: "human-1" }, signer);

    expect(mockPost.mock.calls[0]).toEqual(["/BeginAuthentication", { KeyId: "human-1" }]);
    const [path, body] = mockPost.mock.calls[1];
    expect(path).toBe("/kms/create-p256-session-key");
    expect(body.webAuthnAssertion.ChallengeId).toBe(CHALLENGE_ID);
    expect(decodeClientData(body.webAuthnAssertion.Credential).challenge).toBe(CHALLENGE);
  });

  it("refreshAgentCredentialWithCeremony: challenge bound to humanKeyId, posts webAuthnAssertion", async () => {
    const agent = new KmsAgentService(manager.httpClient);
    mockPost
      .mockResolvedValueOnce(beginAuthResponse)
      .mockResolvedValueOnce({ data: { keyId: "h:0", agentCredential: "jwt2", expiresAt: 1 } });

    await agent.refreshAgentCredentialWithCeremony(
      { keyId: "h:0" },
      "human-1",
      "existing-jwt",
      signer
    );

    // begin (POST /BeginAuthentication on the HUMAN key) precedes the signing POST
    expect(mockPost.mock.calls[0]).toEqual(["/BeginAuthentication", { KeyId: "human-1" }]);
    const [path, body] = mockPost.mock.calls[1];
    expect(path).toBe("/kms/refresh-agent-credential");
    expect(body.keyId).toBe("h:0");
    expect(body.webAuthnAssertion.ChallengeId).toBe(CHALLENGE_ID);
    expect(decodeClientData(body.webAuthnAssertion.Credential).challenge).toBe(CHALLENGE);
  });

  it("revokeAgentCredentialWithCeremony: challenge bound to humanKeyId, posts webAuthnAssertion", async () => {
    const agent = new KmsAgentService(manager.httpClient);
    mockPost
      .mockResolvedValueOnce(beginAuthResponse)
      .mockResolvedValueOnce({ data: { success: true, revokedAt: 1 } });

    await agent.revokeAgentCredentialWithCeremony({ keyId: "h:0" }, "human-1", signer);

    expect(mockPost.mock.calls[0]).toEqual(["/BeginAuthentication", { KeyId: "human-1" }]);
    const [path, body] = mockPost.mock.calls[1];
    expect(path).toBe("/kms/revoke-agent-credential");
    expect(body.keyId).toBe("h:0");
    expect(body.webAuthnAssertion.ChallengeId).toBe(CHALLENGE_ID);
    expect(decodeClientData(body.webAuthnAssertion.Credential).challenge).toBe(CHALLENGE);
  });

  it("revokeP256SessionKeyWithCeremony: challenge bound to humanKeyId, posts webAuthnAssertion", async () => {
    const session = new KmsSessionService(manager.httpClient);
    mockPost
      .mockResolvedValueOnce(beginAuthResponse)
      .mockResolvedValueOnce({ data: { success: true, revokedAt: 1 } });

    await session.revokeP256SessionKeyWithCeremony({ keyId: "h:0" }, "human-1", signer);

    expect(mockPost.mock.calls[0]).toEqual(["/BeginAuthentication", { KeyId: "human-1" }]);
    const [path, body] = mockPost.mock.calls[1];
    expect(path).toBe("/kms/revoke-p256-session-key");
    expect(body.keyId).toBe("h:0");
    expect(body.webAuthnAssertion.ChallengeId).toBe(CHALLENGE_ID);
    expect(decodeClientData(body.webAuthnAssertion.Credential).challenge).toBe(CHALLENGE);
  });
});

// ── Issue #68: payload-committed challenge (WYSIWYS) ──────────────────────────
describe("commitChallenge (SHA-256(nonce ‖ payload))", () => {
  const NONCE = base64UrlEncode(new Uint8Array(32).fill(7)); // base64url of 32×0x07
  const PAYLOAD = ("0x" + "ab".repeat(32)) as `0x${string}`;

  function expected(nonceB64: string, payloadHex: string): string {
    const nonce = base64UrlDecode(nonceB64);
    const pay = Buffer.from(payloadHex.replace(/^0x/, ""), "hex");
    return base64UrlEncode(new Uint8Array(createHash("sha256").update(nonce).update(pay).digest()));
  }

  it("matches an independent SHA-256(nonce ‖ payload) (hex + bytes inputs equal)", () => {
    const got = commitChallenge(NONCE, PAYLOAD);
    expect(got).toBe(expected(NONCE, PAYLOAD));
    // 32-byte digest → 43-char base64url (no padding)
    expect(base64UrlDecode(got).length).toBe(32);
    // hex string and raw bytes produce the same commitment
    const bytes = new Uint8Array(Buffer.from(PAYLOAD.slice(2), "hex"));
    expect(commitChallenge(NONCE, bytes)).toBe(got);
  });

  it("binds to the payload — different payload ⇒ different challenge", () => {
    const a = commitChallenge(NONCE, ("0x" + "11".repeat(32)) as `0x${string}`);
    const b = commitChallenge(NONCE, ("0x" + "22".repeat(32)) as `0x${string}`);
    expect(a).not.toBe(b);
  });
});

describe("runWebAuthnCeremony payload binding", () => {
  const CRED = "cred-x";
  const PAYLOAD = ("0x" + "cd".repeat(32)) as `0x${string}`;
  const begin = async () => ({ ChallengeId: CHALLENGE_ID, Options: { challenge: CHALLENGE } });

  it("embeds the committed challenge when a payload is given (not the raw nonce)", async () => {
    const signer = new P256PasskeySigner(FIXTURE_PRIV, CRED);
    const assertion = await runWebAuthnCeremony(begin, { signer, payload: PAYLOAD });
    const embedded = decodeClientData(assertion.Credential).challenge;
    expect(embedded).toBe(commitChallenge(CHALLENGE, PAYLOAD));
    expect(embedded).not.toBe(CHALLENGE); // NOT the raw nonce
  });

  it("falls back to the raw nonce when no payload (transition mode)", async () => {
    const signer = new P256PasskeySigner(FIXTURE_PRIV, CRED);
    const assertion = await runWebAuthnCeremony(begin, { signer });
    expect(decodeClientData(assertion.Credential).challenge).toBe(CHALLENGE);
  });
});
