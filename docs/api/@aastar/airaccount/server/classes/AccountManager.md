Defined in: [packages/airaccount/src/server/services/account-manager.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/account-manager.ts#L22)

Account manager — extracted from NestJS AccountService.
Creates and retrieves smart accounts without framework dependencies.

## Constructors

### Constructor

> **new AccountManager**(`ethereum`, `storage`, `signer`, `logger?`): `AccountManager`

Defined in: [packages/airaccount/src/server/services/account-manager.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/account-manager.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `ethereum` | [`EthereumProvider`](EthereumProvider.md) |
| `storage` | [`IStorageAdapter`](../interfaces/IStorageAdapter.md) |
| `signer` | [`ISignerAdapter`](../interfaces/ISignerAdapter.md) |
| `logger?` | [`ILogger`](../interfaces/ILogger.md) |

#### Returns

`AccountManager`

## Methods

### buildGuardianAcceptanceHash()

> **buildGuardianAcceptanceHash**(`owner`, `salt`, `factoryAddress`, `chainId`, `dailyLimit`): `string`

Defined in: [packages/airaccount/src/server/services/account-manager.ts:179](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/account-manager.ts#L179)

Build the acceptance hash that guardian devices must sign before account creation.

Encoding: keccak256(solidityPacked(
  ["string","uint256","address","address","uint256","uint256"],
  ["ACCEPT_GUARDIAN", chainId, factoryAddress, owner, salt, dailyLimit]
))

dailyLimit is bound in the hash (PR #47 / C-3) to prevent a front-runner from
replaying guardian sigs with a weaker limit on the same counterfactual address.

Returns the RAW keccak256 hash (no EIP-191 prefix).
Guardians MUST sign via personal_sign / ethers.signMessage(ethers.getBytes(hash)).
Do NOT use eth_sign — the EIP-191 "\x19Ethereum Signed Message:\n32" prefix
is applied inside the contract (toEthSignedMessageHash) before ecrecover, not here.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `owner` | `string` |
| `salt` | `number` \| `bigint` |
| `factoryAddress` | `string` |
| `chainId` | `number` |
| `dailyLimit` | `bigint` |

#### Returns

`string`

raw hex keccak256 hash — encode this into the QR code shown to guardian devices

***

### createAccount()

> **createAccount**(`userId`, `options?`): `Promise`\<[`AccountRecord`](../interfaces/AccountRecord.md)\>

Defined in: [packages/airaccount/src/server/services/account-manager.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/account-manager.ts#L34)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `userId` | `string` | - |
| `options?` | \{ `dailyLimit?`: `bigint`; `entryPointVersion?`: [`EntryPointVersion`](../enumerations/EntryPointVersion.md); `salt?`: `number` \| `bigint`; \} | - |
| `options.dailyLimit?` | `bigint` | Daily transfer limit in wei. When > 0 the account is created with on-chain guard enforcement. |
| `options.entryPointVersion?` | [`EntryPointVersion`](../enumerations/EntryPointVersion.md) | - |
| `options.salt?` | `number` \| `bigint` | - |

#### Returns

`Promise`\<[`AccountRecord`](../interfaces/AccountRecord.md)\>

***

### createAccountWithGuardians()

> **createAccountWithGuardians**(`userId`, `params`): `Promise`\<[`AccountRecord`](../interfaces/AccountRecord.md)\>

Defined in: [packages/airaccount/src/server/services/account-manager.ts:234](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/account-manager.ts#L234)

Create an AirAccount with 3 on-chain guardians:
  - guardian1 and guardian2: user's own devices (passkeys on phone 1 and phone 2)
  - guardian3: team Safe multisig (defaultCommunityGuardian, set in factory at deploy time)

Both guardian1 and guardian2 must sign the acceptance hash produced by
buildGuardianAcceptanceHash() before this method is called.

Recovery: any 2-of-3 guardians can initiate social recovery after a 48h timelock.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |
| `params` | \{ `dailyLimit`: `bigint`; `entryPointVersion?`: [`EntryPointVersion`](../enumerations/EntryPointVersion.md); `guardian1`: `string`; `guardian1Sig`: `string`; `guardian2`: `string`; `guardian2Sig`: `string`; `salt?`: `number` \| `bigint`; \} |
| `params.dailyLimit` | `bigint` |
| `params.entryPointVersion?` | [`EntryPointVersion`](../enumerations/EntryPointVersion.md) |
| `params.guardian1` | `string` |
| `params.guardian1Sig` | `string` |
| `params.guardian2` | `string` |
| `params.guardian2Sig` | `string` |
| `params.salt?` | `number` \| `bigint` |

#### Returns

`Promise`\<[`AccountRecord`](../interfaces/AccountRecord.md)\>

***

### encodeModifyTierLimits()

> **encodeModifyTierLimits**(`tier1`, `tier2`, `deadline`, `guardianSigs`): `string`

Defined in: [packages/airaccount/src/server/services/account-manager.ts:211](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/account-manager.ts#L211)

Encode calldata for modifyTierLimitsWithGuardians() — guardian-gated tier-limit change (PR #43).

Both tier1 and tier2 can be raised or lowered, subject to guardian approval.
Caller is responsible for building and submitting the resulting UserOp.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `tier1` | `bigint` | New Tier-1 ceiling in wei (ECDSA-only spending; 0 = no limit) |
| `tier2` | `bigint` | New Tier-2 ceiling in wei (dual-factor; 0 = no limit) |
| `deadline` | `bigint` | Unix timestamp — guardian sigs rejected after this |
| `guardianSigs` | `string`[] | 65-byte EIP-191 hex signatures from required guardians |

#### Returns

`string`

***

### getAccount()

> **getAccount**(`userId`): `Promise`\<[`AccountRecord`](../interfaces/AccountRecord.md) & `object` \| `null`\>

Defined in: [packages/airaccount/src/server/services/account-manager.ts:112](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/account-manager.ts#L112)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<[`AccountRecord`](../interfaces/AccountRecord.md) & `object` \| `null`\>

***

### getAccountAddress()

> **getAccountAddress**(`userId`): `Promise`\<`string`\>

Defined in: [packages/airaccount/src/server/services/account-manager.ts:131](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/account-manager.ts#L131)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<`string`\>

***

### getAccountBalance()

> **getAccountBalance**(`userId`): `Promise`\<\{ `address`: `string`; `balance`: `string`; `balanceInWei`: `string`; \}\>

Defined in: [packages/airaccount/src/server/services/account-manager.ts:137](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/account-manager.ts#L137)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<\{ `address`: `string`; `balance`: `string`; `balanceInWei`: `string`; \}\>

***

### getAccountByUserId()

> **getAccountByUserId**(`userId`): `Promise`\<[`AccountRecord`](../interfaces/AccountRecord.md) \| `null`\>

Defined in: [packages/airaccount/src/server/services/account-manager.ts:157](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/account-manager.ts#L157)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<[`AccountRecord`](../interfaces/AccountRecord.md) \| `null`\>

***

### getAccountNonce()

> **getAccountNonce**(`userId`): `Promise`\<\{ `address`: `string`; `nonce`: `string`; \}\>

Defined in: [packages/airaccount/src/server/services/account-manager.ts:150](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/account-manager.ts#L150)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

#### Returns

`Promise`\<\{ `address`: `string`; `nonce`: `string`; \}\>
