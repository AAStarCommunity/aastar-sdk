#!/usr/bin/env node
import { Command } from 'commander';
import { registerX402Commands } from './commands/x402.js';
import { registerChannelCommands } from './commands/channel.js';
import { registerAgentCommands } from './commands/agent.js';

const program = new Command();

program
    .name('aastar')
    .description('AAStar SDK CLI — x402 payments, micropayment channels, agent management')
    .version('0.17.0');

registerX402Commands(program);
registerChannelCommands(program);
registerAgentCommands(program);

program.parse();
