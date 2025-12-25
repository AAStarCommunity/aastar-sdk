Defined in: [packages/paymaster/src/AOA-Plus/index.ts:93](https://github.com/AAStarCommunity/aastar-sdk/blob/2bfec0a83e320e28501997c5fd5b6a5c22584cd8/packages/paymaster/src/AOA-Plus/index.ts#L93)

Admin Client for SuperPaymaster V3

## Constructors

### Constructor

> **new SuperPaymasterClient**(`client`, `paymasterAddress`): `SuperPaymasterClient`

Defined in: [packages/paymaster/src/AOA-Plus/index.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/2bfec0a83e320e28501997c5fd5b6a5c22584cd8/packages/paymaster/src/AOA-Plus/index.ts#L94)

#### Parameters

##### client

`any`

##### paymasterAddress

`` `0x${string}` ``

#### Returns

`SuperPaymasterClient`

## Methods

### getOperator()

> **getOperator**(`operator`): `Promise`\<`any`\>

Defined in: [packages/paymaster/src/AOA-Plus/index.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/2bfec0a83e320e28501997c5fd5b6a5c22584cd8/packages/paymaster/src/AOA-Plus/index.ts#L96)

#### Parameters

##### operator

`` `0x${string}` ``

#### Returns

`Promise`\<`any`\>

***

### configureOperator()

> `static` **configureOperator**(`wallet`, `paymaster`, `token`, `treasury`, `exchangeRate`): `Promise`\<`any`\>

Defined in: [packages/paymaster/src/AOA-Plus/index.ts:105](https://github.com/AAStarCommunity/aastar-sdk/blob/2bfec0a83e320e28501997c5fd5b6a5c22584cd8/packages/paymaster/src/AOA-Plus/index.ts#L105)

#### Parameters

##### wallet

`any`

##### paymaster

`` `0x${string}` ``

##### token

`` `0x${string}` ``

##### treasury

`` `0x${string}` ``

##### exchangeRate

`bigint`

#### Returns

`Promise`\<`any`\>

***

### setAPNTsToken()

> `static` **setAPNTsToken**(`wallet`, `paymaster`, `token`): `Promise`\<`any`\>

Defined in: [packages/paymaster/src/AOA-Plus/index.ts:141](https://github.com/AAStarCommunity/aastar-sdk/blob/2bfec0a83e320e28501997c5fd5b6a5c22584cd8/packages/paymaster/src/AOA-Plus/index.ts#L141)

#### Parameters

##### wallet

`any`

##### paymaster

`` `0x${string}` ``

##### token

`` `0x${string}` ``

#### Returns

`Promise`\<`any`\>

***

### setOperatorPaused()

> `static` **setOperatorPaused**(`wallet`, `paymaster`, `operator`, `paused`): `Promise`\<`any`\>

Defined in: [packages/paymaster/src/AOA-Plus/index.ts:121](https://github.com/AAStarCommunity/aastar-sdk/blob/2bfec0a83e320e28501997c5fd5b6a5c22584cd8/packages/paymaster/src/AOA-Plus/index.ts#L121)

#### Parameters

##### wallet

`any`

##### paymaster

`` `0x${string}` ``

##### operator

`` `0x${string}` ``

##### paused

`boolean`

#### Returns

`Promise`\<`any`\>

***

### updateReputation()

> `static` **updateReputation**(`wallet`, `paymaster`, `operator`, `score`): `Promise`\<`any`\>

Defined in: [packages/paymaster/src/AOA-Plus/index.ts:131](https://github.com/AAStarCommunity/aastar-sdk/blob/2bfec0a83e320e28501997c5fd5b6a5c22584cd8/packages/paymaster/src/AOA-Plus/index.ts#L131)

#### Parameters

##### wallet

`any`

##### paymaster

`` `0x${string}` ``

##### operator

`` `0x${string}` ``

##### score

`bigint`

#### Returns

`Promise`\<`any`\>
