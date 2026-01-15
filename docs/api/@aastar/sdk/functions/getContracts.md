> **getContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:130](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/contracts.ts#L130)

Get all contracts for a specific network

## Parameters

### network

`"sepolia"`

Network name (e.g., 'sepolia')

## Returns

`object`

All contract addresses for the network

### communities

> `readonly` **communities**: `object`

#### communities.aastar

> `readonly` **aastar**: `object`

AAStar Community - Test community for development (registered: 2025-11-01)

#### communities.aastar.ensName

> `readonly` **ensName**: `"aastar.eth"` = `'aastar.eth'`

#### communities.aastar.gasToken

> `readonly` **gasToken**: `` `0x${string}` `` = `TEST_TOKEN_ADDRESSES.apnts`

#### communities.aastar.name

> `readonly` **name**: `"AAStar"` = `'AAStar'`

#### communities.aastar.owner

> `readonly` **owner**: `"0x411BD567E46C0781248dbB6a9211891C032885e5"` = `COMMUNITY_OWNERS.aastarOwner`

#### communities.aastar.stake

> `readonly` **stake**: `"50"` = `'50'`

#### communities.breadCommunity

> `readonly` **breadCommunity**: `object`

BreadCommunity - Test community for development (registered: 2025-11-03)

#### communities.breadCommunity.ensName

> `readonly` **ensName**: `"bread.eth"` = `'bread.eth'`

#### communities.breadCommunity.gasToken

> `readonly` **gasToken**: `` `0x${string}` `` = `TEST_TOKEN_ADDRESSES.bpnts`

#### communities.breadCommunity.name

> `readonly` **name**: `"BreadCommunity"` = `'BreadCommunity'`

#### communities.breadCommunity.owner

> `readonly` **owner**: `"0xe24b6f321B0140716a2b671ed0D983bb64E7DaFA"` = `COMMUNITY_OWNERS.breadCommunityOwner`

#### communities.breadCommunity.stake

> `readonly` **stake**: `"50"` = `'50'`

### core

> `readonly` **core**: `object` = `CORE_ADDRESSES`

#### core.aPNTs

> `readonly` **aPNTs**: `` `0x${string}` `` = `APNTS_ADDRESS`

#### core.dvtValidator

> `readonly` **dvtValidator**: `` `0x${string}` `` = `DVT_VALIDATOR_ADDRESS`

#### core.entryPoint

> `readonly` **entryPoint**: `` `0x${string}` `` = `ENTRY_POINT_ADDRESS`

#### core.gToken

> `readonly` **gToken**: `` `0x${string}` `` = `GTOKEN_ADDRESS`

#### core.gTokenStaking

> `readonly` **gTokenStaking**: `` `0x${string}` `` = `GTOKEN_STAKING_ADDRESS`

#### core.mySBT

> `readonly` **mySBT**: `` `0x${string}` `` = `SBT_ADDRESS`

#### core.paymasterFactory

> `readonly` **paymasterFactory**: `` `0x${string}` `` = `PAYMASTER_FACTORY_ADDRESS`

#### core.paymasterV4

> `readonly` **paymasterV4**: `` `0x${string}` ``

#### core.registry

> `readonly` **registry**: `` `0x${string}` `` = `REGISTRY_ADDRESS`

#### core.reputationSystem

> `readonly` **reputationSystem**: `` `0x${string}` ``

#### core.superPaymaster

> `readonly` **superPaymaster**: `` `0x${string}` `` = `SUPER_PAYMASTER_ADDRESS`

#### core.xPNTsFactory

> `readonly` **xPNTsFactory**: `` `0x${string}` `` = `XPNTS_FACTORY_ADDRESS`

### monitoring

> `readonly` **monitoring**: `object` = `MONITORING_ADDRESSES`

#### monitoring.blsAggregator

> `readonly` **blsAggregator**: `` `0x${string}` `` = `BLS_AGGREGATOR_ADDRESS`

#### monitoring.dvtValidator

> `readonly` **dvtValidator**: `` `0x${string}` `` = `DVT_VALIDATOR_ADDRESS`

### official

> `readonly` **official**: `object` = `OFFICIAL_ADDRESSES`

#### official.entryPoint

> `readonly` **entryPoint**: `` `0x${string}` ``

### paymaster

> `readonly` **paymaster**: `object` = `PAYMASTER_ADDRESSES`

#### paymaster.paymasterV4\_1

> `readonly` **paymasterV4\_1**: `` `0x${string}` ``

#### paymaster.paymasterV4\_1iImplementation

> `readonly` **paymasterV4\_1iImplementation**: `` `0x${string}` `` = `PAYMASTER_V4_IMPL_ADDRESS`

### testAccounts

> `readonly` **testAccounts**: `object` = `TEST_ACCOUNT_ADDRESSES`

#### testAccounts.simpleAccountFactory

> `readonly` **simpleAccountFactory**: `` `0x${string}` ``

### testTokens

> `readonly` **testTokens**: `object` = `TEST_TOKEN_ADDRESSES`

#### testTokens.apnts

> `readonly` **apnts**: `` `0x${string}` `` = `APNTS_ADDRESS`

#### testTokens.bpnts

> `readonly` **bpnts**: `` `0x${string}` `` = `GTOKEN_ADDRESS`

#### testTokens.gToken

> `readonly` **gToken**: `` `0x${string}` `` = `GTOKEN_ADDRESS`

#### testTokens.mockUSDT

> `readonly` **mockUSDT**: `` `0x${string}` ``

#### testTokens.pimToken

> `readonly` **pimToken**: `` `0x${string}` `` = `TOKEN_ADDRESSES.pimToken`

### tokens

> `readonly` **tokens**: `object` = `TOKEN_ADDRESSES`

#### tokens.aPNTs

> `readonly` **aPNTs**: `` `0x${string}` `` = `APNTS_ADDRESS`

#### tokens.gToken

> `readonly` **gToken**: `` `0x${string}` `` = `GTOKEN_ADDRESS`

#### tokens.pimToken

> `readonly` **pimToken**: `` `0x${string}` ``

#### tokens.xPNTsFactory

> `readonly` **xPNTsFactory**: `` `0x${string}` `` = `XPNTS_FACTORY_ADDRESS`

## Example

```ts
const contracts = getContracts('sepolia');
console.log(contracts.core.superPaymaster);
```
