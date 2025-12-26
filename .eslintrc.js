module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // Prevent hardcoding ABIs - must import from @aastar/core
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['viem'],
        importNames: ['parseAbi'],
        message: 'Do not hardcode ABIs. Import from @aastar/core/abis instead.'
      }]
    }],
    
    // Allow any types for gradual migration
    '@typescript-eslint/no-explicit-any': 'off',
    
    // Allow unused vars with underscore prefix
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }]
  }
};
