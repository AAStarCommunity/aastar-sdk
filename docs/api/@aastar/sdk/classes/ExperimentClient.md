Defined in: [packages/sdk/src/clients/ExperimentClient.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/sdk/src/clients/ExperimentClient.ts#L19)

ExperimentClient: Business-layer tool for measuring and recording execution metrics

## Constructors

### Constructor

> **new ExperimentClient**(`scenarioId`, `group`): `ExperimentClient`

Defined in: [packages/sdk/src/clients/ExperimentClient.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/sdk/src/clients/ExperimentClient.ts#L24)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `scenarioId` | `string` |
| `group` | `"EOA"` \| `"AA"` \| `"SuperPaymaster"` |

#### Returns

`ExperimentClient`

## Methods

### getRecords()

> **getRecords**(): [`ExperimentRecord`](../interfaces/ExperimentRecord.md)[]

Defined in: [packages/sdk/src/clients/ExperimentClient.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/sdk/src/clients/ExperimentClient.ts#L77)

#### Returns

[`ExperimentRecord`](../interfaces/ExperimentRecord.md)[]

***

### measureTx()

> **measureTx**(`taskName`, `txPromise`, `publicClient`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/sdk/src/clients/ExperimentClient.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/sdk/src/clients/ExperimentClient.ts#L57)

Measure an async task (transaction) automatically

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `taskName` | `string` |
| `txPromise` | `Promise`\<`` `0x${string}` ``\> |
| `publicClient` | `any` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### recordTx()

> **recordTx**(`txHash`, `receipt`, `status`, `meta?`): [`ExperimentRecord`](../interfaces/ExperimentRecord.md)

Defined in: [packages/sdk/src/clients/ExperimentClient.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/sdk/src/clients/ExperimentClient.ts#L32)

Record a transaction result

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `txHash` | `` `0x${string}` `` |
| `receipt` | \{ `effectiveGasPrice`: `any`; `gasUsed`: `any`; \} |
| `receipt.effectiveGasPrice` | `any` |
| `receipt.gasUsed` | `any` |
| `status?` | `"Success"` \| `"Failed"` |
| `meta?` | `any` |

#### Returns

[`ExperimentRecord`](../interfaces/ExperimentRecord.md)
