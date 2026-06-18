> `const` **DEFAULT\_CREDENTIAL\_ID**: `"dGVzdC1jcmVkZW50aWFs"` = `"dGVzdC1jcmVkZW50aWFs"`

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/webauthn-ceremony.ts#L41)

Placeholder credential id (base64url of "test-credential") matching the
reference ceremony fixtures. Production callers SHOULD pass the credential id
returned by CompleteRegistration for the registered passkey.
