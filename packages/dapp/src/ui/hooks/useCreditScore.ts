
import { useState, useEffect } from 'react';
import { createAAStarPublicClient, REGISTRY_ABI } from '@aastar/core';
import { type Address, type Chain, type Transport } from 'viem';

type UseCreditScoreConfig = {
    chain: Chain;
    rpcUrl?: string; // Optional if transport is provided
    registryAddress: Address;
    userAddress: Address;
    transport?: Transport;
};

export function useCreditScore({ chain, rpcUrl, registryAddress, userAddress, transport }: UseCreditScoreConfig) {
    const [creditLimit, setCreditLimit] = useState<bigint | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!registryAddress || !userAddress) return;

        const fetchCredit = async () => {
            setLoading(true);
            try {
                const client = createAAStarPublicClient({ chain, rpcUrl, transport });
                const limit = await client.readContract({
                    address: registryAddress,
                    abi: REGISTRY_ABI,
                    functionName: 'getCreditLimit',
                    args: [userAddress]
                });
                setCreditLimit(limit);
            } catch (e) {
                console.error("Failed to fetch credit limit:", e);
                setCreditLimit(0n);
            } finally {
                setLoading(false);
            }
        };

        fetchCredit();
    }, [chain, rpcUrl, registryAddress, userAddress]);

    return { creditLimit, loading };
}
