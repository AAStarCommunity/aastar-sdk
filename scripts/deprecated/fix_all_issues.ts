import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.sepolia' });

const deployerKey = process.env.PRIVATE_KEY_JASON as `0x${string}`;
const deployer = privateKeyToAccount(deployerKey);

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL)
});

const walletClient = createWalletClient({
  account: deployer,
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL)
});

const entryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const superPaymaster = '0x86A2EE8FAf9A840F7a2c64CA3d51209F9A02081D';
const paymasterV4 = '0x0F9019Dd30C7Cc5774d4883fba933aA0Caba9424';

console.log('🔧 Fixing all issues...\n');

// Deposit to SuperPaymaster
console.log('1. Depositing 0.1 ETH to SuperPaymaster...');
const depositAbi = [{
  name: 'depositTo',
  type: 'function',
  stateMutability: 'payable',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: []
}];

const hash1 = await walletClient.writeContract({
  address: entryPoint,
  abi: depositAbi,
  functionName: 'depositTo',
  args: [superPaymaster],
  value: parseEther('0.1')
});
await publicClient.waitForTransactionReceipt({ hash: hash1 });
console.log(`   ✅ SuperPaymaster deposit: ${hash1}`);

// Deposit to PaymasterV4
console.log('\n2. Depositing 0.1 ETH to PaymasterV4...');
const hash2 = await walletClient.writeContract({
  address: entryPoint,
  abi: depositAbi,
  functionName: 'depositTo',
  args: [paymasterV4],
  value: parseEther('0.1')
});
await publicClient.waitForTransactionReceipt({ hash: hash2 });
console.log(`   ✅ PaymasterV4 deposit: ${hash2}`);

console.log('\n✅ All deposits complete!');
console.log('\n📝 Update .env.sepolia:');
console.log('PAYMASTER_V4_ADDRESS=0x0F9019Dd30C7Cc5774d4883fba933aA0Caba9424');
