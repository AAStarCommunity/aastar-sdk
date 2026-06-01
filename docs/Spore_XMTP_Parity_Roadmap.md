# Spore Protocol — XMTP Parity Roadmap & Test Gap Analysis

> Generated: 2026-03-27
> Current: M1–M4 complete (91 unit tests)
> Goal: Full XMTP v3 protocol/capability parity + Nostr decentralization layer

---

## Part 1 — XMTP v3 Capability Gap Analysis

### What XMTP v3 provides (full API surface)

| Category | XMTP v3 API | Spore Status | Gap |
|----------|-------------|--------------|-----|
| **Identity** | `Client.create(signer, {env})` | ✅ `SporeAgent.create(config)` | — |
| | `Client.createFromEnv()` | ✅ `SporeAgent.createFromEnv()` | — |
| | `client.inboxId` | ❌ | No inbox ID concept |
| | `client.installationId` | ❌ | No multi-device |
| | `client.accountAddress` | ✅ `agent.address` | — |
| | `client.canMessage(addresses)` | ❌ | No identity registry |
| **DMs** | `client.conversations.newDm(address)` | Partial (`sendDm` sends but no conv object) | No Conversation object returned |
| | `dm.send(content)` | ✅ `ctx.sendText()` | — |
| | `dm.messages(opts)` | ❌ | No history API |
| | `dm.stream()` | ❌ | No per-conversation stream |
| **Groups** | `client.conversations.newGroup(addrs)` | ❌ | No group creation API |
| | `group.addMembers(addrs)` | ❌ | No member management |
| | `group.removeMembers(addrs)` | ❌ | No member management |
| | `group.members()` | ❌ | No member query |
| | `group.updateName(name)` | ❌ | No metadata update |
| | `group.updateImageUrl(url)` | ❌ | No metadata update |
| | `group.addAdmin(inboxId)` | ❌ | No permission roles |
| | `group.removeAdmin(inboxId)` | ❌ | No permission roles |
| **Listing** | `client.conversations.list()` | ❌ | No conversation enumeration |
| | `client.conversations.sync()` | ❌ | No network sync |
| **Streaming** | `conversations.streamAllMessages()` | Partial (internal subs only) | No public stream API |
| | `conversation.streamMessages()` | ❌ | No per-conv streaming |
| **Content Types** | `ContentTypeText` | ✅ (hardcoded) | No codec system |
| | `ContentTypeReaction` | ❌ | Not implemented |
| | `ContentTypeReply` | ❌ | Not implemented |
| | `ContentTypeAttachment` | ❌ | Not implemented |
| | `ContentTypeRemoteAttachment` | ❌ | Not implemented |
| | `client.registerCodec(codec)` | ❌ | No codec registry |
| **Consent** | `client.contacts.allow(addrs)` | Partial (local only) | Not synced on-network |
| | `client.contacts.deny(addrs)` | Partial (local only) | Not synced on-network |
| | `client.contacts.isAllowed(addr)` | ✅ (via `allowedSenders`) | — |
| | `client.contacts.inboxState()` | ❌ | No inbox state sync |
| **Preferences** | `client.preferences.syncConsent()` | ❌ | No on-relay sync |
| | read receipts | ❌ | Not implemented |
| | typing indicators | ❌ | Not implemented |
| **Multi-wallet** | multiple accounts per inbox | ❌ | Single EOA only |
| | `client.addWallet(account)` | ❌ | Not implemented |
| **Protocol** | MLS key agreement (v3) | Different (NIP-44 per-message) | Spore uses Nostr crypto |
| | XMTP network nodes (permissioned) | Different (open Nostr relays) | Spore is decentralized |
| **Nostr extras** | Open relay network | ✅ | XMTP can't do this |
| | EIP-3009 pay-per-message | ✅ | XMTP can't do this |
| | State channel micro-payments | ✅ | XMTP can't do this |
| | Gasless UserOp triggering | ✅ | XMTP can't do this |
| | On-chain relay registry | ✅ (partial) | XMTP can't do this |

---

## Part 2 — Milestone Plan (M5 → M11)

### M5 — Conversations API & Message History
**ETA: 2 weeks | Goal: `client.conversations.list()` + `dm.messages()` parity**

Features:
- `agent.listConversations()` — query relays for all known DMs/groups for my pubkey
- `agent.getConversation(id)` — fetch conversation by ID
- `agent.getMessages(conversationId, opts: {limit?, before?, after?})` — message history from relay
- Public streaming API: `agent.streamMessages(conversationId, handler)` (wraps RelayPool subscription)
- `agent.streamAllMessages(handler)` — all-conversation stream (XMTP parity)
- E2E test: two-agent DM round-trip via in-process SporeRelayNode

Test TODOs for M5:
- [ ] `agent.listConversations()` — returns known convs from relay history
- [ ] `agent.getMessages(convId, {limit: 10})` — paginated history
- [ ] `agent.streamMessages(convId, handler)` — fires on new messages
- [ ] `agent.streamAllMessages(handler)` — fires for all conversations
- [ ] E2E: Agent A sends DM → Agent B receives it (in-process relay)
- [ ] E2E: Agent A sends, Agent B fetches history, gets the message

---

### M6 — Group Management Protocol
**ETA: 3 weeks | Goal: `group.addMembers()`, admin roles, metadata**

Features:
- `agent.createGroup(memberAddresses, opts: {name, imageUrl, description})` — creates NIP-29 group
- `group.addMembers(pubkeys)` — NIP-29 kind:9000 add-user events
- `group.removeMembers(pubkeys)` — NIP-29 kind:9001 remove-user events
- `group.members()` — query current membership from relay
- `group.updateName(name)` / `updateImageUrl(url)` — NIP-29 kind:39000 metadata
- Permission model: creator=super_admin, `group.addAdmin()`, `group.removeAdmin()`
- Key rotation on membership change (new members can't read old messages)

Test TODOs for M6:
- [ ] `createGroup()` emits correct NIP-29 events
- [ ] `addMembers()` / `removeMembers()` — relay sees kind:9000/9001
- [ ] `members()` returns accurate membership list
- [ ] Metadata update: name/imageUrl reflected in relay query
- [ ] Permission check: non-admin cannot call addMembers()
- [ ] E2E: three-agent group conversation round-trip

---

### M7 — Content Types & Codec Registry
**ETA: 2 weeks | Goal: reactions, replies, attachments + codec registration**

Features:
- `ContentTypeId` class: `{ authorityId, typeId, versionMajor, versionMinor }`
- `agent.registerCodec(codec)` — register custom codec
- Built-in codecs:
  - `TextCodec` — already works, add explicit ContentTypeId
  - `ReactionCodec` — emoji reactions (kind:7 or custom tag in kind:14)
  - `ReplyCodec` — threaded replies using `e` tag
  - `RemoteAttachmentCodec` — URL + content-type + size metadata
- `ctx.sendReaction(emoji)` uses ReactionCodec
- `ctx.sendReply(content)` uses ReplyCodec
- `MessageContext.contentType` becomes a full `ContentTypeId`

Test TODOs for M7:
- [ ] `agent.registerCodec()` — unknown content type decoded via codec
- [ ] `ReactionCodec` encode/decode round-trip
- [ ] `ReplyCodec` — referencedMessageId set correctly
- [ ] `RemoteAttachmentCodec` — URL + metadata preserved
- [ ] Unknown codec graceful fallback (raw content returned)

---

### M8 — Identity Resolution & `canMessage()`
**ETA: 2 weeks | Goal: ETH address → Nostr pubkey mapping**

Features:
- `SporeIdentityRegistry.sol` — maps ETH address → Nostr pubkey (OP-Sepolia)
- `agent.register()` — write caller's address → pubkey mapping on-chain
- `agent.canMessage(ethAddress)` — check if address has registered Nostr pubkey
- `agent.resolveAddress(ethAddress)` → Nostr pubkey or null
- On-network consent sync: NIP-51 kind:10000 (mute list) / kind:30000 (follow set) as consent store

Test TODOs for M8:
- [ ] `SporeIdentityRegistry` ABI functions (unit, with viem mock)
- [ ] `canMessage()` returns false for unregistered address
- [ ] `canMessage()` returns true after `agent.register()`
- [ ] `resolveAddress()` returns correct Nostr pubkey
- [ ] On-network consent: allow/deny synced via NIP-51 event
- [ ] E2E: register on Anvil fork → canMessage() roundtrip

---

### M9 — Multi-device & Multi-wallet
**ETA: 3 weeks | Goal: multiple devices sharing one identity**

Features:
- Pre-key bundle infrastructure (NIP-46 style or custom kind for device registration)
- `agent.addDevice(devicePrivkeyHex)` — link new device
- `agent.listDevices()` — all registered devices for this identity
- Multi-device message sync: fetch all unread events addressed to any device pubkey
- `agent.addWallet(ethAddress, sig)` — link additional ETH addresses to same Nostr identity
- Message forwarding: messages to any linked wallet reach all devices

Test TODOs for M9:
- [ ] Device registration event published with correct kind
- [ ] Second device can decrypt messages sent to first device's pubkey
- [ ] `listDevices()` returns all linked devices
- [ ] Multiple wallet addresses route to same inbox
- [ ] Device revocation: revoked device can no longer decrypt

---

### M10 — Contract Deployment & On-chain Infrastructure
**ETA: 3 weeks | Goal: real on-chain settlement, production registry**

Contracts to deploy:
- `SporeRelayRegistry.sol` → OP-Sepolia + Optimism mainnet
- `SporeIdentityRegistry.sol` → OP-Sepolia + Optimism mainnet
- `ChannelManager.sol` → state channel settlement with timelock

Features:
- Real `SettlementClientLike` implementation for `SporeRelayOperator`
- `SporeRelayNode` + registry auto-registration on startup
- Deployment scripts + verification (Etherscan/Blockscout)
- Production relay hardening: auth, rate limiting, DDoS protection

Test TODOs for M10:
- [ ] `RelayRegistryClient.register()` — unit test with viem mock
- [ ] `RelayRegistryClient.getActiveRelays()` — unit test with mock
- [ ] `RelayRegistryClient.deactivate()` — unit test
- [ ] E2E on Anvil: deploy SporeRelayRegistry → register → getActiveRelays
- [ ] E2E on Anvil: X402 payment commitment → settlePayment() on-chain
- [ ] E2E on Anvil: channel open → voucher → close (ChannelManager.sol)
- [ ] spore-relay bin integration test: start → SIGTERM → settleNow() called
- [ ] Deployment script: verify all contracts on OP-Sepolia

---

### M11 — Full XMTP v3 Parity & SDK v1.0
**ETA: 4 weeks | Goal: xmtp-compat covers 100% of XMTP v3 API**

Features:
- `xmtp-compat.ts` covers all XMTP v3 methods (see gap table above)
- `conversations.sync()` — trigger relay sync for all conversations
- Read receipts (NIP-25 / custom kind:9735 or tagged kind:1)
- Typing indicators (ephemeral kind:24133)
- XMTP network bridge option: connect to XMTP production as fallback relay
- Migration guide: XMTP v3 → Spore Protocol (zero code changes via compat shim)
- SDK v1.0 release with semver stability guarantees

Test TODOs for M11:
- [ ] All xmtp-compat exports present and typed correctly
- [ ] `conversations.list()` returns both DMs and groups
- [ ] `conversations.sync()` triggers relay fetch
- [ ] Read receipt: sender receives kind:9735 after recipient reads
- [ ] Typing indicator: ephemeral event round-trip
- [ ] Full XMTP v3 migration smoke test (example bot)

---

## Part 3 — Current Test Gap Analysis (M1–M4)

### Missing Unit Tests (add to existing test files)

#### packages/messaging

| Module | Missing Tests | Priority |
|--------|--------------|----------|
| `transport/NostrTransport.ts` | `sendDm()` — verify gift wrap layer structure (kind:1059→13→14) | HIGH |
| | `subscribeToDms()` — event arrives → handler called | HIGH |
| | `unwrapDm()` — NIP-17 three-layer unwrap: wrap→seal→rumor | HIGH |
| | `decodeGroupEvent()` — kind:11 → SporeMessage | MEDIUM |
| | `sendGroupMessage()` — correct kind/tags | MEDIUM |
| `payment/NonceStore.ts` | `InMemoryNonceStore.claim()` — same key twice returns false | HIGH |
| | `InMemoryNonceStore.has()` + `add()` basic flow | MEDIUM |
| | `InMemoryVoucherStore.getBest/setBest/deleteBest/getSettled/setSettled/getAllPending` | MEDIUM |
| `relay/RelayPool.ts` | `subscribeMany()` — multiple filters, single closer | MEDIUM |
| | `fetchEvents()` — one-shot query returns deduplicated events | MEDIUM |
| | `wss:// enforcement` — throws on ws:// without allowInsecure | HIGH |
| | `BoundedSet eviction` — at 10k+1 entries, oldest 25% evicted | HIGH |
| `events/SporeEventTypes.ts` | `parseTagsToObject()` — basic parsing | LOW |
| | `validateX402Tags()` — all required fields present/missing | MEDIUM |

#### packages/message-relay

| Module | Missing Tests | Priority |
|--------|--------------|----------|
| `strfry/StrfryPlugin.ts` | `runStrfryPlugin()` — valid event → accept | HIGH |
| | — kind:23405 without payment → reject | HIGH |
| | — strictMode: any event without payment → reject | HIGH |
| | — `onClose` callback called when stdin closes | HIGH |
| `registry/RelayRegistryClient.ts` | `register()` — mock viem simulateContract + writeContract | MEDIUM |
| | `getActiveRelays()` — mock readContract response | MEDIUM |
| | `update()` / `deactivate()` | LOW |
| `SporeRelayNode.ts` | `maxEventsPerSecond: 0` disables rate limiting | MEDIUM |
| | Multiple clients — one rate-limited, others unaffected | HIGH |
| | `stop()` — all subscriptions cleaned up | MEDIUM |

### Missing E2E Tests (new file: tests/e2e/)

| Test | Description | Priority |
|------|-------------|----------|
| `two-agent-dm.e2e.ts` | Agent A sends DM → in-process relay → Agent B receives | CRITICAL |
| `two-agent-group.e2e.ts` | Three agents in a group, all receive messages | HIGH |
| `payment-x402.e2e.ts` | X402 payment commitment → X402Bridge → mock settlement | HIGH |
| `channel-lifecycle.e2e.ts` | Open channel → 5 vouchers → forceSettleAll | HIGH |
| `rate-limit-burst.e2e.ts` | Real relay + 50 events/s → first 20 accepted, rest rate-limited | MEDIUM |
| `nonce-persistence.e2e.ts` | Relay restart → persistent NonceStore → replay blocked | MEDIUM |
| `userop-bridge.e2e.ts` | UserOp trigger → authorizationSig verified → mock bundler called | MEDIUM |
| `relay-registry.e2e.ts` | Anvil fork → deploy registry → register → query | LOW |

---

## Part 4 — Immediate TODO (next session)

### T1 — NostrTransport unit tests (HIGH priority)
File: `packages/messaging/src/__tests__/NostrTransport.test.ts` (new)
- Mock RelayPool, mock nostr-tools finalizeEvent
- Test sendDm: verify 3 publish calls (rumor→seal→wrap), correct kinds
- Test unwrapDm: mock decrypt → verify SporeMessage fields
- Test decodeGroupEvent: kind:11 with h/p tags → SporeMessage

### T2 — NonceStore & VoucherStore unit tests
Add to: `packages/messaging/src/__tests__/bridges.test.ts`
- InMemoryNonceStore: claim() idempotency, has()+add() order
- InMemoryVoucherStore: full CRUD + getAllPending()

### T3 — StrfryPlugin unit tests (HIGH priority)
File: `packages/message-relay/src/__tests__/StrfryPlugin.test.ts` (new)
- Mock readline with Readable stream
- Test accept/reject/strictMode scenarios
- Test onClose injection

### T4 — RelayPool wss enforcement & BoundedSet tests
Add to: `packages/messaging/src/__tests__/SporeAgent.test.ts`
- RelayPool throws on ws:// without allowInsecure
- BoundedSet: insert 10001 items, verify size ≤ 10000

### T5 — E2E two-agent DM test
File: `packages/messaging/src/__tests__/e2e.test.ts` (new)
- Spin up SporeRelayNode in-process (port 19000)
- Create two SporeAgent instances pointing at that relay
- Agent A sends DM to Agent B, Agent B's handler fires

---

## Summary Timeline

| Milestone | Focus | ETA from now |
|-----------|-------|-------------|
| Test gaps T1–T5 | Complete M1–M4 test coverage | 1 week |
| M5 | Conversations + history API | +2 weeks |
| M6 | Group management | +3 weeks |
| M7 | Content types + codecs | +2 weeks |
| M8 | Identity registry + canMessage | +2 weeks |
| M9 | Multi-device + multi-wallet | +3 weeks |
| M10 | Contract deployment + on-chain | +3 weeks |
| M11 | Full XMTP parity + v1.0 | +4 weeks |
| **Total** | **Full parity** | **~5 months** |

The Nostr decentralization advantage (open relay network, pay-per-message, state channels, gasless UserOps) is already unique to Spore and has no XMTP equivalent. These are preserved throughout all milestones.
