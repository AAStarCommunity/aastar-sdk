/**
 * Browser-safe AirAccount surface (no Node-only signer code): tiered-transfer decisions
 * (`resolveTransfer`), tier profiles + config encoders (`TIER_PROFILES`, `encodeSetTierLimits`,
 * `modifyTierLimitsGuardianDigest`), out-of-band confirmation polling (`pollDvtConfirmation`),
 * BLS/passkey helpers, and the AirAccount client. Use this in a frontend (#189/#176 — the new tiering
 * APIs need a browser-safe entry). For the Node-only DVT signer surface, use `@aastar/sdk/kms`.
 */
export * from '@aastar/airaccount';
