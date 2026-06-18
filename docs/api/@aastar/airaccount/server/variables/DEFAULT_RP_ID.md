> `const` **DEFAULT\_RP\_ID**: `"aastar.io"` = `"aastar.io"`

Defined in: [packages/airaccount/src/server/services/webauthn-ceremony.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/webauthn-ceremony.ts#L31)

RP id the TA verifies against. The TA hardcodes
`EXPECTED_RP_ID_HASH = SHA-256("aastar.io")` (AirAccount PR#44 / Issue #39);
any other rpId makes the TA reject the assertion with "rpId hash mismatch".
