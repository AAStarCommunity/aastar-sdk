import { describe, it, expect, vi, beforeEach } from "vitest";
import { AirAccountEIP1193Provider } from "../src/eip1193";

const ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`;
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as `0x${string}`;

const baseConfig = {
  chainId: 11155111,
  rpcUrl: "https://rpc.sepolia.org",
  bundlerUrl: "https://bundler.example.com",
  accountAddress: ACCOUNT,
  signer: vi.fn().mockResolvedValue("0x" + "aa".repeat(65) as `0x${string}`),
};

describe("AirAccountEIP1193Provider", () => {
  describe("request — simple reads", () => {
    it("returns chainId as hex", async () => {
      const provider = new AirAccountEIP1193Provider(baseConfig);
      const result = await provider.request({ method: "eth_chainId" });
      expect(result).toBe("0xaa36a7"); // 11155111 in hex
    });

    it("returns accountAddress for eth_accounts", async () => {
      const provider = new AirAccountEIP1193Provider(baseConfig);
      const result = await provider.request({ method: "eth_accounts" });
      expect(result).toEqual([ACCOUNT]);
    });

    it("returns accountAddress for eth_requestAccounts", async () => {
      const provider = new AirAccountEIP1193Provider(baseConfig);
      const result = await provider.request({ method: "eth_requestAccounts" });
      expect(result).toEqual([ACCOUNT]);
    });
  });

  describe("request — RPC forwarding", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ result: "0x1234" }),
      }));
    });

    it("forwards unknown methods to rpcUrl", async () => {
      const provider = new AirAccountEIP1193Provider(baseConfig);
      const result = await provider.request({ method: "eth_blockNumber" });
      expect(result).toBe("0x1234");
      expect(fetch).toHaveBeenCalledWith(
        baseConfig.rpcUrl,
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("on / removeListener", () => {
    it("registers and removes event listeners without throwing", () => {
      const provider = new AirAccountEIP1193Provider(baseConfig);
      const listener = vi.fn();
      provider.on("accountsChanged", listener);
      provider.removeListener("accountsChanged", listener);
    });
  });

  describe("request — eth_sendTransaction", () => {
    beforeEach(() => {
      // Mock viem's createPublicClient reads (nonce + feeData + userOpHash)
      vi.mock("viem", async (importOriginal) => {
        const original = await importOriginal<typeof import("viem")>();
        return {
          ...original,
          createPublicClient: vi.fn().mockReturnValue({
            readContract: vi.fn()
              .mockResolvedValueOnce(5n)   // getNonce
              .mockResolvedValueOnce("0xabc123" as `0x${string}`), // getUserOpHash
            estimateFeesPerGas: vi.fn().mockResolvedValue({
              maxFeePerGas: 2_000_000_000n,
              maxPriorityFeePerGas: 100_000_000n,
            }),
          }),
        };
      });

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ result: "0xuseroPhash" }),
      }));
    });

    it("submits UserOp to bundler and returns hash", async () => {
      const provider = new AirAccountEIP1193Provider(baseConfig);
      const result = await provider.request({
        method: "eth_sendTransaction",
        params: [{ to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`, value: "0x0" }],
      });
      expect(result).toBe("0xuseroPhash");
      expect(fetch).toHaveBeenCalledWith(
        baseConfig.bundlerUrl,
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
