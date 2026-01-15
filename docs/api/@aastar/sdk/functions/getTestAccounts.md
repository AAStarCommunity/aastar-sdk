```ts
function getTestAccounts(network): object;
```

Defined in: [packages/core/src/contracts.ts:248](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/contracts.ts#L248)

Get test account contracts (SimpleAccountFactory, etc.)

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |

## Returns

`object`

Test account contract addresses

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `simpleAccountFactory` | `` `0x${string}` `` | [packages/core/src/contract-addresses.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/core/src/contract-addresses.ts#L71) |

## Example

```ts
const testAccounts = getTestAccounts('sepolia');
console.log(testAccounts.simpleAccountFactory);
```
