#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'module';
import { registerX402Commands } from './commands/x402.js';
import { registerChannelCommands } from './commands/channel.js';
import { registerAgentCommands } from './commands/agent.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command();

program
    .name('aastar')
    .description('AAStar SDK CLI — x402 payments, micropayment channels, agent management')
    .version(version);

registerX402Commands(program);
registerChannelCommands(program);
registerAgentCommands(program);

program.parse();
