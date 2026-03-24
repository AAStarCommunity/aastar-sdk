import { Command } from 'commander';
import { createPublicClient, http, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { channelActions } from '@aastar/core';

function getPublicClient(rpcUrl: string) {
    return createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
}

export function registerChannelCommands(program: Command) {
    const channel = program
        .command('channel')
        .description('MicroPaymentChannel operations');

    channel
        .command('status')
        .description('Get channel state')
        .requiredOption('--rpc <url>', 'RPC URL')
        .requiredOption('--contract <address>', 'MicroPaymentChannel address')
        .requiredOption('--id <hex>', 'Channel ID (bytes32)')
        .action(async (opts) => {
            const client = getPublicClient(opts.rpc);
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
        .requiredOption('--contract <address>', 'MicroPaymentChannel address')
        .action(async (opts) => {
            const client = getPublicClient(opts.rpc);
            const actions = channelActions(opts.contract as Address)(client);
            const timeout = await actions.CLOSE_TIMEOUT();
            console.log(`Close Timeout: ${timeout} seconds`);
        });
}
