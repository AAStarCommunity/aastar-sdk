> **BLSAlgorithmActions** = `object`

Defined in: [packages/core/src/actions/blsAlgorithm.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/blsAlgorithm.ts#L6)

## Properties

### validate()

> **validate**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/blsAlgorithm.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/blsAlgorithm.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `proof`: [`Hex`](https://viem.sh/docs/index.html); `userOpHash`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.proof` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.userOpHash` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`bigint`\>
