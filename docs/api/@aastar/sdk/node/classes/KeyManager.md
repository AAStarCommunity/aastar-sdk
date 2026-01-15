Defined in: [packages/sdk/src/utils/keys.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/keys.ts#L26)

密钥管理器
提供密钥生成、存储、加载等工具函数

## Constructors

### Constructor

```ts
new KeyManager(): KeyManager;
```

#### Returns

`KeyManager`

## Methods

### generateKeyPair()

```ts
static generateKeyPair(name): KeyPair;
```

Defined in: [packages/sdk/src/utils/keys.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/keys.ts#L31)

生成单个密钥对

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `name` | `string` | 密钥名称（如 'Jason', 'Anni'） |

#### Returns

[`KeyPair`](../interfaces/KeyPair.md)

***

### generateKeyPairs()

```ts
static generateKeyPairs(names): KeyPair[];
```

Defined in: [packages/sdk/src/utils/keys.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/keys.ts#L45)

批量生成密钥对

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `names` | `string`[] | 密钥名称数组 |

#### Returns

[`KeyPair`](../interfaces/KeyPair.md)[]

***

### generateMultiple()

```ts
static generateMultiple(count, prefix): KeyPair[];
```

Defined in: [packages/sdk/src/utils/keys.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/keys.ts#L54)

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

```ts
static loadFromEnvFile(filePath): KeyPair[];
```

Defined in: [packages/sdk/src/utils/keys.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/keys.ts#L83)

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

```ts
static loadFromJsonFile(filePath): KeyPair[];
```

Defined in: [packages/sdk/src/utils/keys.ts:133](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/keys.ts#L133)

从 JSON 文件加载密钥

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `filePath` | `string` | 文件路径（绝对路径） |

#### Returns

[`KeyPair`](../interfaces/KeyPair.md)[]

***

### printKeys()

```ts
static printKeys(keys, showPrivateKey): void;
```

Defined in: [packages/sdk/src/utils/keys.ts:152](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/keys.ts#L152)

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

```ts
static saveToEnvFile(
   filePath, 
   keys, 
   overwrite): void;
```

Defined in: [packages/sdk/src/utils/keys.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/keys.ts#L65)

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

```ts
static saveToJsonFile(
   filePath, 
   keys, 
   overwrite): void;
```

Defined in: [packages/sdk/src/utils/keys.ts:111](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/keys.ts#L111)

保存密钥到 JSON 文件（包含地址信息）

#### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `filePath` | `string` | `undefined` | 文件路径（绝对路径） |
| `keys` | [`KeyPair`](../interfaces/KeyPair.md)[] | `undefined` | 密钥对数组 |
| `overwrite` | `boolean` | `false` | 是否覆盖已存在的文件（默认 false） |

#### Returns

`void`
