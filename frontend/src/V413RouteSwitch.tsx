import React, { useEffect, useMemo, useState } from 'react';
import './v413-three-pages.css';

type AnyObj = Record<string, any>;

const NAV = [
  ['/', '指挥总览', '地图/当前环'],
  ['/project-docs', '项目书', '工程依据'],
  ['/risk-replay', '风险复盘', '穿越窗口'],
  ['/monitoring-alerts', '监测异常', '阈值趋势'],
  ['/operation-diagnosis', '参数诊断', '组合异常'],
  ['/slurry-grouting', '泥水注浆', '沉降归因'],
  ['/segment-quality', '管片盾尾', '拼装缺陷'],
  ['/events', '事件闭环', '报警处置'],
  ['/data-import', '数据接入', '接口/映射'],
  ['/system-status', '系统状态', '数据质量'],
  ['/evidence', '证据链', '来源追溯'],
];

function apiBase() {
  return `http://${window.location.hostname || '120.55.70.218'}:8100`;
}

function useApi(path: string, intervalMs = 12000) {
  const [data, setData] = useState<AnyObj | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${apiBase()}${path}`);
        const json = await res.json();
        if (!alive) return;
        setData(json?.data ?? json);
        setError('');
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || String(e));
      }
    };
    load();
    const timer = window.setInterval(load, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [path, intervalMs]);
  return { data, error };
}

function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(v: any, unit = '') {
  if (v === undefined || v === null || v === '') return '--';
  const n = Number(v);
  const text = Number.isFinite(n) ? String(Math.round(n * 100) / 100) : String(v);
  return unit ? `${text} ${unit}` : text;
}

function dk(m: number) {
  const x = Math.round(num(m));
  const km = Math.floor(x / 1000);
  const mm = Math.abs(x - km * 1000);
  return `DK${km}+${String(mm).padStart(3, '0')}`;
}

function positionFromRing(ringValue: any) {
  const ring = num(ringValue, 5325);
  const mileageM = 55998 + (ring - 1152) * 2.0;
  return {
    ring,
    mileageM,
    dk: dk(mileageM),
    formula: `DK55+998 + (${Math.round(ring)} - 1152) × 2.0m = ${dk(mileageM)}`,
  };
}

function positionFromContextOrRing(positionContextRoot: AnyObj | null | undefined, ringValue: any) {
  const d = positionContextRoot?.data || positionContextRoot || {};
  const matchedRisk = Array.isArray(d.matchedRiskSources) ? d.matchedRiskSources[0] : null;
  const engineeringRing = d.engineeringRing || null;

  if (d.positionSource === 'guidance' && d.headMileageText) {
    const guidanceRing = d.guidanceRing ?? '--';
    const engineeringRingText = engineeringRing?.ringNo ? ` / 工程环 ${engineeringRing.ringNo}` : '';
    const riskText = matchedRisk?.riskName ? ` / ${matchedRisk.riskName}${matchedRisk.crossingRelation ? matchedRisk.crossingRelation : ''}` : '';
    const tailText = d.tailMileageText ? `，盾尾 ${d.tailMileageText}` : '';
    const middleText = d.middleMileageText ? `，盾中 ${d.middleMileageText}` : '';
    return {
      ring: Number(guidanceRing) || Number(ringValue) || 0,
      dk: d.headMileageText,
      formula: `实时导向：盾首 ${d.headMileageText}${middleText}${tailText}；导向环 ${guidanceRing}${engineeringRingText}${riskText}`,
      source: 'guidance',
      matched: true,
      riskName: matchedRisk?.riskName || '',
      engineeringRingNo: engineeringRing?.ringNo,
    };
  }

  const fallback = positionFromRing(ringValue);
  return {
    ...fallback,
    source: 'fallback',
    formula: `${fallback.formula}；未收到导向里程时仅作兜底展示。`,
    matched: false,
  };
}

function GlobalGuidanceRibbon() {
  const posCtx = useApi('/api/position-context?deviceId=DZ1360', 8000);
  const d = posCtx.data?.data || posCtx.data || {};
  if (!d || d.positionSource !== 'guidance' || !d.headMileageText) return null;

  const risk = Array.isArray(d.matchedRiskSources) ? d.matchedRiskSources[0] : null;
  const engineeringRing = d.engineeringRing;
  return (
    <div className="v419-guidance-ribbon">
      <b>实时导向 {d.headMileageText}</b>
      <span>导向环 {d.guidanceRing ?? '--'}{engineeringRing?.ringNo ? ` / 工程环 ${engineeringRing.ringNo}` : ''}</span>
      {risk?.riskName ? <em>{risk.riskName}{risk.crossingRelation ? risk.crossingRelation : ''}</em> : null}
    </div>
  );
}



const aliases: Record<string, string[]> = {
  currentRing: ['currentRing', 'ring', '现场环号'],
  advanceSpeed: ['advanceSpeed', 'advanceSpeedAvg', 'averageAdvanceSpeed', '推进速度平均值', '推进速度'],
  penetration: ['penetration', 'penetrationRate', '贯入度'],
  totalThrust: ['totalThrust', 'thrustTotal', '总推进力'],
  chamberPressure1: ['chamberPressure1', 'earthPressure1', 'cabinPressure1', '开挖仓压力1#', '仓压1#'],
  chamberPressure2: ['chamberPressure2', 'earthPressure2', 'cabinPressure2', '开挖仓压力2#', '仓压2#'],
  chamberPressure3: ['chamberPressure3', 'earthPressure3', 'cabinPressure3', '开挖仓压力3#', '仓压3#'],
  cutterSpeed: ['cutterSpeed', 'cutterheadSpeed', '刀盘速度'],
  cutterTorque: ['cutterTorque', 'cutterheadTorque', '刀盘转矩', '刀盘扭矩'],
  shieldTailGap1: ['shieldTailGap1', 'tailGap1', '1#盾尾间隙'],
  shieldTailGap2: ['shieldTailGap2', 'tailGap2', '2#盾尾间隙'],
  shieldTailGap3: ['shieldTailGap3', 'tailGap3', '3#盾尾间隙'],
  slurryInFlow: ['slurryInFlow', 'inSlurryFlow', '进浆管路浆液流量', '进浆流量'],
  slurryOutFlow: ['slurryOutFlow', 'outSlurryFlow', '排浆管路浆液流量', '排浆流量'],
  slurryInPressure: ['slurryInPressure', 'inSlurryPressure', '进浆管路浆液压力', '进浆压力'],
  slurryInDensity: ['slurryInDensity', 'inSlurryDensity', '进浆管路浆液密度', '进浆密度'],
  slurryOutDensity: ['slurryOutDensity', 'outSlurryDensity', '排浆管路浆液密度', '排浆密度'],
  groutTotal: ['groutTotal', 'groutingTotal', '注浆总累积量', '注浆总累计量'],
  segmentPosition: ['segmentPosition', 'segmentAssemblyPosition', '正在拼装的管片位置', '拼装位置'],
};

function unwrap(v: any) {
  if (v && typeof v === 'object') return v.displayValue ?? v.value ?? v.rawValue ?? v.currentValue ?? v;
  return v;
}

function fields(root: AnyObj | null | undefined) {
  const d = root || {};
  return d?.machine?.fields || d?.fields || d?.tbm?.fields || {};
}

function get(root: AnyObj | null | undefined, key: string, fallback: any = 0) {
  const d = root || {};
  const fs = fields(d);
  const keys = aliases[key] || [key];
  for (const k of keys) {
    if (fs && fs[k] !== undefined) return unwrap(fs[k]);
    if (d && d[k] !== undefined) return unwrap(d[k]);
    if (d?.tbm && d.tbm[k] !== undefined) return unwrap(d.tbm[k]);
    if (d?.current && d.current[k] !== undefined) return unwrap(d.current[k]);
  }
  return fallback;
}

function historyItems(root: AnyObj | null | undefined) {
  const d = root || {};
  const raw = Array.isArray(d.items) ? d.items : Array.isArray(d.data?.items) ? d.data.items : [];
  return raw.slice(-36);
}

function labels(items: AnyObj[]) {
  return items.map((x, i) => {
    const t = x.timestamp || x.receivedAt || x.time || x.createdAt || '';
    return t ? String(t).slice(11, 16) : String(i + 1);
  });
}

function values(items: AnyObj[], key: string, fallback: any = 0) {
  return items.map((x) => num(get(x, key, fallback)));
}

function Layout({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <div className="v413s-shell">
      <aside className="v413s-side">
        <a className="v413s-brand" href="/">
          <span>SHIELD TUNNEL ANALYTICS</span>
          <b>通苏嘉甬施工监测与盾构研判平台</b>
        </a>
        <nav>
          {NAV.map(([href, title, sub]) => (
            <a key={href} href={href} className={active === href ? 'active' : ''}>
              <b>{title}</b>
              <span>{sub}</span>
            </a>
          ))}
        </nav>
      </aside>
      <main className="v413s-main">{children}</main>
    </div>
  );
}

function Hero({ tag, title, desc, value, label }: { tag: string; title: string; desc: string; value: string; label: string }) {
  return (
    <section className="v413s-hero">
      <div>
        <span>{tag}</span>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      <div className="v413s-hero-value">
        <b>{value}</b>
        <small>{label}</small>
      </div>
    </section>
  );
}

function ErrorBox({ error }: { error?: string }) {
  return error ? <div className="v413s-error">接口提示：{error}</div> : null;
}

function Conclusion({ title, subtitle, items, warn }: { title: string; subtitle: string; items: string[]; warn?: boolean }) {
  return (
    <section className={`v413s-conclusion ${warn ? 'warn' : ''}`}>
      <div>
        <span>研判结论</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <ul>{items.filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ul>
    </section>
  );
}

function Stat({ title, value, note, warn }: { title: string; value: string; note: string; warn?: boolean }) {
  return (
    <article className={`v413s-stat ${warn ? 'warn' : ''}`}>
      <span>{title}</span>
      <b>{value}</b>
      <p>{note}</p>
    </article>
  );
}

function Metric({ title, value, note, warn }: { title: string; value: string; note: string; warn?: boolean }) {
  return (
    <article className={`v413s-metric ${warn ? 'warn' : ''}`}>
      <span>{title}</span>
      <b>{value}</b>
      <p>{note}</p>
    </article>
  );
}

function Chart({ title, labs, vals }: { title: string; labs: string[]; vals: number[] }) {
  const max = Math.max(1, ...vals.map((v) => Math.abs(v)));
  const shownVals = vals.length ? vals : [0];
  const shownLabs = labs.length ? labs : ['当前'];
  return (
    <section className="v413s-chart">
      <h3>{title}</h3>
      <div className="v413s-bars">
        {shownVals.map((v, i) => (
          <div className="v413s-bar-col" key={`${title}-${i}`}>
            <div className="v413s-bar-track">
              <i style={{ height: `${Math.max(4, Math.min(100, (Math.abs(v) / max) * 100))}%` }} />
            </div>
            <span>{shownLabs[i] || String(i + 1)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Actions({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="v413s-actions">
      <h3>{title}</h3>
      <div>{items.map((x, i) => <article key={i}><b>{String(i + 1).padStart(2, '0')}</b><span>{x}</span></article>)}</div>
    </section>
  );
}


function normalizeDiagnosis(data: AnyObj | null) {
  const d = data?.data || data || {};
  if (d.content) return String(d.content);
  const diag = d.diagnosis || d.fallbackRule || {};
  const parts: string[] = [];
  if (diag.summary) parts.push(`当前结论\n- ${diag.summary}`);
  if (Array.isArray(diag.warnings) && diag.warnings.length) {
    parts.push(`风险点\n${diag.warnings.slice(0, 4).map((x: string) => `- ${x}`).join('\n')}`);
  }
  if (Array.isArray(diag.suggestions) && diag.suggestions.length) {
    parts.push(`建议动作\n${diag.suggestions.slice(0, 4).map((x: string) => `- ${x}`).join('\n')}`);
  }
  return parts.join('\n\n') || '暂无诊断内容。';
}

function AiDiagnosisPanel(props: { mode: string; title: string; question: string }) {
  const [strategy, setStrategy] = useState<'rule' | 'ai' | 'reasoner'>('rule');
  const [result, setResult] = useState<AnyObj | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (nextStrategy?: 'rule' | 'ai' | 'reasoner') => {
    const useStrategy = nextStrategy || strategy;
    setStrategy(useStrategy);
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase()}/api/ai-diagnosis/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: props.mode, strategy: useStrategy, deviceId: 'DZ1360', question: props.question }),
      });
      const json = await res.json();
      setResult(json);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run('rule');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode]);

  const data = result?.data || {};
  const source = data.source || 'rule';
  const text = normalizeDiagnosis(result);

  return (
    <section className="v413s-ai" data-ai-diagnosis-panel="true">
      <div className="v413s-ai-head">
        <div>
          <span>智能诊断</span>
          <h3>{props.title}</h3>
          <p>默认展示规则兜底；点击 DeepSeek 后生成汇报话术，失败不影响页面。</p>
        </div>
        <div className="v413s-ai-actions">
          <button disabled={loading} className={strategy === 'rule' ? 'active' : ''} onClick={() => run('rule')}>规则兜底</button>
          <button disabled={loading} className={strategy === 'ai' ? 'active' : ''} onClick={() => run('ai')}>DeepSeek</button>
          <button disabled={loading} className={strategy === 'reasoner' ? 'active' : ''} onClick={() => run('reasoner')}>复杂归因</button>
        </div>
      </div>

      <div className="v413s-ai-meta">
        <b>{loading ? '生成中...' : `来源：${source}`}</b>
        {data.model ? <span>模型：{data.model}</span> : null}
        {data.usage?.total_tokens ? <span>Tokens：{data.usage.total_tokens}</span> : null}
      </div>

      {error ? <div className="v413s-error">智能诊断失败：{error}</div> : null}
      <pre>{text}</pre>
      <small>AI 结论仅作辅助研判；待校准、待解释字段必须结合现场复核。</small>
    </section>
  );
}


function OperationDiagnosisPage() {
  const latest = useApi('/api/tbm/frontend-summary?deviceId=DZ1360', 8000);
  const latest2 = useApi('/api/tbm/latest-view?deviceId=DZ1360', 8000);
  const history = useApi('/api/tbm/history?deviceId=DZ1360&limit=160', 15000);
  const posCtx = useApi('/api/position-context?deviceId=DZ1360', 8000);
  const src = latest.data || latest2.data || {};
  const h = historyItems(history.data);
  const ring = get(src, 'currentRing', 5325);
  const pos = positionFromContextOrRing(posCtx.data, ring);

  const speed = get(src, 'advanceSpeed', 0);
  const penetration = get(src, 'penetration', 0);
  const thrust = get(src, 'totalThrust', 0);
  const chamber1 = get(src, 'chamberPressure1', 0);
  const chamber2 = get(src, 'chamberPressure2', 0);
  const chamber3 = get(src, 'chamberPressure3', 0);
  const cutterSpeed = get(src, 'cutterSpeed', 0);
  const cutterTorque = get(src, 'cutterTorque', 0);
  const gap1 = get(src, 'shieldTailGap1', 0);
  const gap2 = get(src, 'shieldTailGap2', 0);
  const gap3 = get(src, 'shieldTailGap3', 0);
  const pressureSpread = Math.max(num(chamber1), num(chamber2), num(chamber3)) - Math.min(num(chamber1), num(chamber2), num(chamber3));
  const gapSpread = Math.max(num(gap1), num(gap2), num(gap3)) - Math.min(num(gap1), num(gap2), num(gap3));
  const labs = labels(h);

  return (
    <Layout active="/operation-diagnosis">
      <Hero tag="参数诊断" title="推进、仓压、刀盘与盾尾间隙组合研判" desc="把推进、贯入、仓压、刀盘和盾尾间隙放在一页联动判断，避免只看单个字段。" value={pos.dk} label="实时推算位置" />
      <AiDiagnosisPanel mode="operation" title="推进参数智能诊断" question="基于推进、贯入、仓压、刀盘、盾尾间隙和监测异常，生成适合汇报的参数诊断结论。" />
      <ErrorBox error={latest.error || latest2.error || history.error} />
      <Conclusion
        warn={pressureSpread > 1 || gapSpread > 35 || num(speed) <= 0}
        title={`推进速度 ${fmt(speed, 'mm/min')}，贯入度 ${fmt(penetration, 'mm/r')}`}
        subtitle={`现场环号 ${Math.round(num(ring))}；${pos.formula}`}
        items={[
          `仓压 1#/2#/3#：${fmt(chamber1, 'bar')}、${fmt(chamber2, 'bar')}、${fmt(chamber3, 'bar')}，压差约 ${fmt(pressureSpread, 'bar')}。`,
          `盾尾间隙 1#/2#/3#：${fmt(gap1, 'mm')}、${fmt(gap2, 'mm')}、${fmt(gap3, 'mm')}，最大差约 ${fmt(gapSpread, 'mm')}。`,
          `刀盘速度 ${fmt(cutterSpeed, 'rpm')}，刀盘扭矩 ${fmt(cutterTorque, 'kNm')}，用于判断刀盘负载和推进协调性。`,
          h.length ? `历史快照 ${h.length} 条，趋势图用于查看近时段变化。` : '当前历史快照不足，页面先展示最新实测参数。',
        ]}
      />
      <div className="v413s-grid four">
        <Stat title="推进速度" value={fmt(speed, 'mm/min')} note="推进-贯入协调" warn={num(speed) <= 0} />
        <Stat title="贯入度" value={fmt(penetration, 'mm/r')} note="单位环转进尺" />
        <Stat title="开挖仓压差" value={fmt(pressureSpread, 'bar')} note="1#/2#/3# 均衡性" warn={pressureSpread > 1} />
        <Stat title="盾尾间隙差" value={fmt(gapSpread, 'mm')} note="姿态协调" warn={gapSpread > 35} />
      </div>
      <div className="v413s-grid four">
        <Metric title="总推进力" value={fmt(thrust, 'kN')} note="顶推负载" />
        <Metric title="刀盘速度" value={fmt(cutterSpeed, 'rpm')} note="主驱动运行" />
        <Metric title="刀盘扭矩" value={fmt(cutterTorque, 'kNm')} note="刀盘负载" />
        <Metric title="实时环号" value={fmt(ring)} note={pos.dk} />
      </div>
      <div className="v413s-grid two">
        <Chart title="推进速度趋势" labs={labs} vals={values(h, 'advanceSpeed')} />
        <Chart title="贯入度趋势" labs={labs} vals={values(h, 'penetration')} />
      </div>
      <div className="v413s-grid two">
        <Chart title="开挖仓压力1#趋势" labs={labs} vals={values(h, 'chamberPressure1')} />
        <Chart title="盾尾间隙1#趋势" labs={labs} vals={values(h, 'shieldTailGap1')} />
      </div>
      <Actions title="参数诊断复核动作" items={['先看推进速度和贯入度是否同向变化，判断推进效率是否异常。', '再看 1#/2#/3# 仓压差，判断开挖面压力是否均衡。', '最后联动盾尾间隙和刀盘负载，判断是否需要调整姿态或推进参数。']} />
    </Layout>
  );
}

function SlurryGroutingPage() {
  const latest = useApi('/api/tbm/frontend-summary?deviceId=DZ1360', 8000);
  const latest2 = useApi('/api/tbm/latest-view?deviceId=DZ1360', 8000);
  const history = useApi('/api/tbm/history?deviceId=DZ1360&limit=160', 15000);
  const posCtx = useApi('/api/position-context?deviceId=DZ1360', 8000);
  const src = latest.data || latest2.data || {};
  const h = historyItems(history.data);
  const ring = get(src, 'currentRing', 5325);
  const pos = positionFromContextOrRing(posCtx.data, ring);
  const inFlow = get(src, 'slurryInFlow', 0);
  const outFlow = get(src, 'slurryOutFlow', 0);
  const inPressure = get(src, 'slurryInPressure', 0);
  const inDensity = get(src, 'slurryInDensity', 0);
  const outDensity = get(src, 'slurryOutDensity', 0);
  const groutTotal = get(src, 'groutTotal', 0);
  const chamber1 = get(src, 'chamberPressure1', 0);
  const flowDiff = num(inFlow) - num(outFlow);
  const densityDiff = num(inDensity) - num(outDensity);
  const labs = labels(h);

  return (
    <Layout active="/slurry-grouting">
      <Hero tag="泥水注浆" title="泥水循环、仓压与同步注浆归因" desc="把进排浆、仓压、浆液密度和同步注浆放在一起看，用于解释沉降响应和开挖面稳定性。" value={fmt(groutTotal, 'm³')} label="注浆累计量" />
      <AiDiagnosisPanel mode="slurry" title="泥水注浆智能归因" question="基于进排浆、仓压、浆液密度、注浆量、盾尾间隙和监测异常，生成适合汇报的泥水注浆归因结论。" />
      <ErrorBox error={latest.error || latest2.error || history.error} />
      <Conclusion
        warn={Math.abs(flowDiff) > 20 || Math.abs(densityDiff) > 0.2}
        title={`进排浆流量差 ${fmt(flowDiff, 'm³/h')}，仓压1# ${fmt(chamber1, 'bar')}`}
        subtitle={`实时位置 ${pos.dk}，现场环号 ${Math.round(num(ring))}。`}
        items={[
          `进浆流量 ${fmt(inFlow, 'm³/h')}，排浆流量 ${fmt(outFlow, 'm³/h')}，用于判断泥水循环是否平衡。`,
          `进浆压力 ${fmt(inPressure, 'bar')}，进/排浆密度差 ${fmt(densityDiff, 'kg/L')}。`,
          `同步注浆累计量 ${fmt(groutTotal, 'm³')}，需与盾尾间隙和沉降监测联合解释。`,
          '若沉降报警与仓压、注浆量或进排浆流量波动同现，应优先复核注浆压力和补浆记录。',
        ]}
      />
      <div className="v413s-grid four">
        <Stat title="进浆流量" value={fmt(inFlow, 'm³/h')} note="泥水循环输入" />
        <Stat title="排浆流量" value={fmt(outFlow, 'm³/h')} note="泥水循环输出" />
        <Stat title="进浆压力" value={fmt(inPressure, 'bar')} note="管路压力" />
        <Stat title="注浆累计量" value={fmt(groutTotal, 'm³')} note="同步注浆" />
      </div>
      <div className="v413s-grid four">
        <Metric title="进浆密度" value={fmt(inDensity, 'kg/L')} note="浆液性质" />
        <Metric title="排浆密度" value={fmt(outDensity, 'kg/L')} note="返回浆液" />
        <Metric title="流量差" value={fmt(flowDiff, 'm³/h')} note="进浆 - 排浆" warn={Math.abs(flowDiff) > 20} />
        <Metric title="仓压1#" value={fmt(chamber1, 'bar')} note="开挖面压力参考" />
      </div>
      <div className="v413s-grid two">
        <Chart title="进浆流量趋势" labs={labs} vals={values(h, 'slurryInFlow')} />
        <Chart title="排浆流量趋势" labs={labs} vals={values(h, 'slurryOutFlow')} />
      </div>
      <div className="v413s-grid two">
        <Chart title="进浆压力趋势" labs={labs} vals={values(h, 'slurryInPressure')} />
        <Chart title="注浆累计量趋势" labs={labs} vals={values(h, 'groutTotal')} />
      </div>
      <Actions title="沉降归因检查顺序" items={['先确认沉降异常是否出现在风险源穿越窗口或近邻里程。', '再检查仓压、进排浆流量、浆液压力是否在同一时段波动。', '最后查看盾尾间隙和同步注浆量，判断是否需要补浆或调整注浆压力。']} />
    </Layout>
  );
}

function SegmentTailPage() {
  const latest = useApi('/api/tbm/frontend-summary?deviceId=DZ1360', 8000);
  const latest2 = useApi('/api/tbm/latest-view?deviceId=DZ1360', 8000);
  const history = useApi('/api/tbm/history?deviceId=DZ1360&limit=160', 15000);
  const posCtx = useApi('/api/position-context?deviceId=DZ1360', 8000);
  const src = latest.data || latest2.data || {};
  const h = historyItems(history.data);
  const ring = get(src, 'currentRing', 5325);
  const pos = positionFromContextOrRing(posCtx.data, ring);
  const segPos = get(src, 'segmentPosition', '--');
  const gap1 = get(src, 'shieldTailGap1', 0);
  const gap2 = get(src, 'shieldTailGap2', 0);
  const gap3 = get(src, 'shieldTailGap3', 0);
  const groutTotal = get(src, 'groutTotal', 0);
  const thrust = get(src, 'totalThrust', 0);
  const gapMax = Math.max(num(gap1), num(gap2), num(gap3));
  const gapMin = Math.min(num(gap1), num(gap2), num(gap3));
  const gapSpread = gapMax - gapMin;
  const labs = labels(h);

  return (
    <Layout active="/segment-quality">
      <Hero tag="管片盾尾" title="管片拼装、盾尾间隙与注浆状态" desc="围绕盾尾间隙、当前拼装位置、注浆累计量和推进负载，判断管片拼装和盾尾姿态风险。" value={fmt(gapSpread, 'mm')} label="盾尾间隙差" />
      <AiDiagnosisPanel mode="segment" title="管片盾尾智能复核" question="基于盾尾间隙、管片拼装位置、总推进力、同步注浆和监测异常，生成适合汇报的管片盾尾复核结论。" />
      <ErrorBox error={latest.error || latest2.error || history.error} />
      <Conclusion
        warn={gapSpread > 35}
        title={`盾尾间隙差 ${fmt(gapSpread, 'mm')}，当前拼装位置 ${segPos}`}
        subtitle={`实时位置 ${pos.dk}，现场环号 ${Math.round(num(ring))}。`}
        items={[
          `盾尾间隙 1#/2#/3#：${fmt(gap1, 'mm')}、${fmt(gap2, 'mm')}、${fmt(gap3, 'mm')}。`,
          `同步注浆累计量 ${fmt(groutTotal, 'm³')}，需与盾尾间隙和沉降响应联动分析。`,
          `总推进力 ${fmt(thrust, 'kN')}，用于判断管片受力和姿态调整压力。`,
          gapSpread > 35 ? '盾尾间隙差偏大，建议复核管片姿态、纠偏量和注浆饱满度。' : '盾尾间隙差处于可展示范围，继续关注趋势变化。',
        ]}
      />
      <div className="v413s-grid four">
        <Stat title="1#盾尾间隙" value={fmt(gap1, 'mm')} note="shieldTailGap1" />
        <Stat title="2#盾尾间隙" value={fmt(gap2, 'mm')} note="shieldTailGap2" />
        <Stat title="3#盾尾间隙" value={fmt(gap3, 'mm')} note="shieldTailGap3" />
        <Stat title="拼装位置" value={String(segPos)} note="segmentPosition" />
      </div>
      <div className="v413s-grid four">
        <Metric title="间隙最大值" value={fmt(gapMax, 'mm')} note="三点最大盾尾间隙" />
        <Metric title="间隙最小值" value={fmt(gapMin, 'mm')} note="三点最小盾尾间隙" />
        <Metric title="间隙差" value={fmt(gapSpread, 'mm')} note="姿态协调判断" warn={gapSpread > 35} />
        <Metric title="注浆累计量" value={fmt(groutTotal, 'm³')} note="同步注浆参考" />
      </div>
      <div className="v413s-grid two">
        <Chart title="1#盾尾间隙趋势" labs={labs} vals={values(h, 'shieldTailGap1')} />
        <Chart title="2#盾尾间隙趋势" labs={labs} vals={values(h, 'shieldTailGap2')} />
      </div>
      <div className="v413s-grid two">
        <Chart title="3#盾尾间隙趋势" labs={labs} vals={values(h, 'shieldTailGap3')} />
        <Chart title="注浆累计量趋势" labs={labs} vals={values(h, 'groutTotal')} />
      </div>
      <Actions title="管片盾尾复核动作" items={['复核盾尾间隙差是否持续扩大，判断是否存在姿态偏差。', '结合拼装位置和总推进力，检查管片拼装是否受推进姿态影响。', '联动同步注浆累计量和沉降监测，判断是否需要补浆或调整注浆压力。']} />
    </Layout>
  );
}

export default function V413RouteSwitch({ fallback }: { fallback: React.ReactNode }) {
  const path = window.location.pathname || '/';
  if (path === '/operation-diagnosis') return <OperationDiagnosisPage />;
  if (path === '/slurry-grouting') return <SlurryGroutingPage />;
  if (path === '/segment-quality') return <SegmentTailPage />;
  return <><GlobalGuidanceRibbon />{fallback}</>;
}
