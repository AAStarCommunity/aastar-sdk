# .env.sepolia Configuration Update

## Summary
Cleaned and updated `.env.sepolia` with latest Sepolia deployment addresses from `SuperPaymaster/script/v3/config/deployed.json`.

## Key Changes

### Removed Duplicates
- Removed old/duplicate contract addresses (e.g., multiple GTOKEN_ADDRESS entries)
- Consolidated to single source of truth

### Latest Contract Addresses

#### Paymaster Contracts
- **PaymasterV4 Proxy**: `0x0F9019Dd30C7Cc5774d4883fba933aA0Caba9424`
- **PaymasterV4 Implementation**: `0x720472c8ce72c2A2D711333e064ABD3E6BbEAdd3`
- **SuperPaymaster**: `0x86A2EE8FAf9A840F7a2c64CA3d51209F9A02081D`
- **Paymaster Factory**: `0x5c74c94173F05dA1720953407cbb920F3DF9f887`

#### Core Contracts
- **GToken**: `0xfbC22278A96299D91d41C453234d97b4F5Eb9B2d`
- **Staking**: `0xC9a43158891282A2B1475592D5719c001986Aaec`
- **Registry**: `0x367761085BF3C12e5DA2Df99AC6E1a824612b8fb`
- **MySBT**: `0x1c85638e118b37167e9298c2268758e058DdfDA0`
- **ReputationSystem**: `0xCace1b78160AE76398F486c8a18044da0d66d86D`

#### Token Contracts
- **aPNTs**: `0x49fd2BE640DB2910c2fAb69bB8531Ab6E76127ff`
- **xPNTs Factory**: `0xA4899D35897033b927acFCf422bc745916139776`

#### EntryPoint & Validators
- **EntryPoint V0.7**: `0x2B0d36FACD61B71CC05ab8F3D2355ec3631C0dd5`
- **BLS Aggregator**: `0xF8e31cb472bc70500f08Cd84917E5A1912Ec8397`
- **DVT Validator**: `0xD5ac451B0c50B9476107823Af206eD814a2e2580`

#### SimpleAccount Factory
- **Factory**: `0x4b6aB5F819A515382B0dEB6935D793817bB4af28`

### Test Account Configuration
- **TEST_SIMPLE_ACCOUNT_A**: `0x11595E52131Ffd571ce5e00C44472FBf94c99937`
  - ✅ Has PIM tokens deposited
  - ✅ Ready for Pimlico paymaster tests
- **TEST_OWNER_EOA_A**: `0xda7f83CafAe1b76Bd4446a4aB2B8e88770CfA927`
- **TEST_OWNER_KEY_A**: (stored in .env.sepolia)

### Bundler RPC Configuration
- **Primary RPC**: `SEPOLIA_RPC_URL` (Alchemy)
- **Bundler RPC**: `SEPOLIA_RPC_URL2` (Alchemy bundler endpoint)
  - Used for AA UserOp submission

## For Experiment Runner

The experiment runner now uses:
1. **PAYMASTER_ADDRESS**: `0x0F9019Dd30C7Cc5774d4883fba933aA0Caba9424` (PaymasterV4 Proxy)
2. **SUPERPAYMASTER_ADDRESS**: `0x86A2EE8FAf9A840F7a2c64CA3d51209F9A02081D`
3. **SEPOLIA_RPC_URL2**: Alchemy bundler RPC for Groups 3 & 4

## Next Steps
Run the experiment runner to test all 4 groups:
```bash
pnpm tsx scripts/19_sdk_experiment_runner.ts
```

Expected results:
- ✅ Group 1 (EOA): Should pass
- ✅ Group 2 (Pimlico): Should pass with PIM tokens
- ✅ Group 3 (AOA/PaymasterV4): Should pass with new address
- ✅ Group 4 (SuperPaymaster): Should pass with new address
