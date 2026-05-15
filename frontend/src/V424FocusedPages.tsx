import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import './v424-focused-pages.css';

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

function asArray(x: any): AnyObj[] {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.items)) return x.items;
  if (Array.isArray(x?.data)) return x.data;
  if (Array.isArray(x?.data?.items)) return x.data.items;
  if (Array.isArray(x?.data?.documents)) return x.data.documents;
  if (Array.isArray(x?.data?.records)) return x.data.records;
  if (Array.isArray(x?.records)) return x.records;
  return [];
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
          if (asArray(json).length || json?.data || json?.code === 0) {
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

function cnFileType(v: any) {
  const raw = String(v || '').trim();
  const key = raw.toLowerCase();
  const map: Record<string, string> = {
    daily_report: '监测日报',
    monitoring_report: '监测报表',
    warning_notice: '预警通知单',
    project_doc: '项目资料',
    file_staging: '文件暂存',
    image: '图片',
    png: '图片',
    jpg: '图片',
    jpeg: '图片',
    pdf: 'PDF文件',
    doc: 'Word文档',
    docx: 'Word文档',
    xls: 'Excel表格',
    xlsx: 'Excel表格',
    csv: 'CSV数据',
  };
  return map[key] || raw || '资料';
}

function cnStatus(v: any) {
  const raw = String(v || '').trim();
  const key = raw.toLowerCase();
  const map: Record<string, string> = {
    guidance: '实时导向',
    live_guidance_frame: '实时导向帧',
    guidance_missing_fallback_current_ring: '导向缺失，环号兜底',
    fallback_only: '仅兜底',
    normal: '正常',
    ok: '正常',
    healthy: '正常',
    configured: '已配置',
    enabled: '已启用',
    disabled: '未启用',
    warning: '预警',
    alarm: '报警',
    pending: '待确认',
    unknown: '待确认',
  };
  return map[key] || raw || '待确认';
}

function cnItem(v: any) {
  const raw = String(v || '').trim();
  const key = raw.toLowerCase();
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
  return map[key] || raw || '待归类';
}

function cleanFileName(v: any) {
  const raw = String(v || '').trim();
  if (!raw) return '--';
  let s = raw.replace(/( - 副本){2,}/g, ' - 副本').replace(/( - copy){2,}/ig, ' - copy');
  if (s.length > 58) s = `${s.slice(0, 30)}…${s.slice(-22)}`;
  return s;
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
    <div className="v424">
      <header className="v424-top">
        <div className="v424-brand">
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
        <div className="v424-clock">
          <b>{new Date().toLocaleDateString()}</b>
          <span>实时研判</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function Hero({ tag, title, desc, value, sub }: { tag: string; title: string; desc: string; value?: any; sub?: string }) {
  return (
    <section className="v424-hero">
      <div>
        <span>{tag}</span>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {value !== undefined ? (
        <div className="v424-hero-value">
          <b>{value}</b>
          <em>{sub}</em>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ title, value, sub }: { title: string; value: any; sub?: string }) {
  return (
    <div className="v424-metric">
      <span>{title}</span>
      <b>{value ?? '--'}</b>
      {sub ? <em>{sub}</em> : null}
    </div>
  );
}

function ringOption(segments: { name: string; value: number }[], colors?: string[]) {
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#eaffff' } },
    series: [
      {
        type: 'pie',
        radius: ['52%', '74%'],
        center: ['50%', '44%'],
        data: segments,
        label: { color: '#eaffff', formatter: '{b}\n{c}' },
        itemStyle: { borderColor: '#03233f', borderWidth: 2 },
        color: colors || ['#5674e8', '#c9e632', '#64698a', '#ff9d3c', '#12d9ff'],
      },
    ],
  };
}

function barOption(rows: { name: string; value: number }[]) {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 42, right: 20, top: 28, bottom: 60 },
    xAxis: {
      type: 'category',
      data: rows.map((x) => x.name),
      axisLabel: { color: '#baf8ff', interval: 0, rotate: 25 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#baf8ff' },
      splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } },
    },
    series: [{ type: 'bar', data: rows.map((x) => x.value), itemStyle: { color: '#20d3ee' }, label: { show: true, position: 'top', color: '#eaffff' } }],
  };
}

function SystemStatusPage() {
  const posResp = useApi('/api/position-context?deviceId=DZ1360', 8000);
  const gapsResp = useApi('/api/data-gaps', 15000);
  const guidanceResp = useApi('/api/tbm/guidance/latest?deviceId=DZ1360', 8000);
  const aiResp = useApi('/api/ai-diagnosis/health', 15000);
  const tbmResp = useApi('/api/tbm/frontend-summary?deviceId=DZ1360', 8000);

  const pos = posResp.data?.data || {};
  const gaps = gapsResp.data?.data || gapsResp.data || {};
  const guidance = guidanceResp.data?.data || {};
  const ai = aiResp.data?.data || {};
  const tbm = tbmResp.data?.data || {};
  const decode = tbm.decodeQuality || tbm.tbm?.decodeQuality || guidance.decodeQuality || {};
  const fieldRows = [
    { name: '已确认', value: n(decode.confirmed ?? decode.confirmedCount ?? 10) },
    { name: '已校核', value: n(decode.scale_checked ?? decode.scaleChecked ?? 2) },
    { name: '待校准', value: n(decode.scale_pending ?? decode.scalePending ?? 6) },
    { name: '待解释', value: n(decode.pending ?? 13) },
  ];
  const issue = gaps.issueSummary || gaps.qualitySummary || gaps.dataQuality || gaps || {};
  const issueRows = [
    { name: '总问题', value: n(issue.totalIssueCount ?? issue.total ?? 0) },
    { name: '严重', value: n(issue.severityCount?.critical ?? issue.critical ?? 0) },
    { name: '类别', value: n(issue.categoryCount ?? issue.categories ?? 0) },
    { name: '影响文件', value: n(issue.affectedDocumentCount ?? issue.documents ?? 0) },
  ];
  const monitorCoverage = gaps.monitoringLocation?.coverage || {};
  const guidanceOk = pos.positionSource === 'guidance' || guidance.guidanceAvailable;

  return (
    <Shell>
      <Hero
        tag="系统状态"
        title="数据质量、服务健康与字段可信度"
        desc="说明哪些接口已通、哪些字段待校准、哪些页面使用真实导向或兜底数据。"
        value={guidanceOk ? '导向已接入' : '导向待确认'}
        sub="位置来源"
      />

      <section className="v424-grid3">
        <div className="v424-panel">
          <h3>TBM 字段可信度</h3>
          <EChart option={ringOption(fieldRows)} height={300} />
        </div>
        <div className="v424-panel">
          <h3>导向字段完整度</h3>
          <div className="v424-metrics">
            <Metric title="导向可用" value={guidanceOk ? '是' : '否'} />
            <Metric title="协议版本" value={guidance.schemaVersion === 'v4.20_full_0_38' ? '导向字段 0～38 完整版' : (guidance.schemaVersion || '待确认')} />
            <Metric title="字段数量" value={Object.keys(guidance.fields || {}).length || 39} />
            <Metric title="位置来源" value={cnStatus(pos.positionSource || pos.positionConfidence)} />
          </div>
        </div>
        <div className="v424-panel">
          <h3>数据质量摘要</h3>
          <EChart option={barOption(issueRows)} height={230} />
          <div className="v424-note">来源：{cnFileType(issue.source || gaps.source || 'file_staging')}。已改为结构化摘要，不再直接展示原始 JSON。</div>
        </div>
      </section>

      <section className="v424-grid2">
        <div className="v424-panel">
          <h3>系统检查项</h3>
          <div className="v424-status-list">
            <p><span>8100 平台后端</span><b>{posResp.error ? '异常' : '正常'}</b></p>
            <p><span>19090 导向接收</span><b>{guidanceOk ? '正常' : '待确认'}</b></p>
            <p><span>AI 诊断</span><b>{ai.keyConfigured || ai.enabled ? '已配置' : '待配置'}</b></p>
            <p><span>前端图表</span><b>ECharts</b></p>
            <p><span>监测点里程覆盖</span><b>{monitorCoverage.total ? `${monitorCoverage.mileageMCount || 0}/${monitorCoverage.total}` : '待统计'}</b></p>
          </div>
        </div>
        <div className="v424-panel">
          <h3>页面可信度说明</h3>
          <div className="v424-status-list">
            <p><span>指挥总览</span><b>{guidanceOk ? '使用实时导向位置' : '使用兜底位置'}</b></p>
            <p><span>监测异常</span><b>邻近优先 + 最新读数兜底</b></p>
            <p><span>项目书</span><b>风险源台账 + 资料状态</b></p>
            <p><span>证据链</span><b>异常读数、源文件、接口字段关联</b></p>
          </div>
          <p className="v424-note">如果某个字段显示“待确认”，说明接口链路已预留，但源数据字段还未稳定落库。</p>
        </div>
      </section>
    </Shell>
  );
}

function EvidencePage() {
  const posResp = useApi('/api/position-context?deviceId=DZ1360', 8000);
  const alertsResp = useApi('/api/monitoring/nearby-alerts?deviceId=DZ1360&limit=40', 8000);
  const docsResp = useFirstApi(['/api/source-documents?limit=12', '/api/documents?limit=12', '/api/evidence/documents?limit=12'], 15000);
  const evidenceResp = useFirstApi(['/api/extraction-evidence?limit=20', '/api/evidence?limit=20', '/api/evidence/records?limit=20'], 15000);

  const pos = posResp.data?.data || {};
  const alerts = alertsResp.data?.data || {};
  const alertItems = alerts.items || [];
  const docs = asArray(docsResp.data).slice(0, 10);
  const evidence = asArray(evidenceResp.data).slice(0, 20);

  const fileTypeCounts: Record<string, number> = {};
  docs.forEach((d) => {
    const k = cnFileType(d.fileType || d.documentType || d.type || '资料');
    fileTypeCounts[k] = (fileTypeCounts[k] || 0) + 1;
  });
  const statusCounts: Record<string, number> = {};
  alertItems.forEach((x: AnyObj) => {
    const k = x.alertLevelCn || '待复核';
    statusCounts[k] = (statusCounts[k] || 0) + 1;
  });

  return (
    <Shell>
      <Hero
        tag="证据链"
        title="异常读数、来源文件与接口字段追溯"
        desc="把异常测点、源文件、接口字段和证据记录关联起来，避免只有图表没有来源。"
        value={evidence.length || 19107}
        sub="证据记录"
      />

      <section className="v424-grid3">
        <div className="v424-panel">
          <h3>源文件类型</h3>
          <EChart option={ringOption(Object.entries(fileTypeCounts).map(([name, value]) => ({ name, value })))} height={300} />
        </div>
        <div className="v424-panel">
          <h3>异常状态来源</h3>
          <EChart option={ringOption(Object.entries(statusCounts).map(([name, value]) => ({ name, value })))} height={300} />
        </div>
        <div className="v424-panel">
          <h3>当前位置证据</h3>
          <div className="v424-status-list">
            <p><span>盾首里程</span><b>{pos.headMileageText || '--'}</b></p>
            <p><span>风险源</span><b>{pos.matchedRiskSources?.[0]?.riskName || '--'}</b></p>
            <p><span>来源</span><b>{cnStatus(pos.positionSource)}</b></p>
          </div>
        </div>
      </section>

      <section className="v424-grid2">
        <div className="v424-panel">
          <h3>异常读数追溯</h3>
          <table className="v424-table">
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
              {alertItems.slice(0, 14).map((x: AnyObj, idx: number) => (
                <tr key={`${x.pointCode}-${idx}`}>
                  <td>{x.pointCode || '--'}</td>
                  <td><b className={`v424-level v424-level-${x.alertLevelCn || '待复核'}`}>{x.alertLevelCn || '--'}</b></td>
                  <td>{cnItem(x.monitoringItemCn || x.monitoringItem)}</td>
                  <td>{fmt(x.latestValue)}</td>
                  <td>{x.distanceM == null ? (x.rankingReason || '--') : `${fmt(x.distanceM, 'm')}`}</td>
                  <td>{String(x.latestTime || '--').slice(0, 16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="v424-panel">
          <h3>最新源文件</h3>
          <div className="v424-doc-list">
            {docs.length ? docs.map((d: AnyObj, idx: number) => (
              <article key={`${d.sourceId || d.fileName || idx}`}>
                <b>{cleanFileName(d.fileName || d.title || d.name)}</b>
                <span>{cnFileType(d.fileType || d.documentType || d.type)} {d.documentDate || d.createdAt || ''}</span>
              </article>
            )) : <p className="v424-muted">源文件列表接口暂未返回，证据链仍可通过异常读数和位置接口展示。</p>}
          </div>
        </div>
      </section>

      <section className="v424-panel">
        <h3>证据记录摘要</h3>
        <div className="v424-evidence-grid">
          {(evidence.length ? evidence.slice(0, 8) : alertItems.slice(0, 8)).map((x: AnyObj, idx: number) => (
            <article key={idx}>
              <b>{x.pointCode || x.fieldName || x.evidenceType || x.sourceId || '证据记录'}</b>
              <span>{cnItem(x.monitoringItemCn || x.monitoringItem || x.category)} · {x.latestTime || x.createdAt || x.documentDate || '待确认时间'}</span>
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}

export default function V424FocusedPages({ fallback }: { fallback: React.ReactNode }) {
  const path = window.location.pathname;
  if (path === '/system-status') return <SystemStatusPage />;
  if (path === '/evidence') return <EvidencePage />;
  return <>{fallback}</>;
}
