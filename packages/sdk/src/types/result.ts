import { AAStarError } from '../errors/AAStarError.js';

export type SDKResult<T> = 
    | { success: true; data: T }
    | { success: false; error: AAStarError };

export function success<T>(data: T): SDKResult<T> {
    return { success: true, data };
}

export function failure<T>(error: AAStarError): SDKResult<T> {
    return { success: false, error };
}

/**
 * Utility to wrap a Promise in an SDKResult.
 * Handles AAStarError explicitly, and wraps unknown errors.
 */
export async function safeSDKCall<T>(promise: Promise<T>): Promise<SDKResult<T>> {
    try {
        const data = await promise;
        return success(data);
    } catch (e: any) {
        if (e instanceof AAStarError) {
            return failure(e);
        }
        return failure(new AAStarError(e.message || 'Unknown error occurred', undefined, e));
    }
}
