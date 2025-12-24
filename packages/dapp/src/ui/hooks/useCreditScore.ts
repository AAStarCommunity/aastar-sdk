
import { useState, useEffect } from 'react';
import { createAAStarPublicClient, RegistryABI } from '@aastar/core';
import { type Address, type Chain, type Transport } from 'viem';

type UseCreditScoreConfig = {
    chain: Chain;
    rpcUrl?: string; // Optional if transport is provided
    registryAddress: Address;
    userAddress: Address;
    transport?: Transport;
};

export function useCreditScore({ chain, rpcUrl, registryAddress, userAddress }: UseCreditScoreConfig) {
    const [creditLimit, setCreditLimit] = useState<bigint | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!registryAddress || !userAddress || !rpcUrl) return;

        const fetchCredit = async () => {
            setLoading(true);
            try {
                const client = createAAStarPublicClient(rpcUrl, chain);
                const limit = await client.readContract({
                    address: registryAddress,
                    abi: RegistryABI as any,
                    functionName: 'getCreditLimit',
                    args: [userAddress]
                });
                setCreditLimit(limit as bigint);
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
