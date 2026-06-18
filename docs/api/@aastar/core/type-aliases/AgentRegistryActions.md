> **AgentRegistryActions** = `object`

Defined in: [packages/core/src/actions/agentRegistry.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L6)

## Properties

### agentWalletOwner()

> **agentWalletOwner**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/agentRegistry.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L17)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `agentWallet`: `Address`; \} |
| `args.agentWallet` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### bindFactory()

> **bindFactory**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/agentRegistry.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L30)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `factory`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.factory` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### deployer()

> **deployer**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/agentRegistry.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L8)

#### Returns

`Promise`\<`Address`\>

***

### deregisterAgent()

> **deregisterAgent**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/agentRegistry.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L47)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `agentWallet`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.agentWallet` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### factory()

> **factory**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/agentRegistry.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L9)

#### Returns

`Promise`\<`Address`\>

***

### getAgentByIndex()

> **getAgentByIndex**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/agentRegistry.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; `owner`: `Address`; \} |
| `args.index` | `bigint` |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### getAgentCount()

> **getAgentCount**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/agentRegistry.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `owner`: `Address`; \} |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### getAgents()

> **getAgents**: (`args`) => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/agentRegistry.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L21)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `humanOwner`: `Address`; \} |
| `args.humanOwner` | `Address` |

#### Returns

`Promise`\<`Address`[]\>

***

### getAgentsPage()

> **getAgentsPage**: (`args`) => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/agentRegistry.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L23)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `count`: `bigint`; `owner`: `Address`; `start`: `bigint`; \} |
| `args.count` | `bigint` |
| `args.owner` | `Address` |
| `args.start` | `bigint` |

#### Returns

`Promise`\<`Address`[]\>

***

### getHumanOwner()

> **getHumanOwner**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/agentRegistry.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L15)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `agentWallet`: `Address`; \} |
| `args.agentWallet` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### isRegisteredAgent()

> **isRegisteredAgent**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/agentRegistry.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L11)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `agentWallet`: `Address`; \} |
| `args.agentWallet` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### isValidAccount()

> **isValidAccount**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/agentRegistry.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; \} |
| `args.account` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### markValid()

> **markValid**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/agentRegistry.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L31)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; `signer?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account` | `Address` |
| `args.signer?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### ownerAgents()

> **ownerAgents**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/agentRegistry.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L27)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; `owner`: `Address`; \} |
| `args.index` | `bigint` |
| `args.owner` | `Address` |

#### Returns

`Promise`\<`Address`\>

***

### registerAgent()

> **registerAgent**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/agentRegistry.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L43)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `agentWallet`: `Address`; `agentWalletSig`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.agentWallet` | `Address` |
| `args.agentWalletSig` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### revokeAgent()

> **revokeAgent**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/agentRegistry.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agentRegistry.ts#L45)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `agentWallet`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.agentWallet` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
