import { createPublicClient, createWalletClient, http, parseEther, parseAbi } from 'viem';
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

const aa = process.env.TEST_SIMPLE_ACCOUNT_B as `0x${string}`;
const bpnts = process.env.BPNTS_ADDRESS as `0x${string}`;

console.log('Checking bPNTs balance for AOA test...');

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)'
]);

const balance = await publicClient.readContract({
  address: bpnts,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [aa]
});

console.log('Current bPNTs balance:', balance.toString());

if (balance < parseEther('1')) {
  console.log('Funding AA with bPNTs...');
  const hash = await walletClient.writeContract({
    address: bpnts,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [aa, parseEther('100')]
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log('✅ Funded 100 bPNTs');
} else {
  console.log('✅ Already has bPNTs');
}
