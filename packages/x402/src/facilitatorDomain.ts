import {
  type Address, type Hash, type Hex, type PublicClient, type TypedDataDomain,
  decodeErrorResult, encodeFunctionData, toHex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { X402FacilitatorABI } from '@aastar/core';
import { X402_FACILITATOR_DOMAIN, X402_PAYMENT_AUTHORIZATION_TYPES } from './x402auth.js';

/**
 * X402Facilitator has no domain getter, so its EIP-712 domain is checked by asking its verifier, without sending
 * anything: `settleX402PaymentDirect` checks expiry, then the payer's signature, before any role, fee or balance
 * check (SP X402Facilitator.sol). Two `eth_call` simulations at one block hash (EIP-1898, requireCanonical):
 *
 * 1. a probe authorization signed under the SDK's domain must NOT revert with `InvalidX402Signature`;
 * 2. the same authorization signed under a deliberately wrong domain MUST revert with `InvalidX402Signature`
 *    (this shows the simulation reached the signature check, so result 1 means something).
 *
 * The probe key is generated in memory for the check and signs nothing else. Anything else (another revert in step
 * 2, no revert data, a node failure) refuses: the domain is then not established.
 */
export async function verifyFacilitatorDomain(
  client: PublicClient,
  facilitator: Address,
  expectedChainId: number,
): Promise<TypedDataDomain> {
  const fail = (msg: string): never => { throw new Error(`X402Facilitator ${facilitator}: ${msg}; refusing to sign`); };
  const chainId = await client.getChainId();
  if (chainId !== expectedChainId) fail(`the RPC is on chain ${chainId}, the payment is for chain ${expectedChainId}`);
  const block = await client.getBlock();
  const pin = { blockHash: block.hash as Hash, requireCanonical: true as const };

  const probe = privateKeyToAccount(generatePrivateKey());
  const message = {
    from: probe.address, to: probe.address, asset: probe.address, amount: 1n, maxFee: 0n,
    validBefore: block.timestamp + 3600n, nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
  };
  const domain: TypedDataDomain = { ...X402_FACILITATOR_DOMAIN, chainId, verifyingContract: facilitator };
  const simulate = async (d: TypedDataDomain): Promise<string | 'no-revert'> => {
    const signature = await probe.signTypedData({ domain: d, types: X402_PAYMENT_AUTHORIZATION_TYPES, primaryType: 'X402PaymentAuthorization', message });
    const data = encodeFunctionData({
      abi: X402FacilitatorABI, functionName: 'settleX402PaymentDirect',
      args: [message.from, message.to, message.asset, message.amount, message.maxFee, message.validBefore, message.nonce, signature],
    });
    try {
      await client.request({ method: 'eth_call', params: [{ from: probe.address, to: facilitator, data }, pin] } as any);
      return 'no-revert';
    } catch (e) {
      const revertData = revertDataOf(e);
      if (!revertData) return fail(`the probe simulation failed without revert data (${firstLine(e)})`);
      try {
        return decodeErrorResult({ abi: X402FacilitatorABI, data: revertData }).errorName;
      } catch {
        return `unknown-error-${revertData.slice(0, 10)}`;
      }
    }
  };

  const wrong = await simulate({ ...domain, name: `${X402_FACILITATOR_DOMAIN.name}-probe-mismatch` });
  if (wrong !== 'InvalidX402Signature') {
    fail(`a probe signed under a wrong domain reverted with ${wrong}, not InvalidX402Signature, so the simulation does not reach the signature check and cannot confirm the domain`);
  }
  const right = await simulate(domain);
  if (right === 'InvalidX402Signature') {
    fail(`its verifier rejects a probe signed under { name: "${X402_FACILITATOR_DOMAIN.name}", version: "${X402_FACILITATOR_DOMAIN.version}", chainId ${chainId} }`);
  }
  return domain;
}

/** The revert data of a failed eth_call, from the structured error (not from its message). */
function revertDataOf(e: unknown): Hex | undefined {
  for (let x: any = e, i = 0; x && i < 8; x = x.cause, i++) {
    const d = typeof x.data === 'string' ? x.data : typeof x.data?.data === 'string' ? x.data.data : undefined;
    if (d && /^0x[0-9a-fA-F]{8,}$/.test(d)) return d as Hex;
  }
  return undefined;
}

function firstLine(e: unknown): string {
  const m = (e as { message?: unknown } | null | undefined)?.message;
  return typeof m === 'string' ? m.split('\n')[0] : 'a non-Error rejection';
}
