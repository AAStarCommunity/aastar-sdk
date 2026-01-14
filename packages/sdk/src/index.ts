export * from '@aastar/core';
export * from '@aastar/account';
export * from '@aastar/paymaster';
export * from '@aastar/identity';
export * from '@aastar/tokens';
export * from '@aastar/dapp';

// Export Role-Based Clients
// Export Role-Based Clients
export { createEndUserClient } from './clients/endUser.js';
export { createOperatorClient } from './clients/operator.js';
export { createCommunityClient } from './clients/community.js';
export { createAdminClient } from './clients/admin.js';
export * from './clients/ExperimentClient.js';

// Export Utils & Errors
export { AAStarError, AAStarErrorCode, createError } from './errors/AAStarError.js';
export * from './utils/roleData.js';
export * from './utils/userOp.js';
export * from './utils/eventDecoder.js';

// Export Types
export * from './types/result.js';
