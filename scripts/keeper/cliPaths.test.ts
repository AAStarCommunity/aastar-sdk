import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { absoluteKeeperPath } from './cliPaths';

describe('keeper path resolution', () => {
    it('resolves a relative path against the original cwd', () => {
        expect(absoluteKeeperPath('/work', 'keys/keeper')).toBe(resolve('/work', 'keys/keeper'));
        expect(absoluteKeeperPath('/work', '/abs/cast')).toBe('/abs/cast');
    });

    it('rejects an empty path before any filesystem call', () => {
        expect(() => absoluteKeeperPath('/work', '')).toThrow('keeper: path rejected');
        expect(() => absoluteKeeperPath('', 'keys/keeper')).toThrow('keeper: path rejected');
    });
});
