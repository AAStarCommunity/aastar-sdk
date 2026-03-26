import { describe, it, expect, vi } from "vitest";
import { resolveEns, lookupAddress, resolveEnsVerified } from "../src/utils/ens";
import type { PublicClient } from "viem";

// Mock viem/ens functions
vi.mock("viem/ens", () => ({
  getEnsAddress: vi.fn(),
  getEnsName: vi.fn(),
  normalize: (name: string) => name,
}));

import { getEnsAddress, getEnsName } from "viem/ens";

const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as `0x${string}`;
const mockClient = {} as PublicClient;

describe("resolveEns", () => {
  it("returns address for a valid ENS name", async () => {
    vi.mocked(getEnsAddress).mockResolvedValueOnce(VITALIK);
    const result = await resolveEns("vitalik.eth", { client: mockClient });
    expect(result).toBe(VITALIK);
  });

  it("returns null when ENS name has no address", async () => {
    vi.mocked(getEnsAddress).mockResolvedValueOnce(null);
    const result = await resolveEns("notregistered.eth", { client: mockClient });
    expect(result).toBeNull();
  });

  it("passes the name to getEnsAddress", async () => {
    vi.mocked(getEnsAddress).mockResolvedValueOnce(VITALIK);
    await resolveEns("vitalik.eth", { client: mockClient });
    expect(getEnsAddress).toHaveBeenCalledWith(mockClient, { name: "vitalik.eth" });
  });
});

describe("lookupAddress", () => {
  it("returns ENS name for a known address", async () => {
    vi.mocked(getEnsName).mockResolvedValueOnce("vitalik.eth");
    const result = await lookupAddress(VITALIK, { client: mockClient });
    expect(result).toBe("vitalik.eth");
  });

  it("returns null when address has no reverse record", async () => {
    vi.mocked(getEnsName).mockResolvedValueOnce(null);
    const result = await lookupAddress(VITALIK, { client: mockClient });
    expect(result).toBeNull();
  });
});

describe("resolveEnsVerified", () => {
  it("returns verified=true when forward and reverse records match", async () => {
    vi.mocked(getEnsAddress).mockResolvedValueOnce(VITALIK);
    vi.mocked(getEnsName).mockResolvedValueOnce("vitalik.eth");
    const result = await resolveEnsVerified("vitalik.eth", { client: mockClient });
    expect(result.address).toBe(VITALIK);
    expect(result.verified).toBe(true);
  });

  it("returns verified=false when reverse name does not match forward name", async () => {
    vi.mocked(getEnsAddress).mockResolvedValueOnce(VITALIK);
    vi.mocked(getEnsName).mockResolvedValueOnce("other.eth");
    const result = await resolveEnsVerified("vitalik.eth", { client: mockClient });
    expect(result.verified).toBe(false);
  });

  it("returns address=null and verified=false when name does not resolve", async () => {
    vi.mocked(getEnsAddress).mockResolvedValueOnce(null);
    const result = await resolveEnsVerified("nxdomain.eth", { client: mockClient });
    expect(result.address).toBeNull();
    expect(result.verified).toBe(false);
  });

  it("returns verified=false when reverse record is null", async () => {
    vi.mocked(getEnsAddress).mockResolvedValueOnce(VITALIK);
    vi.mocked(getEnsName).mockResolvedValueOnce(null);
    const result = await resolveEnsVerified("vitalik.eth", { client: mockClient });
    expect(result.verified).toBe(false);
  });
});
