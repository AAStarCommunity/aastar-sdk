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
  // Real-shaped ids. They used to be "0xn1"/"0xn2", which no encoder in this repo would accept — so
  // the transport tests were exercising a value the rest of the pipeline rejects, and could not have
  // noticed a shape check being added or removed anywhere.
  const N1 = `0x${"11".repeat(32)}`;
  const N2 = `0x${"22".repeat(32)}`;
  // REAL G2 points, in the canonical 256-byte EIP-2537 layout. The fixtures used to be
  // "0xsig1"/"0xsig2" — strings the dedup key (a parsed G2 point, FU-37) rejects outright, so these
  // tests exercised a value the rest of the pipeline refuses. Same blind spot the nodeIds had before
  // FU-16, one layer down.
  //
  // Written as literals rather than signed in-test: @aastar/airaccount does not resolve
  // @noble/curves/bls12-381, and generating them here made the whole FILE fail to load — 47 tests
  // stopped running while the suite still reported "passed", which is the quietest way a test file
  // can die. They are BLS12-381 signatures over a fixed message under two distinct fixed keys, and
  // `dvtSignerIdentity.test.ts` regenerates that same pair from the curve, so a drift between these
  // literals and the curve surfaces there instead of being assumed here.
  const SIG_1 = "0x00000000000000000000000000000000175a69c57a6d564f4ff83367a48ba9934bbd412f3525c6e0082809d6bd5bf9d096e39fa3b2241e0867ae3380759213cc00000000000000000000000000000000110965f0a10f515e931b1e392548b7b703f67ec44c5a1d9ddf23678fd0e516c8390e8d327f09da831f23d18d46730fc100000000000000000000000000000000153f6322e9cfa0c5a2e6b713030e9646fe3d92b4270be45b885dca1137c32ccf7aa4c1c9df86923c97be3f428bdf6c990000000000000000000000000000000003a4521d85995eca308a743ad14bac4c3584d09e458ea319587c977b027a7cab4b484f226011c50cdbda73d5af24f8b5";
  // The 96-byte compressed form of SIG_1 — deliberately NOT canonical, so the forwarding test can
  // tell a pass-through from a re-encoding. (dvtSignerIdentity.test.ts asserts these two
  // canonicalise to the same key, so this constant cannot drift away from SIG_1 unnoticed.)
  const SIG_1_COMPRESSED = "0x910965f0a10f515e931b1e392548b7b703f67ec44c5a1d9ddf23678fd0e516c8390e8d327f09da831f23d18d46730fc1175a69c57a6d564f4ff83367a48ba9934bbd412f3525c6e0082809d6bd5bf9d096e39fa3b2241e0867ae3380759213cc";
  const SIG_2 = "0x00000000000000000000000000000000118959a06fbeb7d6126b08699328f4a49dca5c18ea284bf5b4945f4284eca7daf96a1d2d37f634f5226f51c8d5ae4f36000000000000000000000000000000000bda85398521c3c7232dfe2a4ebb4e76f2588c8d58dfc8ea3f06e9508c5a4a6fe7808fac4fd00a37997f27f1bd81578b0000000000000000000000000000000018ac2b257bce5b112722e23fe2f8b7172138b481da5e2ebbc80f4c8ee47db5d8f9186526538dd7b81198d73a8930404a00000000000000000000000000000000179d2697b8b51201e2248ca787d7261e9c54bfde84acd631cc19679bad804a452a300300f226205ee26b7bce3981af79";
  const DVT_REQ = { userOp: { sender: "0xacc", nonce: "0x0" }, ownerAuth: "0x" + "ab".repeat(65) };

  it("POSTs { userOp, ownerAuth } (NOT { message }) to every node, then aggregates the collected sigs", async () => {
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: N1, signature: SIG_1 } }) // dvt1 /signature/sign
      .mockResolvedValueOnce({ data: { nodeId: N2, signature: SIG_2 } }) // dvt2 /signature/sign
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
    expect(aggCall[1]).toEqual({ signatures: [SIG_1, SIG_2] });
    // result: nodeIds come from the sign RESPONSES, signature is the aggregate.
    //
    // "authoritative" is what this line used to say, and it was not true in the sense a reader would
    // take it: the node asserts its own id and nothing here corroborated it against the registry.
    // What IS now true is narrower — the id is checked for SHAPE and for not colliding with another
    // node in the same round. Neither makes it authoritative; see the method doc for the identity
    // question this layer structurally cannot answer.
    expect(out.nodeIds).toEqual([N1, N2]);
    expect(out.signature).toBe("0xAGG");
  });

  it("a single co-signer's signature IS the aggregate (no /signature/aggregate call)", async () => {
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: N1, signature: SIG_1 } }) // dvt1 signs
      .mockRejectedValueOnce(new Error("dvt2 down")); // dvt2 unreachable

    const svc = makeService();
    const out = await (svc as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);

    expect(out.nodeIds).toEqual([N1]);
    expect(out.signature).toBe(SIG_1);
    expect(mockPost).toHaveBeenCalledTimes(2); // 2 sign attempts, NO aggregate call
  });



  it("a node that answers with no nodeId is dropped, and the round survives on the rest", async () => {
    // The point of the FU-16 change. Before it, this node's SIGNATURE went into the aggregate and the
    // whole operation died later inside the encoder — even though dvt2 answered perfectly well.
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { signature: SIG_1 } }) // dvt1: no nodeId
      .mockResolvedValueOnce({ data: { nodeId: N2, signature: SIG_2 } });

    const out = await (makeService() as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);

    expect(out.nodeIds).toEqual([N2]);
    expect(out.signature).toBe(SIG_2); // single surviving co-signer ⇒ no aggregate call
    // and dvt1's signature is NOT in the result — dropping the id without the signature would leave
    // an aggregate that cannot verify against the ids it is paired with.
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it("a malformed nodeId (right type, wrong length) is dropped too", async () => {
    // Distinct from the missing case: a string that looks like hex still fails bytes32.
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: "0xabcd", signature: SIG_1 } })
      .mockResolvedValueOnce({ data: { nodeId: N2, signature: SIG_2 } });

    const out = await (makeService() as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);
    expect(out.nodeIds).toEqual([N2]);
  });

  it("a second node claiming an id already seen this round is dropped", async () => {
    // Not caught by shape. The encoder would reject the duplicate later; dropping it here keeps the
    // round alive on the honest node instead of failing an operation that had a valid co-signature.
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: N1, signature: SIG_1 } })
      .mockResolvedValueOnce({ data: { nodeId: N1, signature: SIG_2 } }); // dvt2 claims dvt1's id

    const out = await (makeService() as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);
    expect(out.nodeIds).toEqual([N1]);
    expect(out.signature).toBe(SIG_1); // the FIRST claimant's signature, paired with its own id
  });

  it("case-different duplicates are still duplicates", async () => {
    // bytes32 comparison is not case-sensitive; a naive === would let this through and produce two
    // ids that the encoder sorts into a collision anyway.
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: `0x${"ab".repeat(32)}`, signature: SIG_1 } })
      .mockResolvedValueOnce({ data: { nodeId: `0x${"AB".repeat(32)}`, signature: SIG_2 } });

    const out = await (makeService() as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);
    expect(out.nodeIds).toEqual([`0x${"ab".repeat(32)}`]);
  });

  it("all nodes answering incoherently is indistinguishable from all nodes being down", async () => {
    // Deliberate: both mean "no usable co-signature". The per-node reason is lost by design — the
    // loop swallows it the same way it swallows an unreachable node — so this pins the OUTCOME, and
    // the follow-up ledger carries the diagnosability gap rather than a comment claiming there is none.
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: "0xnope", signature: SIG_1 } })
      .mockResolvedValueOnce({ data: { signature: SIG_2 } });

    await expect(
      (makeService() as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ)
    ).rejects.toThrow(/Failed to get signatures from any BLS signer nodes/);
  });


  it("two nodes returning byte-identical partials: the second is dropped (one key, two ids)", async () => {
    // FU-15. Distinct, well-formed nodeIds — so the id checks see nothing wrong, and neither does
    // the encoder, nor the on-chain strictly-ascending rule. What gives it away is the partial:
    // BLS is deterministic over (key, message), so one key signing one userOpHash produces the same
    // bytes wherever it runs. #343's method doc claimed this case was out of reach here; it was not.
    mockPost.mockReset();
    const SAME = SIG_1;
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: N1, signature: SAME } })
      .mockResolvedValueOnce({ data: { nodeId: N2, signature: SAME } }); // different id, same key

    const out = await (makeService() as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);

    expect(out.nodeIds).toEqual([N1]);
    expect(out.signature).toBe(SAME); // one surviving co-signer ⇒ its partial IS the aggregate
    expect(mockPost).toHaveBeenCalledTimes(2); // no /signature/aggregate call
  });

  it("genuinely different partials from different nodes are both kept", async () => {
    // The other side of the same check: a byte comparison that rejected honest signers would be
    // worse than no check. Distinct keys cannot collide (asserted in dvtSignerIdentity.test.ts).
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: N1, signature: SIG_1 } })
      .mockResolvedValueOnce({ data: { nodeId: N2, signature: SIG_2 } })
      .mockResolvedValueOnce({ data: { signature: "0xAGG" } });

    const out = await (makeService() as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);
    expect(out.nodeIds).toEqual([N1, N2]);
    expect(out.signature).toBe("0xAGG");
  });



  it("the SAME signature written differently is still one signer (FU-37)", async () => {
    // Measured on this very assembly before the fix: an uppercase `0X` prefix produced TWO survivors
    // where there was one key, because the dedup compared strings rather than points. The compressed
    // form is the same class and needs no adversary — `signatureCompact || signature` means one node
    // may legitimately answer compact while another answers uncompressed.
    for (const [label, variant] of [
      ["0X prefix", `0X${SIG_1.slice(2)}`],
      ["uppercase body", SIG_1.toUpperCase().replace("0X", "0x")],
    ] as const) {
      mockPost.mockReset();
      mockPost
        .mockResolvedValueOnce({ data: { nodeId: N1, signature: SIG_1 } })
        .mockResolvedValueOnce({ data: { nodeId: N2, signature: variant } });
      const out = await (makeService() as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);
      expect(out.nodeIds, label).toEqual([N1]);
      // …and the SURVIVING signature is the canonical form, not whatever the first node happened to
      // write. Asserting only the survivor count would pass on a version that dropped the duplicate
      // for the wrong reason (as "not a G2 point" rather than "already seen").
      expect(out.signature).toBe(SIG_1);
    }
  });

  it("a signature that is not a G2 point drops that node, like any other bad answer", async () => {
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: N1, signature: "0xdeadbeef" } })
      .mockResolvedValueOnce({ data: { nodeId: N2, signature: SIG_2 } });
    const out = await (makeService() as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);
    expect(out.nodeIds).toEqual([N2]);
  });


  it("forwards the node's OWN bytes to /signature/aggregate, not the canonical re-encoding", async () => {
    // The dedup key is a parsed G2 point; the value on the wire must stay whatever the node sent.
    // A version that pushed the canonical form would silently turn a 96-byte compressed point into
    // a 256-byte one on its way to a service outside this repo — a format change nothing here can
    // observe, and not something a dedup fix gets to make. The existing fixtures cannot catch it
    // because they are already canonical, so this one is deliberately NOT.
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: N1, signatureCompact: SIG_1_COMPRESSED } })
      .mockResolvedValueOnce({ data: { nodeId: N2, signature: SIG_2 } })
      .mockResolvedValueOnce({ data: { signature: "0xAGG" } });

    await (makeService() as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);

    const aggregateCall = mockPost.mock.calls[2];
    expect(String(aggregateCall[0])).toContain("/signature/aggregate");
    const [first] = (aggregateCall[1] as { signatures: string[] }).signatures;
    expect(first, "the compressed form must survive to the aggregator").toBe(SIG_1_COMPRESSED);
    expect((first.length - 2) / 2, "96 bytes in, 96 bytes out").toBe(96);
  });

  it("a corrupt PREFIX is still repaired on the forwarded value", async () => {
    // Prefix repair is the actual bug and stays: `0X…` must not reach the aggregator as `0x0X…`.
    // The hex body is untouched, which is what keeps the case above true.
    mockPost.mockReset();
    mockPost
      .mockResolvedValueOnce({ data: { nodeId: N1, signature: `0X${SIG_1.slice(2)}` } })
      .mockResolvedValueOnce({ data: { nodeId: N2, signature: SIG_2 } })
      .mockResolvedValueOnce({ data: { signature: "0xAGG" } });

    await (makeService() as any)._coordinateBlsAggregate(NODES, "0x" + "cd".repeat(32), DVT_REQ);
    const [first] = (mockPost.mock.calls[2][1] as { signatures: string[] }).signatures;
    expect(first).toBe(SIG_1);
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

  const HEAD = 100n;
  const ROOT_A = ("0x" + "aa".repeat(32)) as `0x${string}`;
  const ROOT_B = ("0x" + "bb".repeat(32)) as `0x${string}`;

  // The fake HONOURS `blockNumber` (review r5 [Medium]). The previous one destructured only
  // `functionName`, so a pinned read could be made to answer with state from a LATER block — which is
  // impossible on a real chain, and was the sole reason the old FU-9 block-comparison test "passed"
  // against a guard that could never fire. Any read pinned to a block must answer with state as of
  // that block; a suite that cannot express that cannot catch pin regressions at all.
  const chain = (opts: {
    active?: boolean; mounted?: `0x${string}`;
    routerFails?: boolean; mountedFails?: boolean; activeFails?: () => Error;
    onChainRouter?: `0x${string}`;
    enrolled?: boolean; treeDepth?: number; proofLen?: number;
    /** epochSetRoot(e-1); differs from runningRoot when the set moved since the snapshot. */
    frozenRoot?: `0x${string}`;
    epoch?: bigint;
    /** slotPlusOne per nodeId; 0n == not a member. Default: member at the slot getMerkleProof reports. */
    slotPlusOne?: bigint;
    requiredQuorum?: bigint;
  } = {}) =>
    vi.fn().mockImplementation(({ functionName, blockNumber }: any) => {
      if (blockNumber !== undefined && blockNumber > HEAD) {
        throw new Error(`fake RPC: read pinned to future block ${blockNumber} (head is ${HEAD})`);
      }
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
      if (functionName === "enrolledAccount") return opts.enrolled ?? true;
      if (functionName === "TREE_DEPTH") return BigInt(opts.treeDepth ?? 14);
      if (functionName === "getMerkleProof") {
        const d = opts.treeDepth ?? 14;
        return [1n, Array.from({ length: opts.proofLen ?? d }, (_, i) => `0x${String(i).padStart(64, "0")}`)];
      }
      if (functionName === "slotPlusOne") return opts.slotPlusOne ?? 2n; // getMerkleProof reports slot 1
      if (functionName === "runningRoot") return ROOT_A;
      if (functionName === "currentEpoch") return opts.epoch ?? 5n;
      if (functionName === "epochSetRoot") return opts.frozenRoot ?? ROOT_A; // matches runningRoot by default
      if (functionName === "requiredQuorum") return opts.requiredQuorum ?? 1n;
      if (functionName === "lastSetMutationBlock") return 1n;
      return 0n;
    });

  const makeSvc = (readContract: any, account: any = { address: ACCOUNT, validatorAddress: ROUTER }, getCode?: any) =>
    new BLSSignatureService(
      { blsSeedNodes: [] } as any,
      { getChainId: () => 11155111, getProvider: () => ({ readContract, getCode: getCode ?? vi.fn().mockResolvedValue("0x6080"), getBlockNumber: vi.fn().mockResolvedValue(HEAD) }) } as any,
      { getBlsConfig: vi.fn().mockResolvedValue(undefined), findAccountByUserId: vi.fn().mockResolvedValue(account) } as any,
      { signMessage: vi.fn() } as any
    );

  const call = (svc: BLSSignatureService) =>
    svc.generateTieredSignature({
      tier: 2 as any, userId: "u1", userOpHash: "0x" + "cd".repeat(32),
      p256Signature: "0x" + "ee".repeat(64),
    });

  it("proceeds to COMMITTEE framing when the mounted validator has committeeActive()==true (FU-19)", async () => {
    // No longer a dead end: the service now fetches slot+proof and packs committee framing. It gets
    // past the guard and fails later on the DVT round-trip (no nodes mocked here).
    const readContract = chain({ active: true, enrolled: true });
    await expect(call(makeSvc(readContract))).rejects.not.toThrow(/refusing to sign|not run the one-time/);
    expect(readContract.mock.calls.map(([a]: any) => a.functionName)).toContain("enrolledAccount");
  });

  // These two exercise the proof-fetch helper directly: they are checks on the committee payload
  // itself, and routing through the full DVT pipeline would only add unrelated failure modes.
  const framing = { mode: "committee" as const, validator: MOUNTED, treeDepth: 14 };
  const fetchFor = (svc: BLSSignatureService, nodeIds: string[]) =>
    (svc as any).fetchCommitteeSignersFor("t", framing, nodeIds);

  it("REFUSES to pack when the validator's proof length disagrees with its own TREE_DEPTH (FU-19)", async () => {
    // A depth/proof mismatch would be rejected by the on-chain _verifyMerkle; catching it here names
    // the cause instead of shipping a payload that cannot verify.
    const svc = makeSvc(chain({ active: true, enrolled: true, treeDepth: 14, proofLen: 13 }));
    await expect(fetchFor(svc, ["0x" + "01".repeat(32)])).rejects.toThrow(/TREE_DEPTH|_verifyMerkle/);
  });

  it("REFUSES to pack when the set moved since the snapshot — roots, not block numbers (FU-9, r5 High)", async () => {
    // The previous guard compared `lastSetMutationBlock > atBlock` and was DEAD CODE: core reads
    // lastSetMutationBlock PINNED to atBlock, and a value read at block N cannot report a mutation
    // later than N. It only ever went green because the old fake ignored the pin. Roots are what
    // _verifyMerkle actually checks, so they are what gets compared.
    const svc = makeSvc(chain({ active: true, enrolled: true, frozenRoot: ROOT_B }));
    await expect(fetchFor(svc, ["0x" + "01".repeat(32)])).rejects.toThrow(/set has moved|would not verify/);
  });

  it("the OLD block-number guard could not have fired — pin-honest fake proves it (r5 regression lock)", async () => {
    // Guards the *reasoning*, not just the new code: with a fake that honours `blockNumber`, no
    // honest chain state can make a pinned lastSetMutationBlock exceed the head it was pinned to.
    // If someone reinstates a block-comparison guard, this documents why it is not a protection.
    const readContract = chain({ active: true, enrolled: true });
    expect(() => readContract({ functionName: "lastSetMutationBlock", blockNumber: HEAD + 1n }))
      .toThrow(/future block/);
    expect(readContract({ functionName: "lastSetMutationBlock", blockNumber: HEAD })).toBeLessThanOrEqual(HEAD);
  });

  it("REFUSES to pack for a NON-MEMBER nodeId — slot 0 is indistinguishable from a real slot-0 member", async () => {
    const svc = makeSvc(chain({ active: true, enrolled: true, slotPlusOne: 0n }));
    await expect(fetchFor(svc, ["0x" + "01".repeat(32)])).rejects.toThrow(/NOT a member/);
  });

  it("REFUSES to pack when slotPlusOne disagrees with the slot getMerkleProof reported", async () => {
    // getMerkleProof says slot 1 (fake), so slotPlusOne must be 2. 7 means they disagree.
    const svc = makeSvc(chain({ active: true, enrolled: true, slotPlusOne: 7n }));
    await expect(fetchFor(svc, ["0x" + "01".repeat(32)])).rejects.toThrow(/slot mismatch/);
  });

  it("REFUSES to pack an UNDER-QUORUM aggregate (production was skipping this; evidence scripts were not)", async () => {
    const svc = makeSvc(chain({ active: true, enrolled: true, requiredQuorum: 3n }));
    await expect(fetchFor(svc, ["0x" + "01".repeat(32)])).rejects.toThrow(/only 1 committee signer/);
  });

  it("REFUSES to pack when requiredQuorum() returns the fail-closed sentinel", async () => {
    const svc = makeSvc(chain({ active: true, enrolled: true, requiredQuorum: (1n << 256n) - 1n }));
    await expect(fetchFor(svc, ["0x" + "01".repeat(32)])).rejects.toThrow(/fail-closed sentinel/);
  });

  it("REFUSES to pack when currentEpoch() is 0 — no frozen e-1 snapshot exists", async () => {
    const svc = makeSvc(chain({ active: true, enrolled: true, epoch: 0n }));
    await expect(fetchFor(svc, ["0x" + "01".repeat(32)])).rejects.toThrow(/currentEpoch\(\) == 0/);
  });

  it("returns well-formed signers when depth matches and the set is stable", async () => {
    const svc = makeSvc(chain({ active: true, enrolled: true, mutatedAt: 1n }));
    const signers = await fetchFor(svc, ["0x" + "01".repeat(32)]);
    expect(signers).toHaveLength(1);
    expect(signers[0].merkleProof).toHaveLength(14);
  });

  it("THROWS with the owner-only enrol calldata when the account is not enrolled (FU-19)", async () => {
    // enrollInCommitteeValidator() is an OWNER tx this service has no signer for, so it hands back
    // the exact calldata rather than dead-ending or emitting bytes that cannot validate.
    const err = await call(makeSvc(chain({ active: true, enrolled: false }))).catch((e) => e as Error);
    expect(err.message).toMatch(/has not run the one-time enrollInCommitteeValidator/);
    expect(err.message).toContain(ACCOUNT);       // where to send it
    expect(err.message).toMatch(/data: 0x[0-9a-f]{8}/); // and the calldata to send
  });

  it("follows the account's ON-CHAIN router -> getAlgorithm(0x01) -> that validator (H1)", async () => {
    const readContract = chain({ active: true });
    await expect(call(makeSvc(readContract))).rejects.toThrow();
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

    await expect(call(svc)).rejects.not.toThrow(/refusing to sign/);
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
