import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import './v422-operator-pages.css';

type AnyObj = Record<string, any>;
type PageKey =
  | 'overview'
  | 'project'
  | 'risk'
  | 'monitoring'
  | 'operation'
  | 'slurry'
  | 'segment'
  | 'events'
  | 'data'
  | 'system'
  | 'evidence';

const NAV: Array<[string, string, string, PageKey]> = [
  ['/', '指挥总览', '地图/当前环', 'overview'],
  ['/project-docs', '项目书', '工程依据', 'project'],
  ['/risk-replay', '风险复盘', '穿越窗口', 'risk'],
  ['/monitoring-alerts', '监测异常', '阈值趋势', 'monitoring'],
  ['/operation-diagnosis', '参数诊断', '组合异常', 'operation'],
  ['/slurry-grouting', '泥水注浆', '沉降归因', 'slurry'],
  ['/segment-quality', '管片盾尾', '拼装缺陷', 'segment'],
  ['/events', '事件闭环', '报警处置', 'events'],
  ['/data-import', '数据接入', '接口/映射', 'data'],
  ['/system-status', '系统状态', '数据质量', 'system'],
  ['/evidence', '证据链', '来源追溯', 'evidence'],
];

function routeToPage(pathname: string): PageKey | null {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/' || path === '/advanced-cockpit') return 'overview';
  if (path === '/project-docs' || path === '/project-book') return 'project';
  if (path === '/risk-replay') return 'risk';
  if (path === '/monitoring-alerts') return 'monitoring';
  if (path === '/operation-diagnosis') return 'operation';
  if (path === '/slurry-grouting') return 'slurry';
  if (path === '/segment-quality') return 'segment';
  if (path === '/events' || path === '/event-closure') return 'events';
  if (path === '/data-import') return 'data';
  if (path === '/system-status') return 'system';
  if (path === '/evidence') return 'evidence';
  return null;
}

function apiBase() {
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8100`;
}

function useApi(path: string, intervalMs = 0) {
  const [data, setData] = useState<AnyObj | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
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
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    if (intervalMs > 0) timer = window.setInterval(load, intervalMs);
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [path, intervalMs]);

  return { data, error, loading };
}

function usePostDiagnosis(mode: string, question: string) {
  const [strategy, setStrategy] = useState<'rule' | 'ai' | 'reasoner'>('rule');
  const [result, setResult] = useState<AnyObj | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (nextStrategy: 'rule' | 'ai' | 'reasoner' = strategy) => {
    setStrategy(nextStrategy);
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase()}/api/ai-diagnosis/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, strategy: nextStrategy, deviceId: 'DZ1360', question }),
      });
      const json = await res.json();
      setResult(json?.data ?? json);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run('rule');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return { result, loading, error, strategy, run };
}

function val(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(v: any, unit = '') {
  if (v === null || v === undefined || v === '') return '--';
  const n = Number(v);
  if (!Number.isFinite(n)) return `${v}${unit ? ` ${unit}` : ''}`;
  const s = Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2);
  return `${s}${unit ? ` ${unit}` : ''}`;
}

function shortDate(v: any) {
  if (!v) return '--';
  return String(v).replace('T', ' ').slice(0, 16);
}

function field(root: AnyObj | null | undefined, key: string) {
  const d = root || {};
  const f = d?.fields?.[key] || d?.machine?.fields?.[key] || d?.tbm?.fields?.[key];
  if (f && typeof f === 'object') return f.displayValue ?? f.value ?? f.rawValue;
  return d[key] ?? d?.tbm?.[key];
}

function cnItem(v: any) {
  const raw = String(v || '').trim();
  const map: Record<string, string> = {
    surface_settlement: '地表沉降',
    ground_settlement: '地表沉降',
    vertical_displacement: '竖向位移',
    horizontal_displacement: '水平位移',
    tunnel_horizontal_displacement: '隧道水平位移',
    tunnel_vertical_displacement: '隧道竖向位移',
    building_vertical_displacement: '建筑物竖向位移',
    building_settlement: '建筑物沉降',
    pipeline_settlement: '管线沉降',
    unknown: '待归类',
  };
  return map[raw.toLowerCase()] || raw || '待归类';
}

function cnLevel(v: any) {
  const raw = String(v || '').toLowerCase();
  if (raw.includes('alarm') || raw.includes('critical') || raw.includes('报警')) return '报警';
  if (raw.includes('warning') || raw.includes('预警')) return '预警';
  if (raw.includes('confirm') || raw.includes('unknown') || raw.includes('待') || raw.includes('复核')) return '待复核';
  if (raw.includes('normal') || raw.includes('正常')) return '正常';
  return String(v || '待复核');
}

function cnRiskType(v: any) {
  const raw = String(v || '').trim();
  const key = raw.toLowerCase();
  const map: Record<string, string> = {
    railway: '既有铁路',
    existing_railway: '既有铁路',
    high_speed_rail: '高速铁路',
    railway_line: '既有铁路',
    metro: '轨道交通',
    subway: '轨道交通',
    station: '车站',
    building: '建构筑物',
    buildings: '建构筑物',
    structure: '建构筑物',
    factory: '厂房',
    plant: '厂房',
    river_lake: '河湖水体',
    river: '河流',
    lake: '湖泊',
    water: '水体',
    pipeline: '地下管线',
    pipe: '地下管线',
    road: '道路',
    highway: '高速公路',
    bridge: '桥梁',
    viaduct: '高架桥',
    tunnel: '既有隧道',
    unknown: '待归类',
  };
  return map[key] || raw || '风险源';
}

function cnRiskLevel(v: any) {
  const raw = String(v || '').trim();
  const key = raw.toLowerCase();
  const map: Record<string, string> = {
    high: '重点关注',
    medium: '一般关注',
    low: '常规关注',
    major: '重大风险',
    important: '重点关注',
    normal: '常规关注',
    warning: '预警关注',
    alarm: '报警关注',
    critical: '严重关注',
    unknown: '待评估',
  };
  return map[key] || raw || '待评估';
}

function cnEventType(v: any) {
  const raw = String(v || '').trim();
  const key = raw.toLowerCase();
  const map: Record<string, string> = {
    grouting_abnormal: '注浆参数异常',
    face_pressure_abnormal: '开挖仓压力异常',
    settlement_warning: '沉降预警',
    monitoring_alarm: '监测报警',
    monitoring_warning: '监测预警',
    risk_crossing: '风险源穿越',
    slurry_abnormal: '泥水环流异常',
    segment_abnormal: '管片拼装异常',
    tail_gap_abnormal: '盾尾间隙异常',
    operation_abnormal: '掘进参数异常',
    info: '记录',
    warning: '预警',
    alarm: '报警',
  };
  return map[key] || raw || '现场事件';
}

function cnPositionSource(v: any) {
  const raw = String(v || '').trim();
  const key = raw.toLowerCase();
  const map: Record<string, string> = {
    guidance: '实时导向',
    live_guidance_frame: '实时导向帧',
    guidance_missing_fallback_current_ring: '导向缺失，环号兜底',
    fallback: '兜底推算',
    fallback_only: '仅兜底',
    derived_display_calibration: '演示标定',
    demo_calibrated_from_extracted_anchor: '演示标定',
  };
  return map[key] || raw || '待确认';
}

function cnSchemaVersion(v: any) {
  const raw = String(v || '').trim();
  if (!raw) return '--';
  if (raw === 'v4.20_full_0_38') return '导向字段 0～38 完整版';
  return raw.replace('full', '完整').replace('guidance', '导向');
}

function cnFileType(v: any) {
  const raw = String(v || '').trim();
  const key = raw.toLowerCase();
  const map: Record<string, string> = {
    pdf: 'PDF文件',
    doc: 'Word文档',
    docx: 'Word文档',
    xls: 'Excel表格',
    xlsx: 'Excel表格',
    csv: 'CSV数据',
    image: '图片',
    txt: '文本',
  };
  return map[key] || raw || '文件';
}


function countBy(items: any[], fn: (x: any) => string) {
  const m = new Map<string, number>();
  items.forEach((x) => m.set(fn(x), (m.get(fn(x)) || 0) + 1));
  return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
}

function echartsTheme() {
  return {
    textStyle: { color: '#dffcff' },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(2, 16, 34, .92)',
      borderColor: 'rgba(18,217,255,.45)',
      textStyle: { color: '#eaffff' },
    },
    legend: { textStyle: { color: '#dffcff' } },
  };
}

function Chart({ option, height = 260 }: { option: AnyObj; height?: number | string }) {
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

function Shell({ page, children }: { page: PageKey; children: React.ReactNode }) {
  return (
    <div className="v422">
      <header className="v422-top">
        <a className="v422-brand" href="/">
          <span>AUTONOMOUS SHIELD TUNNELING SYSTEM</span>
          <b>盾构自主掘进研判驾驶舱</b>
        </a>
        <nav>
          {NAV.map(([href, title, sub, key]) => (
            <a href={href} key={href} className={page === key ? 'active' : ''}>
              <b>{title}</b>
              <span>{sub}</span>
            </a>
          ))}
        </nav>
        <div className="v422-live">
          <b>{new Date().toLocaleDateString()}</b>
          <span>实时研判</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function Hero({ tag, title, desc, value, label }: { tag: string; title: string; desc: string; value?: string; label?: string }) {
  return (
    <section className="v422-hero">
      <div>
        <span>{tag}</span>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      <div className="v422-hero-value">
        <b>{value || '--'}</b>
        <small>{label || '实时状态'}</small>
      </div>
    </section>
  );
}

function Panel({ title, children, className = '', foot }: { title: string; children: React.ReactNode; className?: string; foot?: React.ReactNode }) {
  return (
    <section className={`v422-panel ${className}`}>
      <h3>{title}</h3>
      {children}
      {foot ? <small>{foot}</small> : null}
    </section>
  );
}

function Metric({ title, value, note, tone = '' }: { title: string; value: React.ReactNode; note?: React.ReactNode; tone?: string }) {
  return (
    <article className={`v422-metric ${tone}`}>
      <span>{title}</span>
      <b>{value}</b>
      {note ? <p>{note}</p> : null}
    </article>
  );
}

function Empty({ text = '暂无数据' }: { text?: string }) {
  return <div className="v422-empty">{text}</div>;
}

function AiPanel({ mode, question, title }: { mode: string; question: string; title: string }) {
  const ai = usePostDiagnosis(mode, question);
  const content = ai.result?.content || ai.result?.diagnosis?.summary || ai.result?.fallbackRule?.summary || '等待诊断结果';
  return (
    <Panel title={title} className="ai-panel">
      <div className="v422-ai-actions">
        <button className={ai.strategy === 'rule' ? 'active' : ''} disabled={ai.loading} onClick={() => ai.run('rule')}>规则兜底</button>
        <button className={ai.strategy === 'ai' ? 'active' : ''} disabled={ai.loading} onClick={() => ai.run('ai')}>DeepSeek</button>
        <button className={ai.strategy === 'reasoner' ? 'active' : ''} disabled={ai.loading} onClick={() => ai.run('reasoner')}>复杂归因</button>
      </div>
      {ai.error ? <div className="v422-error">智能诊断失败：{ai.error}</div> : null}
      <pre>{ai.loading ? '生成中...' : String(content)}</pre>
      <small>AI 仅作辅助研判；待校准字段必须结合现场复核。</small>
    </Panel>
  );
}

function useCommonData() {
  const pos = useApi('/api/position-context?deviceId=DZ1360', 6000);
  const tbm = useApi('/api/tbm/frontend-summary?deviceId=DZ1360', 6000);
  const history = useApi('/api/tbm/history?deviceId=DZ1360&limit=120', 8000);
  const nearby = useApi('/api/monitoring/nearby-alerts?deviceId=DZ1360&limit=48', 8000);
  const risks = useApi('/api/risk-sources', 12000);
  const events = useApi('/api/events?limit=30', 12000);
  const monitoring = useApi('/api/monitoring/summary', 12000);
  const health = useApi('/api/file-health', 15000);
  const docs = useApi('/api/documents?pageSize=20', 15000);
  const alerts = useApi('/api/monitoring/alerts?pageSize=80', 15000);
  const guidance = useApi('/api/tbm/guidance/latest?deviceId=DZ1360', 8000);
  const gaps = useApi('/api/data-gaps', 20000);
  const quality = useApi('/api/data-quality/summary', 20000);
  return { pos, tbm, history, nearby, risks, events, monitoring, health, docs, alerts, guidance, gaps, quality };
}

function getPos(d: ReturnType<typeof useCommonData>) {
  return d.pos.data || {};
}

function getRisk(pos: AnyObj) {
  return pos?.matchedRiskSources?.[0] || pos?.nearestRiskSources?.[0] || null;
}

function historyItems(history: AnyObj | null | undefined) {
  return Array.isArray(history?.items) ? history!.items : [];
}


function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function riskWindowOption(pos: AnyObj) {
  const head = num(pos.headMileageM, 54380);
  const rawRisks = [
    ...(pos.matchedRiskSources || []),
    ...(pos.nearestRiskSources || []),
  ];
  const dedup: AnyObj[] = [];
  const seen = new Set<string>();
  rawRisks.forEach((r: AnyObj) => {
    const key = `${r.riskName || ''}-${r.startMileageM || ''}-${r.endMileageM || ''}`;
    if (!seen.has(key) && r.startMileageM != null && r.endMileageM != null) {
      seen.add(key);
      dedup.push(r);
    }
  });

  const risks = dedup.slice(0, 7);
  const min = Math.min(head - 120, ...risks.map((r: AnyObj) => num(r.startMileageM, head)));
  const max = Math.max(head + 120, ...risks.map((r: AnyObj) => num(r.endMileageM, head)));
  const names = risks.length
    ? risks.map((r: AnyObj) => String(r.riskName || '风险源').replace('轨道交通3号线葑亭大道站', '3号线葑亭大道站'))
    : ['当前里程'];

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: AnyObj) => {
        const r = risks[p.data?.[2]] || {};
        return `${r.riskName || '风险源'}<br/>${r.startMileage || ''} - ${r.endMileage || ''}<br/>距当前：${fmt(r.distanceM, 'm')}`;
      },
    },
    grid: { left: 100, right: 28, top: 24, bottom: 42 },
    xAxis: {
      type: 'value',
      min,
      max,
      axisLabel: {
        color: '#baf8ff',
        formatter: (v: number) => `DK${Math.floor(v / 1000)}+${String(Math.round(v % 1000)).padStart(3, '0')}`,
      },
      splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } },
      axisLine: { lineStyle: { color: 'rgba(18,217,255,.35)' } },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: '#eaffff', width: 90, overflow: 'truncate' },
      axisLine: { lineStyle: { color: 'rgba(18,217,255,.35)' } },
    },
    series: [
      {
        name: '风险窗口',
        type: 'custom',
        data: risks.length ? risks.map((r: AnyObj, idx: number) => [num(r.startMileageM), num(r.endMileageM), idx]) : [[head - 20, head + 20, 0]],
        renderItem: (params: AnyObj, api: AnyObj) => {
          const start = api.coord([api.value(0), api.value(2)]);
          const end = api.coord([api.value(1), api.value(2)]);
          const height = Math.max(12, api.size([0, 1])[1] * 0.42);
          const isMatched = params.dataIndex === 0 && (pos.matchedRiskSources || []).length;
          return {
            type: 'rect',
            shape: {
              x: start[0],
              y: start[1] - height / 2,
              width: Math.max(3, end[0] - start[0]),
              height,
            },
            style: {
              fill: isMatched ? 'rgba(255,212,92,.56)' : 'rgba(18,217,255,.34)',
              stroke: isMatched ? '#ffd45c' : '#12d9ff',
              lineWidth: 1.5,
              shadowBlur: 12,
              shadowColor: isMatched ? 'rgba(255,212,92,.55)' : 'rgba(18,217,255,.55)',
            },
          };
        },
        encode: { x: [0, 1], y: 2 },
      },
      {
        name: '当前盾首',
        type: 'line',
        symbol: 'none',
        data: [[head, 0], [head, Math.max(0, names.length - 1)]],
        lineStyle: { color: '#ff4d5d', width: 3, type: 'dashed' },
        markLine: {
          symbol: 'none',
          label: { color: '#ffd45c', formatter: `当前 ${pos.headMileageText || ''}` },
          lineStyle: { color: '#ffd45c', width: 2 },
          data: [{ xAxis: head }],
        },
      },
    ],
  };
}

function poseRadarOption(pos: AnyObj) {
  const m = pos.guidanceMetrics || {};
  const v = (k: string, scale = 1) => Math.abs(val(m[k]?.value, 0) * scale);
  return {
    ...echartsTheme(),
    radar: {
      radius: '66%',
      indicator: [
        { name: '盾首水平', max: 80 },
        { name: '盾首垂直', max: 80 },
        { name: '盾中水平', max: 80 },
        { name: '盾尾水平', max: 80 },
        { name: '滚转×10', max: 80 },
        { name: '俯仰×10', max: 80 },
      ],
      axisName: { color: '#baf8ff' },
      splitLine: { lineStyle: { color: 'rgba(18,217,255,.25)' } },
      splitArea: { areaStyle: { color: ['rgba(18,217,255,.04)', 'rgba(18,217,255,.11)'] } },
      axisLine: { lineStyle: { color: 'rgba(18,217,255,.25)' } },
    },
    series: [{ type: 'radar', data: [{ value: [v('headHorizontalOffset'), v('headVerticalOffset'), v('middleHorizontalOffset'), v('tailHorizontalOffset'), v('roll', 10), v('pitch', 10)], areaStyle: { color: 'rgba(18,217,255,.26)' }, lineStyle: { color: '#38f5b1', width: 3 }, itemStyle: { color: '#ffd45c' } }] }],
  };
}

function predictionOption(pos: AnyObj) {
  const gm = pos.guidanceMetrics || {};
  const preds = pos.predictionOffsets || [];
  const x = [0, 1, 2, 3, 4, 5];
  const headH = val(gm.headHorizontalOffset?.value, 0);
  const headV = val(gm.headVerticalOffset?.value, 0);
  const hTrend = val(gm.horizontalTrend?.value, 0);
  const vTrend = val(gm.verticalTrend?.value, 0);
  const h = x.map((d) => d === 0 ? headH : (preds.find((p: AnyObj) => val(p.distanceM) === d)?.horizontalOffset?.value ?? headH + hTrend * d));
  const v = x.map((d) => d === 0 ? headV : (preds.find((p: AnyObj) => val(p.distanceM) === d)?.verticalOffset?.value ?? headV + vTrend * d));
  return {
    ...echartsTheme(),
    legend: { top: 0, textStyle: { color: '#dffcff' } },
    grid: { left: 46, right: 20, top: 44, bottom: 34 },
    xAxis: { type: 'category', data: x.map((i) => `${i}m`), axisLabel: { color: '#baf8ff' } },
    yAxis: { type: 'value', name: 'mm', nameTextStyle: { color: '#baf8ff' }, axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    series: [
      { name: '水平预测偏差', type: 'line', smooth: true, data: h, lineStyle: { width: 3, color: '#12d9ff' }, itemStyle: { color: '#12d9ff' }, areaStyle: { color: 'rgba(18,217,255,.16)' } },
      { name: '垂直预测偏差', type: 'line', smooth: true, data: v, lineStyle: { width: 3, color: '#ffd45c' }, itemStyle: { color: '#ffd45c' } },
    ],
  };
}

function historyComboOption(items: AnyObj[], mode: 'operation' | 'slurry' | 'segment' = 'operation') {
  const xs = items.map((x: AnyObj) => String(x.timestamp || x.receivedAt || '').slice(11, 19));
  const series = mode === 'slurry'
    ? [
        { name: '进浆流量', key: 'slurryInFlow', color: '#12d9ff' },
        { name: '排浆流量', key: 'slurryOutFlow', color: '#38f5b1' },
        { name: '注浆量', key: 'groutTotal', color: '#ffd45c' },
      ]
    : mode === 'segment'
      ? [
          { name: '盾尾间隙1#', key: 'shieldTailGap1', color: '#12d9ff' },
          { name: '盾尾间隙2#', key: 'shieldTailGap2', color: '#38f5b1' },
          { name: '盾尾间隙3#', key: 'shieldTailGap3', color: '#ffd45c' },
        ]
      : [
          { name: '推进速度', key: 'advanceSpeed', color: '#38f5b1' },
          { name: '开挖仓压力1#', key: 'chamberPressure1', color: '#12d9ff' },
          { name: '盾尾间隙1#', key: 'shieldTailGap1', color: '#ffd45c' },
        ];
  return {
    ...echartsTheme(),
    legend: { top: 0, textStyle: { color: '#dffcff' } },
    grid: { left: 46, right: 18, top: 44, bottom: 40 },
    xAxis: { type: 'category', data: xs, axisLabel: { color: '#baf8ff', rotate: 35 } },
    yAxis: { type: 'value', axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    series: series.map((s: AnyObj, i: number) => ({
      name: s.name,
      type: i === 2 ? 'bar' : 'line',
      smooth: true,
      data: items.map((x) => val(x[s.key])),
      lineStyle: { width: 3, color: s.color },
      itemStyle: { color: s.color },
      areaStyle: i === 0 ? { color: 'rgba(18,217,255,.14)' } : undefined,
    })),
  };
}

function barOption(data: Array<{ name: string; value: number }>, title = '') {
  return {
    ...echartsTheme(),
    title: title ? { text: title, textStyle: { color: '#eaffff', fontSize: 13 }, top: 0 } : undefined,
    grid: { left: 48, right: 18, top: title ? 38 : 20, bottom: 42 },
    xAxis: { type: 'category', data: data.map((d) => d.name), axisLabel: { color: '#baf8ff', rotate: 30 } },
    yAxis: { type: 'value', axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    series: [{ type: 'bar', data: data.map((d) => d.value), itemStyle: { color: '#12d9ff' }, label: { show: true, position: 'top', color: '#eaffff' } }],
  };
}

function pieOption(data: Array<{ name: string; value: number }>) {
  return {
    ...echartsTheme(),
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#dffcff' } },
    series: [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '43%'], data, label: { color: '#eaffff' }, itemStyle: { borderColor: '#061426', borderWidth: 2 } }],
  };
}

function alertsDistanceOption(items: AnyObj[]) {
  const top = items.slice(0, 14).reverse();
  return {
    ...echartsTheme(),
    grid: { left: 86, right: 34, top: 22, bottom: 26 },
    xAxis: { type: 'value', name: '距离m', nameTextStyle: { color: '#baf8ff' }, axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    yAxis: { type: 'category', data: top.map((x) => x.pointCode || '--'), axisLabel: { color: '#baf8ff' } },
    series: [{ type: 'bar', data: top.map((x) => x.distanceM ?? 0), itemStyle: { color: (p: AnyObj) => p.dataIndex >= Math.max(0, top.length - 4) ? '#ff6b7b' : '#12d9ff' }, label: { show: true, position: 'right', color: '#eaffff', formatter: (p: AnyObj) => p.value ? `${p.value}m` : '当前风险源' } }],
  };
}

function eventTimelineOption(events: AnyObj[]) {
  const items = events.slice(0, 20).reverse();
  return {
    ...echartsTheme(),
    grid: { left: 70, right: 30, top: 28, bottom: 38 },
    xAxis: { type: 'category', data: items.map((x) => shortDate(x.eventTime || x.createdAt || x.time).slice(5)), axisLabel: { color: '#baf8ff', rotate: 25 } },
    yAxis: { type: 'value', min: 0, max: 3, axisLabel: { color: '#baf8ff', formatter: (v: number) => ['记录', '预警', '报警', '严重'][v] || '' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    series: [{ type: 'line', smooth: true, data: items.map((x) => cnLevel(x.eventLevel || x.alertLevel || x.level) === '报警' ? 2 : cnLevel(x.eventLevel || x.alertLevel || x.level) === '预警' ? 1 : 0), symbolSize: 10, lineStyle: { color: '#ffd45c', width: 3 }, itemStyle: { color: '#ff6b7b' }, areaStyle: { color: 'rgba(255,212,92,.14)' } }],
  };
}

function dataFlowOption(health: AnyObj, guidance: AnyObj) {
  const t = health?.tables || {};
  const schemaCount = Object.keys(guidance?.schema || {}).length;
  return {
    ...echartsTheme(),
    tooltip: {},
    series: [{
      type: 'graph',
      layout: 'force',
      roam: false,
      force: { repulsion: 360, edgeLength: 110 },
      label: { show: true, color: '#eaffff' },
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: 8,
      lineStyle: { color: '#12d9ff', opacity: 0.65 },
      data: [
        { name: 'WebService/19090', value: schemaCount, symbolSize: 58 },
        { name: '导向字段0-38', value: schemaCount, symbolSize: 48 },
        { name: '8100业务接口', value: 1, symbolSize: 56 },
        { name: '风险源台账', value: t.risk_source || 8, symbolSize: 42 },
        { name: '监测读数', value: t.monitoring_reading || 0, symbolSize: 50 },
        { name: '证据链', value: t.extraction_evidence || 0, symbolSize: 46 },
        { name: 'ECharts研判页', value: 1, symbolSize: 54 },
      ],
      links: [
        { source: 'WebService/19090', target: '导向字段0-38' },
        { source: '导向字段0-38', target: '8100业务接口' },
        { source: '风险源台账', target: '8100业务接口' },
        { source: '监测读数', target: '8100业务接口' },
        { source: '证据链', target: '8100业务接口' },
        { source: '8100业务接口', target: 'ECharts研判页' },
      ],
    }],
  };
}

function TunnelVisual({ pos, risk }: { pos: AnyObj; risk: AnyObj | null }) {
  return (
    <div className="v422-tunnel">
      <div className="v422-shield"><i /><strong>{pos.headMileageText || 'DK--'}</strong><span>盾首实时导向</span></div>
      <div className="v422-risk-label">{risk ? `${risk.riskName}${risk.crossingRelation || ''}` : '风险源待复核'}</div>
      <div className="v422-location-line"><span>盾尾 {pos.tailMileageText || '--'}</span><b>盾首 {pos.headMileageText || '--'}</b></div>
    </div>
  );
}

function GuidanceMetrics({ pos }: { pos: AnyObj }) {
  const gm = pos.guidanceMetrics || {};
  const m = (key: string) => gm[key];
  return (
    <div className="v422-mini-grid">
      <Metric title="盾首水平偏差" value={fmt(m('headHorizontalOffset')?.value, m('headHorizontalOffset')?.unit || 'mm')} />
      <Metric title="盾首垂直偏差" value={fmt(m('headVerticalOffset')?.value, m('headVerticalOffset')?.unit || 'mm')} />
      <Metric title="滚转角" value={fmt(m('roll')?.value, m('roll')?.unit || 'deg')} />
      <Metric title="俯仰角" value={fmt(m('pitch')?.value, m('pitch')?.unit || 'deg')} />
      <Metric title="水平趋势" value={fmt(m('horizontalTrend')?.value, m('horizontalTrend')?.unit || 'mm/m')} />
      <Metric title="垂直趋势" value={fmt(m('verticalTrend')?.value, m('verticalTrend')?.unit || 'mm/m')} />
    </div>
  );
}

function CurrentSnapshot({ tbm }: { tbm: AnyObj }) {
  return (
    <div className="v422-mini-grid four">
      <Metric title="推进速度" value={fmt(field(tbm, 'advanceSpeed'), 'mm/min')} />
      <Metric title="贯入度" value={fmt(field(tbm, 'penetration'), 'mm/r')} />
      <Metric title="开挖仓压力1#" value={fmt(field(tbm, 'chamberPressure1'), 'bar')} />
      <Metric title="盾尾间隙1#" value={fmt(field(tbm, 'shieldTailGap1'), 'mm')} />
    </div>
  );
}

function OverviewPage({ data }: { data: ReturnType<typeof useCommonData> }) {
  const pos = getPos(data);
  const risk = getRisk(pos);
  const history = historyItems(data.history.data);
  const alerts = data.nearby.data?.items || [];
  return (
    <Shell page="overview">
      <Hero tag="指挥总览" title="实时导向、风险窗口与监测响应总览" desc="围绕当前盾首里程，把风险源、掘进参数、导向姿态和邻近预警放到同一个工程坐标系里研判。" value={pos.headMileageText || '--'} label={risk ? `${risk.riskName}${risk.crossingRelation || ''}` : '实时导向位置'} />
      <section className="v422-overview-grid">
        <Panel title="工程主视图" className="main-visual"><TunnelVisual pos={pos} risk={risk} /></Panel>
        <Panel title="当前位置"><div className="v422-info-list"><p><span>导向环</span><b>{fmt(pos.guidanceRing)}</b></p><p><span>工程环</span><b>{pos.engineeringRing?.ringNo || '--'}</b></p><p><span>盾首/盾中/盾尾</span><b>{pos.headMileageText || '--'} / {pos.middleMileageText || '--'} / {pos.tailMileageText || '--'}</b></p><p><span>当前风险源</span><b>{risk ? `${risk.riskName} ${risk.crossingRelation || ''}` : '--'}</b></p></div></Panel>
        <Panel title="邻近预警优先"><AlertList items={alerts.slice(0, 8)} /></Panel>
      </section>
      <section className="v422-chart-grid four">
        <Panel title="风险窗口里程轴"><Chart option={riskWindowOption(pos)} height={260} /></Panel>
        <Panel title="盾构姿态雷达"><Chart option={poseRadarOption(pos)} height={260} /></Panel>
        <Panel title="近时段参数联动"><Chart option={historyComboOption(history, 'operation')} height={260} /></Panel>
        <Panel title="邻近预警排序"><Chart option={alertsDistanceOption(alerts)} height={260} /></Panel>
      </section>
    </Shell>
  );
}

function ProjectDocsPage({ data }: { data: ReturnType<typeof useCommonData> }) {
  const pos = getPos(data);
  const risks = data.risks.data?.items || data.risks.data || [];
  const docs = data.docs.data?.items || [];
  const gaps = data.gaps.data || {};
  const riskData = risks.map((r: AnyObj) => ({ name: r.riskName || r.name || '--', value: val(r.endMileageM) - val(r.startMileageM) || 1 })).slice(0, 12);
  return (
    <Shell page="project">
      <Hero tag="项目书 / 工程依据" title="工程资料、风险源与导向位置的依据页" desc="这页不写空话，重点说明当前页面用到哪些工程资料、风险源台账和导向字段。" value={`${risks.length || '--'} 个`} label="风险源台账" />
      <section className="v422-two-col">
        <Panel title="风险源区间长度"><Chart option={barOption(riskData)} height={320} /></Panel>
        <Panel title="当前工程位置依据"><div className="v422-info-list"><p><span>位置来源</span><b>{pos.positionSource === 'guidance' ? '实时导向' : '兜底'}</b></p><p><span>盾首里程</span><b>{pos.headMileageText || '--'}</b></p><p><span>命中风险源</span><b>{getRisk(pos)?.riskName || '--'}</b></p><p><span>导向字段</span><b>{Object.keys(pos.guidance?.schema || {}).length || Object.keys(data.guidance.data?.schema || {}).length || '--'} 个</b></p></div></Panel>
      </section>
      <section className="v422-two-col small-right">
        <Panel title="风险源清单"><RiskTable risks={risks.slice(0, 10)} /></Panel>
        <Panel title="资料与缺口"><div className="v422-doc-list">{docs.slice(0, 8).map((d: AnyObj) => <article key={d.sourceId || d.fileName}><b>{d.fileName || d.title || '--'}</b><span>{d.fileType ? cnFileType(d.fileType) : (d.documentDate || '--')}</span></article>)}</div><pre className="v422-json-note">{JSON.stringify(gaps, null, 2).slice(0, 700)}</pre></Panel>
      </section>
    </Shell>
  );
}

function RiskReplayPage({ data }: { data: ReturnType<typeof useCommonData> }) {
  const pos = getPos(data);
  const events = data.events.data?.items || data.events.data || [];
  const risk = getRisk(pos);
  return (
    <Shell page="risk">
      <Hero tag="风险复盘" title="当前盾首进入风险窗口后的穿越复盘" desc="以实时导向里程为基准，展示当前风险源、邻近风险源、事件处置和监测响应。" value={pos.headMileageText || '--'} label={risk ? `${risk.riskName}${risk.crossingRelation || ''}` : '风险窗口'} />
      <section className="v422-two-col">
        <Panel title="风险窗口里程轴"><Chart option={riskWindowOption(pos)} height={340} /></Panel>
        <Panel title="当前风险源卡片"><div className="v422-risk-card"><b>{risk?.riskName || '--'}</b><p>{risk?.startMileage || '--'} - {risk?.endMileage || '--'}</p><span>{cnRiskType(risk?.riskType)} / {cnRiskLevel(risk?.protectionLevel || risk?.riskLevel)}</span></div><div className="v422-info-list"><p><span>盾首</span><b>{pos.headMileageText || '--'}</b></p><p><span>盾尾</span><b>{pos.tailMileageText || '--'}</b></p><p><span>工程环</span><b>{pos.engineeringRing?.ringNo || '--'}</b></p></div></Panel>
      </section>
      <section className="v422-two-col small-right">
        <Panel title="事件处置时间线"><Chart option={eventTimelineOption(events)} height={300} /></Panel>
        <Panel title="邻近风险源"><RiskTable risks={(pos.nearestRiskSources || []).slice(0, 8)} /></Panel>
      </section>
    </Shell>
  );
}

function MonitoringAlertsPage({ data }: { data: ReturnType<typeof useCommonData> }) {
  const pos = getPos(data);
  const alerts = data.nearby.data?.items || [];
  const summary = data.monitoring.data || {};
  const levelData = Object.entries(data.nearby.data?.levelCounts || {}).map(([name, value]) => ({ name, value: val(value) }));
  const itemData = Object.entries(data.nearby.data?.itemCounts || {}).map(([name, value]) => ({ name, value: val(value) })).slice(0, 8);
  return (
    <Shell page="monitoring">
      <Hero tag="监测异常" title="离当前盾首和风险窗口最近的异常优先" desc="不再平铺所有异常，按当前风险源、最近风险源、测点里程距离、报警等级和最新时间进行排序。" value={String(alerts.length || '--')} label={pos.headMileageText ? `当前位置 ${pos.headMileageText}` : '邻近异常'} />
      <section className="v422-chart-grid three">
        <Panel title="邻近预警距离排序"><Chart option={alertsDistanceOption(alerts)} height={340} /></Panel>
        <Panel title="状态分布"><Chart option={pieOption(levelData.length ? levelData : [{ name: '暂无', value: 1 }])} height={340} /></Panel>
        <Panel title="监测项目分布"><Chart option={barOption(itemData.length ? itemData : [{ name: '暂无', value: 0 }])} height={340} /></Panel>
      </section>
      <section className="v422-two-col small-right">
        <Panel title="重点异常测点"><AlertTable items={alerts.slice(0, 24)} /></Panel>
        <Panel title="监测库摘要"><div className="v422-mini-grid"><Metric title="总读数" value={summary.total?.readingCount || summary.totalReadings || '--'} /><Metric title="需关注" value={summary.total?.abnormalCount || summary.concernCount || data.nearby.data?.totalCandidateCount || '--'} /><Metric title="排序方式" value={data.nearby.data?.rankingMode || '邻近优先'} /><Metric title="当前位置" value={pos.headMileageText || '--'} /></div></Panel>
      </section>
    </Shell>
  );
}

function OperationPage({ data }: { data: ReturnType<typeof useCommonData> }) {
  const pos = getPos(data);
  const history = historyItems(data.history.data);
  const tbm = data.tbm.data || {};
  return (
    <Shell page="operation">
      <Hero tag="参数诊断" title="推进、仓压、刀盘与姿态组合研判" desc="把推进速度、贯入度、仓压、刀盘扭矩和导向姿态放在同一时段内判断，避免只看单个字段。" value={pos.headMileageText || '--'} label="实时导向位置" />
      <CurrentSnapshot tbm={tbm} />
      <section className="v422-chart-grid three">
        <Panel title="掘进参数联动趋势"><Chart option={historyComboOption(history, 'operation')} height={320} /></Panel>
        <Panel title="导向姿态雷达"><Chart option={poseRadarOption(pos)} height={320} /></Panel>
        <Panel title="前方偏差预测"><Chart option={predictionOption(pos)} height={320} /></Panel>
      </section>
      <section className="v422-two-col small-right"><Panel title="导向姿态字段"><GuidanceMetrics pos={pos} /></Panel><AiPanel mode="operation" title="推进参数智能诊断" question="基于推进、贯入、仓压、刀盘、盾尾间隙、导向姿态和邻近监测预警，生成参数诊断结论。" /></section>
    </Shell>
  );
}

function SlurryPage({ data }: { data: ReturnType<typeof useCommonData> }) {
  const pos = getPos(data);
  const history = historyItems(data.history.data);
  const tbm = data.tbm.data || {};
  return (
    <Shell page="slurry">
      <Hero tag="泥水注浆" title="泥水环流、仓压与注浆响应归因" desc="围绕当前风险窗口，将进排浆流量、浆液密度、仓压和注浆累计量与监测响应联动分析。" value={fmt(field(tbm, 'groutTotal'), 'm³')} label="注浆累计量" />
      <section className="v422-mini-grid four"><Metric title="进浆流量" value={fmt(field(tbm, 'slurryInFlow'), 'm³/h')} /><Metric title="排浆流量" value={fmt(field(tbm, 'slurryOutFlow'), 'm³/h')} /><Metric title="进浆压力" value={fmt(field(tbm, 'slurryInPressure'), 'bar')} /><Metric title="当前位置" value={pos.headMileageText || '--'} /></section>
      <section className="v422-chart-grid three"><Panel title="泥水注浆历史趋势"><Chart option={historyComboOption(history, 'slurry')} height={320} /></Panel><Panel title="风险窗口里程轴"><Chart option={riskWindowOption(pos)} height={320} /></Panel><Panel title="邻近预警排序"><Chart option={alertsDistanceOption(data.nearby.data?.items || [])} height={320} /></Panel></section>
      <section className="v422-two-col small-right"><Panel title="归因提示"><ul className="v422-conclusion"><li>当前泥水/注浆判断必须绑定盾首里程和风险窗口。</li><li>进排浆、仓压、盾尾间隙同一时段波动时优先进入复核。</li><li>监测异常按当前位置附近优先展示，不再平铺全库异常。</li></ul></Panel><AiPanel mode="slurry" title="泥水注浆智能归因" question="基于进排浆、仓压、浆液密度、注浆量、盾尾间隙和邻近监测异常，生成泥水注浆归因结论。" /></section>
    </Shell>
  );
}

function SegmentPage({ data }: { data: ReturnType<typeof useCommonData> }) {
  const pos = getPos(data);
  const history = historyItems(data.history.data);
  const tbm = data.tbm.data || {};
  return (
    <Shell page="segment">
      <Hero tag="管片盾尾" title="盾尾间隙、姿态偏差与拼装复核" desc="把盾尾间隙、滚转俯仰、前方偏差预测和管片拼装位置放在同一页面复核。" value={fmt(field(tbm, 'shieldTailGap1'), 'mm')} label="盾尾间隙1#" />
      <section className="v422-mini-grid four"><Metric title="盾尾间隙1#" value={fmt(field(tbm, 'shieldTailGap1'), 'mm')} /><Metric title="盾尾间隙2#" value={fmt(field(tbm, 'shieldTailGap2'), 'mm')} /><Metric title="盾尾间隙3#" value={fmt(field(tbm, 'shieldTailGap3'), 'mm')} /><Metric title="拼装位置" value={fmt(field(tbm, 'segmentPosition'))} /></section>
      <section className="v422-chart-grid three"><Panel title="盾尾间隙趋势"><Chart option={historyComboOption(history, 'segment')} height={320} /></Panel><Panel title="导向姿态雷达"><Chart option={poseRadarOption(pos)} height={320} /></Panel><Panel title="前方 1～5m 偏差预测"><Chart option={predictionOption(pos)} height={320} /></Panel></section>
      <section className="v422-two-col small-right"><Panel title="姿态字段复核"><GuidanceMetrics pos={pos} /></Panel><AiPanel mode="segment" title="管片盾尾智能复核" question="基于盾尾间隙、滚转俯仰、管片拼装位置、注浆状态和监测异常，生成管片盾尾复核结论。" /></section>
    </Shell>
  );
}

function EventsPage({ data }: { data: ReturnType<typeof useCommonData> }) {
  const events = data.events.data?.items || data.events.data || [];
  const pos = getPos(data);
  return (
    <Shell page="events">
      <Hero tag="事件闭环" title="报警、处置、复核与风险窗口联动" desc="按事件时间线展示报警处置，不把事件孤立成表格。" value={String(events.length || '--')} label="事件记录" />
      <section className="v422-two-col"><Panel title="事件时间线"><Chart option={eventTimelineOption(events)} height={340} /></Panel><Panel title="当前工程位置"><div className="v422-info-list"><p><span>盾首里程</span><b>{pos.headMileageText || '--'}</b></p><p><span>当前风险源</span><b>{getRisk(pos)?.riskName || '--'}</b></p><p><span>工程环</span><b>{pos.engineeringRing?.ringNo || '--'}</b></p></div></Panel></section>
      <Panel title="事件处置清单"><EventTable items={events.slice(0, 24)} /></Panel>
    </Shell>
  );
}

function DataPage({ data }: { data: ReturnType<typeof useCommonData> }) {
  const health = data.health.data || {};
  const guidance = data.pos.data?.guidance || data.guidance.data || {};
  const t = health.tables || {};
  const bars = Object.entries(t).map(([name, value]) => ({ name: name.replace('monitoring_', '监测_').replace('source_document', '源文件').replace('extraction_evidence', '证据链'), value: val(value) })).slice(0, 10);
  return (
    <Shell page="data">
      <Hero tag="数据接入" title="WebService、文件、数据库与图表页面映射" desc="明确真实数据链路，哪些来自 19090 导向，哪些来自历史监测库，哪些仍待补。" value={String(t.monitoring_reading || '--')} label="监测读数" />
      <section className="v422-two-col"><Panel title="数据链路图"><Chart option={dataFlowOption(health, guidance)} height={360} /></Panel><Panel title="入库规模"><Chart option={barOption(bars)} height={360} /></Panel></section>
      <section className="v422-mini-grid four"><Metric title="导向字段" value={Object.keys(guidance.schema || {}).length || '--'} note="0～38 表结构" /><Metric title="源文件" value={t.source_document || '--'} /><Metric title="监测点" value={t.monitoring_point || '--'} /><Metric title="证据链" value={t.extraction_evidence || '--'} /></section>
    </Shell>
  );
}

function SystemPage({ data }: { data: ReturnType<typeof useCommonData> }) {
  const tbm = data.tbm.data || {};
  const q = tbm.decodeQuality || {};
  const quality = data.quality.data || {};
  const guidance = data.pos.data?.guidance || data.guidance.data || {};
  const pie = [
    { name: '已确认', value: val(q.confirmed) },
    { name: '已校准', value: val(q.scale_checked) },
    { name: '待校准', value: val(q.scale_pending) },
    { name: '待解释', value: val(q.pending) },
  ];
  return (
    <Shell page="system">
      <Hero tag="系统状态" title="数据质量、服务健康与字段可信度" desc="说明哪些接口通、哪些字段待校准、哪些页面使用真实导向或兜底数据。" value={data.pos.data?.positionSource === 'guidance' ? '导向已接入' : '导向待接入'} label="位置来源" />
      <section className="v422-chart-grid three"><Panel title="TBM 字段可信度"><Chart option={pieOption(pie)} height={320} /></Panel><Panel title="导向字段完整度"><div className="v422-mini-grid"><Metric title="导向可用" value={guidance.guidanceAvailable ? '是' : '否'} /><Metric title="协议版本" value={cnSchemaVersion(guidance.schemaVersion)} /><Metric title="字段数量" value={Object.keys(guidance.fields || {}).length || '--'} /><Metric title="位置来源" value={cnPositionSource(data.pos.data?.positionSource)} /></div></Panel><Panel title="数据质量摘要"><pre className="v422-json-note">{JSON.stringify(quality, null, 2).slice(0, 1000)}</pre></Panel></section>
      <Panel title="系统检查项"><div className="v422-status-grid"><Metric title="8100 后端" value={data.health.error ? '异常' : '正常'} /><Metric title="19090 导向" value={guidance.guidanceAvailable ? '正常' : '待接入'} /><Metric title="AI 诊断" value="已配置" /><Metric title="前端图表" value="ECharts" /></div></Panel>
    </Shell>
  );
}

function EvidencePage({ data }: { data: ReturnType<typeof useCommonData> }) {
  const docs = data.docs.data?.items || [];
  const alerts = data.alerts.data?.items || [];
  const health = data.health.data || {};
  const docTypeData = countBy(docs, (d) => String(d.fileType || '文件'));
  const alertData = countBy(alerts, (a) => cnLevel(a.alertLevel));
  return (
    <Shell page="evidence">
      <Hero tag="证据链" title="异常读数、来源文件与接口字段追溯" desc="把异常测点、源文件、接口字段和证据记录关联起来，避免只有图表没有来源。" value={String(health.tables?.extraction_evidence || '--')} label="证据记录" />
      <section className="v422-chart-grid three"><Panel title="源文件类型"><Chart option={pieOption(docTypeData.length ? docTypeData : [{ name: '暂无', value: 1 }])} height={300} /></Panel><Panel title="异常状态来源"><Chart option={pieOption(alertData.length ? alertData : [{ name: '暂无', value: 1 }])} height={300} /></Panel><Panel title="当前位置证据"><div className="v422-info-list"><p><span>盾首里程</span><b>{data.pos.data?.headMileageText || '--'}</b></p><p><span>风险源</span><b>{getRisk(data.pos.data || {})?.riskName || '--'}</b></p><p><span>来源</span><b>{cnPositionSource(data.pos.data?.positionSource)}</b></p></div></Panel></section>
      <section className="v422-two-col"><Panel title="异常读数追溯"><AlertTable items={alerts.slice(0, 20)} /></Panel><Panel title="最新源文件"><div className="v422-doc-list">{docs.slice(0, 14).map((d: AnyObj) => <article key={d.sourceId || d.fileName}><b>{d.fileName || d.title || '--'}</b><span>{d.fileType ? cnFileType(d.fileType) : (d.documentDate || '--')}</span></article>)}</div></Panel></section>
    </Shell>
  );
}

function RiskTable({ risks }: { risks: AnyObj[] }) {
  if (!risks.length) return <Empty text="暂无风险源数据" />;
  return <div className="v422-table five"><div className="head"><span>风险源</span><span>类型</span><span>起点</span><span>终点</span><span>距离</span></div>{risks.map((r, i) => <div key={r.riskSourceId || i}><span>{r.riskName || '--'}</span><span>{cnRiskType(r.riskType)}</span><span>{r.startMileage || '--'}</span><span>{r.endMileage || '--'}</span><span>{r.distanceM === undefined ? '--' : fmt(r.distanceM, 'm')}</span></div>)}</div>;
}

function AlertList({ items }: { items: AnyObj[] }) {
  if (!items.length) return <Empty text="暂无邻近预警；请检查 /api/monitoring/nearby-alerts" />;
  return <div className="v422-alert-list">{items.map((x, i) => <article key={`${x.pointCode}-${i}`} className={`level-${cnLevel(x.alertLevelCn || x.alertLevel)}`}><b>{x.pointCode || '--'}</b><span>{cnLevel(x.alertLevelCn || x.alertLevel)} · {cnItem(x.monitoringItemCn || x.monitoringItem)}</span><em>{x.distanceM === null || x.distanceM === undefined ? (x.rankingReason || '邻近排序') : `距当前位置 ${fmt(x.distanceM, 'm')}`}</em></article>)}</div>;
}

function AlertTable({ items }: { items: AnyObj[] }) {
  if (!items.length) return <Empty text="暂无异常记录" />;
  return <div className="v422-table six"><div className="head"><span>测点</span><span>等级</span><span>项目</span><span>最新值</span><span>距离/原因</span><span>时间</span></div>{items.map((x, i) => <div key={`${x.pointCode}-${i}`}><span>{x.pointCode || '--'}</span><span className="level">{cnLevel(x.alertLevelCn || x.alertLevel)}</span><span>{cnItem(x.monitoringItemCn || x.monitoringItem)}</span><span>{fmt(x.latestValue ?? x.cumulativeChange ?? x.value)}</span><span>{x.distanceM === null || x.distanceM === undefined ? (x.rankingReason || '--') : fmt(x.distanceM, 'm')}</span><span>{shortDate(x.latestTime || x.measuredAt || x.readingDate)}</span></div>)}</div>;
}

function EventTable({ items }: { items: AnyObj[] }) {
  if (!items.length) return <Empty text="暂无事件记录" />;
  return <div className="v422-table five"><div className="head"><span>时间</span><span>类型</span><span>等级</span><span>风险源</span><span>处置</span></div>{items.map((x, i) => <div key={x.eventId || i}><span>{shortDate(x.eventTime || x.createdAt)}</span><span>{cnEventType(x.eventType || x.type)}</span><span>{cnLevel(x.eventLevel || x.alertLevel || x.level)}</span><span>{x.riskName || x.riskSourceName || '--'}</span><span>{x.action || x.disposal || x.handlingMeasure || '--'}</span></div>)}</div>;
}

function OperatorPages({ page }: { page: PageKey }) {
  const data = useCommonData();
  if (page === 'overview') return <OverviewPage data={data} />;
  if (page === 'project') return <ProjectDocsPage data={data} />;
  if (page === 'risk') return <RiskReplayPage data={data} />;
  if (page === 'monitoring') return <MonitoringAlertsPage data={data} />;
  if (page === 'operation') return <OperationPage data={data} />;
  if (page === 'slurry') return <SlurryPage data={data} />;
  if (page === 'segment') return <SegmentPage data={data} />;
  if (page === 'events') return <EventsPage data={data} />;
  if (page === 'data') return <DataPage data={data} />;
  if (page === 'system') return <SystemPage data={data} />;
  if (page === 'evidence') return <EvidencePage data={data} />;
  return <OverviewPage data={data} />;
}

export default function V422OperatorPages({ fallback }: { fallback: React.ReactNode }) {
  const page = routeToPage(window.location.pathname);
  if (!page) return <>{fallback}</>;
  return <OperatorPages page={page} />;
}
