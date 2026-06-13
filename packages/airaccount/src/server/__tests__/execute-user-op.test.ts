import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import {
  wrapExecuteUserOp,
  isExecuteUserOpWrapped,
  EXECUTE_USER_OP_SELECTOR,
  EXECUTE_SELECTOR,
  EXECUTE_BATCH_SELECTOR,
} from "../utils/execute-user-op";

const iface = new ethers.Interface([
  "function execute(address dest, uint256 value, bytes func)",
  "function executeBatch(address[] dest, uint256[] value, bytes[] func)",
  "function installModule(uint256 moduleTypeId, address module, bytes initData)",
]);

const TO = "0x1111111111111111111111111111111111111111";

describe("executeUserOp wrapping (v0.17.2-beta.4 bundler-compat)", () => {
  describe("selectors", () => {
    it("EXECUTE_USER_OP_SELECTOR matches the canonical signature", () => {
      const expected = ethers
        .id("executeUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes),bytes32)")
        .slice(0, 10);
      expect(EXECUTE_USER_OP_SELECTOR).toBe(expected);
      expect(EXECUTE_USER_OP_SELECTOR).toMatch(/^0x[0-9a-f]{8}$/);
    });

    it("EXECUTE_SELECTOR / EXECUTE_BATCH_SELECTOR match ethers-encoded calldata", () => {
      const exec = iface.encodeFunctionData("execute", [TO, 0n, "0x"]);
      const batch = iface.encodeFunctionData("executeBatch", [[TO], [0n], ["0x"]]);
      expect(exec.slice(0, 10)).toBe(EXECUTE_SELECTOR);
      expect(batch.slice(0, 10)).toBe(EXECUTE_BATCH_SELECTOR);
    });
  });

  describe("wrapExecuteUserOp", () => {
    it("prepends the executeUserOp selector to execute() calldata", () => {
      const inner = iface.encodeFunctionData("execute", [TO, 123n, "0xabcd"]);
      const wrapped = wrapExecuteUserOp(inner);
      expect(wrapped.slice(0, 10)).toBe(EXECUTE_USER_OP_SELECTOR);
      // the original calldata follows the selector verbatim
      expect(wrapped).toBe(EXECUTE_USER_OP_SELECTOR + inner.slice(2));
      expect(isExecuteUserOpWrapped(wrapped)).toBe(true);
    });

    it("wraps executeBatch() calldata", () => {
      const inner = iface.encodeFunctionData("executeBatch", [[TO], [0n], ["0x"]]);
      const wrapped = wrapExecuteUserOp(inner);
      expect(isExecuteUserOpWrapped(wrapped)).toBe(true);
      expect(wrapped.endsWith(inner.slice(2))).toBe(true);
    });

    it("rejects a non-execute inner selector (UnsupportedInnerSelector on-chain)", () => {
      const inner = iface.encodeFunctionData("installModule", [1n, TO, "0x"]);
      expect(() => wrapExecuteUserOp(inner)).toThrow(/only execute\(\)\/executeBatch\(\)/);
    });

    it("rejects a nested executeUserOp wrap", () => {
      const inner = iface.encodeFunctionData("execute", [TO, 0n, "0x"]);
      const once = wrapExecuteUserOp(inner);
      expect(() => wrapExecuteUserOp(once)).toThrow(/only execute/);
    });

    it("rejects malformed calldata (too short / non-hex)", () => {
      expect(() => wrapExecuteUserOp("0x12")).toThrow();
      expect(() => wrapExecuteUserOp("nothex")).toThrow();
    });
  });

  describe("isExecuteUserOpWrapped", () => {
    it("is false for bare execute() calldata", () => {
      const inner = iface.encodeFunctionData("execute", [TO, 0n, "0x"]);
      expect(isExecuteUserOpWrapped(inner)).toBe(false);
    });
  });
});
