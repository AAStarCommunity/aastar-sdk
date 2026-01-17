
import { describe, it, expect } from 'vitest';
import * as Exports from '../src/index';

describe('Dapp Package Exports', () => {
    it('should have exports', () => {
        expect(Exports).toBeDefined();
    });
});
