> **EndUserClient** = [`Client`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html), [`Account`](https://viem.sh/docs/index.html) \| `undefined`\> & [`PublicActions`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html), [`Account`](https://viem.sh/docs/index.html) \| `undefined`\> & [`WalletActions`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html), [`Account`](https://viem.sh/docs/index.html) \| `undefined`\> & [`RegistryActions`](RegistryActions.md) & [`SBTActions`](SBTActions.md) & [`SuperPaymasterActions`](SuperPaymasterActions.md) & [`PaymasterActions`](PaymasterActions.md) & `object`

Defined in: [packages/sdk/src/clients/endUser.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/sdk/src/clients/endUser.ts#L19)

## Type Declaration

### checkJoinRequirements()

> **checkJoinRequirements**: (`address?`) => `Promise`\<\{ `hasEnoughGToken`: `boolean`; `hasSBT`: `boolean`; `missingRequirements`: `string`[]; \}\>

Check if the user meets the requirements to join a community (stake, sbt, etc.)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `address?` | `Address` |

#### Returns

`Promise`\<\{ `hasEnoughGToken`: `boolean`; `hasSBT`: `boolean`; `missingRequirements`: `string`[]; \}\>

### createSmartAccount()

> **createSmartAccount**: (`params`) => `Promise`\<\{ `accountAddress`: `Address`; `initCode`: [`Hex`](https://viem.sh/docs/index.html); `isDeployed`: `boolean`; \}\>

Predict the address of a SimpleAccount without deploying

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `owner`: `Address`; `salt?`: `bigint`; \} |
| `params.owner` | `Address` |
| `params.salt?` | `bigint` |

#### Returns

`Promise`\<\{ `accountAddress`: `Address`; `initCode`: [`Hex`](https://viem.sh/docs/index.html); `isDeployed`: `boolean`; \}\>

### deploySmartAccount()

> **deploySmartAccount**: (`params`) => `Promise`\<\{ `accountAddress`: `Address`; `deployTxHash`: [`Hash`](https://viem.sh/docs/index.html); `isDeployed`: `boolean`; \}\>

Predict or deploy a SimpleAccount (ERC-4337)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `fundWithETH?`: `bigint`; `owner`: `Address`; `salt?`: `bigint`; \} |
| `params.fundWithETH?` | `bigint` |
| `params.owner` | `Address` |
| `params.salt?` | `bigint` |

#### Returns

`Promise`\<\{ `accountAddress`: `Address`; `deployTxHash`: [`Hash`](https://viem.sh/docs/index.html); `isDeployed`: `boolean`; \}\>

### executeGasless()

> **executeGasless**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Executes a gasless transaction via SuperPaymaster.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `data`: [`Hex`](https://viem.sh/docs/index.html); `operator`: `Address`; `target`: `Address`; `value?`: `bigint`; \} |
| `args.data` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.operator` | `Address` |
| `args.target` | `Address` |
| `args.value?` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### joinAndActivate()

> **joinAndActivate**: (`args`) => `Promise`\<\{ `initialCredit`: `bigint`; `sbtId`: `bigint`; `tx`: [`Hash`](https://viem.sh/docs/index.html); \}\>

Orchestrates the user joining a community and activating gas credit flow:
1. Mint SBT for the community (Register ENDUSER role)
2. Verify Credit is active (Reputation check)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `roleData?`: [`Hex`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.community` | `Address` |
| `args.roleData?` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<\{ `initialCredit`: `bigint`; `sbtId`: `bigint`; `tx`: [`Hash`](https://viem.sh/docs/index.html); \}\>

### onboard()

> **onboard**: (`args`) => `Promise`\<\{ `sbtId`: `bigint`; `tx`: [`Hash`](https://viem.sh/docs/index.html); \}\>

High-level API: Onboard user to community with automatic funding

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `community`: `Address`; `roleData`: [`Hex`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.community` | `Address` |
| `args.roleData` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<\{ `sbtId`: `bigint`; `tx`: [`Hash`](https://viem.sh/docs/index.html); \}\>
