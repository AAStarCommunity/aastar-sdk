import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCreditScore } from '@aastar/sdk/dapp';
import { zeroAddress, type Address } from 'viem';
import { brand, runtime } from '../config';
import { useAAStar } from '../lib/AAStarProvider';
import { getBalanceEth } from '../lib/account';
import { sendGaslessTransfer } from '../lib/kms';
import { card, input, primaryButton, label } from '../components/ui';

export const Dashboard: React.FC = () => {
  const { session } = useAAStar();
  const [balance, setBalance] = useState('…');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('0.001');
  const [txStatus, setTxStatus] = useState('');

  const address = (session?.address ?? '') as Address;

  // Registry address comes from env (VITE_REGISTRY_ADDRESS). When unset the hook
  // short-circuits and reports 0 — see the "Credit limit" rendering below.
  const registryAddress = (runtime.registryAddress ?? zeroAddress) as Address;

  // On-chain credit limit via the @aastar/sdk/dapp React hook.
  const { creditLimit, loading: creditLoading } = useCreditScore({
    chain: runtime.chain,
    rpcUrl: runtime.rpcUrl,
    registryAddress,
    userAddress: (address || zeroAddress) as Address,
  });

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      setBalance(await getBalanceEth(address));
    } catch {
      setBalance('—');
    }
  }, [address]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  const onGasless = useCallback(async () => {
    if (!to) {
      setTxStatus('Enter a recipient address.');
      return;
    }
    setTxStatus('Confirm with biometrics…');
    try {
      const { ok, userOpHash } = await sendGaslessTransfer({ to, value: amount });
      setTxStatus(ok ? `Submitted: ${userOpHash}` : 'Backend rejected the transfer.');
      await refreshBalance();
    } catch (e) {
      setTxStatus(e instanceof Error ? e.message : String(e));
    }
  }, [to, amount, refreshBalance]);

  if (!session) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '1fr', maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ margin: 0 }}>{brand.copy.dashboardTitle}</h1>

      <div style={card}>
        <div style={label}>Smart account</div>
        <code style={{ wordBreak: 'break-all', fontSize: 14 }}>{address || '(no address from backend)'}</code>

        <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
          <div>
            <div style={label}>Balance</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{balance} ETH</div>
          </div>
          <div>
            <div style={label}>Credit limit</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>
              {!runtime.registryAddress
                ? 'n/a'
                : creditLoading
                  ? '…'
                  : creditLimit != null
                    ? creditLimit.toString()
                    : '0'}
            </div>
          </div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 12px' }}>Send a gasless transaction</h3>
        <div style={label}>Recipient</div>
        <input style={input} type="text" value={to} placeholder="0x…"
          onChange={(e) => setTo(e.target.value)} />
        <div style={label}>Amount (ETH)</div>
        <input style={input} type="text" value={amount}
          onChange={(e) => setAmount(e.target.value)} />
        <button style={primaryButton} onClick={onGasless}>Send gasless tx</button>
        {txStatus && (
          <p style={{ fontSize: 13, marginTop: 12, color: brand.colors.muted, wordBreak: 'break-all' }}>
            {txStatus}
          </p>
        )}
      </div>
    </div>
  );
};
