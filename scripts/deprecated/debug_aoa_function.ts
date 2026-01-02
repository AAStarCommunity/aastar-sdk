import * as dotenv from 'dotenv';
import { Hex } from 'viem';
dotenv.config({ path: '.env.sepolia' });

console.log('🔍 Debugging runAOAExperiment function call\n');

// Simulate config
const config = {
  accountAddress: process.env.TEST_SIMPLE_ACCOUNT_B as Hex,
  paymasterV4: process.env.PAYMASTER_V4_PROXY || process.env.PAYMASTER_ADDRESS
};

console.log('Config passed to runAOAExperiment:');
console.log('  accountAddress:', config.accountAddress);
console.log('  paymasterV4:', config.paymasterV4);

// Check if undefined
if (!config.paymasterV4) {
  console.log('\n❌ paymasterV4 is undefined!');
} else {
  console.log('\n✅ paymasterV4 is defined');
}

// Now check what test_groups.ts receives
console.log('\n🔍 Checking test_groups.ts destructuring:');
const { paymasterV4 } = config;
console.log('  Destructured paymasterV4:', paymasterV4);
console.log('  Type:', typeof paymasterV4);
