> `const` **RoleDataFactory**: `object`

Defined in: [packages/sdk/src/utils/roleData.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/sdk/src/utils/roleData.ts#L16)

## Type Declaration

### community()

> **community**: (`params?`) => `` `0x${string}` ``

Data for Community Registration (matches Registry.sol CommunityRoleData)
NOTE: Solidity's abi.encode(struct) adds a 32-byte offset prefix (0x20)
which is required for abi.decode(struct) to work correctly.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params?` | \{ `description?`: `string`; `ensName?`: `string`; `logoURI?`: `string`; `name?`: `string`; `stakeAmount?`: `bigint`; `website?`: `string`; \} | - |
| `params.description?` | `string` | Community description (optional) |
| `params.ensName?` | `string` | ENS name (optional) |
| `params.logoURI?` | `string` | Logo URI string (optional) |
| `params.name?` | `string` | Community Name (defaults to 'TestCommunity') |
| `params.stakeAmount?` | `bigint` | Stake amount (defaults to 0) |
| `params.website?` | `string` | Website URL (optional) |

#### Returns

`` `0x${string}` ``

### decodeCommunity()

> **decodeCommunity**: (`data`) => `object`

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `data` | `` `0x${string}` `` |

#### Returns

`object`

##### description

> **description**: `any` = `d`

##### ensName

> **ensName**: `any` = `e`

##### logoURI

> **logoURI**: `any` = `l`

##### name

> **name**: `any` = `n`

##### stakeAmount

> **stakeAmount**: `any` = `s`

##### website

> **website**: `any` = `w`

### decodeEndUser()

> **decodeEndUser**: (`data`) => `object`

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `data` | `` `0x${string}` `` |

#### Returns

`object`

##### account

> **account**: `any` = `a`

##### avatarURI

> **avatarURI**: `any` = `av`

##### community

> **community**: `any` = `c`

##### ensName

> **ensName**: `any` = `en`

##### stakeAmount

> **stakeAmount**: `any` = `s`

### dvt()

> **dvt**: () => `` `0x${string}` ``

Data for Generic DVT Role (Empty)

#### Returns

`` `0x${string}` ``

### endUser()

> **endUser**: (`params?`) => `` `0x${string}` ``

Data for EndUser (matches Registry.sol EndUserRoleData)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params?` | \{ `account?`: `` `0x${string}` ``; `avatarURI?`: `string`; `community?`: `` `0x${string}` ``; `ensName?`: `string`; `stakeAmount?`: `bigint`; \} |
| `params.account?` | `` `0x${string}` `` |
| `params.avatarURI?` | `string` |
| `params.community?` | `` `0x${string}` `` |
| `params.ensName?` | `string` |
| `params.stakeAmount?` | `bigint` |

#### Returns

`` `0x${string}` ``

### paymasterSuper()

> **paymasterSuper**: () => `` `0x${string}` ``

Data for SuperPaymaster Operator (Empty)

#### Returns

`` `0x${string}` ``
