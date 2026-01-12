
import { toHex } from 'viem';
import { createRequire } from 'module';
const require2 = createRequire(import.meta.url);
const { bls12_381 } = require2('@noble/curves/bls12-381');

function debugBLS() {
    const privKey = bls12_381.utils.randomPrivateKey();
    const pkPoint = bls12_381.G1.ProjectivePoint.fromPrivateKey(privKey);
    const pkRaw = pkPoint.toRawBytes(false);
    
    console.log(`pkRaw length: ${pkRaw.length}`);
    
    const pkX = pkRaw.slice(0, 48);
    const pkY = pkRaw.slice(48, 96);
    
    // Pad to 64 bytes
    const pkX_padded = new Uint8Array(64); pkX_padded.set(pkX, 16);
    const pkY_padded = new Uint8Array(64); pkY_padded.set(pkY, 16);
    
    const pkHex = toHex(pkX_padded).slice(2) + toHex(pkY_padded).slice(2);
    
    console.log(`pkHex length (chars): ${pkHex.length}`);
    console.log(`pkHex bytes: ${pkHex.length / 2}`);
    console.log(`pkHex: 0x${pkHex}`);

    // Message
    const msgBytes = new TextEncoder().encode("SuperPaymaster Reputation Update");
    const msgPoint = bls12_381.G2.hashToCurve(msgBytes);
    const msgRaw = msgPoint.toRawBytes(false);
    
    console.log(`msgRaw length: ${msgRaw.length}`);
    
    function padG2(raw) {
        const x_c1 = raw.slice(0, 48);
        const x_c0 = raw.slice(48, 96);
        const y_c1 = raw.slice(96, 144);
        const y_c0 = raw.slice(144, 192);
        
        const x_c1_p = new Uint8Array(64); x_c1_p.set(x_c1, 16);
        const x_c0_p = new Uint8Array(64); x_c0_p.set(x_c0, 16);
        const y_c1_p = new Uint8Array(64); y_c1_p.set(y_c1, 16);
        const y_c0_p = new Uint8Array(64); y_c0_p.set(y_c0, 16);
        
        return toHex(x_c1_p).slice(2) + toHex(x_c0_p).slice(2) + toHex(y_c1_p).slice(2) + toHex(y_c0_p).slice(2);
    }
    
    const msgHex = padG2(msgRaw); // No 0x
    console.log(`msgHex length: ${msgHex.length/2}`);
    
    const sigPoint = msgPoint.multiply(BigInt(toHex(privKey)));
    const sigRaw = sigPoint.toRawBytes(false);
    const sigHex = padG2(sigRaw);
    console.log(`sigHex length: ${sigHex.length/2}`);

}

debugBLS();
