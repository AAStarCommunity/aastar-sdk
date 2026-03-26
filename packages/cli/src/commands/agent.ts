import { Command } from 'commander';
import { createPublicClient, http, defineChain, type Address } from 'viem';
import { agentActions } from '@aastar/core';

function getPublicClient(rpcUrl: string, chainId: number) {
    const chain = defineChain({ id: chainId, name: `chain-${chainId}`, nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
    return createPublicClient({ chain, transport: http(rpcUrl) });
}

export function registerAgentCommands(program: Command) {
    const agent = program
        .command('agent')
        .description('Agent sponsorship operations');

    agent
        .command('status')
        .description('Check agent registration and sponsorship eligibility')
        .requiredOption('--rpc <url>', 'RPC URL')
        .option('--chain-id <number>', 'Chain ID', '11155111')
        .requiredOption('--paymaster <address>', 'SuperPaymaster address')
        .requiredOption('--address <address>', 'Agent address to check')
        .action(async (opts) => {
            const client = getPublicClient(opts.rpc, Number(opts.chainId));
            const actions = agentActions(opts.paymaster as Address)(client);
            const isRegistered = await actions.isRegisteredAgent({ account: opts.address as Address });
            const isEligible = await actions.isEligibleForSponsorship({ user: opts.address as Address });
            console.log(`Agent ${opts.address}:`);
            console.log(`  Registered: ${isRegistered}`);
            console.log(`  Eligible:   ${isEligible}`);
        });

    agent
        .command('rate')
        .description('Get agent sponsorship rate for an operator')
        .requiredOption('--rpc <url>', 'RPC URL')
        .option('--chain-id <number>', 'Chain ID', '11155111')
        .requiredOption('--paymaster <address>', 'SuperPaymaster address')
        .requiredOption('--agent <address>', 'Agent address')
        .requiredOption('--operator <address>', 'Operator address')
        .action(async (opts) => {
            const client = getPublicClient(opts.rpc, Number(opts.chainId));
            const actions = agentActions(opts.paymaster as Address)(client);
            const rate = await actions.getAgentSponsorshipRate({
                agent: opts.agent as Address,
                operator: opts.operator as Address,
            });
            console.log(`Sponsorship Rate: ${rate} BPS (${Number(rate) / 100}%)`);
        });

    agent
        .command('registries')
        .description('Show agent registry addresses')
        .requiredOption('--rpc <url>', 'RPC URL')
        .option('--chain-id <number>', 'Chain ID', '11155111')
        .requiredOption('--paymaster <address>', 'SuperPaymaster address')
        .action(async (opts) => {
            const client = getPublicClient(opts.rpc, Number(opts.chainId));
            const actions = agentActions(opts.paymaster as Address)(client);
            const identity = await actions.agentIdentityRegistry();
            const reputation = await actions.agentReputationRegistry();
            console.log(`Identity Registry:   ${identity}`);
            console.log(`Reputation Registry: ${reputation}`);
        });
}
