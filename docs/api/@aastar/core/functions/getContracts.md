> **getContracts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:130](https://github.com/AAStarCommunity/aastar-sdk/blob/de58973e339aee27579a805788c7048e2d9099f3/packages/core/src/contracts.ts#L130)

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

> `readonly` **gasToken**: `"0xBD0710596010a157B88cd141d797E8Ad4bb2306b"` = `TEST_TOKEN_ADDRESSES.aPNTs`

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

> `readonly` **gasToken**: `"0x70Da2c1B7Fcf471247Bc3B09f8927a4ab1751Ba3"` = `TEST_TOKEN_ADDRESSES.bPNTs`

#### communities.breadCommunity.name

> `readonly` **name**: `"BreadCommunity"` = `'BreadCommunity'`

#### communities.breadCommunity.owner

> `readonly` **owner**: `"0xe24b6f321B0140716a2b671ed0D983bb64E7DaFA"` = `COMMUNITY_OWNERS.breadCommunityOwner`

#### communities.breadCommunity.stake

> `readonly` **stake**: `"50"` = `'50'`

### core

> `readonly` **core**: `object` = `CORE_ADDRESSES`

#### core.aPNTs

> `readonly` **aPNTs**: `` `0x${string}` `` \| `undefined`

#### core.gToken

> `readonly` **gToken**: `` `0x${string}` ``

#### core.gTokenStaking

> `readonly` **gTokenStaking**: `` `0x${string}` ``

#### core.mySBT

> `readonly` **mySBT**: `` `0x${string}` ``

#### core.paymasterFactory

> `readonly` **paymasterFactory**: `` `0x${string}` ``

#### core.registry

> `readonly` **registry**: `` `0x${string}` ``

#### core.superPaymaster

> `readonly` **superPaymaster**: `` `0x${string}` ``

### monitoring

> `readonly` **monitoring**: `object` = `MONITORING_ADDRESSES`

#### monitoring.blsAggregator

> `readonly` **blsAggregator**: `"0x3Cf0587912c692aa0f5FEEEDC52959ABEEEFaEc6"` = `'0x3Cf0587912c692aa0f5FEEEDC52959ABEEEFaEc6'`

#### monitoring.dvtValidator

> `readonly` **dvtValidator**: `"0x937CdD172fb0674Db688149093356F6dA95498FD"` = `'0x937CdD172fb0674Db688149093356F6dA95498FD'`

### official

> `readonly` **official**: `object` = `OFFICIAL_ADDRESSES`

#### official.entryPoint

> `readonly` **entryPoint**: `"0x0000000071727De22E5E9d8BAf0edAc6f37da032"` = `'0x0000000071727De22E5E9d8BAf0edAc6f37da032'`

### paymaster

> `readonly` **paymaster**: `object` = `PAYMASTER_ADDRESSES`

#### paymaster.paymasterV4\_1

> `readonly` **paymasterV4\_1**: `"0x4D6A367aA183903968833Ec4AE361CFc8dDDBA38"` = `'0x4D6A367aA183903968833Ec4AE361CFc8dDDBA38'`

#### paymaster.paymasterV4\_1iImplementation

> `readonly` **paymasterV4\_1iImplementation**: `"0x3E1C6a741f4b3f8bE24f324342539982324a6f8a"` = `'0x3E1C6a741f4b3f8bE24f324342539982324a6f8a'`

### testAccounts

> `readonly` **testAccounts**: `object` = `TEST_ACCOUNT_ADDRESSES`

#### testAccounts.simpleAccountFactory

> `readonly` **simpleAccountFactory**: `"0x8B516A71c134a4b5196775e63b944f88Cc637F2b"` = `'0x8B516A71c134a4b5196775e63b944f88Cc637F2b'`

### testTokens

> `readonly` **testTokens**: `object` = `TEST_TOKEN_ADDRESSES`

#### testTokens.aPNTs

> `readonly` **aPNTs**: `"0xBD0710596010a157B88cd141d797E8Ad4bb2306b"` = `'0xBD0710596010a157B88cd141d797E8Ad4bb2306b'`

#### testTokens.bPNTs

> `readonly` **bPNTs**: `"0x70Da2c1B7Fcf471247Bc3B09f8927a4ab1751Ba3"` = `'0x70Da2c1B7Fcf471247Bc3B09f8927a4ab1751Ba3'`

#### testTokens.mockUSDT

> `readonly` **mockUSDT**: `"0x14EaC6C3D49AEDff3D59773A7d7bfb50182bCfDc"` = `'0x14EaC6C3D49AEDff3D59773A7d7bfb50182bCfDc'`

### tokens

> `readonly` **tokens**: `object` = `TOKEN_ADDRESSES`

#### tokens.xPNTsFactory

> `readonly` **xPNTsFactory**: `"0x9dD72cB42427fC9F7Bf0c949DB7def51ef29D6Bd"` = `'0x9dD72cB42427fC9F7Bf0c949DB7def51ef29D6Bd'`

## Example

```ts
const contracts = getContracts('sepolia');
console.log(contracts.core.superPaymaster);
```
