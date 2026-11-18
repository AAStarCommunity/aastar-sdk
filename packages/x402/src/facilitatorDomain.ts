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
 * 1. a probe authorization signed under a deliberately wrong domain MUST revert with `InvalidX402Signature`;
 * 2. the same authorization signed under the SDK's domain MUST revert with `Unauthorized`: in SP's X402Facilitator
 *    the first check after the signature is `_requireSuperOperatorRole()`, and the probe address (generated in
 *    memory for this check) never holds that role.
 * `from`, `to` and `asset` are three different addresses, so an implementation that encodes them in another order
 * cannot pass. Only structured execution reverts (JSON-RPC code 3) are read; any other failure refuses.
 *
 * What this establishes, and what not: that the contract at the address, at that block, verifies the payer's
 * signature under { X402Facilitator, 1, chainId, address } and this type, ahead of the role check, as SP's
 * implementation does. It is a behavioural check of that implementation, not discovery of an arbitrary contract's
 * domain: a contract that verifies differently by caller, asset or payer type, or that bubbles the same error
 * selectors from elsewhere, is outside it.
 */
export async function verifyFacilitatorDomain(
  client: PublicClient,
  facilitator: Address,
  expectedChainId: number,
): Promise<TypedDataDomain & { blockHash: Hash; blockNumber: bigint }> {
  const fail = (msg: string): never => { throw new Error(`X402Facilitator ${facilitator}: ${msg}; refusing to sign`); };
  const chainId = await client.getChainId();
  if (chainId !== expectedChainId) fail(`the RPC is on chain ${chainId}, the payment is for chain ${expectedChainId}`);
  const block = await client.getBlock();
  const pin = { blockHash: block.hash as Hash, requireCanonical: true as const };

  const probe = privateKeyToAccount(generatePrivateKey());
  const other = () => privateKeyToAccount(generatePrivateKey()).address;
  const message = {
    from: probe.address, to: other(), asset: other(), amount: 1n, maxFee: 0n,
    validBefore: block.timestamp + 3600n, nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
  };
  const domain: TypedDataDomain = { ...X402_FACILITATOR_DOMAIN, chainId, verifyingContract: facilitator };
  const simulate = async (d: TypedDataDomain): Promise<string> => {
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
      if (revertData === undefined) return fail(`the probe simulation failed without an execution revert (${firstLine(e)})`);
      if (revertData === '0x') return 'revert-without-data';
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
  if (right !== 'Unauthorized') {
    fail(`a probe signed under the SDK domain reverted with ${right}, not the role check (Unauthorized) that follows the signature check, so the domain is not established`);
  }
  return { ...domain, blockHash: pin.blockHash, blockNumber: block.number as bigint };
}

/**
 * The revert data of an execution revert: only from an error node with JSON-RPC code 3 (execution reverted), never
 * from other errors' `data`. Returns '0x' for a code-3 revert without data, undefined when there is no such node.
 */
function revertDataOf(e: unknown): Hex | undefined {
  for (let x: any = e, i = 0; x && i < 8; x = x.cause, i++) {
    if (x.code !== 3) continue;
    const d = typeof x.data === 'string' ? x.data : typeof x.data?.data === 'string' ? x.data.data : '0x';
    return /^0x([0-9a-fA-F]{2})*$/.test(d) ? (d as Hex) : undefined;
  }
  return undefined;
}

function firstLine(e: unknown): string {
  const m = (e as { message?: unknown } | null | undefined)?.message;
  return typeof m === 'string' ? m.split('\n')[0] : 'a non-Error rejection';
}
