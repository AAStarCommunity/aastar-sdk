// @ts-ignore
import { CONTRACTS } from '@aastar/shared-config';

console.log("Loaded Shared Config Version:", require('@aastar/shared-config/package.json').version);

const sepolia = CONTRACTS.sepolia;
if (sepolia) {
    console.log("Sepolia Keys:", Object.keys(sepolia));
    if (sepolia.core) console.log("Core:", sepolia.core);
    if (sepolia.tokens) console.log("Tokens:", sepolia.tokens);
} else {
    console.log("CONTRACTS structure:", JSON.stringify(CONTRACTS, null, 2));
}
