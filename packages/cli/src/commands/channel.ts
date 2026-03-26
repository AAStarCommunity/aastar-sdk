import { Command } from 'commander';
import { createPublicClient, http, defineChain, type Address, type Hex } from 'viem';
import { channelActions } from '@aastar/core';

function getPublicClient(rpcUrl: string, chainId: number) {
    const chain = defineChain({ id: chainId, name: `chain-${chainId}`, nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
    return createPublicClient({ chain, transport: http(rpcUrl) });
}

export function registerChannelCommands(program: Command) {
    const channel = program
        .command('channel')
        .description('MicroPaymentChannel operations');

    channel
        .command('status')
        .description('Get channel state')
        .requiredOption('--rpc <url>', 'RPC URL')
        .requiredOption('--chain-id <number>', 'Chain ID', '11155111')
        .requiredOption('--contract <address>', 'MicroPaymentChannel address')
        .requiredOption('--id <hex>', 'Channel ID (bytes32)')
        .action(async (opts) => {
            const client = getPublicClient(opts.rpc, Number(opts.chainId));
            const actions = channelActions(opts.contract as Address)(client);
            const state = await actions.getChannel({ channelId: opts.id as Hex });
            console.log('Channel State:');
            console.log(`  Payer:     ${state.payer}`);
            console.log(`  Payee:     ${state.payee}`);
            console.log(`  Token:     ${state.token}`);
            console.log(`  Signer:    ${state.authorizedSigner}`);
            console.log(`  Deposit:   ${state.deposit}`);
            console.log(`  Settled:   ${state.settled}`);
            console.log(`  CloseReq:  ${state.closeRequestedAt}`);
            console.log(`  Finalized: ${state.finalized}`);
        });

    channel
        .command('timeout')
        .description('Get close timeout duration')
        .requiredOption('--rpc <url>', 'RPC URL')
        .requiredOption('--chain-id <number>', 'Chain ID', '11155111')
        .requiredOption('--contract <address>', 'MicroPaymentChannel address')
        .action(async (opts) => {
            const client = getPublicClient(opts.rpc, Number(opts.chainId));
            const actions = channelActions(opts.contract as Address)(client);
            const timeout = await actions.CLOSE_TIMEOUT();
            console.log(`Close Timeout: ${timeout} seconds`);
        });

    channel
        .command('open')
        .description('Open a new payment channel [coming soon — requires wallet integration]')
        .action(() => {
            console.error('channel open: not yet implemented. Use ChannelClient from @aastar/channel directly.');
            process.exit(1);
        });

    channel
        .command('settle')
        .description('Settle a channel with a signed voucher [coming soon — requires wallet integration]')
        .action(() => {
            console.error('channel settle: not yet implemented. Use ChannelClient from @aastar/channel directly.');
            process.exit(1);
        });

    channel
        .command('close')
        .description('Request channel close [coming soon — requires wallet integration]')
        .action(() => {
            console.error('channel close: not yet implemented. Use ChannelClient from @aastar/channel directly.');
            process.exit(1);
        });
}
