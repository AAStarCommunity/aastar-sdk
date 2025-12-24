
import { useState, useCallback } from 'react';
import { getPaymasterMiddleware, type PaymasterConfig } from '@aastar/paymaster';

type UseSuperPaymasterResult = {
    generatePaymasterAndData: (userOp: any) => Promise<string>;
    isLoading: boolean;
    error: Error | null;
};

export function useSuperPaymaster(config: PaymasterConfig): UseSuperPaymasterResult {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const generatePaymasterAndData = useCallback(async (userOp: any) => {
        setIsLoading(true);
        setError(null);
        try {
            const middleware = getPaymasterMiddleware(config);
            const result = await middleware.sponsorUserOperation({ userOperation: userOp });
            return result.paymasterAndData as string;
        } catch (err: any) {
            setError(err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [config.paymasterAddress, config.operator, config.verificationGasLimit, config.postOpGasLimit]);

    return { generatePaymasterAndData, isLoading, error };
}
