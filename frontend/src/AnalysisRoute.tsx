import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ReactECharts from 'echarts-for-react';
import './usable-dashboard.css';

type AnyObj = Record<string, any>;


function cleanRoutePath(pathname: string) {
  const raw = pathname || '/';
  const noTrailing = raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
  return noTrailing || '/';
}

function normalizeRoute(pathname: string) {
  const path = cleanRoutePath(pathname);
  const aliases: Record<string, string> = {
    '/slurry': '/slurry-grouting',
    '/slurry-analysis': '/slurry-grouting',
    '/grouting': '/slurry-grouting',
    '/pipe-quality': '/segment-quality',
    '/segment': '/segment-quality',
    '/segment-quality-page': '/segment-quality',
    '/monitoring': '/monitoring-alerts',
    '/alerts': '/monitoring-alerts',
    '/operation': '/operation-diagnosis',
    '/diagnosis': '/operation-diagnosis',
    '/data': '/data-import',
    '/import': '/data-import',
    '/status': '/system-status',
    '/system': '/system-status',
    '/risk': '/risk-replay',
  };
  return aliases[path] || path;
}

const ANALYSIS_ROUTES = new Set([
  '/monitoring-alerts',
  '/operation-diagnosis',
  '/slurry-grouting',
  '/segment-quality',
  '/system-status',
  '/data-import',
  '/evidence',
  '/risk-replay',
]);

async function apiGet(path: string) {
  const host = window.location.hostname || '120.55.70.218';
  const urls = [`http://${host}:8100${path}`, path];
  let last = '';
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        last = `${res.status}`;
        continue;
      }
      const json = await res.json();
      return json?.data ?? json;
    } catch (err: any) {
      last = err?.message || String(err);
    }
  }
  throw new Error(last || '接口暂不可用');
}

function useApi(path: string, intervalMs = 0) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const value = await apiGet(path);
        if (alive) {
          setData(value);
          setError('');
        }
      } catch (err: any) {
        if (alive) setError(err?.message || '接口暂不可用');
      }
    }
    load();
    if (!intervalMs) return () => { alive = false; };
    const timer = window.setInterval(load, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [path, intervalMs]);
  return { data, error };
}

function cnStatus(value: any) {
  const raw = String(value ?? '').trim();
  const lower = raw.toLowerCase();
  if (!raw || lower === 'unknown' || lower === 'null' || raw === '待确认') return '待确认';
  if (lower === 'normal' || raw === '正常') return '正常';
  if (lower === 'warning' || lower === 'warn' || raw === '预警') return '预警';
  if (lower === 'alarm' || raw === '报警') return '报警';
  if (lower === 'exceed_design_limit' || raw === '超设计限值') return '超设计限值';
  if (lower === 'confirmed' || raw === '已确认') return '已确认';
  if (lower === 'scale_checked' || raw === '已校准换算') return '已校准换算';
  if (lower === 'scale_pending' || raw === '比例待校准') return '比例待校准';
  if (lower === 'pending' || raw === '待解释') return '待解释';
  return raw;
}

function docType(value: any) {
  const lower = String(value || '').toLowerCase();
  if (lower === 'daily_report') return '监测日报';
  if (lower === 'weekly_report') return '监测周报';
  if (lower === 'image') return '现场图片';
  if (lower === 'pdf') return 'PDF文件';
  if (lower === 'xlsx' || lower === 'excel') return 'Excel表格';
  if (lower === 'docx' || lower === 'word') return 'Word文档';
  return String(value || '资料文件');
}

function dateText(value: any) {
  if (!value) return '--';
  return String(value).replace('T00:00:00', '').replace('T', ' ');
}

function shortId(value: any) {
  const raw = String(value || '');
  if (!raw) return '--';
  return raw.length > 12 ? `${raw.slice(0, 8)}...${raw.slice(-4)}` : raw;
}

function cleanFileName(value: any) {
  return String(value || '--')
    .replace(/( - 副本)+/g, ' - 副本')
    .replace(/(\s*- 副本\s*){2,}/g, ' - 副本')
    .trim();
}

function fieldValue(field: AnyObj) {
  if (!field) return '--';
  const key = field.fieldKey || field.key || '';
  const num = Number(field.displayValue);
  if ((key === 'advanceSpeed' || key === 'advancePumpPressure') && Number.isFinite(num) && num > 1000) {
    return '待复核';
  }
  if (field.displayValue === null || field.displayValue === undefined || field.displayValue === '') return '--';
  return field.displayValue;
}

function numericValue(field: AnyObj) {
  const v = fieldValue(field);
  if (v === '待复核' || v === '--') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce((acc: Record<string, number>, item) => {
    const key = getKey(item) || '待确认';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(obj: Record<string, number>, n = 8) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function qualityText(q: AnyObj = {}) {
  return `已确认 ${q.confirmed || 0}，已校准 ${q.scale_checked || 0}，待校准 ${q.scale_pending || 0}，待解释 ${q.pending || 0}`;
}

const baseChart = {
  backgroundColor: 'transparent',
  textStyle: { color: '#dff8ff' },
  grid: { left: 48, right: 24, top: 38, bottom: 42 },
  tooltip: { trigger: 'axis' },
};

function Chart({ title, option, height = 280 }: { title: string; option: AnyObj; height?: number }) {
  return (
    <article className="ap-card chart">
      <h3>{title}</h3>
      <ReactECharts option={{ ...baseChart, ...option }} style={{ height }} notMerge={true} />
    </article>
  );
}

function Shell({ active, children }: { active: string; children: ReactNode }) {
  const nav = [
    ['/', '指挥总览', '现场状态'],
    ['/risk-replay', '风险复盘', '映射缺口'],
    ['/monitoring-alerts', '监测异常', '趋势图表'],
    ['/operation-diagnosis', '参数诊断', '组合研判'],
    ['/slurry-grouting', '泥水注浆', '泥浆环路'],
    ['/segment-quality', '管片盾尾', '盾尾间隙'],
    ['/evidence', '证据链', '来源追溯'],
    ['/data-import', '数据接入', '入库状态'],
    ['/system-status', '系统状态', '可信度'],
  ];
  return (
    <div className="analysis-shell">
      <aside className="analysis-side">
        <div className="analysis-brand">
          <span>通苏嘉甬施工监测与盾构研判平台</span>
          <b>现场监测分析</b>
        </div>
        <nav>
          {nav.map(([href, title, sub]) => (
            <a key={href} href={href} className={active === href ? 'active' : ''}>
              <b>{title}</b>
              <span>{sub}</span>
            </a>
          ))}
        </nav>
      </aside>
      <main className="analysis-main">{children}</main>
    </div>
  );
}

function Hero({ tag, title, desc, value, valueLabel }: { tag: string; title: string; desc: string; value?: any; valueLabel?: string }) {
  return (
    <header className="analysis-hero">
      <div>
        <span>{tag}</span>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {value !== undefined && (
        <div className="hero-number">
          <span>{valueLabel}</span>
          <b>{value}</b>
        </div>
      )}
    </header>
  );
}

function Stat({ title, value, note, tone = '' }: { title: string; value: any; note?: string; tone?: string }) {
  return (
    <article className={`ap-stat ${tone}`}>
      <span>{title}</span>
      <b>{value ?? '--'}</b>
      {note && <p>{note}</p>}
    </article>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="ap-section">
      <div className="ap-section-head">
        <h2>{title}</h2>
        {desc && <p>{desc}</p>}
      </div>
      {children}
    </section>
  );
}

function ErrorBox({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="ap-error">接口暂不可用：{error}</div>;
}

function MonitoringAnalysisPage() {
  const { data, error } = useApi('/api/monitoring/alerts?pageSize=300', 0);
  const items = data?.items || [];

  const levelCounts = countBy(items, (x: AnyObj) => cnStatus(x.alertLevel));
  const itemCounts = countBy(items, (x: AnyObj) => x.monitoringItem || '未知项目');
  const dateCounts = countBy(items, (x: AnyObj) => String(x.measuredAt || '').slice(0, 10) || '待确认日期');
  const levelEntries = topEntries(levelCounts, 6);
  const itemEntries = topEntries(itemCounts, 8);
  const dateEntries = Object.entries(dateCounts).sort((a, b) => a[0].localeCompare(b[0]));
  const topAlarms = items
    .filter((x: AnyObj) => cnStatus(x.alertLevel) === '报警')
    .slice(0, 8);

  return (
    <Shell active="/monitoring-alerts">
      <Hero
        tag="监测异常分析"
        title="从“异常有多少”升级到“异常集中在哪里、何时出现”"
        desc="读取历史监测库中的真实监测读数，按等级、项目和日期做图表分析。表格只保留重点异常点，不再铺满 200 行。"
        value={items.length}
        valueLabel="非正常读数样本"
      />
      <ErrorBox error={error} />

      <div className="ap-grid four">
        <Stat title="报警" value={levelCounts['报警'] || 0} note="需要优先复核" tone="warn" />
        <Stat title="预警" value={levelCounts['预警'] || 0} note="需要持续观察" />
        <Stat title="待确认" value={levelCounts['待确认'] || 0} note="阈值或解析口径待确认" />
        <Stat title="主要项目" value={itemEntries[0]?.[0] || '--'} note={itemEntries[0] ? `${itemEntries[0][1]} 条` : '暂无'} />
      </div>

      <div className="ap-chart-grid">
        <Chart
          title="异常等级分布"
          option={{
            xAxis: { type: 'category', data: levelEntries.map(([k]) => k), axisLabel: { color: '#cdebf5' } },
            yAxis: { type: 'value', axisLabel: { color: '#cdebf5' } },
            series: [{ type: 'bar', data: levelEntries.map(([, v]) => v), label: { show: true, position: 'top' } }],
          }}
        />
        <Chart
          title="监测项目分布"
          option={{
            tooltip: { trigger: 'item' },
            series: [{ type: 'pie', radius: ['42%', '68%'], data: itemEntries.map(([name, value]) => ({ name, value })) }],
          }}
        />
      </div>

      <Chart
        title="异常日期分布"
        height={300}
        option={{
          xAxis: { type: 'category', data: dateEntries.map(([k]) => k), axisLabel: { color: '#cdebf5', rotate: 30 } },
          yAxis: { type: 'value', axisLabel: { color: '#cdebf5' } },
          series: [{ type: 'line', smooth: true, data: dateEntries.map(([, v]) => v), areaStyle: {}, label: { show: true } }],
        }}
      />

      <Section title="重点报警点" desc="优先显示报警点，给现场人员快速定位测点和来源。">
        <div className="ap-table">
          <div className="ap-tr head"><span>测点</span><span>项目</span><span>时间</span><span>累计变化</span><span>单次变化</span><span>来源</span></div>
          {topAlarms.map((it: AnyObj, idx: number) => (
            <div className="ap-tr" key={it.readingId || idx}>
              <span>{it.pointCode || '--'}</span>
              <span>{it.monitoringItem || '--'}</span>
              <span>{dateText(it.measuredAt)}</span>
              <span>{it.cumulativeChange ?? it.currentValue ?? '--'}</span>
              <span>{it.changeRate ?? '--'}</span>
              <span>{shortId(it.sourceId)}</span>
            </div>
          ))}
        </div>
      </Section>
    </Shell>
  );
}

function TbmAnalysisPage({ mode }: { mode: 'operation' | 'slurry' | 'segment' | 'system' }) {
  const { data, error } = useApi('/api/tbm/frontend-summary?deviceId=DZ1360', 10000);
  const groups = data?.groups || {};
  const q = data?.decodeQuality || {};

  const config: AnyObj = {
    operation: {
      active: '/operation-diagnosis',
      tag: '施工参数诊断',
      title: '看推进、刀盘、仓压和分区压力是否协调',
      desc: '不是罗列字段，而是把当前实测字段转成组合研判。疑似符号位或比例未确认的值标为“待复核”。',
      groupKeys: ['advance', 'cutter', 'chamberPressure', 'propelPressure'],
    },
    slurry: {
      active: '/slurry-grouting',
      tag: '泥水注浆分析',
      title: '看进排浆和注浆量是否具备可判断口径',
      desc: '泥浆环路存在比例待校准字段，因此页面区分“可展示”和“不可直接下结论”。',
      groupKeys: ['slurry', 'grouting'],
    },
    segment: {
      active: '/segment-quality',
      tag: '管片盾尾分析',
      title: '看盾尾间隙与管片位置码是否需要复核',
      desc: '盾尾间隙可展示，管片位置码和状态码需要字典确认后再解释。',
      groupKeys: ['tailGap', 'segment', 'advance'],
    },
    system: {
      active: '/system-status',
      tag: '系统状态',
      title: '看现场接口和历史库是否足够支撑展示',
      desc: '系统状态页用于展示数据可信度，不暴露开发调试细节。',
      groupKeys: ['basic', 'advance', 'chamberPressure', 'tailGap', 'slurry'],
    },
  }[mode];

  const fields: AnyObj[] = useMemo(() => {
    const selected = config.groupKeys.flatMap((key: string) => groups[key] || []);
    return selected.length ? selected : Object.values(groups).flatMap((v: any) => Array.isArray(v) ? v : []);
  }, [groups, config.groupKeys]);

  const qualityEntries = [
    ['已确认', q.confirmed || 0],
    ['已校准换算', q.scale_checked || 0],
    ['比例待校准', q.scale_pending || 0],
    ['待解释', q.pending || 0],
  ];
  const chamber = (groups.chamberPressure || []) as AnyObj[];
  const tail = (groups.tailGap || []) as AnyObj[];
  const propel = (groups.propelPressure || []) as AnyObj[];
  const slurry = (groups.slurry || []) as AnyObj[];

  return (
    <Shell active={config.active}>
      <Hero tag={config.tag} title={config.title} desc={config.desc} value={data?.currentRing?.displayValue || '--'} valueLabel="现场环号" />
      <ErrorBox error={error} />

      <div className="ap-grid four">
        <Stat title="采集时间" value={data?.timestamp ? dateText(data.timestamp) : '--'} note={qualityText(q)} />
        <Stat title="原始寄存器" value={`${data?.rawLength ?? '--'} / 3250`} note={data?.rawLengthOk ? '数量完整' : '数量待核对'} tone={data?.rawLengthOk ? 'ok' : 'warn'} />
        <Stat title="导向数据" value={data?.guidanceAvailable ? '已接入' : '暂未接入'} note={data?.guidanceStatus || '导向数据已预留，暂未接入'} />
        <Stat title="当前结论" value={(q.scale_pending || q.pending) ? '可展示，需复核' : '可展示'} note="待校准/待解释字段不参与强判断" />
      </div>

      <div className="ap-chart-grid">
        <Chart
          title="字段可信度分布"
          option={{ tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: ['40%', '68%'], data: qualityEntries.map(([name, value]) => ({ name, value })) }] }}
        />
        <Chart
          title={mode === 'segment' ? '盾尾间隙对比' : mode === 'slurry' ? '泥浆环路当前值' : '开挖仓压力对比'}
          option={{
            xAxis: { type: 'category', data: (mode === 'segment' ? tail : mode === 'slurry' ? slurry : chamber).map(f => f.nameCn || f.fieldKey), axisLabel: { color: '#cdebf5', interval: 0, rotate: 20 } },
            yAxis: { type: 'value', axisLabel: { color: '#cdebf5' } },
            series: [{ type: 'bar', data: (mode === 'segment' ? tail : mode === 'slurry' ? slurry : chamber).map(numericValue), label: { show: true, position: 'top' } }],
          }}
        />
      </div>

      {mode === 'operation' && (
        <Chart
          title="推进分区压力对比"
          height={300}
          option={{
            xAxis: { type: 'category', data: propel.map(f => f.nameCn || f.fieldKey), axisLabel: { color: '#cdebf5', interval: 0, rotate: 25 } },
            yAxis: { type: 'value', axisLabel: { color: '#cdebf5' } },
            series: [{ type: 'bar', data: propel.map(numericValue), label: { show: true, position: 'top' } }],
          }}
        />
      )}

      <Section title="字段判读清单" desc="保留现场可读字段名、数值、单位和可信状态；不再直接展示接口 key。">
        <div className="ap-field-grid">
          {fields.map((f, idx) => (
            <article key={`${f.fieldKey || f.key || idx}-${idx}`}>
              <div>
                <b>{f.nameCn || f.fieldKey || f.key || '未命名字段'}</b>
                <span>{cnStatus(f.status || f.decodeStatus)}</span>
              </div>
              <strong>{fieldValue(f)} <small>{f.unit || ''}</small></strong>
              <p>{f.status === 'pending' ? '字段含义待确认' : f.status === 'scale_pending' ? '比例系数待确认' : '可作为当前展示值'}</p>
            </article>
          ))}
        </div>
      </Section>
    </Shell>
  );
}

function DataImportPage() {
  const { data, error } = useApi('/api/file-health', 10000);
  const tables = data?.tables || {};
  const entries = [
    ['源文件', tables.source_document || 0],
    ['监测点', tables.monitoring_point || 0],
    ['监测读数', tables.monitoring_reading || 0],
    ['证据链', tables.extraction_evidence || 0],
    ['日报临时表', tables.stg_file_daily_report_meta || 0],
    ['全文页临时表', tables.stg_file_extracted_page || 0],
    ['质量问题临时表', tables.stg_file_data_quality_issue || 0],
  ];

  return (
    <Shell active="/data-import">
      <Hero tag="数据接入状态" title="区分已入库、可展示、待补强的数据" desc="本页不再展示上传控件和接口调试说明，只说明当前哪些数据能支撑页面分析。" value={tables.monitoring_reading || 0} valueLabel="历史监测读数" />
      <ErrorBox error={error} />
      <div className="ap-grid four">
        <Stat title="源文件" value={tables.source_document || 0} note="日报、周报、现场图片等资料" />
        <Stat title="监测点" value={tables.monitoring_point || 0} note="已结构化入库" />
        <Stat title="监测读数" value={tables.monitoring_reading || 0} note="可支撑异常分析" />
        <Stat title="证据链" value={tables.extraction_evidence || 0} note="可追溯到来源短号" />
      </div>
      <Chart
        title="入库数据规模"
        option={{
          xAxis: { type: 'category', data: entries.map(([k]) => k), axisLabel: { color: '#cdebf5', interval: 0, rotate: 25 } },
          yAxis: { type: 'value', axisLabel: { color: '#cdebf5' } },
          series: [{ type: 'bar', data: entries.map(([, v]) => v), label: { show: true, position: 'top' } }],
        }}
      />
      <Section title="当前接入结论" desc="明确告诉用户什么能用、什么还不能用于强判断。">
        <div className="ap-decision-grid">
          <article><b>已可使用</b><p>源文件、监测点、监测读数、证据链已经入库，可支撑监测异常和来源追溯。</p></article>
          <article><b>待补强</b><p>日报临时表、全文页临时表、质量问题临时表当前为空，暂不能做到逐页逐行原文审计。</p></article>
          <article><b>不能冒充</b><p>环号到里程、风险源窗口和导向数据尚未完整接入，不应伪造风险源联动。</p></article>
        </div>
      </Section>
    </Shell>
  );
}

function EvidencePage() {
  const { data: alerts } = useApi('/api/monitoring/alerts?pageSize=40', 0);
  const { data: docs } = useApi('/api/documents?pageSize=10', 0);
  const { data: health } = useApi('/api/file-health', 10000);
  const alertItems = alerts?.items || [];
  const docItems = docs?.items || [];
  const tables = health?.tables || {};
  const typeCounts = countBy(docItems, (d: AnyObj) => docType(d.fileType));

  return (
    <Shell active="/evidence">
      <Hero tag="证据链" title="回答“这条异常从哪份资料来”" desc="页面只保留异常读数追溯、源文件概览和当前证据缺口，不把完整编号和数据库字段铺给用户。" value={tables.extraction_evidence || 0} valueLabel="证据记录" />
      <div className="ap-chart-grid">
        <Chart
          title="源文件类型分布"
          option={{ tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: ['42%', '68%'], data: Object.entries(typeCounts).map(([name, value]) => ({ name, value })) }] }}
        />
        <Chart
          title="异常状态追溯分布"
          option={{
            xAxis: { type: 'category', data: topEntries(countBy(alertItems, (x: AnyObj) => cnStatus(x.alertLevel)), 6).map(([k]) => k), axisLabel: { color: '#cdebf5' } },
            yAxis: { type: 'value', axisLabel: { color: '#cdebf5' } },
            series: [{ type: 'bar', data: topEntries(countBy(alertItems, (x: AnyObj) => cnStatus(x.alertLevel)), 6).map(([, v]) => v), label: { show: true, position: 'top' } }],
          }}
        />
      </div>
      <Section title="异常读数追溯入口" desc="先看异常测点，再看来源短号。页码/行号级证据待后续表格页补强。">
        <div className="ap-table five">
          <div className="ap-tr head"><span>测点</span><span>项目</span><span>时间</span><span>状态</span><span>来源短号</span></div>
          {alertItems.map((it: AnyObj, idx: number) => (
            <div className="ap-tr" key={it.readingId || idx}>
              <span>{it.pointCode || '--'}</span>
              <span>{it.monitoringItem || '--'}</span>
              <span>{dateText(it.measuredAt)}</span>
              <span className="level">{cnStatus(it.alertLevel)}</span>
              <span>{shortId(it.sourceId)}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="最新源文件" desc="只展示用户能理解的文件类型和文件名。">
        <div className="ap-docs">
          {docItems.map((d: AnyObj) => (
            <article key={d.sourceId}>
              <span>{docType(d.fileType)} · {d.documentDate || '--'}</span>
              <b>{cleanFileName(d.fileName)}</b>
              <p>{String(d.description || '暂无描述').replace(/daily_report/g, '监测日报').replace(/image/g, '现场图片')}</p>
            </article>
          ))}
        </div>
      </Section>
    </Shell>
  );
}

function RiskGapPage() {
  return (
    <Shell active="/risk-replay">
      <Hero tag="风险复盘" title="风险源联动需要映射表，当前不展示伪联动" desc="已有现场环号和历史监测数据，但缺少“现场环号 → DK里程 → 风险源窗口”的正式映射。页面先说明缺口，不用演示风险源冒充真实复盘。" />
      <Section title="待补资料" desc="补齐后再做真实风险源穿越复盘。">
        <div className="ap-decision-grid">
          <article><b>环号-里程映射</b><p>把现场环号转换成工程里程。</p></article>
          <article><b>风险源窗口</b><p>给出风险源影响起止里程和影响环号。</p></article>
          <article><b>监测点关联</b><p>把测点、风险源和施工参数串起来。</p></article>
        </div>
      </Section>
    </Shell>
  );
}

export default function AnalysisRoute({ fallback }: { fallback: ReactNode }) {
  const path = normalizeRoute(window.location.pathname);

  // Old homepage ring linkage appends ?ring=392 to links.
  // Analysis pages do not need this query. Remove it only after the path is captured,
  // so old homepage ring linkage stays untouched.
  if (ANALYSIS_ROUTES.has(path) && window.location.search) {
    window.history.replaceState(null, '', path);
  }

  if (path === '/monitoring-alerts') return <MonitoringAnalysisPage />;
  if (path === '/operation-diagnosis') return <TbmAnalysisPage mode="operation" />;
  if (path === '/slurry-grouting') return <TbmAnalysisPage mode="slurry" />;
  if (path === '/segment-quality') return <TbmAnalysisPage mode="segment" />;
  if (path === '/system-status') return <TbmAnalysisPage mode="system" />;
  if (path === '/data-import') return <DataImportPage />;
  if (path === '/evidence') return <EvidencePage />;
  if (path === '/risk-replay') return <RiskGapPage />;
  return <>{fallback}</>;
}

