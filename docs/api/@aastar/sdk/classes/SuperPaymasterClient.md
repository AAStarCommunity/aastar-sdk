Defined in: [packages/paymaster/src/V4/SuperPaymasterClient.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/SuperPaymasterClient.ts#L20)

SuperPaymasterClient
High-level API for SuperPaymaster operations, including dynamic gas estimation.

## Constructors

### Constructor

> **new SuperPaymasterClient**(): `SuperPaymasterClient`

#### Returns

`SuperPaymasterClient`

## Methods

### submitGaslessTransaction()

> `static` **submitGaslessTransaction**(`client`, `wallet`, `aaAddress`, `entryPoint`, `bundlerUrl`, `config`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/paymaster/src/V4/SuperPaymasterClient.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/SuperPaymasterClient.ts#L26)

Submit a gasless transaction using SuperPaymaster.
Automatically handles gas estimation with a smart efficiency buffer.

#### Parameters

##### client

`any`

##### wallet

`any`

##### aaAddress

`` `0x${string}` ``

##### entryPoint

`` `0x${string}` ``

##### bundlerUrl

`string`

##### config

[`GaslessTransactionConfig`](../type-aliases/GaslessTransactionConfig.md)

#### Returns

`Promise`\<`` `0x${string}` ``\>
