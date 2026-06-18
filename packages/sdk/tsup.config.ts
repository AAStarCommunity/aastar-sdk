import { defineConfig } from 'tsup';

// Single-package build: bundle ALL @aastar/* workspace deps (and @noble/*, which has a
// 1.x↔2.x split between core and airaccount) into @aastar/sdk so it publishes as ONE
// self-contained package. Third-party runtime libs stay external (real deps / peers).
// Subpath entries give consumers `@aastar/sdk/core`, `@aastar/sdk/paymaster`, … preserving
// the directory-separated structure without 19 separate npm packages.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    core: 'src/subpaths/core.ts',
    account: 'src/subpaths/account.ts',
    paymaster: 'src/subpaths/paymaster.ts',
    identity: 'src/subpaths/identity.ts',
    tokens: 'src/subpaths/tokens.ts',
    dapp: 'src/subpaths/dapp.ts',
    x402: 'src/subpaths/x402.ts',
    channel: 'src/subpaths/channel.ts',
    enduser: 'src/subpaths/enduser.ts',
    operator: 'src/subpaths/operator.ts',
    admin: 'src/subpaths/admin.ts',
    kms: 'src/subpaths/kms.ts',
    airaccount: 'src/subpaths/airaccount.ts', // @deprecated alias of ./kms — kept one release
  },
  format: ['esm'],
  dts: true,
  splitting: true, // shared chunks → bundled @aastar/* code is not duplicated per subpath
  sourcemap: true,
  clean: true,
  treeshake: true,
  noExternal: [/^@aastar\//, /^@noble\//],
  external: ['viem', 'ethers', '@simplewebauthn/browser', 'axios', 'react', 'react-dom'],
});
