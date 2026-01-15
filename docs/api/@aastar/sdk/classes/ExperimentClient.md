Defined in: [packages/sdk/src/clients/ExperimentClient.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/clients/ExperimentClient.ts#L19)

ExperimentClient: Business-layer tool for measuring and recording execution metrics

## Constructors

### Constructor

> **new ExperimentClient**(`scenarioId`, `group`): `ExperimentClient`

Defined in: [packages/sdk/src/clients/ExperimentClient.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/clients/ExperimentClient.ts#L24)

#### Parameters

##### scenarioId

`string`

##### group

`"SuperPaymaster"` | `"EOA"` | `"AA"`

#### Returns

`ExperimentClient`

## Methods

### getRecords()

> **getRecords**(): [`ExperimentRecord`](../interfaces/ExperimentRecord.md)[]

Defined in: [packages/sdk/src/clients/ExperimentClient.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/clients/ExperimentClient.ts#L77)

#### Returns

[`ExperimentRecord`](../interfaces/ExperimentRecord.md)[]

***

### measureTx()

> **measureTx**(`taskName`, `txPromise`, `publicClient`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/sdk/src/clients/ExperimentClient.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/clients/ExperimentClient.ts#L57)

Measure an async task (transaction) automatically

#### Parameters

##### taskName

`string`

##### txPromise

`Promise`\<`` `0x${string}` ``\>

##### publicClient

`any`

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### recordTx()

> **recordTx**(`txHash`, `receipt`, `status`, `meta?`): [`ExperimentRecord`](../interfaces/ExperimentRecord.md)

Defined in: [packages/sdk/src/clients/ExperimentClient.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/clients/ExperimentClient.ts#L32)

Record a transaction result

#### Parameters

##### txHash

`` `0x${string}` ``

##### receipt

###### effectiveGasPrice

`any`

###### gasUsed

`any`

##### status

`"Success"` | `"Failed"`

##### meta?

`any`

#### Returns

[`ExperimentRecord`](../interfaces/ExperimentRecord.md)
