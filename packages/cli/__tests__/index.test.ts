import { describe, it, expect } from 'vitest';
import { registerX402Commands, registerChannelCommands, registerAgentCommands } from '../src/index.js';

describe('@aastar/cli', () => {
    it('should export command registration functions', () => {
        expect(typeof registerX402Commands).toBe('function');
        expect(typeof registerChannelCommands).toBe('function');
        expect(typeof registerAgentCommands).toBe('function');
    });
});
