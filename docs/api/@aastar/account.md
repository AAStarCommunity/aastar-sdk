## Classes

### UserOpClient

Defined in: [packages/account/src/index.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/index.ts#L40)

UserOperation Client for handling high-level flows

#### Constructors

##### Constructor

```ts
new UserOpClient(): UserOpClient;
```

###### Returns

[`UserOpClient`](#useropclient)

#### Methods

##### estimateGas()

```ts
static estimateGas(
   bundler, 
   op, 
entryPoint): Promise<any>;
```

Defined in: [packages/account/src/index.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/index.ts#L41)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `bundler` | `any` |
| `op` | `any` |
| `entryPoint` | `` `0x${string}` `` |

###### Returns

`Promise`\<`any`\>

##### getReceipt()

```ts
static getReceipt(bundler, hash): Promise<any>;
```

Defined in: [packages/account/src/index.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/index.ts#L55)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `bundler` | `any` |
| `hash` | `` `0x${string}` `` |

###### Returns

`Promise`\<`any`\>

##### sendUserOp()

```ts
static sendUserOp(
   bundler, 
   op, 
entryPoint): Promise<any>;
```

Defined in: [packages/account/src/index.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/index.ts#L48)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `bundler` | `any` |
| `op` | `any` |
| `entryPoint` | `` `0x${string}` `` |

###### Returns

`Promise`\<`any`\>

## Type Aliases

### EOAWalletClient

```ts
type EOAWalletClient = WalletClient & object;
```

Defined in: [packages/account/src/eoa.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/eoa.ts#L4)

#### Type Declaration

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `getAddress()` | () => `Address` | [packages/account/src/eoa.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/eoa.ts#L6) |
| `sendTransaction()` | (`args`) => `Promise`\<`Hash`\> | [packages/account/src/eoa.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/eoa.ts#L5) |

***

### SimpleSmartAccount

```ts
type SimpleSmartAccount = LocalAccount & object;
```

Defined in: [packages/account/src/accounts/simple.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/accounts/simple.ts#L15)

#### Type Declaration

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `entryPoint` | `Address` | [packages/account/src/accounts/simple.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/accounts/simple.ts#L19) |
| `getDummySignature()` | () => `Promise`\<`Hex`\> | [packages/account/src/accounts/simple.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/accounts/simple.ts#L18) |
| `getInitCode()` | () => `Promise`\<`Hex`\> | [packages/account/src/accounts/simple.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/accounts/simple.ts#L17) |
| `signUserOperation()` | (`userOp`) => `Promise`\<`Hex`\> | [packages/account/src/accounts/simple.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/accounts/simple.ts#L16) |

## Functions

### createEOAWalletClient()

```ts
function createEOAWalletClient(
   privateKey, 
   chain, 
   transport): EOAWalletClient;
```

Defined in: [packages/account/src/eoa.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/eoa.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `privateKey` | `` `0x${string}` `` |
| `chain` | `Chain` |
| `transport` | `Transport` |

#### Returns

[`EOAWalletClient`](#eoawalletclient)

***

### getUserOpHash()

```ts
function getUserOpHash(
   op, 
   ep, 
   chainId): `0x${string}`;
```

Defined in: [packages/account/src/index.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/index.ts#L16)

Local implementation of EntryPoint v0.7 getUserOpHash

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `op` | `any` |
| `ep` | `` `0x${string}` `` |
| `chainId` | `number` |

#### Returns

`` `0x${string}` ``

***

### packUserOpLimits()

```ts
function packUserOpLimits(high, low): `0x${string}`;
```

Defined in: [packages/account/src/index.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/index.ts#L9)

Common Pack Logic for v0.7 UserOperations

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `high` | `bigint` |
| `low` | `bigint` |

#### Returns

`` `0x${string}` ``

***

### toSimpleSmartAccount()

```ts
function toSimpleSmartAccount(parameters): Promise<SimpleSmartAccount>;
```

Defined in: [packages/account/src/accounts/simple.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/9355f214d4f7ac03755d574206ded22f6097f351/packages/account/src/accounts/simple.ts#L22)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `parameters` | \{ `client`: `any`; `entryPoint`: \{ `address`: `` `0x${string}` ``; `version`: `"0.6"` \| `"0.7"`; \}; `factoryAddress`: `` `0x${string}` ``; `index?`: `bigint`; `owner`: \{ `address`: `` `0x${string}` ``; `nonceManager?`: `NonceManager`; `publicKey`: `` `0x${string}` ``; `sign?`: (`parameters`) => `Promise`\<`` `0x${string}` ``\>; `signAuthorization?`: (`parameters`) => `Promise`\<`SignAuthorizationReturnType`\>; `signMessage`: (`__namedParameters`) => `Promise`\<`` `0x${string}` ``\>; `signTransaction`: \<`serializer`, `transaction`\>(`transaction`, `options?`) => `Promise`\<`` `0x${string}` ``\>; `signTypedData`: \<`typedData`, `primaryType`\>(`parameters`) => `Promise`\<`` `0x${string}` ``\>; `source`: `string`; `type`: `"local"`; \}; `salt?`: `bigint`; \} |
| `parameters.client` | `any` |
| `parameters.entryPoint` | \{ `address`: `` `0x${string}` ``; `version`: `"0.6"` \| `"0.7"`; \} |
| `parameters.entryPoint.address` | `` `0x${string}` `` |
| `parameters.entryPoint.version` | `"0.6"` \| `"0.7"` |
| `parameters.factoryAddress` | `` `0x${string}` `` |
| `parameters.index?` | `bigint` |
| `parameters.owner` | \{ `address`: `` `0x${string}` ``; `nonceManager?`: `NonceManager`; `publicKey`: `` `0x${string}` ``; `sign?`: (`parameters`) => `Promise`\<`` `0x${string}` ``\>; `signAuthorization?`: (`parameters`) => `Promise`\<`SignAuthorizationReturnType`\>; `signMessage`: (`__namedParameters`) => `Promise`\<`` `0x${string}` ``\>; `signTransaction`: \<`serializer`, `transaction`\>(`transaction`, `options?`) => `Promise`\<`` `0x${string}` ``\>; `signTypedData`: \<`typedData`, `primaryType`\>(`parameters`) => `Promise`\<`` `0x${string}` ``\>; `source`: `string`; `type`: `"local"`; \} |
| `parameters.owner.address` | `` `0x${string}` `` |
| `parameters.owner.nonceManager?` | `NonceManager` |
| `parameters.owner.publicKey` | `` `0x${string}` `` |
| `parameters.owner.sign?` | (`parameters`) => `Promise`\<`` `0x${string}` ``\> |
| `parameters.owner.signAuthorization?` | (`parameters`) => `Promise`\<`SignAuthorizationReturnType`\> |
| `parameters.owner.signMessage` | (`__namedParameters`) => `Promise`\<`` `0x${string}` ``\> |
| `parameters.owner.signTransaction` | \<`serializer`, `transaction`\>(`transaction`, `options?`) => `Promise`\<`` `0x${string}` ``\> |
| `parameters.owner.signTypedData` | \<`typedData`, `primaryType`\>(`parameters`) => `Promise`\<`` `0x${string}` ``\> |
| `parameters.owner.source` | `string` |
| `parameters.owner.type` | `"local"` |
| `parameters.salt?` | `bigint` |

#### Returns

`Promise`\<[`SimpleSmartAccount`](#simplesmartaccount)\>
