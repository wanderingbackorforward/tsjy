import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import './v426-operator-experience-fix.css';

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
          setData(json);
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

function cnLevel(v: any) {
  const s = String(v || '').trim();
  if (s === 'alarm' || s.includes('报警')) return '报警';
  if (s === 'warning' || s.includes('预警')) return '预警';
  if (s === 'attention' || s.includes('关注')) return '关注';
  if (s === 'normal' || s.includes('正常')) return '正常';
  return s || '待复核';
}

function levelClass(v: any) {
  const s = cnLevel(v);
  if (s.includes('报警')) return 'alarm';
  if (s.includes('预警')) return 'warning';
  if (s.includes('关注') || s.includes('复核')) return 'attention';
  return 'normal';
}

function sourceLabel(v: any) {
  const s = String(v || '').trim();
  if (s === 'ai') return '智能辅助研判';
  if (s === 'reasoner') return '深度归因研判';
  if (s === 'rule_fallback') return '基础研判';
  if (s === 'rule') return '基础研判';
  return '综合研判';
}

function modeLabel(v: string) {
  if (v === 'ai') return '智能总结';
  if (v === 'reasoner') return '深度归因';
  return '基础研判';
}

function gapTitle(field: any) {
  const s = String(field || '');
  if (s.includes('monitoring_point.mileage')) return '测点里程覆盖不足';
  if (s.includes('guidance')) return '实时导向明细待补齐';
  if (s.includes('event_log')) return '处置记录待补齐';
  return s || '数据待补齐';
}

function friendlyEvidence(e: any) {
  const s = String(e || '');
  if (s.includes('guidance.fields')) return '导向姿态明细暂未返回';
  if (s.includes('monitoringAlerts.items')) return '监测异常列表暂未返回';
  return s;
}

function priorityReason(x: AnyObj) {
  if (x.distanceM !== null && x.distanceM !== undefined) return `距盾首 ${fmt(x.distanceM, 'm')}`;
  const r = String(x.rankingReason || x.reason || '');
  if (r.includes('当前风险源')) return '当前风险窗口内';
  if (r.includes('邻近风险源')) return '邻近风险源';
  if (r.includes('最新')) return '按最新异常排序';
  return '按报警等级排序';
}

function dedupeAlerts(items: AnyObj[]) {
  const rank: Record<string, number> = { 报警: 3, 预警: 2, 待复核: 1 };
  const map = new Map<string, AnyObj>();
  for (const item of items || []) {
    const key = String(item.pointCode || item.point_code || item.point || '--');
    const current = map.get(key);
    const itemLevel = item.alertLevelCn || item.level || '待复核';
    const currentLevel = current?.alertLevelCn || current?.level || '待复核';
    if (!current || (rank[itemLevel] || 0) > (rank[currentLevel] || 0)) {
      map.set(key, { ...item, pointCode: key, alertLevelCn: itemLevel });
    }
  }
  return Array.from(map.values());
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
    <div className="v426">
      <header className="v426-top">
        <div className="v426-brand">
          <span>AUTONOMOUS SHIELD TUNNELING SYSTEM</span>
          <b>盾构施工智能研判驾驶舱</b>
        </div>
        <nav>
          {NAV.map(([href, title, sub]) => (
            <a key={href} href={href} className={path === href ? 'active' : ''}>
              <b>{title}</b>
              <span>{sub}</span>
            </a>
          ))}
        </nav>
        <div className="v426-clock">
          <b>{new Date().toLocaleDateString()}</b>
          <span>实时研判</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function riskWindowOptionFromPosition(pos: AnyObj) {
  const head = n(pos.headMileageM, 54380);
  const raw = [...(pos.matchedRiskSources || []), ...(pos.nearestRiskSources || [])];
  const seen = new Set<string>();
  const items: AnyObj[] = [];
  raw.forEach((r: AnyObj) => {
    const key = `${r.riskName || ''}-${r.startMileageM || ''}-${r.endMileageM || ''}`;
    if (!seen.has(key) && r.startMileageM !== undefined && r.endMileageM !== undefined) {
      seen.add(key);
      items.push(r);
    }
  });
  const min = Math.min(head - 120, ...items.map((x) => n(x.startMileageM, head)));
  const max = Math.max(head + 120, ...items.map((x) => n(x.endMileageM, head)));
  const names = items.length ? items.map((x) => String(x.riskName || '风险源').replace('轨道交通3号线葑亭大道站', '3号线葑亭大道站')) : ['当前里程'];

  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const r = items[p.data?.[2]] || {};
        return `${r.riskName || '风险源'}<br/>${r.startMileage || ''} - ${r.endMileage || ''}`;
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
        data: items.length ? items.map((r, idx) => [n(r.startMileageM), n(r.endMileageM), idx, idx === 0 && (pos.matchedRiskSources || []).length ? 1 : 0]) : [[head - 20, head + 20, 0, 0]],
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
          label: { color: '#ffd45c', formatter: `当前 ${pos.headMileageText || ''}` },
          lineStyle: { color: '#ffd45c', width: 2 },
          data: [{ xAxis: head }],
        },
      },
    ],
  };
}

function parameterTrendOption(rows: AnyObj[]) {
  const data = rows || [];
  const xs = data.map((x) => String(x.timestamp || x.receivedAt || x.time || '').slice(11, 19));
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

function poseRadarOption(pos: AnyObj) {
  const m = pos.guidanceMetrics || {};
  const value = (key: string, scale = 1) => Math.abs(n(m[key]?.value, 0) * scale);
  return {
    radar: {
      radius: '68%',
      indicator: [
        { name: '盾首水平', max: 80 },
        { name: '盾首垂直', max: 80 },
        { name: '盾中水平', max: 80 },
        { name: '盾尾水平', max: 80 },
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
        value: [
          value('headHorizontalOffset'),
          value('headVerticalOffset'),
          value('middleHorizontalOffset'),
          value('tailHorizontalOffset'),
          value('roll', 10),
          value('pitch', 10),
        ],
        areaStyle: { color: 'rgba(18,217,255,.24)' },
        lineStyle: { color: '#38f5b1', width: 3 },
        itemStyle: { color: '#ffd45c' },
      }],
    }],
  };
}

function RiskVisual({ pos }: { pos: AnyObj }) {
  const risk = pos.matchedRiskSources?.[0];
  return (
    <div className="v426-tunnel">
      <div className="v426-shield">
        <i />
        <strong>{pos.headMileageText || 'DK--'}</strong>
        <span>盾首当前位置</span>
      </div>
      <div className="v426-tunnel-line" />
      <div className="v426-risk-tag">{risk ? `${risk.riskName} ${risk.crossingRelation || ''}` : '风险源待匹配'}</div>
      <div className="v426-mile-tail">盾尾 {pos.tailMileageText || '--'}</div>
      <div className="v426-mile-head">盾首 {pos.headMileageText || '--'}</div>
    </div>
  );
}

function PriorityAlertsList({ items }: { items: AnyObj[] }) {
  const rows = dedupeAlerts(items).slice(0, 8);
  return (
    <div className="v426-priority-list">
      {rows.map((x, idx) => (
        <article key={`${x.pointCode}-${idx}`} className={levelClass(x.alertLevelCn || x.level)}>
          <div>
            <b>{x.pointCode || '--'}</b>
            <span>{x.alertLevelCn || x.level || '待复核'} · {x.monitoringItemCn || x.item || x.monitoringItem || '监测项'}</span>
          </div>
          <em>{priorityReason(x)}</em>
          <small>{String(x.latestTime || x.time || '').slice(0, 16)}</small>
        </article>
      ))}
      {!rows.length ? <p className="v426-muted">暂无邻近预警数据，检查监测异常接口。</p> : null}
    </div>
  );
}

function HomePage() {
  const posResp = useApi('/api/position-context?deviceId=DZ1360', 8000);
  const alertsResp = useApi('/api/monitoring/nearby-alerts?deviceId=DZ1360&limit=60', 8000);
  const histResp = useApi('/api/tbm/history?deviceId=DZ1360&limit=90', 10000);

  const pos = posResp.data?.data || {};
  const alerts = alertsResp.data?.data || {};
  const alertRows = alerts.items || [];
  const history = histResp.data?.data?.items || histResp.data?.data || [];
  const risk = pos.matchedRiskSources?.[0];

  const riskOption = useMemo(() => riskWindowOptionFromPosition(pos), [JSON.stringify(pos.matchedRiskSources || []), JSON.stringify(pos.nearestRiskSources || []), pos.headMileageM]);
  const paramOption = useMemo(() => parameterTrendOption(history), [JSON.stringify(history)]);
  const radarOption = useMemo(() => poseRadarOption(pos), [JSON.stringify(pos.guidanceMetrics || {})]);

  const alarmCount = alertRows.filter((x: AnyObj) => String(x.alertLevelCn || x.level).includes('报警')).length;
  const warningCount = alertRows.filter((x: AnyObj) => String(x.alertLevelCn || x.level).includes('预警')).length;

  return (
    <Shell>
      <section className="v426-hero">
        <div>
          <span>指挥总览 / 当前环 / 风险窗口</span>
          <h1>{risk ? `当前盾首位于 ${risk.riskName}${risk.crossingRelation || ''}窗口` : '当前盾构位置与风险窗口总览'}</h1>
          <p>
            盾首 {pos.headMileageText || '--'}，盾中 {pos.middleMileageText || '--'}，盾尾 {pos.tailMileageText || '--'}。
            邻近预警按当前风险窗口、报警等级和最新时间优先展示。
          </p>
        </div>
        <div className="v426-hero-value">
          <b>{pos.headMileageText || '--'}</b>
          <em>{alarmCount} 条报警 / {warningCount} 条预警</em>
        </div>
      </section>

      <section className="v426-home-grid">
        <div className="v426-panel v426-main-visual">
          <h3>工程主视图</h3>
          <RiskVisual pos={pos} />
        </div>

        <div className="v426-panel">
          <h3>当前位置</h3>
          <div className="v426-status-list">
            <p><span>导向环</span><b>{pos.guidanceRing || '--'}</b></p>
            <p><span>工程环</span><b>{pos.engineeringRing?.ringNo || '--'}</b></p>
            <p><span>盾首/盾中/盾尾</span><b>{pos.headMileageText || '--'} / {pos.middleMileageText || '--'} / {pos.tailMileageText || '--'}</b></p>
            <p><span>当前风险源</span><b>{risk ? `${risk.riskName} ${risk.crossingRelation || ''}` : '--'}</b></p>
          </div>
        </div>

        <div className="v426-panel">
          <h3>当前优先处置</h3>
          <PriorityAlertsList items={alertRows} />
        </div>
      </section>

      <section className="v426-chart-grid">
        <div className="v426-panel">
          <h3>风险窗口里程轴</h3>
          <EChart option={riskOption} height={280} />
        </div>
        <div className="v426-panel">
          <h3>盾构姿态雷达</h3>
          <EChart option={radarOption} height={280} />
        </div>
        <div className="v426-panel">
          <h3>近时段参数联动</h3>
          <EChart option={paramOption} height={280} />
        </div>
        <div className="v426-panel">
          <h3>邻近预警优先清单</h3>
          <PriorityAlertsList items={alertRows} />
        </div>
      </section>
    </Shell>
  );
}

function chartRiskOption(chartData: AnyObj) {
  const rw = chartData?.riskWindow || {};
  return riskWindowOptionFromPosition({
    headMileageM: rw.headMileageM,
    headMileageText: rw.headMileageText,
    matchedRiskSources: (rw.items || []).filter((x: AnyObj) => x.matched),
    nearestRiskSources: rw.items || [],
  });
}

function chartAlertsOption(chartData: AnyObj) {
  const rows = dedupeAlerts(chartData?.monitoringAlerts || []).slice(0, 12).reverse();
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 92, right: 26, top: 24, bottom: 36 },
    xAxis: { type: 'value', axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    yAxis: { type: 'category', data: rows.map((x) => x.pointCode || '--'), axisLabel: { color: '#eaffff' } },
    series: [{
      type: 'bar',
      data: rows.map((x, idx) => x.distanceM == null ? idx + 1 : Math.max(0.5, n(x.distanceM))),
      label: {
        show: true,
        position: 'right',
        color: '#eaffff',
        formatter: (p: any) => priorityReason(rows[p.dataIndex] || {}),
      },
      itemStyle: {
        color: (p: any) => {
          const x = rows[p.dataIndex] || {};
          if (String(x.level || x.alertLevelCn).includes('报警')) return '#ff4d5d';
          if (String(x.level || x.alertLevelCn).includes('预警')) return '#ffd45c';
          return '#12d9ff';
        },
      },
    }],
  };
}

function chartParamOption(chartData: AnyObj) {
  return parameterTrendOption(chartData?.parameterTrend || []);
}

function chartGraphOption(chartData: AnyObj) {
  const graph = chartData?.causalGraph || {};
  return {
    tooltip: {},
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      label: { show: true, color: '#eaffff' },
      force: { repulsion: 420, edgeLength: 120 },
      data: (graph.nodes || []).map((x: AnyObj, idx: number) => ({
        ...x,
        symbolSize: idx === 0 ? 64 : 52,
        itemStyle: { color: idx === 0 ? '#ffd45c' : '#12d9ff' },
      })),
      links: graph.links || [],
      lineStyle: { color: '#38f5b1', width: 2, curveness: 0.18 },
    }],
  };
}

function FindingCard({ f }: { f: AnyObj }) {
  return (
    <article className={`v426-finding ${levelClass(f.level)}`}>
      <h4>{f.title || '研判发现'}</h4>
      <p>可信度：{fmt((f.confidence ?? 0) * 100, '%')}</p>
      <ul>
        {(f.evidence || []).slice(0, 4).map((e: any, idx: number) => <li key={idx}>{friendlyEvidence(e)}</li>)}
      </ul>
    </article>
  );
}

function IntelligentPage() {
  const [mode, setMode] = useState('rule');
  const { data, error, loading, load } = useDiagnosis(mode);

  const chartData = data?.chartData || {};
  const findings = data?.keyFindings || [];
  const actions = data?.recommendedActions || [];
  const chains = data?.causalChains || [];
  const gaps = data?.dataGaps || [];

  const riskOption = useMemo(() => chartRiskOption(chartData), [JSON.stringify(chartData?.riskWindow || {})]);
  const paramOption = useMemo(() => chartParamOption(chartData), [JSON.stringify(chartData?.parameterTrend || [])]);
  const alertOption = useMemo(() => chartAlertsOption(chartData), [JSON.stringify(chartData?.monitoringAlerts || [])]);
  const graphOption = useMemo(() => chartGraphOption(chartData), [JSON.stringify(chartData?.causalGraph || {})]);

  return (
    <Shell>
      <section className={`v426-hero ${levelClass(data?.overallLevel)}`}>
        <div>
          <span>智能研判 / 施工风险 / 处置建议</span>
          <h1>{data?.summary || '正在汇总实时导向、风险源、监测异常和盾构参数'}</h1>
          <p>
            当前页面只展示面向现场汇报的结论、证据和处置建议；技术细节已收起，避免影响阅读。
          </p>
        </div>
        <div className="v426-hero-value">
          <b>{cnLevel(data?.overallLevel) || '--'}</b>
          <em>{sourceLabel(data?.source)} {data?.latencyMs ? `· ${data.latencyMs}ms` : ''}</em>
        </div>
      </section>

      <section className="v426-toolbar">
        <label>
          研判方式
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="rule">基础研判：最快最稳</option>
            <option value="ai">智能总结：更像汇报口径</option>
            <option value="reasoner">深度归因：适合复盘</option>
          </select>
        </label>
        <button onClick={() => load(mode)} disabled={loading}>{loading ? '研判中...' : `执行${modeLabel(mode)}`}</button>
        {data?.fallbackUsed ? <span className="v426-warn">智能总结暂不可用，已自动使用基础研判。</span> : null}
        {error ? <span className="v426-warn">接口错误：{error}</span> : null}
      </section>

      <section className="v426-grid4">
        <div className="v426-panel"><h3>风险窗口</h3><EChart option={riskOption} height={300} /></div>
        <div className="v426-panel"><h3>参数联动</h3><EChart option={paramOption} height={300} /></div>
        <div className="v426-panel"><h3>邻近预警</h3><EChart option={alertOption} height={300} /></div>
        <div className="v426-panel"><h3>风险传导链</h3><EChart option={graphOption} height={300} /></div>
      </section>

      <section className="v426-grid2">
        <div className="v426-panel">
          <h3>关键发现</h3>
          <div className="v426-finding-grid">
            {findings.length ? findings.map((f: AnyObj, idx: number) => <FindingCard f={f} key={idx} />) : <p className="v426-muted">暂无研判结果。</p>}
          </div>
        </div>
        <div className="v426-panel">
          <h3>建议动作</h3>
          <div className="v426-actions">
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

      <section className="v426-grid2">
        <div className="v426-panel">
          <h3>风险传导说明</h3>
          <div className="v426-chain-list">
            {chains.map((c: AnyObj, idx: number) => (
              <article key={idx}>
                <h4>{c.name}</h4>
                <p>{(c.nodes || []).join(' → ')}</p>
                <em>可信度：{fmt((c.confidence ?? 0) * 100, '%')}</em>
              </article>
            ))}
          </div>
        </div>
        <div className="v426-panel">
          <h3>还需补齐的数据</h3>
          <div className="v426-gap-list">
            {gaps.length ? gaps.map((g: AnyObj, idx: number) => (
              <article key={idx}>
                <b>{gapTitle(g.field)}</b>
                <span>{g.impact}</span>
              </article>
            )) : <p className="v426-muted">当前未识别到阻断性数据缺口。</p>}
          </div>
        </div>
      </section>
    </Shell>
  );
}

export default function V426OperatorExperienceFix({ fallback }: { fallback: React.ReactNode }) {
  const path = window.location.pathname;
  if (path === '/') return <HomePage />;
  if (path === '/intelligent-analysis' || path === '/ai-diagnosis' || path === '/smart-analysis') return <IntelligentPage />;
  return <>{fallback}</>;
}
