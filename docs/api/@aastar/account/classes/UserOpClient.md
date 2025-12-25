Defined in: [packages/account/src/index.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/401447c149b116a7176de09bdf973a40913dd2f1/packages/account/src/index.ts#L40)

UserOperation Client for handling high-level flows

## Constructors

### Constructor

> **new UserOpClient**(): `UserOpClient`

#### Returns

`UserOpClient`

## Methods

### estimateGas()

> `static` **estimateGas**(`bundler`, `op`, `entryPoint`): `Promise`\<`any`\>

Defined in: [packages/account/src/index.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/401447c149b116a7176de09bdf973a40913dd2f1/packages/account/src/index.ts#L41)

#### Parameters

##### bundler

`any`

##### op

`any`

##### entryPoint

`` `0x${string}` ``

#### Returns

`Promise`\<`any`\>

***

### getReceipt()

> `static` **getReceipt**(`bundler`, `hash`): `Promise`\<`any`\>

Defined in: [packages/account/src/index.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/401447c149b116a7176de09bdf973a40913dd2f1/packages/account/src/index.ts#L55)

#### Parameters

##### bundler

`any`

##### hash

`` `0x${string}` ``

#### Returns

`Promise`\<`any`\>

***

### sendUserOp()

> `static` **sendUserOp**(`bundler`, `op`, `entryPoint`): `Promise`\<`any`\>

Defined in: [packages/account/src/index.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/401447c149b116a7176de09bdf973a40913dd2f1/packages/account/src/index.ts#L48)

#### Parameters

##### bundler

`any`

##### op

`any`

##### entryPoint

`` `0x${string}` ``

#### Returns

`Promise`\<`any`\>
