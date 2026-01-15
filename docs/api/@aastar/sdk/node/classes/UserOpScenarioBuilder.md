Defined in: [packages/sdk/src/utils/testScenarios.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/utils/testScenarios.ts#L30)

## Constructors

### Constructor

```ts
new UserOpScenarioBuilder(): UserOpScenarioBuilder;
```

#### Returns

`UserOpScenarioBuilder`

## Methods

### buildTransferScenario()

```ts
static buildTransferScenario(type, params): Promise<{
  opHash: `0x${string}`;
  userOp: any;
}>;
```

Defined in: [packages/sdk/src/utils/testScenarios.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/utils/testScenarios.ts#L34)

Builds a signed PackedUserOperation for a token transfer based on the specified scenario.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `type` | [`UserOpScenarioType`](../enumerations/UserOpScenarioType.md) |
| `params` | [`ScenarioParams`](../interfaces/ScenarioParams.md) |

#### Returns

`Promise`\<\{
  `opHash`: `` `0x${string}` ``;
  `userOp`: `any`;
\}\>
