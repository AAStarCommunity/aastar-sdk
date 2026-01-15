```ts
function getCoreContracts(network): object;
```

Defined in: [packages/core/src/contracts.ts:184](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contracts.ts#L184)

Get core system contracts

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |

## Returns

`object`

Core contract addresses

| Name | Type | Default value | Defined in |
| ------ | ------ | ------ | ------ |
| `aPNTs` | `` `0x${string}` `` | `APNTS_ADDRESS` | [packages/core/src/contract-addresses.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contract-addresses.ts#L35) |
| `dvtValidator` | `` `0x${string}` `` | `DVT_VALIDATOR_ADDRESS` | [packages/core/src/contract-addresses.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contract-addresses.ts#L39) |
| `entryPoint` | `` `0x${string}` `` | `ENTRY_POINT_ADDRESS` | [packages/core/src/contract-addresses.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contract-addresses.ts#L40) |
| `gToken` | `` `0x${string}` `` | `GTOKEN_ADDRESS` | [packages/core/src/contract-addresses.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contract-addresses.ts#L31) |
| `gTokenStaking` | `` `0x${string}` `` | `GTOKEN_STAKING_ADDRESS` | [packages/core/src/contract-addresses.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contract-addresses.ts#L32) |
| `mySBT` | `` `0x${string}` `` | `SBT_ADDRESS` | [packages/core/src/contract-addresses.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contract-addresses.ts#L36) |
| `paymasterFactory` | `` `0x${string}` `` | `PAYMASTER_FACTORY_ADDRESS` | [packages/core/src/contract-addresses.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contract-addresses.ts#L34) |
| `paymasterV4` | `` `0x${string}` `` | - | [packages/core/src/contract-addresses.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contract-addresses.ts#L38) |
| `registry` | `` `0x${string}` `` | `REGISTRY_ADDRESS` | [packages/core/src/contract-addresses.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contract-addresses.ts#L30) |
| `reputationSystem` | `` `0x${string}` `` | - | [packages/core/src/contract-addresses.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contract-addresses.ts#L42) |
| `superPaymaster` | `` `0x${string}` `` | `SUPER_PAYMASTER_ADDRESS` | [packages/core/src/contract-addresses.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contract-addresses.ts#L33) |
| `xPNTsFactory` | `` `0x${string}` `` | `XPNTS_FACTORY_ADDRESS` | [packages/core/src/contract-addresses.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contract-addresses.ts#L41) |

## Example

```ts
const core = getCoreContracts('sepolia');
console.log(core.superPaymaster);
console.log(core.registry);
```
