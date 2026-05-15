import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import './v427-report-cockpit.css';

type AnyObj = Record<string, any>;

const NAV = [
  ['/', '指挥总览', '地图/当前环'],
  ['/intelligent-analysis', '智能研判', '施工诊断'],
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

function useReport(interval = 8000) {
  const [data, setData] = useState<AnyObj | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/api/report-cockpit/summary?deviceId=DZ1360`);
      const json = await res.json();
      setData(json?.data || json);
      setError('');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const timer = window.setInterval(load, interval);
    return () => window.clearInterval(timer);
  }, [interval]);
  return { data, error, loading, load };
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
  if (s.includes('报警')) return 'alarm';
  if (s.includes('预警')) return 'warning';
  if (s.includes('关注') || s.includes('复核')) return 'attention';
  return 'normal';
}

function EChart({ option, height = 280 }: { option: AnyObj; height?: number | string }) {
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
    <div className="v427">
      <header className="v427-top">
        <div className="v427-brand"><span>AUTONOMOUS SHIELD TUNNELING SYSTEM</span><b>盾构施工研判驾驶舱</b></div>
        <nav>{NAV.map(([href, title, sub]) => <a key={href} href={href} className={path === href ? 'active' : ''}><b>{title}</b><span>{sub}</span></a>)}</nav>
        <div className="v427-clock"><b>{new Date().toLocaleDateString()}</b><span>实时研判</span></div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function RiskScene({ data }: { data: AnyObj }) {
  const pos = data.position || {};
  const risk = data.currentRisk || {};
  return <div className="v427-scene">
    <div className="v427-scene-bg" /><div className="v427-tunnel-tube" />
    <div className="v427-machine"><i /><b>{pos.headMileageText || '--'}</b><span>盾首</span></div>
    <div className="v427-risk-board"><b>{risk.name || '--'}</b><span>{risk.relation || '风险窗口'}</span></div>
    <div className="v427-mile v427-mile-tail">盾尾 {pos.tailMileageText || '--'}</div>
    <div className="v427-mile v427-mile-head">盾首 {pos.headMileageText || '--'}</div>
    <div className="v427-tube-axis" />
  </div>;
}

function riskWindowOption(data: AnyObj) {
  const head = n(data.position?.headMileageM, 54380);
  const items = data.riskWindows || [];
  const min = Math.min(head - 120, ...items.map((x: AnyObj) => n(x.startMileageM, head)));
  const max = Math.max(head + 120, ...items.map((x: AnyObj) => n(x.endMileageM, head)));
  const names = items.length ? items.map((x: AnyObj) => String(x.riskName || '风险源').replace('轨道交通3号线葑亭大道站', '3号线葑亭大道站')) : ['当前里程'];
  return { tooltip: { trigger: 'item', formatter: (p: any) => { const r = items[p.data?.[2]] || {}; return `${r.riskName || '风险源'}<br/>${r.startMileage || ''} - ${r.endMileage || ''}<br/>${r.distanceText || ''}`; } }, grid: { left: 106, right: 30, top: 26, bottom: 42 }, xAxis: { type: 'value', min, max, axisLabel: { color: '#baf8ff', formatter: (v: number) => dkFromM(v) }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } }, yAxis: { type: 'category', data: names, axisLabel: { color: '#eaffff', width: 96, overflow: 'truncate' } }, series: [{ name: '风险窗口', type: 'custom', data: items.length ? items.map((r: AnyObj, idx: number) => [n(r.startMileageM), n(r.endMileageM), idx, r.matched ? 1 : 0]) : [[head - 20, head + 20, 0, 0]], renderItem: (_params: AnyObj, api: AnyObj) => { const start = api.coord([api.value(0), api.value(2)]); const end = api.coord([api.value(1), api.value(2)]); const height = Math.max(12, api.size([0, 1])[1] * 0.42); const matched = api.value(3) === 1; return { type: 'rect', shape: { x: start[0], y: start[1] - height / 2, width: Math.max(3, end[0] - start[0]), height }, style: { fill: matched ? 'rgba(255,212,92,.62)' : 'rgba(18,217,255,.34)', stroke: matched ? '#ffd45c' : '#12d9ff', lineWidth: 1.5, shadowBlur: 12, shadowColor: matched ? 'rgba(255,212,92,.58)' : 'rgba(18,217,255,.50)' } }; } }, { name: '当前盾首', type: 'line', symbol: 'none', data: [[head, 0], [head, Math.max(0, names.length - 1)]], markLine: { symbol: 'none', label: { color: '#ffd45c', formatter: `当前 ${data.position?.headMileageText || ''}` }, lineStyle: { color: '#ffd45c', width: 2 }, data: [{ xAxis: head }] } }] };
}

function parameterOption(data: AnyObj) {
  const rows = data.parameterTrend || [];
  const xs = rows.map((x: AnyObj) => x.time || '');
  return { tooltip: { trigger: 'axis' }, legend: { top: 0, textStyle: { color: '#eaffff' } }, grid: { left: 54, right: 24, top: 44, bottom: 40 }, xAxis: { type: 'category', data: xs, axisLabel: { color: '#baf8ff', rotate: 35 } }, yAxis: [{ type: 'value', name: '速度/压力', axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } }, { type: 'value', name: '盾尾间隙', axisLabel: { color: '#baf8ff' }, splitLine: { show: false } }], series: [{ name: '推进速度', type: 'line', smooth: true, data: rows.map((x: AnyObj) => x.advanceSpeed), lineStyle: { color: '#38f5b1', width: 3 }, itemStyle: { color: '#38f5b1' } }, { name: '开挖仓压力1#', type: 'line', smooth: true, data: rows.map((x: AnyObj) => x.chamberPressure1), lineStyle: { color: '#12d9ff', width: 3 }, itemStyle: { color: '#12d9ff' } }, { name: '盾尾间隙1#', type: 'bar', yAxisIndex: 1, data: rows.map((x: AnyObj) => x.shieldTailGap1), itemStyle: { color: '#ffd45c' } }] };
}

function alertRankOption(data: AnyObj) {
  const rows = (data.priorityAlerts || []).slice(0, 10).reverse();
  return { tooltip: { trigger: 'axis' }, grid: { left: 88, right: 42, top: 24, bottom: 34 }, xAxis: { type: 'value', axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } }, yAxis: { type: 'category', data: rows.map((x: AnyObj) => x.pointCode || '--'), axisLabel: { color: '#eaffff' } }, series: [{ type: 'bar', data: rows.map((x: AnyObj, idx: number) => x.distanceM == null ? idx + 1 : Math.max(0.5, n(x.distanceM))), label: { show: true, position: 'right', color: '#eaffff', formatter: (p: any) => rows[p.dataIndex]?.priorityReason || '' }, itemStyle: { color: (p: any) => { const x = rows[p.dataIndex] || {}; if (x.level === '报警') return '#ff4d5d'; if (x.level === '预警') return '#ffd45c'; return '#12d9ff'; } } }] };
}

function AlertList({ data }: { data: AnyObj }) {
  const rows = (data.priorityAlerts || []).slice(0, 8);
  return <div className="v427-alert-list">{rows.map((x: AnyObj, idx: number) => <article key={`${x.pointCode}-${idx}`} className={levelClass(x.level)}><div><b>{x.pointCode || '--'}</b><span>{x.level || '--'} · {x.item || '--'}</span></div><em>{x.priorityReason || '--'}</em><small>{String(x.latestTime || '').slice(0, 16)}</small></article>)}{!rows.length ? <p className="v427-muted">暂无优先预警测点。</p> : null}</div>;
}

function FactCards({ data }: { data: AnyObj }) {
  return <section className="v427-facts"><div><span>盾首位置</span><b>{data.position?.headMileageText || '--'}</b><em>{data.position?.sourceText || '位置待确认'}</em></div><div><span>当前风险源</span><b>{data.currentRisk?.name || '--'}</b><em>{data.currentRisk?.relation || '风险窗口'}</em></div><div><span>预警概况</span><b>{data.alertSummary?.alarm || 0} 报警 / {data.alertSummary?.warning || 0} 预警</b><em>{data.alertSummary?.review || 0} 条待复核</em></div><div><span>导向/环号</span><b>{data.position?.guidanceRing || '--'} / {data.position?.engineeringRing || '--'}</b><em>导向环 / 工程环</em></div></section>;
}

function Actions({ data }: { data: AnyObj }) { return <div className="v427-action-list">{(data.actions || []).slice(0, 4).map((a: AnyObj, idx: number) => <article key={idx}><b>{a.priority || '中'}</b><div><h4>{a.action}</h4><p>{a.reason}</p></div></article>)}</div>; }
function Findings({ data }: { data: AnyObj }) { return <div className="v427-finding-list">{(data.findings || []).slice(0, 5).map((f: AnyObj, idx: number) => <article key={idx} className={levelClass(f.level)}><h4>{f.title}</h4><p>可信度：{f.confidenceText}</p><ul>{(f.evidence || []).map((e: string, i: number) => <li key={i}>{e}</li>)}</ul></article>)}</div>; }

function HomeRefactor() {
  const { data, error, loading, load } = useReport(8000);
  const riskOption = useMemo(() => riskWindowOption(data || {}), [JSON.stringify(data?.riskWindows || []), data?.position?.headMileageM]);
  const paramOption = useMemo(() => parameterOption(data || {}), [JSON.stringify(data?.parameterTrend || [])]);
  const alertOption = useMemo(() => alertRankOption(data || {}), [JSON.stringify(data?.priorityAlerts || [])]);
  return <Shell><section className={`v427-hero ${levelClass(data?.overallLevel)}`}><div><span>指挥总览 / 位置 / 风险 / 处置</span><h1>{data?.headline || '正在汇总盾构位置、风险源和监测异常'}</h1><p>{data?.brief || '页面围绕当前位置、当前风险源、优先预警测点和建议动作组织。'}</p></div><div className="v427-hero-value"><b>{data?.overallLevel || '--'}</b><em>{loading ? '刷新中' : `更新 ${data?.generatedAt || '--'}`}</em></div></section>{error ? <div className="v427-error">接口异常：{error}</div> : null}<FactCards data={data || {}} /><section className="v427-layout-home"><div className="v427-panel v427-large"><h3>工程主视图</h3><RiskScene data={data || {}} /></div><div className="v427-panel"><h3>当前优先处置测点</h3><AlertList data={data || {}} /></div><div className="v427-panel"><h3>今日建议动作</h3><Actions data={data || {}} /></div></section><section className="v427-grid3"><div className="v427-panel"><h3>风险窗口里程轴</h3><EChart option={riskOption} height={280} /></div><div className="v427-panel"><h3>近时段参数联动</h3><EChart option={paramOption} height={280} /></div><div className="v427-panel"><h3>邻近预警优先级</h3><EChart option={alertOption} height={280} /></div></section><button className="v427-refresh" onClick={load}>刷新研判</button></Shell>;
}

function IntelligentRefactor() {
  const { data, error, loading, load } = useReport(10000);
  const riskOption = useMemo(() => riskWindowOption(data || {}), [JSON.stringify(data?.riskWindows || []), data?.position?.headMileageM]);
  const paramOption = useMemo(() => parameterOption(data || {}), [JSON.stringify(data?.parameterTrend || [])]);
  const alertOption = useMemo(() => alertRankOption(data || {}), [JSON.stringify(data?.priorityAlerts || [])]);
  return <Shell><section className={`v427-hero ${levelClass(data?.overallLevel)}`}><div><span>智能研判 / 结论 / 证据 / 动作</span><h1>{data?.headline || '正在形成施工研判结论'}</h1><p>{data?.sourceNote || '本页只保留现场汇报需要的结论、证据、建议动作和待补数据。'}</p></div><div className="v427-hero-value"><b>{data?.overallLevel || '--'}</b><em>{loading ? '研判中' : '综合研判'}</em></div></section>{error ? <div className="v427-error">接口异常：{error}</div> : null}<section className="v427-grid3"><div className="v427-panel"><h3>风险窗口</h3><EChart option={riskOption} height={300} /></div><div className="v427-panel"><h3>参数联动</h3><EChart option={paramOption} height={300} /></div><div className="v427-panel"><h3>优先预警</h3><EChart option={alertOption} height={300} /></div></section><section className="v427-grid2"><div className="v427-panel"><h3>关键发现</h3><Findings data={data || {}} /></div><div className="v427-panel"><h3>建议动作</h3><Actions data={data || {}} /></div></section><section className="v427-grid2"><div className="v427-panel"><h3>重点测点清单</h3><AlertList data={data || {}} /></div><div className="v427-panel"><h3>还需补齐的数据</h3><div className="v427-gap-list">{(data?.dataGaps || []).map((g: AnyObj, idx: number) => <article key={idx}><b>{g.title}</b><span>{g.impact}</span></article>)}</div></div></section><button className="v427-refresh" onClick={load}>重新研判</button></Shell>;
}

export default function V427ReportCockpit({ fallback }: { fallback: React.ReactNode }) {
  const path = window.location.pathname;
  if (path === '/') return <HomeRefactor />;
  if (path === '/intelligent-analysis' || path === '/ai-diagnosis' || path === '/smart-analysis') return <IntelligentRefactor />;
  return <>{fallback}</>;
}
