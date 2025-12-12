
// @ts-ignore
import * as SharedConfig from '@aastar/shared-config';

console.log('SharedConfig Exports:', Object.keys(SharedConfig));
console.log('SharedConfig Default:', SharedConfig.default);

if (SharedConfig.contracts) {
    console.log('Contracts:', SharedConfig.contracts);
}
