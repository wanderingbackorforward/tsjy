import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import './v425-intelligent-analysis.css';

type AnyObj = Record<string, any>;

const NAV = [
  ['/', '指挥总览', '地图/当前环'],
  ['/intelligent-analysis', '智能研判', 'AI诊断'],
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
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8100`;
}

function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function fmt(v: any, unit = '') {
  if (v === null || v === undefined || v === '') return '--';
  const x = Number(v);
  if (Number.isFinite(x)) {
    const s = Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2);
    return `${s}${unit}`;
  }
  return `${v}${unit}`;
}

function dkFromM(v: any) {
  const x = Number(v);
  if (!Number.isFinite(x)) return '--';
  const km = Math.floor(x / 1000);
  const m = Math.round(x - km * 1000);
  return `DK${km}+${String(m).padStart(3, '0')}`;
}

function levelClass(v: any) {
  const s = String(v || '');
  if (s.includes('报警') || s === 'alarm') return 'alarm';
  if (s.includes('预警') || s === 'warning') return 'warning';
  if (s.includes('关注') || s === 'attention') return 'attention';
  return 'normal';
}

function EChart({ option, height = 300 }: { option: AnyObj; height?: number | string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption(option, true);
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
    };
  }, [option]);
  return <div ref={ref} style={{ width: '100%', height }} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = window.location.pathname;
  return (
    <div className="v425">
      <header className="v425-top">
        <div className="v425-brand">
          <span>AUTONOMOUS SHIELD TUNNELING SYSTEM</span>
          <b>盾构智能研判中心</b>
        </div>
        <nav>
          {NAV.map(([href, title, sub]) => (
            <a key={href} href={href} className={path === href ? 'active' : ''}>
              <b>{title}</b>
              <span>{sub}</span>
            </a>
          ))}
        </nav>
        <div className="v425-clock">
          <b>{new Date().toLocaleDateString()}</b>
          <span>AI研判</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function riskWindowOption(chartData: AnyObj) {
  const rw = chartData?.riskWindow || {};
  const head = n(rw.headMileageM, 54380);
  const items = Array.isArray(rw.items) ? rw.items : [];
  const min = Math.min(head - 120, ...items.map((x: AnyObj) => n(x.startMileageM, head)));
  const max = Math.max(head + 120, ...items.map((x: AnyObj) => n(x.endMileageM, head)));
  const names = items.length ? items.map((x: AnyObj) => String(x.riskName || '风险源').replace('轨道交通3号线葑亭大道站', '3号线葑亭大道站')) : ['当前里程'];

  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const r = items[p.data?.[2]] || {};
        return `${r.riskName || '风险源'}<br/>${r.startMileage || ''} - ${r.endMileage || ''}<br/>${r.matched ? '当前命中' : `距离 ${fmt(r.distanceM, 'm')}`}`;
      },
    },
    grid: { left: 106, right: 30, top: 26, bottom: 42 },
    xAxis: {
      type: 'value',
      min,
      max,
      axisLabel: { color: '#baf8ff', formatter: (v: number) => dkFromM(v) },
      splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } },
    },
    yAxis: { type: 'category', data: names, axisLabel: { color: '#eaffff', width: 96, overflow: 'truncate' } },
    series: [
      {
        name: '风险窗口',
        type: 'custom',
        data: items.length ? items.map((r: AnyObj, idx: number) => [n(r.startMileageM), n(r.endMileageM), idx, r.matched ? 1 : 0]) : [[head - 20, head + 20, 0, 0]],
        renderItem: (params: AnyObj, api: AnyObj) => {
          const start = api.coord([api.value(0), api.value(2)]);
          const end = api.coord([api.value(1), api.value(2)]);
          const height = Math.max(12, api.size([0, 1])[1] * 0.42);
          const matched = api.value(3) === 1;
          return {
            type: 'rect',
            shape: { x: start[0], y: start[1] - height / 2, width: Math.max(3, end[0] - start[0]), height },
            style: {
              fill: matched ? 'rgba(255,212,92,.62)' : 'rgba(18,217,255,.34)',
              stroke: matched ? '#ffd45c' : '#12d9ff',
              lineWidth: 1.5,
              shadowBlur: 12,
              shadowColor: matched ? 'rgba(255,212,92,.58)' : 'rgba(18,217,255,.50)',
            },
          };
        },
      },
      {
        name: '当前盾首',
        type: 'line',
        symbol: 'none',
        data: [[head, 0], [head, Math.max(0, names.length - 1)]],
        markLine: {
          symbol: 'none',
          label: { color: '#ffd45c', formatter: `当前 ${rw.headMileageText || ''}` },
          lineStyle: { color: '#ffd45c', width: 2 },
          data: [{ xAxis: head }],
        },
      },
    ],
  };
}

function parameterTrendOption(chartData: AnyObj) {
  const rows = chartData?.parameterTrend || [];
  const xs = rows.map((x: AnyObj) => x.time || '');
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, textStyle: { color: '#eaffff' } },
    grid: { left: 54, right: 24, top: 44, bottom: 40 },
    xAxis: { type: 'category', data: xs, axisLabel: { color: '#baf8ff', rotate: 35 } },
    yAxis: [
      { type: 'value', name: '速度/压力', axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
      { type: 'value', name: '盾尾间隙', axisLabel: { color: '#baf8ff' }, splitLine: { show: false } },
    ],
    series: [
      { name: '推进速度', type: 'line', smooth: true, data: rows.map((x: AnyObj) => x.advanceSpeed), lineStyle: { color: '#38f5b1', width: 3 }, itemStyle: { color: '#38f5b1' } },
      { name: '开挖仓压力1#', type: 'line', smooth: true, data: rows.map((x: AnyObj) => x.chamberPressure1), lineStyle: { color: '#12d9ff', width: 3 }, itemStyle: { color: '#12d9ff' } },
      { name: '盾尾间隙1#', type: 'bar', yAxisIndex: 1, data: rows.map((x: AnyObj) => x.shieldTailGap1), itemStyle: { color: '#ffd45c' } },
    ],
  };
}

function alertsOption(chartData: AnyObj) {
  const rows = (chartData?.monitoringAlerts || []).slice(0, 14);
  const names = rows.map((x: AnyObj) => x.pointCode || '--').reverse();
  const values = rows.map((x: AnyObj, idx: number) => {
    if (x.distanceM !== null && x.distanceM !== undefined) return Math.max(0.5, n(x.distanceM));
    if (x.reason === '当前风险源') return 1;
    if (x.reason === '邻近风险源') return 2 + idx * 0.2;
    return 4 + idx * 0.3;
  }).reverse();

  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 92, right: 24, top: 28, bottom: 36 },
    xAxis: { type: 'value', name: '距离/优先级', nameTextStyle: { color: '#baf8ff' }, axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: '#eaffff' } },
    series: [
      {
        type: 'bar',
        data: values,
        barWidth: 12,
        label: { show: true, position: 'right', color: '#eaffff' },
        itemStyle: {
          color: (p: any) => {
            const x = rows[rows.length - 1 - p.dataIndex] || {};
            if (x.level === '报警') return '#ff4d5d';
            if (x.level === '预警') return '#ffd45c';
            return '#12d9ff';
          },
        },
      },
    ],
  };
}

function causalGraphOption(chartData: AnyObj) {
  const graph = chartData?.causalGraph || {};
  return {
    tooltip: {},
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        label: { show: true, color: '#eaffff' },
        force: { repulsion: 420, edgeLength: 120 },
        data: (graph.nodes || []).map((x: AnyObj, idx: number) => ({ ...x, symbolSize: idx === 0 ? 64 : 52, itemStyle: { color: idx === 0 ? '#ffd45c' : '#12d9ff' } })),
        links: graph.links || [],
        lineStyle: { color: '#38f5b1', width: 2, curveness: 0.18 },
      },
    ],
  };
}

function FindingCard({ f }: { f: AnyObj }) {
  return (
    <article className={`v425-finding ${levelClass(f.level)}`}>
      <h4>{f.title || '研判发现'}</h4>
      <p>置信度：{fmt((f.confidence ?? 0) * 100, '%')}</p>
      <ul>
        {(f.evidence || []).slice(0, 4).map((e: string, idx: number) => <li key={idx}>{e}</li>)}
      </ul>
    </article>
  );
}

function useDiagnosis(mode: string) {
  const [data, setData] = useState<AnyObj | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async (nextMode = mode) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase()}/api/intelligent-analysis/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'DZ1360', mode: nextMode }),
      });
      const json = await res.json();
      setData(json?.data || json);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(mode);
  }, []);

  return { data, error, loading, load };
}

function IntelligentAnalysisPage() {
  const [mode, setMode] = useState('rule');
  const { data, error, loading, load } = useDiagnosis(mode);

  const chartData = data?.chartData || {};
  const findings = data?.keyFindings || [];
  const actions = data?.recommendedActions || [];
  const chains = data?.causalChains || [];
  const gaps = data?.dataGaps || [];

  const riskOption = useMemo(() => riskWindowOption(chartData), [JSON.stringify(chartData?.riskWindow || {})]);
  const paramOption = useMemo(() => parameterTrendOption(chartData), [JSON.stringify(chartData?.parameterTrend || [])]);
  const alertOption = useMemo(() => alertsOption(chartData), [JSON.stringify(chartData?.monitoringAlerts || [])]);
  const graphOption = useMemo(() => causalGraphOption(chartData), [JSON.stringify(chartData?.causalGraph || {})]);

  return (
    <Shell>
      <section className={`v425-hero ${levelClass(data?.overallLevel)}`}>
        <div>
          <span>智能研判中心 / Rule + Agent + ECharts</span>
          <h1>{data?.summary || '正在聚合导向位置、盾构参数、监测异常与风险源台账'}</h1>
          <p>
            输出必须带证据、置信度和数据缺口；图表由固定 ECharts 模板渲染，避免 AI 直接生成不可控图表。
          </p>
        </div>
        <div className="v425-hero-level">
          <b>{data?.overallLevel || '--'}</b>
          <em>{data?.source || 'rule'} · {data?.latencyMs ? `${data.latencyMs}ms` : '待刷新'}</em>
        </div>
      </section>

      <section className="v425-toolbar">
        <label>
          研判模式
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="rule">规则优先：最稳定</option>
            <option value="ai">DeepSeek 总结：失败自动兜底</option>
            <option value="reasoner">Reasoner 复杂归因：较慢</option>
          </select>
        </label>
        <button onClick={() => load(mode)} disabled={loading}>{loading ? '研判中...' : '重新研判'}</button>
        {data?.fallbackUsed ? <span className="v425-warn">AI 调用失败，已使用规则兜底：{data?.aiError}</span> : null}
        {error ? <span className="v425-warn">接口错误：{error}</span> : null}
      </section>

      <section className="v425-grid4">
        <div className="v425-panel">
          <h3>风险窗口</h3>
          <EChart option={riskOption} height={300} />
        </div>
        <div className="v425-panel">
          <h3>参数联动</h3>
          <EChart option={paramOption} height={300} />
        </div>
        <div className="v425-panel">
          <h3>邻近预警</h3>
          <EChart option={alertOption} height={300} />
        </div>
        <div className="v425-panel">
          <h3>因果链路</h3>
          <EChart option={graphOption} height={300} />
        </div>
      </section>

      <section className="v425-grid2">
        <div className="v425-panel">
          <h3>关键发现</h3>
          <div className="v425-finding-grid">
            {findings.length ? findings.map((f: AnyObj, idx: number) => <FindingCard f={f} key={idx} />) : <p className="v425-muted">暂无发现，检查 /api/intelligent-analysis/diagnose。</p>}
          </div>
        </div>

        <div className="v425-panel">
          <h3>建议动作</h3>
          <div className="v425-actions">
            {actions.map((a: AnyObj, idx: number) => (
              <article key={idx}>
                <b>{a.priority || '中'}</b>
                <div>
                  <h4>{a.action}</h4>
                  <p>{a.reason}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="v425-grid2">
        <div className="v425-panel">
          <h3>AI / 规则归因链</h3>
          <div className="v425-chain-list">
            {chains.map((c: AnyObj, idx: number) => (
              <article key={idx}>
                <h4>{c.name}</h4>
                <p>{(c.nodes || []).join(' → ')}</p>
                <em>置信度：{fmt((c.confidence ?? 0) * 100, '%')}</em>
              </article>
            ))}
          </div>
        </div>
        <div className="v425-panel">
          <h3>数据缺口</h3>
          <div className="v425-gap-list">
            {gaps.length ? gaps.map((g: AnyObj, idx: number) => (
              <article key={idx}>
                <b>{g.field}</b>
                <span>{g.impact}</span>
              </article>
            )) : <p className="v425-muted">当前未识别到阻断性数据缺口。</p>}
          </div>
        </div>
      </section>

      <section className="v425-panel">
        <h3>证据来源索引</h3>
        <div className="v425-evidence-index">
          {Object.entries(data?.evidenceIndex || {}).map(([k, v]) => (
            <p key={k}><span>{k}</span><b>{String(v || '--')}</b></p>
          ))}
        </div>
      </section>
    </Shell>
  );
}

export default function V425IntelligentAnalysis({ fallback }: { fallback: React.ReactNode }) {
  const path = window.location.pathname;
  if (path === '/intelligent-analysis' || path === '/ai-diagnosis' || path === '/smart-analysis') {
    return <IntelligentAnalysisPage />;
  }
  return (
    <>
      {fallback}
      <a className="v425-floating-ai" href="/intelligent-analysis">智能研判</a>
    </>
  );
}
