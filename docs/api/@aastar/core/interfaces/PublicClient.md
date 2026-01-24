Defined in: [packages/core/src/clients/doc-types.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/doc-types.ts#L7)

Public Client Interface
Standardized interface for reading from the blockchain.

## Extends

- [`PublicClient`](https://viem.sh/docs/index.html)

## Properties

### account

> **account**: `undefined`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:73

The Account of the Client.

#### Inherited from

`ViemPublicClient.account`

***

### batch?

> `optional` **batch**: `object`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:75

Flags for batch settings.

#### multicall?

> `optional` **multicall**: `boolean` \| \{ `batchSize?`: `number`; `deployless?`: `boolean`; `wait?`: `number`; \}

Toggle to enable `eth_call` multicall aggregation.

##### Type Declaration

`boolean`

\{ `batchSize?`: `number`; `deployless?`: `boolean`; `wait?`: `number`; \}

#### Inherited from

`ViemPublicClient.batch`

***

### cacheTime

> **cacheTime**: `number`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:77

Time (in ms) that cached data will remain in memory.

#### Inherited from

`ViemPublicClient.cacheTime`

***

### call()

> **call**: (`parameters`) => `Promise`\<[`CallReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:89

Executes a new message call immediately without submitting a transaction to the network.

- Docs: https://viem.sh/docs/actions/public/call
- JSON-RPC Methods: [`eth_call`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_call)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `parameters` | [`CallParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`\> |

#### Returns

`Promise`\<[`CallReturnType`](https://viem.sh/docs/index.html)\>

The call data. [CallReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const data = await client.call({
  account: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
  data: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
})
```

#### Inherited from

`ViemPublicClient.call`

***

### ccipRead?

> `optional` **ccipRead**: `false` \| \{ `request?`: (`parameters`) => `Promise`\<`` `0x${string}` ``\>; \}

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:79

[CCIP Read](https://eips.ethereum.org/EIPS/eip-3668) configuration.

#### Type Declaration

`false`

\{ `request?`: (`parameters`) => `Promise`\<`` `0x${string}` ``\>; \}

#### request()?

> `optional` **request**: (`parameters`) => `Promise`\<`` `0x${string}` ``\>

A function that will be called to make the offchain CCIP lookup request.

##### Parameters

| Parameter | Type |
| ------ | ------ |
| `parameters` | [`CcipRequestParameters`](https://viem.sh/docs/index.html) |

##### Returns

`Promise`\<`` `0x${string}` ``\>

##### See

https://eips.ethereum.org/EIPS/eip-3668#client-lookup-protocol

#### Inherited from

`ViemPublicClient.ccipRead`

***

### chain

> **chain**: [`Chain`](https://viem.sh/docs/index.html) \| `undefined`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:81

Chain for the client.

#### Inherited from

`ViemPublicClient.chain`

***

### createAccessList()

> **createAccessList**: (`parameters`) => `Promise`\<\{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `gasUsed`: `bigint`; \}\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:113

Creates an EIP-2930 access list that you can include in a transaction.

- Docs: https://viem.sh/docs/actions/public/createAccessList
- JSON-RPC Methods: `eth_createAccessList`

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `parameters` | [`CreateAccessListParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`\> |

#### Returns

`Promise`\<\{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `gasUsed`: `bigint`; \}\>

The call data. [CreateAccessListReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

const data = await client.createAccessList({
  data: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
})
```

#### Inherited from

`ViemPublicClient.createAccessList`

***

### createBlockFilter()

> **createBlockFilter**: () => `Promise`\<\{ `id`: `` `0x${string}` ``; `request`: [`EIP1193RequestFn`](https://viem.sh/docs/index.html)\<readonly \[\{ `Method`: `"eth_getFilterChanges"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: `` `0x${string}` ``[] \| [`RpcLog`](https://viem.sh/docs/index.html)[]; \}, \{ `Method`: `"eth_getFilterLogs"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: [`RpcLog`](https://viem.sh/docs/index.html)[]; \}, \{ `Method`: `"eth_uninstallFilter"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: `boolean`; \}\]\>; `type`: `"block"`; \}\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:133

Creates a Filter to listen for new block hashes that can be used with [`getFilterChanges`](https://viem.sh/docs/actions/public/getFilterChanges).

- Docs: https://viem.sh/docs/actions/public/createBlockFilter
- JSON-RPC Methods: [`eth_newBlockFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_newBlockFilter)

#### Returns

`Promise`\<\{ `id`: `` `0x${string}` ``; `request`: [`EIP1193RequestFn`](https://viem.sh/docs/index.html)\<readonly \[\{ `Method`: `"eth_getFilterChanges"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: `` `0x${string}` ``[] \| [`RpcLog`](https://viem.sh/docs/index.html)[]; \}, \{ `Method`: `"eth_getFilterLogs"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: [`RpcLog`](https://viem.sh/docs/index.html)[]; \}, \{ `Method`: `"eth_uninstallFilter"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: `boolean`; \}\]\>; `type`: `"block"`; \}\>

Filter. [CreateBlockFilterReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, createBlockFilter, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const filter = await createBlockFilter(client)
// { id: "0x345a6572337856574a76364e457a4366", type: 'block' }
```

#### Inherited from

`ViemPublicClient.createBlockFilter`

***

### createContractEventFilter()

> **createContractEventFilter**: \<`abi`, `eventName`, `args`, `strict`, `fromBlock`, `toBlock`\>(`args`) => `Promise`\<[`CreateContractEventFilterReturnType`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `args`, `strict`, `fromBlock`, `toBlock`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:154

Creates a Filter to retrieve event logs that can be used with [`getFilterChanges`](https://viem.sh/docs/actions/public/getFilterChanges) or [`getFilterLogs`](https://viem.sh/docs/actions/public/getFilterLogs).

- Docs: https://viem.sh/docs/contract/createContractEventFilter

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `abi` *extends* `Abi` \| readonly `unknown`[] | - |
| `eventName` *extends* `string` \| `undefined` | - |
| `args` *extends* `Record`\<`string`, `unknown`\> \| readonly `unknown`[] \| `undefined` | - |
| `strict` *extends* `boolean` \| `undefined` | `undefined` |
| `fromBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |
| `toBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`CreateContractEventFilterParameters`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `args`, `strict`, `fromBlock`, `toBlock`\> | [CreateContractEventFilterParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`CreateContractEventFilterReturnType`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `args`, `strict`, `fromBlock`, `toBlock`\>\>

[`Filter`](https://viem.sh/docs/glossary/types#filter). [CreateContractEventFilterReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const filter = await client.createContractEventFilter({
  abi: parseAbi(['event Transfer(address indexed, address indexed, uint256)']),
})
```

#### Inherited from

`ViemPublicClient.createContractEventFilter`

***

### createEventFilter()

> **createEventFilter**: \<`abiEvent`, `abiEvents`, `strict`, `fromBlock`, `toBlock`, `_EventName`, `_Args`\>(`args?`) => `Promise`\<\{ \[K in string \| number \| symbol\]: Filter\<"event", abiEvents, \_EventName, \_Args, strict, fromBlock, toBlock\>\[K\] \}\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:176

Creates a [`Filter`](https://viem.sh/docs/glossary/types#filter) to listen for new events that can be used with [`getFilterChanges`](https://viem.sh/docs/actions/public/getFilterChanges).

- Docs: https://viem.sh/docs/actions/public/createEventFilter
- JSON-RPC Methods: [`eth_newFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_newfilter)

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `abiEvent` *extends* `AbiEvent` \| `undefined` | `undefined` |
| `abiEvents` *extends* readonly `unknown`[] \| readonly `AbiEvent`[] \| `undefined` | `abiEvent` *extends* `AbiEvent` ? \[`abiEvent`\<`abiEvent`\>\] : `undefined` |
| `strict` *extends* `boolean` \| `undefined` | `undefined` |
| `fromBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |
| `toBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |
| `_EventName` *extends* `string` \| `undefined` | [`MaybeAbiEventName`](https://viem.sh/docs/index.html)\<`abiEvent`\> |
| `_Args` *extends* `Record`\<`string`, `unknown`\> \| readonly `unknown`[] \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args?` | [`CreateEventFilterParameters`](https://viem.sh/docs/index.html)\<`abiEvent`, `abiEvents`, `strict`, `fromBlock`, `toBlock`, `_EventName`, `_Args`\> | [CreateEventFilterParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<\{ \[K in string \| number \| symbol\]: Filter\<"event", abiEvents, \_EventName, \_Args, strict, fromBlock, toBlock\>\[K\] \}\>

[`Filter`](https://viem.sh/docs/glossary/types#filter). [CreateEventFilterReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const filter = await client.createEventFilter({
  address: '0xfba3912ca04dd458c843e2ee08967fc04f3579c2',
})
```

#### Inherited from

`ViemPublicClient.createEventFilter`

***

### createPendingTransactionFilter()

> **createPendingTransactionFilter**: () => `Promise`\<\{ `id`: `` `0x${string}` ``; `request`: [`EIP1193RequestFn`](https://viem.sh/docs/index.html)\<readonly \[\{ `Method`: `"eth_getFilterChanges"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: `` `0x${string}` ``[] \| [`RpcLog`](https://viem.sh/docs/index.html)[]; \}, \{ `Method`: `"eth_getFilterLogs"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: [`RpcLog`](https://viem.sh/docs/index.html)[]; \}, \{ `Method`: `"eth_uninstallFilter"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: `boolean`; \}\]\>; `type`: `"transaction"`; \}\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:196

Creates a Filter to listen for new pending transaction hashes that can be used with [`getFilterChanges`](https://viem.sh/docs/actions/public/getFilterChanges).

- Docs: https://viem.sh/docs/actions/public/createPendingTransactionFilter
- JSON-RPC Methods: [`eth_newPendingTransactionFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_newpendingtransactionfilter)

#### Returns

`Promise`\<\{ `id`: `` `0x${string}` ``; `request`: [`EIP1193RequestFn`](https://viem.sh/docs/index.html)\<readonly \[\{ `Method`: `"eth_getFilterChanges"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: `` `0x${string}` ``[] \| [`RpcLog`](https://viem.sh/docs/index.html)[]; \}, \{ `Method`: `"eth_getFilterLogs"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: [`RpcLog`](https://viem.sh/docs/index.html)[]; \}, \{ `Method`: `"eth_uninstallFilter"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: `boolean`; \}\]\>; `type`: `"transaction"`; \}\>

[`Filter`](https://viem.sh/docs/glossary/types#filter). [CreateBlockFilterReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const filter = await client.createPendingTransactionFilter()
// { id: "0x345a6572337856574a76364e457a4366", type: 'transaction' }
```

#### Inherited from

`ViemPublicClient.createPendingTransactionFilter`

***

### estimateContractGas()

> **estimateContractGas**: \<`chain`, `abi`, `functionName`, `args`\>(`args`) => `Promise`\<`bigint`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:223

Estimates the gas required to successfully execute a contract write function call.

- Docs: https://viem.sh/docs/contract/estimateContractGas

#### Type Parameters

| Type Parameter |
| ------ |
| `chain` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` |
| `abi` *extends* `Abi` \| readonly `unknown`[] |
| `functionName` *extends* `string` |
| `args` *extends* `unknown` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`EstimateContractGasParameters`](https://viem.sh/docs/index.html)\<`abi`, `functionName`, `args`, `chain`\> | [EstimateContractGasParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`bigint`\>

The gas estimate (in wei). [EstimateContractGasReturnType](https://viem.sh/docs/index.html)

#### Remarks

Internally, uses a [Public Client](https://viem.sh/docs/clients/public) to call the [`estimateGas` action](https://viem.sh/docs/actions/public/estimateGas) with [ABI-encoded `data`](https://viem.sh/docs/contract/encodeFunctionData).

#### Example

```ts
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const gas = await client.estimateContractGas({
  address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
  abi: parseAbi(['function mint() public']),
  functionName: 'mint',
  account: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
})
```

#### Inherited from

`ViemPublicClient.estimateContractGas`

***

### estimateFeesPerGas()

> **estimateFeesPerGas**: \<`chainOverride`, `type`\>(`args?`) => `Promise`\<[`EstimateFeesPerGasReturnType`](https://viem.sh/docs/index.html)\<`type`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:685

Returns an estimate for the fees per gas for a transaction to be included
in the next block.

- Docs: https://viem.sh/docs/actions/public/estimateFeesPerGas

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |
| `type` *extends* [`FeeValuesType`](https://viem.sh/docs/index.html) | `"eip1559"` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args?` | [`EstimateFeesPerGasParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `chainOverride`, `type`\> |

#### Returns

`Promise`\<[`EstimateFeesPerGasReturnType`](https://viem.sh/docs/index.html)\<`type`\>\>

An estimate (in wei) for the fees per gas. [EstimateFeesPerGasReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const maxPriorityFeePerGas = await client.estimateFeesPerGas()
// { maxFeePerGas: ..., maxPriorityFeePerGas: ... }
```

#### Inherited from

`ViemPublicClient.estimateFeesPerGas`

***

### estimateGas()

> **estimateGas**: (`args`) => `Promise`\<`bigint`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:247

Estimates the gas necessary to complete a transaction without submitting it to the network.

- Docs: https://viem.sh/docs/actions/public/estimateGas
- JSON-RPC Methods: [`eth_estimateGas`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_estimategas)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`EstimateGasParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`\> | [EstimateGasParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`bigint`\>

The gas estimate (in wei). [EstimateGasReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http, parseEther } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const gasEstimate = await client.estimateGas({
  account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
  to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  value: parseEther('1'),
})
```

#### Inherited from

`ViemPublicClient.estimateGas`

***

### estimateMaxPriorityFeePerGas()

> **estimateMaxPriorityFeePerGas**: \<`chainOverride`\>(`args?`) => `Promise`\<`bigint`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:877

Returns an estimate for the max priority fee per gas (in wei) for a transaction
to be included in the next block.

- Docs: https://viem.sh/docs/actions/public/estimateMaxPriorityFeePerGas

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args?` | \{ `chain`: `chainOverride` \| `null`; \} |
| `args.chain?` | `chainOverride` \| `null` |

#### Returns

`Promise`\<`bigint`\>

An estimate (in wei) for the max priority fee per gas. [EstimateMaxPriorityFeePerGasReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const maxPriorityFeePerGas = await client.estimateMaxPriorityFeePerGas()
// 10000000n
```

#### Inherited from

`ViemPublicClient.estimateMaxPriorityFeePerGas`

***

### experimental\_blockTag?

> `optional` **experimental\_blockTag**: [`BlockTag`](https://viem.sh/docs/index.html)

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:83

Default block tag to use for RPC requests.

#### Inherited from

`ViemPublicClient.experimental_blockTag`

***

### extend()

> **extend**: \<`client`\>(`fn`) => [`Client`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `undefined`, [`PublicRpcSchema`](https://viem.sh/docs/index.html), \{ \[K in string \| number \| symbol\]: client\[K\] \} & [`PublicActions`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:69

#### Type Parameters

| Type Parameter |
| ------ |
| `client` *extends* `object` & [`ExactPartial`](https://viem.sh/docs/index.html)\<[`ExtendableProtectedActions`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `undefined`\>\> |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `fn` | (`client`) => `client` |

#### Returns

[`Client`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `undefined`, [`PublicRpcSchema`](https://viem.sh/docs/index.html), \{ \[K in string \| number \| symbol\]: client\[K\] \} & [`PublicActions`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`\>\>

#### Inherited from

`ViemPublicClient.extend`

***

### fillTransaction()

> **fillTransaction**: \<`chainOverride`, `accountOverride`\>(`args`) => `Promise`\<[`FillTransactionReturnType`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `chainOverride`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:271

Fills a transaction request with the necessary fields to be signed over.

- Docs: https://viem.sh/docs/actions/public/fillTransaction

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |
| `accountOverride` *extends* `` `0x${string}` `` \| [`Account`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`FillTransactionParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`, `chainOverride`, `accountOverride`\> |

#### Returns

`Promise`\<[`FillTransactionReturnType`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `chainOverride`\>\>

The filled transaction. [FillTransactionReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const result = await client.fillTransaction({
  account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
  to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  value: parseEther('1'),
})
```

#### Inherited from

`ViemPublicClient.fillTransaction`

***

### getBalance()

> **getBalance**: (`args`) => `Promise`\<`bigint`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:306

Returns the balance of an address in wei.

- Docs: https://viem.sh/docs/actions/public/getBalance
- JSON-RPC Methods: [`eth_getBalance`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getbalance)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`GetBalanceParameters`](https://viem.sh/docs/index.html) | [GetBalanceParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`bigint`\>

The balance of the address in wei. [GetBalanceReturnType](https://viem.sh/docs/index.html)

#### Remarks

You can convert the balance to ether units with [`formatEther`](https://viem.sh/docs/utilities/formatEther).

```ts
const balance = await getBalance(client, {
  address: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
  blockTag: 'safe'
})
const balanceAsEther = formatEther(balance)
// "6.942"
```

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const balance = await client.getBalance({
  address: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
})
// 10000000000000000000000n (wei)
```

#### Inherited from

`ViemPublicClient.getBalance`

***

### getBlobBaseFee()

> **getBlobBaseFee**: () => `Promise`\<`bigint`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:327

Returns the base fee per blob gas in wei.

- Docs: https://viem.sh/docs/actions/public/getBlobBaseFee
- JSON-RPC Methods: [`eth_blobBaseFee`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_blobBaseFee)

#### Returns

`Promise`\<`bigint`\>

The blob base fee (in wei). [GetBlobBaseFeeReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { getBlobBaseFee } from 'viem/public'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const blobBaseFee = await client.getBlobBaseFee()
```

#### Inherited from

`ViemPublicClient.getBlobBaseFee`

***

### getBlock()

> **getBlock**: \<`includeTransactions`, `blockTag`\>(`args?`) => `Promise`\<\{ `baseFeePerGas`: `bigint` \| `null`; `blobGasUsed`: `bigint`; `difficulty`: `bigint`; `excessBlobGas`: `bigint`; `extraData`: `` `0x${string}` ``; `gasLimit`: `bigint`; `gasUsed`: `bigint`; `hash`: `blockTag` *extends* `"pending"` ? `null` : `` `0x${string}` ``; `logsBloom`: `blockTag` *extends* `"pending"` ? `null` : `` `0x${string}` ``; `miner`: `` `0x${string}` ``; `mixHash`: `` `0x${string}` ``; `nonce`: `blockTag` *extends* `"pending"` ? `null` : `` `0x${string}` ``; `number`: `blockTag` *extends* `"pending"` ? `null` : `bigint`; `parentBeaconBlockRoot?`: `` `0x${string}` ``; `parentHash`: `` `0x${string}` ``; `receiptsRoot`: `` `0x${string}` ``; `sealFields`: `` `0x${string}` ``[]; `sha3Uncles`: `` `0x${string}` ``; `size`: `bigint`; `stateRoot`: `` `0x${string}` ``; `timestamp`: `bigint`; `totalDifficulty`: `bigint` \| `null`; `transactions`: `includeTransactions` *extends* `true` ? (\{ `accessList?`: `undefined`; `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId?`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice`: `bigint`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"legacy"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity?`: `undefined`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice`: `bigint`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip2930"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip1559"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes`: readonly `` `0x${string}` ``[]; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas`: `bigint`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip4844"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList`: [`SignedAuthorizationList`](https://viem.sh/docs/index.html); `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip7702"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \})[] : `` `0x${string}` ``[]; `transactionsRoot`: `` `0x${string}` ``; `uncles`: `` `0x${string}` ``[]; `withdrawals?`: [`Withdrawal`](https://viem.sh/docs/index.html)[]; `withdrawalsRoot?`: `` `0x${string}` ``; \}\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:350

Returns information about a block at a block number, hash, or tag.

- Docs: https://viem.sh/docs/actions/public/getBlock
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_fetching-blocks
- JSON-RPC Methods:
  - Calls [`eth_getBlockByNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbynumber) for `blockNumber` & `blockTag`.
  - Calls [`eth_getBlockByHash`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbyhash) for `blockHash`.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `includeTransactions` *extends* `boolean` | `false` |
| `blockTag` *extends* [`BlockTag`](https://viem.sh/docs/index.html) | `"latest"` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args?` | [`GetBlockParameters`](https://viem.sh/docs/index.html)\<`includeTransactions`, `blockTag`\> | [GetBlockParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<\{ `baseFeePerGas`: `bigint` \| `null`; `blobGasUsed`: `bigint`; `difficulty`: `bigint`; `excessBlobGas`: `bigint`; `extraData`: `` `0x${string}` ``; `gasLimit`: `bigint`; `gasUsed`: `bigint`; `hash`: `blockTag` *extends* `"pending"` ? `null` : `` `0x${string}` ``; `logsBloom`: `blockTag` *extends* `"pending"` ? `null` : `` `0x${string}` ``; `miner`: `` `0x${string}` ``; `mixHash`: `` `0x${string}` ``; `nonce`: `blockTag` *extends* `"pending"` ? `null` : `` `0x${string}` ``; `number`: `blockTag` *extends* `"pending"` ? `null` : `bigint`; `parentBeaconBlockRoot?`: `` `0x${string}` ``; `parentHash`: `` `0x${string}` ``; `receiptsRoot`: `` `0x${string}` ``; `sealFields`: `` `0x${string}` ``[]; `sha3Uncles`: `` `0x${string}` ``; `size`: `bigint`; `stateRoot`: `` `0x${string}` ``; `timestamp`: `bigint`; `totalDifficulty`: `bigint` \| `null`; `transactions`: `includeTransactions` *extends* `true` ? (\{ `accessList?`: `undefined`; `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId?`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice`: `bigint`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"legacy"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity?`: `undefined`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice`: `bigint`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip2930"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip1559"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes`: readonly `` `0x${string}` ``[]; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas`: `bigint`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip4844"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList`: [`SignedAuthorizationList`](https://viem.sh/docs/index.html); `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip7702"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \})[] : `` `0x${string}` ``[]; `transactionsRoot`: `` `0x${string}` ``; `uncles`: `` `0x${string}` ``[]; `withdrawals?`: [`Withdrawal`](https://viem.sh/docs/index.html)[]; `withdrawalsRoot?`: `` `0x${string}` ``; \}\>

Information about the block. [GetBlockReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const block = await client.getBlock()
```

#### Inherited from

`ViemPublicClient.getBlock`

***

### getBlockNumber()

> **getBlockNumber**: (`args?`) => `Promise`\<`bigint`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:372

Returns the number of the most recent block seen.

- Docs: https://viem.sh/docs/actions/public/getBlockNumber
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_fetching-blocks
- JSON-RPC Methods: [`eth_blockNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_blocknumber)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args?` | [`GetBlockNumberParameters`](https://viem.sh/docs/index.html) | [GetBlockNumberParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`bigint`\>

The number of the block. [GetBlockNumberReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const blockNumber = await client.getBlockNumber()
// 69420n
```

#### Inherited from

`ViemPublicClient.getBlockNumber`

***

### getBlockTransactionCount()

> **getBlockTransactionCount**: (`args?`) => `Promise`\<`number`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:394

Returns the number of Transactions at a block number, hash, or tag.

- Docs: https://viem.sh/docs/actions/public/getBlockTransactionCount
- JSON-RPC Methods:
  - Calls [`eth_getBlockTransactionCountByNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblocktransactioncountbynumber) for `blockNumber` & `blockTag`.
  - Calls [`eth_getBlockTransactionCountByHash`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblocktransactioncountbyhash) for `blockHash`.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args?` | [`GetBlockTransactionCountParameters`](https://viem.sh/docs/index.html) | [GetBlockTransactionCountParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`number`\>

The block transaction count. [GetBlockTransactionCountReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const count = await client.getBlockTransactionCount()
```

#### Inherited from

`ViemPublicClient.getBlockTransactionCount`

***

### ~~getBytecode()~~

> **getBytecode**: (`args`) => `Promise`\<[`GetCodeReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:396

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`GetCodeParameters`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`GetCodeReturnType`](https://viem.sh/docs/index.html)\>

#### Deprecated

Use `getCode` instead.

#### Inherited from

`ViemPublicClient.getBytecode`

***

### getChainId()

> **getChainId**: () => `Promise`\<`number`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:416

Returns the chain ID associated with the current network.

- Docs: https://viem.sh/docs/actions/public/getChainId
- JSON-RPC Methods: [`eth_chainId`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_chainid)

#### Returns

`Promise`\<`number`\>

The current chain ID. [GetChainIdReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const chainId = await client.getChainId()
// 1
```

#### Inherited from

`ViemPublicClient.getChainId`

***

### getCode()

> **getCode**: (`args`) => `Promise`\<[`GetCodeReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:438

Retrieves the bytecode at an address.

- Docs: https://viem.sh/docs/contract/getCode
- JSON-RPC Methods: [`eth_getCode`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getcode)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`GetCodeParameters`](https://viem.sh/docs/index.html) | GetBytecodeParameters |

#### Returns

`Promise`\<[`GetCodeReturnType`](https://viem.sh/docs/index.html)\>

The contract's bytecode. GetBytecodeReturnType

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const code = await client.getCode({
  address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
})
```

#### Inherited from

`ViemPublicClient.getCode`

***

### getContractEvents()

> **getContractEvents**: \<`abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>(`args`) => `Promise`\<[`GetContractEventsReturnType`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:464

Returns a list of event logs emitted by a contract.

- Docs: https://viem.sh/docs/actions/public/getContractEvents
- JSON-RPC Methods: [`eth_getLogs`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getlogs)

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `abi` *extends* `Abi` \| readonly `unknown`[] | - |
| `eventName` *extends* `string` \| `undefined` | `undefined` |
| `strict` *extends* `boolean` \| `undefined` | `undefined` |
| `fromBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |
| `toBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`GetContractEventsParameters`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\> |

#### Returns

`Promise`\<[`GetContractEventsReturnType`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>\>

A list of event logs. [GetContractEventsReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { wagmiAbi } from './abi'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const logs = await client.getContractEvents(client, {
 address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 abi: wagmiAbi,
 eventName: 'Transfer'
})
```

#### Inherited from

`ViemPublicClient.getContractEvents`

***

### getEip712Domain()

> **getEip712Domain**: (`args`) => `Promise`\<[`GetEip712DomainReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:497

Reads the EIP-712 domain from a contract, based on the ERC-5267 specification.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`GetEip712DomainParameters`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`GetEip712DomainReturnType`](https://viem.sh/docs/index.html)\>

The EIP-712 domain, fields, and extensions. [GetEip712DomainReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

const domain = await client.getEip712Domain({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
})
// {
//   domain: {
//     name: 'ExampleContract',
//     version: '1',
//     chainId: 1,
//     verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
//   },
//   fields: '0x0f',
//   extensions: [],
// }
```

#### Inherited from

`ViemPublicClient.getEip712Domain`

***

### getEnsAddress()

> **getEnsAddress**: (`args`) => `Promise`\<[`GetEnsAddressReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:526

Gets address for ENS name.

- Docs: https://viem.sh/docs/ens/actions/getEnsAddress
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | \{ `blockNumber?`: `bigint`; `blockTag?`: [`BlockTag`](https://viem.sh/docs/index.html); `coinType?`: `bigint`; `gatewayUrls?`: `string`[]; `name`: `string`; `strict?`: `boolean`; `universalResolverAddress?`: `` `0x${string}` ``; \} | [GetEnsAddressParameters](https://viem.sh/docs/index.html) |
| `args.blockNumber?` | `bigint` | The balance of the account at a block number. |
| `args.blockTag?` | [`BlockTag`](https://viem.sh/docs/index.html) | The balance of the account at a block tag. **Default** `'latest'` |
| `args.coinType?` | `bigint` | ENSIP-9 compliant coinType (chain) to get ENS address for. To get the `coinType` for a chain id, use the `toCoinType` function: `import { toCoinType } from 'viem' import { base } from 'viem/chains' const coinType = toCoinType(base.id)` **Default** `60n` |
| `args.gatewayUrls?` | `string`[] | Universal Resolver gateway URLs to use for resolving CCIP-read requests. |
| `args.name` | `string` | Name to get the address for. |
| `args.strict?` | `boolean` | Whether or not to throw errors propagated from the ENS Universal Resolver Contract. |
| `args.universalResolverAddress?` | `` `0x${string}` `` | Address of ENS Universal Resolver Contract. |

#### Returns

`Promise`\<[`GetEnsAddressReturnType`](https://viem.sh/docs/index.html)\>

Address for ENS name or `null` if not found. [GetEnsAddressReturnType](https://viem.sh/docs/index.html)

#### Remarks

Calls `resolve(bytes, bytes)` on ENS Universal Resolver Contract.

Since ENS names prohibit certain forbidden characters (e.g. underscore) and have other validation rules, you likely want to [normalize ENS names](https://docs.ens.domains/contract-api-reference/name-processing#normalising-names) with [UTS-46 normalization](https://unicode.org/reports/tr46) before passing them to `getEnsAddress`. You can use the built-in [`normalize`](https://viem.sh/docs/ens/utilities/normalize) function for this.

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const ensAddress = await client.getEnsAddress({
  name: normalize('wevm.eth'),
})
// '0xd2135CfB216b74109775236E36d4b433F1DF507B'
```

#### Inherited from

`ViemPublicClient.getEnsAddress`

***

### getEnsAvatar()

> **getEnsAvatar**: (`args`) => `Promise`\<[`GetEnsAvatarReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:555

Gets the avatar of an ENS name.

- Docs: https://viem.sh/docs/ens/actions/getEnsAvatar
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | \{ `assetGatewayUrls?`: [`AssetGatewayUrls`](https://viem.sh/docs/index.html); `blockNumber?`: `bigint`; `blockTag?`: [`BlockTag`](https://viem.sh/docs/index.html); `gatewayUrls?`: `string`[]; `name`: `string`; `strict?`: `boolean`; `universalResolverAddress?`: `` `0x${string}` ``; \} | [GetEnsAvatarParameters](https://viem.sh/docs/index.html) |
| `args.assetGatewayUrls?` | [`AssetGatewayUrls`](https://viem.sh/docs/index.html) | Gateway urls to resolve IPFS and/or Arweave assets. |
| `args.blockNumber?` | `bigint` | The balance of the account at a block number. |
| `args.blockTag?` | [`BlockTag`](https://viem.sh/docs/index.html) | The balance of the account at a block tag. **Default** `'latest'` |
| `args.gatewayUrls?` | `string`[] | Universal Resolver gateway URLs to use for resolving CCIP-read requests. |
| `args.name` | `string` | ENS name to get Text for. |
| `args.strict?` | `boolean` | Whether or not to throw errors propagated from the ENS Universal Resolver Contract. |
| `args.universalResolverAddress?` | `` `0x${string}` `` | Address of ENS Universal Resolver Contract. |

#### Returns

`Promise`\<[`GetEnsAvatarReturnType`](https://viem.sh/docs/index.html)\>

Avatar URI or `null` if not found. [GetEnsAvatarReturnType](https://viem.sh/docs/index.html)

#### Remarks

Calls [`getEnsText`](https://viem.sh/docs/ens/actions/getEnsText) with `key` set to `'avatar'`.

Since ENS names prohibit certain forbidden characters (e.g. underscore) and have other validation rules, you likely want to [normalize ENS names](https://docs.ens.domains/contract-api-reference/name-processing#normalising-names) with [UTS-46 normalization](https://unicode.org/reports/tr46) before passing them to `getEnsAddress`. You can use the built-in [`normalize`](https://viem.sh/docs/ens/utilities/normalize) function for this.

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const ensAvatar = await client.getEnsAvatar({
  name: normalize('wevm.eth'),
})
// 'https://ipfs.io/ipfs/Qma8mnp6xV3J2cRNf3mTth5C8nV11CAnceVinc3y8jSbio'
```

#### Inherited from

`ViemPublicClient.getEnsAvatar`

***

### getEnsName()

> **getEnsName**: (`args`) => `Promise`\<[`GetEnsNameReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:581

Gets primary name for specified address.

- Docs: https://viem.sh/docs/ens/actions/getEnsName
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | \{ `address`: `` `0x${string}` ``; `blockNumber?`: `bigint`; `blockTag?`: [`BlockTag`](https://viem.sh/docs/index.html); `coinType?`: `bigint`; `gatewayUrls?`: `string`[]; `strict?`: `boolean`; `universalResolverAddress?`: `` `0x${string}` ``; \} | [GetEnsNameParameters](https://viem.sh/docs/index.html) |
| `args.address` | `` `0x${string}` `` | Address to get ENS name for. |
| `args.blockNumber?` | `bigint` | The balance of the account at a block number. |
| `args.blockTag?` | [`BlockTag`](https://viem.sh/docs/index.html) | The balance of the account at a block tag. **Default** `'latest'` |
| `args.coinType?` | `bigint` | ENSIP-9 compliant coinType (chain) to get ENS name for. To get the `coinType` for a chain id, use the `toCoinType` function: `import { toCoinType } from 'viem' import { base } from 'viem/chains' const coinType = toCoinType(base.id)` **Default** `60n` |
| `args.gatewayUrls?` | `string`[] | Universal Resolver gateway URLs to use for resolving CCIP-read requests. |
| `args.strict?` | `boolean` | Whether or not to throw errors propagated from the ENS Universal Resolver Contract. |
| `args.universalResolverAddress?` | `` `0x${string}` `` | Address of ENS Universal Resolver Contract. |

#### Returns

`Promise`\<[`GetEnsNameReturnType`](https://viem.sh/docs/index.html)\>

Name or `null` if not found. [GetEnsNameReturnType](https://viem.sh/docs/index.html)

#### Remarks

Calls `reverse(bytes)` on ENS Universal Resolver Contract to "reverse resolve" the address to the primary ENS name.

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const ensName = await client.getEnsName({
  address: '0xd2135CfB216b74109775236E36d4b433F1DF507B',
})
// 'wevm.eth'
```

#### Inherited from

`ViemPublicClient.getEnsName`

***

### getEnsResolver()

> **getEnsResolver**: (`args`) => `Promise`\<`` `0x${string}` ``\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:610

Gets resolver for ENS name.

- Docs: https://viem.sh/docs/ens/actions/getEnsResolver
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | \{ `blockNumber?`: `bigint`; `blockTag?`: [`BlockTag`](https://viem.sh/docs/index.html); `name`: `string`; `universalResolverAddress?`: `` `0x${string}` ``; \} | [GetEnsResolverParameters](https://viem.sh/docs/index.html) |
| `args.blockNumber?` | `bigint` | The balance of the account at a block number. |
| `args.blockTag?` | [`BlockTag`](https://viem.sh/docs/index.html) | The balance of the account at a block tag. **Default** `'latest'` |
| `args.name` | `string` | Name to get the address for. |
| `args.universalResolverAddress?` | `` `0x${string}` `` | Address of ENS Universal Resolver Contract. |

#### Returns

`Promise`\<`` `0x${string}` ``\>

Address for ENS resolver. [GetEnsResolverReturnType](https://viem.sh/docs/index.html)

#### Remarks

Calls `findResolver(bytes)` on ENS Universal Resolver Contract to retrieve the resolver of an ENS name.

Since ENS names prohibit certain forbidden characters (e.g. underscore) and have other validation rules, you likely want to [normalize ENS names](https://docs.ens.domains/contract-api-reference/name-processing#normalising-names) with [UTS-46 normalization](https://unicode.org/reports/tr46) before passing them to `getEnsAddress`. You can use the built-in [`normalize`](https://viem.sh/docs/ens/utilities/normalize) function for this.

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const resolverAddress = await client.getEnsResolver({
  name: normalize('wevm.eth'),
})
// '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41'
```

#### Inherited from

`ViemPublicClient.getEnsResolver`

***

### getEnsText()

> **getEnsText**: (`args`) => `Promise`\<[`GetEnsTextReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:640

Gets a text record for specified ENS name.

- Docs: https://viem.sh/docs/ens/actions/getEnsResolver
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | \{ `blockNumber?`: `bigint`; `blockTag?`: [`BlockTag`](https://viem.sh/docs/index.html); `gatewayUrls?`: `string`[]; `key`: `string`; `name`: `string`; `strict?`: `boolean`; `universalResolverAddress?`: `` `0x${string}` ``; \} | [GetEnsTextParameters](https://viem.sh/docs/index.html) |
| `args.blockNumber?` | `bigint` | The balance of the account at a block number. |
| `args.blockTag?` | [`BlockTag`](https://viem.sh/docs/index.html) | The balance of the account at a block tag. **Default** `'latest'` |
| `args.gatewayUrls?` | `string`[] | Universal Resolver gateway URLs to use for resolving CCIP-read requests. |
| `args.key` | `string` | Text record to retrieve. |
| `args.name` | `string` | ENS name to get Text for. |
| `args.strict?` | `boolean` | Whether or not to throw errors propagated from the ENS Universal Resolver Contract. |
| `args.universalResolverAddress?` | `` `0x${string}` `` | Address of ENS Universal Resolver Contract. |

#### Returns

`Promise`\<[`GetEnsTextReturnType`](https://viem.sh/docs/index.html)\>

Address for ENS resolver. [GetEnsTextReturnType](https://viem.sh/docs/index.html)

#### Remarks

Calls `resolve(bytes, bytes)` on ENS Universal Resolver Contract.

Since ENS names prohibit certain forbidden characters (e.g. underscore) and have other validation rules, you likely want to [normalize ENS names](https://docs.ens.domains/contract-api-reference/name-processing#normalising-names) with [UTS-46 normalization](https://unicode.org/reports/tr46) before passing them to `getEnsAddress`. You can use the built-in [`normalize`](https://viem.sh/docs/ens/utilities/normalize) function for this.

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const twitterRecord = await client.getEnsText({
  name: normalize('wevm.eth'),
  key: 'com.twitter',
})
// 'wevm_dev'
```

#### Inherited from

`ViemPublicClient.getEnsText`

***

### getFeeHistory()

> **getFeeHistory**: (`args`) => `Promise`\<[`GetFeeHistoryReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:663

Returns a collection of historical gas information.

- Docs: https://viem.sh/docs/actions/public/getFeeHistory
- JSON-RPC Methods: [`eth_feeHistory`](https://docs.alchemy.com/reference/eth-feehistory)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`GetFeeHistoryParameters`](https://viem.sh/docs/index.html) | [GetFeeHistoryParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`GetFeeHistoryReturnType`](https://viem.sh/docs/index.html)\>

The gas estimate (in wei). [GetFeeHistoryReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const feeHistory = await client.getFeeHistory({
  blockCount: 4,
  rewardPercentiles: [25, 75],
})
```

#### Inherited from

`ViemPublicClient.getFeeHistory`

***

### getFilterChanges()

> **getFilterChanges**: \<`filterType`, `abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>(`args`) => `Promise`\<[`GetFilterChangesReturnType`](https://viem.sh/docs/index.html)\<`filterType`, `abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:764

Returns a list of logs or hashes based on a [Filter](/docs/glossary/terms#filter) since the last time it was called.

- Docs: https://viem.sh/docs/actions/public/getFilterChanges
- JSON-RPC Methods: [`eth_getFilterChanges`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getfilterchanges)

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `filterType` *extends* [`FilterType`](https://viem.sh/docs/index.html) | - |
| `abi` *extends* `Abi` \| readonly `unknown`[] \| `undefined` | - |
| `eventName` *extends* `string` \| `undefined` | - |
| `strict` *extends* `boolean` \| `undefined` | `undefined` |
| `fromBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |
| `toBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`GetFilterChangesParameters`](https://viem.sh/docs/index.html)\<`filterType`, `abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\> | [GetFilterChangesParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`GetFilterChangesReturnType`](https://viem.sh/docs/index.html)\<`filterType`, `abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>\>

Logs or hashes. [GetFilterChangesReturnType](https://viem.sh/docs/index.html)

#### Remarks

A Filter can be created from the following actions:

- [`createBlockFilter`](https://viem.sh/docs/actions/public/createBlockFilter)
- [`createContractEventFilter`](https://viem.sh/docs/contract/createContractEventFilter)
- [`createEventFilter`](https://viem.sh/docs/actions/public/createEventFilter)
- [`createPendingTransactionFilter`](https://viem.sh/docs/actions/public/createPendingTransactionFilter)

Depending on the type of filter, the return value will be different:

- If the filter was created with `createContractEventFilter` or `createEventFilter`, it returns a list of logs.
- If the filter was created with `createPendingTransactionFilter`, it returns a list of transaction hashes.
- If the filter was created with `createBlockFilter`, it returns a list of block hashes.

#### Examples

```ts
// Blocks
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const filter = await client.createBlockFilter()
const hashes = await client.getFilterChanges({ filter })
```

```ts
// Contract Events
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const filter = await client.createContractEventFilter({
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  abi: parseAbi(['event Transfer(address indexed, address indexed, uint256)']),
  eventName: 'Transfer',
})
const logs = await client.getFilterChanges({ filter })
```

```ts
// Raw Events
import { createPublicClient, http, parseAbiItem } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const filter = await client.createEventFilter({
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  event: parseAbiItem('event Transfer(address indexed, address indexed, uint256)'),
})
const logs = await client.getFilterChanges({ filter })
```

```ts
// Transactions
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const filter = await client.createPendingTransactionFilter()
const hashes = await client.getFilterChanges({ filter })
```

#### Inherited from

`ViemPublicClient.getFilterChanges`

***

### getFilterLogs()

> **getFilterLogs**: \<`abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>(`args`) => `Promise`\<[`GetFilterLogsReturnType`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:791

Returns a list of event logs since the filter was created.

- Docs: https://viem.sh/docs/actions/public/getFilterLogs
- JSON-RPC Methods: [`eth_getFilterLogs`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getfilterlogs)

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `abi` *extends* `Abi` \| readonly `unknown`[] \| `undefined` | - |
| `eventName` *extends* `string` \| `undefined` | - |
| `strict` *extends* `boolean` \| `undefined` | `undefined` |
| `fromBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |
| `toBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`GetFilterLogsParameters`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\> | [GetFilterLogsParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`GetFilterLogsReturnType`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>\>

A list of event logs. [GetFilterLogsReturnType](https://viem.sh/docs/index.html)

#### Remarks

`getFilterLogs` is only compatible with **event filters**.

#### Example

```ts
import { createPublicClient, http, parseAbiItem } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const filter = await client.createEventFilter({
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  event: parseAbiItem('event Transfer(address indexed, address indexed, uint256)'),
})
const logs = await client.getFilterLogs({ filter })
```

#### Inherited from

`ViemPublicClient.getFilterLogs`

***

### getGasPrice()

> **getGasPrice**: () => `Promise`\<`bigint`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:810

Returns the current price of gas (in wei).

- Docs: https://viem.sh/docs/actions/public/getGasPrice
- JSON-RPC Methods: [`eth_gasPrice`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gasprice)

#### Returns

`Promise`\<`bigint`\>

The gas price (in wei). [GetGasPriceReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const gasPrice = await client.getGasPrice()
```

#### Inherited from

`ViemPublicClient.getGasPrice`

***

### getLogs()

> **getLogs**: \<`abiEvent`, `abiEvents`, `strict`, `fromBlock`, `toBlock`\>(`args?`) => `Promise`\<[`GetLogsReturnType`](https://viem.sh/docs/index.html)\<`abiEvent`, `abiEvents`, `strict`, `fromBlock`, `toBlock`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:831

Returns a list of event logs matching the provided parameters.

- Docs: https://viem.sh/docs/actions/public/getLogs
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/logs_event-logs
- JSON-RPC Methods: [`eth_getLogs`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getlogs)

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `abiEvent` *extends* `AbiEvent` \| `undefined` | `undefined` |
| `abiEvents` *extends* readonly `unknown`[] \| readonly `AbiEvent`[] \| `undefined` | `abiEvent` *extends* `AbiEvent` ? \[`abiEvent`\<`abiEvent`\>\] : `undefined` |
| `strict` *extends* `boolean` \| `undefined` | `undefined` |
| `fromBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |
| `toBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args?` | [`GetLogsParameters`](https://viem.sh/docs/index.html)\<`abiEvent`, `abiEvents`, `strict`, `fromBlock`, `toBlock`\> | [GetLogsParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`GetLogsReturnType`](https://viem.sh/docs/index.html)\<`abiEvent`, `abiEvents`, `strict`, `fromBlock`, `toBlock`\>\>

A list of event logs. [GetLogsReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http, parseAbiItem } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const logs = await client.getLogs()
```

#### Inherited from

`ViemPublicClient.getLogs`

***

### getProof()

> **getProof**: (`args`) => `Promise`\<[`GetProofReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:856

Returns the account and storage values of the specified account including the Merkle-proof.

- Docs: https://viem.sh/docs/actions/public/getProof
- JSON-RPC Methods:
  - Calls [`eth_getProof`](https://eips.ethereum.org/EIPS/eip-1186)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`GetProofParameters`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`GetProofReturnType`](https://viem.sh/docs/index.html)\>

Proof data. [GetProofReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const block = await client.getProof({
 address: '0x...',
 storageKeys: ['0x...'],
})
```

#### Inherited from

`ViemPublicClient.getProof`

***

### getStorageAt()

> **getStorageAt**: (`args`) => `Promise`\<[`GetStorageAtReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:901

Returns the value from a storage slot at a given address.

- Docs: https://viem.sh/docs/contract/getStorageAt
- JSON-RPC Methods: [`eth_getStorageAt`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getstorageat)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`GetStorageAtParameters`](https://viem.sh/docs/index.html) | [GetStorageAtParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`GetStorageAtReturnType`](https://viem.sh/docs/index.html)\>

The value of the storage slot. [GetStorageAtReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { getStorageAt } from 'viem/contract'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const code = await client.getStorageAt({
  address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
  slot: toHex(0),
})
```

#### Inherited from

`ViemPublicClient.getStorageAt`

***

### getTransaction()

> **getTransaction**: \<`blockTag`\>(`args`) => `Promise`\<\{ `accessList?`: `undefined`; `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId?`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice`: `bigint`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"legacy"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity?`: `undefined`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice`: `bigint`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip2930"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip1559"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes`: readonly `` `0x${string}` ``[]; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas`: `bigint`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip4844"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList`: [`SignedAuthorizationList`](https://viem.sh/docs/index.html); `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip7702"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \}\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:924

Returns information about a [Transaction](https://viem.sh/docs/glossary/terms#transaction) given a hash or block identifier.

- Docs: https://viem.sh/docs/actions/public/getTransaction
- Example: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_fetching-transactions
- JSON-RPC Methods: [`eth_getTransactionByHash`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionByHash)

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `blockTag` *extends* [`BlockTag`](https://viem.sh/docs/index.html) | `"latest"` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`GetTransactionParameters`](https://viem.sh/docs/index.html)\<`blockTag`\> | [GetTransactionParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<\{ `accessList?`: `undefined`; `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId?`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice`: `bigint`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"legacy"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity?`: `undefined`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice`: `bigint`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip2930"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip1559"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes`: readonly `` `0x${string}` ``[]; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas`: `bigint`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip4844"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList`: [`SignedAuthorizationList`](https://viem.sh/docs/index.html); `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip7702"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \}\>

The transaction information. [GetTransactionReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const transaction = await client.getTransaction({
  hash: '0x4ca7ee652d57678f26e887c149ab0735f41de37bcad58c9f6d3ed5824f15b74d',
})
```

#### Inherited from

`ViemPublicClient.getTransaction`

***

### getTransactionConfirmations()

> **getTransactionConfirmations**: (`args`) => `Promise`\<`bigint`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:947

Returns the number of blocks passed (confirmations) since the transaction was processed on a block.

- Docs: https://viem.sh/docs/actions/public/getTransactionConfirmations
- Example: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_fetching-transactions
- JSON-RPC Methods: [`eth_getTransactionConfirmations`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionConfirmations)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`GetTransactionConfirmationsParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`\> | [GetTransactionConfirmationsParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`bigint`\>

The number of blocks passed since the transaction was processed. If confirmations is 0, then the Transaction has not been confirmed & processed yet. [GetTransactionConfirmationsReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const confirmations = await client.getTransactionConfirmations({
  hash: '0x4ca7ee652d57678f26e887c149ab0735f41de37bcad58c9f6d3ed5824f15b74d',
})
```

#### Inherited from

`ViemPublicClient.getTransactionConfirmations`

***

### getTransactionCount()

> **getTransactionCount**: (`args`) => `Promise`\<`number`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:969

Returns the number of [Transactions](https://viem.sh/docs/glossary/terms#transaction) an Account has broadcast / sent.

- Docs: https://viem.sh/docs/actions/public/getTransactionCount
- JSON-RPC Methods: [`eth_getTransactionCount`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactioncount)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`GetTransactionCountParameters`](https://viem.sh/docs/index.html) | [GetTransactionCountParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`number`\>

The number of transactions an account has sent. [GetTransactionCountReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const transactionCount = await client.getTransactionCount({
  address: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
})
```

#### Inherited from

`ViemPublicClient.getTransactionCount`

***

### getTransactionReceipt()

> **getTransactionReceipt**: (`args`) => `Promise`\<[`TransactionReceipt`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:992

Returns the [Transaction Receipt](https://viem.sh/docs/glossary/terms#transaction-receipt) given a [Transaction](https://viem.sh/docs/glossary/terms#transaction) hash.

- Docs: https://viem.sh/docs/actions/public/getTransactionReceipt
- Example: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_fetching-transactions
- JSON-RPC Methods: [`eth_getTransactionReceipt`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionReceipt)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`GetTransactionReceiptParameters`](https://viem.sh/docs/index.html) | [GetTransactionReceiptParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`TransactionReceipt`](https://viem.sh/docs/index.html)\>

The transaction receipt. [GetTransactionReceiptReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const transactionReceipt = await client.getTransactionReceipt({
  hash: '0x4ca7ee652d57678f26e887c149ab0735f41de37bcad58c9f6d3ed5824f15b74d',
})
```

#### Inherited from

`ViemPublicClient.getTransactionReceipt`

***

### key

> **key**: `string`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:85

A key for the client.

#### Inherited from

`ViemPublicClient.key`

***

### multicall()

> **multicall**: \<`contracts`, `allowFailure`\>(`args`) => `Promise`\<[`MulticallReturnType`](https://viem.sh/docs/index.html)\<`contracts`, `allowFailure`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1030

Similar to [`readContract`](https://viem.sh/docs/contract/readContract), but batches up multiple functions on a contract in a single RPC call via the [`multicall3` contract](https://github.com/mds1/multicall).

- Docs: https://viem.sh/docs/contract/multicall

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `contracts` *extends* readonly `unknown`[] | - |
| `allowFailure` *extends* `boolean` | `true` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`MulticallParameters`](https://viem.sh/docs/index.html)\<`contracts`, `allowFailure`\> | [MulticallParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`MulticallReturnType`](https://viem.sh/docs/index.html)\<`contracts`, `allowFailure`\>\>

An array of results with accompanying status. [MulticallReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
])
const result = await client.multicall({
  contracts: [
    {
      address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
      abi,
      functionName: 'balanceOf',
      args: ['0xA0Cf798816D4b9b9866b5330EEa46a18382f251e'],
    },
    {
      address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
      abi,
      functionName: 'totalSupply',
    },
  ],
})
// [{ result: 424122n, status: 'success' }, { result: 1000000n, status: 'success' }]
```

#### Inherited from

`ViemPublicClient.multicall`

***

### name

> **name**: `string`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:87

A name for the client.

#### Inherited from

`ViemPublicClient.name`

***

### pollingInterval

> **pollingInterval**: `number`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:89

Frequency (in ms) for polling enabled actions & events. Defaults to 4_000 milliseconds.

#### Inherited from

`ViemPublicClient.pollingInterval`

***

### prepareTransactionRequest()

> **prepareTransactionRequest**: \<`request`, `chainOverride`, `accountOverride`\>(`args`) => `Promise`\<\{ \[K in string \| number \| symbol\]: (UnionRequiredBy\<Extract\<UnionOmit\<ExtractChainFormatterParameters\<(...), (...), (...)\>, "from"\> & (DeriveChain\<(...), (...)\> extends Chain ? \{ chain: ... \} : \{ chain?: ... \}) & (DeriveAccount\<(...), (...)\> extends Account ? \{ account: ...; from: ... \} : \{ account?: ...; from?: ... \}), IsNever\<(...) \| (...) \| (...) \| (...) \| (...)\> extends true ? unknown : ExactPartial\<(...) \| (...) \| (...) \| (...) \| (...)\>\> & \{ chainId?: number \}, ParameterTypeToParameters\<request\["parameters"\] extends readonly PrepareTransactionRequestParameterType\[\] ? any\[any\]\[number\] : "type" \| "gas" \| "nonce" \| "blobVersionedHashes" \| "fees" \| "chainId"\>\> & (unknown extends request\["kzg"\] ? \{\} : Pick\<request, "kzg"\>))\[K\] \}\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1069

Prepares a transaction request for signing.

- Docs: https://viem.sh/docs/actions/wallet/prepareTransactionRequest

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `request` *extends* [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: `undefined`; `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `bigint`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"legacy"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `bigint`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip2930"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip1559"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: readonly `` `0x${string}` ``[] \| readonly `Uint8Array`[]; `blobVersionedHashes`: readonly `` `0x${string}` ``[]; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `bigint`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: readonly [`BlobSidecar`](https://viem.sh/docs/index.html)\<`` `0x${string}` ``\>[]; `to`: `` `0x${string}` `` \| `null`; `type?`: `"eip4844"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs`: readonly `` `0x${string}` ``[] \| readonly `Uint8Array`[]; `blobVersionedHashes?`: readonly `` `0x${string}` ``[]; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: [`Kzg`](https://viem.sh/docs/index.html); `maxFeePerBlobGas?`: `bigint`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: readonly [`BlobSidecar`](https://viem.sh/docs/index.html)\<`` `0x${string}` ``\>[]; `to`: `` `0x${string}` `` \| `null`; `type?`: `"eip4844"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: [`AuthorizationList`](https://viem.sh/docs/index.html)\<`number`, `boolean`\>; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip7702"`; `value?`: `bigint`; \}, `"from"`\> & `object` & `object` | - |
| `chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |
| `accountOverride` *extends* `` `0x${string}` `` \| [`Account`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`PrepareTransactionRequestParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`, `chainOverride`, `accountOverride`, `request`\> | [PrepareTransactionRequestParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<\{ \[K in string \| number \| symbol\]: (UnionRequiredBy\<Extract\<UnionOmit\<ExtractChainFormatterParameters\<(...), (...), (...)\>, "from"\> & (DeriveChain\<(...), (...)\> extends Chain ? \{ chain: ... \} : \{ chain?: ... \}) & (DeriveAccount\<(...), (...)\> extends Account ? \{ account: ...; from: ... \} : \{ account?: ...; from?: ... \}), IsNever\<(...) \| (...) \| (...) \| (...) \| (...)\> extends true ? unknown : ExactPartial\<(...) \| (...) \| (...) \| (...) \| (...)\>\> & \{ chainId?: number \}, ParameterTypeToParameters\<request\["parameters"\] extends readonly PrepareTransactionRequestParameterType\[\] ? any\[any\]\[number\] : "type" \| "gas" \| "nonce" \| "blobVersionedHashes" \| "fees" \| "chainId"\>\> & (unknown extends request\["kzg"\] ? \{\} : Pick\<request, "kzg"\>))\[K\] \}\>

The transaction request. [PrepareTransactionRequestReturnType](https://viem.sh/docs/index.html)

#### Examples

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const request = await client.prepareTransactionRequest({
  account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
  to: '0x0000000000000000000000000000000000000000',
  value: 1n,
})
```

```ts
// Account Hoisting
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  account: privateKeyToAccount('0x…'),
  chain: mainnet,
  transport: custom(window.ethereum),
})
const request = await client.prepareTransactionRequest({
  to: '0x0000000000000000000000000000000000000000',
  value: 1n,
})
```

#### Inherited from

`ViemPublicClient.prepareTransactionRequest`

***

### readContract()

> **readContract**: \<`abi`, `functionName`, `args`\>(`args`) => `Promise`\<[`ReadContractReturnType`](https://viem.sh/docs/index.html)\<`abi`, `functionName`, `args`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1101

Calls a read-only function on a contract, and returns the response.

- Docs: https://viem.sh/docs/contract/readContract
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/contracts_reading-contracts

#### Type Parameters

| Type Parameter |
| ------ |
| `abi` *extends* `Abi` \| readonly `unknown`[] |
| `functionName` *extends* `string` |
| `args` *extends* `unknown` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`ReadContractParameters`](https://viem.sh/docs/index.html)\<`abi`, `functionName`, `args`\> | [ReadContractParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`ReadContractReturnType`](https://viem.sh/docs/index.html)\<`abi`, `functionName`, `args`\>\>

The response from the contract. Type is inferred. [ReadContractReturnType](https://viem.sh/docs/index.html)

#### Remarks

A "read-only" function (constant function) on a Solidity contract is denoted by a `view` or `pure` keyword. They can only read the state of the contract, and cannot make any changes to it. Since read-only methods do not change the state of the contract, they do not require any gas to be executed, and can be called by any user without the need to pay for gas.

Internally, uses a [Public Client](https://viem.sh/docs/clients/public) to call the [`call` action](https://viem.sh/docs/actions/public/call) with [ABI-encoded `data`](https://viem.sh/docs/contract/encodeFunctionData).

#### Example

```ts
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'
import { readContract } from 'viem/contract'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const result = await client.readContract({
  address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
  abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
  functionName: 'balanceOf',
  args: ['0xA0Cf798816D4b9b9866b5330EEa46a18382f251e'],
})
// 424122n
```

#### Inherited from

`ViemPublicClient.readContract`

***

### request

> **request**: [`EIP1193RequestFn`](https://viem.sh/docs/index.html)\<[`PublicRpcSchema`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:91

Request function wrapped with friendly error handling

#### Inherited from

`ViemPublicClient.request`

***

### sendRawTransaction()

> **sendRawTransaction**: (`args`) => `Promise`\<`` `0x${string}` ``\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1126

Sends a **signed** transaction to the network

- Docs: https://viem.sh/docs/actions/wallet/sendRawTransaction
- JSON-RPC Method: [`eth_sendRawTransaction`](https://ethereum.github.io/execution-apis/api-documentation/)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`SendRawTransactionParameters`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

The transaction hash. [SendRawTransactionReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'
import { sendRawTransaction } from 'viem/wallet'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})

const hash = await client.sendRawTransaction({
  serializedTransaction: '0x02f850018203118080825208808080c080a04012522854168b27e5dc3d5839bab5e6b39e1a0ffd343901ce1622e3d64b48f1a04e00902ae0502c4728cbf12156290df99c3ed7de85b1dbfe20b5c36931733a33'
})
```

#### Inherited from

`ViemPublicClient.sendRawTransaction`

***

### sendRawTransactionSync()

> **sendRawTransactionSync**: (`args`) => `Promise`\<[`TransactionReceipt`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1151

Sends a **signed** transaction to the network

- Docs: https://viem.sh/docs/actions/wallet/sendRawTransactionSync
- JSON-RPC Method: [`eth_sendRawTransactionSync`](https://eips.ethereum.org/EIPS/eip-7966)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`SendRawTransactionSyncParameters`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`TransactionReceipt`](https://viem.sh/docs/index.html)\>

The transaction receipt. [SendRawTransactionSyncReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'
import { sendRawTransactionSync } from 'viem/wallet'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})

const receipt = await client.sendRawTransactionSync({
  serializedTransaction: '0x02f850018203118080825208808080c080a04012522854168b27e5dc3d5839bab5e6b39e1a0ffd343901ce1622e3d64b48f1a04e00902ae0502c4728cbf12156290df99c3ed7de85b1dbfe20b5c36931733a33'
})
```

#### Inherited from

`ViemPublicClient.sendRawTransactionSync`

***

### ~~simulate()~~

> **simulate**: \<`calls`\>(`args`) => `Promise`\<[`SimulateBlocksReturnType`](https://viem.sh/docs/index.html)\<`calls`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1155

#### Type Parameters

| Type Parameter |
| ------ |
| `calls` *extends* readonly `unknown`[] |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`SimulateBlocksParameters`](https://viem.sh/docs/index.html)\<`calls`\> |

#### Returns

`Promise`\<[`SimulateBlocksReturnType`](https://viem.sh/docs/index.html)\<`calls`\>\>

#### Deprecated

Use `simulateBlocks` instead.

#### Inherited from

`ViemPublicClient.simulate`

***

### simulateBlocks()

> **simulateBlocks**: \<`calls`\>(`args`) => `Promise`\<[`SimulateBlocksReturnType`](https://viem.sh/docs/index.html)\<`calls`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1198

Simulates a set of calls on block(s) with optional block and state overrides.

#### Type Parameters

| Type Parameter |
| ------ |
| `calls` *extends* readonly `unknown`[] |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`SimulateBlocksParameters`](https://viem.sh/docs/index.html)\<`calls`\> |

#### Returns

`Promise`\<[`SimulateBlocksReturnType`](https://viem.sh/docs/index.html)\<`calls`\>\>

Simulated blocks. SimulateReturnType

#### Example

```ts
import { createPublicClient, http, parseEther } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

const result = await client.simulateBlocks({
  blocks: [{
    blockOverrides: {
      number: 69420n,
    },
    calls: [{
      {
        account: '0x5a0b54d5dc17e482fe8b0bdca5320161b95fb929',
        data: '0xdeadbeef',
        to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      },
      {
        account: '0x5a0b54d5dc17e482fe8b0bdca5320161b95fb929',
        to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
        value: parseEther('1'),
      },
    }],
    stateOverrides: [{
      address: '0x5a0b54d5dc17e482fe8b0bdca5320161b95fb929',
      balance: parseEther('10'),
    }],
  }]
})
```

#### Inherited from

`ViemPublicClient.simulateBlocks`

***

### simulateCalls()

> **simulateCalls**: \<`calls`\>(`args`) => `Promise`\<[`SimulateCallsReturnType`](https://viem.sh/docs/index.html)\<`calls`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1231

Simulates a set of calls.

#### Type Parameters

| Type Parameter |
| ------ |
| `calls` *extends* readonly `unknown`[] |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`SimulateCallsParameters`](https://viem.sh/docs/index.html)\<`calls`\> |

#### Returns

`Promise`\<[`SimulateCallsReturnType`](https://viem.sh/docs/index.html)\<`calls`\>\>

Results. [SimulateCallsReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http, parseEther } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

const result = await client.simulateCalls({
  account: '0x5a0b54d5dc17e482fe8b0bdca5320161b95fb929',
  calls: [{
    {
      data: '0xdeadbeef',
      to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    },
    {
      to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      value: parseEther('1'),
    },
  ]
})
```

#### Inherited from

`ViemPublicClient.simulateCalls`

***

### simulateContract()

> **simulateContract**: \<`abi`, `functionName`, `args`, `chainOverride`, `accountOverride`\>(`args`) => `Promise`\<[`SimulateContractReturnType`](https://viem.sh/docs/index.html)\<`abi`, `functionName`, `args`, [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`, `chainOverride`, `accountOverride`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1262

Simulates/validates a contract interaction. This is useful for retrieving **return data** and **revert reasons** of contract write functions.

- Docs: https://viem.sh/docs/contract/simulateContract
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/contracts_writing-to-contracts

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `abi` *extends* `Abi` \| readonly `unknown`[] | - |
| `functionName` *extends* `string` | - |
| `args` *extends* `unknown` | - |
| `chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` | - |
| `accountOverride` *extends* `` `0x${string}` `` \| [`Account`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`SimulateContractParameters`](https://viem.sh/docs/index.html)\<`abi`, `functionName`, `args`, [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `chainOverride`, `accountOverride`\> | [SimulateContractParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`SimulateContractReturnType`](https://viem.sh/docs/index.html)\<`abi`, `functionName`, `args`, [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`, `chainOverride`, `accountOverride`\>\>

The simulation result and write request. [SimulateContractReturnType](https://viem.sh/docs/index.html)

#### Remarks

This function does not require gas to execute and _**does not**_ change the state of the blockchain. It is almost identical to [`readContract`](https://viem.sh/docs/contract/readContract), but also supports contract write functions.

Internally, uses a [Public Client](https://viem.sh/docs/clients/public) to call the [`call` action](https://viem.sh/docs/actions/public/call) with [ABI-encoded `data`](https://viem.sh/docs/contract/encodeFunctionData).

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const result = await client.simulateContract({
  address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
  abi: parseAbi(['function mint(uint32) view returns (uint32)']),
  functionName: 'mint',
  args: ['69420'],
  account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
})
```

#### Inherited from

`ViemPublicClient.simulateContract`

***

### transport

> **transport**: [`TransportConfig`](https://viem.sh/docs/index.html)\<`string`, [`EIP1193RequestFn`](https://viem.sh/docs/index.html)\> & `Record`\<`string`, `any`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:93

The RPC transport

#### Inherited from

`ViemPublicClient.transport`

***

### type

> **type**: `string`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:95

The type of client.

#### Inherited from

`ViemPublicClient.type`

***

### uid

> **uid**: `string`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:97

A unique ID for the client.

#### Inherited from

`ViemPublicClient.uid`

***

### uninstallFilter()

> **uninstallFilter**: (`args`) => `Promise`\<`boolean`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1325

Destroys a Filter that was created from one of the following Actions:

- [`createBlockFilter`](https://viem.sh/docs/actions/public/createBlockFilter)
- [`createEventFilter`](https://viem.sh/docs/actions/public/createEventFilter)
- [`createPendingTransactionFilter`](https://viem.sh/docs/actions/public/createPendingTransactionFilter)

- Docs: https://viem.sh/docs/actions/public/uninstallFilter
- JSON-RPC Methods: [`eth_uninstallFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_uninstallFilter)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`UninstallFilterParameters`](https://viem.sh/docs/index.html) | [UninstallFilterParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`boolean`\>

A boolean indicating if the Filter was successfully uninstalled. [UninstallFilterReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { createPendingTransactionFilter, uninstallFilter } from 'viem/public'

const filter = await client.createPendingTransactionFilter()
const uninstalled = await client.uninstallFilter({ filter })
// true
```

#### Inherited from

`ViemPublicClient.uninstallFilter`

***

### verifyHash()

> **verifyHash**: (`args`) => `Promise`\<`boolean`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1271

Verify that a hash was signed by the provided address.

- Docs [https://viem.sh/docs/actions/public/verifyHash](https://viem.sh/docs/actions/public/verifyHash)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`VerifyHashParameters`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`boolean`\>

Whether or not the signature is valid. [VerifyHashReturnType](https://viem.sh/docs/index.html)

#### Inherited from

`ViemPublicClient.verifyHash`

***

### verifyMessage()

> **verifyMessage**: (`args`) => `Promise`\<`boolean`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1282

Verify that a message was signed by the provided address.

Compatible with Smart Contract Accounts & Externally Owned Accounts via [ERC-6492](https://eips.ethereum.org/EIPS/eip-6492).

- Docs [https://viem.sh/docs/actions/public/verifyMessage](https://viem.sh/docs/actions/public/verifyMessage)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | \{ `address`: `` `0x${string}` ``; `blockNumber?`: `bigint`; `blockTag?`: [`BlockTag`](https://viem.sh/docs/index.html); `chain?`: [`Chain`](https://viem.sh/docs/index.html) \| `null`; `erc6492VerifierAddress?`: `` `0x${string}` ``; `factory?`: `` `0x${string}` ``; `factoryData?`: `` `0x${string}` ``; `message`: [`SignableMessage`](https://viem.sh/docs/index.html); `multicallAddress?`: `` `0x${string}` ``; `signature`: `` `0x${string}` `` \| `Uint8Array` \| [`Signature`](https://viem.sh/docs/index.html); `universalSignatureVerifierAddress?`: `` `0x${string}` ``; \} | - |
| `args.address` | `` `0x${string}` `` | The address that signed the original message. |
| `args.blockNumber?` | `bigint` | The balance of the account at a block number. |
| `args.blockTag?` | [`BlockTag`](https://viem.sh/docs/index.html) | The balance of the account at a block tag. **Default** `'latest'` |
| `args.chain?` | [`Chain`](https://viem.sh/docs/index.html) \| `null` | The chain to use. |
| `args.erc6492VerifierAddress?` | `` `0x${string}` `` | The address of the ERC-6492 signature verifier contract. |
| `args.factory?` | `` `0x${string}` `` | - |
| `args.factoryData?` | `` `0x${string}` `` | - |
| `args.message` | [`SignableMessage`](https://viem.sh/docs/index.html) | The message to be verified. |
| `args.multicallAddress?` | `` `0x${string}` `` | Multicall3 address for ERC-8010 verification. |
| `args.signature` | `` `0x${string}` `` \| `Uint8Array` \| [`Signature`](https://viem.sh/docs/index.html) | The signature that was generated by signing the message with the address's private key. |
| `args.universalSignatureVerifierAddress?` | `` `0x${string}` `` | **Deprecated** use `erc6492VerifierAddress` instead. |

#### Returns

`Promise`\<`boolean`\>

Whether or not the signature is valid. [VerifyMessageReturnType](https://viem.sh/docs/index.html)

#### Inherited from

`ViemPublicClient.verifyMessage`

***

### verifySiweMessage()

> **verifySiweMessage**: (`args`) => `Promise`\<`boolean`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1293

Verifies [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361) formatted message was signed.

Compatible with Smart Contract Accounts & Externally Owned Accounts via [ERC-6492](https://eips.ethereum.org/EIPS/eip-6492).

- Docs [https://viem.sh/docs/siwe/actions/verifySiweMessage](https://viem.sh/docs/siwe/actions/verifySiweMessage)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | \{ `address?`: `` `0x${string}` ``; `blockNumber?`: `bigint`; `blockTag?`: [`BlockTag`](https://viem.sh/docs/index.html); `domain?`: `string`; `message`: `string`; `nonce?`: `string`; `scheme?`: `string`; `signature`: `` `0x${string}` ``; `time?`: `Date`; \} | - |
| `args.address?` | `` `0x${string}` `` | Ethereum address to check against. |
| `args.blockNumber?` | `bigint` | The balance of the account at a block number. |
| `args.blockTag?` | [`BlockTag`](https://viem.sh/docs/index.html) | The balance of the account at a block tag. **Default** `'latest'` |
| `args.domain?` | `string` | [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) authority to check against. |
| `args.message` | `string` | EIP-4361 formatted message. |
| `args.nonce?` | `string` | Random string to check against. |
| `args.scheme?` | `string` | [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986#section-3.1) URI scheme to check against. |
| `args.signature` | `` `0x${string}` `` | Signature to check against. |
| `args.time?` | `Date` | Current time to check optional `expirationTime` and `notBefore` fields. **Default** `new Date()` |

#### Returns

`Promise`\<`boolean`\>

Whether or not the signature is valid. [VerifySiweMessageReturnType](https://viem.sh/docs/index.html)

#### Inherited from

`ViemPublicClient.verifySiweMessage`

***

### verifyTypedData()

> **verifyTypedData**: (`args`) => `Promise`\<`boolean`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1302

Verify that typed data was signed by the provided address.

- Docs [https://viem.sh/docs/actions/public/verifyTypedData](https://viem.sh/docs/actions/public/verifyTypedData)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`VerifyTypedDataParameters`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`boolean`\>

Whether or not the signature is valid. [VerifyTypedDataReturnType](https://viem.sh/docs/index.html)

#### Inherited from

`ViemPublicClient.verifyTypedData`

***

### waitForTransactionReceipt()

> **waitForTransactionReceipt**: (`args`) => `Promise`\<[`TransactionReceipt`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1364

Waits for the [Transaction](https://viem.sh/docs/glossary/terms#transaction) to be included on a [Block](https://viem.sh/docs/glossary/terms#block) (one confirmation), and then returns the [Transaction Receipt](https://viem.sh/docs/glossary/terms#transaction-receipt). If the Transaction reverts, then the action will throw an error.

- Docs: https://viem.sh/docs/actions/public/waitForTransactionReceipt
- Example: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_sending-transactions
- JSON-RPC Methods:
  - Polls [`eth_getTransactionReceipt`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionReceipt) on each block until it has been processed.
  - If a Transaction has been replaced:
    - Calls [`eth_getBlockByNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbynumber) and extracts the transactions
    - Checks if one of the Transactions is a replacement
    - If so, calls [`eth_getTransactionReceipt`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionReceipt).

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`WaitForTransactionReceiptParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`\> | [WaitForTransactionReceiptParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`TransactionReceipt`](https://viem.sh/docs/index.html)\>

The transaction receipt. [WaitForTransactionReceiptReturnType](https://viem.sh/docs/index.html)

#### Remarks

The `waitForTransactionReceipt` action additionally supports Replacement detection (e.g. sped up Transactions).

Transactions can be replaced when a user modifies their transaction in their wallet (to speed up or cancel). Transactions are replaced when they are sent from the same nonce.

There are 3 types of Transaction Replacement reasons:

- `repriced`: The gas price has been modified (e.g. different `maxFeePerGas`)
- `cancelled`: The Transaction has been cancelled (e.g. `value === 0n`)
- `replaced`: The Transaction has been replaced (e.g. different `value` or `data`)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const transactionReceipt = await client.waitForTransactionReceipt({
  hash: '0x4ca7ee652d57678f26e887c149ab0735f41de37bcad58c9f6d3ed5824f15b74d',
})
```

#### Inherited from

`ViemPublicClient.waitForTransactionReceipt`

***

### watchBlockNumber()

> **watchBlockNumber**: (`args`) => [`WatchBlockNumberReturnType`](https://viem.sh/docs/index.html)

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1389

Watches and returns incoming block numbers.

- Docs: https://viem.sh/docs/actions/public/watchBlockNumber
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_watching-blocks
- JSON-RPC Methods:
  - When `poll: true`, calls [`eth_blockNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_blocknumber) on a polling interval.
  - When `poll: false` & WebSocket Transport, uses a WebSocket subscription via [`eth_subscribe`](https://docs.alchemy.com/reference/eth-subscribe-polygon) and the `"newHeads"` event.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`WatchBlockNumberParameters`](https://viem.sh/docs/index.html) | [WatchBlockNumberParameters](https://viem.sh/docs/index.html) |

#### Returns

[`WatchBlockNumberReturnType`](https://viem.sh/docs/index.html)

A function that can be invoked to stop watching for new block numbers. [WatchBlockNumberReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const unwatch = await client.watchBlockNumber({
  onBlockNumber: (blockNumber) => console.log(blockNumber),
})
```

#### Inherited from

`ViemPublicClient.watchBlockNumber`

***

### watchBlocks()

> **watchBlocks**: \<`includeTransactions`, `blockTag`\>(`args`) => [`WatchBlocksReturnType`](https://viem.sh/docs/index.html)

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1414

Watches and returns information for incoming blocks.

- Docs: https://viem.sh/docs/actions/public/watchBlocks
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_watching-blocks
- JSON-RPC Methods:
  - When `poll: true`, calls [`eth_getBlockByNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getBlockByNumber) on a polling interval.
  - When `poll: false` & WebSocket Transport, uses a WebSocket subscription via [`eth_subscribe`](https://docs.alchemy.com/reference/eth-subscribe-polygon) and the `"newHeads"` event.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `includeTransactions` *extends* `boolean` | `false` |
| `blockTag` *extends* [`BlockTag`](https://viem.sh/docs/index.html) | `"latest"` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`WatchBlocksParameters`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `includeTransactions`, `blockTag`\> | [WatchBlocksParameters](https://viem.sh/docs/index.html) |

#### Returns

[`WatchBlocksReturnType`](https://viem.sh/docs/index.html)

A function that can be invoked to stop watching for new block numbers. [WatchBlocksReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const unwatch = await client.watchBlocks({
  onBlock: (block) => console.log(block),
})
```

#### Inherited from

`ViemPublicClient.watchBlocks`

***

### watchContractEvent()

> **watchContractEvent**: \<`abi`, `eventName`, `strict`\>(`args`) => [`WatchContractEventReturnType`](https://viem.sh/docs/index.html)

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1444

Watches and returns emitted contract event logs.

- Docs: https://viem.sh/docs/contract/watchContractEvent

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `abi` *extends* `Abi` \| readonly `unknown`[] | - |
| `eventName` *extends* `string` | - |
| `strict` *extends* `boolean` \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`WatchContractEventParameters`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `strict`, [`Transport`](https://viem.sh/docs/index.html)\> | [WatchContractEventParameters](https://viem.sh/docs/index.html) |

#### Returns

[`WatchContractEventReturnType`](https://viem.sh/docs/index.html)

A function that can be invoked to stop watching for new event logs. [WatchContractEventReturnType](https://viem.sh/docs/index.html)

#### Remarks

This Action will batch up all the event logs found within the [`pollingInterval`](https://viem.sh/docs/contract/watchContractEvent#pollinginterval-optional), and invoke them via [`onLogs`](https://viem.sh/docs/contract/watchContractEvent#onLogs).

`watchContractEvent` will attempt to create an [Event Filter](https://viem.sh/docs/contract/createContractEventFilter) and listen to changes to the Filter per polling interval, however, if the RPC Provider does not support Filters (e.g. `eth_newFilter`), then `watchContractEvent` will fall back to using [`getLogs`](https://viem.sh/docs/actions/public/getLogs) instead.

#### Example

```ts
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const unwatch = client.watchContractEvent({
  address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
  abi: parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']),
  eventName: 'Transfer',
  args: { from: '0xc961145a54C96E3aE9bAA048c4F4D6b04C13916b' },
  onLogs: (logs) => console.log(logs),
})
```

#### Inherited from

`ViemPublicClient.watchContractEvent`

***

### watchEvent()

> **watchEvent**: \<`abiEvent`, `abiEvents`, `strict`\>(`args`) => [`WatchEventReturnType`](https://viem.sh/docs/index.html)

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1476

Watches and returns emitted [Event Logs](https://viem.sh/docs/glossary/terms#event-log).

- Docs: https://viem.sh/docs/actions/public/watchEvent
- JSON-RPC Methods:
  - **RPC Provider supports `eth_newFilter`:**
    - Calls [`eth_newFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_newfilter) to create a filter (called on initialize).
    - On a polling interval, it will call [`eth_getFilterChanges`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getfilterchanges).
  - **RPC Provider does not support `eth_newFilter`:**
    - Calls [`eth_getLogs`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getlogs) for each block between the polling interval.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `abiEvent` *extends* `AbiEvent` \| `undefined` | `undefined` |
| `abiEvents` *extends* readonly `unknown`[] \| readonly `AbiEvent`[] \| `undefined` | `abiEvent` *extends* `AbiEvent` ? \[`abiEvent`\<`abiEvent`\>\] : `undefined` |
| `strict` *extends* `boolean` \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`WatchEventParameters`](https://viem.sh/docs/index.html)\<`abiEvent`, `abiEvents`, `strict`, [`Transport`](https://viem.sh/docs/index.html)\> | [WatchEventParameters](https://viem.sh/docs/index.html) |

#### Returns

[`WatchEventReturnType`](https://viem.sh/docs/index.html)

A function that can be invoked to stop watching for new Event Logs. [WatchEventReturnType](https://viem.sh/docs/index.html)

#### Remarks

This Action will batch up all the Event Logs found within the [`pollingInterval`](https://viem.sh/docs/actions/public/watchEvent#pollinginterval-optional), and invoke them via [`onLogs`](https://viem.sh/docs/actions/public/watchEvent#onLogs).

`watchEvent` will attempt to create an [Event Filter](https://viem.sh/docs/actions/public/createEventFilter) and listen to changes to the Filter per polling interval, however, if the RPC Provider does not support Filters (e.g. `eth_newFilter`), then `watchEvent` will fall back to using [`getLogs`](https://viem.sh/docs/actions/public/getLogs) instead.

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const unwatch = client.watchEvent({
  onLogs: (logs) => console.log(logs),
})
```

#### Inherited from

`ViemPublicClient.watchEvent`

***

### watchPendingTransactions()

> **watchPendingTransactions**: (`args`) => [`WatchPendingTransactionsReturnType`](https://viem.sh/docs/index.html)

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/public.d.ts:1505

Watches and returns pending transaction hashes.

- Docs: https://viem.sh/docs/actions/public/watchPendingTransactions
- JSON-RPC Methods:
  - When `poll: true`
    - Calls [`eth_newPendingTransactionFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_newpendingtransactionfilter) to initialize the filter.
    - Calls [`eth_getFilterChanges`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getFilterChanges) on a polling interval.
  - When `poll: false` & WebSocket Transport, uses a WebSocket subscription via [`eth_subscribe`](https://docs.alchemy.com/reference/eth-subscribe-polygon) and the `"newPendingTransactions"` event.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`WatchPendingTransactionsParameters`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html)\> | [WatchPendingTransactionsParameters](https://viem.sh/docs/index.html) |

#### Returns

[`WatchPendingTransactionsReturnType`](https://viem.sh/docs/index.html)

A function that can be invoked to stop watching for new pending transaction hashes. [WatchPendingTransactionsReturnType](https://viem.sh/docs/index.html)

#### Remarks

This Action will batch up all the pending transactions found within the [`pollingInterval`](https://viem.sh/docs/actions/public/watchPendingTransactions#pollinginterval-optional), and invoke them via [`onTransactions`](https://viem.sh/docs/actions/public/watchPendingTransactions#ontransactions).

#### Example

```ts
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})
const unwatch = await client.watchPendingTransactions({
  onTransactions: (hashes) => console.log(hashes),
})
```

#### Inherited from

`ViemPublicClient.watchPendingTransactions`
