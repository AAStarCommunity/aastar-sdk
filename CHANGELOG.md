# Changelog

All notable changes to AAStar SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.16.4] - 2026-01-13

### Added
- **Comprehensive Unit Tests**: 77 unit tests across 10 test files
  - `packages/core/src/actions/tokens.test.ts` (10 tests, 30% coverage)
  - `packages/core/src/actions/entryPoint.test.ts` (9 tests, 85% coverage)
  - `packages/core/src/actions/sbt.test.ts` (11 tests, 19% coverage)
  - ` packages/core/src/actions/registry.test.ts` (12 tests)
  - `packages/core/src/utils/validation.test.ts` (9 tests, 85% coverage)
  - `packages/sdk/src/errors/AAStarError.test.ts` (12 tests, 100% coverage)
  - SDK client validation tests (14 tests)
- Vitest coverage configuration with v8 provider
- Test coverage increased from 1.48% to 4.17% (+180% improvement)

### Fixed
- `entryPointActions` now correctly imported from `@aastar/core/actions/entryPoint`
- Test environment variables: using `PRIVATE_KEY_SUPPLIER` for Sepolia tests
- Orphaned code in `tests/l1-regression.test.ts` removed
- `getUserSBT` ABI parameter mismatch in `@aastar/core`

### Changed
- All SDK clients now use structured `AAStarError` for error handling
- Input validation standardized across all client methods

## [0.16.3] - 2026-01-13

### Added
- Full refactoring of `EndUserClient` and `CommunityClient`
- Input validation using `validateAddress`, `validateHex`, `validateAmount` from `@aastar/core`
- Standardized error handling with `AAStarError`

### Fixed
- Removed hardcoded ABIs from `EndUserClient`
- Removed hardcoded ABIs from `CommunityClient`
- All contract interactions now use ABIs from `@aastar/core`

### Changed
- `EndUserClient.executeGasless`: Added strict input validation
- `CommunityClient.launch`: Added parameter validation

## [0.16.2] - 2026-01-13

### Added
- `OperatorClient` with complete input validation
- `AdminClient` with namespaced module structure

### Fixed
- ABI loading bug in core package resolved

### Changed
- Established "Thick Client" pattern as standard for SDK clients

## [0.16.1] - 2026-01-13

### Added
- Initial SDK structure with core actions
- Basic client implementations

---

## Version History Summary

- **v0.16.4**: Testing infrastructure and coverage improvements
- **v0.16.3**: EndUser & Community client refactoring
- **v0.16.2**: Operator & Admin client implementations
- **v0.16.1**: Initial SDK release

## Migration Guide

### Upgrading to 0.16.4

No breaking changes. All existing code continues to work.

**Recommended actions:**
- Update test suites to use similar patterns from our unit tests
- Start using `AAStarError` for better error handling

### Upgrading to 0.16.3

**Breaking Change**: `EndUserClient` and `CommunityClient` now throw `AAStarError` instead of generic `Error`.

**Migration:**
```typescript
// Before
try {
  await client.executeGasless({...});
} catch (error) {
  console.error(error.message);
}

// After
try {
  await client.executeGasless({...});
} catch (error) {
  if (error instanceof AAStarError) {
    console.error(`Error [${error.code}]: ${error.message}`);
  }
}
```

## Links

- [GitHub Repository](https://github.com/AAStarCommunity/aastar-sdk)
- [Documentation](./docs/)
- [API Reference](./docs/API_REFERENCE.md)
