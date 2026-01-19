# Operator Flow Example

This example demonstrates how to set up and manage a SuperPaymaster as an Operator.

## Steps

1. **Staking**: Deposit GTokens into the staking contract to become an authorized operator.
2. **Paymaster Deposit**: Add ETH or other tokens to the SuperPaymaster's deposit pool for gas sponsorship.
3. **Monitoring**: Track gas usage and reputation metrics.

## Code Preview

```typescript
import { createOperatorClient } from '@aastar/sdk';
import { parseEther, keccak256, stringToBytes, erc20Abi } from 'viem';

const operator = createOperatorClient({ account, chain, transport });

const stakeAmount = parseEther('100');
const GTOKEN_ADDRESS = '0x...';
const STAKING_ADDRESS = '0x...';
const ROLE_ID = keccak256(stringToBytes('PAYMASTER_SUPER'));

// 1. Manual Approval
const approveTx = await operator.writeContract({
  address: GTOKEN_ADDRESS,
  abi: erc20Abi,
  functionName: 'approve',
  args: [STAKING_ADDRESS, stakeAmount],
});
await operator.waitForTransactionReceipt({ hash: approveTx });

// 2. Lock Stake via StakingActions
await operator.lockStake({
  user: operator.account.address,
  roleId: ROLE_ID,
  stakeAmount: stakeAmount,
  entryBurn: 0n,
  payer: operator.account.address
});
```
