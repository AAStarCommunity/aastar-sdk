import { vi } from 'vitest';
// Alias jest to vi for test files that use jest.fn() syntax
(globalThis as any).jest = vi;
