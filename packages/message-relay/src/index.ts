// @aastar/relay — Spore Protocol Relay Node
// Public API exports

export { SporeRelayNode } from './SporeRelayNode.js';
export { SporeRelayOperator } from './SporeRelayOperator.js';
export { PaymentValidator } from './middleware/PaymentValidator.js';
export { SqliteEventStore } from './storage/SqliteEventStore.js';
export { RelayRegistryClient } from './registry/RelayRegistryClient.js';
export { runStrfryPlugin } from './strfry/StrfryPlugin.js';

export type { NostrEvent, EventFilter, EventStore } from './storage/EventStore.js';
export type { SporeRelayConfig } from './SporeRelayNode.js';
export type { ValidatorConfig, PaymentCommitment } from './middleware/PaymentValidator.js';
export type { PendingVoucher, PendingStats } from './SporeRelayOperator.js';
export type { RelayInfo, RegisterParams } from './registry/RelayRegistryClient.js';
