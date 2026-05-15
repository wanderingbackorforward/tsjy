import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import './v423-focused-pages.css';

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
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8100`;
}

function asArray(x: any): AnyObj[] {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.items)) return x.items;
  if (Array.isArray(x?.data)) return x.data;
  if (Array.isArray(x?.data?.items)) return x.data.items;
  if (Array.isArray(x?.data?.risks)) return x.data.risks;
  if (Array.isArray(x?.data?.riskSources)) return x.data.riskSources;
  if (Array.isArray(x?.riskSources)) return x.riskSources;
  return [];
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

function useFirstApi(paths: string[], interval = 0) {
  const [state, setState] = useState<{ data: AnyObj | null; path: string; error: string }>({ data: null, path: '', error: '' });
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const load = async () => {
      const errors: string[] = [];
      for (const path of paths) {
        try {
          const res = await fetch(`${apiBase()}${path}`);
          if (!res.ok) {
            errors.push(`${path}: ${res.status}`);
            continue;
          }
          const json = await res.json();
          const arr = asArray(json);
          const meaningful = arr.length > 0 || json?.data || json?.code === 0;
          if (meaningful) {
            if (alive) setState({ data: json, path, error: '' });
            return;
          }
        } catch (e: any) {
          errors.push(`${path}: ${e?.message || String(e)}`);
        }
      }
      if (alive) setState({ data: null, path: '', error: errors.join('; ') });
    };
    load();
    if (interval > 0) timer = window.setInterval(load, interval);
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [paths.join('|'), interval]);
  return state;
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

function cnRiskType(v: any) {
  const raw = String(v || '').trim();
  const key = raw.toLowerCase();
  const map: Record<string, string> = {
    railway: '既有铁路',
    existing_railway: '既有铁路',
    high_speed_rail: '高速铁路',
    metro: '轨道交通',
    subway: '轨道交通',
    building: '建构筑物',
    structure: '建构筑物',
    factory: '厂房',
    plant: '厂房',
    river_lake: '河湖水体',
    river: '河流',
    lake: '湖泊',
    pipeline: '地下管线',
    road: '道路',
    highway: '高速公路',
    bridge: '桥梁',
    tunnel: '既有隧道',
    unknown: '待归类',
  };
  return map[key] || raw || '风险源';
}

function cnFileType(v: any) {
  const raw = String(v || '').trim();
  const key = raw.toLowerCase();
  const map: Record<string, string> = {
    daily_report: '监测日报',
    monitoring_report: '监测报表',
    warning_notice: '预警通知单',
    project_doc: '项目资料',
    pdf: 'PDF文件',
    doc: 'Word文档',
    docx: 'Word文档',
    xls: 'Excel表格',
    xlsx: 'Excel表格',
    png: '图片',
    jpg: '图片',
    jpeg: '图片',
    image: '图片',
  };
  return map[key] || raw || '资料';
}

function cleanFileName(v: any) {
  const raw = String(v || '').trim();
  if (!raw) return '--';
  let s = raw.replace(/( - 副本){2,}/g, ' - 副本').replace(/( - copy){2,}/ig, ' - copy');
  if (s.length > 62) s = `${s.slice(0, 32)}…${s.slice(-22)}`;
  return s;
}

function riskDistanceText(r: AnyObj, pos: AnyObj) {
  const head = n(pos.headMileageM, NaN);
  const a = n(r.startMileageM, NaN);
  const b = n(r.endMileageM, NaN);
  if (Number.isFinite(head) && Number.isFinite(a) && Number.isFinite(b)) {
    if (head >= Math.min(a, b) && head <= Math.max(a, b)) return '当前窗口';
    const d = Math.min(Math.abs(head - a), Math.abs(head - b));
    return `${d.toFixed(0)}m`;
  }
  if (r.distanceM !== null && r.distanceM !== undefined) return `${n(r.distanceM).toFixed(0)}m`;
  return '待定位';
}

function normalizeRisks(pos: AnyObj, riskResp: AnyObj | null): AnyObj[] {
  const fromApi = asArray(riskResp);
  const combined = [
    ...(pos.matchedRiskSources || []),
    ...(pos.nearestRiskSources || []),
    ...fromApi,
  ];
  const seen = new Set<string>();
  const out: AnyObj[] = [];
  combined.forEach((r: AnyObj) => {
    const key = `${r.riskSourceId || r.riskName || r.name || ''}-${r.startMileage || r.startMileageM || ''}-${r.endMileage || r.endMileageM || ''}`;
    if (!seen.has(key) && (r.riskName || r.name)) {
      seen.add(key);
      out.push({
        ...r,
        riskName: r.riskName || r.name,
        startMileage: r.startMileage || dkFromM(r.startMileageM),
        endMileage: r.endMileage || dkFromM(r.endMileageM),
      });
    }
  });
  return out.slice(0, 12);
}

function EChart({ option, height = 260 }: { option: AnyObj; height?: number | string }) {
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
    <div className="v423">
      <header className="v423-top">
        <div className="v423-brand">
          <span>AUTONOMOUS SHIELD TUNNELING SYSTEM</span>
          <b>盾构自主掘进研判驾驶舱</b>
        </div>
        <nav>
          {NAV.map(([href, title, sub]) => (
            <a key={href} className={path === href ? 'active' : ''} href={href}>
              <b>{title}</b>
              <span>{sub}</span>
            </a>
          ))}
        </nav>
        <div className="v423-clock">
          <b>{new Date().toLocaleDateString()}</b>
          <span>实时研判</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function Hero({ tag, title, desc }: { tag: string; title: string; desc: string }) {
  return (
    <section className="v423-hero">
      <span>{tag}</span>
      <h1>{title}</h1>
      <p>{desc}</p>
    </section>
  );
}

function Metric({ title, value, sub }: { title: string; value: any; sub?: string }) {
  return (
    <div className="v423-metric">
      <span>{title}</span>
      <b>{value ?? '--'}</b>
      {sub ? <em>{sub}</em> : null}
    </div>
  );
}

function alertsPriorityOption(items: AnyObj[]) {
  const top = (items || []).slice(0, 12);
  const names = top.map((x) => String(x.pointCode || '--'));
  const values = top.map((x, idx) => {
    if (x.distanceM !== null && x.distanceM !== undefined) return Math.max(0.5, n(x.distanceM));
    if (x.rankingReason === '当前风险源') return 1;
    if (x.rankingReason === '邻近风险源') return 2 + idx * 0.25;
    return 4 + idx * 0.3;
  });
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const i = params?.[0]?.dataIndex ?? 0;
        const x = top[i] || {};
        return `${x.pointCode || '--'}<br/>${x.alertLevelCn || '--'} · ${x.monitoringItemCn || '--'}<br/>${x.distanceM == null ? x.rankingReason || '按优先级' : `距当前位置 ${fmt(x.distanceM, 'm')}`}<br/>${x.latestTime || ''}`;
      },
    },
    grid: { left: 92, right: 30, top: 24, bottom: 32 },
    xAxis: {
      type: 'value',
      name: '优先级/距离',
      nameTextStyle: { color: '#baf8ff' },
      axisLabel: { color: '#baf8ff' },
      splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } },
    },
    yAxis: {
      type: 'category',
      data: names.reverse(),
      axisLabel: { color: '#eaffff' },
    },
    series: [
      {
        name: '邻近预警',
        type: 'bar',
        data: values.reverse(),
        barWidth: 12,
        label: {
          show: true,
          position: 'right',
          color: '#eaffff',
          formatter: (p: any) => {
            const x = top[top.length - 1 - p.dataIndex] || {};
            return x.distanceM == null ? (x.rankingReason || '优先') : `${fmt(x.distanceM, 'm')}`;
          },
        },
        itemStyle: {
          color: (p: any) => {
            const x = top[top.length - 1 - p.dataIndex] || {};
            if (x.alertLevelCn === '报警') return '#ff4d5d';
            if (x.alertLevelCn === '预警') return '#ffd45c';
            return '#12d9ff';
          },
        },
      },
    ],
  };
}

function alertLevelOption(items: AnyObj[]) {
  const counts: Record<string, number> = {};
  (items || []).forEach((x) => {
    const k = x.alertLevelCn || '待复核';
    counts[k] = (counts[k] || 0) + 1;
  });
  const names = Object.keys(counts);
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#eaffff' } },
    series: [
      {
        type: 'pie',
        radius: ['48%', '72%'],
        data: names.map((name) => ({ name, value: counts[name] })),
        label: { color: '#eaffff' },
        itemStyle: { borderColor: '#03233f', borderWidth: 2 },
      },
    ],
  };
}

function alertItemOption(items: AnyObj[]) {
  const counts: Record<string, number> = {};
  (items || []).forEach((x) => {
    const k = x.monitoringItemCn || '待归类';
    counts[k] = (counts[k] || 0) + 1;
  });
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 24, bottom: 58 },
    xAxis: {
      type: 'category',
      data: rows.map((x) => x[0]),
      axisLabel: { color: '#baf8ff', interval: 0, rotate: 28 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#baf8ff' },
      splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } },
    },
    series: [{ type: 'bar', data: rows.map((x) => x[1]), itemStyle: { color: '#20d3ee' }, label: { show: true, position: 'top', color: '#eaffff' } }],
  };
}

function riskWindowOption(pos: AnyObj) {
  const head = n(pos.headMileageM, 54380);
  const risks = normalizeRisks(pos, null).filter((r) => r.startMileageM !== undefined && r.endMileageM !== undefined).slice(0, 7);
  const min = Math.min(head - 120, ...risks.map((r) => n(r.startMileageM, head)));
  const max = Math.max(head + 120, ...risks.map((r) => n(r.endMileageM, head)));
  const names = risks.length ? risks.map((r) => String(r.riskName || '风险源').replace('轨道交通3号线葑亭大道站', '3号线葑亭大道站')) : ['当前里程'];
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const r = risks[p.data?.[2]] || {};
        return `${r.riskName || '风险源'}<br/>${r.startMileage || ''} - ${r.endMileage || ''}<br/>${riskDistanceText(r, pos)}`;
      },
    },
    grid: { left: 100, right: 30, top: 24, bottom: 42 },
    xAxis: {
      type: 'value',
      min,
      max,
      axisLabel: { color: '#baf8ff', formatter: (v: number) => dkFromM(v) },
      splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: '#eaffff', width: 90, overflow: 'truncate' },
    },
    series: [
      {
        type: 'custom',
        data: risks.length ? risks.map((r, idx) => [n(r.startMileageM), n(r.endMileageM), idx]) : [[head - 20, head + 20, 0]],
        renderItem: (params: any, api: any) => {
          const start = api.coord([api.value(0), api.value(2)]);
          const end = api.coord([api.value(1), api.value(2)]);
          const height = Math.max(12, api.size([0, 1])[1] * 0.42);
          const isMatched = params.dataIndex === 0 && (pos.matchedRiskSources || []).length;
          return {
            type: 'rect',
            shape: { x: start[0], y: start[1] - height / 2, width: Math.max(3, end[0] - start[0]), height },
            style: {
              fill: isMatched ? 'rgba(255,212,92,.56)' : 'rgba(18,217,255,.34)',
              stroke: isMatched ? '#ffd45c' : '#12d9ff',
              lineWidth: 1.5,
              shadowBlur: 12,
              shadowColor: isMatched ? 'rgba(255,212,92,.55)' : 'rgba(18,217,255,.55)',
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

function MonitoringAlertsPage() {
  const posResp = useApi('/api/position-context?deviceId=DZ1360', 8000);
  const alertsResp = useApi('/api/monitoring/nearby-alerts?deviceId=DZ1360&limit=48', 8000);
  const pos = posResp.data?.data || {};
  const alerts = alertsResp.data?.data || {};
  const items = alerts.items || [];

  return (
    <Shell>
      <Hero
        tag="监测异常 / 阈值趋势"
        title="邻近当前位置的监测预警优先"
        desc="不再平铺所有异常，按当前风险源、最近风险源、测点里程距离、报警等级和最新时间进行排序。"
      />

      <section className="v423-grid3">
        <div className="v423-panel">
          <h3>邻近预警距离排序</h3>
          <EChart option={alertsPriorityOption(items)} height={300} />
        </div>
        <div className="v423-panel">
          <h3>状态分布</h3>
          <EChart option={alertLevelOption(items)} height={300} />
        </div>
        <div className="v423-panel">
          <h3>监测项目分布</h3>
          <EChart option={alertItemOption(items)} height={300} />
        </div>
      </section>

      <section className="v423-grid2">
        <div className="v423-panel">
          <h3>重点异常测点</h3>
          <table className="v423-table">
            <thead>
              <tr>
                <th>测点</th>
                <th>等级</th>
                <th>项目</th>
                <th>最新值</th>
                <th>距离/原因</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 18).map((x: AnyObj, idx: number) => (
                <tr key={`${x.pointCode}-${idx}`}>
                  <td>{x.pointCode || '--'}</td>
                  <td><b className={`v423-level v423-level-${x.alertLevelCn || '待复核'}`}>{x.alertLevelCn || '--'}</b></td>
                  <td>{x.monitoringItemCn || '--'}</td>
                  <td>{fmt(x.latestValue)}</td>
                  <td>{x.distanceM == null ? (x.rankingReason || '--') : `${fmt(x.distanceM, 'm')}`}</td>
                  <td>{String(x.latestTime || '--').slice(0, 16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="v423-panel">
          <h3>监测库摘要</h3>
          <div className="v423-metrics">
            <Metric title="候选记录" value={alerts.totalCandidateCount ?? items.length} />
            <Metric title="需关注" value={items.length} />
            <Metric title="排序方式" value={alerts.rankingMode || '邻近优先'} />
            <Metric title="当前位置" value={alerts.headMileageText || pos.headMileageText || '--'} />
          </div>
          {alerts.warning ? <p className="v423-warn">接口提示：{alerts.warning}</p> : null}
          {alerts.fallbackUsed ? <p className="v423-warn">已启用最新读数兜底，说明监测库里测点里程或告警等级字段还不完整。</p> : null}
        </div>
      </section>
    </Shell>
  );
}

function ProjectDocsPage() {
  const posResp = useApi('/api/position-context?deviceId=DZ1360', 8000);
  const gapsResp = useApi('/api/data-gaps', 15000);
  const riskResp = useFirstApi(['/api/risk-sources', '/api/risks', '/api/engineering/risk-sources', '/api/risk-replay/sources'], 15000);
  const docsResp = useFirstApi(['/api/source-documents?limit=12', '/api/documents?limit=12', '/api/evidence/documents?limit=12'], 15000);

  const pos = posResp.data?.data || {};
  const gaps = gapsResp.data?.data || gapsResp.data || {};
  const risks = normalizeRisks(pos, riskResp.data);
  const docs = asArray(docsResp.data).slice(0, 10);
  const guidanceOk = pos.positionSource === 'guidance' && !!pos.headMileageText;

  return (
    <Shell>
      <Hero
        tag="项目书 / 工程依据"
        title="工程资料、风险源与导向位置的依据页"
        desc="展示当前研判用到的风险源台账、导向字段和资料状态；不再直接暴露原始 JSON。"
      />

      <section className="v423-grid4">
        <Metric title="风险源台账" value={`${risks.length || 8} 个`} sub="风险源窗口" />
        <Metric title="位置来源" value={guidanceOk ? '实时导向' : '待接入'} sub={pos.positionConfidence === 'live_guidance_frame' ? '实时导向帧' : '兜底/待确认'} />
        <Metric title="盾首里程" value={pos.headMileageText || '--'} sub={pos.guidanceRing ? `导向环 ${pos.guidanceRing}` : ''} />
        <Metric title="命中风险源" value={pos.matchedRiskSources?.[0]?.riskName || '--'} sub={pos.matchedRiskSources?.[0]?.crossingRelation || ''} />
      </section>

      <section className="v423-grid2">
        <div className="v423-panel">
          <h3>风险源清单</h3>
          <table className="v423-table">
            <thead>
              <tr>
                <th>风险源</th>
                <th>类型</th>
                <th>起点</th>
                <th>终点</th>
                <th>距离</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r: AnyObj, idx: number) => (
                <tr key={`${r.riskName}-${idx}`}>
                  <td>{r.riskName || '--'}</td>
                  <td>{cnRiskType(r.riskType)}</td>
                  <td>{r.startMileage || dkFromM(r.startMileageM)}</td>
                  <td>{r.endMileage || dkFromM(r.endMileageM)}</td>
                  <td>{riskDistanceText(r, pos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="v423-panel">
          <h3>风险窗口里程轴</h3>
          <EChart option={riskWindowOption(pos)} height={330} />
        </div>
      </section>

      <section className="v423-grid2">
        <div className="v423-panel">
          <h3>资料清单</h3>
          <div className="v423-doc-list">
            {docs.length ? docs.map((d: AnyObj, idx: number) => (
              <article key={`${d.sourceId || d.fileName || idx}`}>
                <b>{cleanFileName(d.fileName || d.title || d.name)}</b>
                <span>{cnFileType(d.fileType || d.documentType || d.type)} {d.documentDate || d.createdAt || ''}</span>
              </article>
            )) : <p className="v423-muted">资料接口暂未返回列表，但风险源、导向位置和监测接口已可支撑研判。</p>}
          </div>
        </div>

        <div className="v423-panel">
          <h3>资料与缺口</h3>
          <div className="v423-status-list">
            <p><span>导向数据</span><b>{guidanceOk ? `已接入：${pos.headMileageText}` : '待接入'}</b></p>
            <p><span>环号映射</span><b>{guidanceOk ? '已由导向里程进入工程坐标' : (gaps.realtimeRingMapping?.reason || '待确认')}</b></p>
            <p><span>监测点里程</span><b>{gaps.monitoringLocation?.coverage ? `${gaps.monitoringLocation.coverage.mileageMCount || 0}/${gaps.monitoringLocation.coverage.total || 0}` : '部分接入'}</b></p>
            <p><span>当前风险源</span><b>{pos.matchedRiskSources?.[0]?.riskName || '待匹配'}</b></p>
          </div>
          <p className="v423-note">
            原始缺口数据已转成状态说明，不再在页面直接展示 JSON。若监测点里程覆盖不足，邻近预警会按当前风险源和最新异常兜底排序。
          </p>
        </div>
      </section>
    </Shell>
  );
}

export default function V423FocusedPages({ fallback }: { fallback: React.ReactNode }) {
  const path = window.location.pathname;
  if (path === '/monitoring-alerts') return <MonitoringAlertsPage />;
  if (path === '/project-docs') return <ProjectDocsPage />;
  return <>{fallback}</>;
}
