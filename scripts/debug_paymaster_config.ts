// @ts-ignore
import { CONTRACTS } from '@aastar/shared-config';

console.log("Loaded Shared Config Version:", require('@aastar/shared-config/package.json').version);

const sepolia = CONTRACTS.sepolia;

console.log("\n--- Paymaster Related Config ---");
if (sepolia) {
    if (sepolia.core) {
        console.log("Core.paymasterFactory:", sepolia.core.paymasterFactory);
        console.log("Core.superPaymasterV2:", sepolia.superPaymasterV2 || sepolia.core.superPaymasterV2); // Just to check vs V4
    }
    if (sepolia.paymaster) {
        console.log("Paymaster Section:", sepolia.paymaster);
    }
} else {
    console.log("CONTRACTS structure:", JSON.stringify(CONTRACTS, null, 2));
}
