import React, { useCallback, useState } from 'react';
import { isAddress, type Address } from 'viem';
import { resolveConfig, type WidgetOptions } from './config';
import { registerWithEmail, sendGaslessTransfer } from './lib/kms';
import { getBalanceEth } from './lib/account';

export interface AAStarWidgetProps extends WidgetOptions {
  /** Optional title override. */
  title?: string;
}

type Status = { kind: 'idle' | 'busy' | 'ok' | 'error'; message?: string };

const box: React.CSSProperties = {
  fontFamily: 'system-ui, sans-serif',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 20,
  maxWidth: 380,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  background: '#fff',
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  marginBottom: 8,
  boxSizing: 'border-box',
};
const button: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: 'none',
  background: '#4f46e5',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

/**
 * Minimal drop-in AAStar account widget.
 * Flow: email register -> smart account address -> show balance -> single gasless tx.
 *
 * Every external dependency (KMS backend, RPC, operator) comes from config/env.
 * See README for required live infrastructure.
 */
export const AAStarWidget: React.FC<AAStarWidgetProps> = (props) => {
  const config = resolveConfig(props);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [address, setAddress] = useState<Address | ''>('');
  const [balance, setBalance] = useState<string>('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('0.001');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const refreshBalance = useCallback(
    async (addr: Address) => {
      try {
        setBalance(await getBalanceEth(config, addr));
      } catch (e) {
        setBalance('—');
        console.warn('balance read failed', e);
      }
    },
    [config],
  );

  const onRegister = useCallback(async () => {
    setStatus({ kind: 'busy', message: 'Registering passkey…' });
    try {
      const { address: addr } = await registerWithEmail(config, email, username || email);
      if (!addr) {
        setStatus({
          kind: 'error',
          message: 'Registered, but no address returned. Check backend user shape (lib/kms.ts).',
        });
        return;
      }
      setAddress(addr as Address);
      await refreshBalance(addr as Address);
      setStatus({ kind: 'ok', message: 'Account ready.' });
    } catch (e) {
      setStatus({ kind: 'error', message: errMsg(e) });
    }
  }, [config, email, username, refreshBalance]);

  const onGasless = useCallback(async () => {
    if (!to || !isAddress(to)) {
      setStatus({ kind: 'error', message: 'Enter a valid recipient address.' });
      return;
    }
    setStatus({ kind: 'busy', message: 'Confirm with biometrics…' });
    try {
      const { ok, userOpHash } = await sendGaslessTransfer(config, { to, value: amount });
      setStatus({
        kind: ok ? 'ok' : 'error',
        message: ok ? `Submitted: ${shorten(userOpHash)}` : 'Backend rejected the transfer.',
      });
      if (address) await refreshBalance(address as Address);
    } catch (e) {
      setStatus({ kind: 'error', message: errMsg(e) });
    }
  }, [config, to, amount, address, refreshBalance]);

  const busy = status.kind === 'busy';

  return (
    <div style={box}>
      <h3 style={{ margin: '0 0 4px' }}>{props.title ?? 'Sign in with AAStar'}</h3>
      <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 13 }}>
        Email + passkey. No seed phrase, no gas.
      </p>

      {!address ? (
        <>
          <input
            style={input}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <input
            style={input}
            type="text"
            placeholder="username (optional)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
          />
          <button style={button} onClick={onRegister} disabled={busy || !email}>
            {busy ? 'Working…' : 'Create account'}
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, marginBottom: 12 }}>
            <div style={{ color: '#64748b' }}>Smart account</div>
            <code style={{ wordBreak: 'break-all' }}>{address}</code>
            <div style={{ marginTop: 8, color: '#64748b' }}>Balance</div>
            <div>{balance === '' ? '…' : `${balance} ETH`}</div>
          </div>
          <input
            style={input}
            type="text"
            placeholder="recipient 0x…"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={busy}
          />
          <input
            style={input}
            type="text"
            placeholder="amount (ETH)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy}
          />
          <button style={button} onClick={onGasless} disabled={busy}>
            {busy ? 'Working…' : 'Send gasless tx'}
          </button>
        </>
      )}

      {status.message && (
        <p
          style={{
            marginTop: 12,
            fontSize: 12,
            color: status.kind === 'error' ? '#dc2626' : '#16a34a',
          }}
        >
          {status.message}
        </p>
      )}
    </div>
  );
};

function shorten(s: string): string {
  return s.length > 12 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
