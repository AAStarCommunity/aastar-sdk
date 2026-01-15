```ts
function getContract(
   network, 
   category, 
   name): string;
```

Defined in: [packages/core/src/contracts.ts:151](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contracts.ts#L151)

Get a specific contract address

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |
| `category` | [`ContractCategory`](../type-aliases/ContractCategory.md) | Contract category |
| `name` | `string` | Contract name |

## Returns

`string`

Contract address

## Example

```ts
const address = getContract('sepolia', 'core', 'superPaymaster');
```
