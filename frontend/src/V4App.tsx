import React, { useEffect, useMemo, useState } from 'react';
import './v4.css'; type AnyObj = Record<string, any>; const API_HOST = () => `http://${window.location.hostname || '120.55.70.218'}:8100`; const REPORT_POSITION = {
  deviceId: 'DZ1360',
  fallbackRing: 5325,
  anchorSectionId: 'SEC-011',
  anchorSectionName: '轨道交通3号线葑亭大道站穿越段',
  anchorRing: 1152,
  anchorMileage: 'DK55+998',
  anchorMileageM: 55998,
  ringWidthM: 2.0,
  riskSourceName: '轨道交通3号线葑亭大道站',
  sectionCount: 23,
  anchorCount: 65,
  ruleName: '1152环 / DK55+998 + 2.0m/环',
};

function formatDkMileage(mileageM: number) {
  const m = Math.round(Number(mileageM) || 0);
  const km = Math.floor(m / 1000);
  const meter = Math.abs(m - km * 1000);
  return `DK${km}+${String(meter).padStart(3, '0')}`;
}

function calcMileageByRing(ringValue: any) {
  const ring = Number(ringValue);
  const safeRing = Number.isFinite(ring) ? ring : REPORT_POSITION.fallbackRing;
  const mileageM = REPORT_POSITION.anchorMileageM + (safeRing - REPORT_POSITION.anchorRing) * REPORT_POSITION.ringWidthM;
  return {
    ring: safeRing,
    mileageM,
    mileage: formatDkMileage(mileageM),
    deltaRing: safeRing - REPORT_POSITION.anchorRing,
    deltaMileage: (safeRing - REPORT_POSITION.anchorRing) * REPORT_POSITION.ringWidthM,
  };
}

function ringFormulaText(ringValue: any) {
  const pos = calcMileageByRing(ringValue);
  return `${REPORT_POSITION.anchorMileage} + (${Math.round(pos.ring)} - ${REPORT_POSITION.anchorRing}) * ${REPORT_POSITION.ringWidthM}m = ${pos.mileage}`;
}

async function getApi(path: string) { const url = `${API_HOST()}${path}`; const res = await fetch(url, { headers: { Accept: 'application/json' } }); if (!res.ok) throw new Error(`${res.status} ${res.statusText}`); const json = await res.json(); return json?.data ?? json;
} function useApi(path: string, intervalMs = 0) { const [data, setData] = useState<any>(null); const [error, setError] = useState(''); useEffect(() => { let alive = true; async function load() { try { const v = await getApi(path); if (alive) { setData(v); setError(''); } } catch (e: any) { if (alive) setError(e?.message || '接口暂不可用'); } } load(); if (!intervalMs) return () => { alive = false; }; const timer = window.setInterval(load, intervalMs); return () => { alive = false; window.clearInterval(timer); }; }, [path, intervalMs]); return { data, error };
} function normalizePath(pathname: string) { const p = (pathname || '/').replace(/\/+$/, '') || '/'; const aliases: Record<string, string> = { '/dashboard': '/', '/monitoring': '/monitoring-alerts', '/alerts': '/monitoring-alerts', '/operation': '/operation-diagnosis', '/diagnosis': '/operation-diagnosis', '/slurry': '/slurry-grouting', '/slurry-analysis': '/slurry-grouting', '/pipe-quality': '/segment-quality', '/segment': '/segment-quality', '/events': '/events', '/event-loop': '/events', '/import': '/data-import', '/data': '/data-import', '/status': '/system-status', }; return aliases[p] || p;
}

function cnStatus(v: any) {
  const raw = String(v ?? '').trim();
  const l = raw.toLowerCase();
  if (!raw) return '待确认';
  if (l === 'normal' || raw === '正常') return '正常';
  if (l === 'warning' || l === 'warn' || raw === '预警') return '预警';
  if (l === 'alarm' || raw === '报警') return '报警';
  if (l === 'unknown' || raw === '未知' || raw === '待确认') return '待复核';
  if (l === 'exceed_design_limit') return '超设计限值';
  if (l === 'confirmed') return '已确认';
  if (l === 'scale_checked') return '已校准换算';
  if (l === 'scale_pending') return '比例待校准';
  if (l === 'pending') return '待解释';
  return raw;
}

function cnItemName(v: any) {
  const raw = String(v || '').trim();
  const l = raw.toLowerCase();
  const map: Record<string, string> = {
    'surface_settlement': '地表沉降',
    'ground_settlement': '地表沉降',
    '地表沉降': '地表沉降',
    'vertical_displacement': '竖向位移',
    '竖向位移': '竖向位移',
    'horizontal_displacement': '水平位移',
    '水平位移': '水平位移',
    'tunnel_horizontal_displacement': '隧道水平位移',
    'tunnel_vertical_displacement': '隧道竖向位移',
    'building_vertical_displacement': '建筑物竖向位移',
    'building_settlement': '建筑物沉降',
    'pipeline_settlement': '管线沉降',
    'unknown': '待归类',
    '未知': '待归类',
  };
  return map[l] || map[raw] || raw || '待归类';
}

function cnRiskType(v: any) {
  const raw = String(v || '').trim();
  const l = raw.toLowerCase();
  const map: Record<string, string> = {
    'railway': '既有铁路',
    'existing_railway': '既有铁路',
    'metro': '轨道交通',
    'building': '建构筑物',
    'factory': '厂房',
    'river_lake': '河湖水体',
    'pipeline': '地下管线',
    'road': '道路',
  };
  return map[l] || raw || '风险源';
}

function cnRiskLevel(v: any) {
  const raw = String(v || '').trim();
  const l = raw.toLowerCase();
  const map: Record<string, string> = {
    'high': '重点关注',
    'medium': '一般关注',
    'low': '常规关注',
    'major': '重大风险',
    'important': '重点关注',
    '专项保护': '专项保护',
    '重点监测': '重点监测',
  };
  return map[l] || raw || '待评估';
}

function cnEventType(v: any) {
  const raw = String(v || '').trim();
  const l = raw.toLowerCase();
  const map: Record<string, string> = {
    'grouting_abnormal': '注浆参数异常',
    'face_pressure_abnormal': '开挖仓压力异常',
    'settlement_warning': '沉降预警',
    'monitoring_alarm': '监测报警',
    'risk_crossing': '风险源穿越',
  };
  return map[l] || raw || '现场事件';
}

function cnSeverity(v: any) {
  const raw = String(v || '').trim();
  const l = raw.toLowerCase();
  const map: Record<string, string> = {
    'info': '记录',
    'warning': '预警',
    'alarm': '报警',
    'critical': '严重',
  };
  return map[l] || raw || '待确认';
}

function summaryConcern(total: AnyObj | undefined) {
  return total?.concernCount ?? total?.abnormalCount ?? 0;
}

function summaryReview(total: AnyObj | undefined) {
  return total?.reviewCount ?? 0;
}

function riskWindowText(r: AnyObj) {
  return `${r.startMileage || '--'} - ${r.endMileage || '--'}`;
}

function riskFocusText(r: AnyObj) {
  return `${cnRiskType(r.riskType)} / ${cnRiskLevel(r.riskLevel || r.protectionLevel)} / 关联测点 ${r.monitoringPointCount ?? r.relatedPointCount ?? 0} 个`;
}

function countPairs(rows: AnyObj[] | undefined, nameKey: string, valueKey = 'count', translate = true) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({ name: translate ? cnStatus(r[nameKey]) : cnItemName(r[nameKey]), value: asNum(r[valueKey]) }))
    .filter((x) => x.value > 0);
}

function cnDocType(v: any) { const l = String(v || '').toLowerCase(); if (l === 'daily_report') return '监测日报'; if (l === 'weekly_report') return '监测周报'; if (l === 'image') return '现场图片'; if (l === 'pdf') return 'PDF'; return String(v || '资料');
} function fmtDate(v: any) { if (!v) return '--'; return String(v).replace('T00:00:00', '').replace('T', ' ').slice(0, 19);
} function shortId(v: any) { const s = String(v || ''); return s.length > 12 ? `${s.slice(0, 8)}...${s.slice(-4)}` : (s || '--');
} function cleanFileName(v: any) { return String(v || '--') .replace(/( - 副本)+/g, ' - 副本') .replace(/(\s*- 副本\s*){2,}/g, ' - 副本');
} function asNum(v: any) { const n = Number(v); return Number.isFinite(n) ? n : 0;
} function fieldValue(f: AnyObj | undefined) { if (!f) return '--'; const key = f.fieldKey || f.key || ''; const n = Number(f.displayValue); if ((key === 'advanceSpeed' || key === 'advancePumpPressure') && Number.isFinite(n) && n > 1000) return '待复核'; return f.displayValue ?? '--';
} function numericField(f: AnyObj) { const v = fieldValue(f); return v === '待复核' || v === '--' ? 0 : asNum(v);
} function groupFields(tbm: AnyObj | null | undefined, key: string): AnyObj[] { const g = tbm?.groups || {}; return Array.isArray(g[key]) ? g[key] : [];
}

function countBy(items: AnyObj[], fn: (x: AnyObj) => string) { const m: Record<string, number> = {}; for (const it of items) { const k = fn(it) || '待确认'; m[k] = (m[k] || 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
} function fieldStatusText(q: AnyObj = {}) { return `已确认 ${q.confirmed || 0}，已校准 ${q.scale_checked || 0}，待校准 ${q.scale_pending || 0}，待解释 ${q.pending || 0}`;
}

function useCore() { return { tbm: useApi('/api/tbm/frontend-summary?deviceId=DZ1360', 10000), health: useApi('/api/file-health', 15000), summary: useApi('/api/monitoring/summary', 15000), };
} function ErrorBox({ error }: { error?: string }) { if (!error) return null; return <div className="v4-error">接口暂不可用：{error}</div>;
} function Shell({ active, children }: { active: string; children: React.ReactNode }) { const nav = [ ['/', '指挥总览', '地图/当前环'], ['/project-docs', '项目书', '工程依据'], ['/risk-replay', '风险复盘', '穿越窗口'], ['/monitoring-alerts', '监测异常', '阈值趋势'], ['/operation-diagnosis', '参数诊断', '组合异常'], ['/slurry-grouting', '泥水注浆', '沉降归因'], ['/segment-quality', '管片盾尾', '拼装缺陷'], ['/events', '事件闭环', '报警处置'], ['/data-import', '数据接入', '接口/映射'], ['/system-status', '系统状态', '数据质量'], ['/evidence', '证据链', '来源追溯'], ]; return ( <div className="v4-app"> <aside className="v4-side"> <div className="v4-brand"> <span>SHIELD TUNNEL ANALYTICS</span> <b>盾构施工监控研判平台</b> </div> <nav> {nav.map(([href, title, sub]) => ( <a key={href} href={href} className={active === href ? 'active' : ''}> <b>{title}</b><span>{sub}</span> </a> ))} </nav> </aside> <main className="v4-main">{children}</main> </div> );
} function Hero({ tag, title, desc, value, valueLabel }: { tag: string; title: string; desc: string; value?: any; valueLabel?: string }) { return ( <header className="v4-hero"> <div> <span>{tag}</span> <h1>{title}</h1> <p>{desc}</p> </div> {value !== undefined && ( <div className="v4-hero-value"> <span>{valueLabel || '当前值'}</span> <b>{value}</b> </div> )} </header> );
} function Stat({ title, value, note, tone = '' }: { title: string; value: any; note?: string; tone?: string }) { return <article className={`v4-stat ${tone}`}><span>{title}</span><b>{value ?? '--'}</b>{note && <p>{note}</p>}</article>;
} function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) { return <section className="v4-section"><div className="v4-section-head"><h2>{title}</h2>{desc && <p>{desc}</p>}</div>{children}</section>;
} function BarChart({ title, data, rotate = false }: { title: string; data: { name: string; value: number }[]; rotate?: boolean }) { const max = Math.max(1, ...data.map((d) => d.value)); return ( <article className="v4-card"> <h3>{title}</h3> <div className="v4-bars"> {data.length ? data.slice(0, 12).map((d) => ( <div className="v4-bar-row" key={d.name}> <span className={rotate ? 'rotate' : ''} title={d.name}>{d.name}</span> <div className="v4-bar"><i style={{ width: `${Math.max(3, (d.value / max) * 100)}%` }} /></div> <b>{d.value}</b> </div> )) : <p className="v4-muted">暂无数据</p>} </div> </article> );
} function PieLike({ title, data }: { title: string; data: { name: string; value: number }[] }) { const total = data.reduce((s, d) => s + d.value, 0) || 1; return ( <article className="v4-card"> <h3>{title}</h3> <div className="v4-pie-list"> {data.length ? data.slice(0, 8).map((d) => ( <div className="v4-pie-row" key={d.name}> <span>{d.name}</span> <div className="v4-pie-meter"><i style={{ width: `${Math.max(3, d.value / total * 100)}%` }} /></div> <b>{d.value}</b> </div> )) : <p className="v4-muted">暂无数据</p>} </div> </article> );
} function LineChart({ title, labels, values }: { title: string; labels: string[]; values: number[] }) { const w = 860, h = 250, pad = 34; const max = Math.max(1, ...values.map(Math.abs)); const pts = values.map((v, i) => { const x = pad + i * (w - pad * 2) / Math.max(1, values.length - 1); const y = h / 2 - (v / max) * (h / 2 - pad); return [x, y]; }); const line = pts.map((p) => p.join(',')).join(' '); return ( <article className="v4-card wide"> <h3>{title}</h3> {values.length ? ( <svg viewBox={`0 0 ${w} ${h}`} className="v4-line"> <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke="rgba(220,245,255,.22)" /> <polyline points={line} fill="none" stroke="#65efbb" strokeWidth="3" /> {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="#ffd76b"><title>{labels[i]}：{values[i]}</title></circle>)} {pts.filter((_, i) => i % Math.max(1, Math.ceil(pts.length / 7)) === 0).map(([x], i) => <text key={i} x={x - 24} y={h - 8} fill="#9fc7da" fontSize="11">{labels[i]?.slice(-5)}</text>)} </svg> ) : <p className="v4-muted">暂无趋势数据</p>} </article> );
} function rankTopItems(rows: AnyObj[] | undefined, nameKey: string, countKey = 'count', limit = 3) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({ name: String(r[nameKey] || '待归类'), value: asNum(r[countKey]) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function ConclusionPanel({ title, subtitle, items, tone = 'normal' }: { title: string; subtitle?: string; items: string[]; tone?: 'normal' | 'warn' | 'ok' }) {
  return (
    <section className={`v411-conclusion ${tone}`}>
      <div>
        <span>研判结论</span>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <ul>
        {items.filter(Boolean).slice(0, 5).map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </section>
  );
}

function ActionChecklist({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="v411-actions">
      <h3>{title}</h3>
      <div>
        {items.filter(Boolean).map((x, i) => (
          <article key={i}>
            <b>{String(i + 1).padStart(2, '0')}</b>
            <span>{x}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function RiskMileageWindow({ risks, currentMileageM }: { risks: AnyObj[]; currentMileageM: number }) {
  const valid = (Array.isArray(risks) ? risks : [])
    .filter((r) => Number.isFinite(Number(r.startMileageM)) && Number.isFinite(Number(r.endMileageM)))
    .slice()
    .sort((a, b) => Number(a.startMileageM) - Number(b.startMileageM));

  const minM = valid.length ? Math.min(...valid.map((r) => Number(r.startMileageM)), currentMileageM) : currentMileageM - 100;
  const maxM = valid.length ? Math.max(...valid.map((r) => Number(r.endMileageM)), currentMileageM) : currentMileageM + 100;
  const span = Math.max(1, maxM - minM);

  return (
    <section className="v411-window">
      <div className="v411-window-head">
        <h3>风险源里程窗口</h3>
        <p>竖线为实时推算位置，横条为风险源影响里程范围。</p>
      </div>
      <div className="v411-window-body">
        <div className="v411-current-line" style={{ left: `${Math.max(0, Math.min(100, ((currentMileageM - minM) / span) * 100))}%` }}>
          <span>{formatDkMileage(currentMileageM)}</span>
        </div>
        {valid.length ? valid.slice(0, 10).map((r, i) => {
          const left = ((Number(r.startMileageM) - minM) / span) * 100;
          const width = Math.max(2, ((Number(r.endMileageM) - Number(r.startMileageM)) / span) * 100);
          const near = currentMileageM >= Number(r.startMileageM) - 100 && currentMileageM <= Number(r.endMileageM) + 100;
          return (
            <div className={`v411-risk-row ${near ? 'near' : ''}`} key={r.riskSourceId || i}>
              <span className="name">{r.riskName || '--'}</span>
              <div className="track">
                <i style={{ left: `${Math.max(0, Math.min(100, left))}%`, width: `${Math.min(100, width)}%` }} />
              </div>
              <span className="range">{r.startMileage || '--'} - {r.endMileage || '--'}</span>
            </div>
          );
        }) : (
          <div className="v4-empty"><b>暂无风险源里程窗口</b><p>风险源台账中缺少可用于绘制的起止里程。</p></div>
        )}
      </div>
    </section>
  );
}

function MiniTimeline({ events }: { events: AnyObj[] }) {
  const items = (Array.isArray(events) ? events : []).slice(0, 6);
  return (
    <section className="v411-timeline">
      <h3>处置事件时间线</h3>
      {items.length ? items.map((e, i) => (
        <article key={e.eventId || i}>
          <time>{fmtDate(e.eventTime)}</time>
          <b>{cnEventType(e.eventType)}</b>
          <span>{cnSeverity(e.severity)} · {e.riskName || '现场事件'}</span>
          <p>{e.handlingAction || e.closureResult || e.description || '按现场处置记录复核'}</p>
        </article>
      )) : <p className="v411-muted">暂无事件记录。</p>}
    </section>
  );
}

function HomePage() {
  const { tbm, health, summary } = useCore();
  const risks = useApi('/api/risk-sources', 30000);
  const events = useApi('/api/events?limit=8', 30000);
  const currentRing = tbm.data?.currentRing?.displayValue || REPORT_POSITION.fallbackRing;
  const livePos = calcMileageByRing(currentRing);
  const q = tbm.data?.decodeQuality || {};
  const tables = health.data?.tables || {};
  const total = summary.data?.total || {};
  const concern = summaryConcern(total);
  const review = summaryReview(total);
  const riskItems = risks.data?.items || [];
  const eventItems = events.data?.items || [];
  const levelData = countPairs(summary.data?.levelCount, 'alertLevel');
  const itemData = countPairs(summary.data?.itemCount, 'monitoringItem', 'count', false);
  const topItems = rankTopItems(summary.data?.itemCount, 'monitoringItem', 'count', 3).map((x) => `${cnItemName(x.name)} ${x.value} 条`);
  const confirmedFields = (q.confirmed || 0) + (q.scale_checked || 0);

  return (
    <Shell active="/">
      <Hero
        tag="指挥总览"
        title="现场施工状态与监测响应总览"
        desc="实时位置按已抽取标定规则换算，并联动风险源、监测异常和处置事件形成研判看板。"
        value={livePos.mileage}
        valueLabel="实时推算位置"
      />
      <ErrorBox error={tbm.error || health.error || summary.error || risks.error || events.error} />

      <ConclusionPanel
        tone="warn"
        title={`实时推算位置 ${livePos.mileage}，需关注监测读数 ${concern} 条`}
        subtitle={`现场环号 ${Math.round(livePos.ring)}，换算依据：${ringFormulaText(livePos.ring)}。`}
        items={[
          `风险源台账已接入 ${riskItems.length || 0} 个对象，当前页面按里程窗口展示风险分布。`,
          `历史监测读数 ${tables.monitoring_reading || total.totalReadingCount || 0} 条，其中预警/报警 ${total.abnormalCount || 0} 条，待复核 ${review} 条。`,
          topItems.length ? `主要异常项目：${topItems.join('、')}。` : '主要异常项目待从监测汇总中补充。',
          `实时采集字段可直接展示 ${confirmedFields} 项，关键施工参数已进入大屏。`,
        ]}
      />

      <div className="v4-grid four">
        <Stat title="实时推算位置" value={livePos.mileage} note={`currentRing=${Math.round(livePos.ring)}，按 ${REPORT_POSITION.ringWidthM}m/环换算`} tone="ok" />
        <Stat title="现场采集设备" value={REPORT_POSITION.deviceId} note={`字段可信度 ${confirmedFields} 项`} />
        <Stat title="风险源台账" value={riskItems.length || 0} note="按 DK 里程窗口组织" />
        <Stat title="监测异常" value={concern || '--'} note={`预警/报警 ${total.abnormalCount || 0}，待复核 ${review}`} tone="warn" />
      </div>

      <RiskMileageWindow risks={riskItems} currentMileageM={livePos.mileageM} />

      <div className="v4-chart-grid">
        <PieLike title="监测状态分布" data={levelData} />
        <BarChart title="监测项目分布" data={itemData.slice(0, 8)} rotate />
      </div>

      <div className="v411-two-col">
        <ActionChecklist
          title="建议处置动作"
          items={[
            '优先复核报警测点的最新累计变化和日报来源证据。',
            '联动查看实时推进速度、仓压、盾尾间隙和注浆量是否同步波动。',
            '对风险源窗口内的重点测点提高监测频率，并记录处置闭环。',
          ]}
        />
        <MiniTimeline events={eventItems} />
      </div>
    </Shell>
  );
}





 function MonitoringPage() {
  const summary = useApi('/api/monitoring/summary', 15000);
  const alerts = useApi('/api/monitoring/alerts?pageSize=160');
  const total = summary.data?.total || {};
  const top = Array.isArray(summary.data?.topAlarmPoints) ? summary.data.topAlarmPoints : [];
  const alertItems = Array.isArray(alerts.data?.items) ? alerts.data.items : [];
  const urlPoint = new URLSearchParams(window.location.search).get('pointCode');

  const topRows = top.map((it: AnyObj) => ({
    pointCode: it.pointCode,
    monitoringItem: it.monitoringItem,
    abnormalCount: it.abnormalCount,
    latestDate: it.latestDate,
    latestValue: it.latestCumulativeChange ?? it.latestCurrentValue ?? it.latestChangeRate,
    alertLevel: it.latestAlertLevel,
    sourceId: it.sourceId,
  }));

  const alertRows = alertItems.map((it: AnyObj) => ({
    pointCode: it.pointCode || it.point_code || it.pointName || it.point_name || it.pointId,
    monitoringItem: it.monitoringItem || it.monitoring_item || it.item || it.project || it.monitoringObject,
    abnormalCount: it.abnormalCount || it.count || 1,
    latestDate: it.latestDate || it.measuredAt || it.measured_at || it.time || it.date,
    latestValue: it.latestCumulativeChange ?? it.cumulativeChange ?? it.cumulative_change ?? it.currentValue ?? it.current_value ?? it.changeRate ?? it.change_rate,
    alertLevel: it.latestAlertLevel || it.alertLevel || it.alert_level || it.status,
    sourceId: it.sourceId || it.source_id,
  }));

  const rows = (topRows.length ? topRows : alertRows)
    .filter((x: AnyObj) => x.pointCode || x.monitoringItem || x.latestValue !== undefined)
    .slice(0, 36);

  const candidatePoints: string[] = Array.from(
    new Set<string>(
      rows.map((x: AnyObj) => String(x.pointCode || '').trim()).filter((x: string) => Boolean(x))
    )
  ).slice(0, 24);

  const defaultPoint: string =
    String(urlPoint || '') ||
    candidatePoints.find((x: string) => x.toUpperCase() === 'DB608-07') ||
    candidatePoints[0] ||
    'DB608-07';

  const [selectedPoint, setSelectedPoint] = useState<string>(defaultPoint);

  useEffect(() => {
    if (defaultPoint && !candidatePoints.includes(selectedPoint)) setSelectedPoint(defaultPoint);
  }, [defaultPoint]);

  const trend = useApi(`/api/monitoring/point-trend?pointCode=${encodeURIComponent(String(selectedPoint || defaultPoint))}&limit=300`);
  const levelData = countPairs(summary.data?.levelCount, 'alertLevel');
  const itemData = countPairs(summary.data?.itemCount, 'monitoringItem', 'count', false);
  const dateData = countPairs(summary.data?.dateCount, 'date', 'count', false);
  const trendItems = Array.isArray(trend.data?.items) ? trend.data.items : [];
  const activeRow = rows.find((x: AnyObj) => String(x.pointCode || '') === String(selectedPoint));
  const alarmCount = asNum((summary.data?.levelCount || []).find((x: AnyObj) => String(x.alertLevel).toLowerCase() === 'alarm')?.count);
  const warningCount = asNum((summary.data?.levelCount || []).find((x: AnyObj) => String(x.alertLevel).toLowerCase() === 'warning')?.count);
  const topItems = rankTopItems(summary.data?.itemCount, 'monitoringItem', 'count', 3).map((x) => `${cnItemName(x.name)} ${x.value} 条`);

  return (
    <Shell active="/monitoring-alerts">
      <Hero
        tag="监测异常分析"
        title="监测状态统计、日期趋势、单测点曲线"
        desc="按预警、报警和待复核状态组织监测结果，支持从重点测点中切换单点趋势。"
        value={summaryConcern(total) || '--'}
        valueLabel="需关注读数"
      />
      <ErrorBox error={summary.error || alerts.error || trend.error} />

      <ConclusionPanel
        tone="warn"
        title={`需关注读数 ${summaryConcern(total) || 0} 条，报警 ${alarmCount} 条`}
        subtitle={`当前选中测点 ${selectedPoint || defaultPoint}，趋势记录 ${trend.data?.count || trendItems.length || 0} 条。`}
        items={[
          `预警 ${warningCount} 条、报警 ${alarmCount} 条、待复核 ${summaryReview(total)} 条。`,
          topItems.length ? `主要异常项目：${topItems.join('、')}。` : '主要异常项目待补充。',
          rows[0]?.pointCode ? `最新重点测点：${rows[0].pointCode}，状态 ${cnStatus(rows[0].alertLevel)}，最新变化 ${rows[0].latestValue ?? '--'}。` : '',
          '建议对报警测点先做来源证据复核，再联动施工参数判断是否存在同步扰动。',
        ]}
      />

      <div className="v4-grid four">
        <Stat title="总读数" value={total.totalReadingCount || '--'} note="历史监测读数" />
        <Stat title="需关注读数" value={summaryConcern(total) || '--'} note={`预警/报警 ${total.abnormalCount || 0} 条，待复核 ${summaryReview(total)} 条`} tone="warn" />
        <Stat title="涉及测点" value={total.pointCount || '--'} note="监测点正式库" />
        <Stat title="当前趋势测点" value={selectedPoint || defaultPoint} note={`${trend.data?.count || trendItems.length || 0} 条记录`} />
      </div>

      <Section title="趋势测点选择" desc="点击下方测点即可切换单点累计变化曲线；也可以通过 URL 参数 pointCode 指定测点。">
        <div className="v4-point-selector">
          {candidatePoints.map((pc) => {
            const row = rows.find((x: AnyObj) => String(x.pointCode || '') === pc) || {};
            const active = String(pc) === String(selectedPoint);
            return (
              <button className={active ? 'active' : ''} key={String(pc)} onClick={() => setSelectedPoint(String(pc))}>
                <b>{String(pc)}</b>
                <span>{cnStatus(row.alertLevel)} · {cnItemName(row.monitoringItem)}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <div className="v4-chart-grid">
        <PieLike title="监测状态分布" data={levelData} />
        <PieLike title="监测项目分布" data={itemData.slice(0, 8)} />
      </div>

      <LineChart title="异常日期趋势" labels={dateData.map((x) => String(x.name).slice(5, 10))} values={dateData.map((x) => x.value)} />
      <LineChart title={`${selectedPoint || defaultPoint} 单点累计变化趋势`} labels={trendItems.map((x: AnyObj) => fmtDate(x.measuredAt).slice(5, 10))} values={trendItems.map((x: AnyObj) => asNum(x.cumulativeChange ?? x.currentValue))} />

      <Section title="当前选中测点概况" desc="用于说明当前曲线对应的测点、状态、最新变化和来源。">
        <div className="v4-selected-point">
          <article><span>测点</span><b>{selectedPoint || defaultPoint}</b></article>
          <article><span>监测项目</span><b>{cnItemName(activeRow?.monitoringItem || trendItems[0]?.monitoringItem)}</b></article>
          <article><span>当前状态</span><b>{cnStatus(activeRow?.alertLevel || trendItems[trendItems.length - 1]?.alertLevel)}</b></article>
          <article><span>趋势记录</span><b>{trend.data?.count || trendItems.length || 0} 条</b></article>
        </div>
      </Section>

      <Section title="重点异常测点" desc={`当前展示 ${rows.length} 条重点异常记录，点击卡片可切换上方单点曲线。`}>
        {rows.length > 0 ? (
          <div className="v4-monitor-card-grid">
            {rows.map((it: AnyObj, i: number) => {
              const active = String(it.pointCode || '') === String(selectedPoint);
              return (
                <article className={active ? 'v4-monitor-card active' : 'v4-monitor-card'} key={`${it.pointCode || 'point'}-${i}`} onClick={() => it.pointCode && setSelectedPoint(String(it.pointCode))}>
                  <div className="v4-monitor-head"><b>{it.pointCode || '--'}</b><span>{cnStatus(it.alertLevel)}</span></div>
                  <p>{cnItemName(it.monitoringItem)}</p>
                  <div className="v4-monitor-meta">
                    <span>异常次数：{it.abnormalCount || '--'}</span>
                    <span>最新日期：{fmtDate(it.latestDate)}</span>
                    <span>最新变化：{it.latestValue ?? '--'}</span>
                    <span>来源：{shortId(it.sourceId)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="v4-empty"><b>暂无可展示异常测点</b><p>监测汇总接口已返回统计值，但未返回可列表展示的测点明细。</p></div>
        )}
      </Section>
    </Shell>
  );
}







 function TbmPage({ mode }: { mode: 'operation' | 'slurry' | 'segment' | 'system' }) { const tbm = useApi('/api/tbm/frontend-summary?deviceId=DZ1360', 10000); const history = useApi('/api/tbm/history?deviceId=DZ1360&limit=200', 10000); const guidance = useApi('/api/tbm/guidance/latest?deviceId=DZ1360', 15000); const q = tbm.data?.decodeQuality || {}; const hItems = history.data?.items || []; const cfg: Record<string, AnyObj> = { operation: { active: '/operation-diagnosis', tag: '施工参数诊断', title: '推进、仓压、分区压力组合研判', keys: ['advance', 'cutter', 'chamberPressure', 'propelPressure'], trend: 'advanceSpeed', trendName: '推进速度历史趋势' }, slurry: { active: '/slurry-grouting', tag: '泥水注浆分析', title: '进排浆与注浆量当前状态', keys: ['slurry', 'grouting'], trend: 'slurryOutFlow', trendName: '排浆流量历史趋势' }, segment: { active: '/segment-quality', tag: '管片盾尾分析', title: '盾尾间隙与管片位置码复核', keys: ['tailGap', 'segment', 'advance'], trend: 'shieldTailGap1', trendName: '盾尾间隙1#历史趋势' }, system: { active: '/system-status', tag: '系统状态与可信度', title: '接口、历史、导向、数据库状态', keys: ['basic', 'advance', 'chamberPressure', 'tailGap', 'slurry'], trend: 'currentRing', trendName: '采集环号历史序列' }, }; const c = cfg[mode]; const fields = c.keys.flatMap((k: string) => groupFields(tbm.data, k)); const second = mode === 'segment' ? groupFields(tbm.data, 'tailGap') : mode === 'slurry' ? groupFields(tbm.data, 'slurry') : groupFields(tbm.data, 'chamberPressure'); const secondTitle = mode === 'segment' ? '盾尾间隙对比' : mode === 'slurry' ? '泥浆环路当前值' : '开挖仓压力对比'; const propel = groupFields(tbm.data, 'propelPressure'); return ( <Shell active={c.active}> <Hero tag={c.tag} title={c.title} desc={`历史来源：${history.data?.historySource || '等待接口'}。如果显示 latest_only，说明目前只有最新快照，趋势分析需要继续沉淀历史。`} value={tbm.data?.currentRing?.displayValue || '--'} valueLabel="现场环号" /> <ErrorBox error={tbm.error || history.error || guidance.error} /> <div className="v4-grid four"> <Stat title="采集时间" value={fmtDate(tbm.data?.timestamp)} note={fieldStatusText(q)} /> <Stat title="历史点数" value={history.data?.count ?? '--'} note={history.data?.historySource || '待确认'} tone={(history.data?.count || 0) > 1 ? 'ok' : 'warn'} /> <Stat title="导向数据" value={guidance.data?.guidanceAvailable ? '已接入' : '暂未接入'} note={guidance.data?.guidanceStatus || '导向数据状态待确认'} /> <Stat title="当前结论" value={(q.scale_pending || q.pending) ? '可展示，需复核' : '可展示'} note="待校准/待解释字段不下强结论" /> </div> <div className="v4-chart-grid"> <PieLike title="字段可信度分布" data={[{ name: '已确认', value: q.confirmed || 0 }, { name: '已校准换算', value: q.scale_checked || 0 }, { name: '比例待校准', value: q.scale_pending || 0 }, { name: '待解释', value: q.pending || 0 }]} /> <BarChart title={secondTitle} data={second.map((f: AnyObj) => ({ name: f.nameCn || f.fieldKey || f.key, value: numericField(f) }))} rotate /> </div> {hItems.length > 1 && <LineChart title={c.trendName} labels={hItems.slice(-80).map((x: AnyObj) => String(x.currentRing || fmtDate(x.timestamp).slice(11, 16)))} values={hItems.slice(-80).map((x: AnyObj) => asNum(x[c.trend]))} />} {mode === 'operation' && <BarChart title="推进分区压力对比" data={propel.map((f: AnyObj) => ({ name: f.nameCn || f.fieldKey || f.key, value: numericField(f) }))} rotate />} <Section title="字段判读清单" desc="只显示中文字段名、数值、单位和可信状态。"> <div className="v4-field-grid"> {fields.map((f: AnyObj, i: number) => ( <article key={`${f.fieldKey || f.key}-${i}`}> <div><b>{f.nameCn || f.fieldKey || f.key}</b><span>{cnStatus(f.status || f.decodeStatus)}</span></div> <strong>{fieldValue(f)} <small>{f.unit || ''}</small></strong> <p>{f.status === 'pending' ? '字段含义待确认' : f.status === 'scale_pending' ? '比例系数待确认' : '可作为当前展示值'}</p> </article> ))} </div> </Section> </Shell> );
} function ProjectDocsPage() {
  const health = useApi('/api/file-health', 15000);
  const docs = useApi('/api/documents?pageSize=16');
  const risks = useApi('/api/risk-sources', 30000);
  const events = useApi('/api/events?limit=6', 30000);

  const t = health.data?.tables || {};
  const riskItems = risks.data?.items || [];
  const docItems = docs.data?.items || [];
  const docTypeData = countBy(docItems, (d: AnyObj) => cnDocType(d.fileType));
  const riskTypeData = countBy(riskItems, (r: AnyObj) => cnRiskType(r.riskType));

  return (
    <Shell active="/project-docs">
      <Hero
        tag="项目书 / 工程依据"
        title="苏州东隧道施工监测研判依据"
        desc="已梳理工程区段、风险源台账、监测资料与环号-里程标定点，实时位置采用 1152环 / DK55+998 + 2.0m/环换算。"
        value={REPORT_POSITION.ruleName}
        valueLabel="采用换算规则"
      />
      <ErrorBox error={health.error || docs.error || risks.error || events.error} />

      <div className="v4-grid four">
        <Stat title="工程区段识别" value={REPORT_POSITION.sectionCount} note="已从项目资料梳理" tone="ok" />
        <Stat title="环号-里程标定点" value={REPORT_POSITION.anchorCount} note="直接同现证据" tone="ok" />
        <Stat title="采用标定点" value={`${REPORT_POSITION.anchorRing}环`} note={REPORT_POSITION.anchorMileage} />
        <Stat title="监测资料" value={t.source_document || docItems.length || 0} note={`监测点 ${t.monitoring_point || 0} 个，读数 ${t.monitoring_reading || 0} 条`} />
      </div>

      <Section title="工程依据概览" desc="根据工程范围、风险源、监测资料和处置记录，梳理当前施工风险研判依据。">
        <div className="v4-decision-grid">
          <article><b>工程区段</b><p>已识别 {REPORT_POSITION.sectionCount} 个区段，覆盖 I 标正线、苏州东隧道总体、盾构设计段及多个穿越段。</p></article>
          <article><b>标定点</b><p>已提取 {REPORT_POSITION.anchorCount} 个环号-里程同现证据，采用 {REPORT_POSITION.anchorRing}环 / {REPORT_POSITION.anchorMileage} 作为换算锚点。</p></article>
          <article><b>换算规则</b><p>实时 currentRing 按 2.0m/环线性换算为 DK 里程，页面同步展示换算依据。</p></article>
        </div>
      </Section>

      <div className="v4-chart-grid">
        <PieLike title="资料类型分布" data={docTypeData} />
        <PieLike title="风险源类型分布" data={riskTypeData} />
      </div>

      <Section title="重点风险源清单" desc="列出区间内需要重点关注的风险源、影响里程和关联测点。">
        <div className="v4-risk-grid">
          {riskItems.slice(0, 8).map((r: AnyObj, i: number) => (
            <article className="v4-risk-card" key={r.riskSourceId || i}>
              <div className="v4-risk-head"><b>{r.riskName || '--'}</b><span>{cnRiskLevel(r.riskLevel || r.protectionLevel)}</span></div>
              <p>{riskFocusText(r)}</p>
              <small>{riskWindowText(r)}</small>
            </article>
          ))}
        </div>
      </Section>

      <Section title="已接入资料样本" desc="列出已接入的监测日报、周报、现场图片等资料。">
        <div className="v4-docs">
          {docItems.slice(0, 8).map((d: AnyObj) => (
            <article key={d.sourceId}>
              <span>{cnDocType(d.fileType)} · {d.documentDate || '--'}</span>
              <b>{cleanFileName(d.fileName)}</b>
              <p>{String(d.description || '工程资料').replace(/daily_report/g, '监测日报').replace(/image/g, '现场图片')}</p>
            </article>
          ))}
        </div>
      </Section>
    </Shell>
  );
}



 function RiskReplayPage() {
  const tbm = useApi('/api/tbm/frontend-summary?deviceId=DZ1360', 10000);
  const risks = useApi('/api/risk-sources', 30000);
  const events = useApi('/api/events?limit=20', 30000);

  const currentRing = tbm.data?.currentRing?.displayValue || REPORT_POSITION.fallbackRing;
  const livePos = calcMileageByRing(currentRing);
  const riskItems = risks.data?.items || [];
  const eventItems = events.data?.items || [];
  const typeData = countBy(riskItems, (r: AnyObj) => cnRiskType(r.riskType));
  const levelData = countBy(riskItems, (r: AnyObj) => cnRiskLevel(r.riskLevel || r.protectionLevel));
  const nearRisks = riskItems.filter((r: AnyObj) => Number.isFinite(Number(r.startMileageM)) && Number.isFinite(Number(r.endMileageM)) && livePos.mileageM >= Number(r.startMileageM) - 150 && livePos.mileageM <= Number(r.endMileageM) + 150);

  return (
    <Shell active="/risk-replay">
      <Hero
        tag="风险源穿越复盘"
        title="实时位置与风险源窗口复盘"
        desc="实时环号按 1152环 / DK55+998 和 2.0m/环换算为 DK 里程，并与风险源台账、监测响应和处置记录联动展示。"
        value={livePos.mileage}
        valueLabel="实时推算位置"
      />
      <ErrorBox error={tbm.error || risks.error || events.error} />

      <ConclusionPanel
        tone={nearRisks.length ? 'warn' : 'normal'}
        title={`实时推算位置 ${livePos.mileage}，风险源台账 ${riskItems.length || 0} 个`}
        subtitle={`换算依据：${ringFormulaText(livePos.ring)}。`}
        items={[
          nearRisks.length ? `当前位置附近 ${nearRisks.length} 个风险源窗口需要关注：${nearRisks.map((r: AnyObj) => r.riskName).filter(Boolean).slice(0, 3).join('、')}。` : '当前推算位置未命中已接入风险源窗口，继续关注前方风险源里程。',
          `已接入事件记录 ${eventItems.length || 0} 条，可用于展示处置闭环样本。`,
          '建议联动监测异常页查看报警测点，并结合施工参数判断扰动原因。',
        ]}
      />

      <div className="v4-grid four">
        <Stat title="实时推算位置" value={livePos.mileage} note={`currentRing=${Math.round(livePos.ring)}`} tone="ok" />
        <Stat title="换算标定点" value={`${REPORT_POSITION.anchorRing}环`} note={REPORT_POSITION.anchorMileage} tone="ok" />
        <Stat title="环号差值" value={`${Math.round(livePos.deltaRing)}环`} note={`折算距离 ${Math.round(livePos.deltaMileage)}m`} />
        <Stat title="风险源台账" value={riskItems.length || 0} note="当前已接入风险对象" />
      </div>

      <RiskMileageWindow risks={riskItems} currentMileageM={livePos.mileageM} />

      <div className="v4-chart-grid">
        <PieLike title="风险源类型分布" data={typeData} />
        <PieLike title="风险等级分布" data={levelData} />
      </div>

      <div className="v411-two-col">
        <ActionChecklist
          title="风险复盘动作"
          items={[
            '先看当前位置是否进入风险源影响里程窗口。',
            '再看窗口内监测点的报警、预警和单点趋势。',
            '最后复核对应事件处置记录，形成闭环说明。',
          ]}
        />
        <MiniTimeline events={eventItems} />
      </div>

      <Section title="风险源窗口总览" desc="按风险源台账展示影响里程、风险等级和关联测点。">
        <div className="v4-risk-grid">
          {riskItems.map((r: AnyObj, i: number) => (
            <article className="v4-risk-card" key={r.riskSourceId || i}>
              <div className="v4-risk-head"><b>{r.riskName || '--'}</b><span>{cnRiskLevel(r.riskLevel || r.protectionLevel)}</span></div>
              <p>{cnRiskType(r.riskType)} · 关联测点 {r.monitoringPointCount ?? r.relatedPointCount ?? 0} 个</p>
              <small>{riskWindowText(r)}</small>
            </article>
          ))}
        </div>
      </Section>
    </Shell>
  );
}





 function DataImportPage() { const health = useApi('/api/file-health', 10000); const t = health.data?.tables || {}; const data = [ { name: '源文件', value: t.source_document || 0 }, { name: '监测点', value: t.monitoring_point || 0 }, { name: '监测读数', value: t.monitoring_reading || 0 }, { name: '证据链', value: t.extraction_evidence || 0 }, { name: '日报临时表', value: t.stg_file_daily_report_meta || 0 }, { name: '全文页临时表', value: t.stg_file_extracted_page || 0 }, ]; return ( <Shell active="/data-import"> <Hero tag="数据接入" title="已入库、可展示、待补强的数据边界" desc="这页是可信度说明页，不做假分析。" value={t.monitoring_reading || '--'} valueLabel="监测读数" /> <ErrorBox error={health.error} /> <div className="v4-grid four"> <Stat title="源文件" value={t.source_document || 0} note="日报、图片、方案等" /> <Stat title="监测点" value={t.monitoring_point || 0} note="结构化测点库" /> <Stat title="监测读数" value={t.monitoring_reading || 0} note="可支撑异常分析" /> <Stat title="证据链" value={t.extraction_evidence || 0} note="来源追溯记录" /> </div> <BarChart title="入库数据规模" data={data} rotate /> <Section title="接入结论"> <div className="v4-decision-grid"> <article><b>已可使用</b><p>监测异常、单点趋势、风险源清单、事件样本、TBM 历史接口已经由 暴露。</p></article> <article><b>待补强</b><p>全文页、页码行号、真实导向数据、现场环号映射仍需补充。</p></article> <article><b>冒充</b><p>现场环号未匹配工程里程前，声称正在穿越某风险源。</p></article> </div> </Section> </Shell> );
} function EvidencePage() { const docs = useApi('/api/documents?pageSize=12'); const alerts = useApi('/api/monitoring/alerts?pageSize=40'); const health = useApi('/api/file-health'); const first = (alerts.data?.items || []).find((x: AnyObj) => x.readingId)?.readingId; const detail = useApi(first ? `/api/evidence/by-reading?readingId=${first}` : '/api/evidence/by-reading?readingId=00000000-0000-0000-0000-000000000000'); const docItems = docs.data?.items || []; const alertItems = alerts.data?.items || []; const t = health.data?.tables || {}; return ( <Shell active="/evidence"> <Hero tag="证据链" title="异常读数到来源文件的追溯" desc="如果证据详情只能到 source_only，页面会明确标注，不伪造页码行号。" value={t.extraction_evidence || 0} valueLabel="证据记录" /> <ErrorBox error={docs.error || alerts.error || detail.error} /> <div className="v4-grid four"> <Stat title="证据层级" value={detail.data?.evidenceLevel === 'row' ? '行级证据' : '来源级证据'} note={detail.data?.items?.length ? `${detail.data.items.length} 条详情` : '页码/行号待补'} tone={detail.data?.evidenceLevel === 'row' ? 'ok' : 'warn'} /> <Stat title="源文件" value={t.source_document || 0} note="source_document" /> <Stat title="异常入口" value={alertItems.length} note="当前抽样" /> <Stat title="详情读数" value={first ? shortId(first) : '--'} note="抽样第一条异常" /> </div> <div className="v4-chart-grid"> <PieLike title="源文件类型分布" data={countBy(docItems, (d) => cnDocType(d.fileType))} /> <PieLike title="异常状态分布" data={countBy(alertItems, (x) => cnStatus(x.alertLevel))} /> </div> <Section title="异常读数追溯入口"> <div className="v4-table five"> <div className="v4-tr head"><span>测点</span><span>项目</span><span>时间</span><span>状态</span><span>来源短号</span></div> {alertItems.slice(0, 20).map((it: AnyObj, i: number) => ( <div className="v4-tr" key={it.readingId || i}><span>{it.pointCode || '--'}</span><span>{it.monitoringItem || '--'}</span><span>{fmtDate(it.measuredAt)}</span><span className="level">{cnStatus(it.alertLevel)}</span><span>{shortId(it.sourceId)}</span></div> ))} </div> </Section> <Section title="最新源文件"> <div className="v4-docs"> {docItems.slice(0, 10).map((d: AnyObj) => ( <article key={d.sourceId}><span>{cnDocType(d.fileType)} · {d.documentDate || '--'}</span><b>{cleanFileName(d.fileName)}</b><p>{String(d.description || '暂无描述').replace(/daily_report/g, '监测日报').replace(/image/g, '现场图片')}</p></article> ))} </div> </Section> </Shell> );
} function PlaceholderPage({ active, tag, title, desc }: { active: string; tag: string; title: string; desc: string }) { return ( <Shell active={active}> <Hero tag={tag} title={title} desc={desc} /> <Section title="当前处理原则"> <div className="v4-decision-grid"> <article><b>真实数据优先</b><p>所有页面只读 业务。</p></article> <article><b>缺口明确标注</b><p>没有数据不伪造结论。</p></article> <article><b>后续逐页增强</b><p>等项目书、导向、映射等数据补齐后继续接入。</p></article> </div> </Section> </Shell> );
} export default function V4App() { const path = normalizePath(window.location.pathname); useEffect(() => { if (window.location.search && path !== '/') { window.history.replaceState({}, '', path); } }, [path]); if (path === '/') return <HomePage />; if (path === '/monitoring-alerts') return <MonitoringPage />; if (path === '/operation-diagnosis') return <TbmPage mode="operation" />; if (path === '/slurry-grouting') return <TbmPage mode="slurry" />; if (path === '/segment-quality') return <TbmPage mode="segment" />; if (path === '/system-status') return <TbmPage mode="system" />; if (path === '/risk-replay') return <RiskReplayPage />; if (path === '/data-import') return <DataImportPage />; if (path === '/evidence') return <EvidencePage />; if (path === '/events') return <RiskReplayPage />; if (path === '/project-docs' || path === '/project-book') return <ProjectDocsPage />; return <HomePage />;
}
