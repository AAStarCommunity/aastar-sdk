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
  // Inline the bundled workspace/noble types into the emitted .d.ts. Without
  // `resolve`, tsup leaves `export * from '@aastar/<pkg>'` passthroughs that an
  // external consumer can't resolve (those packages aren't shipped as deps),
  // leaving the entire bundled surface untyped. Scope `resolve` to the bundled
  // packages only — viem/react/etc. stay referenced (not inlined) as real deps.
  dts: { resolve: [/^@aastar\//, /^@noble\//] },
  splitting: true, // shared chunks → bundled @aastar/* code is not duplicated per subpath
  sourcemap: true,
  clean: true,
  treeshake: true,
  noExternal: [/^@aastar\//, /^@noble\//],
  external: ['viem', 'ethers', '@simplewebauthn/browser', 'axios', 'react', 'react-dom'],
  esbuildOptions(options) {
    // Resolve the `browser` export condition for bundled deps so this single
    // universal bundle never bakes in a Node-only entrypoint. Specifically,
    // @aastar/core's `import`/`require` condition points at index.node (which uses
    // `createRequire(import.meta.url)` from 'module' to auto-load a local
    // config.<network>.json) — that pulled the node:module builtin into the bundle
    // and broke plain browser builds. The neutral `browser` entry works in Node too;
    // the dev-only AASTAR_LOAD_LOCAL_CONFIG loader is not meaningful for an installed
    // npm package (its relative config path doesn't exist under node_modules).
    options.conditions = ['browser', 'import', 'module', 'default'];
  },
});
