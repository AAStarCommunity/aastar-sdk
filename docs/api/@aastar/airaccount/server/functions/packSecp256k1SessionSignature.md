> **packSecp256k1SessionSignature**(`account`, `sessionKey`, `signature`): `string`

Defined in: [packages/airaccount/src/server/services/session-key-service.ts:455](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/session-key-service.ts#L455)

Pack a secp256k1 session key signature into the 106-byte UserOp.signature format.

Layout: [0x08][account(20)][sessionKey(20)][r(32)][s(32)][v(1)]

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `account` | `string` | The AirAccount address (20 bytes, with or without 0x) |
| `sessionKey` | `string` | The ephemeral EOA session key address (20 bytes) |
| `signature` | `string` | 65-byte hex signature from KMS sign-grant-session (R||S||V) |

## Returns

`string`

106-byte hex string (0x-prefixed) suitable as UserOp.signature
