import { createPublicClient, http, decodeEventLog, parseAbi } from 'viem';
import { optimism } from 'viem/chains';

const client = createPublicClient({ chain: optimism, transport: http() });

async function main() {
    const pimlicoTxs = [
        '0xe6ba79237b5196060d4d912bedf7e2a08695aec8c5861125a3de9c05e72a4d19', // 350k
        '0x2fa11417350945e77b99692829917e6fe04bab766e46c070d5ba53468b88c295', // 635k
        '0xab25174b9c548574f72c4c38d636eed4e9ba38a549bf2a729a0e989dcc763091'  // 638k
    ];
    const alchemyTxs = [
        '0x2b8ac4ef35344b8186ff3cd28b606fe6539f19f48a30e3d51c471623c22af5bd', // 228k
        '0x3abdce22a425974247cce18008d2b9062c98f76c2badee125f414b38c8be7238'  // 488k
    ];

    console.log("=== PIMLICO TXS ===");
    for (const hash of pimlicoTxs) {
        const rcpt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
        const block = await client.getBlock({ blockNumber: rcpt.blockNumber });
        console.log(`\nTx: ${hash}`);
        console.log(`Block: ${rcpt.blockNumber} | Date: ${new Date(Number(block.timestamp) * 1000).toISOString()}`);
        console.log(`Gas Used (receipt): ${rcpt.gasUsed}`);
        console.log(`Logs count: ${rcpt.logs.length}`);
        let transferCount = 0;
        let approvalCount = 0;
        for (const log of rcpt.logs) {
            try {
                const decoded = decodeEventLog({
                    abi: parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)', 'event Approval(address indexed owner, address indexed spender, uint256 value)']),
                    data: log.data,
                    topics: log.topics,
                });
                if (decoded.eventName === 'Transfer') transferCount++;
                if (decoded.eventName === 'Approval') approvalCount++;
            } catch (e) {}
        }
        console.log(` - ERC20 Transfers: ${transferCount}`);
        console.log(` - ERC20 Approvals: ${approvalCount}`);
    }

    console.log("\n=== ALCHEMY TXS ===");
    for (const hash of alchemyTxs) {
        const rcpt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
        const block = await client.getBlock({ blockNumber: rcpt.blockNumber });
        console.log(`\nTx: ${hash}`);
        console.log(`Block: ${rcpt.blockNumber} | Date: ${new Date(Number(block.timestamp) * 1000).toISOString()}`);
        console.log(`Gas Used (receipt): ${rcpt.gasUsed}`);
        console.log(`Logs count: ${rcpt.logs.length}`);
    }
}

main().catch(console.error);
