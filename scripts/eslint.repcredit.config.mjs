// Flat ESLint config for the RepCredit orchestration surface (CC-50).
//
// WHY A SCOPED CONFIG. The repo-root `.eslintrc.js` cannot be loaded by the installed ESLint 9:
// it is CommonJS (`module.exports`) in a package whose `"type": "module"` makes every `.js` an ES
// module, so eslint aborts with "module is not defined in ES module scope" before reading a rule.
// No `packages/*/package.json` defines a `lint` script either, so the root `lint` (`pnpm -r lint`)
// prints "None of the selected packages has a lint script" and exits 0 — a green that checked
// nothing. Migrating the whole monorepo to flat config is a separate change; this config gives the
// files THIS branch owns a lint gate that actually runs, rather than reporting a vacuous PASS.
// Built from the two @typescript-eslint packages already in devDependencies — this adds no new
// dependency, so the gate cannot go green merely because an install was skipped.
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**'] },
  {
    files: ['**/*.ts', '**/*.mts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      // Same repo-wide constraint the (unloadable) .eslintrc.js encodes: ABIs come from
      // @aastar/core, never from a `parseAbi` call site.
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['viem'],
          importNames: ['parseAbi'],
          message: 'Do not hardcode ABIs. Import from @aastar/core/abis instead.',
        }],
      }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
