```ts
function getTestAccounts(network): object;
```

Defined in: [packages/core/src/contracts.ts:248](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L248)

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
| `simpleAccountFactory` | `` `0x${string}` `` | [packages/core/src/contract-addresses.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contract-addresses.ts#L71) |

## Example

```ts
const testAccounts = getTestAccounts('sepolia');
console.log(testAccounts.simpleAccountFactory);
```
