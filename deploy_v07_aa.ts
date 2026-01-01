import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.sepolia' });

const V07_FACTORY = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985';
const V07_ENTRYPOINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

async function main() {
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

  // Generate new owner
  const ownerKey = generatePrivateKey();
  const owner = privateKeyToAccount(ownerKey);
  
  console.log('🚀 Deploying v0.7 SimpleAccount...');
  console.log(`Factory: ${V07_FACTORY}`);
  console.log(`EntryPoint: ${V07_ENTRYPOINT}`);
  console.log(`Owner: ${owner.address}`);

  const abi = [{
    name: 'createAccount',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'salt', type: 'uint256' }
    ],
    outputs: [{ name: 'ret', type: 'address' }]
  }];

  const hash = await walletClient.writeContract({
    address: V07_FACTORY,
    abi,
    functionName: 'createAccount',
    args: [owner.address, 0n]
  });

  console.log(`\nDeploy Tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  // Get deployed address
  const getAddressAbi = [{
    name: 'getAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'salt', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'address' }]
  }];
  
  const aaAddress = await publicClient.readContract({
    address: V07_FACTORY,
    abi: getAddressAbi,
    functionName: 'getAddress',
    args: [owner.address, 0n]
  });

  console.log(`\n✅ AA Deployed: ${aaAddress}`);
  
  // Fund AA
  const fundHash = await walletClient.sendTransaction({
    to: aaAddress,
    value: parseEther('0.02')
  });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  console.log(`✅ AA Funded with 0.02 ETH`);
  
  // Fund Owner EOA
  const fundOwnerHash = await walletClient.sendTransaction({
    to: owner.address,
    value: parseEther('0.01')
  });
  await publicClient.waitForTransactionReceipt({ hash: fundOwnerHash });
  console.log(`✅ Owner Funded with 0.01 ETH`);

  console.log(`\n📝 Add to .env.sepolia:`);
  console.log(`TEST_OWNER_KEY_B=${ownerKey}`);
  console.log(`TEST_OWNER_EOA_B=${owner.address}`);
  console.log(`TEST_SIMPLE_ACCOUNT_B=${aaAddress}`);
  console.log(`\n# v0.7 Account (EntryPoint: ${V07_ENTRYPOINT})`);
}

main().catch(console.error);
