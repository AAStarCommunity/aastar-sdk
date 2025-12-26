> **createAAStarPublicClient**(`rpcUrl`, `chain`): `object`

Defined in: [packages/core/src/clients.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/clients.ts#L8)

Creates a standard AAStar public client for any given chain.

## Parameters

### rpcUrl

`string`

### chain

[`Chain`](https://viem.sh/docs/index.html) = `sepolia`

## Returns

### account

> **account**: `undefined`

The Account of the Client.

### batch?

> `optional` **batch**: `object`

Flags for batch settings.

#### batch.multicall?

> `optional` **multicall**: `boolean` \| \{ `batchSize?`: `number`; `deployless?`: `boolean`; `wait?`: `number`; \}

Toggle to enable `eth_call` multicall aggregation.

##### Type Declaration

`boolean`

\{ `batchSize?`: `number`; `deployless?`: `boolean`; `wait?`: `number`; \}

### cacheTime

> **cacheTime**: `number`

Time (in ms) that cached data will remain in memory.

### call()

> **call**: (`parameters`) => `Promise`\<[`CallReturnType`](https://viem.sh/docs/index.html)\>

Executes a new message call immediately without submitting a transaction to the network.

- Docs: https://viem.sh/docs/actions/public/call
- JSON-RPC Methods: [`eth_call`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_call)

#### Parameters

##### parameters

[`CallParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`\>

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

### ccipRead?

> `optional` **ccipRead**: `false` \| \{ `request?`: (`parameters`) => `Promise`\<`` `0x${string}` ``\>; \}

[CCIP Read](https://eips.ethereum.org/EIPS/eip-3668) configuration.

#### Type Declaration

`false`

\{ `request?`: (`parameters`) => `Promise`\<`` `0x${string}` ``\>; \}

### chain

> **chain**: [`Chain`](https://viem.sh/docs/index.html) \| `undefined`

Chain for the client.

### createAccessList()

> **createAccessList**: (`parameters`) => `Promise`\<\{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `gasUsed`: `bigint`; \}\>

Creates an EIP-2930 access list that you can include in a transaction.

- Docs: https://viem.sh/docs/actions/public/createAccessList
- JSON-RPC Methods: `eth_createAccessList`

#### Parameters

##### parameters

[`CreateAccessListParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`\>

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

### createBlockFilter()

> **createBlockFilter**: () => `Promise`\<\{ `id`: `` `0x${string}` ``; `request`: [`EIP1193RequestFn`](https://viem.sh/docs/index.html)\<readonly \[\{ `Method`: `"eth_getFilterChanges"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: `` `0x${string}` ``[] \| [`RpcLog`](https://viem.sh/docs/index.html)[]; \}, \{ `Method`: `"eth_getFilterLogs"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: [`RpcLog`](https://viem.sh/docs/index.html)[]; \}, \{ `Method`: `"eth_uninstallFilter"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: `boolean`; \}\]\>; `type`: `"block"`; \}\>

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

### createContractEventFilter()

> **createContractEventFilter**: \<`abi`, `eventName`, `args`, `strict`, `fromBlock`, `toBlock`\>(`args`) => `Promise`\<[`CreateContractEventFilterReturnType`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `args`, `strict`, `fromBlock`, `toBlock`\>\>

Creates a Filter to retrieve event logs that can be used with [`getFilterChanges`](https://viem.sh/docs/actions/public/getFilterChanges) or [`getFilterLogs`](https://viem.sh/docs/actions/public/getFilterLogs).

- Docs: https://viem.sh/docs/contract/createContractEventFilter

#### Type Parameters

##### abi

`abi` *extends* readonly `unknown`[] \| `Abi`

##### eventName

`eventName` *extends* `string` \| `undefined`

##### args

`args` *extends* readonly `unknown`[] \| `Record`\<`string`, `unknown`\> \| `undefined`

##### strict

`strict` *extends* `boolean` \| `undefined` = `undefined`

##### fromBlock

`fromBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

##### toBlock

`toBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

#### Parameters

##### args

[`CreateContractEventFilterParameters`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `args`, `strict`, `fromBlock`, `toBlock`\>

[CreateContractEventFilterParameters](https://viem.sh/docs/index.html)

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

### createEventFilter()

> **createEventFilter**: \<`abiEvent`, `abiEvents`, `strict`, `fromBlock`, `toBlock`, `_EventName`, `_Args`\>(`args?`) => `Promise`\<\{ \[K in string \| number \| symbol\]: Filter\<"event", abiEvents, \_EventName, \_Args, strict, fromBlock, toBlock\>\[K\] \}\>

Creates a [`Filter`](https://viem.sh/docs/glossary/types#filter) to listen for new events that can be used with [`getFilterChanges`](https://viem.sh/docs/actions/public/getFilterChanges).

- Docs: https://viem.sh/docs/actions/public/createEventFilter
- JSON-RPC Methods: [`eth_newFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_newfilter)

#### Type Parameters

##### abiEvent

`abiEvent` *extends* `AbiEvent` \| `undefined` = `undefined`

##### abiEvents

`abiEvents` *extends* readonly `unknown`[] \| readonly `AbiEvent`[] \| `undefined` = `abiEvent` *extends* `AbiEvent` ? \[`abiEvent`\<`abiEvent`\>\] : `undefined`

##### strict

`strict` *extends* `boolean` \| `undefined` = `undefined`

##### fromBlock

`fromBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

##### toBlock

`toBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

##### _EventName

`_EventName` *extends* `string` \| `undefined` = [`MaybeAbiEventName`](https://viem.sh/docs/index.html)\<`abiEvent`\>

##### _Args

`_Args` *extends* readonly `unknown`[] \| `Record`\<`string`, `unknown`\> \| `undefined` = `undefined`

#### Parameters

##### args?

[`CreateEventFilterParameters`](https://viem.sh/docs/index.html)\<`abiEvent`, `abiEvents`, `strict`, `fromBlock`, `toBlock`, `_EventName`, `_Args`\>

[CreateEventFilterParameters](https://viem.sh/docs/index.html)

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

### createPendingTransactionFilter()

> **createPendingTransactionFilter**: () => `Promise`\<\{ `id`: `` `0x${string}` ``; `request`: [`EIP1193RequestFn`](https://viem.sh/docs/index.html)\<readonly \[\{ `Method`: `"eth_getFilterChanges"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: `` `0x${string}` ``[] \| [`RpcLog`](https://viem.sh/docs/index.html)[]; \}, \{ `Method`: `"eth_getFilterLogs"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: [`RpcLog`](https://viem.sh/docs/index.html)[]; \}, \{ `Method`: `"eth_uninstallFilter"`; `Parameters`: \[`` `0x${string}` ``\]; `ReturnType`: `boolean`; \}\]\>; `type`: `"transaction"`; \}\>

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

### estimateContractGas()

> **estimateContractGas**: \<`chain`, `abi`, `functionName`, `args`\>(`args`) => `Promise`\<`bigint`\>

Estimates the gas required to successfully execute a contract write function call.

- Docs: https://viem.sh/docs/contract/estimateContractGas

#### Type Parameters

##### chain

`chain` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined`

##### abi

`abi` *extends* readonly `unknown`[] \| `Abi`

##### functionName

`functionName` *extends* `string`

##### args

`args` *extends* `unknown`

#### Parameters

##### args

[`EstimateContractGasParameters`](https://viem.sh/docs/index.html)\<`abi`, `functionName`, `args`, `chain`\>

[EstimateContractGasParameters](https://viem.sh/docs/index.html)

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

### estimateFeesPerGas()

> **estimateFeesPerGas**: \<`chainOverride`, `type`\>(`args?`) => `Promise`\<[`EstimateFeesPerGasReturnType`](https://viem.sh/docs/index.html)\<`type`\>\>

Returns an estimate for the fees per gas for a transaction to be included
in the next block.

- Docs: https://viem.sh/docs/actions/public/estimateFeesPerGas

#### Type Parameters

##### chainOverride

`chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

##### type

`type` *extends* [`FeeValuesType`](https://viem.sh/docs/index.html) = `"eip1559"`

#### Parameters

##### args?

[`EstimateFeesPerGasParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `chainOverride`, `type`\>

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

### estimateGas()

> **estimateGas**: (`args`) => `Promise`\<`bigint`\>

Estimates the gas necessary to complete a transaction without submitting it to the network.

- Docs: https://viem.sh/docs/actions/public/estimateGas
- JSON-RPC Methods: [`eth_estimateGas`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_estimategas)

#### Parameters

##### args

[`EstimateGasParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`\>

[EstimateGasParameters](https://viem.sh/docs/index.html)

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

### estimateMaxPriorityFeePerGas()

> **estimateMaxPriorityFeePerGas**: \<`chainOverride`\>(`args?`) => `Promise`\<`bigint`\>

Returns an estimate for the max priority fee per gas (in wei) for a transaction
to be included in the next block.

- Docs: https://viem.sh/docs/actions/public/estimateMaxPriorityFeePerGas

#### Type Parameters

##### chainOverride

`chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

#### Parameters

##### args?

###### chain

`chainOverride` \| `null`

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

### experimental\_blockTag?

> `optional` **experimental\_blockTag**: [`BlockTag`](https://viem.sh/docs/index.html)

Default block tag to use for RPC requests.

### extend()

> **extend**: \<`client`\>(`fn`) => [`Client`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `undefined`, [`PublicRpcSchema`](https://viem.sh/docs/index.html), \{ \[K in string \| number \| symbol\]: client\[K\] \} & [`PublicActions`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`\>\>

#### Type Parameters

##### client

`client` *extends* `object` & [`ExactPartial`](https://viem.sh/docs/index.html)\<[`ExtendableProtectedActions`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `undefined`\>\>

#### Parameters

##### fn

(`client`) => `client`

#### Returns

[`Client`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `undefined`, [`PublicRpcSchema`](https://viem.sh/docs/index.html), \{ \[K in string \| number \| symbol\]: client\[K\] \} & [`PublicActions`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`\>\>

### fillTransaction()

> **fillTransaction**: \<`chainOverride`, `accountOverride`\>(`args`) => `Promise`\<[`FillTransactionReturnType`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `chainOverride`\>\>

Fills a transaction request with the necessary fields to be signed over.

- Docs: https://viem.sh/docs/actions/public/fillTransaction

#### Type Parameters

##### chainOverride

`chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

##### accountOverride

`accountOverride` *extends* `` `0x${string}` `` \| [`Account`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

#### Parameters

##### args

[`FillTransactionParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`, `chainOverride`, `accountOverride`\>

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

### getBalance()

> **getBalance**: (`args`) => `Promise`\<`bigint`\>

Returns the balance of an address in wei.

- Docs: https://viem.sh/docs/actions/public/getBalance
- JSON-RPC Methods: [`eth_getBalance`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getbalance)

#### Parameters

##### args

[`GetBalanceParameters`](https://viem.sh/docs/index.html)

[GetBalanceParameters](https://viem.sh/docs/index.html)

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

### getBlobBaseFee()

> **getBlobBaseFee**: () => `Promise`\<`bigint`\>

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

### getBlock()

> **getBlock**: \<`includeTransactions`, `blockTag`\>(`args?`) => `Promise`\<\{ `baseFeePerGas`: `bigint` \| `null`; `blobGasUsed`: `bigint`; `difficulty`: `bigint`; `excessBlobGas`: `bigint`; `extraData`: `` `0x${string}` ``; `gasLimit`: `bigint`; `gasUsed`: `bigint`; `hash`: `blockTag` *extends* `"pending"` ? `null` : `` `0x${string}` ``; `logsBloom`: `blockTag` *extends* `"pending"` ? `null` : `` `0x${string}` ``; `miner`: `` `0x${string}` ``; `mixHash`: `` `0x${string}` ``; `nonce`: `blockTag` *extends* `"pending"` ? `null` : `` `0x${string}` ``; `number`: `blockTag` *extends* `"pending"` ? `null` : `bigint`; `parentBeaconBlockRoot?`: `` `0x${string}` ``; `parentHash`: `` `0x${string}` ``; `receiptsRoot`: `` `0x${string}` ``; `sealFields`: `` `0x${string}` ``[]; `sha3Uncles`: `` `0x${string}` ``; `size`: `bigint`; `stateRoot`: `` `0x${string}` ``; `timestamp`: `bigint`; `totalDifficulty`: `bigint` \| `null`; `transactions`: `includeTransactions` *extends* `true` ? (\{ `accessList?`: `undefined`; `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId?`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice`: `bigint`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"legacy"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity?`: `undefined`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice`: `bigint`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip2930"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip1559"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes`: readonly `` `0x${string}` ``[]; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas`: `bigint`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip4844"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList`: [`SignedAuthorizationList`](https://viem.sh/docs/index.html); `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip7702"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \})[] : `` `0x${string}` ``[]; `transactionsRoot`: `` `0x${string}` ``; `uncles`: `` `0x${string}` ``[]; `withdrawals?`: [`Withdrawal`](https://viem.sh/docs/index.html)[]; `withdrawalsRoot?`: `` `0x${string}` ``; \}\>

Returns information about a block at a block number, hash, or tag.

- Docs: https://viem.sh/docs/actions/public/getBlock
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_fetching-blocks
- JSON-RPC Methods:
  - Calls [`eth_getBlockByNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbynumber) for `blockNumber` & `blockTag`.
  - Calls [`eth_getBlockByHash`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbyhash) for `blockHash`.

#### Type Parameters

##### includeTransactions

`includeTransactions` *extends* `boolean` = `false`

##### blockTag

`blockTag` *extends* [`BlockTag`](https://viem.sh/docs/index.html) = `"latest"`

#### Parameters

##### args?

[`GetBlockParameters`](https://viem.sh/docs/index.html)\<`includeTransactions`, `blockTag`\>

[GetBlockParameters](https://viem.sh/docs/index.html)

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

### getBlockNumber()

> **getBlockNumber**: (`args?`) => `Promise`\<`bigint`\>

Returns the number of the most recent block seen.

- Docs: https://viem.sh/docs/actions/public/getBlockNumber
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_fetching-blocks
- JSON-RPC Methods: [`eth_blockNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_blocknumber)

#### Parameters

##### args?

[`GetBlockNumberParameters`](https://viem.sh/docs/index.html)

[GetBlockNumberParameters](https://viem.sh/docs/index.html)

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

### getBlockTransactionCount()

> **getBlockTransactionCount**: (`args?`) => `Promise`\<`number`\>

Returns the number of Transactions at a block number, hash, or tag.

- Docs: https://viem.sh/docs/actions/public/getBlockTransactionCount
- JSON-RPC Methods:
  - Calls [`eth_getBlockTransactionCountByNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblocktransactioncountbynumber) for `blockNumber` & `blockTag`.
  - Calls [`eth_getBlockTransactionCountByHash`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblocktransactioncountbyhash) for `blockHash`.

#### Parameters

##### args?

[`GetBlockTransactionCountParameters`](https://viem.sh/docs/index.html)

[GetBlockTransactionCountParameters](https://viem.sh/docs/index.html)

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

### ~~getBytecode()~~

> **getBytecode**: (`args`) => `Promise`\<[`GetCodeReturnType`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

[`GetCodeParameters`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`GetCodeReturnType`](https://viem.sh/docs/index.html)\>

#### Deprecated

Use `getCode` instead.

### getChainId()

> **getChainId**: () => `Promise`\<`number`\>

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

### getCode()

> **getCode**: (`args`) => `Promise`\<[`GetCodeReturnType`](https://viem.sh/docs/index.html)\>

Retrieves the bytecode at an address.

- Docs: https://viem.sh/docs/contract/getCode
- JSON-RPC Methods: [`eth_getCode`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getcode)

#### Parameters

##### args

[`GetCodeParameters`](https://viem.sh/docs/index.html)

GetBytecodeParameters

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

### getContractEvents()

> **getContractEvents**: \<`abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>(`args`) => `Promise`\<[`GetContractEventsReturnType`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>\>

Returns a list of event logs emitted by a contract.

- Docs: https://viem.sh/docs/actions/public/getContractEvents
- JSON-RPC Methods: [`eth_getLogs`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getlogs)

#### Type Parameters

##### abi

`abi` *extends* readonly `unknown`[] \| `Abi`

##### eventName

`eventName` *extends* `string` \| `undefined` = `undefined`

##### strict

`strict` *extends* `boolean` \| `undefined` = `undefined`

##### fromBlock

`fromBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

##### toBlock

`toBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

#### Parameters

##### args

[`GetContractEventsParameters`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>

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

### getEip712Domain()

> **getEip712Domain**: (`args`) => `Promise`\<[`GetEip712DomainReturnType`](https://viem.sh/docs/index.html)\>

Reads the EIP-712 domain from a contract, based on the ERC-5267 specification.

#### Parameters

##### args

[`GetEip712DomainParameters`](https://viem.sh/docs/index.html)

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

### getEnsAddress()

> **getEnsAddress**: (`args`) => `Promise`\<[`GetEnsAddressReturnType`](https://viem.sh/docs/index.html)\>

Gets address for ENS name.

- Docs: https://viem.sh/docs/ens/actions/getEnsAddress
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens

#### Parameters

##### args

[GetEnsAddressParameters](https://viem.sh/docs/index.html)

###### blockNumber?

`bigint`

The balance of the account at a block number.

###### blockTag?

[`BlockTag`](https://viem.sh/docs/index.html)

The balance of the account at a block tag.

**Default**

```ts
'latest'
```

###### coinType?

`bigint`

ENSIP-9 compliant coinType (chain) to get ENS address for.

To get the `coinType` for a chain id, use the `toCoinType` function:
```ts
import { toCoinType } from 'viem'
import { base } from 'viem/chains'

const coinType = toCoinType(base.id)
```

**Default**

```ts
60n
```

###### gatewayUrls?

`string`[]

Universal Resolver gateway URLs to use for resolving CCIP-read requests.

###### name

`string`

Name to get the address for.

###### strict?

`boolean`

Whether or not to throw errors propagated from the ENS Universal Resolver Contract.

###### universalResolverAddress?

`` `0x${string}` ``

Address of ENS Universal Resolver Contract.

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

### getEnsAvatar()

> **getEnsAvatar**: (`args`) => `Promise`\<[`GetEnsAvatarReturnType`](https://viem.sh/docs/index.html)\>

Gets the avatar of an ENS name.

- Docs: https://viem.sh/docs/ens/actions/getEnsAvatar
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens

#### Parameters

##### args

[GetEnsAvatarParameters](https://viem.sh/docs/index.html)

###### assetGatewayUrls?

[`AssetGatewayUrls`](https://viem.sh/docs/index.html)

Gateway urls to resolve IPFS and/or Arweave assets.

###### blockNumber?

`bigint`

The balance of the account at a block number.

###### blockTag?

[`BlockTag`](https://viem.sh/docs/index.html)

The balance of the account at a block tag.

**Default**

```ts
'latest'
```

###### gatewayUrls?

`string`[]

Universal Resolver gateway URLs to use for resolving CCIP-read requests.

###### name

`string`

ENS name to get Text for.

###### strict?

`boolean`

Whether or not to throw errors propagated from the ENS Universal Resolver Contract.

###### universalResolverAddress?

`` `0x${string}` ``

Address of ENS Universal Resolver Contract.

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

### getEnsName()

> **getEnsName**: (`args`) => `Promise`\<[`GetEnsNameReturnType`](https://viem.sh/docs/index.html)\>

Gets primary name for specified address.

- Docs: https://viem.sh/docs/ens/actions/getEnsName
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens

#### Parameters

##### args

[GetEnsNameParameters](https://viem.sh/docs/index.html)

###### address

`` `0x${string}` ``

Address to get ENS name for.

###### blockNumber?

`bigint`

The balance of the account at a block number.

###### blockTag?

[`BlockTag`](https://viem.sh/docs/index.html)

The balance of the account at a block tag.

**Default**

```ts
'latest'
```

###### coinType?

`bigint`

ENSIP-9 compliant coinType (chain) to get ENS name for.

To get the `coinType` for a chain id, use the `toCoinType` function:
```ts
import { toCoinType } from 'viem'
import { base } from 'viem/chains'

const coinType = toCoinType(base.id)
```

**Default**

```ts
60n
```

###### gatewayUrls?

`string`[]

Universal Resolver gateway URLs to use for resolving CCIP-read requests.

###### strict?

`boolean`

Whether or not to throw errors propagated from the ENS Universal Resolver Contract.

###### universalResolverAddress?

`` `0x${string}` ``

Address of ENS Universal Resolver Contract.

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

### getEnsResolver()

> **getEnsResolver**: (`args`) => `Promise`\<`` `0x${string}` ``\>

Gets resolver for ENS name.

- Docs: https://viem.sh/docs/ens/actions/getEnsResolver
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens

#### Parameters

##### args

[GetEnsResolverParameters](https://viem.sh/docs/index.html)

###### blockNumber?

`bigint`

The balance of the account at a block number.

###### blockTag?

[`BlockTag`](https://viem.sh/docs/index.html)

The balance of the account at a block tag.

**Default**

```ts
'latest'
```

###### name

`string`

Name to get the address for.

###### universalResolverAddress?

`` `0x${string}` ``

Address of ENS Universal Resolver Contract.

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

### getEnsText()

> **getEnsText**: (`args`) => `Promise`\<[`GetEnsTextReturnType`](https://viem.sh/docs/index.html)\>

Gets a text record for specified ENS name.

- Docs: https://viem.sh/docs/ens/actions/getEnsResolver
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/ens

#### Parameters

##### args

[GetEnsTextParameters](https://viem.sh/docs/index.html)

###### blockNumber?

`bigint`

The balance of the account at a block number.

###### blockTag?

[`BlockTag`](https://viem.sh/docs/index.html)

The balance of the account at a block tag.

**Default**

```ts
'latest'
```

###### gatewayUrls?

`string`[]

Universal Resolver gateway URLs to use for resolving CCIP-read requests.

###### key

`string`

Text record to retrieve.

###### name

`string`

ENS name to get Text for.

###### strict?

`boolean`

Whether or not to throw errors propagated from the ENS Universal Resolver Contract.

###### universalResolverAddress?

`` `0x${string}` ``

Address of ENS Universal Resolver Contract.

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

### getFeeHistory()

> **getFeeHistory**: (`args`) => `Promise`\<[`GetFeeHistoryReturnType`](https://viem.sh/docs/index.html)\>

Returns a collection of historical gas information.

- Docs: https://viem.sh/docs/actions/public/getFeeHistory
- JSON-RPC Methods: [`eth_feeHistory`](https://docs.alchemy.com/reference/eth-feehistory)

#### Parameters

##### args

[`GetFeeHistoryParameters`](https://viem.sh/docs/index.html)

[GetFeeHistoryParameters](https://viem.sh/docs/index.html)

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

### getFilterChanges()

> **getFilterChanges**: \<`filterType`, `abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>(`args`) => `Promise`\<[`GetFilterChangesReturnType`](https://viem.sh/docs/index.html)\<`filterType`, `abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>\>

Returns a list of logs or hashes based on a [Filter](/docs/glossary/terms#filter) since the last time it was called.

- Docs: https://viem.sh/docs/actions/public/getFilterChanges
- JSON-RPC Methods: [`eth_getFilterChanges`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getfilterchanges)

#### Type Parameters

##### filterType

`filterType` *extends* [`FilterType`](https://viem.sh/docs/index.html)

##### abi

`abi` *extends* readonly `unknown`[] \| `Abi` \| `undefined`

##### eventName

`eventName` *extends* `string` \| `undefined`

##### strict

`strict` *extends* `boolean` \| `undefined` = `undefined`

##### fromBlock

`fromBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

##### toBlock

`toBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

#### Parameters

##### args

[`GetFilterChangesParameters`](https://viem.sh/docs/index.html)\<`filterType`, `abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>

[GetFilterChangesParameters](https://viem.sh/docs/index.html)

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

### getFilterLogs()

> **getFilterLogs**: \<`abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>(`args`) => `Promise`\<[`GetFilterLogsReturnType`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>\>

Returns a list of event logs since the filter was created.

- Docs: https://viem.sh/docs/actions/public/getFilterLogs
- JSON-RPC Methods: [`eth_getFilterLogs`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getfilterlogs)

#### Type Parameters

##### abi

`abi` *extends* readonly `unknown`[] \| `Abi` \| `undefined`

##### eventName

`eventName` *extends* `string` \| `undefined`

##### strict

`strict` *extends* `boolean` \| `undefined` = `undefined`

##### fromBlock

`fromBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

##### toBlock

`toBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

#### Parameters

##### args

[`GetFilterLogsParameters`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `strict`, `fromBlock`, `toBlock`\>

[GetFilterLogsParameters](https://viem.sh/docs/index.html)

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

### getGasPrice()

> **getGasPrice**: () => `Promise`\<`bigint`\>

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

### getLogs()

> **getLogs**: \<`abiEvent`, `abiEvents`, `strict`, `fromBlock`, `toBlock`\>(`args?`) => `Promise`\<[`GetLogsReturnType`](https://viem.sh/docs/index.html)\<`abiEvent`, `abiEvents`, `strict`, `fromBlock`, `toBlock`\>\>

Returns a list of event logs matching the provided parameters.

- Docs: https://viem.sh/docs/actions/public/getLogs
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/logs_event-logs
- JSON-RPC Methods: [`eth_getLogs`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getlogs)

#### Type Parameters

##### abiEvent

`abiEvent` *extends* `AbiEvent` \| `undefined` = `undefined`

##### abiEvents

`abiEvents` *extends* readonly `unknown`[] \| readonly `AbiEvent`[] \| `undefined` = `abiEvent` *extends* `AbiEvent` ? \[`abiEvent`\<`abiEvent`\>\] : `undefined`

##### strict

`strict` *extends* `boolean` \| `undefined` = `undefined`

##### fromBlock

`fromBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

##### toBlock

`toBlock` *extends* `bigint` \| [`BlockTag`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

#### Parameters

##### args?

[`GetLogsParameters`](https://viem.sh/docs/index.html)\<`abiEvent`, `abiEvents`, `strict`, `fromBlock`, `toBlock`\>

[GetLogsParameters](https://viem.sh/docs/index.html)

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

### getProof()

> **getProof**: (`args`) => `Promise`\<[`GetProofReturnType`](https://viem.sh/docs/index.html)\>

Returns the account and storage values of the specified account including the Merkle-proof.

- Docs: https://viem.sh/docs/actions/public/getProof
- JSON-RPC Methods:
  - Calls [`eth_getProof`](https://eips.ethereum.org/EIPS/eip-1186)

#### Parameters

##### args

[`GetProofParameters`](https://viem.sh/docs/index.html)

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

### getStorageAt()

> **getStorageAt**: (`args`) => `Promise`\<[`GetStorageAtReturnType`](https://viem.sh/docs/index.html)\>

Returns the value from a storage slot at a given address.

- Docs: https://viem.sh/docs/contract/getStorageAt
- JSON-RPC Methods: [`eth_getStorageAt`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getstorageat)

#### Parameters

##### args

[`GetStorageAtParameters`](https://viem.sh/docs/index.html)

[GetStorageAtParameters](https://viem.sh/docs/index.html)

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

### getTransaction()

> **getTransaction**: \<`blockTag`\>(`args`) => `Promise`\<\{ `accessList?`: `undefined`; `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId?`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice`: `bigint`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"legacy"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity?`: `undefined`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice`: `bigint`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip2930"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip1559"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobVersionedHashes`: readonly `` `0x${string}` ``[]; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas`: `bigint`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip4844"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \} \| \{ `accessList`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList`: [`SignedAuthorizationList`](https://viem.sh/docs/index.html); `blobVersionedHashes?`: `undefined`; `blockHash`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `` `0x${string}` ``; `blockNumber`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `bigint`; `chainId`: `number`; `from`: `` `0x${string}` ``; `gas`: `bigint`; `gasPrice?`: `undefined`; `hash`: `` `0x${string}` ``; `input`: `` `0x${string}` ``; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; `nonce`: `number`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `to`: `` `0x${string}` `` \| `null`; `transactionIndex`: `blockTag` *extends* `"pending"` ? `true` : `false` *extends* `true` ? `null` : `number`; `type`: `"eip7702"`; `typeHex`: `` `0x${string}` `` \| `null`; `v`: `bigint`; `value`: `bigint`; `yParity`: `number`; \}\>

Returns information about a [Transaction](https://viem.sh/docs/glossary/terms#transaction) given a hash or block identifier.

- Docs: https://viem.sh/docs/actions/public/getTransaction
- Example: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_fetching-transactions
- JSON-RPC Methods: [`eth_getTransactionByHash`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionByHash)

#### Type Parameters

##### blockTag

`blockTag` *extends* [`BlockTag`](https://viem.sh/docs/index.html) = `"latest"`

#### Parameters

##### args

[`GetTransactionParameters`](https://viem.sh/docs/index.html)\<`blockTag`\>

[GetTransactionParameters](https://viem.sh/docs/index.html)

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

### getTransactionConfirmations()

> **getTransactionConfirmations**: (`args`) => `Promise`\<`bigint`\>

Returns the number of blocks passed (confirmations) since the transaction was processed on a block.

- Docs: https://viem.sh/docs/actions/public/getTransactionConfirmations
- Example: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_fetching-transactions
- JSON-RPC Methods: [`eth_getTransactionConfirmations`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionConfirmations)

#### Parameters

##### args

[`GetTransactionConfirmationsParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`\>

[GetTransactionConfirmationsParameters](https://viem.sh/docs/index.html)

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

### getTransactionCount()

> **getTransactionCount**: (`args`) => `Promise`\<`number`\>

Returns the number of [Transactions](https://viem.sh/docs/glossary/terms#transaction) an Account has broadcast / sent.

- Docs: https://viem.sh/docs/actions/public/getTransactionCount
- JSON-RPC Methods: [`eth_getTransactionCount`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactioncount)

#### Parameters

##### args

[`GetTransactionCountParameters`](https://viem.sh/docs/index.html)

[GetTransactionCountParameters](https://viem.sh/docs/index.html)

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

### getTransactionReceipt()

> **getTransactionReceipt**: (`args`) => `Promise`\<[`TransactionReceipt`](https://viem.sh/docs/index.html)\>

Returns the [Transaction Receipt](https://viem.sh/docs/glossary/terms#transaction-receipt) given a [Transaction](https://viem.sh/docs/glossary/terms#transaction) hash.

- Docs: https://viem.sh/docs/actions/public/getTransactionReceipt
- Example: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_fetching-transactions
- JSON-RPC Methods: [`eth_getTransactionReceipt`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getTransactionReceipt)

#### Parameters

##### args

[`GetTransactionReceiptParameters`](https://viem.sh/docs/index.html)

[GetTransactionReceiptParameters](https://viem.sh/docs/index.html)

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

### key

> **key**: `string`

A key for the client.

### multicall()

> **multicall**: \<`contracts`, `allowFailure`\>(`args`) => `Promise`\<[`MulticallReturnType`](https://viem.sh/docs/index.html)\<`contracts`, `allowFailure`\>\>

Similar to [`readContract`](https://viem.sh/docs/contract/readContract), but batches up multiple functions on a contract in a single RPC call via the [`multicall3` contract](https://github.com/mds1/multicall).

- Docs: https://viem.sh/docs/contract/multicall

#### Type Parameters

##### contracts

`contracts` *extends* readonly `unknown`[]

##### allowFailure

`allowFailure` *extends* `boolean` = `true`

#### Parameters

##### args

[`MulticallParameters`](https://viem.sh/docs/index.html)\<`contracts`, `allowFailure`\>

[MulticallParameters](https://viem.sh/docs/index.html)

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

### name

> **name**: `string`

A name for the client.

### pollingInterval

> **pollingInterval**: `number`

Frequency (in ms) for polling enabled actions & events. Defaults to 4_000 milliseconds.

### prepareTransactionRequest()

> **prepareTransactionRequest**: \<`request`, `chainOverride`, `accountOverride`\>(`args`) => `Promise`\<\{ \[K in string \| number \| symbol\]: (UnionRequiredBy\<Extract\<UnionOmit\<(...), (...)\> & ((...) extends (...) ? (...) : (...)) & ((...) extends (...) ? (...) : (...)), IsNever\<(...)\> extends true ? unknown : ExactPartial\<(...)\>\> & \{ chainId?: number \}, ParameterTypeToParameters\<request\["parameters"\] extends readonly PrepareTransactionRequestParameterType\[\] ? any\[any\]\[number\] : "type" \| "chainId" \| "gas" \| "nonce" \| "fees" \| "blobVersionedHashes"\>\> & (unknown extends request\["kzg"\] ? \{\} : Pick\<request, "kzg"\>))\[K\] \}\>

Prepares a transaction request for signing.

- Docs: https://viem.sh/docs/actions/wallet/prepareTransactionRequest

#### Type Parameters

##### request

`request` *extends* [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: `undefined`; `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `bigint`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"legacy"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `bigint`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip2930"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip1559"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: readonly `` `0x${string}` ``[] \| readonly [`ByteArray`](https://viem.sh/docs/index.html)[]; `blobVersionedHashes`: readonly `` `0x${string}` ``[]; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `bigint`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: readonly [`BlobSidecar`](https://viem.sh/docs/index.html)\<`` `0x${string}` ``\>[]; `to`: `` `0x${string}` `` \| `null`; `type?`: `"eip4844"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs`: readonly `` `0x${string}` ``[] \| readonly [`ByteArray`](https://viem.sh/docs/index.html)[]; `blobVersionedHashes?`: readonly `` `0x${string}` ``[]; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: [`Kzg`](https://viem.sh/docs/index.html); `maxFeePerBlobGas?`: `bigint`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: readonly [`BlobSidecar`](https://viem.sh/docs/index.html)\<`` `0x${string}` ``\>[]; `to`: `` `0x${string}` `` \| `null`; `type?`: `"eip4844"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: [`AuthorizationList`](https://viem.sh/docs/index.html)\<`number`, `boolean`\>; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip7702"`; `value?`: `bigint`; \}, `"from"`\> & `object` & `object`

##### chainOverride

`chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

##### accountOverride

`accountOverride` *extends* `` `0x${string}` `` \| [`Account`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

#### Parameters

##### args

[`PrepareTransactionRequestParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`, `chainOverride`, `accountOverride`, `request`\>

[PrepareTransactionRequestParameters](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<\{ \[K in string \| number \| symbol\]: (UnionRequiredBy\<Extract\<UnionOmit\<(...), (...)\> & ((...) extends (...) ? (...) : (...)) & ((...) extends (...) ? (...) : (...)), IsNever\<(...)\> extends true ? unknown : ExactPartial\<(...)\>\> & \{ chainId?: number \}, ParameterTypeToParameters\<request\["parameters"\] extends readonly PrepareTransactionRequestParameterType\[\] ? any\[any\]\[number\] : "type" \| "chainId" \| "gas" \| "nonce" \| "fees" \| "blobVersionedHashes"\>\> & (unknown extends request\["kzg"\] ? \{\} : Pick\<request, "kzg"\>))\[K\] \}\>

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

### readContract()

> **readContract**: \<`abi`, `functionName`, `args`\>(`args`) => `Promise`\<[`ReadContractReturnType`](https://viem.sh/docs/index.html)\<`abi`, `functionName`, `args`\>\>

Calls a read-only function on a contract, and returns the response.

- Docs: https://viem.sh/docs/contract/readContract
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/contracts_reading-contracts

#### Type Parameters

##### abi

`abi` *extends* readonly `unknown`[] \| `Abi`

##### functionName

`functionName` *extends* `string`

##### args

`args` *extends* `unknown`

#### Parameters

##### args

[`ReadContractParameters`](https://viem.sh/docs/index.html)\<`abi`, `functionName`, `args`\>

[ReadContractParameters](https://viem.sh/docs/index.html)

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

### request

> **request**: [`EIP1193RequestFn`](https://viem.sh/docs/index.html)\<[`PublicRpcSchema`](https://viem.sh/docs/index.html)\>

Request function wrapped with friendly error handling

### sendRawTransaction()

> **sendRawTransaction**: (`args`) => `Promise`\<`` `0x${string}` ``\>

Sends a **signed** transaction to the network

- Docs: https://viem.sh/docs/actions/wallet/sendRawTransaction
- JSON-RPC Method: [`eth_sendRawTransaction`](https://ethereum.github.io/execution-apis/api-documentation/)

#### Parameters

##### args

[`SendRawTransactionParameters`](https://viem.sh/docs/index.html)

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

### sendRawTransactionSync()

> **sendRawTransactionSync**: (`args`) => `Promise`\<[`TransactionReceipt`](https://viem.sh/docs/index.html)\>

Sends a **signed** transaction to the network

- Docs: https://viem.sh/docs/actions/wallet/sendRawTransactionSync
- JSON-RPC Method: [`eth_sendRawTransactionSync`](https://eips.ethereum.org/EIPS/eip-7966)

#### Parameters

##### args

[`SendRawTransactionSyncParameters`](https://viem.sh/docs/index.html)

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

### ~~simulate()~~

> **simulate**: \<`calls`\>(`args`) => `Promise`\<[`SimulateBlocksReturnType`](https://viem.sh/docs/index.html)\<`calls`\>\>

#### Type Parameters

##### calls

`calls` *extends* readonly `unknown`[]

#### Parameters

##### args

[`SimulateBlocksParameters`](https://viem.sh/docs/index.html)\<`calls`\>

#### Returns

`Promise`\<[`SimulateBlocksReturnType`](https://viem.sh/docs/index.html)\<`calls`\>\>

#### Deprecated

Use `simulateBlocks` instead.

### simulateBlocks()

> **simulateBlocks**: \<`calls`\>(`args`) => `Promise`\<[`SimulateBlocksReturnType`](https://viem.sh/docs/index.html)\<`calls`\>\>

Simulates a set of calls on block(s) with optional block and state overrides.

#### Type Parameters

##### calls

`calls` *extends* readonly `unknown`[]

#### Parameters

##### args

[`SimulateBlocksParameters`](https://viem.sh/docs/index.html)\<`calls`\>

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

### simulateCalls()

> **simulateCalls**: \<`calls`\>(`args`) => `Promise`\<[`SimulateCallsReturnType`](https://viem.sh/docs/index.html)\<`calls`\>\>

Simulates a set of calls.

#### Type Parameters

##### calls

`calls` *extends* readonly `unknown`[]

#### Parameters

##### args

[`SimulateCallsParameters`](https://viem.sh/docs/index.html)\<`calls`\>

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

### simulateContract()

> **simulateContract**: \<`abi`, `functionName`, `args`, `chainOverride`, `accountOverride`\>(`args`) => `Promise`\<[`SimulateContractReturnType`](https://viem.sh/docs/index.html)\<`abi`, `functionName`, `args`, [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`, `chainOverride`, `accountOverride`\>\>

Simulates/validates a contract interaction. This is useful for retrieving **return data** and **revert reasons** of contract write functions.

- Docs: https://viem.sh/docs/contract/simulateContract
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/contracts_writing-to-contracts

#### Type Parameters

##### abi

`abi` *extends* readonly `unknown`[] \| `Abi`

##### functionName

`functionName` *extends* `string`

##### args

`args` *extends* `unknown`

##### chainOverride

`chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined`

##### accountOverride

`accountOverride` *extends* `` `0x${string}` `` \| [`Account`](https://viem.sh/docs/index.html) \| `undefined` = `undefined`

#### Parameters

##### args

[`SimulateContractParameters`](https://viem.sh/docs/index.html)\<`abi`, `functionName`, `args`, [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `chainOverride`, `accountOverride`\>

[SimulateContractParameters](https://viem.sh/docs/index.html)

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

### transport

> **transport**: [`TransportConfig`](https://viem.sh/docs/index.html)\<`string`, [`EIP1193RequestFn`](https://viem.sh/docs/index.html)\> & `Record`\<`string`, `any`\>

The RPC transport

### type

> **type**: `string`

The type of client.

### uid

> **uid**: `string`

A unique ID for the client.

### uninstallFilter()

> **uninstallFilter**: (`args`) => `Promise`\<`boolean`\>

Destroys a Filter that was created from one of the following Actions:

- [`createBlockFilter`](https://viem.sh/docs/actions/public/createBlockFilter)
- [`createEventFilter`](https://viem.sh/docs/actions/public/createEventFilter)
- [`createPendingTransactionFilter`](https://viem.sh/docs/actions/public/createPendingTransactionFilter)

- Docs: https://viem.sh/docs/actions/public/uninstallFilter
- JSON-RPC Methods: [`eth_uninstallFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_uninstallFilter)

#### Parameters

##### args

[`UninstallFilterParameters`](https://viem.sh/docs/index.html)

[UninstallFilterParameters](https://viem.sh/docs/index.html)

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

### verifyHash()

> **verifyHash**: (`args`) => `Promise`\<`boolean`\>

Verify that a hash was signed by the provided address.

- Docs [https://viem.sh/docs/actions/public/verifyHash](https://viem.sh/docs/actions/public/verifyHash)

#### Parameters

##### args

[`VerifyHashParameters`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`boolean`\>

Whether or not the signature is valid. [VerifyHashReturnType](https://viem.sh/docs/index.html)

### verifyMessage()

> **verifyMessage**: (`args`) => `Promise`\<`boolean`\>

Verify that a message was signed by the provided address.

Compatible with Smart Contract Accounts & Externally Owned Accounts via [ERC-6492](https://eips.ethereum.org/EIPS/eip-6492).

- Docs [https://viem.sh/docs/actions/public/verifyMessage](https://viem.sh/docs/actions/public/verifyMessage)

#### Parameters

##### args

###### address

`` `0x${string}` ``

The address that signed the original message.

###### blockNumber?

`bigint`

The balance of the account at a block number.

###### blockTag?

[`BlockTag`](https://viem.sh/docs/index.html)

The balance of the account at a block tag.

**Default**

```ts
'latest'
```

###### chain?

[`Chain`](https://viem.sh/docs/index.html) \| `null`

The chain to use.

###### erc6492VerifierAddress?

`` `0x${string}` ``

The address of the ERC-6492 signature verifier contract.

###### factory?

`` `0x${string}` ``

###### factoryData?

`` `0x${string}` ``

###### message

[`SignableMessage`](https://viem.sh/docs/index.html)

The message to be verified.

###### multicallAddress?

`` `0x${string}` ``

Multicall3 address for ERC-8010 verification.

###### signature

`` `0x${string}` `` \| [`Signature`](https://viem.sh/docs/index.html) \| [`ByteArray`](https://viem.sh/docs/index.html)

The signature that was generated by signing the message with the address's private key.

###### universalSignatureVerifierAddress?

`` `0x${string}` ``

**Deprecated**

use `erc6492VerifierAddress` instead.

#### Returns

`Promise`\<`boolean`\>

Whether or not the signature is valid. [VerifyMessageReturnType](https://viem.sh/docs/index.html)

### verifySiweMessage()

> **verifySiweMessage**: (`args`) => `Promise`\<`boolean`\>

Verifies [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361) formatted message was signed.

Compatible with Smart Contract Accounts & Externally Owned Accounts via [ERC-6492](https://eips.ethereum.org/EIPS/eip-6492).

- Docs [https://viem.sh/docs/siwe/actions/verifySiweMessage](https://viem.sh/docs/siwe/actions/verifySiweMessage)

#### Parameters

##### args

###### address?

`` `0x${string}` ``

Ethereum address to check against.

###### blockNumber?

`bigint`

The balance of the account at a block number.

###### blockTag?

[`BlockTag`](https://viem.sh/docs/index.html)

The balance of the account at a block tag.

**Default**

```ts
'latest'
```

###### domain?

`string`

[RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) authority to check against.

###### message

`string`

EIP-4361 formatted message.

###### nonce?

`string`

Random string to check against.

###### scheme?

`string`

[RFC 3986](https://www.rfc-editor.org/rfc/rfc3986#section-3.1) URI scheme to check against.

###### signature

`` `0x${string}` ``

Signature to check against.

###### time?

`Date`

Current time to check optional `expirationTime` and `notBefore` fields.

**Default**

```ts
new Date()
```

#### Returns

`Promise`\<`boolean`\>

Whether or not the signature is valid. [VerifySiweMessageReturnType](https://viem.sh/docs/index.html)

### verifyTypedData()

> **verifyTypedData**: (`args`) => `Promise`\<`boolean`\>

Verify that typed data was signed by the provided address.

- Docs [https://viem.sh/docs/actions/public/verifyTypedData](https://viem.sh/docs/actions/public/verifyTypedData)

#### Parameters

##### args

[`VerifyTypedDataParameters`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`boolean`\>

Whether or not the signature is valid. [VerifyTypedDataReturnType](https://viem.sh/docs/index.html)

### waitForTransactionReceipt()

> **waitForTransactionReceipt**: (`args`) => `Promise`\<[`TransactionReceipt`](https://viem.sh/docs/index.html)\>

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

##### args

[`WaitForTransactionReceiptParameters`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html) \| `undefined`\>

[WaitForTransactionReceiptParameters](https://viem.sh/docs/index.html)

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

### watchBlockNumber()

> **watchBlockNumber**: (`args`) => [`WatchBlockNumberReturnType`](https://viem.sh/docs/index.html)

Watches and returns incoming block numbers.

- Docs: https://viem.sh/docs/actions/public/watchBlockNumber
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_watching-blocks
- JSON-RPC Methods:
  - When `poll: true`, calls [`eth_blockNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_blocknumber) on a polling interval.
  - When `poll: false` & WebSocket Transport, uses a WebSocket subscription via [`eth_subscribe`](https://docs.alchemy.com/reference/eth-subscribe-polygon) and the `"newHeads"` event.

#### Parameters

##### args

[`WatchBlockNumberParameters`](https://viem.sh/docs/index.html)

[WatchBlockNumberParameters](https://viem.sh/docs/index.html)

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

### watchBlocks()

> **watchBlocks**: \<`includeTransactions`, `blockTag`\>(`args`) => [`WatchBlocksReturnType`](https://viem.sh/docs/index.html)

Watches and returns information for incoming blocks.

- Docs: https://viem.sh/docs/actions/public/watchBlocks
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks_watching-blocks
- JSON-RPC Methods:
  - When `poll: true`, calls [`eth_getBlockByNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getBlockByNumber) on a polling interval.
  - When `poll: false` & WebSocket Transport, uses a WebSocket subscription via [`eth_subscribe`](https://docs.alchemy.com/reference/eth-subscribe-polygon) and the `"newHeads"` event.

#### Type Parameters

##### includeTransactions

`includeTransactions` *extends* `boolean` = `false`

##### blockTag

`blockTag` *extends* [`BlockTag`](https://viem.sh/docs/index.html) = `"latest"`

#### Parameters

##### args

[`WatchBlocksParameters`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, `includeTransactions`, `blockTag`\>

[WatchBlocksParameters](https://viem.sh/docs/index.html)

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

### watchContractEvent()

> **watchContractEvent**: \<`abi`, `eventName`, `strict`\>(`args`) => [`WatchContractEventReturnType`](https://viem.sh/docs/index.html)

Watches and returns emitted contract event logs.

- Docs: https://viem.sh/docs/contract/watchContractEvent

#### Type Parameters

##### abi

`abi` *extends* readonly `unknown`[] \| `Abi`

##### eventName

`eventName` *extends* `string`

##### strict

`strict` *extends* `boolean` \| `undefined` = `undefined`

#### Parameters

##### args

[`WatchContractEventParameters`](https://viem.sh/docs/index.html)\<`abi`, `eventName`, `strict`, [`Transport`](https://viem.sh/docs/index.html)\>

[WatchContractEventParameters](https://viem.sh/docs/index.html)

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

### watchEvent()

> **watchEvent**: \<`abiEvent`, `abiEvents`, `strict`\>(`args`) => [`WatchEventReturnType`](https://viem.sh/docs/index.html)

Watches and returns emitted [Event Logs](https://viem.sh/docs/glossary/terms#event-log).

- Docs: https://viem.sh/docs/actions/public/watchEvent
- JSON-RPC Methods:
  - **RPC Provider supports `eth_newFilter`:**
    - Calls [`eth_newFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_newfilter) to create a filter (called on initialize).
    - On a polling interval, it will call [`eth_getFilterChanges`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getfilterchanges).
  - **RPC Provider does not support `eth_newFilter`:**
    - Calls [`eth_getLogs`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getlogs) for each block between the polling interval.

#### Type Parameters

##### abiEvent

`abiEvent` *extends* `AbiEvent` \| `undefined` = `undefined`

##### abiEvents

`abiEvents` *extends* readonly `unknown`[] \| readonly `AbiEvent`[] \| `undefined` = `abiEvent` *extends* `AbiEvent` ? \[`abiEvent`\<`abiEvent`\>\] : `undefined`

##### strict

`strict` *extends* `boolean` \| `undefined` = `undefined`

#### Parameters

##### args

[`WatchEventParameters`](https://viem.sh/docs/index.html)\<`abiEvent`, `abiEvents`, `strict`, [`Transport`](https://viem.sh/docs/index.html)\>

[WatchEventParameters](https://viem.sh/docs/index.html)

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

### watchPendingTransactions()

> **watchPendingTransactions**: (`args`) => [`WatchPendingTransactionsReturnType`](https://viem.sh/docs/index.html)

Watches and returns pending transaction hashes.

- Docs: https://viem.sh/docs/actions/public/watchPendingTransactions
- JSON-RPC Methods:
  - When `poll: true`
    - Calls [`eth_newPendingTransactionFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_newpendingtransactionfilter) to initialize the filter.
    - Calls [`eth_getFilterChanges`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getFilterChanges) on a polling interval.
  - When `poll: false` & WebSocket Transport, uses a WebSocket subscription via [`eth_subscribe`](https://docs.alchemy.com/reference/eth-subscribe-polygon) and the `"newPendingTransactions"` event.

#### Parameters

##### args

[`WatchPendingTransactionsParameters`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html)\>

[WatchPendingTransactionsParameters](https://viem.sh/docs/index.html)

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
