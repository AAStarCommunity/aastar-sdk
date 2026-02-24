import { createPublicClient, http } from 'viem';
import { optimism } from 'viem/chains';

async function main() {
    const rpc = process.env.OP_MAINNET_RPC;
    if (!rpc) {
        console.error("Please set OP_MAINNET_RPC environment variable");
        process.exit(1);
    }

    async function trace(txHash: string) {
        const res = await fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'debug_traceTransaction',
                params: [txHash, { tracer: 'callTracer' }]
            })
        });
        const data = await res.json();
        return data.result;
    }
    
    // traverse and print
    function printTrace(node: any, depth = 0) {
        if (!node) return;
        const prefix = "  ".repeat(depth);
         console.log(`${prefix}- TO: ${node.to} | INPUT(10): ${node.input.substring(0,10)} | GAS_USED: ${parseInt(node.gasUsed, 16)}`);
        if (node.calls) {
             for (const child of node.calls) {
                 printTrace(child, depth + 1);
             }
        }
    }

    const t1Hash = '0x0293729bc5437daf74b8355107cb6dbb8e34e03271208bb456fa9b401d3fdd5d';
    const b1Hash = '0x2b8ac4ef35344b8186ff3cd28b606fe6539f19f48a30e3d51c471623c22af5bd';

    console.log("=== T1 (PaymasterV4) TRACE ===");
    const tTrace = await trace(t1Hash);
    printTrace(tTrace);

    console.log("\n=== B1 (Alchemy) TRACE ===");
    const bTrace = await trace(b1Hash);
    printTrace(bTrace);
}

main().catch(console.error);
