import { createRequire } from 'module';
import { applyConfig } from './constants.js';

const require = createRequire(import.meta.url);
const network = process.env.NETWORK || 'anvil';

const shouldLoadLocalConfig =
    process.env.AASTAR_LOAD_LOCAL_CONFIG === '1' ||
    process.env.AASTAR_LOAD_LOCAL_CONFIG === 'true';

if (shouldLoadLocalConfig) {
    try {
        const config = require(`../../../config.${network}.json`);
        applyConfig(config);
    } catch (e) {
        // console.warn(`Warning: Could not load config.${network}.json`);
    }
}
