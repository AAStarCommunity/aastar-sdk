// MainnetChecklist — automated pre-deployment hardening audit for Spore Protocol.
//
// Run this before deploying a SporeAgent to mainnet to verify that critical
// security settings are configured correctly.
//
// Usage:
//   const report = await runMainnetChecklist(agent, config);
//   if (!report.passed) {
//     console.error(report.summary());
//     process.exit(1);
//   }

import type { SporeAgent } from '../SporeAgent.js';

// ─── Check Types ──────────────────────────────────────────────────────────────

/** Severity of a failing check */
export type CheckSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Result of a single checklist item */
export interface CheckResult {
  id: string;
  name: string;
  severity: CheckSeverity;
  passed: boolean;
  message: string;
}

/** Full checklist report */
export interface ChecklistReport {
  /** True only if all CRITICAL and HIGH checks passed */
  passed: boolean;
  checks: CheckResult[];
  /** Number of failing CRITICAL checks */
  criticalFailures: number;
  /** Number of failing HIGH checks */
  highFailures: number;
  /** Human-readable summary of failures */
  summary(): string;
}

// ─── Config checked by the checklist ─────────────────────────────────────────

/**
 * Configuration state to audit. Pass the actual config values your agent
 * is running with so the checklist can inspect them.
 */
export interface MainnetChecklistInput {
  /** The running SporeAgent */
  agent: SporeAgent;
  /** Relay URLs the agent is connecting to */
  relayUrls: string[];
  /** Whether a rate limiter is configured */
  hasRateLimiter: boolean;
  /** Whether all bridges use a persistent NonceStore (not InMemoryNonceStore) */
  hasPersistentNonceStore: boolean;
  /** Whether ChannelBridge has verifyVoucherSig configured (not skipVoucherSigVerification) */
  hasVoucherSigVerifier: boolean;
  /** Whether the SporeHttpGateway (if deployed) has authToken set */
  gatewayHasAuthToken?: boolean;
  /** Whether the SporeHttpGateway requestTimeoutMs is ≤ 30000 */
  gatewayTimeoutMs?: number;
  /** X402Bridge maxValidBeforeWindowSeconds (if configured) */
  x402MaxValidBeforeWindowSeconds?: number;
  /** Whether UserOpBridge authMode is NOT 'open' */
  userOpAuthModeIsNotOpen?: boolean;
}

// ─── Checks ───────────────────────────────────────────────────────────────────

function check(
  id: string,
  name: string,
  severity: CheckSeverity,
  condition: boolean,
  failMessage: string,
  passMessage: string
): CheckResult {
  return { id, name, severity, passed: condition, message: condition ? passMessage : failMessage };
}

// ─── runMainnetChecklist ──────────────────────────────────────────────────────

/**
 * Run the mainnet hardening checklist against the provided configuration.
 *
 * @param input - Configuration state to audit
 * @returns ChecklistReport with per-check results and a summary
 *
 * @example
 * ```ts
 * const report = runMainnetChecklist({
 *   agent,
 *   relayUrls: agent.connectedRelays,
 *   hasRateLimiter: true,
 *   hasPersistentNonceStore: true,
 *   hasVoucherSigVerifier: true,
 *   gatewayHasAuthToken: true,
 *   userOpAuthModeIsNotOpen: true,
 * });
 * if (!report.passed) console.error(report.summary());
 * ```
 */
export function runMainnetChecklist(input: MainnetChecklistInput): ChecklistReport {
  const checks: CheckResult[] = [];

  // ── SEC-1: All relays use wss:// ──────────────────────────────────────────
  const insecureRelays = input.relayUrls.filter((r) => !r.startsWith('wss://'));
  checks.push(check(
    'SEC-1',
    'Relays use wss:// (TLS encrypted)',
    'CRITICAL',
    insecureRelays.length === 0,
    `Insecure ws:// relays detected: ${insecureRelays.join(', ')}. ` +
    'Relay operators can MITM plain-text connections and inject fake events.',
    `All ${input.relayUrls.length} relay(s) use wss://.`,
  ));

  // ── SEC-2: Rate limiter configured ───────────────────────────────────────
  checks.push(check(
    'SEC-2',
    'Rate limiter configured on agent',
    'HIGH',
    input.hasRateLimiter,
    'No RateLimiter is configured. A single malicious sender can flood the agent ' +
    'with messages and exhaust memory or processing capacity.',
    'RateLimiter is configured.',
  ));

  // ── SEC-3: Persistent nonce store ─────────────────────────────────────────
  checks.push(check(
    'SEC-3',
    'Persistent NonceStore (not InMemoryNonceStore)',
    'CRITICAL',
    input.hasPersistentNonceStore,
    'InMemoryNonceStore loses all consumed nonces on process restart. ' +
    'A restarted node is vulnerable to replay attacks on previously processed payments. ' +
    'Inject FileNonceStore (single-process) or a Redis-backed store.',
    'Persistent NonceStore is configured.',
  ));

  // ── SEC-4: ChannelBridge voucher sig verification ─────────────────────────
  checks.push(check(
    'SEC-4',
    'ChannelBridge verifyVoucherSig is configured',
    'HIGH',
    input.hasVoucherSigVerifier,
    'ChannelBridge is running with skipVoucherSigVerification: true. ' +
    'Any attacker who knows the channelId can force costly on-chain submitVoucher() calls that burn gas.',
    'ChannelBridge verifyVoucherSig is configured.',
  ));

  // ── SEC-5: Gateway auth token ─────────────────────────────────────────────
  if (input.gatewayHasAuthToken !== undefined) {
    checks.push(check(
      'SEC-5',
      'SporeHttpGateway has authToken configured',
      'HIGH',
      input.gatewayHasAuthToken,
      'SporeHttpGateway is running without authToken. Any process that can reach the port ' +
      'can send messages, list conversations, and stream incoming messages on your behalf.',
      'SporeHttpGateway authToken is configured.',
    ));
  }

  // ── SEC-6: Gateway request timeout ───────────────────────────────────────
  if (input.gatewayTimeoutMs !== undefined) {
    checks.push(check(
      'SEC-6',
      'SporeHttpGateway requestTimeoutMs ≤ 30s',
      'MEDIUM',
      input.gatewayTimeoutMs <= 30_000,
      `SporeHttpGateway requestTimeoutMs=${input.gatewayTimeoutMs}ms is too high. ` +
      'Long timeouts allow slow-client DoS attacks to hold sockets open indefinitely.',
      `SporeHttpGateway requestTimeoutMs=${input.gatewayTimeoutMs}ms (within limit).`,
    ));
  }

  // ── SEC-7: X402Bridge validBefore window ─────────────────────────────────
  if (input.x402MaxValidBeforeWindowSeconds !== undefined) {
    checks.push(check(
      'SEC-7',
      'X402Bridge maxValidBeforeWindowSeconds ≤ 86400 (24h)',
      'HIGH',
      input.x402MaxValidBeforeWindowSeconds <= 86400,
      `X402Bridge maxValidBeforeWindowSeconds=${input.x402MaxValidBeforeWindowSeconds}s exceeds 24h. ` +
      'Long windows allow pre-signed EIP-3009 authorizations to be replayed long after intent.',
      `X402Bridge maxValidBeforeWindowSeconds=${input.x402MaxValidBeforeWindowSeconds}s (within limit).`,
    ));
  }

  // ── SEC-8: UserOpBridge not in 'open' mode ────────────────────────────────
  if (input.userOpAuthModeIsNotOpen !== undefined) {
    checks.push(check(
      'SEC-8',
      'UserOpBridge authMode is not "open"',
      'CRITICAL',
      input.userOpAuthModeIsNotOpen,
      'UserOpBridge authMode is "open" — no authorization check is performed. ' +
      'Any Nostr event can trigger UserOp submission to the bundler.',
      'UserOpBridge authMode is "self_only" or "whitelist".',
    ));
  }

  // ── SEC-9: At least one relay configured ─────────────────────────────────
  checks.push(check(
    'SEC-9',
    'At least one relay URL is configured',
    'CRITICAL',
    input.relayUrls.length > 0,
    'No relay URLs are configured. The agent will not receive or send any messages.',
    `${input.relayUrls.length} relay(s) configured.`,
  ));

  // ── Build report ──────────────────────────────────────────────────────────
  const criticalFailures = checks.filter((c) => !c.passed && c.severity === 'CRITICAL').length;
  const highFailures = checks.filter((c) => !c.passed && c.severity === 'HIGH').length;
  const passed = criticalFailures === 0 && highFailures === 0;

  return {
    passed,
    checks,
    criticalFailures,
    highFailures,
    summary(): string {
      const failures = checks.filter((c) => !c.passed);
      if (failures.length === 0) {
        return `[MainnetChecklist] All ${checks.length} checks passed. Ready for mainnet.`;
      }
      const lines = [
        `[MainnetChecklist] ${failures.length}/${checks.length} checks failed. NOT ready for mainnet.`,
        '',
        ...failures.map((c) => `  [${c.severity}] ${c.id} ${c.name}: ${c.message}`),
      ];
      return lines.join('\n');
    },
  };
}
