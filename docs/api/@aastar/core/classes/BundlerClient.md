Defined in: [packages/core/src/clients/BundlerClient.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/clients/BundlerClient.ts#L31)

BundlerClient
Low-level JSON-RPC client for ERC-4337 Bundlers.

## Constructors

### Constructor

> **new BundlerClient**(`url`, `entryPoint`): `BundlerClient`

Defined in: [packages/core/src/clients/BundlerClient.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/clients/BundlerClient.ts#L32)

#### Parameters

##### url

`string`

##### entryPoint

`` `0x${string}` ``

#### Returns

`BundlerClient`

## Properties

### entryPoint

> `readonly` **entryPoint**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/BundlerClient.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/clients/BundlerClient.ts#L34)

***

### url

> `readonly` **url**: `string`

Defined in: [packages/core/src/clients/BundlerClient.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/clients/BundlerClient.ts#L33)

## Methods

### estimateUserOperationGas()

> **estimateUserOperationGas**(`userOp`): `Promise`\<`any`\>

Defined in: [packages/core/src/clients/BundlerClient.ts:115](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/clients/BundlerClient.ts#L115)

eth_estimateUserOperationGas

#### Parameters

##### userOp

`Partial`\<[`UserOperationV07`](../interfaces/UserOperationV07.md)\>

#### Returns

`Promise`\<`any`\>

***

### getUserOperationByHash()

> **getUserOperationByHash**(`hash`): `Promise`\<`any`\>

Defined in: [packages/core/src/clients/BundlerClient.ts:129](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/clients/BundlerClient.ts#L129)

eth_getUserOperationByHash

#### Parameters

##### hash

`` `0x${string}` ``

#### Returns

`Promise`\<`any`\>

***

### getUserOperationReceipt()

> **getUserOperationReceipt**(`hash`): `Promise`\<`any`\>

Defined in: [packages/core/src/clients/BundlerClient.ts:122](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/clients/BundlerClient.ts#L122)

eth_getUserOperationReceipt (v0.7 support prep)

#### Parameters

##### hash

`` `0x${string}` ``

#### Returns

`Promise`\<`any`\>

***

### sendUserOperation()

> **sendUserOperation**(`userOp`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/core/src/clients/BundlerClient.ts:108](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/clients/BundlerClient.ts#L108)

eth_sendUserOperation

#### Parameters

##### userOp

[`UserOperationV07`](../interfaces/UserOperationV07.md)

#### Returns

`Promise`\<`` `0x${string}` ``\>
