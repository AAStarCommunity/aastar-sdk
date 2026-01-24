Defined in: [packages/core/src/clients/doc-types.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/clients/doc-types.ts#L13)

Wallet Client Interface
Standardized interface for interacting with Ethereum wallets and accounts.

## Extends

- [`WalletClient`](https://viem.sh/docs/index.html)\<`TTransport`, `TChain`, `TAccount`\>

## Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TTransport` *extends* [`Transport`](https://viem.sh/docs/index.html) | [`Transport`](https://viem.sh/docs/index.html) |
| `TChain` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` | [`Chain`](https://viem.sh/docs/index.html) \| `undefined` |
| `TAccount` *extends* [`Account`](https://viem.sh/docs/index.html) \| `undefined` | [`Account`](https://viem.sh/docs/index.html) \| `undefined` |

## Properties

### account

> **account**: `TAccount`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:73

The Account of the Client.

#### Inherited from

`ViemWalletClient.account`

***

### addChain()

> **addChain**: (`args`) => `Promise`\<`void`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:53

Adds an EVM chain to the wallet.

- Docs: https://viem.sh/docs/actions/wallet/addChain
- JSON-RPC Methods: [`eth_addEthereumChain`](https://eips.ethereum.org/EIPS/eip-3085)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`AddChainParameters`](https://viem.sh/docs/index.html) | [AddChainParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`void`\>

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { optimism } from 'viem/chains'

const client = createWalletClient({
  transport: custom(window.ethereum),
})
await client.addChain({ chain: optimism })
```

#### Inherited from

`ViemWalletClient.addChain`

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

`ViemWalletClient.batch`

***

### cacheTime

> **cacheTime**: `number`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:77

Time (in ms) that cached data will remain in memory.

#### Inherited from

`ViemWalletClient.cacheTime`

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

`ViemWalletClient.ccipRead`

***

### chain

> **chain**: `TChain`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:81

Chain for the client.

#### Inherited from

`ViemWalletClient.chain`

***

### deployContract()

> **deployContract**: \<`abi`, `chainOverride`\>(`args`) => `Promise`\<`` `0x${string}` ``\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:79

Deploys a contract to the network, given bytecode and constructor arguments.

- Docs: https://viem.sh/docs/contract/deployContract
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/contracts_deploying-contracts

#### Type Parameters

| Type Parameter |
| ------ |
| `abi` *extends* `Abi` \| readonly `unknown`[] |
| `chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`DeployContractParameters`](https://viem.sh/docs/index.html)\<`abi`, `TChain`, `TAccount`, `chainOverride`\> | [DeployContractParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

The [Transaction](https://viem.sh/docs/glossary/terms#transaction) hash. [DeployContractReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  account: privateKeyToAccount('0x…'),
  chain: mainnet,
  transport: http(),
})
const hash = await client.deployContract({
  abi: [],
  account: '0x…,
  bytecode: '0x608060405260405161083e38038061083e833981016040819052610...',
})
```

#### Inherited from

`ViemWalletClient.deployContract`

***

### experimental\_blockTag?

> `optional` **experimental\_blockTag**: [`BlockTag`](https://viem.sh/docs/index.html)

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:83

Default block tag to use for RPC requests.

#### Inherited from

`ViemWalletClient.experimental_blockTag`

***

### extend()

> **extend**: \<`client`\>(`fn`) => [`Client`](https://viem.sh/docs/index.html)\<`TTransport`, `TChain`, `TAccount`, [`WalletRpcSchema`](https://viem.sh/docs/index.html), \{ \[K in string \| number \| symbol\]: client\[K\] \} & [`WalletActions`](https://viem.sh/docs/index.html)\<`TChain`, `TAccount`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:69

#### Type Parameters

| Type Parameter |
| ------ |
| `client` *extends* `object` & [`ExactPartial`](https://viem.sh/docs/index.html)\<[`ExtendableProtectedActions`](https://viem.sh/docs/index.html)\<`TTransport`, `TChain`, `TAccount`\>\> |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `fn` | (`client`) => `client` |

#### Returns

[`Client`](https://viem.sh/docs/index.html)\<`TTransport`, `TChain`, `TAccount`, [`WalletRpcSchema`](https://viem.sh/docs/index.html), \{ \[K in string \| number \| symbol\]: client\[K\] \} & [`WalletActions`](https://viem.sh/docs/index.html)\<`TChain`, `TAccount`\>\>

#### Inherited from

`ViemWalletClient.extend`

***

### fillTransaction()

> **fillTransaction**: \<`chainOverride`, `accountOverride`\>(`args`) => `Promise`\<[`FillTransactionReturnType`](https://viem.sh/docs/index.html)\<`TChain`, `chainOverride`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:103

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
| `args` | [`FillTransactionParameters`](https://viem.sh/docs/index.html)\<`TChain`, `TAccount`, `chainOverride`, `accountOverride`\> |

#### Returns

`Promise`\<[`FillTransactionReturnType`](https://viem.sh/docs/index.html)\<`TChain`, `chainOverride`\>\>

The filled transaction. [FillTransactionReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const result = await client.fillTransaction({
  account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
  to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  value: parseEther('1'),
})
```

#### Inherited from

`ViemWalletClient.fillTransaction`

***

### getAddresses()

> **getAddresses**: () => `Promise`\<[`GetAddressesReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:122

Returns a list of account addresses owned by the wallet or client.

- Docs: https://viem.sh/docs/actions/wallet/getAddresses
- JSON-RPC Methods: [`eth_accounts`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_accounts)

#### Returns

`Promise`\<[`GetAddressesReturnType`](https://viem.sh/docs/index.html)\>

List of account addresses owned by the wallet or client. [GetAddressesReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const accounts = await client.getAddresses()
```

#### Inherited from

`ViemWalletClient.getAddresses`

***

### getCallsStatus()

> **getCallsStatus**: (`parameters`) => `Promise`\<\{ `atomic`: `boolean`; `capabilities?`: \{\[`key`: `string`\]: `any`; \} \| \{\[`key`: `string`\]: `any`; \}; `chainId`: `number`; `id`: `string`; `receipts?`: [`WalletCallReceipt`](https://viem.sh/docs/index.html)\<`bigint`, `"success"` \| `"reverted"`\>[]; `status`: `"pending"` \| `"success"` \| `"failure"` \| `undefined`; `statusCode`: `number`; `version`: `string`; \}\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:143

Returns the status of a call batch that was sent via `sendCalls`.

- Docs: https://viem.sh/docs/actions/wallet/getCallsStatus
- JSON-RPC Methods: [`wallet_getCallsStatus`](https://eips.ethereum.org/EIPS/eip-5792)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `parameters` | [`GetCallsStatusParameters`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<\{ `atomic`: `boolean`; `capabilities?`: \{\[`key`: `string`\]: `any`; \} \| \{\[`key`: `string`\]: `any`; \}; `chainId`: `number`; `id`: `string`; `receipts?`: [`WalletCallReceipt`](https://viem.sh/docs/index.html)\<`bigint`, `"success"` \| `"reverted"`\>[]; `status`: `"pending"` \| `"success"` \| `"failure"` \| `undefined`; `statusCode`: `number`; `version`: `string`; \}\>

Status of the calls. [GetCallsStatusReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})

const { receipts, status } = await client.getCallsStatus({ id: '0xdeadbeef' })
```

#### Inherited from

`ViemWalletClient.getCallsStatus`

***

### getCapabilities()

> **getCapabilities**: \<`chainId`\>(`parameters?`) => `Promise`\<\{ \[K in string \| number \| symbol\]: (chainId extends number ? \{ atomic?: \{ status: "supported" \| "ready" \| "unsupported" \}; paymasterService?: \{ supported: boolean \}; unstable\_addSubAccount?: \{ keyTypes: ("address" \| "p256" \| "webcrypto-p256" \| "webauthn-p256")\[\]; supported: boolean \}; \[key: string\]: any \} : ChainIdToCapabilities\<Capabilities\<\{ atomic?: \{ status: (...) \| (...) \| (...) \}; paymasterService?: \{ supported: boolean \}; unstable\_addSubAccount?: \{ keyTypes: (...)\[\]; supported: boolean \}; \[key: string\]: any \}\>, number\>)\[K\] \}\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:166

Extract capabilities that a connected wallet supports (e.g. paymasters, session keys, etc).

- Docs: https://viem.sh/docs/actions/wallet/getCapabilities
- JSON-RPC Methods: [`wallet_getCapabilities`](https://eips.ethereum.org/EIPS/eip-5792)

#### Type Parameters

| Type Parameter |
| ------ |
| `chainId` *extends* `number` \| `undefined` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `parameters?` | [`GetCapabilitiesParameters`](https://viem.sh/docs/index.html)\<`chainId`\> |

#### Returns

`Promise`\<\{ \[K in string \| number \| symbol\]: (chainId extends number ? \{ atomic?: \{ status: "supported" \| "ready" \| "unsupported" \}; paymasterService?: \{ supported: boolean \}; unstable\_addSubAccount?: \{ keyTypes: ("address" \| "p256" \| "webcrypto-p256" \| "webauthn-p256")\[\]; supported: boolean \}; \[key: string\]: any \} : ChainIdToCapabilities\<Capabilities\<\{ atomic?: \{ status: (...) \| (...) \| (...) \}; paymasterService?: \{ supported: boolean \}; unstable\_addSubAccount?: \{ keyTypes: (...)\[\]; supported: boolean \}; \[key: string\]: any \}\>, number\>)\[K\] \}\>

The wallet's capabilities. [GetCapabilitiesReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})

const capabilities = await client.getCapabilities({
  account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
})
```

#### Inherited from

`ViemWalletClient.getCapabilities`

***

### getChainId()

> **getChainId**: () => `Promise`\<`number`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:186

Returns the chain ID associated with the current network.

- Docs: https://viem.sh/docs/actions/public/getChainId
- JSON-RPC Methods: [`eth_chainId`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_chainid)

#### Returns

`Promise`\<`number`\>

The current chain ID. [GetChainIdReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const chainId = await client.getChainId()
// 1
```

#### Inherited from

`ViemWalletClient.getChainId`

***

### getPermissions()

> **getPermissions**: () => `Promise`\<[`GetPermissionsReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:205

Gets the wallets current permissions.

- Docs: https://viem.sh/docs/actions/wallet/getPermissions
- JSON-RPC Methods: [`wallet_getPermissions`](https://eips.ethereum.org/EIPS/eip-2255)

#### Returns

`Promise`\<[`GetPermissionsReturnType`](https://viem.sh/docs/index.html)\>

The wallet permissions. [GetPermissionsReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const permissions = await client.getPermissions()
```

#### Inherited from

`ViemWalletClient.getPermissions`

***

### key

> **key**: `string`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:85

A key for the client.

#### Inherited from

`ViemWalletClient.key`

***

### name

> **name**: `string`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:87

A name for the client.

#### Inherited from

`ViemWalletClient.name`

***

### pollingInterval

> **pollingInterval**: `number`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:89

Frequency (in ms) for polling enabled actions & events. Defaults to 4_000 milliseconds.

#### Inherited from

`ViemWalletClient.pollingInterval`

***

### prepareAuthorization()

> **prepareAuthorization**: (`parameters`) => `Promise`\<[`PrepareAuthorizationReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:247

Prepares an [EIP-7702 Authorization](https://eips.ethereum.org/EIPS/eip-7702) object for signing.
This Action will fill the required fields of the Authorization object if they are not provided (e.g. `nonce` and `chainId`).

With the prepared Authorization object, you can use [`signAuthorization`](https://viem.sh/docs/eip7702/signAuthorization) to sign over the Authorization object.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `parameters` | [`PrepareAuthorizationParameters`](https://viem.sh/docs/index.html)\<`TAccount`\> | [PrepareAuthorizationParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`PrepareAuthorizationReturnType`](https://viem.sh/docs/index.html)\>

The prepared Authorization object. [PrepareAuthorizationReturnType](https://viem.sh/docs/index.html)

#### Examples

```ts
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: http(),
})

const authorization = await client.prepareAuthorization({
  account: privateKeyToAccount('0x..'),
  contractAddress: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
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
  transport: http(),
})

const authorization = await client.prepareAuthorization({
  contractAddress: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
})
```

#### Inherited from

`ViemWalletClient.prepareAuthorization`

***

### prepareTransactionRequest()

> **prepareTransactionRequest**: \<`request`, `chainOverride`, `accountOverride`\>(`args`) => `Promise`\<\{ \[K in string \| number \| symbol\]: (UnionRequiredBy\<Extract\<UnionOmit\<ExtractChainFormatterParameters\<(...), (...), (...)\>, "from"\> & (DeriveChain\<(...), (...)\> extends Chain ? \{ chain: ... \} : \{ chain?: ... \}) & (DeriveAccount\<(...), (...)\> extends Account ? \{ account: ...; from: ... \} : \{ account?: ...; from?: ... \}), IsNever\<(...) \| (...) \| (...) \| (...) \| (...)\> extends true ? unknown : ExactPartial\<(...) \| (...) \| (...) \| (...) \| (...)\>\> & \{ chainId?: number \}, ParameterTypeToParameters\<request\["parameters"\] extends readonly PrepareTransactionRequestParameterType\[\] ? any\[any\]\[number\] : "type" \| "gas" \| "nonce" \| "blobVersionedHashes" \| "fees" \| "chainId"\>\> & (unknown extends request\["kzg"\] ? \{\} : Pick\<request, "kzg"\>))\[K\] \}\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:286

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
| `args` | [`PrepareTransactionRequestParameters`](https://viem.sh/docs/index.html)\<`TChain`, `TAccount`, `chainOverride`, `accountOverride`, `request`\> | [PrepareTransactionRequestParameters](https://viem.sh/docs/index.html) |

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

`ViemWalletClient.prepareTransactionRequest`

***

### request

> **request**: [`EIP1193RequestFn`](https://viem.sh/docs/index.html)\<[`WalletRpcSchema`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:91

Request function wrapped with friendly error handling

#### Inherited from

`ViemWalletClient.request`

***

### requestAddresses()

> **requestAddresses**: () => `Promise`\<[`RequestAddressesReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:309

Requests a list of accounts managed by a wallet.

- Docs: https://viem.sh/docs/actions/wallet/requestAddresses
- JSON-RPC Methods: [`eth_requestAccounts`](https://eips.ethereum.org/EIPS/eip-1102)

Sends a request to the wallet, asking for permission to access the user's accounts. After the user accepts the request, it will return a list of accounts (addresses).

This API can be useful for dapps that need to access the user's accounts in order to execute transactions or interact with smart contracts.

#### Returns

`Promise`\<[`RequestAddressesReturnType`](https://viem.sh/docs/index.html)\>

List of accounts managed by a wallet [RequestAddressesReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const accounts = await client.requestAddresses()
```

#### Inherited from

`ViemWalletClient.requestAddresses`

***

### requestPermissions()

> **requestPermissions**: (`args`) => `Promise`\<[`RequestPermissionsReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:331

Requests permissions for a wallet.

- Docs: https://viem.sh/docs/actions/wallet/requestPermissions
- JSON-RPC Methods: [`wallet_requestPermissions`](https://eips.ethereum.org/EIPS/eip-2255)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | \{\[`key`: `string`\]: `Record`\<`string`, `any`\>; `eth_accounts`: `Record`\<`string`, `any`\>; \} | [RequestPermissionsParameters](https://viem.sh/docs/index.html) |
| `args.eth_accounts` | `Record`\<`string`, `any`\> | - |

#### Returns

`Promise`\<[`RequestPermissionsReturnType`](https://viem.sh/docs/index.html)\>

The wallet permissions. [RequestPermissionsReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const permissions = await client.requestPermissions({
  eth_accounts: {}
})
```

#### Inherited from

`ViemWalletClient.requestPermissions`

***

### sendCalls()

> **sendCalls**: \<`calls`, `chainOverride`\>(`parameters`) => `Promise`\<\{ `capabilities?`: \{\[`key`: `string`\]: `any`; \}; `id`: `string`; \}\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:364

Requests the connected wallet to send a batch of calls.

- Docs: https://viem.sh/docs/actions/wallet/sendCalls
- JSON-RPC Methods: [`wallet_sendCalls`](https://eips.ethereum.org/EIPS/eip-5792)

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `calls` *extends* readonly `unknown`[] | - |
| `chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `parameters` | [`SendCallsParameters`](https://viem.sh/docs/index.html)\<`TChain`, `TAccount`, `chainOverride`, `calls`\> |

#### Returns

`Promise`\<\{ `capabilities?`: \{\[`key`: `string`\]: `any`; \}; `id`: `string`; \}\>

Transaction identifier. [SendCallsReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})

const id = await client.sendCalls({
  account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
  calls: [
    {
      data: '0xdeadbeef',
      to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    },
    {
      to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      value: 69420n,
    },
  ],
})
```

#### Inherited from

`ViemWalletClient.sendCalls`

***

### sendCallsSync()

> **sendCallsSync**: \<`calls`, `chainOverride`\>(`parameters`) => `Promise`\<\{ `atomic`: `boolean`; `capabilities?`: \{\[`key`: `string`\]: `any`; \} \| \{\[`key`: `string`\]: `any`; \}; `chainId`: `number`; `id`: `string`; `receipts?`: [`WalletCallReceipt`](https://viem.sh/docs/index.html)\<`bigint`, `"success"` \| `"reverted"`\>[]; `status`: `"pending"` \| `"success"` \| `"failure"` \| `undefined`; `statusCode`: `number`; `version`: `string`; \}\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:397

Requests the connected wallet to send a batch of calls, and waits for the calls to be included in a block.

- Docs: https://viem.sh/docs/actions/wallet/sendCallsSync
- JSON-RPC Methods: [`wallet_sendCalls`](https://eips.ethereum.org/EIPS/eip-5792)

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `calls` *extends* readonly `unknown`[] | - |
| `chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `parameters` | [`SendCallsSyncParameters`](https://viem.sh/docs/index.html)\<`TChain`, `TAccount`, `chainOverride`, `calls`\> |

#### Returns

`Promise`\<\{ `atomic`: `boolean`; `capabilities?`: \{\[`key`: `string`\]: `any`; \} \| \{\[`key`: `string`\]: `any`; \}; `chainId`: `number`; `id`: `string`; `receipts?`: [`WalletCallReceipt`](https://viem.sh/docs/index.html)\<`bigint`, `"success"` \| `"reverted"`\>[]; `status`: `"pending"` \| `"success"` \| `"failure"` \| `undefined`; `statusCode`: `number`; `version`: `string`; \}\>

Calls status. [SendCallsSyncReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})

const status = await client.sendCallsSync({
  account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
  calls: [
    {
      data: '0xdeadbeef',
      to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    },
    {
      to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      value: 69420n,
    },
  ],
})
```

#### Inherited from

`ViemWalletClient.sendCallsSync`

***

### sendRawTransaction()

> **sendRawTransaction**: (`args`) => `Promise`\<`` `0x${string}` ``\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:422

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

`ViemWalletClient.sendRawTransaction`

***

### sendRawTransactionSync()

> **sendRawTransactionSync**: (`args`) => `Promise`\<[`ExtractChainFormatterReturnType`](https://viem.sh/docs/index.html)\<`TChain`, `"transactionReceipt"`, [`TransactionReceipt`](https://viem.sh/docs/index.html)\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:448

Sends a **signed** transaction to the network synchronously,
and waits for the transaction to be included in a block.

- Docs: https://viem.sh/docs/actions/wallet/sendRawTransactionSync
- JSON-RPC Method: [`eth_sendRawTransactionSync`](https://eips.ethereum.org/EIPS/eip-7966)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`SendRawTransactionSyncParameters`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`ExtractChainFormatterReturnType`](https://viem.sh/docs/index.html)\<`TChain`, `"transactionReceipt"`, [`TransactionReceipt`](https://viem.sh/docs/index.html)\>\>

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

`ViemWalletClient.sendRawTransactionSync`

***

### sendTransaction()

> **sendTransaction**: \<`request`, `chainOverride`\>(`args`) => `Promise`\<`` `0x${string}` ``\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:491

Creates, signs, and sends a new transaction to the network.

- Docs: https://viem.sh/docs/actions/wallet/sendTransaction
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_sending-transactions
- JSON-RPC Methods:
  - JSON-RPC Accounts: [`eth_sendTransaction`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_sendtransaction)
  - Local Accounts: [`eth_sendRawTransaction`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_sendrawtransaction)

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `request` *extends* [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: `undefined`; `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `bigint`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"legacy"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `bigint`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip2930"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip1559"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: readonly `` `0x${string}` ``[] \| readonly `Uint8Array`[]; `blobVersionedHashes`: readonly `` `0x${string}` ``[]; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `bigint`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: readonly [`BlobSidecar`](https://viem.sh/docs/index.html)\<`` `0x${string}` ``\>[]; `to`: `` `0x${string}` `` \| `null`; `type?`: `"eip4844"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs`: readonly `` `0x${string}` ``[] \| readonly `Uint8Array`[]; `blobVersionedHashes?`: readonly `` `0x${string}` ``[]; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: [`Kzg`](https://viem.sh/docs/index.html); `maxFeePerBlobGas?`: `bigint`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: readonly [`BlobSidecar`](https://viem.sh/docs/index.html)\<`` `0x${string}` ``\>[]; `to`: `` `0x${string}` `` \| `null`; `type?`: `"eip4844"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: [`AuthorizationList`](https://viem.sh/docs/index.html)\<`number`, `boolean`\>; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip7702"`; `value?`: `bigint`; \}, `"from"`\> & `object` | - |
| `chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`SendTransactionParameters`](https://viem.sh/docs/index.html)\<`TChain`, `TAccount`, `chainOverride`, `request`\> | [SendTransactionParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

The [Transaction](https://viem.sh/docs/glossary/terms#transaction) hash. [SendTransactionReturnType](https://viem.sh/docs/index.html)

#### Examples

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const hash = await client.sendTransaction({
  account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
  to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  value: 1000000000000000000n,
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
  transport: http(),
})
const hash = await client.sendTransaction({
  to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  value: 1000000000000000000n,
})
```

#### Inherited from

`ViemWalletClient.sendTransaction`

***

### sendTransactionSync()

> **sendTransactionSync**: \<`request`, `chainOverride`\>(`args`) => `Promise`\<[`ExtractChainFormatterReturnType`](https://viem.sh/docs/index.html)\<`TChain`, `"transactionReceipt"`, [`TransactionReceipt`](https://viem.sh/docs/index.html)\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:535

Creates, signs, and sends a new transaction to the network synchronously.
Returns the transaction receipt.

- Docs: https://viem.sh/docs/actions/wallet/sendTransactionSync
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/transactions_sending-transactions
- JSON-RPC Methods:
  - JSON-RPC Accounts: [`eth_sendTransaction`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_sendtransaction)
  - Local Accounts: [`eth_sendRawTransaction`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_sendrawtransaction)

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `request` *extends* [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: `undefined`; `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `bigint`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"legacy"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `bigint`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip2930"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip1559"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: readonly `` `0x${string}` ``[] \| readonly `Uint8Array`[]; `blobVersionedHashes`: readonly `` `0x${string}` ``[]; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `bigint`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: readonly [`BlobSidecar`](https://viem.sh/docs/index.html)\<`` `0x${string}` ``\>[]; `to`: `` `0x${string}` `` \| `null`; `type?`: `"eip4844"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs`: readonly `` `0x${string}` ``[] \| readonly `Uint8Array`[]; `blobVersionedHashes?`: readonly `` `0x${string}` ``[]; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: [`Kzg`](https://viem.sh/docs/index.html); `maxFeePerBlobGas?`: `bigint`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: readonly [`BlobSidecar`](https://viem.sh/docs/index.html)\<`` `0x${string}` ``\>[]; `to`: `` `0x${string}` `` \| `null`; `type?`: `"eip4844"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: [`AuthorizationList`](https://viem.sh/docs/index.html)\<`number`, `boolean`\>; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip7702"`; `value?`: `bigint`; \}, `"from"`\> & `object` | - |
| `chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`SendTransactionSyncParameters`](https://viem.sh/docs/index.html)\<`TChain`, `TAccount`, `chainOverride`, `request`\> | [SendTransactionParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`ExtractChainFormatterReturnType`](https://viem.sh/docs/index.html)\<`TChain`, `"transactionReceipt"`, [`TransactionReceipt`](https://viem.sh/docs/index.html)\>\>

The transaction receipt. [SendTransactionReturnType](https://viem.sh/docs/index.html)

#### Examples

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const receipt = await client.sendTransactionSync({
  account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
  to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  value: 1000000000000000000n,
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
  transport: http(),
})
const receipt = await client.sendTransactionSync({
  to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  value: 1000000000000000000n,
})
```

#### Inherited from

`ViemWalletClient.sendTransactionSync`

***

### showCallsStatus()

> **showCallsStatus**: (`parameters`) => `Promise`\<`void`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:557

Requests for the wallet to show information about a call batch
that was sent via `sendCalls`.

- Docs: https://viem.sh/docs/actions/wallet/showCallsStatus
- JSON-RPC Methods: [`wallet_showCallsStatus`](https://eips.ethereum.org/EIPS/eip-5792)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `parameters` | [`ShowCallsStatusParameters`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`void`\>

Displays status of the calls in wallet. [ShowCallsStatusReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})

await client.showCallsStatus({ id: '0xdeadbeef' })
```

#### Inherited from

`ViemWalletClient.showCallsStatus`

***

### signAuthorization()

> **signAuthorization**: (`parameters`) => `Promise`\<[`SignAuthorizationReturnType`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:600

Signs an [EIP-7702 Authorization](https://eips.ethereum.org/EIPS/eip-7702) object.

With the calculated signature, you can:
- use [`verifyAuthorization`](https://viem.sh/docs/eip7702/verifyAuthorization) to verify the signed Authorization object,
- use [`recoverAuthorizationAddress`](https://viem.sh/docs/eip7702/recoverAuthorizationAddress) to recover the signing address from the signed Authorization object.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `parameters` | [`SignAuthorizationParameters`](https://viem.sh/docs/index.html)\<`TAccount`\> | [SignAuthorizationParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`SignAuthorizationReturnType`](https://viem.sh/docs/index.html)\>

The signed Authorization object. [SignAuthorizationReturnType](https://viem.sh/docs/index.html)

#### Examples

```ts
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: http(),
})

const signature = await client.signAuthorization({
  account: privateKeyToAccount('0x..'),
  contractAddress: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
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
  transport: http(),
})

const signature = await client.signAuthorization({
  contractAddress: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
})
```

#### Inherited from

`ViemWalletClient.signAuthorization`

***

### signMessage()

> **signMessage**: (`args`) => `Promise`\<`` `0x${string}` ``\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:644

Calculates an Ethereum-specific signature in [EIP-191 format](https://eips.ethereum.org/EIPS/eip-191): `keccak256("\x19Ethereum Signed Message:\n" + len(message) + message))`.

- Docs: https://viem.sh/docs/actions/wallet/signMessage
- JSON-RPC Methods:
  - JSON-RPC Accounts: [`personal_sign`](https://docs.metamask.io/guide/signing-data#personal-sign)
  - Local Accounts: Signs locally. No JSON-RPC request.

With the calculated signature, you can:
- use [`verifyMessage`](https://viem.sh/docs/utilities/verifyMessage) to verify the signature,
- use [`recoverMessageAddress`](https://viem.sh/docs/utilities/recoverMessageAddress) to recover the signing address from a signature.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`SignMessageParameters`](https://viem.sh/docs/index.html)\<`TAccount`\> | [SignMessageParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

The signed message. [SignMessageReturnType](https://viem.sh/docs/index.html)

#### Examples

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const signature = await client.signMessage({
  account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
  message: 'hello world',
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
  transport: http(),
})
const signature = await client.signMessage({
  message: 'hello world',
})
```

#### Inherited from

`ViemWalletClient.signMessage`

***

### signTransaction()

> **signTransaction**: \<`chainOverride`, `request`\>(`args`) => `Promise`\<[`TransactionSerialized`](https://viem.sh/docs/index.html)\<[`GetTransactionType`](https://viem.sh/docs/index.html)\<`request`, `request` *extends* [`LegacyProperties`](https://viem.sh/docs/index.html) ? `"legacy"` : `never` \| `request` *extends* [`EIP1559Properties`](https://viem.sh/docs/index.html) ? `"eip1559"` : `never` \| `request` *extends* [`EIP2930Properties`](https://viem.sh/docs/index.html) ? `"eip2930"` : `never` \| `request` *extends* [`EIP4844Properties`](https://viem.sh/docs/index.html) ? `"eip4844"` : `never` \| `request` *extends* [`EIP7702Properties`](https://viem.sh/docs/index.html) ? `"eip7702"` : `never` \| `request`\[`"type"`\] *extends* `string` \| `undefined` ? `Extract`\<`any`\[`any`\], `string`\> : `never`\>, [`GetTransactionType`](https://viem.sh/docs/index.html)\<`request`, `request` *extends* [`LegacyProperties`](https://viem.sh/docs/index.html) ? `"legacy"` : `never` \| `request` *extends* [`EIP1559Properties`](https://viem.sh/docs/index.html) ? `"eip1559"` : `never` \| `request` *extends* [`EIP2930Properties`](https://viem.sh/docs/index.html) ? `"eip2930"` : `never` \| `request` *extends* [`EIP4844Properties`](https://viem.sh/docs/index.html) ? `"eip4844"` : `never` \| `request` *extends* [`EIP7702Properties`](https://viem.sh/docs/index.html) ? `"eip7702"` : `never` \| `request`\[`"type"`\] *extends* `string` \| `undefined` ? `Extract`\<`any`\[`any`\], `string`\> : `never`\> *extends* `"eip1559"` ? `` `0x02${string}` `` : `never` \| [`GetTransactionType`](https://viem.sh/docs/index.html)\<`request`, `request` *extends* [`LegacyProperties`](https://viem.sh/docs/index.html) ? `"legacy"` : `never` \| `request` *extends* [`EIP1559Properties`](https://viem.sh/docs/index.html) ? `"eip1559"` : `never` \| `request` *extends* [`EIP2930Properties`](https://viem.sh/docs/index.html) ? `"eip2930"` : `never` \| `request` *extends* [`EIP4844Properties`](https://viem.sh/docs/index.html) ? `"eip4844"` : `never` \| `request` *extends* [`EIP7702Properties`](https://viem.sh/docs/index.html) ? `"eip7702"` : `never` \| `request`\[`"type"`\] *extends* `string` \| `undefined` ? `Extract`\<`any`\[`any`\], `string`\> : `never`\> *extends* `"eip2930"` ? `` `0x01${string}` `` : `never` \| [`GetTransactionType`](https://viem.sh/docs/index.html)\<`request`, `request` *extends* [`LegacyProperties`](https://viem.sh/docs/index.html) ? `"legacy"` : `never` \| `request` *extends* [`EIP1559Properties`](https://viem.sh/docs/index.html) ? `"eip1559"` : `never` \| `request` *extends* [`EIP2930Properties`](https://viem.sh/docs/index.html) ? `"eip2930"` : `never` \| `request` *extends* [`EIP4844Properties`](https://viem.sh/docs/index.html) ? `"eip4844"` : `never` \| `request` *extends* [`EIP7702Properties`](https://viem.sh/docs/index.html) ? `"eip7702"` : `never` \| `request`\[`"type"`\] *extends* `string` \| `undefined` ? `Extract`\<`any`\[`any`\], `string`\> : `never`\> *extends* `"eip4844"` ? `` `0x03${string}` `` : `never` \| [`GetTransactionType`](https://viem.sh/docs/index.html)\<`request`, `request` *extends* [`LegacyProperties`](https://viem.sh/docs/index.html) ? `"legacy"` : `never` \| `request` *extends* [`EIP1559Properties`](https://viem.sh/docs/index.html) ? `"eip1559"` : `never` \| `request` *extends* [`EIP2930Properties`](https://viem.sh/docs/index.html) ? `"eip2930"` : `never` \| `request` *extends* [`EIP4844Properties`](https://viem.sh/docs/index.html) ? `"eip4844"` : `never` \| `request` *extends* [`EIP7702Properties`](https://viem.sh/docs/index.html) ? `"eip7702"` : `never` \| `request`\[`"type"`\] *extends* `string` \| `undefined` ? `Extract`\<`any`\[`any`\], `string`\> : `never`\> *extends* `"eip7702"` ? `` `0x04${string}` `` : `never` \| [`GetTransactionType`](https://viem.sh/docs/index.html)\<`request`, `request` *extends* [`LegacyProperties`](https://viem.sh/docs/index.html) ? `"legacy"` : `never` \| `request` *extends* [`EIP1559Properties`](https://viem.sh/docs/index.html) ? `"eip1559"` : `never` \| `request` *extends* [`EIP2930Properties`](https://viem.sh/docs/index.html) ? `"eip2930"` : `never` \| `request` *extends* [`EIP4844Properties`](https://viem.sh/docs/index.html) ? `"eip4844"` : `never` \| `request` *extends* [`EIP7702Properties`](https://viem.sh/docs/index.html) ? `"eip7702"` : `never` \| `request`\[`"type"`\] *extends* `string` \| `undefined` ? `Extract`\<`any`\[`any`\], `string`\> : `never`\> *extends* `"legacy"` ? [`TransactionSerializedLegacy`](https://viem.sh/docs/index.html) : `never`\>\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:688

Signs a transaction.

- Docs: https://viem.sh/docs/actions/wallet/signTransaction
- JSON-RPC Methods:
  - JSON-RPC Accounts: [`eth_signTransaction`](https://ethereum.github.io/execution-apis/api-documentation/)
  - Local Accounts: Signs locally. No JSON-RPC request.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` | - |
| `request` *extends* [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: `undefined`; `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `bigint`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"legacy"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `bigint`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `undefined`; `maxPriorityFeePerGas?`: `undefined`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip2930"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip1559"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs?`: readonly `` `0x${string}` ``[] \| readonly `Uint8Array`[]; `blobVersionedHashes`: readonly `` `0x${string}` ``[]; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `bigint`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: readonly [`BlobSidecar`](https://viem.sh/docs/index.html)\<`` `0x${string}` ``\>[]; `to`: `` `0x${string}` `` \| `null`; `type?`: `"eip4844"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: `undefined`; `blobs`: readonly `` `0x${string}` ``[] \| readonly `Uint8Array`[]; `blobVersionedHashes?`: readonly `` `0x${string}` ``[]; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: [`Kzg`](https://viem.sh/docs/index.html); `maxFeePerBlobGas?`: `bigint`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: readonly [`BlobSidecar`](https://viem.sh/docs/index.html)\<`` `0x${string}` ``\>[]; `to`: `` `0x${string}` `` \| `null`; `type?`: `"eip4844"`; `value?`: `bigint`; \}, `"from"`\> \| [`Omit`](https://viem.sh/docs/index.html)\<\{ `accessList?`: [`AccessList`](https://viem.sh/docs/index.html); `authorizationList?`: [`AuthorizationList`](https://viem.sh/docs/index.html)\<`number`, `boolean`\>; `blobs?`: `undefined`; `blobVersionedHashes?`: `undefined`; `data?`: `` `0x${string}` ``; `from?`: `` `0x${string}` ``; `gas?`: `bigint`; `gasPrice?`: `undefined`; `kzg?`: `undefined`; `maxFeePerBlobGas?`: `undefined`; `maxFeePerGas?`: `bigint`; `maxPriorityFeePerGas?`: `bigint`; `nonce?`: `number`; `sidecars?`: `undefined`; `to?`: `` `0x${string}` `` \| `null`; `type?`: `"eip7702"`; `value?`: `bigint`; \}, `"from"`\> | [`UnionOmit`](https://viem.sh/docs/index.html)\<[`ExtractChainFormatterParameters`](https://viem.sh/docs/index.html)\<[`DeriveChain`](https://viem.sh/docs/index.html)\<`TChain`, `chainOverride`\>, `"transactionRequest"`, [`TransactionRequest`](https://viem.sh/docs/index.html)\>, `"from"`\> |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`SignTransactionParameters`](https://viem.sh/docs/index.html)\<`TChain`, `TAccount`, `chainOverride`, `request`\> | [SignTransactionParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`TransactionSerialized`](https://viem.sh/docs/index.html)\<[`GetTransactionType`](https://viem.sh/docs/index.html)\<`request`, `request` *extends* [`LegacyProperties`](https://viem.sh/docs/index.html) ? `"legacy"` : `never` \| `request` *extends* [`EIP1559Properties`](https://viem.sh/docs/index.html) ? `"eip1559"` : `never` \| `request` *extends* [`EIP2930Properties`](https://viem.sh/docs/index.html) ? `"eip2930"` : `never` \| `request` *extends* [`EIP4844Properties`](https://viem.sh/docs/index.html) ? `"eip4844"` : `never` \| `request` *extends* [`EIP7702Properties`](https://viem.sh/docs/index.html) ? `"eip7702"` : `never` \| `request`\[`"type"`\] *extends* `string` \| `undefined` ? `Extract`\<`any`\[`any`\], `string`\> : `never`\>, [`GetTransactionType`](https://viem.sh/docs/index.html)\<`request`, `request` *extends* [`LegacyProperties`](https://viem.sh/docs/index.html) ? `"legacy"` : `never` \| `request` *extends* [`EIP1559Properties`](https://viem.sh/docs/index.html) ? `"eip1559"` : `never` \| `request` *extends* [`EIP2930Properties`](https://viem.sh/docs/index.html) ? `"eip2930"` : `never` \| `request` *extends* [`EIP4844Properties`](https://viem.sh/docs/index.html) ? `"eip4844"` : `never` \| `request` *extends* [`EIP7702Properties`](https://viem.sh/docs/index.html) ? `"eip7702"` : `never` \| `request`\[`"type"`\] *extends* `string` \| `undefined` ? `Extract`\<`any`\[`any`\], `string`\> : `never`\> *extends* `"eip1559"` ? `` `0x02${string}` `` : `never` \| [`GetTransactionType`](https://viem.sh/docs/index.html)\<`request`, `request` *extends* [`LegacyProperties`](https://viem.sh/docs/index.html) ? `"legacy"` : `never` \| `request` *extends* [`EIP1559Properties`](https://viem.sh/docs/index.html) ? `"eip1559"` : `never` \| `request` *extends* [`EIP2930Properties`](https://viem.sh/docs/index.html) ? `"eip2930"` : `never` \| `request` *extends* [`EIP4844Properties`](https://viem.sh/docs/index.html) ? `"eip4844"` : `never` \| `request` *extends* [`EIP7702Properties`](https://viem.sh/docs/index.html) ? `"eip7702"` : `never` \| `request`\[`"type"`\] *extends* `string` \| `undefined` ? `Extract`\<`any`\[`any`\], `string`\> : `never`\> *extends* `"eip2930"` ? `` `0x01${string}` `` : `never` \| [`GetTransactionType`](https://viem.sh/docs/index.html)\<`request`, `request` *extends* [`LegacyProperties`](https://viem.sh/docs/index.html) ? `"legacy"` : `never` \| `request` *extends* [`EIP1559Properties`](https://viem.sh/docs/index.html) ? `"eip1559"` : `never` \| `request` *extends* [`EIP2930Properties`](https://viem.sh/docs/index.html) ? `"eip2930"` : `never` \| `request` *extends* [`EIP4844Properties`](https://viem.sh/docs/index.html) ? `"eip4844"` : `never` \| `request` *extends* [`EIP7702Properties`](https://viem.sh/docs/index.html) ? `"eip7702"` : `never` \| `request`\[`"type"`\] *extends* `string` \| `undefined` ? `Extract`\<`any`\[`any`\], `string`\> : `never`\> *extends* `"eip4844"` ? `` `0x03${string}` `` : `never` \| [`GetTransactionType`](https://viem.sh/docs/index.html)\<`request`, `request` *extends* [`LegacyProperties`](https://viem.sh/docs/index.html) ? `"legacy"` : `never` \| `request` *extends* [`EIP1559Properties`](https://viem.sh/docs/index.html) ? `"eip1559"` : `never` \| `request` *extends* [`EIP2930Properties`](https://viem.sh/docs/index.html) ? `"eip2930"` : `never` \| `request` *extends* [`EIP4844Properties`](https://viem.sh/docs/index.html) ? `"eip4844"` : `never` \| `request` *extends* [`EIP7702Properties`](https://viem.sh/docs/index.html) ? `"eip7702"` : `never` \| `request`\[`"type"`\] *extends* `string` \| `undefined` ? `Extract`\<`any`\[`any`\], `string`\> : `never`\> *extends* `"eip7702"` ? `` `0x04${string}` `` : `never` \| [`GetTransactionType`](https://viem.sh/docs/index.html)\<`request`, `request` *extends* [`LegacyProperties`](https://viem.sh/docs/index.html) ? `"legacy"` : `never` \| `request` *extends* [`EIP1559Properties`](https://viem.sh/docs/index.html) ? `"eip1559"` : `never` \| `request` *extends* [`EIP2930Properties`](https://viem.sh/docs/index.html) ? `"eip2930"` : `never` \| `request` *extends* [`EIP4844Properties`](https://viem.sh/docs/index.html) ? `"eip4844"` : `never` \| `request` *extends* [`EIP7702Properties`](https://viem.sh/docs/index.html) ? `"eip7702"` : `never` \| `request`\[`"type"`\] *extends* `string` \| `undefined` ? `Extract`\<`any`\[`any`\], `string`\> : `never`\> *extends* `"legacy"` ? [`TransactionSerializedLegacy`](https://viem.sh/docs/index.html) : `never`\>\>

The signed message. [SignTransactionReturnType](https://viem.sh/docs/index.html)

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
const signature = await client.signTransaction(request)
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
const signature = await client.signTransaction(request)
```

#### Inherited from

`ViemWalletClient.signTransaction`

***

### signTypedData()

> **signTypedData**: \<`typedData`, `primaryType`\>(`args`) => `Promise`\<`` `0x${string}` ``\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:785

Signs typed data and calculates an Ethereum-specific signature in [EIP-191 format](https://eips.ethereum.org/EIPS/eip-191): `keccak256("\x19Ethereum Signed Message:\n" + len(message) + message))`.

- Docs: https://viem.sh/docs/actions/wallet/signTypedData
- JSON-RPC Methods:
  - JSON-RPC Accounts: [`eth_signTypedData_v4`](https://docs.metamask.io/guide/signing-data#signtypeddata-v4)
  - Local Accounts: Signs locally. No JSON-RPC request.

#### Type Parameters

| Type Parameter |
| ------ |
| `typedData` *extends* \{\[`key`: `string`\]: readonly `TypedDataParameter`[]; \[`key`: `` `string[${string}]` ``\]: `undefined`; \[`key`: `` `function[${string}]` ``\]: `undefined`; \[`key`: `` `address[${string}]` ``\]: `undefined`; \[`key`: `` `bool[${string}]` ``\]: `undefined`; \[`key`: `` `bytes[${string}]` ``\]: `undefined`; \[`key`: `` `bytes1[${string}]` ``\]: `undefined`; \[`key`: `` `bytes2[${string}]` ``\]: `undefined`; \[`key`: `` `bytes3[${string}]` ``\]: `undefined`; \[`key`: `` `bytes4[${string}]` ``\]: `undefined`; \[`key`: `` `bytes5[${string}]` ``\]: `undefined`; \[`key`: `` `bytes6[${string}]` ``\]: `undefined`; \[`key`: `` `bytes7[${string}]` ``\]: `undefined`; \[`key`: `` `bytes8[${string}]` ``\]: `undefined`; \[`key`: `` `bytes9[${string}]` ``\]: `undefined`; \[`key`: `` `bytes10[${string}]` ``\]: `undefined`; \[`key`: `` `bytes11[${string}]` ``\]: `undefined`; \[`key`: `` `bytes12[${string}]` ``\]: `undefined`; \[`key`: `` `bytes13[${string}]` ``\]: `undefined`; \[`key`: `` `bytes14[${string}]` ``\]: `undefined`; \[`key`: `` `bytes15[${string}]` ``\]: `undefined`; \[`key`: `` `bytes16[${string}]` ``\]: `undefined`; \[`key`: `` `bytes17[${string}]` ``\]: `undefined`; \[`key`: `` `bytes18[${string}]` ``\]: `undefined`; \[`key`: `` `bytes19[${string}]` ``\]: `undefined`; \[`key`: `` `bytes20[${string}]` ``\]: `undefined`; \[`key`: `` `bytes21[${string}]` ``\]: `undefined`; \[`key`: `` `bytes22[${string}]` ``\]: `undefined`; \[`key`: `` `bytes23[${string}]` ``\]: `undefined`; \[`key`: `` `bytes24[${string}]` ``\]: `undefined`; \[`key`: `` `bytes25[${string}]` ``\]: `undefined`; \[`key`: `` `bytes26[${string}]` ``\]: `undefined`; \[`key`: `` `bytes27[${string}]` ``\]: `undefined`; \[`key`: `` `bytes28[${string}]` ``\]: `undefined`; \[`key`: `` `bytes29[${string}]` ``\]: `undefined`; \[`key`: `` `bytes30[${string}]` ``\]: `undefined`; \[`key`: `` `bytes31[${string}]` ``\]: `undefined`; \[`key`: `` `bytes32[${string}]` ``\]: `undefined`; \[`key`: `` `int[${string}]` ``\]: `undefined`; \[`key`: `` `int8[${string}]` ``\]: `undefined`; \[`key`: `` `int16[${string}]` ``\]: `undefined`; \[`key`: `` `int24[${string}]` ``\]: `undefined`; \[`key`: `` `int32[${string}]` ``\]: `undefined`; \[`key`: `` `int40[${string}]` ``\]: `undefined`; \[`key`: `` `int48[${string}]` ``\]: `undefined`; \[`key`: `` `int56[${string}]` ``\]: `undefined`; \[`key`: `` `int64[${string}]` ``\]: `undefined`; \[`key`: `` `int72[${string}]` ``\]: `undefined`; \[`key`: `` `int80[${string}]` ``\]: `undefined`; \[`key`: `` `int88[${string}]` ``\]: `undefined`; \[`key`: `` `int96[${string}]` ``\]: `undefined`; \[`key`: `` `int104[${string}]` ``\]: `undefined`; \[`key`: `` `int112[${string}]` ``\]: `undefined`; \[`key`: `` `int120[${string}]` ``\]: `undefined`; \[`key`: `` `int128[${string}]` ``\]: `undefined`; \[`key`: `` `int136[${string}]` ``\]: `undefined`; \[`key`: `` `int144[${string}]` ``\]: `undefined`; \[`key`: `` `int152[${string}]` ``\]: `undefined`; \[`key`: `` `int160[${string}]` ``\]: `undefined`; \[`key`: `` `int168[${string}]` ``\]: `undefined`; \[`key`: `` `int176[${string}]` ``\]: `undefined`; \[`key`: `` `int184[${string}]` ``\]: `undefined`; \[`key`: `` `int192[${string}]` ``\]: `undefined`; \[`key`: `` `int200[${string}]` ``\]: `undefined`; \[`key`: `` `int208[${string}]` ``\]: `undefined`; \[`key`: `` `int216[${string}]` ``\]: `undefined`; \[`key`: `` `int224[${string}]` ``\]: `undefined`; \[`key`: `` `int232[${string}]` ``\]: `undefined`; \[`key`: `` `int240[${string}]` ``\]: `undefined`; \[`key`: `` `int248[${string}]` ``\]: `undefined`; \[`key`: `` `int256[${string}]` ``\]: `undefined`; \[`key`: `` `uint[${string}]` ``\]: `undefined`; \[`key`: `` `uint8[${string}]` ``\]: `undefined`; \[`key`: `` `uint16[${string}]` ``\]: `undefined`; \[`key`: `` `uint24[${string}]` ``\]: `undefined`; \[`key`: `` `uint32[${string}]` ``\]: `undefined`; \[`key`: `` `uint40[${string}]` ``\]: `undefined`; \[`key`: `` `uint48[${string}]` ``\]: `undefined`; \[`key`: `` `uint56[${string}]` ``\]: `undefined`; \[`key`: `` `uint64[${string}]` ``\]: `undefined`; \[`key`: `` `uint72[${string}]` ``\]: `undefined`; \[`key`: `` `uint80[${string}]` ``\]: `undefined`; \[`key`: `` `uint88[${string}]` ``\]: `undefined`; \[`key`: `` `uint96[${string}]` ``\]: `undefined`; \[`key`: `` `uint104[${string}]` ``\]: `undefined`; \[`key`: `` `uint112[${string}]` ``\]: `undefined`; \[`key`: `` `uint120[${string}]` ``\]: `undefined`; \[`key`: `` `uint128[${string}]` ``\]: `undefined`; \[`key`: `` `uint136[${string}]` ``\]: `undefined`; \[`key`: `` `uint144[${string}]` ``\]: `undefined`; \[`key`: `` `uint152[${string}]` ``\]: `undefined`; \[`key`: `` `uint160[${string}]` ``\]: `undefined`; \[`key`: `` `uint168[${string}]` ``\]: `undefined`; \[`key`: `` `uint176[${string}]` ``\]: `undefined`; \[`key`: `` `uint184[${string}]` ``\]: `undefined`; \[`key`: `` `uint192[${string}]` ``\]: `undefined`; \[`key`: `` `uint200[${string}]` ``\]: `undefined`; \[`key`: `` `uint208[${string}]` ``\]: `undefined`; \[`key`: `` `uint216[${string}]` ``\]: `undefined`; \[`key`: `` `uint224[${string}]` ``\]: `undefined`; \[`key`: `` `uint232[${string}]` ``\]: `undefined`; \[`key`: `` `uint240[${string}]` ``\]: `undefined`; \[`key`: `` `uint248[${string}]` ``\]: `undefined`; \[`key`: `` `uint256[${string}]` ``\]: `undefined`; `address?`: `undefined`; `bool?`: `undefined`; `bytes?`: `undefined`; `bytes1?`: `undefined`; `bytes10?`: `undefined`; `bytes11?`: `undefined`; `bytes12?`: `undefined`; `bytes13?`: `undefined`; `bytes14?`: `undefined`; `bytes15?`: `undefined`; `bytes16?`: `undefined`; `bytes17?`: `undefined`; `bytes18?`: `undefined`; `bytes19?`: `undefined`; `bytes2?`: `undefined`; `bytes20?`: `undefined`; `bytes21?`: `undefined`; `bytes22?`: `undefined`; `bytes23?`: `undefined`; `bytes24?`: `undefined`; `bytes25?`: `undefined`; `bytes26?`: `undefined`; `bytes27?`: `undefined`; `bytes28?`: `undefined`; `bytes29?`: `undefined`; `bytes3?`: `undefined`; `bytes30?`: `undefined`; `bytes31?`: `undefined`; `bytes32?`: `undefined`; `bytes4?`: `undefined`; `bytes5?`: `undefined`; `bytes6?`: `undefined`; `bytes7?`: `undefined`; `bytes8?`: `undefined`; `bytes9?`: `undefined`; `int104?`: `undefined`; `int112?`: `undefined`; `int120?`: `undefined`; `int128?`: `undefined`; `int136?`: `undefined`; `int144?`: `undefined`; `int152?`: `undefined`; `int16?`: `undefined`; `int160?`: `undefined`; `int168?`: `undefined`; `int176?`: `undefined`; `int184?`: `undefined`; `int192?`: `undefined`; `int200?`: `undefined`; `int208?`: `undefined`; `int216?`: `undefined`; `int224?`: `undefined`; `int232?`: `undefined`; `int24?`: `undefined`; `int240?`: `undefined`; `int248?`: `undefined`; `int256?`: `undefined`; `int32?`: `undefined`; `int40?`: `undefined`; `int48?`: `undefined`; `int56?`: `undefined`; `int64?`: `undefined`; `int72?`: `undefined`; `int8?`: `undefined`; `int80?`: `undefined`; `int88?`: `undefined`; `int96?`: `undefined`; `string?`: `undefined`; `uint104?`: `undefined`; `uint112?`: `undefined`; `uint120?`: `undefined`; `uint128?`: `undefined`; `uint136?`: `undefined`; `uint144?`: `undefined`; `uint152?`: `undefined`; `uint16?`: `undefined`; `uint160?`: `undefined`; `uint168?`: `undefined`; `uint176?`: `undefined`; `uint184?`: `undefined`; `uint192?`: `undefined`; `uint200?`: `undefined`; `uint208?`: `undefined`; `uint216?`: `undefined`; `uint224?`: `undefined`; `uint232?`: `undefined`; `uint24?`: `undefined`; `uint240?`: `undefined`; `uint248?`: `undefined`; `uint256?`: `undefined`; `uint32?`: `undefined`; `uint40?`: `undefined`; `uint48?`: `undefined`; `uint56?`: `undefined`; `uint64?`: `undefined`; `uint72?`: `undefined`; `uint8?`: `undefined`; `uint80?`: `undefined`; `uint88?`: `undefined`; `uint96?`: `undefined`; \} \| \{\[`key`: `string`\]: `unknown`; \} |
| `primaryType` *extends* `string` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`SignTypedDataParameters`](https://viem.sh/docs/index.html)\<`typedData`, `primaryType`, `TAccount`\> | [SignTypedDataParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

The signed data. [SignTypedDataReturnType](https://viem.sh/docs/index.html)

#### Examples

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const signature = await client.signTypedData({
  account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
  domain: {
    name: 'Ether Mail',
    version: '1',
    chainId: 1,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  types: {
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' },
    ],
  },
  primaryType: 'Mail',
  message: {
    from: {
      name: 'Cow',
      wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
    },
    to: {
      name: 'Bob',
      wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    },
    contents: 'Hello, Bob!',
  },
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
  transport: http(),
})
const signature = await client.signTypedData({
  domain: {
    name: 'Ether Mail',
    version: '1',
    chainId: 1,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  types: {
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' },
    ],
  },
  primaryType: 'Mail',
  message: {
    from: {
      name: 'Cow',
      wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
    },
    to: {
      name: 'Bob',
      wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    },
    contents: 'Hello, Bob!',
  },
})
```

#### Inherited from

`ViemWalletClient.signTypedData`

***

### switchChain()

> **switchChain**: (`args`) => `Promise`\<`void`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:806

Switch the target chain in a wallet.

- Docs: https://viem.sh/docs/actions/wallet/switchChain
- JSON-RPC Methods: [`eth_switchEthereumChain`](https://eips.ethereum.org/EIPS/eip-3326)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`SwitchChainParameters`](https://viem.sh/docs/index.html) | [SwitchChainParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`void`\>

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet, optimism } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
await client.switchChain({ id: optimism.id })
```

#### Inherited from

`ViemWalletClient.switchChain`

***

### transport

> **transport**: `ReturnType`\<`TTransport`\>\[`"config"`\] & `ReturnType`\<`TTransport`\>\[`"value"`\]

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:93

The RPC transport

#### Inherited from

`ViemWalletClient.transport`

***

### type

> **type**: `string`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:95

The type of client.

#### Inherited from

`ViemWalletClient.type`

***

### uid

> **uid**: `string`

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/createClient.d.ts:97

A unique ID for the client.

#### Inherited from

`ViemWalletClient.uid`

***

### waitForCallsStatus()

> **waitForCallsStatus**: (`parameters`) => `Promise`\<\{ `atomic`: `boolean`; `capabilities?`: \{\[`key`: `string`\]: `any`; \} \| \{\[`key`: `string`\]: `any`; \}; `chainId`: `number`; `id`: `string`; `receipts?`: [`WalletCallReceipt`](https://viem.sh/docs/index.html)\<`bigint`, `"success"` \| `"reverted"`\>[]; `status`: `"pending"` \| `"success"` \| `"failure"` \| `undefined`; `statusCode`: `number`; `version`: `string`; \}\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:828

Waits for the status & receipts of a call bundle that was sent via `sendCalls`.

- Docs: https://viem.sh/docs/actions/wallet/waitForCallsStatus
- JSON-RPC Methods: [`wallet_getCallsStatus`](https://eips.ethereum.org/EIPS/eip-5792)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `parameters` | [`WaitForCallsStatusParameters`](https://viem.sh/docs/index.html) | [WaitForCallsStatusParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<\{ `atomic`: `boolean`; `capabilities?`: \{\[`key`: `string`\]: `any`; \} \| \{\[`key`: `string`\]: `any`; \}; `chainId`: `number`; `id`: `string`; `receipts?`: [`WalletCallReceipt`](https://viem.sh/docs/index.html)\<`bigint`, `"success"` \| `"reverted"`\>[]; `status`: `"pending"` \| `"success"` \| `"failure"` \| `undefined`; `statusCode`: `number`; `version`: `string`; \}\>

Status & receipts of the call bundle. [WaitForCallsStatusReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})

const { receipts, status } = await waitForCallsStatus(client, { id: '0xdeadbeef' })
```

#### Inherited from

`ViemWalletClient.waitForCallsStatus`

***

### watchAsset()

> **watchAsset**: (`args`) => `Promise`\<`boolean`\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:855

Adds an EVM chain to the wallet.

- Docs: https://viem.sh/docs/actions/wallet/watchAsset
- JSON-RPC Methods: [`eth_switchEthereumChain`](https://eips.ethereum.org/EIPS/eip-747)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`WatchAssetParams`](https://viem.sh/docs/index.html) | [WatchAssetParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`boolean`\>

Boolean indicating if the token was successfully added. [WatchAssetReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const success = await client.watchAsset({
  type: 'ERC20',
  options: {
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    decimals: 18,
    symbol: 'WETH',
  },
})
```

#### Inherited from

`ViemWalletClient.watchAsset`

***

### writeContract()

> **writeContract**: \<`abi`, `functionName`, `args`, `chainOverride`\>(`args`) => `Promise`\<`` `0x${string}` ``\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:903

Executes a write function on a contract.

- Docs: https://viem.sh/docs/contract/writeContract
- Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/contracts_writing-to-contracts

A "write" function on a Solidity contract modifies the state of the blockchain. These types of functions require gas to be executed, and hence a [Transaction](https://viem.sh/docs/glossary/terms) is needed to be broadcast in order to change the state.

Internally, uses a [Wallet Client](https://viem.sh/docs/clients/wallet) to call the [`sendTransaction` action](https://viem.sh/docs/actions/wallet/sendTransaction) with [ABI-encoded `data`](https://viem.sh/docs/contract/encodeFunctionData).

__Warning: The `write` internally sends a transaction – it does not validate if the contract write will succeed (the contract may throw an error). It is highly recommended to [simulate the contract write with `contract.simulate`](https://viem.sh/docs/contract/writeContract#usage) before you execute it.__

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `abi` *extends* `Abi` \| readonly `unknown`[] | - |
| `functionName` *extends* `string` | - |
| `args` *extends* `unknown` | - |
| `chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`WriteContractParameters`](https://viem.sh/docs/index.html)\<`abi`, `functionName`, `args`, `TChain`, `TAccount`, `chainOverride`\> | [WriteContractParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

A [Transaction Hash](https://viem.sh/docs/glossary/terms#hash). [WriteContractReturnType](https://viem.sh/docs/index.html)

#### Examples

```ts
import { createWalletClient, custom, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const hash = await client.writeContract({
  address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
  abi: parseAbi(['function mint(uint32 tokenId) nonpayable']),
  functionName: 'mint',
  args: [69420],
})
```

```ts
// With Validation
import { createWalletClient, custom, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const { request } = await client.simulateContract({
  address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
  abi: parseAbi(['function mint(uint32 tokenId) nonpayable']),
  functionName: 'mint',
  args: [69420],
}
const hash = await client.writeContract(request)
```

#### Inherited from

`ViemWalletClient.writeContract`

***

### writeContractSync()

> **writeContractSync**: \<`abi`, `functionName`, `args`, `chainOverride`\>(`args`) => `Promise`\<[`TransactionReceipt`](https://viem.sh/docs/index.html)\>

Defined in: node\_modules/.pnpm/viem@2.43.3\_typescript@5.7.2/node\_modules/viem/\_types/clients/decorators/wallet.d.ts:934

Executes a write function on a contract synchronously.
Returns the transaction receipt.

- Docs: https://viem.sh/docs/contract/writeContract

A "write" function on a Solidity contract modifies the state of the blockchain. These types of functions require gas to be executed, and hence a [Transaction](https://viem.sh/docs/glossary/terms) is needed to be broadcast in order to change the state.

Internally, uses a [Wallet Client](https://viem.sh/docs/clients/wallet) to call the [`sendTransaction` action](https://viem.sh/docs/actions/wallet/sendTransaction) with [ABI-encoded `data`](https://viem.sh/docs/contract/encodeFunctionData).

__Warning: The `write` internally sends a transaction – it does not validate if the contract write will succeed (the contract may throw an error). It is highly recommended to [simulate the contract write with `contract.simulate`](https://viem.sh/docs/contract/writeContract#usage) before you execute it.__

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `abi` *extends* `Abi` \| readonly `unknown`[] | - |
| `functionName` *extends* `string` | - |
| `args` *extends* `unknown` | - |
| `chainOverride` *extends* [`Chain`](https://viem.sh/docs/index.html) \| `undefined` | `undefined` |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `args` | [`WriteContractSyncParameters`](https://viem.sh/docs/index.html)\<`abi`, `functionName`, `args`, `TChain`, `TAccount`, `chainOverride`\> | [WriteContractSyncParameters](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`TransactionReceipt`](https://viem.sh/docs/index.html)\>

A [Transaction Receipt](https://viem.sh/docs/glossary/terms#receipt). [WriteContractSyncReturnType](https://viem.sh/docs/index.html)

#### Example

```ts
import { createWalletClient, custom, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
})
const receipt = await client.writeContractSync({
  address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
  abi: parseAbi(['function mint(uint32 tokenId) nonpayable']),
  functionName: 'mint',
  args: [69420],
})
```

#### Inherited from

`ViemWalletClient.writeContractSync`
