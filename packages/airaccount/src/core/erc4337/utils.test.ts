import { ERC4337Utils } from "./utils";

describe("ERC4337Utils", () => {
  it("should pack and unpack account gas limits correctly", () => {
    const verificationGasLimit = 100000n;
    const callGasLimit = 50000n;

    const packed = ERC4337Utils.packAccountGasLimits(verificationGasLimit, callGasLimit);
    const unpacked = ERC4337Utils.unpackAccountGasLimits(packed);

    expect(unpacked.verificationGasLimit).toBe(verificationGasLimit);
    expect(unpacked.callGasLimit).toBe(callGasLimit);
  });

  it("should pack and unpack gas fees correctly", () => {
    const maxPriorityFeePerGas = 1000000000n; // 1 gwei
    const maxFeePerGas = 2000000000n; // 2 gwei

    const packed = ERC4337Utils.packGasFees(maxPriorityFeePerGas, maxFeePerGas);
    const unpacked = ERC4337Utils.unpackGasFees(packed);

    expect(unpacked.maxPriorityFeePerGas).toBe(maxPriorityFeePerGas);
    expect(unpacked.maxFeePerGas).toBe(maxFeePerGas);
  });

  it("should handle full UserOp pack/unpack cycle", () => {
    const userOp = {
      sender: "0x1234567890123456789012345678901234567890",
      nonce: 1n,
      initCode: "0x",
      callData: "0xabcdef",
      callGasLimit: 10000n,
      verificationGasLimit: 20000n,
      preVerificationGas: 5000n,
      maxFeePerGas: 3000000000n,
      maxPriorityFeePerGas: 1000000000n,
      paymasterAndData: "0x",
      signature: "0x123456",
    };

    const packed = ERC4337Utils.packUserOperation(userOp);
    const unpacked = ERC4337Utils.unpackUserOperation(packed);

    expect(unpacked.sender).toBe(userOp.sender);
    expect(BigInt(unpacked.nonce)).toBe(userOp.nonce);
    expect(unpacked.initCode).toBe(userOp.initCode);
    expect(BigInt(unpacked.callGasLimit)).toBe(userOp.callGasLimit);
  });
});
