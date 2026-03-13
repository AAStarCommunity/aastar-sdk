import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "core/bls/index": "src/core/bls/index.ts",
    "core/erc4337/index": "src/core/erc4337/index.ts",
    "auth/passkey/index": "src/auth/passkey/index.ts",
    "server/index": "src/server/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false, // Keep readable for debugging initially
  treeshake: true,
  external: ["ethers", "@simplewebauthn/browser"],
});
