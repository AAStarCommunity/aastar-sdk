import { createPublicClient, http, parseAbiItem } from 'viem';
import { optimism } from 'viem/chains';

async function main() {
    const rpc = process.env.OP_MAINNET_RPC || 'https://opt-mainnet.g.alchemy.com/v2/4Cp8njSeL62sQANuWObBv';
    const client = createPublicClient({ chain: optimism, transport: http(rpc) });

    const PIMLICO_ERC20_PAYMASTER = '0x777777777777AeC03fd955926DbF81597e66834C';
    // UserOperationEvent (EP v0.6 and v0.7)
    const userOpEvent = parseAbiItem('event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)');

    console.log("Fetching recent Pimlico transactions...");
    const latestBlock = await client.getBlockNumber();
    const fromBlock = latestBlock - 10000n; // past ~1 hour

    const logs = await client.getLogs({
        address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', // EP 0.7
        event: userOpEvent,
        args: { paymaster: PIMLICO_ERC20_PAYMASTER },
        fromBlock,
        toBlock: latestBlock
    });

    const logs06 = await client.getLogs({
        address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // EP 0.6
        event: userOpEvent,
        args: { paymaster: PIMLICO_ERC20_PAYMASTER },
        fromBlock,
        toBlock: latestBlock
    });

    const allLogs = [...logs, ...logs06];
    console.log(`Found ${allLogs.length} Pimlico transactions in the last 100k blocks.`);

    if (allLogs.length === 0) return;

    // Take up to 10 to check actualGasUsed
    const sample = allLogs.slice(-10);
    for (const log of sample) {
        console.log(`Tx: ${log.transactionHash} | actualGasUsed (from Event): ${log.args.actualGasUsed?.toString()}`);
        const rcpt = await client.getTransactionReceipt({ hash: log.transactionHash });
        console.log(` -> receipt.gasUsed: ${rcpt.gasUsed.toString()}`);
    }
}

main().catch(console.error);
