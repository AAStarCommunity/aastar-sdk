Defined in: [packages/core/src/actions/StateValidator.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/StateValidator.ts#L44)

## Constructors

### Constructor

> **new StateValidator**(): `StateValidator`

#### Returns

`StateValidator`

## Methods

### getAccountBalances()

> `static` **getAccountBalances**(`params`): `Promise`\<[`AccountBalance`](../interfaces/AccountBalance.md)[]\>

Defined in: [packages/core/src/actions/StateValidator.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/StateValidator.ts#L58)

Batch fetch balances for multiple accounts

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `addresses`: `` `0x${string}` ``[]; `aPNTsAddress?`: `` `0x${string}` ``; `chain`: [`Chain`](https://viem.sh/docs/index.html); `gTokenAddress?`: `` `0x${string}` ``; `rpcUrl`: `string`; `xPNTsAddress?`: `` `0x${string}` ``; \} |
| `params.addresses` | `` `0x${string}` ``[] |
| `params.aPNTsAddress?` | `` `0x${string}` `` |
| `params.chain` | [`Chain`](https://viem.sh/docs/index.html) |
| `params.gTokenAddress?` | `` `0x${string}` `` |
| `params.rpcUrl` | `string` |
| `params.xPNTsAddress?` | `` `0x${string}` `` |

#### Returns

`Promise`\<[`AccountBalance`](../interfaces/AccountBalance.md)[]\>

***

### validateDeployment()

> `static` **validateDeployment**(`params`): `Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

Defined in: [packages/core/src/actions/StateValidator.ts:232](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/StateValidator.ts#L232)

Deployment Validation

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`DeploymentValidationParams`](../interfaces/DeploymentValidationParams.md) |

#### Returns

`Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

***

### validateETHBalance()

> `static` **validateETHBalance**(`params`): `Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

Defined in: [packages/core/src/actions/StateValidator.ts:153](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/StateValidator.ts#L153)

ETH Balance Validation

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`BalanceValidationParams`](../interfaces/BalanceValidationParams.md) |

#### Returns

`Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

***

### validateRole()

> `static` **validateRole**(`params`): `Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

Defined in: [packages/core/src/actions/StateValidator.ts:114](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/StateValidator.ts#L114)

Role Validation

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`RoleValidationParams`](../interfaces/RoleValidationParams.md) |

#### Returns

`Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

***

### validateTokenBalance()

> `static` **validateTokenBalance**(`params`): `Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

Defined in: [packages/core/src/actions/StateValidator.ts:189](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/StateValidator.ts#L189)

Token Balance Validation

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`TokenBalanceValidationParams`](../interfaces/TokenBalanceValidationParams.md) |

#### Returns

`Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>
