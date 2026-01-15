```ts
function createEOAWalletClient(
   privateKey, 
   chain, 
   transport): EOAWalletClient;
```

Defined in: [packages/account/src/eoa.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/account/src/eoa.ts#L9)

## Parameters

| Parameter | Type |
| ------ | ------ |
| `privateKey` | `` `0x${string}` `` |
| `chain` | [`Chain`](https://viem.sh/docs/) |
| `transport` | [`Transport`](https://viem.sh/docs/) |

## Returns

[`EOAWalletClient`](../type-aliases/EOAWalletClient.md)
