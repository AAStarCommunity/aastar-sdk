Defined in: [packages/sdk/src/utils/keys.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/keys.ts#L19)

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

Defined in: [packages/sdk/src/utils/keys.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/keys.ts#L24)

生成单个密钥对

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `name` | `string` | 密钥名称（如 'Jason', 'Anni'） |

#### Returns

[`KeyPair`](../interfaces/KeyPair.md)

***

### generateKeyPairs()

> `static` **generateKeyPairs**(`names`): [`KeyPair`](../interfaces/KeyPair.md)[]

Defined in: [packages/sdk/src/utils/keys.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/keys.ts#L38)

批量生成密钥对

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `names` | `string`[] | 密钥名称数组 |

#### Returns

[`KeyPair`](../interfaces/KeyPair.md)[]

***

### generateMultiple()

> `static` **generateMultiple**(`count`, `prefix`): [`KeyPair`](../interfaces/KeyPair.md)[]

Defined in: [packages/sdk/src/utils/keys.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/keys.ts#L47)

生成指定数量的密钥对（自动命名为 Operator_1, Operator_2, ...）

#### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `count` | `number` | `undefined` | 数量 |
| `prefix` | `string` | `'Operator'` | 名称前缀（默认 'Operator'） |

#### Returns

[`KeyPair`](../interfaces/KeyPair.md)[]

***

### loadFromEnvFile()

> `static` **loadFromEnvFile**(`filePath`): [`KeyPair`](../interfaces/KeyPair.md)[]

Defined in: [packages/sdk/src/utils/keys.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/keys.ts#L76)

从 .env 文件加载密钥

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `filePath` | `string` | 文件路径（绝对路径） |

#### Returns

[`KeyPair`](../interfaces/KeyPair.md)[]

密钥对数组

***

### loadFromJsonFile()

> `static` **loadFromJsonFile**(`filePath`): [`KeyPair`](../interfaces/KeyPair.md)[]

Defined in: [packages/sdk/src/utils/keys.ts:126](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/keys.ts#L126)

从 JSON 文件加载密钥

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `filePath` | `string` | 文件路径（绝对路径） |

#### Returns

[`KeyPair`](../interfaces/KeyPair.md)[]

***

### printKeys()

> `static` **printKeys**(`keys`, `showPrivateKey`): `void`

Defined in: [packages/sdk/src/utils/keys.ts:145](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/keys.ts#L145)

打印密钥信息（隐藏私钥）

#### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `keys` | [`KeyPair`](../interfaces/KeyPair.md)[] | `undefined` | 密钥对数组 |
| `showPrivateKey` | `boolean` | `false` | - |

#### Returns

`void`

***

### saveToEnvFile()

> `static` **saveToEnvFile**(`filePath`, `keys`, `overwrite`): `void`

Defined in: [packages/sdk/src/utils/keys.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/keys.ts#L58)

保存密钥到 .env 文件

#### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `filePath` | `string` | `undefined` | 文件路径（绝对路径） |
| `keys` | [`KeyPair`](../interfaces/KeyPair.md)[] | `undefined` | 密钥对数组 |
| `overwrite` | `boolean` | `false` | 是否覆盖已存在的文件（默认 false） |

#### Returns

`void`

***

### saveToJsonFile()

> `static` **saveToJsonFile**(`filePath`, `keys`, `overwrite`): `void`

Defined in: [packages/sdk/src/utils/keys.ts:104](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/sdk/src/utils/keys.ts#L104)

保存密钥到 JSON 文件（包含地址信息）

#### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `filePath` | `string` | `undefined` | 文件路径（绝对路径） |
| `keys` | [`KeyPair`](../interfaces/KeyPair.md)[] | `undefined` | 密钥对数组 |
| `overwrite` | `boolean` | `false` | 是否覆盖已存在的文件（默认 false） |

#### Returns

`void`
