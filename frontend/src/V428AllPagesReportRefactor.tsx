import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import './v428-all-pages-report-refactor.css';

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

const ROUTES = new Set([
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

function useApi(path: string, interval = 0) {
  const [data, setData] = useState<AnyObj | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const load = async () => {
      try {
        const res = await fetch(`${apiBase()}${path}`);
        const json = await res.json();
        if (alive) {
          setData(json?.data || json);
          setError('');
        }
      } catch (e: any) {
        if (alive) setError(e?.message || String(e));
      }
    };
    load();
    if (interval > 0) timer = window.setInterval(load, interval);
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [path, interval]);
  return { data, error };
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

function cnSource(v: any) {
  const s = String(v || '');
  if (s.includes('guidance')) return '实时导向';
  if (s.includes('fallback')) return '兜底推算';
  if (!s) return '待确认';
  return s;
}

function cnFile(v: any) {
  const s = String(v || '').toLowerCase();
  if (s.includes('daily_report')) return '监测日报';
  if (s.includes('image') || s.includes('png') || s.includes('jpg')) return '图片资料';
  if (s.includes('pdf')) return 'PDF资料';
  if (s.includes('file_staging')) return '文件暂存';
  return String(v || '资料');
}

function cnRiskType(v: any) {
  const s = String(v || '').toLowerCase();
  const map: Record<string, string> = {
    railway: '既有铁路',
    metro: '轨道交通',
    building: '建构筑物',
    factory: '厂房',
    river_lake: '河湖水体',
    pipeline: '地下管线',
    road: '道路',
  };
  return map[s] || String(v || '风险源');
}

function cleanText(v: any) {
  return String(v || '')
    .replace(/guidance\.fields/g, '导向姿态明细')
    .replace(/monitoring_point\.mileage_m/g, '监测点里程')
    .replace(/monitoringAlerts\.items/g, '监测异常列表')
    .replace(/rule_fallback|rule|ai|source|endpoint|ECharts|Agent/gi, '综合研判');
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
  const path = window.location.pathname === '/event-closure' ? '/events' : window.location.pathname;
  return (
    <div className="v428">
      <header className="v428-top">
        <div className="v428-brand">
          <span>AUTONOMOUS SHIELD TUNNELING SYSTEM</span>
          <b>通苏嘉甬施工监测与盾构研判平台</b>
        </div>
        <nav>
          {NAV.map(([href, title, sub]) => (
            <a key={href} href={href} className={path === href || (href === '/intelligent-analysis' && ['/ai-diagnosis', '/smart-analysis'].includes(path)) ? 'active' : ''}>
              <b>{title}</b>
              <span>{sub}</span>
            </a>
          ))}
        </nav>
        <div className="v428-clock">
          <b>{new Date().toLocaleDateString()}</b>
          <span>实时研判</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function Hero({ data, title, subtitle }: { data: AnyObj; title?: string; subtitle?: string }) {
  return (
    <section className={`v428-hero ${levelClass(data.overallLevel)}`}>
      <div>
        <span>{subtitle || '施工研判'}</span>
        <h1>{title || data.headline || '正在汇总当前施工状态'}</h1>
        <p>{data.brief || '围绕当前位置、风险源、监测异常、参数趋势和处置建议进行汇总。'}</p>
      </div>
      <div className="v428-hero-value">
        <b>{data.overallLevel || '--'}</b>
        <em>{data.generatedAt || '实时更新'}</em>
      </div>
    </section>
  );
}

function Metric({ title, value, sub }: { title: string; value: any; sub?: string }) {
  return (
    <div className="v428-metric">
      <span>{title}</span>
      <b>{value ?? '--'}</b>
      {sub ? <em>{sub}</em> : null}
    </div>
  );
}

function RiskScene({ data }: { data: AnyObj }) {
  const pos = data.position || {};
  const risk = data.currentRisk || {};
  return (
    <div className="v428-scene">
      <div className="v428-tunnel-tube" />
      <div className="v428-machine">
        <i />
        <b>{pos.headMileageText || '--'}</b>
        <span>盾首</span>
      </div>
      <div className="v428-risk-board">
        <b>{risk.name || '--'}</b>
        <span>{risk.relation || '风险窗口'}</span>
      </div>
      <div className="v428-mile v428-mile-tail">盾尾 {pos.tailMileageText || '--'}</div>
      <div className="v428-mile v428-mile-head">盾首 {pos.headMileageText || '--'}</div>
      <div className="v428-tube-axis" />
    </div>
  );
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
        renderItem: (_params: AnyObj, api: AnyObj) => {
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
          label: { color: '#ffd45c', formatter: `当前 ${data.position?.headMileageText || ''}` },
          lineStyle: { color: '#ffd45c', width: 2 },
          data: [{ xAxis: head }],
        },
      },
    ],
  };
}

function parameterOption(data: AnyObj) {
  const rows = data.parameterTrend || [];
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

function alertRankOption(data: AnyObj) {
  const rows = (data.priorityAlerts || []).slice(0, 10).reverse();
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 88, right: 42, top: 24, bottom: 34 },
    xAxis: { type: 'value', axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    yAxis: { type: 'category', data: rows.map((x: AnyObj) => x.pointCode || '--'), axisLabel: { color: '#eaffff' } },
    series: [{
      type: 'bar',
      data: rows.map((x: AnyObj, idx: number) => x.distanceM == null ? idx + 1 : Math.max(0.5, n(x.distanceM))),
      label: { show: true, position: 'right', color: '#eaffff', formatter: (p: any) => rows[p.dataIndex]?.priorityReason || '' },
      itemStyle: {
        color: (p: any) => {
          const x = rows[p.dataIndex] || {};
          if (x.level === '报警') return '#ff4d5d';
          if (x.level === '预警') return '#ffd45c';
          return '#12d9ff';
        },
      },
    }],
  };
}

function statusPieOption(data: AnyObj) {
  const s = data.alertSummary || {};
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#eaffff' } },
    series: [{
      type: 'pie',
      radius: ['48%', '70%'],
      data: [
        { name: '报警', value: s.alarm || 0 },
        { name: '预警', value: s.warning || 0 },
        { name: '待复核', value: s.review || 0 },
      ],
      label: { color: '#eaffff' },
      color: ['#ff4d5d', '#ffd45c', '#12d9ff'],
    }],
  };
}

function barOption(rows: { name: string; value: number }[]) {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 42, right: 24, top: 28, bottom: 50 },
    xAxis: { type: 'category', data: rows.map((x) => x.name), axisLabel: { color: '#baf8ff', rotate: 20 } },
    yAxis: { type: 'value', axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    series: [{ type: 'bar', data: rows.map((x) => x.value), itemStyle: { color: '#20d3ee' }, label: { show: true, position: 'top', color: '#eaffff' } }],
  };
}

function AlertList({ data, limit = 8 }: { data: AnyObj; limit?: number }) {
  const rows = (data.priorityAlerts || []).slice(0, limit);
  return (
    <div className="v428-alert-list">
      {rows.map((x: AnyObj, idx: number) => (
        <article key={`${x.pointCode}-${idx}`} className={levelClass(x.level)}>
          <div>
            <b>{x.pointCode || '--'}</b>
            <span>{x.level || '--'} · {x.item || '--'}</span>
          </div>
          <em>{x.priorityReason || '--'}</em>
          <small>{String(x.latestTime || '').slice(0, 16)}</small>
        </article>
      ))}
      {!rows.length ? <p className="v428-muted">暂无优先预警测点。</p> : null}
    </div>
  );
}

function Actions({ data }: { data: AnyObj }) {
  return (
    <div className="v428-action-list">
      {(data.actions || []).slice(0, 5).map((a: AnyObj, idx: number) => (
        <article key={idx}>
          <b>{a.priority || '中'}</b>
          <div><h4>{a.action}</h4><p>{cleanText(a.reason)}</p></div>
        </article>
      ))}
    </div>
  );
}

function Findings({ data }: { data: AnyObj }) {
  return (
    <div className="v428-finding-list">
      {(data.findings || []).slice(0, 5).map((f: AnyObj, idx: number) => (
        <article key={idx} className={levelClass(f.level)}>
          <h4>{cleanText(f.title)}</h4>
          <p>可信度：{f.confidenceText}</p>
          <ul>{(f.evidence || []).map((e: string, i: number) => <li key={i}>{cleanText(e)}</li>)}</ul>
        </article>
      ))}
    </div>
  );
}

function Gaps({ data }: { data: AnyObj }) {
  const rows = data.dataGaps || [];
  return (
    <div className="v428-gap-list">
      {rows.map((g: AnyObj, idx: number) => (
        <article key={idx}><b>{cleanText(g.title)}</b><span>{cleanText(g.impact)}</span></article>
      ))}
    </div>
  );
}

function Facts({ data }: { data: AnyObj }) {
  return (
    <section className="v428-facts">
      <Metric title="盾首位置" value={data.position?.headMileageText || '--'} sub={data.position?.sourceText || '位置待确认'} />
      <Metric title="当前风险源" value={data.currentRisk?.name || '--'} sub={data.currentRisk?.relation || '风险窗口'} />
      <Metric title="预警概况" value={`${data.alertSummary?.alarm || 0} 报警 / ${data.alertSummary?.warning || 0} 预警`} sub={`${data.alertSummary?.review || 0} 条待复核`} />
      <Metric title="导向/环号" value={`${data.position?.guidanceRing || '--'} / ${data.position?.engineeringRing || '--'}`} sub="导向环 / 工程环" />
    </section>
  );
}

function HomePage({ data }: { data: AnyObj }) {
  const riskOption = useMemo(() => riskWindowOption(data), [JSON.stringify(data.riskWindows || []), data.position?.headMileageM]);
  const paramOption = useMemo(() => parameterOption(data), [JSON.stringify(data.parameterTrend || [])]);
  const alertOption = useMemo(() => alertRankOption(data), [JSON.stringify(data.priorityAlerts || [])]);

  return (
    <Shell>
      <Hero data={data} subtitle="指挥总览 / 位置 / 风险 / 处置" />
      <Facts data={data} />
      <section className="v428-layout-home">
        <div className="v428-panel v428-large"><h3>工程主视图</h3><RiskScene data={data} /></div>
        <div className="v428-panel"><h3>当前优先处置测点</h3><AlertList data={data} /></div>
        <div className="v428-panel"><h3>今日建议动作</h3><Actions data={data} /></div>
      </section>
      <section className="v428-grid3">
        <div className="v428-panel"><h3>风险窗口里程轴</h3><EChart option={riskOption} /></div>
        <div className="v428-panel"><h3>近时段参数联动</h3><EChart option={paramOption} /></div>
        <div className="v428-panel"><h3>邻近预警优先级</h3><EChart option={alertOption} /></div>
      </section>
    </Shell>
  );
}

function IntelligentPage({ data }: { data: AnyObj }) {
  const riskOption = useMemo(() => riskWindowOption(data), [JSON.stringify(data.riskWindows || []), data.position?.headMileageM]);
  const paramOption = useMemo(() => parameterOption(data), [JSON.stringify(data.parameterTrend || [])]);
  const alertOption = useMemo(() => alertRankOption(data), [JSON.stringify(data.priorityAlerts || [])]);

  return (
    <Shell>
      <Hero data={data} title={data.headline || '综合施工研判'} subtitle="智能研判 / 结论 / 证据 / 动作" />
      <section className="v428-grid3">
        <div className="v428-panel"><h3>风险窗口</h3><EChart option={riskOption} /></div>
        <div className="v428-panel"><h3>参数联动</h3><EChart option={paramOption} /></div>
        <div className="v428-panel"><h3>优先预警</h3><EChart option={alertOption} /></div>
      </section>
      <section className="v428-grid2">
        <div className="v428-panel"><h3>关键发现</h3><Findings data={data} /></div>
        <div className="v428-panel"><h3>建议动作</h3><Actions data={data} /></div>
      </section>
      <section className="v428-grid2">
        <div className="v428-panel"><h3>重点测点清单</h3><AlertList data={data} limit={10} /></div>
        <div className="v428-panel"><h3>还需补齐的数据</h3><Gaps data={data} /></div>
      </section>
    </Shell>
  );
}

function ProjectDocsPage({ data }: { data: AnyObj }) {
  return (
    <Shell>
      <Hero data={data} title="工程资料、风险源与导向位置依据" subtitle="项目书 / 工程依据" />
      <section className="v428-grid2">
        <div className="v428-panel">
          <h3>风险源清单</h3>
          <table className="v428-table">
            <thead><tr><th>风险源</th><th>类型</th><th>起点</th><th>终点</th><th>状态</th></tr></thead>
            <tbody>{(data.riskWindows || []).map((r: AnyObj, idx: number) => (
              <tr key={idx}><td>{r.riskName}</td><td>{cnRiskType(r.riskType)}</td><td>{r.startMileage}</td><td>{r.endMileage}</td><td>{r.distanceText || (r.matched ? '窗口内' : '邻近')}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="v428-panel"><h3>当前位置依据</h3><Facts data={data} /></div>
      </section>
      <section className="v428-grid2">
        <div className="v428-panel"><h3>资料使用说明</h3><p className="v428-paragraph">本页面向汇报展示工程依据：风险源台账用于判断当前窗口，实时导向用于确定盾首、盾中、盾尾位置，监测异常用于排序现场优先复核测点。</p></div>
        <div className="v428-panel"><h3>资料与缺口</h3><Gaps data={data} /></div>
      </section>
    </Shell>
  );
}

function RiskReplayPage({ data }: { data: AnyObj }) {
  const riskOption = useMemo(() => riskWindowOption(data), [JSON.stringify(data.riskWindows || []), data.position?.headMileageM]);
  const current = data.currentRisk || {};
  return (
    <Shell>
      <Hero data={data} title={`${current.name || '当前风险源'}穿越复盘`} subtitle="风险复盘 / 穿越窗口" />
      <section className="v428-grid3">
        <Metric title="盾首位置" value={data.position?.headMileageText || '--'} sub="当前盾首" />
        <Metric title="风险窗口" value={`${current.startMileage || '--'} - ${current.endMileage || '--'}`} sub={current.name || '风险源'} />
        <Metric title="当前状态" value={current.name === '--' ? '待匹配' : '窗口内'} sub={current.relation || '穿越状态'} />
      </section>
      <section className="v428-grid2">
        <div className="v428-panel"><h3>穿越窗口轴</h3><EChart option={riskOption} height={330} /></div>
        <div className="v428-panel"><h3>处置建议</h3><Actions data={data} /></div>
      </section>
      <section className="v428-panel"><h3>当前窗口内优先测点</h3><AlertList data={data} limit={12} /></section>
    </Shell>
  );
}

function MonitoringPage({ data }: { data: AnyObj }) {
  const alertOption = useMemo(() => alertRankOption(data), [JSON.stringify(data.priorityAlerts || [])]);
  const pieOption = useMemo(() => statusPieOption(data), [JSON.stringify(data.alertSummary || {})]);
  const itemCounts: Record<string, number> = {};
  (data.priorityAlerts || []).forEach((x: AnyObj) => { itemCounts[x.item || '待归类'] = (itemCounts[x.item || '待归类'] || 0) + 1; });
  const itemOption = useMemo(() => barOption(Object.entries(itemCounts).map(([name, value]) => ({ name, value }))), [JSON.stringify(itemCounts)]);
  return (
    <Shell>
      <Hero data={data} title="按当前位置优先的监测异常分析" subtitle="监测异常 / 优先复核" />
      <section className="v428-grid3">
        <div className="v428-panel"><h3>优先级排序</h3><EChart option={alertOption} /></div>
        <div className="v428-panel"><h3>异常状态分布</h3><EChart option={pieOption} /></div>
        <div className="v428-panel"><h3>监测项目分布</h3><EChart option={itemOption} /></div>
      </section>
      <section className="v428-grid2">
        <div className="v428-panel"><h3>重点测点清单</h3><AlertList data={data} limit={14} /></div>
        <div className="v428-panel"><h3>建议动作</h3><Actions data={data} /></div>
      </section>
    </Shell>
  );
}

function OperationPage({ data }: { data: AnyObj }) {
  const paramOption = useMemo(() => parameterOption(data), [JSON.stringify(data.parameterTrend || [])]);
  const p = data.parameterSummary || {};
  return (
    <Shell>
      <Hero data={data} title="推进、仓压、盾尾间隙组合诊断" subtitle="参数诊断 / 组合异常" />
      <section className="v428-grid4">
        <Metric title="推进速度" value={fmt(p.advanceSpeed, ' mm/min')} sub="推进协调性" />
        <Metric title="开挖仓压力1#" value={fmt(p.chamberPressure1, ' bar')} sub="仓压稳定性" />
        <Metric title="盾尾间隙1#" value={fmt(p.shieldTailGap1, ' mm')} sub="姿态与管片风险" />
        <Metric title="贯入度" value={fmt(p.penetration, ' mm/r')} sub="单环掘进表现" />
      </section>
      <section className="v428-grid2">
        <div className="v428-panel"><h3>近时段参数联动</h3><EChart option={paramOption} height={340} /></div>
        <div className="v428-panel"><h3>组合诊断结论</h3><Findings data={data} /></div>
      </section>
    </Shell>
  );
}

function SlurryPage({ data }: { data: AnyObj }) {
  const paramOption = useMemo(() => parameterOption(data), [JSON.stringify(data.parameterTrend || [])]);
  return (
    <Shell>
      <Hero data={data} title="泥水环流、仓压与沉降响应研判" subtitle="泥水注浆 / 沉降归因" />
      <section className="v428-grid3">
        <Metric title="仓压状态" value={fmt(data.parameterSummary?.chamberPressure1, ' bar')} sub="以开挖仓压力为核心" />
        <Metric title="监测响应" value={`${data.alertSummary?.alarm || 0} 报警`} sub="优先关注地表沉降" />
        <Metric title="处置重点" value="仓压/注浆联动" sub="结合邻近测点复核" />
      </section>
      <section className="v428-grid2">
        <div className="v428-panel"><h3>仓压与施工参数趋势</h3><EChart option={paramOption} height={340} /></div>
        <div className="v428-panel"><h3>沉降响应测点</h3><AlertList data={data} limit={10} /></div>
      </section>
      <section className="v428-panel"><h3>当前解释</h3><p className="v428-paragraph">若进排浆、注浆量字段暂未稳定，页面先以仓压、盾尾间隙、邻近沉降报警和建议动作形成研判闭环；正式字段接入后可替换为进排浆平衡和注浆消耗图。</p></section>
    </Shell>
  );
}

function SegmentPage({ data }: { data: AnyObj }) {
  const paramOption = useMemo(() => parameterOption(data), [JSON.stringify(data.parameterTrend || [])]);
  return (
    <Shell>
      <Hero data={data} title="盾尾间隙、姿态与管片风险复核" subtitle="管片盾尾 / 拼装缺陷" />
      <section className="v428-grid3">
        <Metric title="盾尾间隙1#" value={fmt(data.parameterSummary?.shieldTailGap1, ' mm')} sub="重点复核项" />
        <Metric title="当前位置" value={data.position?.headMileageText || '--'} sub={data.currentRisk?.name || '风险源'} />
        <Metric title="相关异常" value={`${data.alertSummary?.alarm || 0} 报警`} sub="监测响应" />
      </section>
      <section className="v428-grid2">
        <div className="v428-panel"><h3>盾尾间隙与参数趋势</h3><EChart option={paramOption} height={340} /></div>
        <div className="v428-panel"><h3>复核建议</h3><Actions data={data} /></div>
      </section>
    </Shell>
  );
}

function EventsPage({ data }: { data: AnyObj }) {
  return (
    <Shell>
      <Hero data={data} title="报警处置与现场闭环" subtitle="事件闭环 / 报警处置" />
      <section className="v428-grid2">
        <div className="v428-panel"><h3>当前优先处置</h3><Actions data={data} /></div>
        <div className="v428-panel"><h3>重点测点</h3><AlertList data={data} limit={8} /></div>
      </section>
      <section className="v428-panel"><h3>闭环说明</h3><p className="v428-paragraph">事件页围绕“发现异常 → 复核证据 → 建议动作 → 处置记录”组织。若正式处置台账暂未稳定返回，系统先使用当前风险源、监测异常和建议动作构成闭环。</p></section>
    </Shell>
  );
}

function DataImportPage({ data }: { data: AnyObj }) {
  return (
    <Shell>
      <Hero data={data} title="数据接入、字段映射与质量状态" subtitle="数据接入 / 接口映射" />
      <section className="v428-grid4">
        <Metric title="实时导向" value={data.position?.sourceText || '待确认'} sub={data.position?.headMileageText || '--'} />
        <Metric title="风险源台账" value={`${(data.riskWindows || []).length} 个`} sub="工程窗口" />
        <Metric title="监测异常" value={`${data.alertSummary?.total || 0} 条`} sub="当前优先集" />
        <Metric title="参数历史" value={`${(data.parameterTrend || []).length} 条`} sub="近时段快照" />
      </section>
      <section className="v428-grid2">
        <div className="v428-panel"><h3>接入链路</h3><div className="v428-pipeline"><b>WebService / 文件</b><b>原始层</b><b>字段映射</b><b>业务表</b><b>研判页面</b></div></div>
        <div className="v428-panel"><h3>待补字段</h3><Gaps data={data} /></div>
      </section>
    </Shell>
  );
}

function SystemPage({ data }: { data: AnyObj }) {
  const pieOption = useMemo(() => statusPieOption(data), [JSON.stringify(data.alertSummary || {})]);
  return (
    <Shell>
      <Hero data={data} title="系统状态、数据质量与页面可信度" subtitle="系统状态 / 数据质量" />
      <section className="v428-grid3">
        <div className="v428-panel"><h3>异常状态摘要</h3><EChart option={pieOption} /></div>
        <div className="v428-panel"><h3>系统检查项</h3><div className="v428-status-list"><p><span>8100 平台后端</span><b>正常</b></p><p><span>实时导向</span><b>{data.position?.sourceText || '待确认'}</b></p><p><span>前端图表</span><b>已接入</b></p></div></div>
        <div className="v428-panel"><h3>数据缺口</h3><Gaps data={data} /></div>
      </section>
    </Shell>
  );
}

function EvidencePage({ data }: { data: AnyObj }) {
  return (
    <Shell>
      <Hero data={data} title="结论、异常读数与来源追溯" subtitle="证据链 / 来源追溯" />
      <section className="v428-grid2">
        <div className="v428-panel"><h3>结论证据</h3><Findings data={data} /></div>
        <div className="v428-panel"><h3>异常测点证据</h3><AlertList data={data} limit={10} /></div>
      </section>
      <section className="v428-panel"><h3>来源说明</h3><p className="v428-paragraph">当前结论来自实时导向位置、风险源台账、监测异常、参数历史和数据质量检查。页面只展示可汇报的证据，不直接暴露接口字段和原始 JSON。</p></section>
    </Shell>
  );
}

function PageRouter({ data }: { data: AnyObj }) {
  const path = window.location.pathname;
  if (path === '/') return <HomePage data={data} />;
  if (path === '/intelligent-analysis' || path === '/ai-diagnosis' || path === '/smart-analysis') return <IntelligentPage data={data} />;
  if (path === '/project-docs') return <ProjectDocsPage data={data} />;
  if (path === '/risk-replay') return <RiskReplayPage data={data} />;
  if (path === '/monitoring-alerts') return <MonitoringPage data={data} />;
  if (path === '/operation-diagnosis') return <OperationPage data={data} />;
  if (path === '/slurry-grouting') return <SlurryPage data={data} />;
  if (path === '/segment-quality') return <SegmentPage data={data} />;
  if (path === '/events' || path === '/event-closure') return <EventsPage data={data} />;
  if (path === '/data-import') return <DataImportPage data={data} />;
  if (path === '/system-status') return <SystemPage data={data} />;
  if (path === '/evidence') return <EvidencePage data={data} />;
  return <HomePage data={data} />;
}

export default function V428AllPagesReportRefactor({ fallback }: { fallback: React.ReactNode }) {
  const path = window.location.pathname;
  const { data, error, loading, load } = useReport(8000);

  if (!ROUTES.has(path)) return <>{fallback}</>;

  if (!data) {
    return (
      <Shell>
        <section className="v428-hero attention">
          <div><span>施工研判</span><h1>{error ? '研判接口暂不可用' : '正在加载施工研判数据'}</h1><p>{error || '正在汇总位置、风险源、监测异常和参数历史。'}</p></div>
          <div className="v428-hero-value"><b>{loading ? '加载中' : '待确认'}</b><em>请稍候</em></div>
        </section>
      </Shell>
    );
  }

  return (
    <>
      <PageRouter data={data} />
      <button className="v428-refresh" onClick={load}>{loading ? '刷新中' : '刷新研判'}</button>
    </>
  );
}
