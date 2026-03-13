import { ethers } from "ethers";
import { LocalWalletSigner } from "../adapters/local-wallet-signer";

// Hardhat account #0
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const EXPECTED_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

describe("LocalWalletSigner", () => {
  let signer: LocalWalletSigner;

  beforeEach(() => {
    signer = new LocalWalletSigner(PRIVATE_KEY);
  });

  it("should return the correct address for any userId", async () => {
    const addr1 = await signer.getAddress("user-a");
    const addr2 = await signer.getAddress("user-b");
    expect(addr1).toBe(EXPECTED_ADDRESS);
    expect(addr2).toBe(EXPECTED_ADDRESS);
  });

  it("should return an ethers Signer", async () => {
    const s = await signer.getSigner("user-x");
    expect(s).toBeDefined();
    const address = await s.getAddress();
    expect(address).toBe(EXPECTED_ADDRESS);
  });

  it("should return signer and address from ensureSigner", async () => {
    const result = await signer.ensureSigner("user-z");
    expect(result.address).toBe(EXPECTED_ADDRESS);
    expect(result.signer).toBeDefined();
    const signerAddr = await result.signer.getAddress();
    expect(signerAddr).toBe(EXPECTED_ADDRESS);
  });

  it("should produce a valid signature", async () => {
    const s = (await signer.getSigner("user-a")) as ethers.Wallet;
    const message = "hello";
    const signature = await s.signMessage(message);
    const recovered = ethers.verifyMessage(message, signature);
    expect(recovered).toBe(EXPECTED_ADDRESS);
  });
});
