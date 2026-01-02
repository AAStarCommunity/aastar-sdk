import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.sepolia' });

console.log('🔍 Debugging AOA PaymasterV4 Issue\n');

// Check what's actually loaded
console.log('Environment variables:');
console.log('  PAYMASTER_V4_PROXY:', process.env.PAYMASTER_V4_PROXY);
console.log('  PAYMASTER_V4_ADDRESS:', process.env.PAYMASTER_V4_ADDRESS);
console.log('  PAYMASTER_ADDRESS:', process.env.PAYMASTER_ADDRESS);

// Simulate the code logic
const paymasterV4 = process.env.PAYMASTER_V4_PROXY || process.env.PAYMASTER_ADDRESS;
console.log('\nResolved paymasterV4:', paymasterV4);
console.log('Is undefined?', paymasterV4 === undefined);
console.log('Is valid address?', paymasterV4 && paymasterV4.startsWith('0x') && paymasterV4.length === 42);
