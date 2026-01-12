import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N')
});

const aa = '0x11595E52131Ffd571ce5e00C44472FBf94c99937';

// SimpleAccount has entryPoint() function
const abi = [{
  name: 'entryPoint',
  type: 'function',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ type: 'address' }]
}];

const ep = await client.readContract({
  address: aa,
  abi,
  functionName: 'entryPoint'
});

console.log('AA Account EntryPoint:', ep);
console.log('Test using:', '0x0000000071727De22E5E9d8BAf0edAc6f37da032');
console.log('Config has:', '0x2B0d36FACD61B71CC05ab8F3D2355ec3631C0dd5');
console.log('Match:', ep.toLowerCase() === '0x0000000071727De22E5E9d8BAf0edAc6f37da032'.toLowerCase() ? 'YES' : 'NO');
