Defined in: [V4/SuperPaymasterClient.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/paymaster/src/V4/SuperPaymasterClient.ts#L20)

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

Defined in: [V4/SuperPaymasterClient.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/paymaster/src/V4/SuperPaymasterClient.ts#L26)

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
