import { createPublicClient, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.sepolia' });

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL)
});

const entryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const superPaymaster = '0x86A2EE8FAf9A840F7a2c64CA3d51209F9A02081D';
const paymasterV4 = '0x0F9019Dd30C7Cc5774d4883fba933aA0Caba9424';

const abi = [{
  name: 'balanceOf',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }]
}];

console.log('Checking Paymaster deposits on EntryPoint...\n');

const superBalance = await client.readContract({
  address: entryPoint,
  abi,
  functionName: 'balanceOf',
  args: [superPaymaster]
});

const v4Balance = await client.readContract({
  address: entryPoint,
  abi,
  functionName: 'balanceOf',
  args: [paymasterV4]
});

console.log(`SuperPaymaster (${superPaymaster}):`);
console.log(`  Deposit: ${formatEther(superBalance)} ETH`);
console.log(`  Status: ${superBalance > 0n ? '✅' : '❌ NEEDS DEPOSIT'}`);

console.log(`\nPaymasterV4 (${paymasterV4}):`);
console.log(`  Deposit: ${formatEther(v4Balance)} ETH`);
console.log(`  Status: ${v4Balance > 0n ? '✅' : '❌ NEEDS DEPOSIT'}`);
