export const name = "@aastar/core";
// Future: Import from shared-config
// export * from 'shared-config';

import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

export const createClient = () => {
  return createPublicClient({
    chain: sepolia,
    transport: http()
  });
};
