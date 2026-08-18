import { describe, it, expect, vi } from "vitest";
import {
  AbiDecodingZeroDataError,
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  HttpRequestError,
  RpcRequestError,
  TimeoutError,
} from "viem";
import {
  BLSSignatureService,
  DvtPendingConfirmationError,
  isPendingConfirmation,
} from "../services/bls-signature-service";

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));
vi.mock("axios", () => ({ default: { post: mockPost, get: vi.fn() } }));

describe("DvtPendingConfirmationError (DVT v1.3.0 pending_confirmation)", () => {
  it("carries the userOpHash + node endpoint and a descriptive message", () => {
    const err = new DvtPendingConfirmationError("0xabc123", "https://node1.example:3001");

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("DvtPendingConfirmationError");
    expect(err.userOpHash).toBe("0xabc123");
    expect(err.nodeEndpoint).toBe("https://node1.example:3001");
    expect(err.message).toContain("0xabc123");
    expect(err.message).toContain("https://node1.example:3001");
    expect(err.message).toContain("/signature/confirm");
  });

  it("is distinguishable from a generic Error via instanceof (so callers can branch on it)", () => {
    const pending: unknown = new DvtPendingConfirmationError("0x1", "n");
    const generic: unknown = new Error("network down");

    expect(pending instanceof DvtPendingConfirmationError).toBe(true);
    expect(generic instanceof DvtPendingConfirmationError).toBe(false);
  });
});

describe("generateTieredSignature — Tier 1 prefixes algId 0x02 (#273; was #235 review F1)", () => {
  // airaccount-contract v0.25.0 removed the raw-65 fallback, so tier-1 MUST emit the single-ECDSA
  // algId frame [0x02][r][s][v] = 66 bytes (matching the compositeValidator ECDSA path in
  // transfer-manager, which already prepends 0x02). This pins the prefix so a regression back to a
  // bare 65-byte owner signature — which v0.25.0 accounts reject — is caught.
  const RAW_ECDSA = ("0x" + "ab".repeat(65)) as `0x${string}`; // bare 65-byte owner sig from the signer

  const makeSvc = (signMessage: any) =>
    new BLSSignatureService(
      { blsSeedNodes: [] } as any,
      {} as any, // ethereum (unused on the tier-1 path)
      {
        getBlsConfig: vi.fn().mockResolvedValue(undefined),
        findAccountByUserId: vi.fn().mockResolvedValue({ signerAddress: "0x" + "11".repeat(20) }),
      } as any,
      { signMessage } as any
    );

  it("emits [0x02][r][s][v] = 66 bytes for tier 1 (not raw 65, not 0x04/0x05)", async () => {
    const out = await makeSvc(vi.fn().mockResolvedValue(RAW_ECDSA)).generateTieredSignature({
      tier: 1 as any,
      userId: "u1",
      userOpHash: "0x" + "cd".repeat(32),
    });

    expect(out.slice(0, 4)).toBe("0x02"); // single-ECDSA algId prefix
    expect(out).toBe(("0x02" + "ab".repeat(65)) as `0x${string}`); // 0x02 ‖ the owner sig verbatim
    expect((out.length - 2) / 2).toBe(66); // 1 algId byte + 65 ECDSA bytes
  });

  it("rejects a signer that returns a non-65-byte sig (double-prefix guard)", async () => {
    const alreadyPrefixed = ("0x02" + "ab".repeat(65)) as `0x${string}`; // 66 bytes
    await expect(
      makeSvc(vi.fn().mockResolvedValue(alreadyPrefixed)).generateTieredSignature({
        tier: 1 as any,
        userId: "u1",
        userOpHash: "0x" + "cd".repeat(32),
      })
    ).rejects.toThrow(/expected a bare 65-byte/);
  });
});

describe("isPendingConfirmation (the detection used at every /signature/sign call site)", () => {
  it("detects a v1.3.0 withhold response and narrows userOpHash", () => {
    const resp = { status: "pending_confirmation", userOpHash: "0xdead" };
    expect(isPendingConfirmation(resp)).toBe(true);
    if (isPendingConfirmation(resp)) {
      expect(resp.userOpHash).toBe("0xdead"); // type-narrowed access
    }
  });

  it("treats a normal signature response as NOT pending (so it is consumed, not surfaced)", () => {
    expect(isPendingConfirmation({ signature: "0xabc", nodeId: "n1" })).toBe(false);
    expect(isPendingConfirmation({ signatureCompact: "0xabc" })).toBe(false);
  });

  it("is safe on null / undefined / non-object / unrelated status", () => {
    expect(isPendingConfirmation(null)).toBe(false);
    expect(isPendingConfirmation(undefined)).toBe(false);
    expect(isPendingConfirmation("pending_confirmation")).toBe(false);
    expect(isPendingConfirmation({ status: "ok" })).toBe(false);
    expect(isPendingConfirmation({})).toBe(false);
  });
});

describe("_coordinateBlsAggregate — DVT transport / aggregation (#257 format, #258 review L1)", () => {
  function makeService() {
    return new BLSSignatureService(
      { blsSeedNodes: [] } as any,
      {} as any,
      { getBlsConfig: vi.fn().mockResolvedValue(undefined) } as any,
      { signMessage: vi.fn() } as any
    );
  }
  const NODES = [{ apiEndpoint: "https://dvt1.example" }, { apiEndpoint: "https://dvt2.example" }];
  const DVT_REQ = { userOp: { sender: "0xacc", nonce: "0x0" }, ownerAuth: "0x" + "ab".repeat(65) };

  it("POSTs { userOp, ownerAuth } (NOT { message }) to every node, then aggregates the collected sigs", async () => {
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: "0xn1", signature: "0xsig1" } }) // dvt1 /signature/sign
      .mockResolvedValueOnce({ data: { nodeId: "0xn2", signature: "0xsig2" } }) // dvt2 /signature/sign
      .mockResolvedValueOnce({ data: { signature: "0xAGG" } }); // /signature/aggregate

    const svc = makeService();
    const out = await (svc as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);

    // per-node sign body is the #257 { userOp, ownerAuth } — never the legacy { message }.
    for (const call of mockPost.mock.calls.slice(0, 2)) {
      expect(String(call[0])).toContain("/signature/sign");
      expect(call[1]).toEqual({ userOp: DVT_REQ.userOp, ownerAuth: DVT_REQ.ownerAuth });
      expect(call[1]).not.toHaveProperty("message");
    }
    // aggregate call receives both collected signatures.
    const aggCall = mockPost.mock.calls[2];
    expect(String(aggCall[0])).toContain("/signature/aggregate");
    expect(aggCall[1]).toEqual({ signatures: ["0xsig1", "0xsig2"] });
    // result: nodeIds come from the sign RESPONSES (authoritative), signature is the aggregate.
    expect(out.nodeIds).toEqual(["0xn1", "0xn2"]);
    expect(out.signature).toBe("0xAGG");
  });

  it("a single co-signer's signature IS the aggregate (no /signature/aggregate call)", async () => {
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: "0xn1", signature: "0xsolo" } }) // dvt1 signs
      .mockRejectedValueOnce(new Error("dvt2 down")); // dvt2 unreachable

    const svc = makeService();
    const out = await (svc as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);

    expect(out.nodeIds).toEqual(["0xn1"]);
    expect(out.signature).toBe("0xsolo");
    expect(mockPost).toHaveBeenCalledTimes(2); // 2 sign attempts, NO aggregate call
  });

  it("throws when a dvtRequest is missing (DVT v1.7 requires owner authorization)", async () => {
    const svc = makeService();
    await expect((svc as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), undefined)).rejects.toThrow(
      /dvtRequest|owner authorization/
    );
  });

  it("throws when no node returns a signature", async () => {
    mockPost.mockReset();
    mockPost.mockRejectedValue(new Error("all down"));
    const svc = makeService();
    await expect((svc as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ)).rejects.toThrow(
      /Failed to get signatures/
    );
  });
});

describe("committee fail-closed guard (FU-18 / FU-19)", () => {
  // This service always hands the cumulative packers bare nodeIds (legacy framing). Once the
  // validator mounted FOR THIS ACCOUNT flips committeeActive()==true the account decodes COMMITTEE
  // framing, so those bytes are guaranteed to be rejected on-chain. The guard turns that opaque
  // `validateUserOp != 0` into a named SDK-side error.
  //
  // Everything is derived from the account + chain, never from CANONICAL_ADDRESSES (Codex H1/H2 r2),
  // so these mocks use deliberately NON-canonical addresses throughout — a guard that silently fell
  // back to the static address book would not see them.
  const ROUTER = ("0x" + "aa".repeat(20)) as `0x${string}`;
  const MOUNTED = ("0x" + "bb".repeat(20)) as `0x${string}`;
  const ACCOUNT = ("0x" + "cc".repeat(20)) as `0x${string}`;
  const ZERO = ("0x" + "00".repeat(20)) as `0x${string}`;

  /** viem transport fault (RPC down) — must be treated as "unknown mode" -> fail closed. */
  const transportFault = () => {
    const inner = new HttpRequestError({ url: "http://rpc.test", status: 503 } as any);
    return new BaseError("read failed", { cause: inner });
  };
  /** Contract answered, at the ABI level, "no such function" — a pre-committee validator. */
  const noSuchFunction = () =>
    new BaseError("returned no data", { cause: new ContractFunctionZeroDataError({ functionName: "committeeActive" }) });
  /** A wrapper/proxy that rethrew and lost viem's cause chain — NOT a usable answer. */
  const opaqueRethrow = () => new Error("RPC failed");

  const chain = (opts: {
    active?: boolean; mounted?: `0x${string}`;
    routerFails?: boolean; mountedFails?: boolean; activeFails?: () => Error;
    onChainRouter?: `0x${string}`;
  } = {}) =>
    vi.fn().mockImplementation(({ functionName }: any) => {
      if (functionName === "validator") {
        if (opts.routerFails) throw transportFault();
        return opts.onChainRouter ?? ROUTER;
      }
      if (functionName === "getAlgorithm") {
        if (opts.mountedFails) throw transportFault();
        return opts.mounted ?? MOUNTED;
      }
      if (functionName === "committeeActive") {
        if (opts.activeFails) throw opts.activeFails();
        return opts.active ?? false;
      }
      return 0n;
    });

  const makeSvc = (readContract: any, account: any = { address: ACCOUNT, validatorAddress: ROUTER }, getCode?: any) =>
    new BLSSignatureService(
      { blsSeedNodes: [] } as any,
      { getChainId: () => 11155111, getProvider: () => ({ readContract, getCode: getCode ?? vi.fn().mockResolvedValue("0x6080") }) } as any,
      { getBlsConfig: vi.fn().mockResolvedValue(undefined), findAccountByUserId: vi.fn().mockResolvedValue(account) } as any,
      { signMessage: vi.fn() } as any
    );

  const call = (svc: BLSSignatureService) =>
    svc.generateTieredSignature({
      tier: 2 as any, userId: "u1", userOpHash: "0x" + "cd".repeat(32),
      p256Signature: "0x" + "ee".repeat(64),
    });

  it("THROWS naming the framing mismatch when the MOUNTED validator has committeeActive()==true", async () => {
    await expect(call(makeSvc(chain({ active: true })))).rejects.toThrow(/committeeActive\(\) == true/);
    await expect(call(makeSvc(chain({ active: true })))).rejects.toThrow(/FU-19/);
  });

  it("follows the account's ON-CHAIN router -> getAlgorithm(0x01) -> that validator (H1)", async () => {
    const readContract = chain({ active: true });
    await expect(call(makeSvc(readContract))).rejects.toThrow(new RegExp(MOUNTED));
    const calls = readContract.mock.calls.map(([a]: any) => `${a.functionName}@${a.address}`);
    expect(calls).toContain(`validator@${ACCOUNT}`);        // asked the account itself
    expect(calls).toContain(`getAlgorithm@${ROUTER}`);      // mount followed on ITS answer
    expect(calls).toContain(`committeeActive@${MOUNTED}`);  // mode read off what that resolved to
  });

  it("IGNORES a stale persisted validatorAddress and uses the account's real on-chain router (H1, r3)", async () => {
    // AccountManager.ensureValidatorRouter() sends setValidator() WITHOUT writing back, so the record
    // can legitimately name an old router. Here the stale record points at a legacy router while the
    // account really runs on REAL_ROUTER, whose mounted validator is committee-active. Trusting the
    // record would emit a doomed legacy signature; no storage compromise involved.
    const STALE = ("0x" + "11".repeat(20)) as `0x${string}`;
    const REAL_ROUTER = ("0x" + "22".repeat(20)) as `0x${string}`;
    const readContract = chain({ active: true, onChainRouter: REAL_ROUTER });
    const svc = makeSvc(readContract, { address: ACCOUNT, validatorAddress: STALE });

    await expect(call(svc)).rejects.toThrow(/committeeActive\(\) == true/);
    const calls = readContract.mock.calls.map(([a]: any) => `${a.functionName}@${a.address}`);
    expect(calls).toContain(`getAlgorithm@${REAL_ROUTER}`);            // real router used
    expect(calls.some((c: string) => c.endsWith(`@${STALE}`))).toBe(false); // stale one never touched
  });

  it("does NOT block signing when the mounted validator has committeeActive()==false", async () => {
    const readContract = chain({ active: false });
    await expect(call(makeSvc(readContract))).rejects.not.toThrow(/committee|refusing to sign/i);
    // Assert the read actually HAPPENED on the mounted validator (Codex r3 Low): a regression that
    // skips the committeeActive() read entirely and fails for an unrelated reason would otherwise
    // still pass this test, silently letting committee-active accounts through to legacy signing.
    expect(readContract.mock.calls.map(([a]: any) => `${a.functionName}@${a.address}`))
      .toContain(`committeeActive@${MOUNTED}`);
  });

  it("treats a DEPLOYED validator with NO committeeActive() as pre-committee — legacy is correct, do not block", async () => {
    // Contract-level answer, not a transport fault: every legacy deployment lands here, so
    // conflating it with "unknown" would break them all.
    const deployed = vi.fn().mockResolvedValue("0x6080604052");
    await expect(call(makeSvc(chain({ activeFails: noSuchFunction }), undefined, deployed)))
      .rejects.not.toThrow(/refusing to sign/);
    expect(deployed).toHaveBeenCalled(); // the empty answer was corroborated, not just trusted
  });

  it("FAILS CLOSED when the empty committeeActive() answer comes from an address with NO CODE", async () => {
    // Same decode path as a pre-committee validator, completely different meaning: we are reading
    // the wrong address (or the wrong chain). Trusting it as "legacy" would be a silent fail-open.
    const noCode = vi.fn().mockResolvedValue("0x");
    await expect(call(makeSvc(chain({ activeFails: noSuchFunction }), undefined, noCode)))
      .rejects.toThrow(/NO CODE/);
  });

  it("FAILS CLOSED when the corroborating getCode check itself faults", async () => {
    const codeFaults = vi.fn().mockRejectedValue(transportFault());
    await expect(call(makeSvc(chain({ activeFails: noSuchFunction }), undefined, codeFaults)))
      .rejects.toThrow(/refusing to sign/);
  });

  it("returns early when nothing is mounted at algId 0x01 (no DVT validator ⇒ committee unreachable)", async () => {
    const readContract = chain({ mounted: ZERO });
    await expect(call(makeSvc(readContract))).rejects.not.toThrow(/refusing to sign/);
    expect(readContract.mock.calls.some(([a]: any) => a.functionName === "committeeActive")).toBe(false);
  });

  it("FAILS CLOSED on a TRANSPORT fault reading committeeActive() — never guesses legacy (H2)", async () => {
    await expect(call(makeSvc(chain({ activeFails: transportFault })))).rejects.toThrow(/refusing to sign/);
  });

  it("FAILS CLOSED when the mounted validator cannot be read", async () => {
    await expect(call(makeSvc(chain({ mountedFails: true })))).rejects.toThrow(/refusing to sign/);
  });

  it("FAILS CLOSED when the account's router cannot be resolved at all", async () => {
    // The on-chain validator() read faults — the router is genuinely unknown.
    const svc = makeSvc(chain({ routerFails: true }), { address: ACCOUNT, validatorAddress: ROUTER });
    await expect(call(svc)).rejects.toThrow(/refusing to sign/);
  });

  it("FAILS CLOSED when the account record has no address to ask", async () => {
    const svc = makeSvc(chain(), { address: undefined, validatorAddress: ROUTER });
    await expect(call(svc)).rejects.toThrow(/refusing to sign/);
  });

  it("FAILS CLOSED on an opaque rethrow that lost viem's cause chain — unknown is never 'legacy' (r3)", async () => {
    // The dangerous direction needs a POSITIVE reason; a plain Error from a wrapper/proxy is not one.
    await expect(call(makeSvc(chain({ activeFails: opaqueRethrow })))).rejects.toThrow(/refusing to sign/);
  });

  it("FAILS CLOSED on a genuine REVERT — a revert is not evidence the function is absent (r4 High)", async () => {
    // A deployed COMMITTEE validator whose committeeActive() reverts (bad state, access control, a
    // proxy quirk) must NOT be read as "pre-committee, legacy is fine". getCode() cannot catch this:
    // there IS code, it just didn't answer. Only an empty return supports "no such function".
    const reverted = () =>
      new BaseError("reverted", {
        cause: new ContractFunctionRevertedError({ abi: [], functionName: "committeeActive" } as any),
      });
    await expect(call(makeSvc(chain({ activeFails: reverted })))).rejects.toThrow(/refusing to sign/);
  });

  it("allows legacy on AbiDecodingZeroDataError too (the other zero-data shape)", async () => {
    const abiZero = () => new BaseError("no data", { cause: new AbiDecodingZeroDataError() });
    await expect(call(makeSvc(chain({ activeFails: abiZero })))).rejects.not.toThrow(/refusing to sign/);
  });

  it("FAILS CLOSED on TimeoutError and RpcRequestError, not just HttpRequestError", async () => {
    const timeout = () => new BaseError("timeout", { cause: new TimeoutError({ body: {}, url: "http://rpc.test" }) });
    await expect(call(makeSvc(chain({ activeFails: timeout })))).rejects.toThrow(/refusing to sign/);

    const rpc = () =>
      new BaseError("rpc", {
        cause: new RpcRequestError({ body: {}, error: { code: -32603, message: "internal" }, url: "http://rpc.test" }),
      });
    await expect(call(makeSvc(chain({ activeFails: rpc })))).rejects.toThrow(/refusing to sign/);
  });

  it("FAILS CLOSED on a MIXED chain — a transport fault anywhere outranks a zero-data marker", async () => {
    // readContract wraps transport faults in the same ContractFunctionExecutionError shape, so an
    // allow-listed marker co-occurring with a transport error must not be enough to allow.
    const mixed = () => {
      const zeroData: any = new ContractFunctionZeroDataError({ functionName: "committeeActive" });
      zeroData.cause = new HttpRequestError({ url: "http://rpc.test", status: 503 } as any);
      return new BaseError("wrapped", { cause: zeroData });
    };
    await expect(call(makeSvc(chain({ activeFails: mixed })))).rejects.toThrow(/refusing to sign/);
  });

  it("FAILS CLOSED when the account's on-chain router is the zero address (not 'no committee')", async () => {
    const svc = makeSvc(chain({ onChainRouter: ZERO }), { address: ACCOUNT, validatorAddress: ROUTER });
    await expect(call(svc)).rejects.toThrow(/refusing to sign/);
  });

  it("FAILS CLOSED when there is no account record for the user", async () => {
    await expect(call(makeSvc(chain(), null))).rejects.toThrow(/refusing to sign/);
  });
});
