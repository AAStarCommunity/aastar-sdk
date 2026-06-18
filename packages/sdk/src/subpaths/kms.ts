// The rich KMS / AirAccount integration surface (KmsManager, SessionKeyService, RecoveryService,
// WeightedSignatureService, AgentRegistryService, P256PasskeySigner, …) lives in the server
// entry; the main entry adds the client/passkey/bls surface. Export both so consumers get the
// full KMS API via `@aastar/sdk/kms`.
export * from '@aastar/airaccount/server';
export * from '@aastar/airaccount';
