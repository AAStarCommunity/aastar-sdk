Defined in: [packages/airaccount/src/auth/hardware/ledger.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/auth/hardware/ledger.ts#L31)

Ledger signer instance returned by connectLedger().

## Methods

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Defined in: [packages/airaccount/src/auth/hardware/ledger.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/auth/hardware/ledger.ts#L47)

Disconnect and release the WebHID device.

#### Returns

`Promise`\<`void`\>

***

### getAddress()

> **getAddress**(): `Promise`\<`string`\>

Defined in: [packages/airaccount/src/auth/hardware/ledger.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/auth/hardware/ledger.ts#L36)

Returns the account address for the configured derivation path.
Use this to verify the Ledger matches the expected account owner.

#### Returns

`Promise`\<`string`\>

***

### sign()

> **sign**(`userOpHash`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/airaccount/src/auth/hardware/ledger.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/auth/hardware/ledger.ts#L44)

Signs the UserOp hash and returns a 66-byte hex signature
formatted as [0x02][r(32)][s(32)][v(1)] for algId=0x02 (ECDSA).

Compatible with the `signer` field of AirAccountProviderConfig.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userOpHash` | `` `0x${string}` `` |

#### Returns

`Promise`\<`` `0x${string}` ``\>
