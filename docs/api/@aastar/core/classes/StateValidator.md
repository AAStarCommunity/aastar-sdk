Defined in: [packages/core/src/actions/StateValidator.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/StateValidator.ts#L44)

## Constructors

### Constructor

> **new StateValidator**(): `StateValidator`

#### Returns

`StateValidator`

## Methods

### getAccountBalances()

> `static` **getAccountBalances**(`params`): `Promise`\<[`AccountBalance`](../interfaces/AccountBalance.md)[]\>

Defined in: [packages/core/src/actions/StateValidator.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/StateValidator.ts#L58)

Batch fetch balances for multiple accounts

#### Parameters

##### params

###### addresses

`` `0x${string}` ``[]

###### aPNTsAddress?

`` `0x${string}` ``

###### chain

[`Chain`](https://viem.sh/docs/index.html)

###### gTokenAddress?

`` `0x${string}` ``

###### rpcUrl

`string`

###### xPNTsAddress?

`` `0x${string}` ``

#### Returns

`Promise`\<[`AccountBalance`](../interfaces/AccountBalance.md)[]\>

***

### validateDeployment()

> `static` **validateDeployment**(`params`): `Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

Defined in: [packages/core/src/actions/StateValidator.ts:232](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/StateValidator.ts#L232)

Deployment Validation

#### Parameters

##### params

[`DeploymentValidationParams`](../interfaces/DeploymentValidationParams.md)

#### Returns

`Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

***

### validateETHBalance()

> `static` **validateETHBalance**(`params`): `Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

Defined in: [packages/core/src/actions/StateValidator.ts:153](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/StateValidator.ts#L153)

ETH Balance Validation

#### Parameters

##### params

[`BalanceValidationParams`](../interfaces/BalanceValidationParams.md)

#### Returns

`Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

***

### validateRole()

> `static` **validateRole**(`params`): `Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

Defined in: [packages/core/src/actions/StateValidator.ts:114](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/StateValidator.ts#L114)

Role Validation

#### Parameters

##### params

[`RoleValidationParams`](../interfaces/RoleValidationParams.md)

#### Returns

`Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

***

### validateTokenBalance()

> `static` **validateTokenBalance**(`params`): `Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

Defined in: [packages/core/src/actions/StateValidator.ts:189](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/StateValidator.ts#L189)

Token Balance Validation

#### Parameters

##### params

[`TokenBalanceValidationParams`](../interfaces/TokenBalanceValidationParams.md)

#### Returns

`Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>
