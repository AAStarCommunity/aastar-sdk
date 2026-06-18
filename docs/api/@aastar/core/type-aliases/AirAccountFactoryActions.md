> **AirAccountFactoryActions** = `object`

Defined in: [packages/core/src/actions/airAccountFactory.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccountFactory.ts#L7)

## Properties

### agentRegistry()

> **agentRegistry**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/airAccountFactory.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccountFactory.ts#L28)

#### Returns

`Promise`\<`Address`\>

***

### createAccount()

> **createAccount**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccountFactory.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccountFactory.ts#L16)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `config`: [`InitConfig`](InitConfig.md); `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `owner`: `Address`; `salt`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.config` | [`InitConfig`](InitConfig.md) |
| `args.maxFeePerGas?` | `bigint` |
| `args.maxPriorityFeePerGas?` | `bigint` |
| `args.owner` | `Address` |
| `args.salt` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### createAgentAccount()

> **createAgentAccount**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccountFactory.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccountFactory.ts#L36)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `agentId`: [`Hex`](https://viem.sh/docs/index.html); `agentKey`: `Address`; `agentKeySig`: [`Hex`](https://viem.sh/docs/index.html); `dailyLimit`: `bigint`; `deadline`: `bigint` \| `number`; `guardian2`: `Address`; `guardian2Sig`: [`Hex`](https://viem.sh/docs/index.html); `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.agentId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.agentKey` | `Address` |
| `args.agentKeySig` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.dailyLimit` | `bigint` |
| `args.deadline` | `bigint` \| `number` |
| `args.guardian2` | `Address` |
| `args.guardian2Sig` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.maxFeePerGas?` | `bigint` |
| `args.maxPriorityFeePerGas?` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### defaultCommunityGuardian()

> **defaultCommunityGuardian**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/airAccountFactory.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccountFactory.ts#L24)

#### Returns

`Promise`\<`Address`\>

***

### factoryAdmin()

> **factoryAdmin**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/airAccountFactory.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccountFactory.ts#L22)

#### Returns

`Promise`\<`Address`\>

***

### getAddress()

> **getAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/airAccountFactory.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccountFactory.ts#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `config`: [`InitConfig`](InitConfig.md); `owner`: `Address`; `salt`: `bigint`; \} |
| `args.config` | [`InitConfig`](InitConfig.md) |
| `args.owner` | `Address` |
| `args.salt` | `bigint` |

#### Returns

`Promise`\<`Address`\>

***

### getAddressWithChainId()

> **getAddressWithChainId**: (`args`) => `Promise`\<\{ `account`: `Address`; `chainQualified`: [`Hex`](https://viem.sh/docs/index.html); \}\>

Defined in: [packages/core/src/actions/airAccountFactory.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccountFactory.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `config`: [`InitConfig`](InitConfig.md); `owner`: `Address`; `salt`: `bigint`; \} |
| `args.config` | [`InitConfig`](InitConfig.md) |
| `args.owner` | `Address` |
| `args.salt` | `bigint` |

#### Returns

`Promise`\<\{ `account`: `Address`; `chainQualified`: [`Hex`](https://viem.sh/docs/index.html); \}\>

***

### getAddressWithDefaults()

> **getAddressWithDefaults**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/airAccountFactory.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccountFactory.ts#L11)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `dailyLimit`: `bigint`; `guard`: `Address`; `owner`: `Address`; `salt`: `bigint`; `validator`: `Address`; \} |
| `args.dailyLimit` | `bigint` |
| `args.guard` | `Address` |
| `args.owner` | `Address` |
| `args.salt` | `bigint` |
| `args.validator` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### getAgentAddress()

> **getAgentAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/airAccountFactory.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccountFactory.ts#L31)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `agentId`: [`Hex`](https://viem.sh/docs/index.html); `agentKey`: `Address`; `humanOwner`: `Address`; \} |
| `args.agentId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.agentKey` | `Address` |
| `args.humanOwner` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### getChainQualifiedAddress()

> **getChainQualifiedAddress**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccountFactory.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccountFactory.ts#L18)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; \} |
| `args.account` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### implementation()

> **implementation**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/airAccountFactory.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccountFactory.ts#L20)

#### Returns

`Promise`\<`Address`\>

***

### setAgentRegistry()

> **setAgentRegistry**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/airAccountFactory.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/airAccountFactory.ts#L49)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `agentRegistry`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.agentRegistry` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
