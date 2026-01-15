Defined in: [V4/SuperPaymasterClient.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/paymaster/src/V4/SuperPaymasterClient.ts#L20)

SuperPaymasterClient
High-level API for SuperPaymaster operations, including dynamic gas estimation.

## Constructors

### Constructor

```ts
new SuperPaymasterClient(): SuperPaymasterClient;
```

#### Returns

`SuperPaymasterClient`

## Methods

### submitGaslessTransaction()

```ts
static submitGaslessTransaction(
   client, 
   wallet, 
   aaAddress, 
   entryPoint, 
   bundlerUrl, 
config): Promise<`0x${string}`>;
```

Defined in: [V4/SuperPaymasterClient.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/paymaster/src/V4/SuperPaymasterClient.ts#L26)

Submit a gasless transaction using SuperPaymaster.
Automatically handles gas estimation with a smart efficiency buffer.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `any` |
| `wallet` | `any` |
| `aaAddress` | `` `0x${string}` `` |
| `entryPoint` | `` `0x${string}` `` |
| `bundlerUrl` | `string` |
| `config` | [`GaslessTransactionConfig`](../type-aliases/GaslessTransactionConfig.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>
