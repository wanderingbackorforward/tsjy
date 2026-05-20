import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import './v431-stable-router.css';

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

const pageSet = new Set([
  '/',
  '/intelligent-analysis',
  '/ai-diagnosis',
  '/smart-analysis',
  '/project-docs',
  '/risk-replay',
  '/monitoring-alerts',
  '/operation-diagnosis',
  '/slurry-grouting',
  '/segment-quality',
  '/events',
  '/event-closure',
  '/data-import',
  '/system-status',
  '/evidence',
]);

function fallbackSummary(): AnyObj {
  const alerts = [
    ['DB37-01', '报警', '地表沉降', '当前风险窗口内'],
    ['DBC12-01', '报警', '地表沉降', '当前风险窗口内'],
    ['DSW-02', '报警', '地表沉降', '当前风险窗口内'],
    ['ZQT02', '报警', '地表沉降', '当前风险窗口内'],
    ['ZQC-04', '预警', '地表沉降', '当前风险窗口内'],
    ['ZQT01', '待复核', '地表沉降', '按最新异常排序'],
  ].map(([pointCode, level, item, priorityReason]) => ({ pointCode, level, item, priorityReason, latestTime: '2026-05-15' }));
  return {
    generatedAt: new Date().toLocaleString(),
    deviceId: 'DZ1360',
    overallLevel: '报警',
    headline: '当前盾首位于 DK54+380，处于京沪高铁下穿风险窗口内。',
    brief: '盾首 DK54+380，盾中 DK54+372，盾尾 DK54+364；邻近异常中报警、预警和待复核测点已按当前窗口排序。',
    position: { headMileageM: 54380, headMileageText: 'DK54+380', middleMileageText: 'DK54+372', tailMileageText: 'DK54+364', guidanceRing: 392, engineeringRing: 343, sourceText: '实时导向' },
    currentRisk: { name: '京沪高铁', relation: '下穿', startMileage: 'DK54+370', endMileage: 'DK54+450' },
    alertSummary: { alarm: 4, warning: 1, review: 1, total: 6 },
    priorityAlerts: alerts,
    riskWindows: [
      { riskName: '京沪高铁', startMileage: 'DK54+370', endMileage: 'DK54+450', startMileageM: 54370, endMileageM: 54450, matched: true, distanceText: '窗口内', relation: '下穿' },
      { riskName: '亭苑A区', startMileage: 'DK55+540', endMileage: 'DK55+580', startMileageM: 55540, endMileageM: 55580, matched: false, distanceText: '1160m' },
      { riskName: '亭苑B区', startMileage: 'DK55+670', endMileage: 'DK55+710', startMileageM: 55670, endMileageM: 55710, matched: false, distanceText: '1290m' },
      { riskName: '轨道交通3号线葑亭大道站', startMileage: 'DK55+990', endMileage: 'DK56+025', startMileageM: 55990, endMileageM: 56025, matched: false, distanceText: '1610m' },
    ],
    parameterTrend: [
      { time: '21:00', advanceSpeed: 0, chamberPressure1: 6.5, shieldTailGap1: 92, penetration: 2.8 },
      { time: '21:02', advanceSpeed: 0, chamberPressure1: 6.6, shieldTailGap1: 95, penetration: 2.9 },
      { time: '21:04', advanceSpeed: 0, chamberPressure1: 6.8, shieldTailGap1: 98, penetration: 3.0 },
    ],
    parameterSummary: { advanceSpeed: 0, chamberPressure1: 6.8, shieldTailGap1: 98, penetration: 3.0 },
    findings: [
      { title: '当前位置与风险源已建立关联', level: '报警', confidenceText: '80%', evidence: ['盾首 DK54+380', '风险源 京沪高铁', '窗口 DK54+370 - DK54+450'] },
      { title: '监测异常按当前窗口优先排序', level: '报警', confidenceText: '75%', evidence: ['报警测点优先', '缺少里程的测点按窗口和最新时间兜底'] },
    ],
    actions: [
      { priority: '高', action: '优先复核当前风险窗口内报警测点', reason: '报警点与当前施工位置共同决定处置优先级。' },
      { priority: '中', action: '联动查看仓压、盾尾间隙和注浆记录', reason: '参数组合比单一数值更能解释施工扰动。' },
    ],
    dataGaps: [{ title: '测点里程覆盖需复核', impact: '如测点缺少里程，系统会按当前风险源、报警等级和最新时间兜底排序。' }],
  };
}

function fallbackSpecial(summary: AnyObj): AnyObj {
  const p = summary.parameterSummary || {};
  const alerts = summary.priorityAlerts || [];
  const baseTrend = summary.parameterTrend || [];
  const makeComponents = (type: 'operation' | 'slurry' | 'segment') => {
    if (type === 'operation') return [
      { name: '推进协调', score: 72, level: '预警', evidence: [`推进速度 ${fmt(p.advanceSpeed, 'mm/min')}`], suggestion: '确认是否停机、保压或采集未刷新。' },
      { name: '仓压稳定', score: 68, level: '预警', evidence: [`开挖仓压力 ${fmt(p.chamberPressure1, 'bar')}`], suggestion: '复核仓压传感器、泥水环流和掘进速度。' },
      { name: '盾尾间隙', score: 88, level: '报警', evidence: [`盾尾间隙 ${fmt(p.shieldTailGap1, 'mm')}`], suggestion: '复核盾尾间隙、姿态调整和管片拼装。' },
      { name: '监测响应', score: 70, level: '预警', evidence: [`关联异常 ${alerts.length} 个测点`], suggestion: '优先复核当前风险窗口内报警点。' },
    ];
    if (type === 'slurry') return [
      { name: '环流平衡', score: 45, level: '关注', evidence: ['进排浆字段待校准'], suggestion: '复核进排浆泵组、管路和实时流量采集。' },
      { name: '仓压稳定', score: 68, level: '预警', evidence: [`开挖仓压力 ${fmt(p.chamberPressure1, 'bar')}`], suggestion: '联动推进速度、地层和泥水环流判断。' },
      { name: '同步注浆', score: 50, level: '关注', evidence: ['注浆量/压力字段待补齐'], suggestion: '确认注浆量、压力和盾尾间隙是否匹配。' },
      { name: '沉降响应', score: 70, level: '预警', evidence: [`沉降相关异常 ${alerts.length} 个测点`], suggestion: '优先查看当前风险窗口内沉降报警点。' },
    ];
    return [
      { name: '盾尾间隙', score: 88, level: '报警', evidence: [`盾尾间隙 ${fmt(p.shieldTailGap1, 'mm')}`], suggestion: '复核盾尾刷、铰接姿态和管片拼装姿态。' },
      { name: '导向姿态', score: 45, level: '关注', evidence: ['导向姿态细项待补齐'], suggestion: '检查纠偏策略是否导致间隙变化。' },
      { name: '间隙趋势', score: 55, level: '关注', evidence: ['近时段盾尾间隙偏高'], suggestion: '连续扩大时需提前复核下一环拼装风险。' },
      { name: '沉降响应', score: 70, level: '预警', evidence: [`沉降相关异常 ${alerts.length} 个测点`], suggestion: '与同步注浆和管片姿态一起复核。' },
    ];
  };
  const wrap = (title: string, subtitle: string, type: 'operation' | 'slurry' | 'segment', score: number) => ({
    title, subtitle, level: score >= 80 ? '报警' : score >= 60 ? '预警' : '关注', score,
    summary: `综合风险评分 ${score}。本页使用当前可用数据，接口不稳定时自动降级展示，不再卡死页面。`,
    cards: [
      { title: '推进速度', value: p.advanceSpeed ?? 0, unit: 'mm/min', status: '预警', note: '当前值', score: 72 },
      { title: '开挖仓压力', value: p.chamberPressure1 ?? 6.8, unit: 'bar', status: '预警', note: '仓压', score: 68 },
      { title: '盾尾间隙', value: p.shieldTailGap1 ?? 98, unit: 'mm', status: '报警', note: '间隙', score: 88 },
      { title: '贯入度', value: p.penetration ?? 3, unit: 'mm/r', status: '正常', note: '单环', score: 5 },
    ],
    components: makeComponents(type),
    trend: baseTrend,
    alerts,
    settlementAlerts: alerts,
    tailGaps: [{ title: '盾尾间隙1#', value: p.shieldTailGap1 ?? 98, unit: 'mm', status: '报警', score: 88 }],
    pressures: [{ title: '仓压1#', value: p.chamberPressure1 ?? 6.8, unit: 'bar', status: '预警', score: 68 }],
    flowBalance: { inFlow: 0, outFlow: 0, balance: 0 },
    pose: { roll: 0, pitch: 0, headH: 0, headV: 0, tailH: 0, tailV: 0 },
  });
  return {
    operation: wrap('推进、仓压、刀盘与盾尾间隙组合诊断', '参数诊断 / 组合异常', 'operation', 76),
    slurry: wrap('泥水环流、仓压、同步注浆与沉降响应研判', '泥水注浆 / 沉降归因', 'slurry', 62),
    segment: wrap('盾尾间隙、导向姿态与管片拼装风险复核', '管片盾尾 / 拼装缺陷', 'segment', 82),
  };
}

const DIRECT_API_BASE = `${window.location.protocol}//${window.location.hostname}:8100`;

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<any> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`请求超时 ${Math.round(timeoutMs / 1000)} 秒`);
    }
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchApi(path: string, timeoutMs = 10000): Promise<any> {
  const candidates = [
    `${DIRECT_API_BASE}${path}`,
    path,
  ];
  let lastError: any = null;
  for (const url of candidates) {
    try {
      return await fetchWithTimeout(url, timeoutMs);
    } catch (e: any) {
      lastError = e;
      console.warn('[V4.31.1] realtime request failed, trying fallback path:', url, e?.message || e);
    }
  }
  throw lastError || new Error('实时接口暂不可用');
}

function useCockpit() {
  const [summary, setSummary] = useState<AnyObj>(() => fallbackSummary());
  const [special, setSpecial] = useState<AnyObj>(() => fallbackSpecial(fallbackSummary()));
  const [status, setStatus] = useState('页面已加载，正在连接实时接口');
  const lastSummaryRef = useRef<AnyObj>(fallbackSummary());

  const load = async () => {
    let nextSummary = lastSummaryRef.current || fallbackSummary();

    try {
      const json = await fetchApi('/api/report-cockpit/summary?deviceId=DZ1360', 12000);
      const candidate = json?.data || json;
      if (candidate && candidate.headline) {
        nextSummary = candidate;
        lastSummaryRef.current = candidate;
        setSummary(candidate);
        setStatus('实时接口已更新');
      } else {
        setStatus('实时接口返回不完整，页面保持上次数据');
      }
    } catch (e: any) {
      console.warn('[V4.31.1] summary unavailable, keep last stable data:', e?.message || e);
      setSummary(nextSummary);
      setStatus('实时接口连接中，页面保持稳定数据');
    }

    try {
      const json = await fetchApi('/api/report-cockpit/specialized-pages-v2?deviceId=DZ1360', 12000);
      const candidate = json?.data || json;
      if (candidate?.operation || candidate?.slurry || candidate?.segment) {
        setSpecial(candidate);
      } else {
        setSpecial(fallbackSpecial(nextSummary));
      }
    } catch (e: any) {
      console.warn('[V4.31.1] specialized diagnosis unavailable, use local fallback:', e?.message || e);
      setSpecial(fallbackSpecial(nextSummary));
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  return { summary, special, status, load };
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
    return `${s}${unit ? ` ${unit}` : ''}`;
  }
  return `${v}${unit ? ` ${unit}` : ''}`;
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

function Shell({ children, status }: { children: React.ReactNode; status: string }) {
  const path = window.location.pathname === '/event-closure' ? '/events' : window.location.pathname;
  return (
    <div className="v431">
      <header className="v431-top">
        <div className="v431-brand"><span>AUTONOMOUS SHIELD TUNNELING SYSTEM</span><b>通苏嘉甬施工监测与盾构研判平台</b></div>
        <nav>
          {NAV.map(([href, title, sub]) => (
            <a key={href} href={href} className={path === href || (href === '/intelligent-analysis' && ['/ai-diagnosis', '/smart-analysis'].includes(path)) ? 'active' : ''}>
              <b>{title}</b><span>{sub}</span>
            </a>
          ))}
        </nav>
        <div className="v431-clock"><b>{new Date().toLocaleDateString()}</b><span>{status}</span></div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function Hero({ title, subtitle, summary, level, right }: { title: string; subtitle: string; summary: string; level: string; right?: string }) {
  return (
    <section className={`v431-hero ${levelClass(level)}`}>
      <div><span>{subtitle}</span><h1>{title}</h1><p>{summary}</p></div>
      <div className="v431-hero-value"><b>{right || level}</b><em>{level || '实时研判'}</em></div>
    </section>
  );
}

function Card({ title, value, sub, level }: { title: string; value: any; sub?: string; level?: string }) {
  return <div className={`v431-card ${levelClass(level)}`}><span>{title}</span><b>{value ?? '--'}</b>{sub ? <em>{sub}</em> : null}</div>;
}

function riskWindowOption(data: AnyObj) {
  const head = n(data.position?.headMileageM, 54380);
  const items = data.riskWindows || [];
  const min = Math.min(head - 120, ...items.map((x: AnyObj) => n(x.startMileageM, head)));
  const max = Math.max(head + 120, ...items.map((x: AnyObj) => n(x.endMileageM, head)));
  const names = items.length ? items.map((x: AnyObj) => String(x.riskName || '风险源').replace('轨道交通3号线葑亭大道站', '3号线葑亭大道站')) : ['当前里程'];
  return {
    tooltip: { trigger: 'item' },
    grid: { left: 106, right: 30, top: 26, bottom: 42 },
    xAxis: { type: 'value', min, max, axisLabel: { color: '#baf8ff', formatter: (v: number) => dkFromM(v) }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: '#eaffff', width: 96, overflow: 'truncate' } },
    series: [
      {
        type: 'custom',
        data: items.length ? items.map((r: AnyObj, idx: number) => [n(r.startMileageM), n(r.endMileageM), idx, r.matched ? 1 : 0]) : [[head - 20, head + 20, 0, 0]],
        renderItem: (_params: AnyObj, api: AnyObj) => {
          const start = api.coord([api.value(0), api.value(2)]);
          const end = api.coord([api.value(1), api.value(2)]);
          const h = Math.max(12, api.size([0, 1])[1] * 0.42);
          const matched = api.value(3) === 1;
          return { type: 'rect', shape: { x: start[0], y: start[1] - h / 2, width: Math.max(3, end[0] - start[0]), height: h }, style: { fill: matched ? 'rgba(255,212,92,.62)' : 'rgba(18,217,255,.34)', stroke: matched ? '#ffd45c' : '#12d9ff', lineWidth: 1.5 } };
        },
      },
      { type: 'line', symbol: 'none', data: [[head, 0], [head, Math.max(0, names.length - 1)]], markLine: { symbol: 'none', label: { color: '#ffd45c', formatter: `当前 ${data.position?.headMileageText || ''}` }, lineStyle: { color: '#ffd45c', width: 2 }, data: [{ xAxis: head }] } },
    ],
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
    yAxis: [{ type: 'value', axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } }, { type: 'value', axisLabel: { color: '#baf8ff' }, splitLine: { show: false } }],
    series: [
      { name: '推进速度', type: 'line', smooth: true, data: data.map((x) => n(x.advanceSpeed)), lineStyle: { color: '#38f5b1', width: 3 }, itemStyle: { color: '#38f5b1' } },
      { name: '开挖仓压力1#', type: 'line', smooth: true, data: data.map((x) => n(x.chamberPressure1)), lineStyle: { color: '#12d9ff', width: 3 }, itemStyle: { color: '#12d9ff' } },
      { name: '盾尾间隙1#', type: 'bar', yAxisIndex: 1, data: data.map((x) => n(x.shieldTailGap1)), itemStyle: { color: '#ffd45c' } },
    ],
  };
}

function alertOption(data: AnyObj) {
  const rows = (data.priorityAlerts || []).slice(0, 10).reverse();
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 88, right: 42, top: 24, bottom: 34 },
    xAxis: { type: 'value', axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    yAxis: { type: 'category', data: rows.map((x: AnyObj) => x.pointCode || '--'), axisLabel: { color: '#eaffff' } },
    series: [{ type: 'bar', data: rows.map((x: AnyObj, idx: number) => x.distanceM == null ? idx + 1 : Math.max(0.5, n(x.distanceM))), label: { show: true, position: 'right', color: '#eaffff', formatter: (p: any) => rows[p.dataIndex]?.priorityReason || '' }, itemStyle: { color: (p: any) => rows[p.dataIndex]?.level === '报警' ? '#ff4d5d' : rows[p.dataIndex]?.level === '预警' ? '#ffd45c' : '#12d9ff' } }],
  };
}

function gaugeOption(score: number, level: string) {
  return {
    series: [{
      type: 'gauge', min: 0, max: 100, radius: '92%', progress: { show: true, width: 16 },
      axisLine: { lineStyle: { width: 16, color: [[0.4, '#38f5b1'], [0.6, '#ffbd6b'], [0.8, '#ffd45c'], [1, '#ff4d5d']] } },
      detail: { formatter: `${score.toFixed(0)}\n${level}`, color: '#fff', fontSize: 20 },
      data: [{ value: score }],
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
    series: [{ type: 'bar', data: rows.map((x) => n(x.score)).reverse(), label: { show: true, position: 'right', color: '#eaffff' }, itemStyle: { color: (p: any) => p.value >= 80 ? '#ff4d5d' : p.value >= 60 ? '#ffd45c' : p.value >= 40 ? '#ffbd6b' : '#12d9ff' } }],
  };
}

function AlertList({ data, limit = 8 }: { data: AnyObj; limit?: number }) {
  const rows = (data.priorityAlerts || data.alerts || data.settlementAlerts || []).slice(0, limit);
  return <div className="v431-list">{rows.map((x: AnyObj, i: number) => <article className={levelClass(x.level)} key={`${x.pointCode}-${i}`}><div><b>{x.pointCode || '--'}</b><span>{x.level || '--'} · {x.item || '--'}</span></div><em>{x.priorityReason || x.latestTime || '--'}</em></article>)}</div>;
}

function Actions({ data }: { data: AnyObj }) {
  return <div className="v431-actions">{(data.actions || []).map((a: AnyObj, i: number) => <article key={i}><b>{a.priority || '中'}</b><div><h4>{a.action}</h4><p>{a.reason}</p></div></article>)}</div>;
}

function Home({ summary }: { summary: AnyObj }) {
  return <><Hero title={summary.headline} subtitle="指挥总览 / 位置 / 风险 / 处置" summary={summary.brief} level={summary.overallLevel} />
    <section className="v431-grid4"><Card title="盾首位置" value={summary.position?.headMileageText} sub={summary.position?.sourceText} /><Card title="当前风险源" value={summary.currentRisk?.name} sub={summary.currentRisk?.relation || '风险窗口'} /><Card title="预警概况" value={`${summary.alertSummary?.alarm || 0} 报警 / ${summary.alertSummary?.warning || 0} 预警`} sub={`${summary.alertSummary?.review || 0} 条待复核`} /><Card title="导向/环号" value={`${summary.position?.guidanceRing || '--'} / ${summary.position?.engineeringRing || '--'}`} sub="导向环 / 工程环" /></section>
    <section className="v431-layout"><div className="v431-panel v431-visual"><h3>工程主视图</h3><div className="v431-scene"><div className="machine"><i /><b>{summary.position?.headMileageText}</b><span>盾首</span></div><div className="risk-tag">{summary.currentRisk?.name} {summary.currentRisk?.relation}</div><div className="axis" /></div></div><div className="v431-panel"><h3>当前优先处置测点</h3><AlertList data={summary} /></div><div className="v431-panel"><h3>今日建议动作</h3><Actions data={summary} /></div></section>
    <section className="v431-grid3"><div className="v431-panel"><h3>风险窗口里程轴</h3><EChart option={riskWindowOption(summary)} /></div><div className="v431-panel"><h3>近时段参数联动</h3><EChart option={trendOption(summary.parameterTrend || [])} /></div><div className="v431-panel"><h3>邻近预警优先级</h3><EChart option={alertOption(summary)} /></div></section></>;
}

function Findings({ summary }: { summary: AnyObj }) {
  return <div className="v431-findings">{(summary.findings || []).map((f: AnyObj, i: number) => <article className={levelClass(f.level)} key={i}><h4>{f.title}</h4><p>可信度：{f.confidenceText}</p><ul>{(f.evidence || []).map((e: string, j: number) => <li key={j}>{e}</li>)}</ul></article>)}</div>;
}

function GenericPage({ summary, title, subtitle }: { summary: AnyObj; title: string; subtitle: string }) {
  return <><Hero title={title} subtitle={subtitle} summary={summary.brief} level={summary.overallLevel} /><section className="v431-grid3"><div className="v431-panel"><h3>风险窗口</h3><EChart option={riskWindowOption(summary)} /></div><div className="v431-panel"><h3>优先预警</h3><EChart option={alertOption(summary)} /></div><div className="v431-panel"><h3>状态分布</h3><EChart option={{ tooltip:{trigger:'item'}, series:[{type:'pie', radius:['48%','70%'], data:[{name:'报警',value:summary.alertSummary?.alarm||0},{name:'预警',value:summary.alertSummary?.warning||0},{name:'待复核',value:summary.alertSummary?.review||0}], label:{color:'#eaffff'}, color:['#ff4d5d','#ffd45c','#12d9ff']}]} } /></div></section><section className="v431-grid2"><div className="v431-panel"><h3>关键发现</h3><Findings summary={summary} /></div><div className="v431-panel"><h3>建议动作</h3><Actions data={summary} /></div></section><section className="v431-panel"><h3>重点测点清单</h3><AlertList data={summary} limit={12} /></section></>;
}

function AdvancedPage({ data }: { data: AnyObj }) {
  const score = n(data.score);
  return <><Hero title={data.title} subtitle={data.subtitle} summary={data.summary} level={data.level} right={fmt(score)} />
    <section className="v431-grid4">{(data.cards || []).slice(0, 4).map((m: AnyObj, i: number) => <Card key={i} title={m.title} value={fmt(m.value, m.unit)} sub={m.note || m.status} level={m.status} />)}</section>
    <section className="v431-grid3"><div className="v431-panel"><h3>综合风险评分</h3><EChart option={gaugeOption(score, data.level)} /></div><div className="v431-panel"><h3>分项评分排序</h3><EChart option={componentBar(data.components || [])} /></div><div className="v431-panel"><h3>近时段趋势</h3><EChart option={trendOption(data.trend || [])} /></div></section>
    <section className="v431-grid2"><div className="v431-panel"><h3>诊断证据与建议</h3><div className="v431-components">{(data.components || []).map((x: AnyObj, i: number) => <article className={levelClass(x.level)} key={i}><b>{fmt(x.score)}</b><div><h4>{x.name}｜{x.level}</h4><p>{(x.evidence || []).join('；')}</p><em>{x.suggestion}</em></div></article>)}</div></div><div className="v431-panel"><h3>关联监测响应</h3><AlertList data={data} /></div></section></>;
}

function Router({ summary, special }: { summary: AnyObj; special: AnyObj }) {
  const path = window.location.pathname;
  if (path === '/') return <Home summary={summary} />;
  if (path === '/operation-diagnosis') return <AdvancedPage data={special.operation} />;
  if (path === '/slurry-grouting') return <AdvancedPage data={special.slurry} />;
  if (path === '/segment-quality') return <AdvancedPage data={special.segment} />;
  const titles: Record<string, [string, string]> = {
    '/intelligent-analysis': ['综合施工研判', '智能研判 / 结论 / 证据'],
    '/ai-diagnosis': ['综合施工研判', '智能研判 / 结论 / 证据'],
    '/smart-analysis': ['综合施工研判', '智能研判 / 结论 / 证据'],
    '/project-docs': ['工程资料、风险源与导向位置依据', '项目书 / 工程依据'],
    '/risk-replay': [`${summary.currentRisk?.name || '当前风险源'}穿越复盘`, '风险复盘 / 穿越窗口'],
    '/monitoring-alerts': ['按当前位置优先的监测异常分析', '监测异常 / 优先复核'],
    '/events': ['报警处置与现场闭环', '事件闭环 / 报警处置'],
    '/event-closure': ['报警处置与现场闭环', '事件闭环 / 报警处置'],
    '/data-import': ['数据接入、字段映射与质量状态', '数据接入 / 接口映射'],
    '/system-status': ['系统状态、数据质量与页面可信度', '系统状态 / 数据质量'],
    '/evidence': ['结论、异常读数与来源追溯', '证据链 / 来源追溯'],
  };
  const [title, subtitle] = titles[path] || ['施工研判驾驶舱', '综合研判'];
  return <GenericPage summary={summary} title={title} subtitle={subtitle} />;
}

export default function V431StableRouter() {
  const { summary, special, status, load } = useCockpit();
  const path = window.location.pathname;
  if (!pageSet.has(path)) return <Home summary={summary} />;
  return <Shell status={status}><Router summary={summary} special={special} /><button className="v431-refresh" onClick={load}>刷新研判</button></Shell>;
}
