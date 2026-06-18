// Package-scoped ESLint config for @aastar/airaccount.
//
// This package has been migrated off ethers v6 onto viem. To prevent regressions,
// importing `ethers` is banned here. The byte-exact parity helpers under
// src/migration/viem/ are the canonical replacements; the companion *.parity.test.ts
// files legitimately import ethers to prove equivalence and are exempted below.
//
// NOTE: ESLint merges this with the repo-root .eslintrc.js via the normal cascade
// (the root config is `root: true`, which only stops the upward search — nested
// configs below it still apply). `no-restricted-imports` is re-declared in full
// here because per-rule config replaces (does not merge with) the root's.
module.exports = {
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        {
          name: 'ethers',
          message:
            'ethers is banned in @aastar/airaccount (migrated to viem). Use viem, or the byte-exact helpers in src/migration/viem/*.',
        },
      ],
      patterns: [
        {
          group: ['viem'],
          importNames: ['parseAbi'],
          message: 'Do not hardcode ABIs. Import from @aastar/core/abis instead.',
        },
      ],
    }],
  },
  overrides: [
    {
      // Parity tests compare viem output against ethers — they must import ethers.
      files: ['src/migration/viem/*.parity.test.ts'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
};
