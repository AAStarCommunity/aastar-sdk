/**
 * First failure and recovery per read target. Provider text is not accepted.
 */
import { describe, expect, it } from 'vitest';
import { freshReadAlerts, noteTargetRead } from './readAlert.js';

describe('read alerts', () => {
    it('alerts the first failure and the recovery, then stays quiet until the next failure', () => {
        const state = freshReadAlerts();
        const lines: string[] = [];
        const alert = (msg: string) => lines.push(msg);
        noteTargetRead(state, 'oracle', false, alert);
        noteTargetRead(state, 'oracle', false, alert);
        noteTargetRead(state, 'superpaymaster', false, alert);
        noteTargetRead(state, 'oracle', true, alert);
        noteTargetRead(state, 'oracle', true, alert);
        noteTargetRead(state, 'oracle', false, alert);
        expect(lines).toEqual([
            'keeper: oracle read failed',
            'keeper: superpaymaster read failed',
            'keeper: oracle read recovered',
            'keeper: oracle read failed',
        ]);
    });

    it('does not forward a foreign message and ignores a bad target', () => {
        const state = freshReadAlerts();
        const lines: string[] = [];
        noteTargetRead(state, 'paymaster', false, (msg) => lines.push(msg));
        noteTargetRead(state, '', false, (msg) => lines.push(msg));
        noteTargetRead(state, 'x'.repeat(65), false, (msg) => lines.push(`foreign ${msg}`));
        expect(lines).toEqual(['keeper: paymaster read failed']);
        expect(lines.join('\n')).not.toContain('provider');
    });
});
