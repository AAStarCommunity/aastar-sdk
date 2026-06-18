// Type shim for `@aastar/sdk/dapp`.
//
// WORKAROUND for a published-package bug in @aastar/sdk@0.20.5: the dapp subpath's
// RUNTIME bundle (dist/dapp.js) is self-contained and DOES export these React hooks,
// but its TYPE declaration (dist/dapp.d.ts) is just `export * from '@aastar/dapp'`,
// and `@aastar/dapp` is not shipped as a runtime dependency — so `tsc` resolves the
// module to zero exports. We declare the real hook signatures here so type-checking
// matches the working runtime. Remove once the SDK ships proper subpath .d.ts files.
declare module '@aastar/sdk/dapp' {
  import type { Address, Chain } from 'viem';

  export function useCreditScore(config: {
    chain: Chain;
    rpcUrl?: string;
    registryAddress: Address;
    userAddress: Address;
    transport?: unknown;
  }): { creditLimit: bigint | null; loading: boolean };

  export function useSuperPaymaster(config: unknown): {
    generatePaymasterAndData: (userOp: unknown) => Promise<string>;
    isLoading: boolean;
    error: Error | null;
  };
}
