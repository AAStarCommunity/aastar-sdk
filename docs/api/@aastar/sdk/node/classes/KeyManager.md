Defined in: [packages/sdk/src/utils/keys.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/utils/keys.ts#L26)

密钥管理器
提供密钥生成、存储、加载等工具函数

## Constructors

### Constructor

> **new KeyManager**(): `KeyManager`

#### Returns

`KeyManager`

## Methods

### generateKeyPair()

> `static` **generateKeyPair**(`name`): [`KeyPair`](../interfaces/KeyPair.md)

Defined in: [packages/sdk/src/utils/keys.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/utils/keys.ts#L31)

生成单个密钥对

#### Parameters

##### name

`string`

密钥名称（如 'Jason', 'Anni'）

#### Returns

[`KeyPair`](../interfaces/KeyPair.md)

***

### generateKeyPairs()

> `static` **generateKeyPairs**(`names`): [`KeyPair`](../interfaces/KeyPair.md)[]

Defined in: [packages/sdk/src/utils/keys.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/utils/keys.ts#L45)

批量生成密钥对

#### Parameters

##### names

`string`[]

密钥名称数组

#### Returns

[`KeyPair`](../interfaces/KeyPair.md)[]

***

### generateMultiple()

> `static` **generateMultiple**(`count`, `prefix`): [`KeyPair`](../interfaces/KeyPair.md)[]

Defined in: [packages/sdk/src/utils/keys.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/utils/keys.ts#L54)

生成指定数量的密钥对（自动命名为 Operator_1, Operator_2, ...）

#### Parameters

##### count

`number`

数量

##### prefix

`string` = `'Operator'`

名称前缀（默认 'Operator'）

#### Returns

[`KeyPair`](../interfaces/KeyPair.md)[]

***

### loadFromEnvFile()

> `static` **loadFromEnvFile**(`filePath`): [`KeyPair`](../interfaces/KeyPair.md)[]

Defined in: [packages/sdk/src/utils/keys.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/utils/keys.ts#L83)

从 .env 文件加载密钥

#### Parameters

##### filePath

`string`

文件路径（绝对路径）

#### Returns

[`KeyPair`](../interfaces/KeyPair.md)[]

密钥对数组

***

### loadFromJsonFile()

> `static` **loadFromJsonFile**(`filePath`): [`KeyPair`](../interfaces/KeyPair.md)[]

Defined in: [packages/sdk/src/utils/keys.ts:133](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/utils/keys.ts#L133)

从 JSON 文件加载密钥

#### Parameters

##### filePath

`string`

文件路径（绝对路径）

#### Returns

[`KeyPair`](../interfaces/KeyPair.md)[]

***

### printKeys()

> `static` **printKeys**(`keys`, `showPrivateKey`): `void`

Defined in: [packages/sdk/src/utils/keys.ts:152](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/utils/keys.ts#L152)

打印密钥信息（隐藏私钥）

#### Parameters

##### keys

[`KeyPair`](../interfaces/KeyPair.md)[]

密钥对数组

##### showPrivateKey

`boolean` = `false`

#### Returns

`void`

***

### saveToEnvFile()

> `static` **saveToEnvFile**(`filePath`, `keys`, `overwrite`): `void`

Defined in: [packages/sdk/src/utils/keys.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/utils/keys.ts#L65)

保存密钥到 .env 文件

#### Parameters

##### filePath

`string`

文件路径（绝对路径）

##### keys

[`KeyPair`](../interfaces/KeyPair.md)[]

密钥对数组

##### overwrite

`boolean` = `false`

是否覆盖已存在的文件（默认 false）

#### Returns

`void`

***

### saveToJsonFile()

> `static` **saveToJsonFile**(`filePath`, `keys`, `overwrite`): `void`

Defined in: [packages/sdk/src/utils/keys.ts:111](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/utils/keys.ts#L111)

保存密钥到 JSON 文件（包含地址信息）

#### Parameters

##### filePath

`string`

文件路径（绝对路径）

##### keys

[`KeyPair`](../interfaces/KeyPair.md)[]

密钥对数组

##### overwrite

`boolean` = `false`

是否覆盖已存在的文件（默认 false）

#### Returns

`void`
