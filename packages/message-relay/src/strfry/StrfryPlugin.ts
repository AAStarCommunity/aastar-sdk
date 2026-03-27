// StrfryPlugin: write-policy plugin for strfry Nostr relay
// Called by strfry process: reads JSON lines from stdin, writes accept/reject to stdout.
// Each input line format: { type: "new", event: {...}, receivedAt: number }
// Each output line format: { id: eventId, action: "accept"|"reject"|"shadowReject", msg?: string }

import * as readline from 'readline';
import type { PaymentValidator } from '../middleware/PaymentValidator.js';
import type { NostrEvent } from '../storage/EventStore.js';

// kind:23405 — Spore Protocol payment commitment event kind
const PAYMENT_COMMITMENT_KIND = 23405;

interface StrfryInput {
  type: string;
  event: NostrEvent;
  receivedAt: number;
}

interface StrfryOutput {
  id: string;
  action: 'accept' | 'reject' | 'shadowReject';
  msg?: string;
}

/**
 * Run the strfry write-policy plugin loop.
 * Reads newline-delimited JSON from stdin; writes decisions to stdout.
 *
 * Payment gating logic:
 * - For kind:23405 events: validate the payment tags directly on the event
 * - For other events: accept (or check for bundled payment tags if strictMode is set)
 *
 * @param validator - PaymentValidator instance (configures fee, recipient, chain)
 * @param strictMode - If true, ALL events must carry a valid payment commitment
 */
export function runStrfryPlugin(
  validator: PaymentValidator,
  strictMode: boolean = false
): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let input: StrfryInput;
    try {
      input = JSON.parse(trimmed) as StrfryInput;
    } catch {
      // Cannot parse — skip
      return;
    }

    if (input.type !== 'new') return; // only handle new events

    const output = evaluateEvent(input.event, validator, strictMode);
    process.stdout.write(JSON.stringify(output) + '\n');
  });

  rl.on('close', () => {
    // stdin closed — plugin lifecycle ends
    process.exit(0);
  });
}

function evaluateEvent(
  event: NostrEvent,
  validator: PaymentValidator,
  strictMode: boolean
): StrfryOutput {
  const isPaymentEvent = event.kind === PAYMENT_COMMITMENT_KIND;

  if (isPaymentEvent || strictMode) {
    // Validate payment commitment embedded in the event's tags
    const commitment = validator.parse(event.tags);
    if (!commitment) {
      return {
        id: event.id,
        action: 'reject',
        msg: 'missing payment commitment',
      };
    }

    const result = validator.validate(commitment);
    if (!result.valid) {
      return {
        id: event.id,
        action: 'reject',
        msg: result.reason ?? 'payment validation failed',
      };
    }
  }

  return { id: event.id, action: 'accept' };
}
