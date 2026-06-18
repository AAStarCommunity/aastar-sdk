> **ChannelActions** = `object`

Defined in: [packages/core/src/actions/channel.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L17)

## Properties

### ~~CLOSE\_TIMEOUT()~~

> **CLOSE\_TIMEOUT**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/channel.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L49)

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

The deployed MicroPaymentChannel ABI no longer exposes a `CLOSE_TIMEOUT`
constant — it was replaced by the configurable [closeTimeout](#closetimeout) getter plus the
[MIN\_CLOSE\_TIMEOUT](#min_close_timeout)/[MAX\_CLOSE\_TIMEOUT](#max_close_timeout) bounds. This wrapper now delegates
to the on-chain `closeTimeout()` getter so it no longer reverts; use [closeTimeout](#closetimeout).

***

### closeChannel()

> **closeChannel**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/channel.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L27)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `channelId`: [`Hex`](https://viem.sh/docs/index.html); `cumulativeAmount`: `bigint`; `signature`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.channelId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.cumulativeAmount` | `bigint` |
| `args.signature` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### closedChannels()

> **closedChannels**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/channel.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L55)

Whether a given channelId has already been closed (view). ABI: closedChannels(bytes32) -> bool.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `channelId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.channelId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`boolean`\>

***

### closeTimeout()

> **closeTimeout**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/channel.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L51)

Current configurable close-timeout (seconds, view). ABI: closeTimeout() -> uint64.

#### Returns

`Promise`\<`bigint`\>

***

### getChannel()

> **getChannel**: (`args`) => `Promise`\<[`ChannelState`](ChannelState.md)\>

Defined in: [packages/core/src/actions/channel.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L42)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `channelId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.channelId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`ChannelState`](ChannelState.md)\>

***

### MAX\_CLOSE\_TIMEOUT()

> **MAX\_CLOSE\_TIMEOUT**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/channel.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L57)

Upper bound for [setCloseTimeout](#setclosetimeout) (view). ABI: MAX_CLOSE_TIMEOUT() -> uint64.

#### Returns

`Promise`\<`bigint`\>

***

### MIN\_CLOSE\_TIMEOUT()

> **MIN\_CLOSE\_TIMEOUT**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/channel.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L59)

Lower bound for [setCloseTimeout](#setclosetimeout) (view). ABI: MIN_CLOSE_TIMEOUT() -> uint64.

#### Returns

`Promise`\<`bigint`\>

***

### openChannel()

> **openChannel**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/channel.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `authorizedSigner`: `Address`; `deposit`: `bigint`; `payee`: `Address`; `salt`: [`Hex`](https://viem.sh/docs/index.html); `token`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.authorizedSigner` | `Address` |
| `args.deposit` | `bigint` |
| `args.payee` | `Address` |
| `args.salt` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.token` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### requestCloseChannel()

> **requestCloseChannel**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/channel.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L34)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `channelId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.channelId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setCloseTimeout()

> **setCloseTimeout**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/channel.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L53)

Set the configurable close-timeout window (owner-gated). ABI: setCloseTimeout(uint64 _timeout).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `timeout`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.timeout` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### settleChannel()

> **settleChannel**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/channel.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L23)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `channelId`: [`Hex`](https://viem.sh/docs/index.html); `cumulativeAmount`: `bigint`; `signature`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.channelId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.cumulativeAmount` | `bigint` |
| `args.signature` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### topUpChannel()

> **topUpChannel**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/channel.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L31)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `channelId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.channelId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/channel.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L61)

#### Returns

`Promise`\<`string`\>

***

### VOUCHER\_TYPEHASH()

> **VOUCHER\_TYPEHASH**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/channel.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L60)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### withdrawChannel()

> **withdrawChannel**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/channel.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/channel.ts#L37)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `channelId`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.channelId` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
