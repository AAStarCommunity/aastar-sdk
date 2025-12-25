> **RegistryActions** = `object`

Defined in: [packages/core/src/actions/registry.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/02429a724df6d1db083144e00515cd09857c0075/packages/core/src/actions/registry.ts#L17)

## Properties

### configureRole()

> **configureRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/02429a724df6d1db083144e00515cd09857c0075/packages/core/src/actions/registry.ts#L18)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### config

[`RoleConfig`](RoleConfig.md)

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getCreditLimit()

> **getCreditLimit**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/02429a724df6d1db083144e00515cd09857c0075/packages/core/src/actions/registry.ts#L23)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getGlobalReputation()

> **getGlobalReputation**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/registry.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/02429a724df6d1db083144e00515cd09857c0075/packages/core/src/actions/registry.ts#L24)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getRoleConfig()

> **getRoleConfig**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/registry.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/02429a724df6d1db083144e00515cd09857c0075/packages/core/src/actions/registry.ts#L25)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`any`\>

***

### hasRole()

> **hasRole**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/registry.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/02429a724df6d1db083144e00515cd09857c0075/packages/core/src/actions/registry.ts#L21)

#### Parameters

##### args

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### registerRole()

> **registerRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/02429a724df6d1db083144e00515cd09857c0075/packages/core/src/actions/registry.ts#L19)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### data

[`Hex`](https://viem.sh/docs/index.html)

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### registerRoleSelf()

> **registerRoleSelf**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/02429a724df6d1db083144e00515cd09857c0075/packages/core/src/actions/registry.ts#L20)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### data

[`Hex`](https://viem.sh/docs/index.html)

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### unRegisterRole()

> **unRegisterRole**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/registry.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/02429a724df6d1db083144e00515cd09857c0075/packages/core/src/actions/registry.ts#L22)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
