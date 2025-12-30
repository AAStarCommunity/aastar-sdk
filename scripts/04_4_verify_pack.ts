import { createPublicClient, createWalletClient, http, parseEther, formatEther, Hex, toHex, encodeFunctionData, parseAbi, concat, encodeAbiParameters, keccak256, Address, pad, toBytes } from 'viem';
import * as dotenv from 'dotenv';
import * as path from 'path';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.anvil') });

const PAYMASTER = "0x1234567890123456789012345678901234567890" as Hex;

function packUint(high128: bigint, low128: bigint): Hex {
    return `0x${((high128 << 128n) | low128).toString(16).padStart(64, '0')}`;
}

async function main() {
    console.log("🧐 [04.4] Verifying Packing Logic...");

    const pmVerif = 123456n;
    const pmPost = 789012n;
    const pmData = "0xabcdef";

    // 1. Local Pack
    const packedLimits = packUint(pmVerif, pmPost);
    const localPacked = concat([PAYMASTER, packedLimits, pmData]);
    console.log(`   Local Packed: ${localPacked}`);

    // 2. Unpack for RPC
    const unpacked = {
        paymaster: PAYMASTER,
        paymasterVerificationGasLimit: toHex(pmVerif),
        paymasterPostOpGasLimit: toHex(pmPost),
        paymasterData: pmData
    };
    console.log("   Unpacked for RPC:", JSON.stringify(unpacked, null, 2));

    // 3. Simulate Bundler Re-Pack
    // Bundler receives: Address, uint256(hex), uint256(hex), bytes
    // It should perform: abi.encodePacked(paymaster, uint128(verif), uint128(post), data)
    
    // Let's rely on viem's `encodePacked` if possible, or manual concat.
    // Note: uint128 in Solidity assumes 16 bytes.
    
    // Re-Pack Logic:
    const vHex = toHex(pmVerif); // "0x1e240"
    const pHex = toHex(pmPost);  // "0xc0a34"
    
    // Pad to 16 bytes (32 hex chars) -> THIS IS KEY
    const vPadded = pad(vHex, { size: 16 });
    const pPadded = pad(pHex, { size: 16 });
    
    console.log(`   Re-Pack Components:`);
    console.log(`     Verif 16b: ${vPadded}`);
    console.log(`     Post  16b: ${pPadded}`);
    
    const rePacked = concat([PAYMASTER, vPadded, pPadded, pmData]);
    console.log(`   Re-Packed:    ${rePacked}`);

    if (localPacked === rePacked) {
        console.log("   ✅ Parsing Logic Match!");
    } else {
        console.log("   ❌ Parsing Logic Mismatch!");
        console.log("   Check your 'packUint' vs 'pad' logic.");
    }
    
    // Verify `packUint` logic specifically
    const packedUintVal = packUint(pmVerif, pmPost).slice(2);
    const concatPaddedVal = (vPadded.slice(2) + pPadded.slice(2));
    
    if (packedUintVal === concatPaddedVal) {
        console.log("   ✅ packUint matches pad(16) logic.");
    } else {
        console.log(`   ❌ packUint (${packedUintVal}) != concatPadded (${concatPaddedVal})`);
    }
}
main();
