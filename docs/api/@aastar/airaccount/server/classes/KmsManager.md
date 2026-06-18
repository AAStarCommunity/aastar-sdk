Defined in: [packages/airaccount/src/server/services/kms-signer.ts:310](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L310)

KMS service for remote key management with WebAuthn/Passkey integration.

Targets the AAStar TEE KMS (v0.20.0, kms.aastar.io). WebAuthn registration /
authentication ceremonies are handled by the KMS directly; signing operations
require a Passkey assertion (Legacy hex) or a one-time WebAuthn ceremony.

Wraps a shared [KmsHttpClient](KmsHttpClient.md); the composed services (agent / session /
payment / monitor) reuse the same client via [KmsManager.httpClient](#httpclient).

## Constructors

### Constructor

> **new KmsManager**(`options`): `KmsManager`

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:314](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L314)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | \{ `kmsApiKey?`: `string`; `kmsEnabled?`: `boolean`; `kmsEndpoint?`: `string`; `logger?`: [`ILogger`](../interfaces/ILogger.md); \} |
| `options.kmsApiKey?` | `string` |
| `options.kmsEnabled?` | `boolean` |
| `options.kmsEndpoint?` | `string` |
| `options.logger?` | [`ILogger`](../interfaces/ILogger.md) |

#### Returns

`KmsManager`

## Properties

### logger

> `readonly` **logger**: [`ILogger`](../interfaces/ILogger.md)

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:312](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L312)

## Accessors

### httpClient

#### Get Signature

> **get** **httpClient**(): [`KmsHttpClient`](KmsHttpClient.md)

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:329](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L329)

Shared HTTP transport — pass to KmsAgentService / KmsSessionService / etc.

##### Returns

[`KmsHttpClient`](KmsHttpClient.md)

## Methods

### beginAuthentication()

> **beginAuthentication**(`params`): `Promise`\<[`KmsBeginAuthenticationResponse`](../interfaces/KmsBeginAuthenticationResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:729](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L729)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsBeginAuthenticationRequest`](../interfaces/KmsBeginAuthenticationRequest.md) |

#### Returns

`Promise`\<[`KmsBeginAuthenticationResponse`](../interfaces/KmsBeginAuthenticationResponse.md)\>

***

### beginGrantSessionAuth()

> **beginGrantSessionAuth**(`params`): `Promise`\<[`KmsBeginGrantSessionAuthResponse`](../interfaces/KmsBeginGrantSessionAuthResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:564](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L564)

Begin a grant-session WebAuthn challenge.
The returned challengeId can ONLY be used with sign-grant-session, not sign-typed-data.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsBeginGrantSessionAuthRequest`](../interfaces/KmsBeginGrantSessionAuthRequest.md) |

#### Returns

`Promise`\<[`KmsBeginGrantSessionAuthResponse`](../interfaces/KmsBeginGrantSessionAuthResponse.md)\>

***

### beginRegistration()

> **beginRegistration**(`params`): `Promise`\<[`KmsBeginRegistrationResponse`](../interfaces/KmsBeginRegistrationResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:713](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L713)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsBeginRegistrationRequest`](../interfaces/KmsBeginRegistrationRequest.md) |

#### Returns

`Promise`\<[`KmsBeginRegistrationResponse`](../interfaces/KmsBeginRegistrationResponse.md)\>

***

### beginWebAuthnAuth()

> **beginWebAuthnAuth**(`keyId`): `Promise`\<[`KmsBeginAuthenticationResponse`](../interfaces/KmsBeginAuthenticationResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:745](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L745)

Begin a generic WebAuthn authentication ceremony for a key, returning a
challenge usable for SignHash / SignTypedData (purpose="authentication").

NOTE: there is no dedicated `begin-webauthn-auth` endpoint — this delegates
to `POST /BeginAuthentication`. (Grant-session signing needs a purpose-bound
challenge from [beginGrantSessionAuth](#begingrantsessionauth) instead.)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `keyId` | `string` |

#### Returns

`Promise`\<[`KmsBeginAuthenticationResponse`](../interfaces/KmsBeginAuthenticationResponse.md)\>

***

### changePasskey()

> **changePasskey**(`params`): `Promise`\<[`KmsChangePasskeyResponse`](../interfaces/KmsChangePasskeyResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:431](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L431)

Rotate the WebAuthn passkey bound to a key (WebAuthn-gated, RPMB-bound).
`PasskeyPublicKey` is the NEW P-256 public key (0x04… 65-byte uncompressed).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `KeyId`: `string`; `Passkey?`: [`LegacyPasskeyAssertion`](../interfaces/LegacyPasskeyAssertion.md); `PasskeyPublicKey`: `string`; `WebAuthn?`: [`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md); \} |
| `params.KeyId` | `string` |
| `params.Passkey?` | [`LegacyPasskeyAssertion`](../interfaces/LegacyPasskeyAssertion.md) |
| `params.PasskeyPublicKey` | `string` |
| `params.WebAuthn?` | [`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md) |

#### Returns

`Promise`\<[`KmsChangePasskeyResponse`](../interfaces/KmsChangePasskeyResponse.md)\>

***

### completeRegistration()

> **completeRegistration**(`params`): `Promise`\<[`KmsCompleteRegistrationResponse`](../interfaces/KmsCompleteRegistrationResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:721](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L721)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsCompleteRegistrationRequest`](../interfaces/KmsCompleteRegistrationRequest.md) |

#### Returns

`Promise`\<[`KmsCompleteRegistrationResponse`](../interfaces/KmsCompleteRegistrationResponse.md)\>

***

### createKey()

> **createKey**(`description`, `passkeyPublicKey`): `Promise`\<[`KmsCreateKeyResponse`](../interfaces/KmsCreateKeyResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:344](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L344)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `description` | `string` |
| `passkeyPublicKey` | `string` |

#### Returns

`Promise`\<[`KmsCreateKeyResponse`](../interfaces/KmsCreateKeyResponse.md)\>

***

### createKmsSigner()

> **createKmsSigner**(`keyId`, `address`, `assertionProvider`): [`KmsSigner`](KmsSigner.md)

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:753](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L753)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `keyId` | `string` |
| `address` | `string` |
| `assertionProvider` | () => `Promise`\<[`LegacyPasskeyAssertion`](../interfaces/LegacyPasskeyAssertion.md)\> |

#### Returns

[`KmsSigner`](KmsSigner.md)

***

### deleteKey()

> **deleteKey**(`params`): `Promise`\<[`KmsDeleteKeyResponse`](../interfaces/KmsDeleteKeyResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:400](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L400)

Schedule key deletion (AWS-KMS action ScheduleKeyDeletion; WebAuthn-gated).
RPMB-bound on the TEE — requires a passkey/WebAuthn assertion on the normal path.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `KeyId`: `string`; `Passkey?`: [`LegacyPasskeyAssertion`](../interfaces/LegacyPasskeyAssertion.md); `PendingWindowInDays?`: `number`; `WebAuthn?`: [`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md); \} |
| `params.KeyId` | `string` |
| `params.Passkey?` | [`LegacyPasskeyAssertion`](../interfaces/LegacyPasskeyAssertion.md) |
| `params.PendingWindowInDays?` | `number` |
| `params.WebAuthn?` | [`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md) |

#### Returns

`Promise`\<[`KmsDeleteKeyResponse`](../interfaces/KmsDeleteKeyResponse.md)\>

***

### deriveAddress()

> **deriveAddress**(`params`): `Promise`\<[`KmsDeriveAddressResponse`](../interfaces/KmsDeriveAddressResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:380](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L380)

Derive an Ethereum address at a BIP-44 path (WebAuthn-gated).
Provide a WebAuthn ceremony assertion (preferred) or a Legacy passkey assertion.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `DerivationPath`: `string`; `KeyId`: `string`; `Passkey?`: [`LegacyPasskeyAssertion`](../interfaces/LegacyPasskeyAssertion.md); `WebAuthn?`: [`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md); \} |
| `params.DerivationPath` | `string` |
| `params.KeyId` | `string` |
| `params.Passkey?` | [`LegacyPasskeyAssertion`](../interfaces/LegacyPasskeyAssertion.md) |
| `params.WebAuthn?` | [`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md) |

#### Returns

`Promise`\<[`KmsDeriveAddressResponse`](../interfaces/KmsDeriveAddressResponse.md)\>

***

### deriveAddressWithCeremony()

> **deriveAddressWithCeremony**(`params`, `signer`, `options?`): `Promise`\<[`KmsDeriveAddressResponse`](../interfaces/KmsDeriveAddressResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:636](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L636)

Derive an address, running the challenge-binding ceremony internally.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `DerivationPath`: `string`; `KeyId`: `string`; \} |
| `params.DerivationPath` | `string` |
| `params.KeyId` | `string` |
| `signer?` | [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md) |
| `options?` | `Omit`\<[`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md), `"signer"`\> |

#### Returns

`Promise`\<[`KmsDeriveAddressResponse`](../interfaces/KmsDeriveAddressResponse.md)\>

***

### describeKey()

> **describeKey**(`keyId`): `Promise`\<[`KmsDescribeKeyResponse`](../interfaces/KmsDescribeKeyResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:364](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L364)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `keyId` | `string` |

#### Returns

`Promise`\<[`KmsDescribeKeyResponse`](../interfaces/KmsDescribeKeyResponse.md)\>

***

### getKeyStatus()

> **getKeyStatus**(`keyId`): `Promise`\<[`KmsKeyStatusResponse`](../interfaces/KmsKeyStatusResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:356](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L356)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `keyId` | `string` |

#### Returns

`Promise`\<[`KmsKeyStatusResponse`](../interfaces/KmsKeyStatusResponse.md)\>

***

### getPublicKey()

> **getPublicKey**(`target`): `Promise`\<[`KmsGetPublicKeyResponse`](../interfaces/KmsGetPublicKeyResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:371](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L371)

Get a key's public key (uncompressed). Not WebAuthn-gated.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `target` | \{ `Address?`: `string`; `KeyId?`: `string`; \} |
| `target.Address?` | `string` |
| `target.KeyId?` | `string` |

#### Returns

`Promise`\<[`KmsGetPublicKeyResponse`](../interfaces/KmsGetPublicKeyResponse.md)\>

***

### isKmsEnabled()

> **isKmsEnabled**(): `boolean`

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:324](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L324)

#### Returns

`boolean`

***

### listKeys()

> **listKeys**(`params`): `Promise`\<[`KmsListKeysResponse`](../interfaces/KmsListKeysResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:391](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L391)

List keys (paginated). Not WebAuthn-gated.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `Limit?`: `number`; `Marker?`: `string`; \} |
| `params.Limit?` | `number` |
| `params.Marker?` | `string` |

#### Returns

`Promise`\<[`KmsListKeysResponse`](../interfaces/KmsListKeysResponse.md)\>

***

### pollUntilReady()

> **pollUntilReady**(`keyId`, `timeoutMs`, `intervalMs`): `Promise`\<[`KmsKeyStatusResponse`](../interfaces/KmsKeyStatusResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:455](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L455)

Poll KeyStatus until the key is ready (address derived) or timeout.
STM32 key derivation takes 60-75 seconds on first creation.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `keyId` | `string` | `undefined` |
| `timeoutMs` | `number` | `120_000` |
| `intervalMs` | `number` | `3_000` |

#### Returns

`Promise`\<[`KmsKeyStatusResponse`](../interfaces/KmsKeyStatusResponse.md)\>

***

### runAuthenticationCeremony()

> **runAuthenticationCeremony**(`keyId`, `signer`, `options?`): `Promise`\<[`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:612](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L612)

Run a generic authentication ceremony (purpose="authentication") bound to a
fresh TA challenge. The returned assertion is valid for DeriveAddress / Sign
/ SignHash / SignTypedData / agent-key / p256-session signing.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `keyId` | `string` |
| `signer` | [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md) |
| `options?` | `Omit`\<[`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md), `"signer"`\> |

#### Returns

`Promise`\<[`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md)\>

***

### runGrantSessionCeremony()

> **runGrantSessionCeremony**(`keyId`, `signer`, `options?`): `Promise`\<[`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:626](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L626)

Run a grant-session ceremony (purpose="grant-session") bound to a fresh TA
challenge — required by [signGrantSession](#signgrantsession) / [signP256GrantSession](#signp256grantsession)
(the generic 'authentication' challenge is rejected there for replay safety).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `keyId` | `string` |
| `signer` | [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md) |
| `options?` | `Omit`\<[`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md), `"signer"`\> |

#### Returns

`Promise`\<[`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md)\>

***

### sign()

> **sign**(`params`): `Promise`\<[`KmsSignResponse`](../interfaces/KmsSignResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:446](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L446)

Sign a message or an EIP-155 transaction (WebAuthn-gated).
Provide exactly one of `Message` (hex) or `Transaction`. For a raw 32-byte
digest use [signHash](#signhash) / [signHashWithWebAuthn](#signhashwithwebauthn) instead.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsSignRequest`](../interfaces/KmsSignRequest.md) |

#### Returns

`Promise`\<[`KmsSignResponse`](../interfaces/KmsSignResponse.md)\>

***

### signGrantSession()

> **signGrantSession**(`params`): `Promise`\<[`KmsSignGrantSessionResponse`](../interfaces/KmsSignGrantSessionResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:578](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L578)

Sign a GRANT_SESSION_V2 hash off-chain inside the TEE (secp256k1 session key).
Returns a 65-byte signature (R||S||V, V=27/28) for use in grantSessionWithSig().

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsSignGrantSessionRequest`](../interfaces/KmsSignGrantSessionRequest.md) |

#### Returns

`Promise`\<[`KmsSignGrantSessionResponse`](../interfaces/KmsSignGrantSessionResponse.md)\>

***

### signGrantSessionWithCeremony()

> **signGrantSessionWithCeremony**(`params`, `signer`, `options?`): `Promise`\<[`KmsSignGrantSessionResponse`](../interfaces/KmsSignGrantSessionResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:687](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L687)

Sign a GRANT_SESSION_V2 hash, running the grant-session ceremony internally
(uses the purpose-bound `begin-grant-session-auth` challenge).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | `Omit`\<[`KmsSignGrantSessionRequest`](../interfaces/KmsSignGrantSessionRequest.md), `"webAuthnAssertion"`\> |
| `signer` | [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md) |
| `options?` | `Omit`\<[`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md), `"signer"`\> |

#### Returns

`Promise`\<[`KmsSignGrantSessionResponse`](../interfaces/KmsSignGrantSessionResponse.md)\>

***

### signHash()

> **signHash**(`hash`, `assertion`, `target`): `Promise`\<[`KmsSignHashResponse`](../interfaces/KmsSignHashResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:486](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L486)

Sign a hash using Legacy Passkey assertion (reusable for BLS dual-signing).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `hash` | `string` |
| `assertion` | [`LegacyPasskeyAssertion`](../interfaces/LegacyPasskeyAssertion.md) |
| `target` | \{ `Address?`: `string`; `KeyId?`: `string`; \} |
| `target.Address?` | `string` |
| `target.KeyId?` | `string` |

#### Returns

`Promise`\<[`KmsSignHashResponse`](../interfaces/KmsSignHashResponse.md)\>

***

### signHashWithCeremony()

> **signHashWithCeremony**(`hash`, `target`, `signer`, `options?`): `Promise`\<[`KmsSignHashResponse`](../interfaces/KmsSignHashResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:661](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L661)

Sign a 32-byte digest, running the challenge-binding ceremony internally.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `hash` | `string` |
| `target` | \{ `KeyId`: `string`; \} |
| `target.KeyId` | `string` |
| `signer` | [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md) |
| `options?` | `Omit`\<[`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md), `"signer"`\> |

#### Returns

`Promise`\<[`KmsSignHashResponse`](../interfaces/KmsSignHashResponse.md)\>

***

### signHashWithWebAuthn()

> **signHashWithWebAuthn**(`hash`, `challengeId`, `credential`, `target`): `Promise`\<[`KmsSignHashResponse`](../interfaces/KmsSignHashResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:513](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L513)

Sign a hash using a WebAuthn ceremony assertion (one-time use).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `hash` | `string` |
| `challengeId` | `string` |
| `credential` | `unknown` |
| `target` | \{ `Address?`: `string`; `KeyId?`: `string`; \} |
| `target.Address?` | `string` |
| `target.KeyId?` | `string` |

#### Returns

`Promise`\<[`KmsSignHashResponse`](../interfaces/KmsSignHashResponse.md)\>

***

### signP256GrantSession()

> **signP256GrantSession**(`params`): `Promise`\<[`KmsSignGrantSessionResponse`](../interfaces/KmsSignGrantSessionResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:590](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L590)

Sign a GRANT_P256_SESSION_V2 hash off-chain inside the TEE (P256 session key).
Returns a 65-byte signature for use in grantP256SessionWithSig().

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsSignP256GrantSessionRequest`](../interfaces/KmsSignP256GrantSessionRequest.md) |

#### Returns

`Promise`\<[`KmsSignGrantSessionResponse`](../interfaces/KmsSignGrantSessionResponse.md)\>

***

### signP256GrantSessionWithCeremony()

> **signP256GrantSessionWithCeremony**(`params`, `signer`, `options?`): `Promise`\<[`KmsSignGrantSessionResponse`](../interfaces/KmsSignGrantSessionResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:701](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L701)

Sign a GRANT_P256_SESSION_V2 hash, running the grant-session ceremony
internally (uses the purpose-bound `begin-grant-session-auth` challenge).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | `Omit`\<[`KmsSignP256GrantSessionRequest`](../interfaces/KmsSignP256GrantSessionRequest.md), `"webAuthnAssertion"`\> |
| `signer` | [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md) |
| `options?` | `Omit`\<[`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md), `"signer"`\> |

#### Returns

`Promise`\<[`KmsSignGrantSessionResponse`](../interfaces/KmsSignGrantSessionResponse.md)\>

***

### signTypedDataWithCeremony()

> **signTypedDataWithCeremony**(`params`, `signer`, `options?`): `Promise`\<[`KmsSignTypedDataResponse`](../interfaces/KmsSignTypedDataResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:673](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L673)

Sign EIP-712 typed data, running the challenge-binding ceremony internally.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | `Omit`\<[`KmsSignTypedDataRequest`](../interfaces/KmsSignTypedDataRequest.md), `"webAuthnAssertion"`\> |
| `signer` | [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md) |
| `options?` | `Omit`\<[`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md), `"signer"`\> |

#### Returns

`Promise`\<[`KmsSignTypedDataResponse`](../interfaces/KmsSignTypedDataResponse.md)\>

***

### signTypedDataWithWebAuthn()

> **signTypedDataWithWebAuthn**(`params`): `Promise`\<[`KmsSignTypedDataResponse`](../interfaces/KmsSignTypedDataResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:550](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L550)

Sign arbitrary EIP-712 typed data via `POST /kms/SignTypedData` (v0.20.0).

The KMS hashes the typed data host-side, so the FULL EIP-712 structure
(domain / primaryType / types / message) is sent — not a pre-hashed
domainSeparator/structHash. The `webAuthnAssertion` challenge comes from a
generic [beginAuthentication](#beginauthentication) ceremony (purpose="authentication").

Alternatively, agents authenticate with a Bearer JWT — see KmsAgentService.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsSignTypedDataRequest`](../interfaces/KmsSignTypedDataRequest.md) |

#### Returns

`Promise`\<[`KmsSignTypedDataResponse`](../interfaces/KmsSignTypedDataResponse.md)\>

***

### signWithCeremony()

> **signWithCeremony**(`params`, `signer`, `options?`): `Promise`\<[`KmsSignResponse`](../interfaces/KmsSignResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:650](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L650)

Sign a message or EIP-155 transaction, running the challenge-binding ceremony
internally. `params.KeyId` is required (it identifies the wallet to challenge).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | `Omit`\<[`KmsSignRequest`](../interfaces/KmsSignRequest.md), `"Passkey"` \| `"WebAuthn"`\> & `object` |
| `signer` | [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md) |
| `options?` | `Omit`\<[`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md), `"signer"`\> |

#### Returns

`Promise`\<[`KmsSignResponse`](../interfaces/KmsSignResponse.md)\>

***

### unfreezeKey()

> **unfreezeKey**(`params`): `Promise`\<`KmsUnfreezeKeyResponse`\>

Defined in: [packages/airaccount/src/server/services/kms-signer.ts:419](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/kms-signer.ts#L419)

Unfreeze a dormant (frozen) key (issue #42; WebAuthn-gated).
A key auto-frozen by the dormant-key sweep rejects signing until unfrozen.
The TEE verifies the owner via the same strict WebAuthn ceremony as
[deleteKey](#deletekey); ownership is checked even when the key is already active,
so this cannot be used as an unauthenticated key-state probe. Unlike DeleteKey
this endpoint takes no `x-amz-target` header — it authenticates via the default
API key plus the WebAuthn assertion in the body.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `KeyId`: `string`; `WebAuthn?`: [`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md); \} |
| `params.KeyId` | `string` |
| `params.WebAuthn?` | [`WebAuthnAssertion`](../interfaces/WebAuthnAssertion.md) |

#### Returns

`Promise`\<`KmsUnfreezeKeyResponse`\>
