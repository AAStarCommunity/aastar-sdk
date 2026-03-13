import { UserOpBuilder } from "./userop.builder";
import { ERC4337Utils } from "./utils";

const SENDER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const SENDER2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

const baseUserOp = () => ({
  sender: SENDER,
  nonce: 0n,
  initCode: "0x" as const,
  callData: "0xdeadbeef",
  callGasLimit: 100_000n,
  verificationGasLimit: 100_000n,
  preVerificationGas: 21_000n,
  maxFeePerGas: 1_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
  paymasterAndData: "0x" as const,
  signature: "0x" as const,
});

describe("UserOpBuilder", () => {
  let builder: UserOpBuilder;

  beforeEach(() => {
    builder = new UserOpBuilder();
  });

  // ── buildUserOp ────────────────────────────────────────────────────

  describe("buildUserOp", () => {
    it("passes through explicitly provided values", async () => {
      const op = await builder.buildUserOp({
        sender: SENDER,
        callData: "0xcafe",
        nonce: 7n,
        callGasLimit: 200_000n,
        verificationGasLimit: 150_000n,
        preVerificationGas: 30_000n,
        maxFeePerGas: 2_000_000_000n,
        maxPriorityFeePerGas: 1_500_000_000n,
        initCode: "0xaabbcc",
        paymasterAndData: "0x1234",
        signature: "0xdeadbeef",
      });

      expect(op.sender).toBe(SENDER);
      expect(op.callData).toBe("0xcafe");
      expect(op.nonce).toBe(7n);
      expect(op.callGasLimit).toBe(200_000n);
      expect(op.verificationGasLimit).toBe(150_000n);
      expect(op.preVerificationGas).toBe(30_000n);
      expect(op.maxFeePerGas).toBe(2_000_000_000n);
      expect(op.maxPriorityFeePerGas).toBe(1_500_000_000n);
      expect(op.initCode).toBe("0xaabbcc");
      expect(op.paymasterAndData).toBe("0x1234");
      expect(op.signature).toBe("0xdeadbeef");
    });

    it("uses default nonce of 0n", async () => {
      const op = await builder.buildUserOp({ sender: SENDER, callData: "0x" });
      expect(op.nonce).toBe(0n);
    });

    it("uses default initCode of 0x", async () => {
      const op = await builder.buildUserOp({ sender: SENDER, callData: "0x" });
      expect(op.initCode).toBe("0x");
    });

    it("uses default callGasLimit of 0n (to be estimated)", async () => {
      const op = await builder.buildUserOp({ sender: SENDER, callData: "0x" });
      expect(op.callGasLimit).toBe(0n);
    });

    it("uses default verificationGasLimit of 100_000n", async () => {
      const op = await builder.buildUserOp({ sender: SENDER, callData: "0x" });
      expect(op.verificationGasLimit).toBe(100_000n);
    });

    it("uses default preVerificationGas of 21_000n", async () => {
      const op = await builder.buildUserOp({ sender: SENDER, callData: "0x" });
      expect(op.preVerificationGas).toBe(21_000n);
    });

    it("uses default maxFeePerGas of 1 gwei", async () => {
      const op = await builder.buildUserOp({ sender: SENDER, callData: "0x" });
      expect(op.maxFeePerGas).toBe(1_000_000_000n);
    });

    it("uses default maxPriorityFeePerGas of 1 gwei", async () => {
      const op = await builder.buildUserOp({ sender: SENDER, callData: "0x" });
      expect(op.maxPriorityFeePerGas).toBe(1_000_000_000n);
    });

    it("uses default paymasterAndData of 0x", async () => {
      const op = await builder.buildUserOp({ sender: SENDER, callData: "0x" });
      expect(op.paymasterAndData).toBe("0x");
    });

    it("uses default signature of 0x", async () => {
      const op = await builder.buildUserOp({ sender: SENDER, callData: "0x" });
      expect(op.signature).toBe("0x");
    });
  });

  // ── getUserOpHash ──────────────────────────────────────────────────

  describe("getUserOpHash", () => {
    const pack = (overrides: object = {}) =>
      ERC4337Utils.packUserOperation({ ...baseUserOp(), ...overrides });

    it("returns a 32-byte 0x-prefixed hex string", () => {
      const hash = builder.getUserOpHash(pack(), ENTRYPOINT, 11155111);
      expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });

    it("is deterministic for identical inputs", () => {
      const packed = pack();
      expect(builder.getUserOpHash(packed, ENTRYPOINT, 11155111)).toBe(
        builder.getUserOpHash(packed, ENTRYPOINT, 11155111)
      );
    });

    it("differs when sender changes", () => {
      const h1 = builder.getUserOpHash(pack({ sender: SENDER }), ENTRYPOINT, 1);
      const h2 = builder.getUserOpHash(pack({ sender: SENDER2 }), ENTRYPOINT, 1);
      expect(h1).not.toBe(h2);
    });

    it("differs when nonce changes", () => {
      const h1 = builder.getUserOpHash(pack({ nonce: 0n }), ENTRYPOINT, 1);
      const h2 = builder.getUserOpHash(pack({ nonce: 1n }), ENTRYPOINT, 1);
      expect(h1).not.toBe(h2);
    });

    it("differs when callData changes", () => {
      const h1 = builder.getUserOpHash(pack({ callData: "0xaabb" }), ENTRYPOINT, 1);
      const h2 = builder.getUserOpHash(pack({ callData: "0xccdd" }), ENTRYPOINT, 1);
      expect(h1).not.toBe(h2);
    });

    it("differs when chainId changes", () => {
      const packed = pack();
      const h1 = builder.getUserOpHash(packed, ENTRYPOINT, 1);
      const h2 = builder.getUserOpHash(packed, ENTRYPOINT, 11155111);
      expect(h1).not.toBe(h2);
    });

    it("differs when entryPoint address changes", () => {
      const packed = pack();
      const ep2 = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
      const h1 = builder.getUserOpHash(packed, ENTRYPOINT, 1);
      const h2 = builder.getUserOpHash(packed, ep2, 1);
      expect(h1).not.toBe(h2);
    });
  });
});
