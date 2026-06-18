> **packP256SessionSignature**(`account`, `keyX`, `keyY`, `signature`): `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:486](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/session-key-service.ts#L486)

Pack a P256 session key signature into the 149-byte UserOp.signature format.

Layout: [0x08][account(20)][keyX(32)][keyY(32)][r(32)][s(32)]

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `account` | `string` | The AirAccount address (20 bytes) |
| `keyX` | `string` | P256 public key X coordinate (32 bytes hex, without 0x) |
| `keyY` | `string` | P256 public key Y coordinate (32 bytes hex, without 0x) |
| `signature` | `string` | 64-byte hex signature from KMS sign-p256-grant-session (R||S, no V) |

## Returns

`string`

149-byte hex string (0x-prefixed) suitable as UserOp.signature
