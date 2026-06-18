Defined in: [packages/paymaster/src/SuperPaymaster/index.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/SuperPaymaster/index.ts#L95)

Admin Client for SuperPaymaster V3

## Constructors

### Constructor

> **new SuperPaymasterAdminClient**(`client`, `paymasterAddress`): `SuperPaymasterAdminClient`

Defined in: [packages/paymaster/src/SuperPaymaster/index.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/SuperPaymaster/index.ts#L99)

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

Defined in: [packages/paymaster/src/SuperPaymaster/index.ts:104](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/SuperPaymaster/index.ts#L104)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `operator` | `` `0x${string}` `` |

#### Returns

`Promise`\<`any`\>

***

### configureOperator()

> `static` **configureOperator**(`wallet`, `paymaster`, `token`, `treasury`): `Promise`\<`any`\>

Defined in: [packages/paymaster/src/SuperPaymaster/index.ts:113](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/SuperPaymaster/index.ts#L113)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `paymaster` | `` `0x${string}` `` |
| `token` | `` `0x${string}` `` |
| `treasury` | `` `0x${string}` `` |

#### Returns

`Promise`\<`any`\>

***

### setAPNTsToken()

> `static` **setAPNTsToken**(`wallet`, `paymaster`, `token`): `Promise`\<`any`\>

Defined in: [packages/paymaster/src/SuperPaymaster/index.ts:148](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/SuperPaymaster/index.ts#L148)

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

Defined in: [packages/paymaster/src/SuperPaymaster/index.ts:128](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/SuperPaymaster/index.ts#L128)

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

Defined in: [packages/paymaster/src/SuperPaymaster/index.ts:158](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/SuperPaymaster/index.ts#L158)

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

Defined in: [packages/paymaster/src/SuperPaymaster/index.ts:138](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/SuperPaymaster/index.ts#L138)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | `any` |
| `paymaster` | `` `0x${string}` `` |
| `operator` | `` `0x${string}` `` |
| `score` | `bigint` |

#### Returns

`Promise`\<`any`\>
