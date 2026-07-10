import { useMemo, useState } from 'react';
import type { Hex } from 'viem';
import {
  connectWallet,
  fetchIdentity,
  generateLocalBlsKey,
  onboard,
  popFromLocalKey,
  type OnboardDvtNodeResult,
} from './lib/sdk';
import type { Pop, PortalConfig, StepStatus, WalletConn } from './lib/types';

const STEPS = ['下载镜像', '填写配置', '连接钱包', '生成密钥', '注册 + 质押', '节点身份'] as const;

const CHAIN_ID = { sepolia: 11155111, 'op-sepolia': 11155420 } as const;

export default function App() {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<StepStatus[]>(() => STEPS.map((_, i) => (i === 0 ? 'active' : 'pending')));
  const [err, setErr] = useState<string | null>(null);

  // shared flow state
  const [cfg, setCfg] = useState<PortalConfig>({ network: 'sepolia', nodeKind: 'local', kmsUrl: 'http://127.0.0.1:3100', dvtUrl: '' });
  const [wallet, setWallet] = useState<WalletConn | null>(null);
  const [blsKey, setBlsKey] = useState<Hex | ''>('');
  const [pop, setPop] = useState<Pop | null>(null);
  const [kmsRef, setKmsRef] = useState('');
  const [plan, setPlan] = useState<OnboardDvtNodeResult | null>(null);
  const [result, setResult] = useState<OnboardDvtNodeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState<unknown | null>(null);

  const setStepStatus = (i: number, s: StepStatus) =>
    setStatus((prev) => prev.map((v, idx) => (idx === i ? s : v)));

  const go = (next: number) => {
    setErr(null);
    setStatus((prev) => prev.map((v, idx) => (idx === step && v !== 'done' ? 'done' : idx === next ? 'active' : v)));
    setStep(next);
  };

  const nodeRef = useMemo(() => (cfg.nodeKind === 'local' ? pop?.publicKey ?? '' : kmsRef), [cfg.nodeKind, pop, kmsRef]);

  async function run<T>(i: number, fn: () => Promise<T>): Promise<T | undefined> {
    setErr(null);
    setBusy(true);
    setStepStatus(i, 'doing');
    try {
      const out = await fn();
      setStepStatus(i, 'done');
      return out;
    } catch (e) {
      setStepStatus(i, 'error');
      const ex = e as { shortMessage?: string; message?: string };
      setErr(ex.shortMessage || ex.message || String(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <header>
        <h1>社区节点 Onboarding</h1>
        <p className="sub">KMS + DVT 联合节点初始化 · 全流程底层由 <code>@aastar/sdk</code> 驱动,本页仅串线</p>
      </header>

      <ol className="stepper">
        {STEPS.map((s, i) => (
          <li key={s} className={`st st-${status[i]} ${i === step ? 'cur' : ''}`} onClick={() => status[i] !== 'pending' && go(i)}>
            <span className="dot">{status[i] === 'done' ? '✓' : i + 1}</span>
            <span className="lbl">{s}</span>
          </li>
        ))}
      </ol>

      {err && <div className="err">⚠️ {err}</div>}

      <section className="panel">
        {/* 1. 下载镜像 */}
        {step === 0 && (
          <div>
            <h2>1 · 下载节点镜像</h2>
            <p>下载 DVT 节点镜像,并保存配置模板(recipe)。启动镜像后回到本页继续初始化。</p>
            <ul className="kv">
              <li><b>镜像</b><span><code>ghcr.io/aastar/dvt-node:latest</code>(占位 — 以 DVT 发布为准)</span></li>
              <li><b>Recipe</b><span>DVT <code>/recipe</code>(在「填写配置」步按网络拉取)</span></li>
            </ul>
            <div className="row"><button className="primary" onClick={() => go(1)}>已下载,下一步</button></div>
          </div>
        )}

        {/* 2. 填写配置 */}
        {step === 1 && (
          <div>
            <h2>2 · 填写配置</h2>
            <div className="form">
              <label>网络
                <select value={cfg.network} onChange={(e) => setCfg({ ...cfg, network: e.target.value as PortalConfig['network'] })}>
                  <option value="sepolia">Sepolia</option>
                  <option value="op-sepolia">OP Sepolia</option>
                </select>
              </label>
              <label>节点类型
                <select value={cfg.nodeKind} onChange={(e) => setCfg({ ...cfg, nodeKind: e.target.value as PortalConfig['nodeKind'] })}>
                  <option value="local">本地/HSM 私钥节点(现在可用)</option>
                  <option value="kms-tee">KMS-TEE key-less 节点(需 KMS /pop · CC-37)</option>
                </select>
              </label>
              <label>KMS URL{cfg.nodeKind === 'local' && <span className="muted"> (本地节点可留空)</span>}
                <input value={cfg.kmsUrl} onChange={(e) => setCfg({ ...cfg, kmsUrl: e.target.value })} placeholder="http://127.0.0.1:3100" />
              </label>
              <label>DVT URL <span className="muted">(可选 · /recipe · /identity)</span>
                <input value={cfg.dvtUrl} onChange={(e) => setCfg({ ...cfg, dvtUrl: e.target.value })} placeholder="http://127.0.0.1:8787" />
              </label>
            </div>
            <div className="row"><button className="primary" onClick={() => go(2)}>下一步</button></div>
          </div>
        )}

        {/* 3. 连接钱包 */}
        {step === 2 && (
          <div>
            <h2>3 · 连接钱包(operator)</h2>
            <p>连接节点 operator 的钱包 —— 它是链上 <code>msg.sender</code>,负责质押 + 注册。需持有 ETH(gas)与 GToken(质押 ≥30)。</p>
            {wallet ? (
              <ul className="kv">
                <li><b>operator</b><span className="mono">{wallet.address}</span></li>
                <li><b>chainId</b><span>{wallet.chainId} {wallet.chainId !== CHAIN_ID[cfg.network] && <em className="warn">≠ {CHAIN_ID[cfg.network]}(请切到 {cfg.network})</em>}</span></li>
              </ul>
            ) : (
              <div className="row"><button className="primary" disabled={busy} onClick={() => run(2, async () => setWallet(await connectWallet()))}>连接钱包</button></div>
            )}
            {wallet && <div className="row"><button className="primary" disabled={wallet.chainId !== CHAIN_ID[cfg.network]} onClick={() => go(3)}>下一步</button></div>}
          </div>
        )}

        {/* 4. 生成密钥 */}
        {step === 3 && (
          <div>
            <h2>4 · 生成密钥</h2>
            {cfg.nodeKind === 'local' ? (
              <>
                <p>为本地节点生成 BLS 私钥(<b>仅在浏览器生成,私钥不上送</b>)。请下载保存,写入节点镜像配置。PoP 由 SDK <code>buildDvtPop</code> 本地推导。</p>
                <p className="note">⚠️ <b>生产节点</b>:BLS 长期签名私钥建议用 <b>HSM / 离线</b>生成并保管,浏览器生成仅适合测试/演示。密钥用 WebCrypto CSPRNG(<code>crypto.getRandomValues</code>),不发服务器、不持久化。</p>
                <div className="row">
                  <button className="primary" disabled={busy} onClick={() => run(3, async () => {
                    const k = generateLocalBlsKey();
                    const p = popFromLocalKey(k);
                    setBlsKey(k); setPop(p);
                  })}>{blsKey ? '重新生成' : '生成 BLS 私钥'}</button>
                </div>
                {blsKey && pop && (
                  <ul className="kv">
                    <li><b>BLS 私钥</b><span className="mono danger">{blsKey}<button className="mini" onClick={() => download('node-bls.key', blsKey)}>下载</button></span></li>
                    <li><b>publicKey</b><span className="mono">{short(pop.publicKey)}</span></li>
                    <li><b>nodeId</b><span className="mono">{pop.nodeId}</span></li>
                  </ul>
                )}
              </>
            ) : (
              <>
                <p>KMS-TEE 节点:BLS 私钥在 TEE 内生成并密封,永不出 TEE。填入 KMS 侧节点标识(node_id 或 pubkey),注册时由 KMS <code>/pop</code> 出 PoP。</p>
                <div className="form">
                  <label>KMS node_id / publicKey
                    <input value={kmsRef} onChange={(e) => setKmsRef(e.target.value)} placeholder="node_id 或 0x… pubkey" />
                  </label>
                </div>
                <p className="muted">⏳ KMS <code>/pop</code> 待上线(CC-37 返工 + A 板 TA 重刷)。此路径注册步会在 /pop 未就绪时报错而不提交。</p>
              </>
            )}
            <div className="row"><button className="primary" disabled={!nodeRef} onClick={() => go(4)}>下一步</button></div>
          </div>
        )}

        {/* 5. 注册 + 质押 */}
        {step === 4 && (
          <div>
            <h2>5 · 注册 + 质押</h2>
            <p>由 SDK <code>onboardDvtNode</code> 幂等完成:approve → <code>registerRole(ROLE_DVT)</code>(锁 ≥30 GToken)→ <code>registerWithProof</code>。operator 自筹(owner 代付需后端 owner key,不放浏览器)。</p>
            <div className="row">
              <button disabled={busy} onClick={() => run(4, async () => {
                const p = await onboard({ cfg, operator: wallet!.address, blsSecretKey: (blsKey || undefined) as Hex | undefined, kmsNodeRef: kmsRef || undefined, dryRun: true });
                setPlan(p);
              })}>Dry-run 预览</button>
              <button className="primary" disabled={busy} onClick={() => run(4, async () => {
                const r = await onboard({ cfg, operator: wallet!.address, blsSecretKey: (blsKey || undefined) as Hex | undefined, kmsNodeRef: kmsRef || undefined, dryRun: false });
                setResult(r);
                if (r.registered || r.alreadyRegistered) go(5);
              })}>一键 注册 + 质押</button>
            </div>
            {plan?.plan && !result && (
              <ul className="kv">
                <li><b>需质押 GToken</b><span>{fmt(plan.plan.needGToken)}</span></li>
                <li><b>将垫付 ETH</b><span>{fmt(plan.plan.wouldFundEth)}</span></li>
                <li><b>将转 GToken</b><span>{fmt(plan.plan.wouldFundGToken)}</span></li>
                <li><b>将 approve</b><span>{String(plan.plan.wouldApprove)}</span></li>
                <li><b>将 registerRole</b><span>{String(plan.plan.wouldRegisterRole)}</span></li>
              </ul>
            )}
            {result && <TxList result={result} />}
          </div>
        )}

        {/* 6. 身份 */}
        {step === 5 && (
          <div>
            <h2>6 · 节点身份</h2>
            {result ? (
              <>
                <ul className="kv">
                  <li><b>nodeId</b><span className="mono">{result.nodeId}</span></li>
                  <li><b>operator</b><span className="mono">{result.operator}</span></li>
                  <li><b>registered</b><span>{String(result.registered || result.alreadyRegistered)}</span></li>
                  <li><b>staked</b><span>{fmt(result.effectiveStake)} GToken(min {fmt(result.minStake)})</span></li>
                </ul>
                <TxList result={result} />
                <div className="row">
                  <button disabled={busy || !cfg.dvtUrl} onClick={() => run(5, async () => setIdentity(await fetchIdentity(cfg, result.nodeId)))}>拉取运行态身份(DVT /identity)</button>
                </div>
                {identity != null && <pre className="json">{JSON.stringify(identity, null, 2)}</pre>}
                <p className="ok">✅ 节点初始化完成。</p>
              </>
            ) : <p className="muted">尚未注册。</p>}
          </div>
        )}
      </section>

      <footer><span>底层:<code>@aastar/sdk</code> onboardDvtNode / buildDvtPop / KMS popSigner · 页面仅串线,后续搬迁至 YAAA</span></footer>
    </div>
  );
}

function TxList({ result }: { result: OnboardDvtNodeResult }) {
  const entries = Object.entries(result.hashes) as [string, Hex][];
  if (result.alreadyRegistered) return <p className="ok">✅ 已注册(幂等,无新交易)。</p>;
  if (!entries.length) return null;
  return (
    <ul className="kv">
      {entries.map(([k, h]) => (
        <li key={k}><b>{k}</b><span className="mono">{short(h)}</span></li>
      ))}
    </ul>
  );
}

function short(h: string): string {
  return h.length > 22 ? `${h.slice(0, 12)}…${h.slice(-8)}` : h;
}
function fmt(v: bigint): string {
  // wei → decimal string (18 dp), trimmed — display only.
  const s = v.toString().padStart(19, '0');
  const int = s.slice(0, -18);
  const frac = s.slice(-18).replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}
function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
