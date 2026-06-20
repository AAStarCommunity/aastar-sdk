import { describe, it, expect } from "vitest";
import { isHex, size } from "viem";
import { DEFAULT_DVT_NODES, getDefaultDvtNodes } from "./dvtNodes.js";

describe("DEFAULT_DVT_NODES — AAStar always-on testnet DVT nodes", () => {
  it("publishes exactly 3 Sepolia (11155111) nodes", () => {
    const nodes = DEFAULT_DVT_NODES[11155111];
    expect(nodes).toBeDefined();
    expect(nodes).toHaveLength(3);
  });

  it("every node has an https aastar.io url and a 32-byte bytes32 nodeId", () => {
    for (const node of DEFAULT_DVT_NODES[11155111]) {
      expect(node.url).toMatch(/^https:\/\/dvt[123]\.aastar\.io$/);
      expect(isHex(node.nodeId)).toBe(true);
      expect(size(node.nodeId)).toBe(32);
    }
  });

  it("nodeIds are distinct", () => {
    const ids = DEFAULT_DVT_NODES[11155111].map((n) => n.nodeId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getDefaultDvtNodes returns the Sepolia set and [] for an unknown chain", () => {
    expect(getDefaultDvtNodes(11155111)).toHaveLength(3);
    expect(getDefaultDvtNodes(999999)).toEqual([]);
  });
});
