
import { privateKeyToAccount } from 'viem/accounts';
const key = '0x1b9c251d318c3c8576b96beddfdc4ec2ffbff762d70325787bde31559db83a21'; // PRIVATE_KEY_SUPPLIER
console.log(privateKeyToAccount(key as `0x${string}`).address);
