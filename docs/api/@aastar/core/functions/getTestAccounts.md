> **getTestAccounts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:248](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/contracts.ts#L248)

Get test account contracts (SimpleAccountFactory, etc.)

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |

## Returns

`object`

Test account contract addresses

### simpleAccountFactory

> `readonly` **simpleAccountFactory**: `` `0x${string}` ``

## Example

```ts
const testAccounts = getTestAccounts('sepolia');
console.log(testAccounts.simpleAccountFactory);
```
