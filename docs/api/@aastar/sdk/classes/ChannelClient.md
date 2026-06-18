Defined in: [packages/channel/src/ChannelClient.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/channel/src/ChannelClient.ts#L13)

## Constructors

### Constructor

> **new ChannelClient**(`config`): `ChannelClient`

Defined in: [packages/channel/src/ChannelClient.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/channel/src/ChannelClient.ts#L18)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`ChannelClientConfig`](../type-aliases/ChannelClientConfig.md) |

#### Returns

`ChannelClient`

## Methods

### closeChannel()

> **closeChannel**(`voucher`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/channel/src/ChannelClient.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/channel/src/ChannelClient.ts#L59)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `voucher` | [`SignedVoucher`](../type-aliases/SignedVoucher.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### getChannelState()

> **getChannelState**(`channelId`): `Promise`\<[`ChannelState`](../type-aliases/ChannelState.md)\>

Defined in: [packages/channel/src/ChannelClient.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/channel/src/ChannelClient.ts#L90)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `channelId` | `` `0x${string}` `` |

#### Returns

`Promise`\<[`ChannelState`](../type-aliases/ChannelState.md)\>

***

### getCloseTimeout()

> **getCloseTimeout**(): `Promise`\<`bigint`\>

Defined in: [packages/channel/src/ChannelClient.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/channel/src/ChannelClient.ts#L94)

#### Returns

`Promise`\<`bigint`\>

***

### getVersion()

> **getVersion**(): `Promise`\<`string`\>

Defined in: [packages/channel/src/ChannelClient.ts:98](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/channel/src/ChannelClient.ts#L98)

#### Returns

`Promise`\<`string`\>

***

### openChannel()

> **openChannel**(`channelConfig`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/channel/src/ChannelClient.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/channel/src/ChannelClient.ts#L28)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `channelConfig` | [`ChannelConfig`](../type-aliases/ChannelConfig.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### requestClose()

> **requestClose**(`channelId`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/channel/src/ChannelClient.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/channel/src/ChannelClient.ts#L76)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `channelId` | `` `0x${string}` `` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### settleChannel()

> **settleChannel**(`voucher`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/channel/src/ChannelClient.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/channel/src/ChannelClient.ts#L50)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `voucher` | [`SignedVoucher`](../type-aliases/SignedVoucher.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### signVoucherOffline()

> **signVoucherOffline**(`channelId`, `cumulativeAmount`): `Promise`\<[`SignedVoucher`](../type-aliases/SignedVoucher.md)\>

Defined in: [packages/channel/src/ChannelClient.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/channel/src/ChannelClient.ts#L39)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `channelId` | `` `0x${string}` `` |
| `cumulativeAmount` | `bigint` |

#### Returns

`Promise`\<[`SignedVoucher`](../type-aliases/SignedVoucher.md)\>

***

### topUpChannel()

> **topUpChannel**(`channelId`, `amount`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/channel/src/ChannelClient.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/channel/src/ChannelClient.ts#L68)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `channelId` | `` `0x${string}` `` |
| `amount` | `bigint` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### withdraw()

> **withdraw**(`channelId`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/channel/src/ChannelClient.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/channel/src/ChannelClient.ts#L83)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `channelId` | `` `0x${string}` `` |

#### Returns

`Promise`\<`` `0x${string}` ``\>
