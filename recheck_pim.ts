import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N')
});

const aa = '0xC47e7305Fe0A347Dba3609726A58d92c1c1c7f42';
const pimToken = '0xFC3e86566895Fb007c6A0d3809eb2827DF94F751';

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
]);

const balance = await client.readContract({
  address: pimToken,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [aa]
});

const decimals = await client.readContract({
  address: pimToken,
  abi: erc20Abi,
  functionName: 'decimals',
  args: []
});

console.log('Raw balance:', balance.toString());
console.log('Decimals:', decimals);
console.log('Actual balance:', Number(balance) / Math.pow(10, Number(decimals)));
console.log('Has enough?', balance > BigInt(100 * Math.pow(10, Number(decimals))) ? 'YES' : 'NO');
