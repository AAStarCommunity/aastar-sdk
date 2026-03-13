// Mock @noble/curves before any imports so BLSManager doesn't fail to load
jest.mock("@noble/curves/bls12-381.js", () => ({
  bls12_381: {
    G2: {
      hashToCurve: jest.fn().mockResolvedValue({
        toAffine: () => ({
          x: { c0: 0n, c1: 0n },
          y: { c0: 0n, c1: 0n },
        }),
      }),
      ProjectivePoint: { fromHex: jest.fn() },
    },
    getPublicKey: jest.fn(),
    sign: jest.fn(),
    verify: jest.fn(),
    aggregateSignatures: jest.fn(),
    aggregatePublicKeys: jest.fn(),
  },
}));

import axios from "axios";
import { BLSManager } from "../../core/bls/bls.manager";
import type { BLSNode } from "../../core/bls/types";

jest.mock("axios");
const mockAxios = axios as jest.Mocked<typeof axios>;

const makeNode = (overrides: Partial<BLSNode> = {}): BLSNode => ({
  nodeId: "node-1",
  nodeName: "Test Node",
  apiEndpoint: "http://node1.example.com",
  status: "active",
  publicKey: "0xdeadbeef",
  ...overrides,
});

describe("BLSManager", () => {
  let manager: BLSManager;

  beforeEach(() => {
    manager = new BLSManager({
      seedNodes: ["http://seed1.example.com"],
      discoveryTimeout: 500,
    });
    mockAxios.get.mockReset();
    mockAxios.post.mockReset();
  });

  // ── getAvailableNodes ──────────────────────────────────────────────

  describe("getAvailableNodes", () => {
    it("returns active nodes that have apiEndpoint and publicKey", async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: {
          peers: [
            {
              nodeId: "n1",
              nodeName: "N1",
              apiEndpoint: "http://n1.com",
              publicKey: "0xpk1",
              status: "active",
            },
            {
              nodeId: "n2",
              nodeName: "N2",
              apiEndpoint: "http://n2.com",
              publicKey: "0xpk2",
              status: "active",
            },
          ],
        },
      });

      const nodes = await manager.getAvailableNodes();
      expect(nodes).toHaveLength(2);
      expect(nodes[0].nodeId).toBe("n1");
      expect(nodes[1].nodeId).toBe("n2");
    });

    it("assigns 1-based index to returned nodes", async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: {
          peers: [
            { nodeId: "n1", apiEndpoint: "http://n1.com", publicKey: "0xpk1", status: "active" },
            { nodeId: "n2", apiEndpoint: "http://n2.com", publicKey: "0xpk2", status: "active" },
            { nodeId: "n3", apiEndpoint: "http://n3.com", publicKey: "0xpk3", status: "active" },
          ],
        },
      });

      const nodes = await manager.getAvailableNodes();
      expect(nodes[0].index).toBe(1);
      expect(nodes[1].index).toBe(2);
      expect(nodes[2].index).toBe(3);
    });

    it("filters out nodes with inactive status", async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: {
          peers: [
            { nodeId: "n1", apiEndpoint: "http://n1.com", publicKey: "0xpk1", status: "active" },
            { nodeId: "n2", apiEndpoint: "http://n2.com", publicKey: "0xpk2", status: "inactive" },
            { nodeId: "n3", apiEndpoint: "http://n3.com", publicKey: "0xpk3", status: "error" },
          ],
        },
      });

      const nodes = await manager.getAvailableNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0].nodeId).toBe("n1");
    });

    it("filters out nodes missing publicKey", async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: {
          peers: [
            { nodeId: "n1", apiEndpoint: "http://n1.com", status: "active" }, // no publicKey
            { nodeId: "n2", apiEndpoint: "http://n2.com", publicKey: "0xpk2", status: "active" },
          ],
        },
      });

      const nodes = await manager.getAvailableNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0].nodeId).toBe("n2");
    });

    it("filters out nodes missing apiEndpoint", async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: {
          peers: [
            { nodeId: "n1", publicKey: "0xpk1", status: "active" }, // no apiEndpoint
            { nodeId: "n2", apiEndpoint: "http://n2.com", publicKey: "0xpk2", status: "active" },
          ],
        },
      });

      const nodes = await manager.getAvailableNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0].nodeId).toBe("n2");
    });

    it("returns empty array when seed node returns empty peers", async () => {
      mockAxios.get.mockResolvedValueOnce({ data: { peers: [] } });
      expect(await manager.getAvailableNodes()).toEqual([]);
    });

    it("returns empty array when all seed nodes fail", async () => {
      mockAxios.get.mockRejectedValue(new Error("Connection refused"));
      expect(await manager.getAvailableNodes()).toEqual([]);
    });

    it("tries next seed node after a failure", async () => {
      const mgr = new BLSManager({
        seedNodes: ["http://seed1.fail.com", "http://seed2.ok.com"],
        discoveryTimeout: 500,
      });

      mockAxios.get.mockRejectedValueOnce(new Error("Connection refused")).mockResolvedValueOnce({
        data: {
          peers: [
            { nodeId: "n1", apiEndpoint: "http://n1.com", publicKey: "0xpk1", status: "active" },
          ],
        },
      });

      const nodes = await mgr.getAvailableNodes();
      expect(nodes).toHaveLength(1);
      expect(mockAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  // ── packSignature ──────────────────────────────────────────────────

  describe("packSignature", () => {
    const validData = () => ({
      nodeIds: ["0x" + "11".repeat(32), "0x" + "22".repeat(32)],
      signature: "0x" + "aa".repeat(96),
      messagePoint: "0x" + "bb".repeat(256),
      aaSignature: "0x" + "cc".repeat(65),
      messagePointSignature: "0x" + "dd".repeat(65),
    });

    it("returns a hex string for valid data", () => {
      const packed = manager.packSignature(validData() as any);
      expect(packed).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it("packed output is longer than the sum of inputs (includes length prefix)", () => {
      const data = validData();
      const packed = manager.packSignature(data as any);
      // Length prefix alone is 32 bytes = 64 hex chars + '0x'
      expect(packed.length).toBeGreaterThan(100);
    });

    it("throws when nodeIds is missing", () => {
      const { nodeIds: _nodeIds, ...rest } = validData();
      expect(() => manager.packSignature(rest as any)).toThrow(
        "Missing required signature components"
      );
    });

    it("throws when aaSignature is missing", () => {
      const { aaSignature: _aaSig, ...rest } = validData();
      expect(() => manager.packSignature(rest as any)).toThrow(
        "Missing required signature components"
      );
    });

    it("throws when messagePointSignature is missing", () => {
      const { messagePointSignature: _msgPtSig, ...rest } = validData();
      expect(() => manager.packSignature(rest as any)).toThrow(
        "Missing required signature components"
      );
    });

    it("produces different output for different nodeIds", () => {
      const d1 = { ...validData(), nodeIds: ["0x" + "11".repeat(32)] };
      const d2 = { ...validData(), nodeIds: ["0x" + "22".repeat(32)] };
      expect(manager.packSignature(d1 as any)).not.toBe(manager.packSignature(d2 as any));
    });
  });

  // ── generateMessagePoint ───────────────────────────────────────────

  describe("generateMessagePoint", () => {
    it("returns a 0x-prefixed hex string", async () => {
      const result = await manager.generateMessagePoint("0x" + "ab".repeat(32));
      expect(result).toMatch(/^0x[0-9a-fA-F]*/);
    });

    it("accepts a Uint8Array input", async () => {
      const bytes = new Uint8Array(32).fill(0xab);
      const result = await manager.generateMessagePoint(bytes);
      expect(result).toMatch(/^0x/);
    });

    it("accepts a plain hex string input", async () => {
      const result = await manager.generateMessagePoint("0xdeadbeef");
      expect(result).toMatch(/^0x/);
    });
  });

  // ── requestNodeSignature ───────────────────────────────────────────

  describe("requestNodeSignature", () => {
    it("returns signature with 0x prefix added when missing", async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { signature: "aabbccdd", publicKey: "0xpk" },
      });

      const result = await manager.requestNodeSignature(makeNode(), "0xmessage");
      expect(result.signature).toBe("0xaabbccdd");
      expect(result.publicKey).toBe("0xpk");
    });

    it("preserves existing 0x prefix in signature", async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { signature: "0xalreadyprefixed", publicKey: "0xpk" },
      });

      const result = await manager.requestNodeSignature(makeNode(), "0xmessage");
      expect(result.signature).toBe("0xalreadyprefixed");
    });

    it("prefers signatureCompact over signature when both present", async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { signature: "0xeipformat", signatureCompact: "0xcompact", publicKey: "0xpk" },
      });

      const result = await manager.requestNodeSignature(makeNode(), "0xmessage");
      expect(result.signature).toBe("0xcompact");
    });

    it("POSTs to the correct node endpoint", async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { signature: "0xsig", publicKey: "0xpk" },
      });

      const node = makeNode({ apiEndpoint: "http://mynode.example.com" });
      await manager.requestNodeSignature(node, "0xmessage");

      expect(mockAxios.post).toHaveBeenCalledWith(
        "http://mynode.example.com/signature/sign",
        expect.objectContaining({ message: "0xmessage" })
      );
    });
  });

  // ── aggregateSignatures ────────────────────────────────────────────

  describe("aggregateSignatures", () => {
    it("returns aggregated signature with 0x prefix added", async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { signature: "agg1234" } });

      const result = await manager.aggregateSignatures(makeNode(), ["0xsig1", "0xsig2"]);
      expect(result).toBe("0xagg1234");
    });

    it("preserves existing 0x prefix in aggregated signature", async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { signature: "0xpreagg" } });

      const result = await manager.aggregateSignatures(makeNode(), ["0xsig1"]);
      expect(result).toBe("0xpreagg");
    });

    it("POSTs to the correct aggregate endpoint", async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { signature: "0xagg" } });

      const node = makeNode({ apiEndpoint: "http://agg.example.com" });
      await manager.aggregateSignatures(node, ["0xa", "0xb"]);

      expect(mockAxios.post).toHaveBeenCalledWith(
        "http://agg.example.com/signature/aggregate",
        expect.objectContaining({ signatures: ["0xa", "0xb"] })
      );
    });
  });
});
