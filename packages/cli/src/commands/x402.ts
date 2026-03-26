import { Command } from 'commander';
import { createPublicClient, http, defineChain, type Address, type Hex } from 'viem';
import { x402Actions } from '@aastar/core';

function getPublicClient(rpcUrl: string, chainId: number) {
    const chain = defineChain({ id: chainId, name: `chain-${chainId}`, nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
    return createPublicClient({ chain, transport: http(rpcUrl) });
}

export function registerX402Commands(program: Command) {
    const x402 = program
        .command('x402')
        .description('x402 payment operations');

    x402
        .command('quote')
        .description('Get facilitator fee quote')
        .requiredOption('--rpc <url>', 'RPC URL')
        .requiredOption('--chain-id <number>', 'Chain ID', '11155111')
        .requiredOption('--paymaster <address>', 'SuperPaymaster address')
        .action(async (opts) => {
            const client = getPublicClient(opts.rpc, Number(opts.chainId));
            const actions = x402Actions(opts.paymaster as Address)(client);
            const feeBPS = await actions.facilitatorFeeBPS();
            console.log(`Facilitator Fee: ${feeBPS} BPS (${Number(feeBPS) / 100}%)`);
        });

    x402
        .command('nonce')
        .description('Check if a nonce has been used')
        .requiredOption('--rpc <url>', 'RPC URL')
        .requiredOption('--chain-id <number>', 'Chain ID', '11155111')
        .requiredOption('--paymaster <address>', 'SuperPaymaster address')
        .requiredOption('--nonce <hex>', 'Nonce to check')
        .action(async (opts) => {
            const client = getPublicClient(opts.rpc, Number(opts.chainId));
            const actions = x402Actions(opts.paymaster as Address)(client);
            const used = await actions.x402SettlementNonces({ nonce: opts.nonce as Hex });
            console.log(`Nonce ${opts.nonce}: ${used ? 'USED' : 'AVAILABLE'}`);
        });

    x402
        .command('earnings')
        .description('Check facilitator earnings for an operator')
        .requiredOption('--rpc <url>', 'RPC URL')
        .requiredOption('--chain-id <number>', 'Chain ID', '11155111')
        .requiredOption('--paymaster <address>', 'SuperPaymaster address')
        .requiredOption('--operator <address>', 'Operator address')
        .requiredOption('--asset <address>', 'Asset address')
        .action(async (opts) => {
            const client = getPublicClient(opts.rpc, Number(opts.chainId));
            const actions = x402Actions(opts.paymaster as Address)(client);
            const earnings = await actions.facilitatorEarnings({
                operator: opts.operator as Address,
                asset: opts.asset as Address,
            });
            console.log(`Earnings: ${earnings}`);
        });

    x402
        .command('pay')
        .description('Send an x402 payment [coming soon — requires wallet integration]')
        .action(() => {
            console.error('x402 pay: not yet implemented. Use X402Client from @aastar/x402 directly.');
            process.exit(1);
        });

    x402
        .command('settle')
        .description('Settle an x402 payment on-chain [coming soon — requires wallet integration]')
        .action(() => {
            console.error('x402 settle: not yet implemented. Use X402Client from @aastar/x402 directly.');
            process.exit(1);
        });
}
