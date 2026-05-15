import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import './v429-v2-advanced-three-pages.css';

type AnyObj = Record<string, any>;

const NAV = [
  ['/', '指挥总览', '当前环'],
  ['/intelligent-analysis', '智能研判', '诊断'],
  ['/project-docs', '项目书', '依据'],
  ['/risk-replay', '风险复盘', '窗口'],
  ['/monitoring-alerts', '监测异常', '预警'],
  ['/operation-diagnosis', '参数诊断', '组合'],
  ['/slurry-grouting', '泥水注浆', '沉降'],
  ['/segment-quality', '管片盾尾', '拼装'],
  ['/events', '事件闭环', '处置'],
  ['/data-import', '数据接入', '映射'],
  ['/system-status', '系统状态', '质量'],
  ['/evidence', '证据链', '追溯'],
];

function apiBase() {
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8100`;
}

function useSpecial(interval = 8000) {
  const [data, setData] = useState<AnyObj | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/api/report-cockpit/specialized-pages-v2?deviceId=DZ1360`);
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
    <div className="v429v2">
      <header className="v429v2-top">
        <div className="v429v2-brand">
          <span>AUTONOMOUS SHIELD TUNNELING SYSTEM</span>
          <b>盾构施工高级诊断驾驶舱</b>
        </div>
        <nav>
          {NAV.map(([href, title, sub]) => (
            <a key={href} href={href} className={path === href ? 'active' : ''}>
              <b>{title}</b>
              <span>{sub}</span>
            </a>
          ))}
        </nav>
        <div className="v429v2-clock">
          <b>{new Date().toLocaleDateString()}</b>
          <span>高级诊断</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function Hero({ data, generatedAt }: { data: AnyObj; generatedAt: string }) {
  return (
    <section className={`v429v2-hero ${levelClass(data.level)}`}>
      <div>
        <span>{data.subtitle}</span>
        <h1>{data.title}</h1>
        <p>{data.summary}</p>
      </div>
      <div className="v429v2-hero-score">
        <b>{fmt(data.score)}</b>
        <em>{data.level || '--'} · {generatedAt}</em>
      </div>
    </section>
  );
}

function Card({ m }: { m: AnyObj }) {
  return (
    <div className={`v429v2-card ${levelClass(m.status)}`}>
      <span>{m.title}</span>
      <b>{fmt(m.value, m.unit || '')}</b>
      <em>{m.note || m.status}</em>
      <i style={{ width: `${Math.max(4, Math.min(100, n(m.score)))}%` }} />
    </div>
  );
}

function MetricGrid({ items }: { items: AnyObj[] }) {
  return <section className="v429v2-metric-grid">{(items || []).map((m, i) => <Card m={m} key={`${m.title}-${i}`} />)}</section>;
}

function scoreGauge(score: number, level: string) {
  return {
    series: [{
      type: 'gauge',
      min: 0,
      max: 100,
      radius: '92%',
      progress: { show: true, width: 16 },
      axisLine: { lineStyle: { width: 16, color: [[0.4, '#38f5b1'], [0.6, '#ffbd6b'], [0.8, '#ffd45c'], [1, '#ff4d5d']] } },
      pointer: { width: 5 },
      axisLabel: { color: '#baf8ff' },
      splitLine: { lineStyle: { color: '#baf8ff' } },
      detail: { valueAnimation: true, formatter: `${score.toFixed(0)}\n${level}`, color: '#fff', fontSize: 20 },
      data: [{ value: score }],
    }],
  };
}

function componentRadar(components: AnyObj[]) {
  const rows = components || [];
  return {
    radar: {
      radius: '66%',
      indicator: rows.map((x) => ({ name: x.name, max: 100 })),
      axisName: { color: '#baf8ff' },
      splitLine: { lineStyle: { color: 'rgba(18,217,255,.24)' } },
      splitArea: { areaStyle: { color: ['rgba(18,217,255,.04)', 'rgba(18,217,255,.10)'] } },
      axisLine: { lineStyle: { color: 'rgba(18,217,255,.22)' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: rows.map((x) => n(x.score)),
        areaStyle: { color: 'rgba(255,212,92,.22)' },
        lineStyle: { color: '#ffd45c', width: 3 },
        itemStyle: { color: '#ff4d5d' },
      }],
    }],
  };
}

function componentBar(components: AnyObj[]) {
  const rows = components || [];
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 82, right: 32, top: 24, bottom: 32 },
    xAxis: { type: 'value', max: 100, axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    yAxis: { type: 'category', data: rows.map((x) => x.name).reverse(), axisLabel: { color: '#eaffff' } },
    series: [{
      type: 'bar',
      data: rows.map((x) => x.score).reverse(),
      label: { show: true, position: 'right', color: '#eaffff' },
      itemStyle: {
        color: (p: any) => {
          const v = p.value;
          if (v >= 80) return '#ff4d5d';
          if (v >= 60) return '#ffd45c';
          if (v >= 40) return '#ffbd6b';
          return '#12d9ff';
        },
      },
    }],
  };
}

function metricBar(items: AnyObj[], name = '指标') {
  const rows = items || [];
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 24, top: 28, bottom: 62 },
    xAxis: { type: 'category', data: rows.map((x) => x.title), axisLabel: { color: '#baf8ff', interval: 0, rotate: 25 } },
    yAxis: { type: 'value', axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    series: [{ name, type: 'bar', data: rows.map((x) => x.value), itemStyle: { color: '#20d3ee' }, label: { show: true, position: 'top', color: '#eaffff', formatter: (p: any) => fmt(p.value, rows[p.dataIndex]?.unit || '') } }],
  };
}

function trendOption(rows: AnyObj[]) {
  const data = rows || [];
  const xs = data.map((x) => x.time || '');
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
      { name: '推进速度', type: 'line', smooth: true, data: data.map((x) => n(x.advanceSpeed)), lineStyle: { color: '#38f5b1', width: 3 }, itemStyle: { color: '#38f5b1' } },
      { name: '开挖仓压力1#', type: 'line', smooth: true, data: data.map((x) => n(x.chamberPressure1)), lineStyle: { color: '#12d9ff', width: 3 }, itemStyle: { color: '#12d9ff' } },
      { name: '盾尾间隙1#', type: 'bar', yAxisIndex: 1, data: data.map((x) => n(x.shieldTailGap1)), itemStyle: { color: '#ffd45c' } },
    ],
  };
}

function flowOption(flow: AnyObj) {
  return {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'sankey',
      emphasis: { focus: 'adjacency' },
      nodeAlign: 'justify',
      data: [{ name: '进浆' }, { name: '开挖仓' }, { name: '排浆' }, { name: '差值' }],
      links: [
        { source: '进浆', target: '开挖仓', value: Math.max(0.1, Math.abs(n(flow.inFlow))) },
        { source: '开挖仓', target: '排浆', value: Math.max(0.1, Math.abs(n(flow.outFlow))) },
        { source: '开挖仓', target: '差值', value: Math.max(0.1, Math.abs(n(flow.balance))) },
      ],
      label: { color: '#eaffff' },
      lineStyle: { color: 'gradient', curveness: 0.5 },
    }],
  };
}

function poseRadar(pose: AnyObj) {
  return {
    radar: {
      radius: '66%',
      indicator: [
        { name: '盾首水平', max: 100 },
        { name: '盾首垂直', max: 100 },
        { name: '盾尾水平', max: 100 },
        { name: '盾尾垂直', max: 100 },
        { name: '滚转×10', max: 60 },
        { name: '俯仰×10', max: 60 },
      ],
      axisName: { color: '#baf8ff' },
      splitLine: { lineStyle: { color: 'rgba(18,217,255,.24)' } },
      splitArea: { areaStyle: { color: ['rgba(18,217,255,.04)', 'rgba(18,217,255,.10)'] } },
      axisLine: { lineStyle: { color: 'rgba(18,217,255,.22)' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: [Math.abs(n(pose.headH)), Math.abs(n(pose.headV)), Math.abs(n(pose.tailH)), Math.abs(n(pose.tailV)), Math.abs(n(pose.roll) * 10), Math.abs(n(pose.pitch) * 10)],
        areaStyle: { color: 'rgba(18,217,255,.24)' },
        lineStyle: { color: '#38f5b1', width: 3 },
        itemStyle: { color: '#ffd45c' },
      }],
    }],
  };
}

function Process({ type }: { type: 'operation' | 'slurry' | 'segment' }) {
  const map = {
    operation: ['推进协调', '仓压稳定', '刀盘负荷', '盾尾间隙', '监测响应'],
    slurry: ['环流平衡', '仓压稳定', '浆液状态', '同步注浆', '沉降响应'],
    segment: ['盾尾间隙', '导向姿态', '间隙趋势', '管片复核', '沉降响应'],
  };
  return <div className="v429v2-process">{map[type].map((x, i) => <React.Fragment key={x}><b>{x}</b>{i < map[type].length - 1 ? <span>→</span> : null}</React.Fragment>)}</div>;
}

function Components({ rows }: { rows: AnyObj[] }) {
  return (
    <div className="v429v2-component-list">
      {(rows || []).map((x, i) => (
        <article key={i} className={levelClass(x.level)}>
          <b>{fmt(x.score)}</b>
          <div>
            <h4>{x.name}｜{x.level}</h4>
            <p>{(x.evidence || []).join('；')}</p>
            <em>{x.suggestion}</em>
          </div>
        </article>
      ))}
    </div>
  );
}

function Alerts({ rows }: { rows: AnyObj[] }) {
  return (
    <div className="v429v2-alert-list">
      {(rows || []).slice(0, 10).map((x, i) => (
        <article key={`${x.pointCode || i}-${i}`} className={levelClass(x.level)}>
          <div><b>{x.pointCode || '--'}</b><span>{x.level || '--'} · {x.item || '--'}</span></div>
          <em>{x.priorityReason || x.latestTime || '--'}</em>
        </article>
      ))}
      {(!rows || !rows.length) ? <p className="v429v2-muted">暂无关联监测异常。</p> : null}
    </div>
  );
}

function AdvancedPage({ data, generatedAt, type }: { data: AnyObj; generatedAt: string; type: 'operation' | 'slurry' | 'segment' }) {
  const gauge = useMemo(() => scoreGauge(n(data.score), data.level), [data.score, data.level]);
  const radar = useMemo(() => componentRadar(data.components || []), [JSON.stringify(data.components || [])]);
  const compBar = useMemo(() => componentBar(data.components || []), [JSON.stringify(data.components || [])]);
  const trend = useMemo(() => trendOption(data.trend || []), [JSON.stringify(data.trend || [])]);
  const pressureOrMetric = useMemo(() => {
    if (type === 'operation') return metricBar(data.pressures || [], '仓压');
    if (type === 'slurry') return flowOption(data.flowBalance || {});
    return metricBar(data.tailGaps || [], '盾尾间隙');
  }, [type, JSON.stringify(data.pressures || []), JSON.stringify(data.flowBalance || {}), JSON.stringify(data.tailGaps || [])]);
  const secondary = useMemo(() => {
    if (type === 'operation') return metricBar(data.tailGaps || [], '盾尾间隙');
    if (type === 'slurry') return metricBar((data.cards || []).filter((x: AnyObj) => ['开挖仓压力', '进浆流量', '排浆流量', '流量差', '同步注浆量', '注浆压力'].includes(x.title)), '泥水注浆指标');
    return poseRadar(data.pose || {});
  }, [type, JSON.stringify(data.tailGaps || []), JSON.stringify(data.cards || []), JSON.stringify(data.pose || {})]);
  const alertRows = type === 'operation' ? (data.alerts || []) : (data.settlementAlerts || []);

  return (
    <Shell>
      <Hero data={data} generatedAt={generatedAt} />
      <MetricGrid items={data.cards || []} />

      <section className="v429v2-top-grid">
        <div className="v429v2-panel"><h3>综合风险评分</h3><EChart option={gauge} height={300} /></div>
        <div className="v429v2-panel"><h3>诊断链路</h3><Process type={type} /><Components rows={data.components || []} /></div>
        <div className="v429v2-panel"><h3>风险分项雷达</h3><EChart option={radar} height={300} /></div>
      </section>

      <section className="v429v2-grid2">
        <div className="v429v2-panel"><h3>分项评分排序</h3><EChart option={compBar} height={340} /></div>
        <div className="v429v2-panel"><h3>{type === 'operation' ? '仓压分布' : type === 'slurry' ? '进排浆平衡' : '盾尾间隙分布'}</h3><EChart option={pressureOrMetric} height={340} /></div>
      </section>

      <section className="v429v2-grid2">
        <div className="v429v2-panel"><h3>{type === 'segment' ? '姿态偏差雷达' : type === 'slurry' ? '泥水注浆指标' : '盾尾间隙分布'}</h3><EChart option={secondary} height={340} /></div>
        <div className="v429v2-panel"><h3>关联监测响应</h3><Alerts rows={alertRows} /></div>
      </section>

      <section className="v429v2-panel"><h3>近时段趋势对比</h3><EChart option={trend} height={330} /></section>
    </Shell>
  );
}

export default function V429V2AdvancedThreePages({ fallback }: { fallback: React.ReactNode }) {
  const path = window.location.pathname;
  const enabled = ['/operation-diagnosis', '/slurry-grouting', '/segment-quality'].includes(path);
  const { data, error, loading } = useSpecial(8000);

  if (!enabled) return <>{fallback}</>;

  if (!data) {
    return (
      <Shell>
        <section className="v429v2-hero attention">
          <div><span>高级专业诊断</span><h1>{error ? '专业诊断接口暂不可用' : '正在加载高级诊断数据'}</h1><p>{error || '正在汇总参数基线、风险评分、监测响应和专业规则。'}</p></div>
          <div className="v429v2-hero-score"><b>{loading ? '加载中' : '待确认'}</b><em>请稍候</em></div>
        </section>
      </Shell>
    );
  }

  if (path === '/operation-diagnosis') return <AdvancedPage data={data.operation || {}} generatedAt={data.generatedAt} type="operation" />;
  if (path === '/slurry-grouting') return <AdvancedPage data={data.slurry || {}} generatedAt={data.generatedAt} type="slurry" />;
  if (path === '/segment-quality') return <AdvancedPage data={data.segment || {}} generatedAt={data.generatedAt} type="segment" />;
  return <>{fallback}</>;
}
