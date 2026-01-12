import { createPublicClient, http, formatEther, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.sepolia' });

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL)
});

const aa = process.env.TEST_SIMPLE_ACCOUNT_B as `0x${string}`;
const pimToken = '0xFC3e86566895Fb007c6A0d3809eb2827DF94F751';

console.log('🔍 Debugging Pimlico AA23 Error\n');
console.log('AA Account:', aa);
console.log('PIM Token:', pimToken);

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)'
]);

// Check PIM balance
const balance = await client.readContract({
  address: pimToken,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [aa]
});

console.log(`\nPIM Balance: ${formatEther(balance)} PIM`);
console.log('Has balance?', balance > 0n ? '✅' : '❌');

// AA23 means paymaster reverted - likely validation issue
// Error code 0xfce698f7 is a specific revert reason
console.log('\nPossible AA23 causes:');
console.log('1. PIM token not approved for paymaster');
console.log('2. Insufficient PIM balance for gas');
console.log('3. Paymaster validation logic rejects this account');
console.log('4. Wrong EntryPoint version for Pimlico');
