
import React from 'react';
import { useCreditScore } from '../hooks/useCreditScore';
// Note: We use type import for PaymasterConfig
import { type PaymasterConfig } from '@aastar/paymaster';
import { type Chain, type Address } from 'viem';

type EvaluationPanelProps = {
    paymasterConfig: PaymasterConfig;
    userAddress: Address;
    chain: Chain;
    registryAddress: Address;
};

export const EvaluationPanel: React.FC<EvaluationPanelProps> = ({ 
    paymasterConfig, 
    userAddress, 
    chain, 
    registryAddress 
}) => {
    const { creditLimit, loading } = useCreditScore({
        chain,
        userAddress,
        registryAddress
    });

    return (
        <div style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', maxWidth: '300px' }}>
            <h3>SuperPaymaster Debug</h3>
            <div style={{ fontSize: '12px' }}>
                <p><strong>Status:</strong> {loading ? 'Loading...' : 'Ready'}</p>
                <p><strong>User:</strong> {userAddress.slice(0, 6)}...{userAddress.slice(-4)}</p>
                <p><strong>Credit Limit:</strong> {creditLimit ? creditLimit.toString() : '0'}</p>
                <hr />
                <p><strong>Paymaster:</strong> {paymasterConfig.paymasterAddress.slice(0, 6)}...</p>
                <p><strong>Operator:</strong> {paymasterConfig.operator.slice(0, 6)}...</p>
            </div>
        </div>
    );
};
