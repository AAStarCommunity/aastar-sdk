export * from '@aastar/core';
export * from '@aastar/account';
export * from '@aastar/paymaster';
export * from '@aastar/identity';
export * from '@aastar/tokens';
export * from '@aastar/dapp';
// export * from '@aastar/enduser'; // Commented to avoid CommunityClient conflict with clients/community.js

// Export Role-Based Clients
export * from './clients/endUser.js';
export * from './clients/operator.js';
export * from './clients/community.js';
export * from './clients/admin.js';
export * from './clients/ExperimentClient.js';

// Export L3 Lifecycle
export * from '@aastar/enduser';
export * from '@aastar/operator';
export * from '@aastar/admin';

// Export Utils & Errors
export * from './utils/roleData.js';
export * from './utils/keys.js';
export * from './utils/funding.js';
export * from './utils/userOp.js';
export * from './utils/testScenarios.js';
export * from './errors/decoder.js';

