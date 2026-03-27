import { describe, it, expect } from "vitest";
import { computeOapdSalt } from "../utils/oapd";

const OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const DAPP_ID = "app.example.com";

describe("computeOapdSalt", () => {
  it("returns a bigint", () => {
    const salt = computeOapdSalt(OWNER, DAPP_ID);
    expect(typeof salt).toBe("bigint");
  });

  it("is deterministic for the same owner + dappId", () => {
    const s1 = computeOapdSalt(OWNER, DAPP_ID);
    const s2 = computeOapdSalt(OWNER, DAPP_ID);
    expect(s1).toBe(s2);
  });

  it("produces different salts for different dappIds", () => {
    const s1 = computeOapdSalt(OWNER, "app.foo.com");
    const s2 = computeOapdSalt(OWNER, "app.bar.com");
    expect(s1).not.toBe(s2);
  });

  it("produces different salts for different owners", () => {
    const s1 = computeOapdSalt(OWNER, DAPP_ID);
    const s2 = computeOapdSalt("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", DAPP_ID);
    expect(s1).not.toBe(s2);
  });

  it("fits in a uint256 (< 2^256)", () => {
    const salt = computeOapdSalt(OWNER, DAPP_ID);
    expect(salt).toBeGreaterThanOrEqual(0n);
    expect(salt).toBeLessThan(2n ** 256n);
  });

  it("returns a non-zero value", () => {
    const salt = computeOapdSalt(OWNER, DAPP_ID);
    expect(salt).not.toBe(0n);
  });
});
