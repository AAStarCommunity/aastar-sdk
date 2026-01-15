> `const` **RoleDataFactory**: `object`

Defined in: [packages/sdk/src/utils/roleData.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/utils/roleData.ts#L16)

## Type Declaration

### community()

> **community**: (`params?`) => `` `0x${string}` ``

Data for Community Registration (matches Registry.sol CommunityRoleData)
NOTE: Solidity's abi.encode(struct) adds a 32-byte offset prefix (0x20)
which is required for abi.decode(struct) to work correctly.

#### Parameters

##### params?

###### description?

`string`

Community description (optional)

###### ensName?

`string`

ENS name (optional)

###### logoURI?

`string`

Logo URI string (optional)

###### name?

`string`

Community Name (defaults to 'TestCommunity')

###### stakeAmount?

`bigint`

Stake amount (defaults to 0)

###### website?

`string`

Website URL (optional)

#### Returns

`` `0x${string}` ``

### decodeCommunity()

> **decodeCommunity**: (`data`) => `object`

#### Parameters

##### data

`` `0x${string}` ``

#### Returns

`object`

##### description

> **description**: `any` = `result.description`

##### ensName

> **ensName**: `any` = `result.ensName`

##### logoURI

> **logoURI**: `any` = `result.logoURI`

##### name

> **name**: `any` = `result.name`

##### stakeAmount

> **stakeAmount**: `any` = `result.stakeAmount`

##### website

> **website**: `any` = `result.website`

### decodeEndUser()

> **decodeEndUser**: (`data`) => `object`

#### Parameters

##### data

`` `0x${string}` ``

#### Returns

`object`

##### account

> **account**: `any` = `result.account`

##### avatarURI

> **avatarURI**: `any` = `result.avatarURI`

##### community

> **community**: `any` = `result.community`

##### ensName

> **ensName**: `any` = `result.ensName`

##### stakeAmount

> **stakeAmount**: `any` = `result.stakeAmount`

### dvt()

> **dvt**: () => `` `0x${string}` ``

Data for Generic DVT Role (Empty)

#### Returns

`` `0x${string}` ``

### endUser()

> **endUser**: (`params?`) => `` `0x${string}` ``

Data for EndUser (matches Registry.sol EndUserRoleData)

#### Parameters

##### params?

###### account?

`` `0x${string}` ``

###### avatarURI?

`string`

###### community?

`` `0x${string}` ``

###### ensName?

`string`

###### stakeAmount?

`bigint`

#### Returns

`` `0x${string}` ``

### paymasterSuper()

> **paymasterSuper**: () => `` `0x${string}` ``

Data for SuperPaymaster Operator (Empty)

#### Returns

`` `0x${string}` ``
