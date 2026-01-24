Defined in: [SuperPaymaster/index.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/SuperPaymaster/index.ts#L95)

Admin Client for SuperPaymaster V3

## Constructors

### Constructor

> **new SuperPaymasterAdminClient**(`client`, `paymasterAddress`): `SuperPaymasterAdminClient`

Defined in: [SuperPaymaster/index.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/SuperPaymaster/index.ts#L99)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `any` |
| `paymasterAddress` | `` `0x${string}` `` |

#### Returns

`SuperPaymasterAdminClient`

## Methods

### getOperator()

> **getOperator**(`operator`): `Promise`\<`any`\>

Defined in: [SuperPaymaster/index.ts:104](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/SuperPaymaster/index.ts#L104)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `operator` | `` `0x${string}` `` |

#### Returns

`Promise`\<`any`\>

***

### configureOperator()

> `static` **configureOperator**(`wallet`, `paymaster`, `token`, `treasury`, `exchangeRate`): `Promise`\<`any`\>

Defined in: [SuperPaymaster/index.ts:113](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/SuperPaymaster/index.ts#L113)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `paymaster` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |
| `treasury` | `` `0x${string}` `` |
| `exchangeRate` | `bigint` |

#### Returns

`Promise`\<`any`\>

***

### setAPNTsToken()

> `static` **setAPNTsToken**(`wallet`, `paymaster`, `token`): `Promise`\<`any`\>

Defined in: [SuperPaymaster/index.ts:149](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/SuperPaymaster/index.ts#L149)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `paymaster` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |

#### Returns

`Promise`\<`any`\>

***

### setOperatorPaused()

> `static` **setOperatorPaused**(`wallet`, `paymaster`, `operator`, `paused`): `Promise`\<`any`\>

Defined in: [SuperPaymaster/index.ts:129](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/SuperPaymaster/index.ts#L129)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `paymaster` | `` `0x${string}` `` |
| `operator` | `` `0x${string}` `` |
| `paused` | `boolean` |

#### Returns

`Promise`\<`any`\>

***

### setXPNTsFactory()

> `static` **setXPNTsFactory**(`wallet`, `paymaster`, `factory`): `Promise`\<`any`\>

Defined in: [SuperPaymaster/index.ts:159](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/SuperPaymaster/index.ts#L159)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `paymaster` | `` `0x${string}` `` |
| `factory` | `` `0x${string}` `` |

#### Returns

`Promise`\<`any`\>

***

### updateReputation()

> `static` **updateReputation**(`wallet`, `paymaster`, `operator`, `score`): `Promise`\<`any`\>

Defined in: [SuperPaymaster/index.ts:139](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/SuperPaymaster/index.ts#L139)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `paymaster` | `` `0x${string}` `` |
| `operator` | `` `0x${string}` `` |
| `score` | `bigint` |

#### Returns

`Promise`\<`any`\>
