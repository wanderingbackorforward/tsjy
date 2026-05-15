import { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { apiGet, apiGetV3, apiUpload } from './services/api';

type AnyObj = Record<string, any>;

const ringMin = 250;
const ringMax = 392;
const 演示数据_START_M = 53695;
const 演示数据_END_M = 59129;
const 演示数据_M_PER_RING = (演示数据_END_M - 演示数据_START_M) / (ringMax - ringMin);

const NAV = [
  ['overview', '指挥总览', '地图/当前环'],
  ['book', '项目书', '工程依据'],
  ['risk', '风险复盘', '穿越窗口'],
  ['monitoring', '监测异常', '阈值趋势'],
  ['operation', '参数诊断', '组合异常'],
  ['slurry', '泥水注浆', '沉降归因'],
  ['segment', '管片质量', '拼装缺陷'],
  ['events', '事件闭环', '报警处置'],
  ['import', '数据接入', '接口/映射'],
  ['system', '系统状态', '数据质量'],
] as const;

const PAGE_ROUTES: Record<string, string> = {
  overview: '/',
  book: '/project-book',
  risk: '/risk-replay',
  monitoring: '/monitoring-alerts',
  operation: '/operation-diagnosis',
  slurry: '/slurry-grouting',
  segment: '/segment-quality',
  events: '/event-closure',
  import: '/data-import',
  system: '/system-status',
};

const ROUTE_PAGES: Record<string, string> = Object.fromEntries(
  Object.entries(PAGE_ROUTES).map(([page, path]) => [path, page]),
);

function pageFromLocation() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  return ROUTE_PAGES[path] || 'overview';
}

function ringFromLocation() {
  const raw = new URLSearchParams(window.location.search).get('ring');
  const n = raw ? Number(raw) : 361;
  return Number.isFinite(n) ? Math.min(ringMax, Math.max(ringMin, n)) : 361;
}

function pushPageUrl(page: string) {
  const pathname = PAGE_ROUTES[page] || '/';
  window.history.pushState({}, '', pathname);
}



function replaceRingUrl(ring: number) {
  const url = new URL(window.location.href);
  const path = url.pathname.replace(/\/$/, '') || '/';
  if (path !== '/') return;
  url.searchParams.set('ring', String(ring));
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}



function safeArray(x: any): any[] { return Array.isArray(x) ? x : []; }
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function avg(arr: any[], key: string) { const vals = arr.map(x => Number(x?.[key])).filter(Number.isFinite); return vals.length ? +(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : null; }
function maxAbs(arr: any[], key: string) { const vals = arr.map(x => Math.abs(Number(x?.[key]))).filter(Number.isFinite); return vals.length ? Math.max(...vals) : 0; }
function drift(cur: number | null | undefined, base: number | null | undefined) { if (cur == null || base == null || base === 0) return null; return +(((cur-base)/base)*100).toFixed(1); }
function km(m: number) { const base = Math.floor(m / 1000) * 1000; return `DK${Math.floor(m/1000)}+${String(Math.round(m-base)).padStart(3,'0')}`; }
function demoMileageForRing(ringNo: number) { return 演示数据_START_M + (ringNo - ringMin) * 演示数据_M_PER_RING; }
function ringFromMileageM(m?: number) { if (!m) return 300; return clamp(Math.round(ringMin + (m - 演示数据_START_M) / 演示数据_M_PER_RING), ringMin, ringMax); }
function pctRing(ringNo: number) { return clamp(((ringNo-ringMin)/(ringMax-ringMin))*96+2, 2, 98); }
function rangeAround(ring: number, size = 55) { return [clamp(ring-size, ringMin, ringMax), clamp(ring+size, ringMin, ringMax)]; }

function statusZh(status?: string) {
  const map: AnyObj = {
    approaching: '接近中', inside: '穿越中', post_effect: '穿越后影响期', passed: '已通过',
    not_reached: '未到达', 正常: '正常', 预警: '预警', 报警: '报警',
    high: '重点关注', medium: '中风险', low: '低风险', demo: '演示', open: '未闭环', closed: '已闭环',
  };
  return map[status || ''] || status || '待判断';
}
function levelText(level?: string) { return statusZh(level || 'medium'); }
function objectZh(v?: string) {
  const map: AnyObj = {
    surface_settlement: '地表沉降', building_vertical_displacement: '建筑物竖向位移',
    building_settlement: '建筑物沉降', pipeline_vertical_displacement: '管线竖向位移',
    railway_settlement: '铁路沉降', structure_settlement: '结构沉降',
    tunnel_vertical_displacement: '隧道结构竖向位移', tunnel_horizontal_displacement: '隧道结构水平位移',
    vertical_displacement: '竖向位移', 地表: '地表', 建筑物: '建筑物', 管线: '管线',
  };
  return map[v || ''] || v || '监测点';
}

function buildDemoRiskSources() {
  return [
    { riskSourceId:'risk-jhgt', riskName:'京沪高铁', riskType:'铁路', crossingRelation:'下穿', riskLevel:'high', startMileage:'DK54+370', endMileage:'DK54+450', startMileageM:54370, endMileageM:54450, status:'inside', monitoringPointCount:3, sensitivity:1.28, control:'重点控制沉降与桥桩安全，穿越前全面维保，窗口内稳压低速。' },
    { riskSourceId:'risk-ychl', riskName:'阳澄环路', riskType:'城市道路', crossingRelation:'下穿', riskLevel:'medium', startMileage:'DK54+450', endMileage:'DK54+520', startMileageM:54450, endMileageM:54520, status:'inside', monitoringPointCount:2, sensitivity:.72, control:'关注道路沉降与路面裂缝，结合地表点变化调整注浆。' },
    { riskSourceId:'risk-tya', riskName:'亭苑A区', riskType:'居民区/建筑物', crossingRelation:'侧穿', riskLevel:'medium', startMileage:'DK55+540', endMileage:'DK55+580', startMileageM:55540, endMileageM:55580, status:'正常', monitoringPointCount:4, sensitivity:.82, control:'关注建筑物竖向位移，穿越前核查沉降初始值。' },
    { riskSourceId:'risk-tyb', riskName:'亭苑B区', riskType:'居民区/建筑物', crossingRelation:'侧穿', riskLevel:'high', startMileage:'DK55+670', endMileage:'DK55+710', startMileageM:55670, endMileageM:55710, status:'正常', monitoringPointCount:5, sensitivity:1.08, control:'近距离侧穿，重点关注差异沉降和建筑物变形。' },
    { riskSourceId:'risk-metro3', riskName:'轨道交通3号线葑亭大道站', riskType:'地铁车站', crossingRelation:'下穿', riskLevel:'high', startMileage:'DK55+990', endMileage:'DK56+025', startMileageM:55990, endMileageM:56025, status:'正常', monitoringPointCount:6, sensitivity:1.15, control:'最小净距小，重点做结构位移和沉降联动复核。' },
    { riskSourceId:'risk-hn-jh', riskName:'沪宁城际/京沪铁路', riskType:'铁路', crossingRelation:'下穿', riskLevel:'high', startMileage:'DK56+620', endMileage:'DK56+705', startMileageM:56620, endMileageM:56705, status:'正常', monitoringPointCount:8, sensitivity:1.2, control:'铁路保护等级高，窗口内保持参数平稳并加密监测。' },
    { riskSourceId:'risk-mdc', riskName:'梦达驰厂房', riskType:'厂房', crossingRelation:'下穿', riskLevel:'medium', startMileage:'DK57+440', endMileage:'DK57+560', startMileageM:57440, endMileageM:57560, status:'正常', monitoringPointCount:4, sensitivity:.68, control:'关注厂房基础变形和注浆补偿。' },
    { riskSourceId:'risk-lst', riskName:'罗斯蒂厂房', riskType:'厂房', crossingRelation:'下穿', riskLevel:'medium', startMileage:'DK57+640', endMileage:'DK57+940', startMileageM:57640, endMileageM:57940, status:'正常', monitoringPointCount:6, sensitivity:.72, control:'长窗口厂房穿越，关注连续沉降趋势。' },
    { riskSourceId:'risk-dsh', riskName:'东沙湖', riskType:'湖泊/水体', crossingRelation:'下穿', riskLevel:'high', startMileage:'DK58+030', endMileage:'DK59+280', startMileageM:58030, endMileageM:59280, status:'正常', monitoringPointCount:7, sensitivity:1.18, control:'水体下穿，重点关注泥水压力、出浆比重、涌水和掌子面稳定。' },
  ];
}

function riskForRing(ringNo: number) {
  const m = demoMileageForRing(ringNo);
  return buildDemoRiskSources().find(r => m >= r.startMileageM - 80 && m <= r.endMileageM + 120);
}

function buildDemoOperations(start = ringMin, end = ringMax) {
  const items = [];
  for (let ringNo=start; ringNo<=end; ringNo++) {
    const m = demoMileageForRing(ringNo);
    const risk = buildDemoRiskSources().find(r => m >= r.startMileageM - 80 && m <= r.endMileageM + 120);
    const center = risk ? (risk.startMileageM + risk.endMileageM) / 2 : m;
    const influence = risk ? Math.max(0, 1 - Math.abs(m-center)/260) * risk.sensitivity : 0;
    const day = clamp(Math.floor((ringNo-ringMin)/5)+1, 1, 30);
    items.push({
      ringNo, mileage: km(m), mileageM: m, recordedAt:`2024-04-${String(day).padStart(2,'0')} 10:00:00`,
      advanceSpeed:+(3.25 - influence*.48 + Math.sin(ringNo/7)*.24).toFixed(2),
      facePressure:+(.43 + influence*.08 + (ringNo-ringMin)*.0008 + Math.sin(ringNo/12)*.014).toFixed(3),
      totalThrust:Math.round(31800 + (ringNo-ringMin)*74 + influence*3200 + Math.sin(ringNo/8)*850),
      cutterTorque:Math.round(14800 + Math.sin(ringNo/5)*1450 + influence*2400),
      cutterRotationSpeed:+(1.35 - influence*.18 + Math.sin(ringNo/6)*.06).toFixed(2),
      penetration:+(6.8 + influence*1.2 + Math.sin(ringNo/4)*.4).toFixed(2),
      slurryInDensity:+(1.08 + Math.sin(ringNo/8)*.012).toFixed(3),
      slurryOutDensity:+(1.15 + influence*.018 + Math.sin(ringNo/7)*.014).toFixed(3),
      slurryViscosity:+(25 + influence*6 + Math.sin(ringNo/6)*2).toFixed(1),
      sandContent:+(2.5 + influence*1.4 + Math.sin(ringNo/8)*.3).toFixed(2),
      groutingVolume:+(6.2 + influence*1.6 + Math.sin(ringNo/9)*.35).toFixed(2),
      groutingPressure:+(.23 + influence*.05 + Math.sin(ringNo/10)*.012).toFixed(3),
      postureVertical:+(Math.sin(ringNo/12)*8 + influence*5).toFixed(2),
      postureHorizontal:+(Math.cos(ringNo/10)*7 - influence*4).toFixed(2),
      segmentOffset:+(Math.sin(ringNo/7)*2 + influence*1.8).toFixed(2),
      leakageScore:+(influence*.8 + Math.max(0, Math.sin(ringNo/11))).toFixed(2),
      isDemo:true,
    });
  }
  return items;
}

function buildDemoPoints() {
  return [
    ['DB-JH-001','京沪高铁地表沉降点1','地表沉降','京沪高铁','预警',20,25,0.92],
    ['DB-JH-002','京沪高铁地表沉降点2','地表沉降','京沪高铁','正常',20,25,0.48],
    ['DB-TYA-001','亭苑A区建筑物沉降点1','建筑物竖向位移','亭苑A区','正常',15,20,0.42],
    ['DB-TYB-001','亭苑B区建筑物沉降点1','建筑物竖向位移','亭苑B区','预警',15,20,0.86],
    ['DT3-001','地铁3号线结构位移点1','隧道结构竖向位移','轨道交通3号线葑亭大道站','预警',12,18,0.78],
    ['DT3-002','地铁3号线结构位移点2','隧道结构水平位移','轨道交通3号线葑亭大道站','正常',12,18,0.36],
    ['GX-JH-001','京沪高铁管线位移点','管线竖向位移','京沪高铁','正常',15,20,0.40],
    ['DSH-001','东沙湖地表沉降点1','地表沉降','东沙湖','正常',20,25,0.38],
    ['DSH-002','东沙湖水体周边沉降点2','地表沉降','东沙湖','报警',20,25,1.16],
  ].map(([code,name,item,risk,alert,warn,报警,stress], i) => ({
    pointId:`demo-point-${i+1}`,
    pointCode:code,
    pointName:name,
    monitoringObject:item,
    monitoringItem:item,
    relatedRisk:risk,
    预警Threshold:Number(warn),
    报警Threshold:Number(报警),
    alertLevel:alert,
    demoStress:Number(stress),
    isDemo:true,
  }));
}

function buildDemoReadings(pointCode='DB-JH-001') {
  const point = buildDemoPoints().find((p:any) => p.pointCode === pointCode);
  const stress = Number(point?.demoStress ?? 0.55);
  const warn = Number(point?.预警Threshold ?? 20);
  const 报警 = Number(point?.报警Threshold ?? 25);

  // Demo severity: 正常 points stay below 预警, 预警 points approach/cross 预警, 报警 point crosses 报警.
  const targetAbs = stress >= 1.1
    ? 报警 + 1.8
    : stress >= 0.75
      ? warn + (报警 - warn) * 0.35
      : warn * (0.42 + stress * 0.18);

  return Array.from({length:14}, (_,i) => {
    const t = i / 13;
    const curve = Math.pow(t, 1.22);
    const wave = Math.sin(i / 2.3) * 0.18;
    const cumulative = -(targetAbs * curve + wave);
    const prevT = i === 0 ? 0 : (i - 1) / 13;
    const prev = i === 0 ? 0 : -(targetAbs * Math.pow(prevT, 1.22) + Math.sin((i - 1) / 2.3) * 0.18);
    const change = cumulative - prev;
    const absVal = Math.abs(cumulative);
    return {
      measuredAt:`2024-04-${String(i+1).padStart(2,'0')} 08:00:00`,
      currentValue:+cumulative.toFixed(2),
      cumulativeChange:+cumulative.toFixed(2),
      changeRate:+change.toFixed(2),
      alertLevel: absVal >= 报警 ? '报警' : absVal >= warn ? '预警' : '正常',
      isDemo:true,
    };
  });
}

function buildDemoEvents() {
  return [
    { eventId:'evt-1', eventTime:'2024-04-02 09:30', ringNo:336, severity:'预警', type:'沉降速率上升', title:'接近京沪高铁风险源区间，地表沉降速率上升', reason:'风险源窗口内压力和注浆补偿发生变化', action:'加密监测，复核切口压力和同步注浆量', owner:'测量组/盾构班', status:'closed' },
    { eventId:'evt-2', eventTime:'2024-04-02 14:20', ringNo:337, severity:'预警', type:'切口压力波动', title:'第337环切口压力短时波动', reason:'穿越敏感风险源前参数调整', action:'降低推进速度，保持泥水压力稳定', owner:'盾构司机', status:'closed' },
    { eventId:'evt-3', eventTime:'2024-04-03 10:10', ringNo:361, severity:'正常', type:'同步注浆偏高', title:'同步注浆量较计划值偏高，已记录复核', reason:'沉降补偿策略调整', action:'观察后续沉降曲线', owner:'技术员', status:'open' },
    { eventId:'evt-4', eventTime:'2024-04-06 16:30', ringNo:384, severity:'预警', type:'出浆比重偏高', title:'东沙湖下穿前出浆比重波动', reason:'富水粉砂段泥水指标扰动', action:'复核泥浆粘度和含砂率', owner:'泥水班', status:'open' },
  ];
}

function demoOverview(selectedRing: number): AnyObj {
  const ops = buildDemoOperations();
  const current = { ringNo:336, mileage:'DK54+367', mileageM:54367 };
  const m = demoMileageForRing(selectedRing);
  const selected = { ringNo:selectedRing, mileage:km(m), mileageM:m };
  const op = ops.find(x => x.ringNo === selectedRing) || ops[0];
  const nearRisk = riskForRing(selectedRing);
  return {
    section:{ projectName:'新建南通至宁波高速铁路站前Ⅰ标', sectionName:'苏州东隧道盾构区间', startMileage:'DK53+695', endMileage:'DK59+129' },
    currentRing:current, selectedRing:selected, operationSummary:op, riskLevel: nearRisk ? (nearRisk.riskLevel==='high'?'预警':'medium') : 'low',
    findings:[
      { title: nearRisk ? `当前查看环处于${nearRisk.riskName}影响窗口` : '当前查看环暂无直接重点风险源重叠', evidence:`demo：查看环 ${selectedRing}，里程 ${selected.mileage}，${nearRisk ? `与${nearRisk.riskName}存在空间关系` : '主要关注后续风险源窗口'}。`, suggestion: nearRisk ? nearRisk.control : '保持常规参数跟踪，进入风险源前50m后提高复盘频率。' },
      { title:'推力-扭矩-速度组合需要连续观察', evidence:'demo：风险窗口内总推力和刀盘扭矩较前置区间上升，推进速度略有下降。', suggestion:'复核泥水指标、地层变化和刀盘状态。' },
    ],
    operationTrend:ops, activeRiskSources:buildDemoRiskSources(), recentEvents:buildDemoEvents(), isDemo:true,
  };
}

function ensureItems(items:any[], fallback:any[]) { return items.length ? items : fallback; }
function DemoTag({ real }: { real?: boolean }) { return <span className={real ? 'tag-real' : 'tag-demo'}>{real ? '真实/接口数据' : '演示数据'}</span>; }

function DashboardShell({ children, page, setPage }: { children: React.ReactNode; page:string; setPage:(p:string)=>void }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span>现场监测分析</span><strong>盾构施工监控研判平台</strong></div>
        <nav>{NAV.map(([key,title,sub]) => <button key={key} className={page===key?'active':''} onClick={()=>setPage(key)}><b>{title}</b><em>{sub}</em></button>)}</nav>
      </header>
      {children}
    </div>
  );
}


async function fetchTbmFrontendSummarySafe() {
  const host = window.location.hostname || '120.55.70.218';
  const candidates = [
    `http://${host}:8100/api/tbm/frontend-summary?deviceId=DZ1360`,
    `http://${host}:8100/tbm/frontend-summary?deviceId=DZ1360`,
    `/api/tbm/frontend-summary?deviceId=DZ1360`,
    `/tbm/frontend-summary?deviceId=DZ1360`,
  ];

  let lastError = '';
  for (const url of candidates) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        lastError = `GET ${url} failed: ${response.status}`;
        continue;
      }
      const json = await response.json();
      return json?.data || json;
    } catch (error: any) {
      lastError = error?.message || String(error);
    }
  }
  throw new Error(lastError || '盾构机 实时接口暂不可用');
}


const IFC_FIELD_META: Record<string, { title: string; group: string; order: number }> = {
  currentRing: { title: '当前环号', group: 'basic', order: 1 },
  hydraulicOilTemp: { title: '液压油箱温度', group: 'basic', order: 2 },
  advanceStatus: { title: '推进状态码', group: 'advance', order: 10 },
  advancePumpPressure: { title: '推进泵压力', group: 'advance', order: 11 },
  advanceSpeed: { title: '推进速度', group: 'advance', order: 12 },
  penetration: { title: '贯入度', group: 'advance', order: 13 },
  totalThrust: { title: '总推力', group: 'advance', order: 14 },
  advanceSpeedSet: { title: '推进速度设定', group: 'advance', order: 15 },
  cutterStatus: { title: '刀盘状态码', group: 'cutter', order: 20 },
  cutterSpeed: { title: '刀盘转速', group: 'cutter', order: 21 },
  cutterAngle: { title: '刀盘角度', group: 'cutter', order: 22 },
  cutterTorque: { title: '刀盘转矩', group: 'cutter', order: 23 },
  chamberPressure1: { title: '开挖仓压力1#', group: 'chamberPressure', order: 30 },
  chamberPressure2: { title: '开挖仓压力2#', group: 'chamberPressure', order: 31 },
  chamberPressure3: { title: '开挖仓压力3#', group: 'chamberPressure', order: 32 },
  slurryOutDensity: { title: '出浆密度', group: 'slurry', order: 40 },
  slurryOutFlow: { title: '出浆流量', group: 'slurry', order: 41 },
  slurryInDensity: { title: '进浆密度', group: 'slurry', order: 42 },
  slurryInFlow: { title: '进浆流量', group: 'slurry', order: 43 },
  slurryInPressure: { title: '进浆压力', group: 'slurry', order: 44 },
  shieldTailGap1: { title: '盾尾间隙1#', group: 'tailGap', order: 50 },
  shieldTailGap2: { title: '盾尾间隙2#', group: 'tailGap', order: 51 },
  shieldTailGap3: { title: '盾尾间隙3#', group: 'tailGap', order: 52 },
  propelPressureA: { title: '推进A区压力', group: 'propelPressure', order: 60 },
  propelPressureB: { title: '推进B区压力', group: 'propelPressure', order: 61 },
  propelPressureC: { title: '推进C区压力', group: 'propelPressure', order: 62 },
  propelPressureD: { title: '推进D区压力', group: 'propelPressure', order: 63 },
  propelPressureE: { title: '推进E区压力', group: 'propelPressure', order: 64 },
  propelPressureF: { title: '推进F区压力', group: 'propelPressure', order: 65 },
  groutTotal: { title: '注浆总量', group: 'grouting', order: 70 },
  segmentPosition: { title: '管片拼装位置码', group: 'segment', order: 80 },
};

const IFC_GROUP_TITLES: Record<string, string> = {
  basic: '基础进度',
  advance: '推进系统',
  cutter: '刀盘主驱动',
  chamberPressure: '开挖仓压力',
  slurry: '泥浆环路',
  tailGap: '盾尾间隙',
  propelPressure: '推进分区压力',
  grouting: '同步注浆',
  segment: '管片拼装',
};

async function ifcFetchTbmSummary() {
  const host = window.location.hostname || '120.55.70.218';
  const candidates = [
    `http://${host}:8100/api/tbm/frontend-summary?deviceId=DZ1360`,
    `http://${host}:8100/tbm/frontend-summary?deviceId=DZ1360`,
    `/api/tbm/frontend-summary?deviceId=DZ1360`,
    `/tbm/frontend-summary?deviceId=DZ1360`,
  ];

  let lastError = '';
  for (const url of candidates) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        lastError = `实时接口返回 ${response.status}`;
        continue;
      }
      const json = await response.json();
      return json?.data || json;
    } catch (error: any) {
      lastError = error?.message || String(error);
    }
  }
  throw new Error(lastError || '盾构机实时接口暂不可用');
}

function useInterfaceTbmLive(refreshMs = 5000) {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await ifcFetchTbmSummary();
        if (alive) {
          setData(res);
          setError('');
        }
      } catch (err: any) {
        if (alive) setError(err?.message || '盾构机实时接口暂不可用');
      }
    }
    load();
    const timer = window.setInterval(load, refreshMs);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [refreshMs]);

  return { data, error, fields: data?.metrics || data?.fields || {} };
}


const IFC_REASONABLE_RANGES: Record<string, { min: number; max: number; label: string }> = {
  advanceSpeed: { min: 0, max: 300, label: '推进速度数值超出常规展示范围' },
  advancePumpPressure: { min: 0, max: 500, label: '推进泵压力数值超出常规展示范围' },
  penetration: { min: 0, max: 80, label: '贯入度数值超出常规展示范围' },
  totalThrust: { min: 0, max: 100000, label: '总推进力数值超出常规展示范围' },
  cutterSpeed: { min: 0, max: 20, label: '刀盘速度数值超出常规展示范围' },
  cutterTorque: { min: 0, max: 100000, label: '刀盘转矩数值超出常规展示范围' },
  chamberPressure1: { min: 0, max: 20, label: '仓压数值超出常规展示范围' },
  chamberPressure2: { min: 0, max: 20, label: '仓压数值超出常规展示范围' },
  chamberPressure3: { min: 0, max: 20, label: '仓压数值超出常规展示范围' },
  slurryOutDensity: { min: 0, max: 5, label: '泥浆密度数值超出常规展示范围' },
  slurryInDensity: { min: 0, max: 5, label: '泥浆密度数值超出常规展示范围' },
  slurryOutFlow: { min: 0, max: 5000, label: '泥浆流量数值超出常规展示范围' },
  slurryInFlow: { min: 0, max: 5000, label: '泥浆流量数值超出常规展示范围' },
  slurryInPressure: { min: 0, max: 100, label: '泥浆压力数值超出常规展示范围' },
  shieldTailGap1: { min: 0, max: 500, label: '盾尾间隙数值超出常规展示范围' },
  shieldTailGap2: { min: 0, max: 500, label: '盾尾间隙数值超出常规展示范围' },
  shieldTailGap3: { min: 0, max: 500, label: '盾尾间隙数值超出常规展示范围' },
};

function ifcFieldKey(field: any) {
  return field?.fieldKey || field?.key || '';
}

function ifcIsSuspiciousField(field: any) {
  if (!field) return false;
  const key = ifcFieldKey(field);
  const rule = IFC_REASONABLE_RANGES[key];
  const value = Number(field?.displayValue);
  if (!rule || Number.isNaN(value)) return false;
  return value < rule.min || value > rule.max;
}

function ifcSuspiciousReason(field: any) {
  const key = ifcFieldKey(field);
  const rule = IFC_REASONABLE_RANGES[key];
  return rule?.label || '数值待复核';
}

function ifcFieldValue(field: any, fallback = '--') {
  if (ifcIsSuspiciousField(field)) return '待复核';
  return field?.displayValue ?? fallback;
}

function ifcFieldUnit(field: any) {
  return field?.unit || '';
}

function ifcStatusCn(field: any) {
  if (!field) return '待接入';
  if (ifcIsSuspiciousField(field)) return '数值待复核';
  if (field.qualityLabel) return field.qualityLabel;
  if (field.status === 'confirmed') return '已确认';
  if (field.status === 'scale_checked') return '已校准换算';
  if (field.status === 'scale_pending') return '比例待校准';
  if (field.status === 'pending') return '待解释';
  return '待确认';
}

function ifcGroupedFields(fields: any) {
  const result: Record<string, any[]> = {};
  Object.entries(fields || {}).forEach(([key, field]: [string, any]) => {
    const meta = IFC_FIELD_META[key] || { title: key, group: 'other', order: 999 };
    const enriched = {
      ...(field || {}),
      fieldKey: key,
      nameCn: field?.nameCn || meta.title,
      group: field?.group || meta.group,
      order: meta.order,
    };
    if (!result[enriched.group]) result[enriched.group] = [];
    result[enriched.group].push(enriched);
  });
  Object.values(result).forEach(list => list.sort((a, b) => (a.order || 999) - (b.order || 999)));
  return result;
}

function IfcMetricCard({ title, field, hint }: { title: string; field: any; hint?: string }) {
  return (
    <div className="if-metric-card">
      <span>{title}</span>
      <b>{ifcFieldValue(field)}</b>
      <em>{ifcFieldUnit(field)}</em>
      <small className={`if-status ${ifcIsSuspiciousField(field) ? 'suspect' : (field?.status || '待确认')}`}>{ifcStatusCn(field)}</small>
      {hint && <p>{hint}</p>}
    </div>
  );
}

function IfcGroupPanel({ title, fields }: { title: string; fields: any[] }) {
  return (
    <section className="if-card">
      <h3>{title}</h3>
      <div className="if-metric-grid">
        {(fields || []).map((f: any) => (
          <IfcMetricCard key={f.fieldKey || f.key} title={f.nameCn || f.fieldKey} field={f} />
        ))}
      </div>
    </section>
  );
}


async function fileApiGet(path: string) {
  const host = window.location.hostname || '120.55.70.218';
  const candidates = [
    `http://${host}:8100${path}`,
    path,
  ];
  let lastError = '';
  for (const url of candidates) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        lastError = `${url} ${response.status}`;
        continue;
      }
      const json = await response.json();
      return json?.data ?? json;
    } catch (error: any) {
      lastError = error?.message || String(error);
    }
  }
  throw new Error(lastError || '历史监测数据接口暂不可用');
}

function useFileApi(path: string, refreshMs = 0) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fileApiGet(path);
        if (alive) {
          setData(res);
          setError('');
        }
      } catch (err: any) {
        if (alive) setError(err?.message || '历史监测数据接口暂不可用');
      }
    }
    load();
    if (!refreshMs) return () => { alive = false; };
    const timer = window.setInterval(load, refreshMs);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [path, refreshMs]);
  return { data, error };
}

function cnDataSource(source: any) {
  const raw = String(source || '').trim();
  if (!raw) return '现场采集服务';
  if (raw === 'Data2Client') return '现场采集服务';
  return raw;
}


function cnAlertLevel(level: any) {
  const raw = String(level ?? '').trim();
  const lower = raw.toLowerCase();
  if (!raw || lower === 'null' || lower === 'unknown' || raw === '待确认') return '待确认';
  if (lower === 'normal' || raw === '正常') return '正常';
  if (lower === 'warning' || lower === 'warn' || raw === '预警') return '预警';
  if (lower === 'alarm' || raw === '报警') return '报警';
  if (lower === 'exceed_design_limit' || raw === '超设计限值') return '超设计限值';
  return raw;
}





function formatMonitorTime(value: any) {
  if (!value) return '--';
  const raw = String(value);
  return raw.replace('T00:00:00', '').replace('T', ' ');
}

function FileStatCard({ title, value, desc }: { title: string; value: any; desc?: string }) {
  return (
    <article className="fd-stat">
      <span>{title}</span>
      <b>{value ?? '--'}</b>
      {desc && <p>{desc}</p>}
    </article>
  );
}

function FileDataShell({ title, kicker, intro, right, children }: { title: string; kicker: string; intro: string; right?: any; children: any }) {
  return (
    <main className="fd-page">
      <section className="fd-hero">
        <div>
          <span className="fd-kicker">{kicker}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
        {right && <div className="fd-hero-right">{right}</div>}
      </section>
      {children}
    </main>
  );
}


function FileDashboardPage() {
  const { data, error } = useFileApi('/api/dashboard/overview?deviceId=DZ1360', 10000);
  const tbm = data?.tbm;
  const monitoring = data?.monitoringSummary || {};
  const docs = data?.documentSummary || {};
  const quality = data?.dataQualitySummary || {};
  const alerts = monitoring.alertSummary || {};

  return (
    <FileDataShell
      title="数据接入总览"
      kicker="历史监测库 + 现场实测"
      intro="统一查看盾构实时接口、历史监测文件、监测读数、证据链与数据质量状态。"
      right={<><b>{monitoring.readingCount || 0}</b><span>历史监测读数</span></>}
    >
      {error && <section className="fd-error">{error}</section>}
      <section className="fd-stat-grid">
        <FileStatCard title="实时设备" value={tbm?.deviceId || 'DZ1360'} desc={`现场环号 ${tbm?.currentRing?.displayValue ?? '--'} / ${cnDataSource(tbm?.machineSource)}`} />
        <FileStatCard title="源文件" value={docs.sourceDocumentCount || 0} desc="来自 源文件清单 正式表" />
        <FileStatCard title="监测点" value={monitoring.pointCount || 0} desc="来自 监测点正式表 正式表" />
        <FileStatCard title="监测读数" value={monitoring.readingCount || 0} desc="来自 监测读数正式表 正式表" />
        <FileStatCard title="异常/待确认分布" value={Object.keys(alerts).length} desc={Object.entries(alerts).slice(0,4).map(([k,v]) => `${cnAlertLevel(k)} ${v}`).join('；') || '暂无分布'} />
        <FileStatCard title="数据质量问题" value={quality.totalIssueCount || 0} desc="当前 临时表 质量问题表为空则显示 0" />
      </section>

      <section className="fd-card">
        <h3>当前数据源边界</h3>
        <div className="fd-two">
          <p><b>盾构实时接口：</b>用于现场环号、推进、仓压、泥浆、盾尾、管片等实时字段展示；导向数据仍是预留状态。</p>
          <p><b>历史监测文件：</b>用于监测异常、测点趋势、源文件、证据链；目前不再使用旧 演示数据 小表作为依据。</p>
        </div>
      </section>
    </FileDataShell>
  );
}

function FileMonitoringAlertsPage() {
  const { data, error } = useFileApi('/api/monitoring/alerts?pageSize=200', 0);
  const items = data?.items || [];
  const summary = items.reduce((acc: Record<string, number>, item: any) => {
    const key = cnAlertLevel(item.alertLevel);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const orderedSummary = ['报警', '预警', '超设计限值', '待确认', '正常']
    .filter(key => summary[key])
    .map(key => [key, summary[key]] as [string, number]);

  return (
    <FileDataShell
      title="监测异常分析"
      kicker="监测异常"
      intro="读取历史监测库中的监测读数正式表与监测点正式表，不再使用旧演示测点。重点看哪些测点超限、来自哪个文件证据。"
      right={<><b>{items.length}</b><span>异常 / 非正常读数</span></>}
    >
      {error && <section className="fd-error">{error}</section>}
      <section className="fd-stat-grid">
        {orderedSummary.map(([k, v]) => <FileStatCard key={k} title={k} value={v} desc="来自历史监测读数状态字段" />)}
        {!items.length && <FileStatCard title="暂无非正常读数" value="0" desc="如果库中全部为正常状态，会显示为空" />}
      </section>
      <section className="fd-card">
        <h3>异常读数列表</h3>
        <div className="fd-table">
          <div className="fd-tr fd-head"><span>测点</span><span>项目</span><span>时间</span><span>累计变化</span><span>单次变化</span><span>状态</span></div>
          {items.slice(0, 80).map((it: any, idx: number) => (
            <div className="fd-tr" key={it.readingId || `${it.pointCode}-${idx}`}>
              <span>{it.pointCode || '--'}</span>
              <span>{it.monitoringItem || '--'}</span>
              <span>{formatMonitorTime(it.measuredAt)}</span>
              <span>{it.cumulativeChange ?? it.currentValue ?? '--'}</span>
              <span>{it.changeRate ?? '--'}</span>
              <span className="fd-level">{cnAlertLevel(it.alertLevel)}</span>
            </div>
          ))}
        </div>
      </section>
    </FileDataShell>
  );
}




function cleanSourceFileName(value: any) {
  const raw = String(value || '--');
  return raw
    .replace(/( - 副本)+/g, ' - 副本')
    .replace(/(\s*- 副本\s*){2,}/g, ' - 副本')
    .replace(/\s+\./g, '.')
    .trim();
}

function cnDocType(type: any) {
  const raw = String(type || '').trim();
  const lower = raw.toLowerCase();
  if (lower === 'daily_report' || raw === '监测日报') return '监测日报';
  if (lower === 'weekly_report' || raw === '监测周报') return '监测周报';
  if (lower === 'image' || raw === '现场图片') return '现场图片';
  if (lower === 'pdf') return 'PDF文件';
  if (lower === 'xlsx' || lower === 'excel') return 'Excel表格';
  if (lower === 'docx' || lower === 'word') return 'Word文档';
  if (lower === 'source_document') return '源文件登记';
  return raw || '资料文件';
}

function cnEvidenceKind(value: any) {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();
  if (!raw || raw === '--') return '抽取证据';
  if (lower === 'source_document' || raw === '源文件登记') return '源文件登记';
  if (lower === 'monitoring_reading' || raw === '监测读数') return '监测读数';
  if (lower === 'monitoring_point' || raw === '监测点') return '监测点';
  if (lower === 'table_row' || raw === '表格行') return '表格行';
  return raw;
}

function evidenceTextOf(item: any) {
  const text = item?.extractedText || item?.cellText || item?.tableTitle || item?.sectionTitle || '';
  return cleanSourceFileName(text || '证据文本待补');
}

function shortSourceId(value: any) {
  const raw = String(value || '');
  if (!raw) return '--';
  return raw.length > 12 ? `${raw.slice(0, 8)}…${raw.slice(-4)}` : raw;
}

function FileEvidencePage() {
  const { data, error } = useFileApi('/api/evidence?pageSize=80', 0);
  const { data: docs } = useFileApi('/api/documents?pageSize=12', 0);
  const { data: health } = useFileApi('/api/file-health', 10000);
  const { data: alerts } = useFileApi('/api/monitoring/alerts?pageSize=30', 0);

  const items = data?.items || [];
  const docItems = docs?.items || [];
  const alertItems = alerts?.items || [];
  const tables = health?.tables || {};
  const evidenceTotal = tables.extraction_evidence ?? items.length;
  const sourceTotal = tables.source_document ?? docItems.length;

  const sourceIndexItems = items.filter((it: any) => cnEvidenceKind(it.tableTitle || it.sectionTitle) === '源文件登记');
  const readingEvidenceItems = items.filter((it: any) => cnEvidenceKind(it.tableTitle || it.sectionTitle) !== '源文件登记');

  const typeSummary = docItems.reduce((acc: Record<string, number>, d: any) => {
    const key = cnDocType(d.fileType);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <FileDataShell
      title="证据链与源文件"
      kicker="证据链"
      intro="用于回答“这条监测数据从哪来”。当前证据链已能证明源文件入库和异常读数来源短号，但页码/行号级证据仍需要后续从全文页或表格页补强。"
      right={<><b>{evidenceTotal}</b><span>证据链记录</span></>}
    >
      {error && <section className="fd-error">{error}</section>}

      <section className="fd-stat-grid">
        <FileStatCard title="证据链记录" value={evidenceTotal} desc="来自证据链正式表" />
        <FileStatCard title="源文件数量" value={sourceTotal} desc="来自源文件清单" />
        <FileStatCard title="异常读数入口" value={alertItems.length} desc="从监测异常页抽样联动" />
        <FileStatCard title="源文件登记样本" value={sourceIndexItems.length} desc="当前样本多为源文件登记证据" />
      </section>

      <section className="fd-card">
        <h3>证据链状态判读</h3>
        <div className="fd-two">
          <p><b>已能证明：</b>哪些文件进入系统、每条异常读数关联到哪个来源短号、监测点和状态是否能被追溯。</p>
          <p><b>还需补强：</b>页码、表格行号和原始单元格文本当前大量为空，后续应补全文页/表格页抽取结果，才能做到逐行级审计。</p>
        </div>
      </section>

      <section className="fd-card">
        <h3>异常读数追溯入口</h3>
        <p className="fd-hint">这部分比单纯罗列源文件更接近现场使用：先看异常测点，再看它关联到哪个来源短号。</p>
        <div className="fd-table fd-alert-trace">
          <div className="fd-tr fd-head"><span>测点</span><span>项目</span><span>时间</span><span>状态</span><span>来源短号</span></div>
          {alertItems.slice(0, 30).map((it: any, idx: number) => (
            <div className="fd-tr" key={it.readingId || `${it.pointCode}-${idx}`}>
              <span>{it.pointCode || '--'}</span>
              <span>{it.monitoringItem || '--'}</span>
              <span>{formatMonitorTime(it.measuredAt)}</span>
              <span className="fd-level">{cnAlertLevel(it.alertLevel)}</span>
              <span>{shortSourceId(it.sourceId)}</span>
            </div>
          ))}
          {!alertItems.length && <div className="fd-empty">暂无异常读数可追溯</div>}
        </div>
      </section>

      <section className="fd-card">
        <h3>源文件类型概览</h3>
        <div className="fd-chip-row">
          {Object.entries(typeSummary).map(([name, count]) => (
            <span key={name}>{name}：{count as any}</span>
          ))}
          {!Object.keys(typeSummary).length && <span>暂无源文件类型数据</span>}
        </div>
      </section>

      <section className="fd-card">
        <h3>最新源文件</h3>
        <div className="fd-doc-grid">
          {docItems.map((d: any) => (
            <article key={d.sourceId} className="fd-doc-card">
              <div>
                <span className="fd-chip">{cnDocType(d.fileType)}</span>
                <span className="fd-date">{d.documentDate || '--'}</span>
              </div>
              <b>{cleanSourceFileName(d.fileName)}</b>
              <p>{String(d.description || '暂无描述').replace(/daily_report/g, '监测日报').replace(/weekly_report/g, '监测周报').replace(/image/g, '现场图片')}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="fd-card">
        <h3>源文件登记证据样本</h3>
        <p className="fd-hint">当前不再把 80 条源文件登记全部铺开，只保留少量样本，避免页面被重复日报文件淹没。</p>
        <div className="fd-evidence-list compact">
          {sourceIndexItems.slice(0, 12).map((it: any, idx: number) => (
            <article className="fd-evidence-item" key={it.evidenceId || `${it.sourceId}-${idx}`}>
              <div className="fd-evidence-meta">
                <span>{cnEvidenceKind(it.tableTitle || it.sectionTitle)}</span>
                <span>{it.pageNo ? `第 ${it.pageNo} 页` : '页码待补'}</span>
                <span>{it.rowIndex !== null && it.rowIndex !== undefined ? `第 ${it.rowIndex} 行` : '行号待补'}</span>
              </div>
              <b>{evidenceTextOf(it)}</b>
              <p>来源短号：{shortSourceId(it.sourceId)}；置信度：{it.confidence ?? '待补'}</p>
            </article>
          ))}
        </div>
      </section>

      {!!readingEvidenceItems.length && (
        <section className="fd-card">
          <h3>读数级证据样本</h3>
          <div className="fd-evidence-list compact">
            {readingEvidenceItems.slice(0, 12).map((it: any, idx: number) => (
              <article className="fd-evidence-item" key={it.evidenceId || `${it.sourceId}-${idx}`}>
                <div className="fd-evidence-meta">
                  <span>{cnEvidenceKind(it.tableTitle || it.sectionTitle)}</span>
                  <span>{it.pageNo ? `第 ${it.pageNo} 页` : '页码待补'}</span>
                  <span>{it.rowIndex !== null && it.rowIndex !== undefined ? `第 ${it.rowIndex} 行` : '行号待补'}</span>
                </div>
                <b>{evidenceTextOf(it)}</b>
                <p>来源短号：{shortSourceId(it.sourceId)}；置信度：{it.confidence ?? '待补'}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </FileDataShell>
  );
}







function FileDataImportPage() {
  const { data, error } = useFileApi('/api/file-health', 10000);
  const { data: quality } = useFileApi('/api/data-quality/summary', 10000);
  const tables = data?.tables || {};

  const sourceCount = tables.source_document ?? 0;
  const pointCount = tables.monitoring_point ?? 0;
  const readingCount = tables.monitoring_reading ?? 0;
  const evidenceCount = tables.extraction_evidence ?? 0;
  const dailyStageCount = tables.stg_file_daily_report_meta ?? 0;
  const pageStageCount = tables.stg_file_extracted_page ?? 0;
  const qualityStageCount = tables.stg_file_data_quality_issue ?? 0;

  return (
    <FileDataShell
      title="数据接入与映射状态"
      kicker="数据接入"
      intro="展示历史监测库正式表与临时表接入状态，区分真实入库数据、空临时表和待补映射。"
      right={<><b>{readingCount}</b><span>正式监测读数</span></>}
    >
      {error && <section className="fd-error">{error}</section>}
      <section className="fd-stat-grid">
        <FileStatCard title="源文件清单" value={sourceCount} desc="对应现场日报、周报、图片和专项资料" />
        <FileStatCard title="监测点正式表" value={pointCount} desc="已入库测点数量" />
        <FileStatCard title="监测读数正式表" value={readingCount} desc="已入库历史监测读数" />
        <FileStatCard title="证据链正式表" value={evidenceCount} desc="读数来源、页码、表格行等证据" />
        <FileStatCard title="日报临时表" value={dailyStageCount} desc="当前为空时，用源文件清单回退展示" />
        <FileStatCard title="全文页临时表" value={pageStageCount} desc="后续用于全文页、表格页追溯" />
        <FileStatCard title="质量问题临时表" value={qualityStageCount} desc="当前入库质量问题记录" />
        <FileStatCard title="质量问题汇总" value={quality?.totalIssueCount || 0} desc="来自数据质量汇总接口" />
      </section>
      <section className="fd-card">
        <h3>当前接入结论</h3>
        <div className="fd-two">
          <p><b>已完成：</b>源文件、监测点、监测读数、证据链已经进入正式表，可支撑监测异常、源文件和证据链页面。</p>
          <p><b>待补：</b>日报临时表、全文页临时表、质量问题临时表当前可能为空；页面已做回退展示，后续再补全文页和质量问题明细。</p>
        </div>
      </section>
    </FileDataShell>
  );
}




function InterfaceFirstPage({ page = 'overview' }: { page?: string }) {
  const { data, error, fields } = useInterfaceTbmLive(5000);
  const grouped = ifcGroupedFields(fields);
  const currentRing = fields.currentRing || data?.currentRing;
  const quality = data?.decodeQuality || {};
  const qualityText = `已确认 ${quality.confirmed || 0}，已校准 ${quality.scale_checked || 0}，待校准 ${quality.scale_pending || 0}，待解释 ${quality.pending || 0}`;

  const allLiveFields = Object.values(fields || {}) as any[];
  const zeroFieldNames = allLiveFields
    .filter((f: any) => f?.displayValue === 0)
    .map((f: any) => f?.nameCn || IFC_FIELD_META[f?.fieldKey || f?.key || '']?.title || f?.fieldKey || f?.key)
    .filter(Boolean)
    .slice(0, 6);
  const suspiciousFieldNames = allLiveFields
    .filter((f: any) => ifcIsSuspiciousField(f))
    .map((f: any) => f?.nameCn || IFC_FIELD_META[f?.fieldKey || f?.key || '']?.title || f?.fieldKey || f?.key)
    .filter(Boolean)
    .slice(0, 6);
  const usableCount = (quality.confirmed || 0) + (quality.scale_checked || 0);
  const attentionCount = (quality.scale_pending || 0) + (quality.pending || 0);
  const interfaceReadyText = error
    ? '接口异常，暂不能作为现场状态依据'
    : usableCount >= 10
      ? '核心字段已具备展示条件'
      : '部分字段口径仍需补充确认';
  const liveAnalysisCards = [
    {
      title: '现场接口状态',
      value: error ? '异常' : '在线',
      desc: error || `设备 ${data?.deviceId || 'DZ1360'}，采集时间 ${data?.timestamp || '暂无'}`,
      level: error ? 'warn' : 'ok',
    },
    {
      title: '字段可信度',
      value: `${usableCount}/${allLiveFields.length || 31}`,
      desc: `${interfaceReadyText}；待校准或待解释字段 ${attentionCount} 个`,
      level: attentionCount > usableCount ? 'warn' : 'ok',
    },
    {
      title: '当前为 0 的采集字段',
      value: `${zeroFieldNames.length}`,
      desc: zeroFieldNames.length ? zeroFieldNames.join('、') : '当前核心展示字段未发现 0 值集中异常',
      level: zeroFieldNames.length >= 4 ? 'warn' : 'info',
    },
    {
      title: '下一步待补数据',
      value: '环号映射',
      desc: '仍需“现场环号 → DK里程 → 风险源窗口”映射，才能做真实风险联动',
      level: 'info',
    },
  ];


  const visibleGroups = page === 'operation'
    ? ['advance', 'cutter', 'chamberPressure', 'propelPressure', 'tailGap']
    : page === 'slurry'
      ? ['slurry', 'grouting', 'chamberPressure']
      : page === 'segment'
        ? ['segment', 'tailGap', 'advance']
        : page === 'system'
          ? ['basic', 'advance', 'cutter', 'chamberPressure', 'slurry', 'tailGap', 'propelPressure', 'grouting', 'segment']
          : ['basic', 'advance', 'chamberPressure', 'tailGap', 'slurry'];

  const pageTitle = page === 'operation'
    ? '施工参数诊断'
    : page === 'slurry'
      ? '泥水与注浆分析'
      : page === 'segment'
        ? '管片拼装与盾尾状态'
        : page === 'system'
          ? '现场实测数据状态'
          : '盾构机实时总览';

  const pageIntro = page === 'operation'
    ? '围绕实时接口中的推进、刀盘、仓压、分区压力做组合研判；待校准字段只展示，不参与异常判断。'
    : page === 'slurry'
      ? '展示进出浆密度、流量、压力和注浆总量。部分比例未最终确认时，页面会明确标注。'
      : page === 'segment'
        ? '展示管片拼装位置码、盾尾间隙和推进状态。位置码未有正式字典前不强行翻译。'
        : page === 'system'
          ? '展示现场实测接口是否在线、原始寄存器数量、字段可信度和字段分组。'
          : '首页以现场接口为准，优先展示实时环号、推进、仓压、盾尾间隙和泥浆等现场采集数据。';

  return (
    <main className="if-page">
      <section className="if-hero">
        <div>
          <span className="if-kicker">现场实测数据</span>
          <h1>{pageTitle}</h1>
          <p>{pageIntro}</p>
        </div>
        <div className="if-live-state">
          <span className={error ? 'offline' : 'online'}>{error ? '接口异常' : '在线采集'}</span>
          <b>{ifcFieldValue(currentRing)}</b>
          <em>现场环号 / {data?.deviceId || 'DZ1360'}</em>
        </div>
      </section>

      <section className="if-summary-row">
        <IfcMetricCard title="现场环号" field={currentRing} hint="以现场接口当前环号为准" />
        <IfcMetricCard title="推进速度" field={fields.advanceSpeed} />
        <IfcMetricCard title="贯入度" field={fields.penetration} />
        <IfcMetricCard title="仓压1#" field={fields.chamberPressure1} />
        <IfcMetricCard title="盾尾间隙1#" field={fields.shieldTailGap1} />
      </section>

      <section className="if-status-strip">
        <span>设备：<b>{data?.deviceId || 'DZ1360'}</b></span>
        <span>采集时间：<b>{data?.timestamp || error || '暂无'}</b></span>
        <span>原始寄存器：<b>{data?.rawLength || '--'} / 3250</b></span>
        <span>字段质量：<b>{qualityText}</b></span>
      </section>

      <section className="if-analysis-row">
        {liveAnalysisCards.map((item) => (
          <article key={item.title} className={`if-analysis-card ${item.level}`}>
            <span>{item.title}</span>
            <b>{item.value}</b>
            <p>{item.desc}</p>
          </article>
        ))}
      </section>

      <section className="if-process-card">
        <div>
          <b>现场实测数据接入链路</b>
          <p>现场采集程序 → 接收服务 → 平台后端 → 页面分组展示。当前页面只展示接口实际返回字段，未接入或待确认字段会明确标注。</p>
        </div>
        <div className="if-process-steps">
          <span>采集</span><i />
          <span>接收</span><i />
          <span>解码</span><i />
          <span>展示</span>
        </div>
      </section>

      <div className="if-layout">
        <section className="if-main">
          {visibleGroups.map(key => (
            <IfcGroupPanel key={key} title={IFC_GROUP_TITLES[key] || key} fields={grouped[key] || []} />
          ))}
        </section>

        <aside className="if-side">
          <section className="if-card">
            <h3>接口能展示哪些数据</h3>
            <ul className="if-list">
              <li>基础进度：当前环号、液压油温</li>
              <li>推进系统：推进速度、贯入度、总推力、推进泵压力</li>
              <li>刀盘主驱动：转速、转矩、角度、状态码</li>
              <li>开挖仓压力：仓压 1#~3#</li>
              <li>泥浆环路：进出浆密度、流量、压力</li>
              <li>盾尾与管片：盾尾间隙、管片位置码</li>
            </ul>
          </section>

          <section className="if-card">
            <h3>当前还缺什么</h3>
            <p>接口只给现场环号和设备参数，暂未提供“现场环号 → DK里程 → 风险源窗口”的映射表，所以风险复盘不能假装已经真实联动。</p>
            <p>状态码字段如刀盘状态、推进状态、管片位置码需要正式字典后才能中文解释。</p>
            <div className="if-missing-list">
              <span>环号-里程映射表</span>
              <span>风险源窗口表</span>
              <span>状态码字典</span>
              <span>待校准字段比例说明</span>
            </div>
          </section>

          <section className="if-card">
            <h3>字段使用规则</h3>
            <p><b>已确认 / 已校准：</b>可进入核心指标。</p>
            <p><b>比例待校准：</b>可展示，但不参与异常判断。</p>
            <p><b>待解释：</b>只显示原始码，不强行翻译。</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

function CommandOverview({ selectedRing, setSelectedRing }: { selectedRing:number; setSelectedRing:(n:number)=>void }) {
  const [dataMode, setDataMode] = useState<'real'|'demo'|'mixed'>('demo');
  const [showEvidence, setShowEvidence] = useState(false);
  const [serverOverview, setServerOverview] = useState<AnyObj | null>(null);
  const [serverRisks, setServerRisks] = useState<any[]>([]);

  const [tbmSummary, setTbmSummary] = useState<any | null>(null);
  const [tbmError, setTbmError] = useState<string>('');

  useEffect(() => {
    let alive = true;
    async function loadTbm() {
      try {
        const res: any = await fetchTbmFrontendSummarySafe();
        const data = res?.data || res;
        if (alive) { setTbmSummary(data); setTbmError(''); }
      } catch (error: any) {
        if (alive) setTbmError(error?.message || '盾构机 实时接口暂不可用');
      }
    }
    loadTbm();
    const timer = window.setInterval(loadTbm, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);


  useEffect(() => {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    if (path !== '/') return;
    const url = new URL(window.location.href);
    url.searchParams.set('ring', String(selectedRing));
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, [selectedRing]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiGetV3(`/analysis/dashboard?ring_no=${selectedRing}`).catch(() => null),
      apiGet(`/risk-sources?ring_no=${selectedRing}`).catch(() => null),
    ]).then(([overview, risks]: any[]) => {
      if (!mounted) return;
      setServerOverview(overview && Object.keys(overview).length ? overview : null);
      setServerRisks(safeArray(risks?.items));
      const hasOverview = !!overview && Object.keys(overview).length > 0;
      const hasRisks = safeArray(risks?.items).length > 0;
      setDataMode(hasOverview || hasRisks ? (hasOverview && hasRisks ? 'real' : 'mixed') : 'demo');
    });
    return () => { mounted = false; };
  }, [selectedRing]);

  const routeMapPoints = useMemo(() => [
    { x: 48.0, y: 15.5, ring: 250 },
    { x: 46.5, y: 27.0, ring: 280 },
    { x: 45.0, y: 39.0, ring: 310 },
    { x: 47.5, y: 51.0, ring: 336 },
    { x: 56.0, y: 59.0, ring: 361 },
    { x: 70.0, y: 64.0, ring: 392 },
  ], []);

  const routeProfilePoints = useMemo(() => [
    { x: 5.5, y: 68.0, ring: 250 },
    { x: 20.0, y: 63.5, ring: 270 },
    { x: 34.0, y: 74.0, ring: 300 },
    { x: 52.0, y: 68.0, ring: 336 },
    { x: 70.0, y: 77.5, ring: 361 },
    { x: 94.0, y: 60.0, ring: 392 },
  ], []);

  const allOperations = useMemo(() => buildDemoOperations(ringMin, ringMax), []);
  const allRisks = useMemo(() => ensureItems(serverRisks, buildDemoRiskSources()), [serverRisks]);

  const selectedMileageM = demoMileageForRing(selectedRing);
  const selectedMileage = km(selectedMileageM);
  const currentRingNo = Number(serverOverview?.currentRing?.ringNo || 336);
  const currentMileage = serverOverview?.currentRing?.mileage || km(demoMileageForRing(currentRingNo));
  const selectedOp = allOperations.find(x => Number(x.ringNo) === Number(selectedRing)) || allOperations[0];

  const tbmMetrics = tbmSummary?.metrics || {};
  const tbmField = (key: string) => tbmMetrics?.[key] || tbmSummary?.fields?.[key] || null;
  const metricText = (key: string, fallback: any, fallbackUnit: string) => {
    const f = tbmField(key);
    return { val: f?.displayValue ?? fallback ?? '--', unit: f?.unit ?? fallbackUnit ?? '', status: f?.status || f?.decodeStatus || '', label: f?.qualityLabel || '' };
  };
  const liveAdvanceSpeed = metricText('advanceSpeed', selectedOp?.advanceSpeed, 'mm/min');
  const liveFacePressure = metricText('chamberPressure1', selectedOp?.facePressure, 'bar');
  const liveTotalThrust = metricText('totalThrust', selectedOp?.totalThrust ? Math.round(selectedOp.totalThrust / 1000) : '--', 'kN');
  const livePenetration = metricText('penetration', '--', 'mm/r');
  const liveCutterTorque = metricText('cutterTorque', '--', '');
  const liveTailGap1 = metricText('shieldTailGap1', '--', 'mm');
  const plcCurrentRing = tbmSummary?.currentRing?.displayValue ?? tbmField('currentRing')?.displayValue ?? null;
  const plcOnline = !!tbmSummary && !tbmError && !!tbmSummary?.deviceId;
  const plcWarnings = safeArray(tbmSummary?.qualityWarnings);
  const plcQualityNotice = plcWarnings.length > 0 ? `有 ${plcWarnings.length} 个字段待校准或待解释，暂不参与异常判断` : '';
  const liveRingNo = plcCurrentRing ? Number(plcCurrentRing) : selectedRing;
  const liveWindowMin = plcCurrentRing ? Math.max(1, Number(plcCurrentRing) - 80) : ringMin;
  const liveWindowMax = plcCurrentRing ? Number(plcCurrentRing) + 20 : ringMax;
  const liveMileageLabel = plcCurrentRing ? '里程待映射' : selectedMileage;

  useEffect(() => {
    if (plcCurrentRing && Number(selectedRing) !== Number(plcCurrentRing)) {
      setSelectedRing(Number(plcCurrentRing));
    }
  }, [plcCurrentRing]);

  const liveDemoRingSeparated = plcCurrentRing && Number(plcCurrentRing) !== Number(selectedRing);


  const activeRisk = allRisks.find((r:any) => {
    const m = selectedMileageM;
    return m >= Number(r.startMileageM || 0) - 80 && m <= Number(r.endMileageM || 0) + 120;
  }) || null;

  const nearestRisk = activeRisk || allRisks
    .map((r:any) => ({ r, d: Math.min(Math.abs(selectedMileageM - Number(r.startMileageM || 0)), Math.abs(selectedMileageM - Number(r.endMileageM || 0))) }))
    .sort((a:any,b:any) => a.d - b.d)[0]?.r || null;

  const section = {
    projectName: serverOverview?.section?.projectName || '新建南通至宁波高速铁路站前Ⅰ标',
    sectionName: serverOverview?.section?.sectionName || '苏州东隧道盾构区间',
    startMileage: serverOverview?.section?.startMileage || 'DK53+695',
    endMileage: serverOverview?.section?.endMileage || 'DK59+129',
  };

  function pointFromRing(points: {x:number;y:number;ring:number}[], ringNo: number) {
    // V3.11.4: The old 250-392 route is only a visual coordinate scaffold.
    // The displayed ring range now comes from the live PLC interface window.
    const sourceMin = points[0].ring;
    const sourceMax = points[points.length - 1].ring;
    const viewMin = liveWindowMin;
    const viewMax = liveWindowMax;
    const clampedViewRing = clamp(Number(ringNo), viewMin, viewMax);
    const ratio = (clampedViewRing - viewMin) / ((viewMax - viewMin) || 1);
    const safeRing = sourceMin + ratio * (sourceMax - sourceMin);

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (safeRing >= a.ring && safeRing <= b.ring) {
        const t = (safeRing - a.ring) / (b.ring - a.ring);
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
    }
    return safeRing <= points[0].ring ? points[0] : points[points.length - 1];
  }


  function ringFromLayerPoint(points: {x:number;y:number;ring:number}[], px: number, py: number) {
    let best = { ring: selectedRing, dist: Number.POSITIVE_INFINITY };
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const wx = px - a.x;
      const wy = py - a.y;
      const len2 = vx * vx + vy * vy || 1;
      const t = clamp((wx * vx + wy * vy) / len2, 0, 1);
      const cx = a.x + t * vx;
      const cy = a.y + t * vy;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist < best.dist) {
        best = { ring: Math.round(a.ring + t * (b.ring - a.ring)), dist };
      }
    }
    const sourceMin = points[0].ring;
    const sourceMax = points[points.length - 1].ring;
    const ratio = (best.ring - sourceMin) / ((sourceMax - sourceMin) || 1);
    return clamp(Math.round(liveWindowMin + ratio * (liveWindowMax - liveWindowMin)), liveWindowMin, liveWindowMax);
  }

  function handleLayerPointer(event: any, layer: 'map'|'profile') {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const nextRing = ringFromLayerPoint(layer === 'map' ? routeMapPoints : routeProfilePoints, x, y);
    if (nextRing !== selectedRing) setSelectedRing(nextRing);
  }

  const selectedMapPoint = pointFromRing(routeMapPoints, selectedRing);
  const selectedProfilePoint = pointFromRing(routeProfilePoints, selectedRing);
  const currentMapPoint = pointFromRing(routeMapPoints, currentRingNo);
  const currentProfilePoint = pointFromRing(routeProfilePoints, currentRingNo);
  const mapPolyline = routeMapPoints.map(p => `${p.x},${p.y}`).join(' ');
  const profilePolyline = routeProfilePoints.map(p => `${p.x},${p.y}`).join(' ');

  const riskBands = allRisks.map((r:any) => {
    const startRing = ringFromMileageM(Number(r.startMileageM));
    const endRing = ringFromMileageM(Number(r.endMileageM));
    const a = pointFromRing(routeProfilePoints, startRing);
    const b = pointFromRing(routeProfilePoints, endRing);
    return { ...r, startRing, endRing, a, b };
  });

  const linkedFindings = [
    {
      title: '以现场实时接口为准',
      evidence: plcOnline
        ? `现场采集环号 ${plcCurrentRing ?? '--'} 环，设备 ${tbmSummary?.deviceId || 'DZ1360'}，数据时间 ${tbmSummary?.timestamp || '--'}。`
        : `现场实时接口暂不可用，页面仅保留演示流程。`,
      suggestion: '当前首页环号、底部条和设备参数已优先跟随现场接口；旧的 250~392 范围不再作为真实依据。',
    },
    {
      title: '实时施工参数',
      evidence: `仓压1# ${liveFacePressure.val} ${liveFacePressure.unit || 'bar'}；推进速度 ${liveAdvanceSpeed.val} ${liveAdvanceSpeed.unit || 'mm/min'}；总推力 ${liveTotalThrust.val} ${liveTotalThrust.unit || 'kN'}。`,
      suggestion: '推进速度、总推力为 0 时先按“当前采集值”展示，不直接判异常；待字段口径确认后再进入规则判断。',
    },
    {
      title: '风险源联动等待真实映射',
      evidence: plcOnline
        ? `当前只有现场环号 ${plcCurrentRing}，还缺少“现场环号 → DK里程 / 风险源窗口”的映射表。`
        : '实时环号暂不可用，无法进行真实风险源联动。',
      suggestion: '请补充 PLC 环号、工程里程、风险源窗口三者的映射关系；拿到后再恢复风险复盘自动判断。',
    },
  ];

  const pressureOption = useMemo(() => {
    const [start, end] = rangeAround(selectedRing, 35);
    const local = allOperations.filter(x => x.ringNo >= start && x.ringNo <= end);
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 18, top: 30, bottom: 28 },
      xAxis: { type: 'value', min: start, max: end, axisLabel: { color: '#93bad6', formatter: (v:number) => `${v}环` }, splitLine: { lineStyle: { color: 'rgba(120,210,255,.10)' } } },
      yAxis: { type: 'value', axisLabel: { color: '#93bad6' }, splitLine: { lineStyle: { color: 'rgba(120,210,255,.12)' } } },
      series: [
        { name: '切口压力', type: 'line', smooth: true, data: local.map(x => [x.ringNo, x.facePressure]), lineStyle: { width: 3 }, areaStyle: { opacity: .12 } },
        { name: '查看环', type: 'line', data: [[selectedRing, 0], [selectedRing, 1]], lineStyle: { color: '#ffd76b', type: 'dashed', width: 2 }, symbol: 'none', tooltip: { show: false } },
      ],
    };
  }, [allOperations, selectedRing]);

  const comboOption = useMemo(() => {
    const [start, end] = rangeAround(selectedRing, 35);
    const local = allOperations.filter(x => x.ringNo >= start && x.ringNo <= end);
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { textStyle: { color: '#badfff' }, top: 0 },
      grid: { left: 42, right: 52, top: 38, bottom: 28 },
      xAxis: { type: 'value', min: start, max: end, axisLabel: { color: '#93bad6', formatter: (v:number) => `${v}环` }, splitLine: { lineStyle: { color: 'rgba(120,210,255,.10)' } } },
      yAxis: [
        { type: 'value', axisLabel: { color: '#93bad6' }, splitLine: { lineStyle: { color: 'rgba(120,210,255,.12)' } } },
        { type: 'value', axisLabel: { color: '#93bad6' }, splitLine: { show: false } },
      ],
      series: [
        { name: '推力(x1000)', type: 'line', smooth: true, data: local.map(x => [x.ringNo, +(x.totalThrust / 1000).toFixed(2)]) },
        { name: '扭矩(x1000)', type: 'line', smooth: true, data: local.map(x => [x.ringNo, +(x.cutterTorque / 1000).toFixed(2)]) },
        { name: '速度', type: 'bar', yAxisIndex: 1, data: local.map(x => [x.ringNo, x.advanceSpeed]), opacity: .46 },
      ],
    };
  }, [allOperations, selectedRing]);

  return (
    <main className="v10-overview">
      <section className="v10-stage">
        <div className="v10-map-bg" />
        <svg className="v10-map-layer" viewBox="0 0 100 100" preserveAspectRatio="none" onMouseMove={(e)=>handleLayerPointer(e,'map')} onClick={(e)=>handleLayerPointer(e,'map')}>
          <polyline className="v10-route-glow" points={mapPolyline} />
          <polyline className="v10-route-main" points={mapPolyline} />
          {routeMapPoints.map((p:any)=><circle key={p.ring} className="v10-route-node" cx={p.x} cy={p.y} r="0.85" />)}
          <line className="v10-current-line" x1={currentMapPoint.x} y1="4" x2={currentMapPoint.x} y2="98" />
          <circle className="v10-current-dot" cx={currentMapPoint.x} cy={currentMapPoint.y} r="1.25" />
          <line className="v10-selected-line" x1={selectedMapPoint.x} y1="4" x2={selectedMapPoint.x} y2="98" />
          <circle className="v10-selected-pulse" cx={selectedMapPoint.x} cy={selectedMapPoint.y} r="3.1" />
          <circle className="v10-selected-dot" cx={selectedMapPoint.x} cy={selectedMapPoint.y} r="1.65" />
          <text className="v10-selected-text" x={selectedMapPoint.x + 1.5} y={selectedMapPoint.y - 4}>{selectedRing}环</text>
        </svg>

        <div className="v10-map-title">
          <b>通苏嘉甬 · 苏州东隧道</b>
          <span>指挥总览 / 环号联动研判</span>
        </div>

        <div className="v10-profile-bg" />
        <svg className="v10-profile-layer" viewBox="0 0 100 100" preserveAspectRatio="none" onMouseMove={(e)=>handleLayerPointer(e,'profile')} onClick={(e)=>handleLayerPointer(e,'profile')}>
          {riskBands.map((r:any)=>(
            <g key={r.riskSourceId || r.riskName}>
              <line className={`v10-risk-window ${r.riskLevel === 'high' ? 'important' : '正常'}`} x1={r.a.x} y1={r.a.y} x2={r.b.x} y2={r.b.y}/>
            </g>
          ))}
          <polyline className="v10-profile-route" points={profilePolyline} />
          {routeProfilePoints.map((p:any)=><circle key={p.ring} className="v10-route-node" cx={p.x} cy={p.y} r="0.9" />)}
          <line className="v10-current-line" x1={currentProfilePoint.x} y1="0" x2={currentProfilePoint.x} y2="100" />
          <circle className="v10-current-dot" cx={currentProfilePoint.x} cy={currentProfilePoint.y} r="1.4" />
          <line className="v10-selected-line" x1={selectedProfilePoint.x} y1="0" x2={selectedProfilePoint.x} y2="100" />
          <circle className="v10-selected-pulse" cx={selectedProfilePoint.x} cy={selectedProfilePoint.y} r="3.8" />
          <circle className="v10-selected-dot" cx={selectedProfilePoint.x} cy={selectedProfilePoint.y} r="1.9" />
          <text className="v10-selected-profile-text" x={selectedProfilePoint.x + 1.5} y={Math.max(9, selectedProfilePoint.y - 5)}>{selectedRing}环 / {liveMileageLabel}</text>
        </svg>

        <div className="v10-help-chip">在地图线路或纵断面附近移动鼠标 / 点击：底图光标、底部环号条、两侧研判同步</div>
      </section>

      <aside className="side-panel left-panel v10-left">
        <h2>工程状态 <DemoTag real={dataMode === 'real'} /></h2>
        <dl>
          <dt>项目</dt><dd>{section.projectName}</dd>
          <dt>区间</dt><dd>{section.sectionName}</dd>
          <dt>范围</dt><dd>{section.startMileage} ~ {section.endMileage}</dd>
          <dt>演示基准</dt><dd>{currentRingNo}环 / {currentMileage}</dd>
          <dt>现场环号</dt><dd className="gold">{plcCurrentRing ? `${plcCurrentRing}环 / DZ1360` : '等待采集'}<small className="plc-ring-note">首页以该接口为准</small></dd>
          <dt>数据时间</dt><dd>{tbmSummary?.timestamp || tbmError || '暂无'}</dd>
          <dt>显示环号</dt><dd className="gold">{selectedRing}环 / {liveMileageLabel}</dd>
        </dl>
        <div className="metric-row">
          <div><span>推进速度</span><b>{liveAdvanceSpeed.val}</b><em>{liveAdvanceSpeed.unit || 'mm/min'}</em></div>
          <div><span>仓压1#</span><b>{liveFacePressure.val}</b><em>{liveFacePressure.unit || 'bar'}</em></div>
          <div><span>总推力</span><b>{liveTotalThrust.val}</b><em>{liveTotalThrust.unit || 'kN'}</em></div>
        </div>
        <div className="source-status">
          <b>实时数据接入</b>
          <p>现场采集接口已接入；左侧关键参数和右侧设备卡片优先展示实时数据，演示数据保留明确标注。</p>
        </div>
      </aside>

      <aside className="side-panel right-panel v10-right">
        <h2>当前联动研判 <DemoTag real={dataMode === 'real'} /></h2>
        <div className="risk-badge">
          <span>现场数据状态</span>
          <b>{plcOnline ? '实时接入' : '等待采集'}</b>
          <em>以现场接口为准 / 风险映射待补</em>
        </div>
        <div className={`tbm-live-card ${plcOnline ? 'online' : 'offline'}`}>
          <div className="tbm-live-head"><b>盾构机实时参数</b><span>{plcOnline ? '在线采集' : '等待接口'}</span></div>
          <p>设备 {tbmSummary?.deviceId || 'DZ1360'} · {tbmSummary?.timestamp || tbmError || '暂无实时数据'}</p>
          {liveDemoRingSeparated && <p className="live-demo-separate-note">首页已改为跟随现场接口；里程和风险源仍等待映射表。</p>}
          <div className="tbm-live-grid">
            <span>实时环号 <b>{plcCurrentRing ?? '--'}</b></span>
            <span>贯入度 <b>{livePenetration.val}</b><em>{livePenetration.unit}</em></span>
            <span>刀盘转矩 <b>{liveCutterTorque.val}</b><em>{liveCutterTorque.unit}</em></span>
            <span>盾尾间隙1# <b>{liveTailGap1.val}</b><em>{liveTailGap1.unit}</em></span>
          </div>
          {plcQualityNotice && <em className="tbm-预警">{plcQualityNotice}</em>}
        </div>
        <h3>联动发现</h3>
        <div className="findings">
          {linkedFindings.map((f:any,i:number)=><article key={i}><b>{f.title}</b><p>{f.evidence}</p><span>{f.suggestion}</span></article>)}
        </div>
        <div className="overview-linkage-panel">
          <h3>联动研判入口</h3>
          <p>以下页面都带着当前查看环 {selectedRing} 环进入，不再各看各的。</p>
          <div>
            <a href="/risk-replay">风险复盘</a>
            <a href="/monitoring-alerts">监测异常</a>
            <a href="/operation-diagnosis">参数诊断</a>
            <a href="/slurry-grouting">泥水注浆</a>
            <a href="/segment-quality">管片质量</a>
            <a href="/event-closure">事件闭环</a>
          </div>
        </div>
      </aside>

      <div className="thin-timeline v10-timeline">
        <span>{liveWindowMin}环</span>
        <input min={liveWindowMin} max={liveWindowMax} type="range" value={selectedRing} onChange={e=>setSelectedRing(Number(e.target.value))}/>
        <span>{liveWindowMax}环</span>
        <button onClick={()=>setSelectedRing(liveRingNo)}>回到现场环号</button>
        <button className={showEvidence?'active':''} onClick={()=>setShowEvidence(!showEvidence)}>{showEvidence?'收起图证':'展开图证'}</button>
      </div>

      {showEvidence && <section className="evidence-drawer v10-evidence">
        <div><h3>当前环邻域切口压力</h3><ReactECharts option={pressureOption} style={{height:210}} notMerge /></div>
        <div><h3>推力-扭矩-速度组合</h3><ReactECharts option={comboOption} style={{height:210}} notMerge /></div>
      </section>}
    </main>
  );
}


function ProjectBookPage() {
  const riskSources = buildDemoRiskSources();
  const difficult = [
    { name:'大', text:'14.81m 超大直径盾构，对掌子面压力、推力、扭矩、姿态控制要求高。' },
    { name:'长', text:'盾构区间约 5.434km，长距离独头掘进，需要设备可靠性和维保闭环。' },
    { name:'深', text:'最大埋深约 58m，最大水土压力超过 6bar，高水压下密封和稳定性要求高。' },
    { name:'险', text:'穿越铁路、地铁、道路、河湖、居民区和厂房，风险源密集。' },
  ];

  const riskPie = {
    backgroundColor:'transparent',
    tooltip:{trigger:'item'},
    legend:{bottom:0,textStyle:{color:'#c9eaff'}},
    series:[{type:'pie',radius:['42%','70%'],data:[
      {name:'铁路/城际',value:2},{name:'地铁/车站',value:1},{name:'居民区/厂房',value:4},{name:'道路/湖泊',value:2},
    ]}],
  };

  const chain = [
    ['项目概况','project / tunnel_section','总览标题、区间范围、长度、埋深'],
    ['风险源表','risk_source','地图风险窗口、穿越复盘、关注等级'],
    ['环号-里程-日期','ring_mileage_map','把当前环、风险源、监测点、参数串起来'],
    ['监测方案/日报','监测点正式表 / reading','沉降曲线、阈值、报警联动'],
    ['掘进环报/PLC','shield_ring_operation','压力、推力、扭矩、速度诊断'],
    ['泥水注浆记录','slurry_record / grouting_record','沉降归因、掌子面稳定、盾尾风险'],
    ['管片拼装记录','segment_installation_record','错台、破损、渗漏、结构质量'],
    ['事件处置记录','event_log','报警复盘、处置闭环、责任追踪'],
  ];

  return (
    <main className="work-page readable-page">
      <section className="page-hero"><div><p>Project Book</p><h1>项目书驱动的系统设计 <DemoTag /></h1><span>这页把“施工方案里的工程重点”翻译成平台页面、数据表和分析逻辑。</span></div><b>大·长·深·险</b></section>
      <section className="analysis-grid-2">
        <div className="chart-panel"><h3>项目书中的工程重难点</h3><div className="book-risk-grid">{difficult.map(x=><article key={x.name}><b>{x.name}</b><p>{x.text}</p></article>)}</div></div>
        <div className="chart-panel"><h3>风险源类型构成</h3><ReactECharts option={riskPie} style={{height:300}} notMerge /></div>
      </section>
      <section className="single-panel">
        <h2>从项目书到 历史监测库 / 页面功能</h2>
        <div className="mapping-table">
          <div className="map-head"><b>项目书资料</b><b>入库对象</b><b>平台功能</b></div>
          {chain.map((row,i)=><div key={i}><span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span></div>)}
        </div>
      </section>
      <section className="single-panel">
        <h2>当前 demo 不应只做 3 页，而应覆盖 8 条业务线</h2>
        <div className="evidence-cards">{['总览','项目书依据','风险穿越','监测异常','参数诊断','泥水注浆','管片质量','事件闭环','数据接入','系统状态'].map(x=><article key={x}><b>{x}</b><p>围绕当前环号、风险源窗口、时间和证据来源形成联动。</p></article>)}</div>
      </section>
    </main>
  );
}

function buildReplaySeriesForRisk(risk: AnyObj | null, base: any[]) {
  const start = ringFromMileageM(risk?.startMileageM), end = ringFromMileageM(risk?.endMileageM), center = (start+end)/2;
  const riskWeight = risk?.riskLevel === 'high' ? 1.25 : risk?.riskLevel === 'medium' ? .85 : .55;
  return base.map(x => {
    const d = Math.abs(Number(x.ringNo)-center);
    const influence = Math.max(0, 1-d/45)*riskWeight;
    const inside = Number(x.ringNo)>=start && Number(x.ringNo)<=end;
    return { ...x, facePressure:+(Number(x.facePressure)+influence*.055+(inside?.025:0)).toFixed(3), totalThrust:Math.round(Number(x.totalThrust)+influence*2800+(inside?1200:0)), advanceSpeed:+Math.max(1.6, Number(x.advanceSpeed)-influence*.35-(inside?.18:0)).toFixed(2), settlement:+(-4-influence*10-Math.max(0, Number(x.ringNo)-start)*.025).toFixed(2), influence:+influence.toFixed(3) };
  });
}

function segmentStats(series:any[], risk:AnyObj|null) {
  const start=ringFromMileageM(risk?.startMileageM), end=ringFromMileageM(risk?.endMileageM);
  const before=series.filter(x=>x.ringNo>=start-50&&x.ringNo<start), inside=series.filter(x=>x.ringNo>=start&&x.ringNo<=end), after=series.filter(x=>x.ringNo>end&&x.ringNo<=end+100);
  return [
    {key:'before',name:'穿越前50m',range:`${start-50}~${start-1}环`,pressure:avg(before,'facePressure'),speed:avg(before,'advanceSpeed'),thrust:avg(before,'totalThrust'),settlement:avg(before,'settlement')},
    {key:'inside',name:'风险窗口内',range:`${start}~${end}环`,pressure:avg(inside,'facePressure'),speed:avg(inside,'advanceSpeed'),thrust:avg(inside,'totalThrust'),settlement:avg(inside,'settlement')},
    {key:'after',name:'穿越后100m',range:`${end+1}~${end+100}环`,pressure:avg(after,'facePressure'),speed:avg(after,'advanceSpeed'),thrust:avg(after,'totalThrust'),settlement:avg(after,'settlement')},
  ];
}

function RiskReplay({ selectedRing }: { selectedRing:number }) {
  const [riskSources,setRiskSources]=useState<any[]>(buildDemoRiskSources());
  const [active,setActive]=useState<any>(buildDemoRiskSources()[0]);
  const [baseTrend,setBaseTrend]=useState<any[]>(buildDemoOperations());
  const [mode,setMode]=useState<'real'|'demo'|'mixed'>('demo');

  useEffect(()=>{ Promise.all([apiGet(`/risk-sources?ring_no=${selectedRing}`).catch(()=>null), apiGet(`/shield/ring-operations?start_ring=250&end_ring=392`).catch(()=>null)]).then(([r,d]:any[])=>{
    const risks=ensureItems(safeArray(r?.items),buildDemoRiskSources()), ops=ensureItems(safeArray(d?.items),buildDemoOperations());
    setRiskSources(risks); setActive((prev:AnyObj)=>risks.find((x:AnyObj)=>x.riskSourceId===prev?.riskSourceId)||risks[0]); setBaseTrend(ops);
    setMode(safeArray(r?.items).length && safeArray(d?.items).length ? 'real' : safeArray(r?.items).length || safeArray(d?.items).length ? 'mixed' : 'demo');
  }); },[selectedRing]);

  const replaySeries=useMemo(()=>buildReplaySeriesForRisk(active,baseTrend),[active,baseTrend]);
  const startRing=ringFromMileageM(active?.startMileageM), endRing=ringFromMileageM(active?.endMileageM);
  const stats=useMemo(()=>segmentStats(replaySeries,active),[replaySeries,active]);
  const inside:any=stats[1]||{}, before:any=stats[0]||{};
  const pressureDrift=before.pressure?drift(inside.pressure,before.pressure):null;
  const speedDrift=before.speed?drift(inside.speed,before.speed):null;

  const trendOption=useMemo(()=>({
    backgroundColor:'transparent', tooltip:{trigger:'axis'}, legend:{textStyle:{color:'#c9eaff'},top:0}, grid:{left:54,right:54,top:46,bottom:36},
    xAxis:{type:'value',min:Math.max(ringMin,startRing-60),max:Math.min(ringMax,endRing+110),axisLabel:{color:'#93bad6',formatter:(v:number)=>`${v}环`},splitLine:{lineStyle:{color:'rgba(120,210,255,.10)'}}},
    yAxis:[{type:'value',name:'压力/速度',axisLabel:{color:'#93bad6'},splitLine:{lineStyle:{color:'rgba(120,210,255,.12)'}}},{type:'value',name:'沉降mm',axisLabel:{color:'#93bad6'},splitLine:{show:false}}],
    series:[
      {name:'切口压力 bar',type:'line',smooth:true,data:replaySeries.map(x=>[x.ringNo,x.facePressure]),markArea:{silent:true,itemStyle:{color:'rgba(255,215,106,.12)'},data:[[{xAxis:startRing,name:'风险窗口'},{xAxis:endRing}]]}},
      {name:'推进速度 mm/min',type:'line',smooth:true,data:replaySeries.map(x=>[x.ringNo,x.advanceSpeed])},
      {name:'累计沉降 mm',type:'line',yAxisIndex:1,smooth:true,data:replaySeries.map(x=>[x.ringNo,x.settlement])},
      {name:'查看环',type:'line',data:[[selectedRing,-30],[selectedRing,6]],lineStyle:{color:'#ffd76b',type:'dashed',width:2},symbol:'none',tooltip:{show:false}},
    ],
  }),[replaySeries,selectedRing,startRing,endRing]);

  const segmentOption=useMemo(()=>({backgroundColor:'transparent',tooltip:{trigger:'axis'},legend:{textStyle:{color:'#c9eaff'}},grid:{left:44,right:30,top:42,bottom:34},xAxis:{type:'category',data:stats.map(x=>x.name),axisLabel:{color:'#93bad6'}},yAxis:{type:'value',axisLabel:{color:'#93bad6'},splitLine:{lineStyle:{color:'rgba(120,210,255,.12)'}}},series:[{name:'平均压力',type:'bar',data:stats.map(x=>x.pressure)},{name:'平均速度',type:'bar',data:stats.map(x=>x.speed)},{name:'沉降均值(abs)',type:'bar',data:stats.map(x=>x.settlement==null?null:Math.abs(x.settlement))}]}),[stats]);

  return (
    <main className="work-page readable-page">
      <section className="page-hero"><div><p>Risk Replay</p><h1>风险源穿越复盘 <DemoTag real={mode==='real'} /></h1><span>看某个风险源“穿越前、窗口内、穿越后”的参数和监测响应是否异常。</span></div><b>{riskSources.length} 个风险源</b></section>
      <section className="work-grid risk-work-grid">
        <aside className="list-panel chinese-list">{riskSources.map(r=><button key={r.riskSourceId} className={active?.riskSourceId===r.riskSourceId?'active':''} onClick={()=>setActive(r)}><b>{r.riskName}</b><span>{r.crossingRelation}：{r.startMileage} ~ {r.endMileage}</span><em>{statusZh(r.status)} / {statusZh(r.riskLevel)}</em></button>)}</aside>
        <section className="detail-panel readable-detail">
          <div className="detail-title"><div><h2>{active?.riskName}</h2><span>{active?.crossingRelation} / {active?.riskType} / 影响窗口约 {startRing}~{endRing} 环</span></div><DemoTag real={mode==='real'} /></div>
          <div className="explain-strip"><article><b>怎么看</b><p>黄色背景是风险源窗口；虚线是当前查看环。若窗口内压力上升、速度下降、沉降加快，就要重点复核。</p></article><article><b>当前判断</b><p>窗口内压力相对穿越前 {pressureDrift==null?'--':`${pressureDrift}%`}；速度变化 {speedDrift==null?'--':`${speedDrift}%`}。</p></article><article><b>项目书控制点</b><p>{active?.control}</p></article></div>
          <div className="analysis-grid-2"><div className="chart-panel"><h3>穿越窗口趋势图</h3><p className="chart-help">压力、速度、沉降放在同一窗口，用来判断风险源穿越时是否出现扰动响应。</p><ReactECharts option={trendOption} style={{height:330}} notMerge /></div><div className="chart-panel"><h3>穿越前 / 中 / 后对比</h3><p className="chart-help">三段对比更容易看出窗口内是否比前后异常。</p><ReactECharts option={segmentOption} style={{height:330}} notMerge /></div></div>
          <div className="evidence-cards">{stats.map(seg=><article key={seg.key}><b>{seg.name}</b><p>{seg.range}</p><p>均压 {seg.pressure ?? '--'} bar；均速 {seg.speed ?? '--'} mm/min；推力 {seg.thrust ? Math.round(seg.thrust/1000) : '--'} x1000kN。</p></article>)}</div>
        </section>
      </section>
    </main>
  );
}

function latest<T>(arr:T[]):T|null { return arr.length ? arr[arr.length-1] : null; }

function MonitoringPage({ selectedRing }: { selectedRing: number }) {
  void selectedRing;
  return <FileMonitoringAlertsPage />;
}


function OperationPage({ selectedRing }: { selectedRing: number }) {
  void selectedRing;
  return <InterfaceFirstPage page="operation" />;
}


function SlurryGroutingPage({ selectedRing }: { selectedRing: number }) {
  void selectedRing;
  return <InterfaceFirstPage page="slurry" />;
}


function SegmentQualityPage({ selectedRing }: { selectedRing: number }) {
  void selectedRing;
  return <InterfaceFirstPage page="segment" />;
}


function EventsPage({ selectedRing }: { selectedRing:number }) {
  const events=buildDemoEvents();
  const option={backgroundColor:'transparent',tooltip:{trigger:'item'},grid:{left:70,right:30,top:30,bottom:30},xAxis:{type:'value',min:ringMin,max:ringMax,axisLabel:{color:'#93bad6',formatter:(v:number)=>`${v}环`},splitLine:{lineStyle:{color:'rgba(120,210,255,.12)'}}},yAxis:{type:'category',data:['监测','参数','泥水','注浆','处置'],axisLabel:{color:'#c9eaff'}},series:[{type:'scatter',symbolSize:(v:any)=>v[2],data:events.map((e,i)=>[e.ringNo, i%5, e.severity==='预警'?24:16, e.title]),label:{show:true,formatter:(p:any)=>p.data[3],color:'#e8f8ff',position:'right'}}]};
  return <main className="work-page readable-page"><section className="page-hero"><div><p>Event Closure</p><h1>事件报警闭环 <DemoTag /></h1><span>项目书中的“应急预案”不能替代实际事件记录；平台要展示事件、原因、处置和闭环状态。</span></div><b>{events.filter(e=>e.status==='open').length} 未闭环</b></section><section className="analysis-grid-2"><div className="chart-panel"><h3>事件与环号位置</h3><p className="chart-help">把报警事件落到环号和类型上，才能回看对应风险源、监测曲线和施工参数。</p><ReactECharts option={option} style={{height:360}} notMerge /></div><div className="rule-panel"><h3>闭环列表</h3><div className="rule-list">{events.map(e=><article key={e.eventId}><b>{e.title}</b><strong className={e.status==='closed'?'ok':'warn'}>{statusZh(e.status)}</strong><p>{e.eventTime} / {e.ringNo}环 / {e.action}</p></article>)}</div></div></section></main>;
}

function ImportPage() {
  return <FileDataImportPage />;
}



function SystemPage() {
  return <InterfaceFirstPage page="system" />;
}


export default function App() {
  const [page,setPageState]=useState(()=>pageFromLocation());
  const [selectedRing,setSelectedRingState]=useState(()=>ringFromLocation());
  useEffect(()=>{const onPopState=()=>{setPageState(pageFromLocation());setSelectedRingState(ringFromLocation());};window.addEventListener('popstate',onPopState);return()=>window.removeEventListener('popstate',onPopState);},[]);
  const setPage=(nextPage:string)=>{
    setPageState(nextPage);
    window.history.pushState({}, '', PAGE_ROUTES[nextPage] || '/');
  };
  const setSelectedRing=(ring:number)=>{const safe=Math.min(ringMax,Math.max(ringMin,ring));setSelectedRingState(safe);replaceRingUrl(safe);};
  let content;
  if(page==='overview') content=<CommandOverview selectedRing={selectedRing} setSelectedRing={setSelectedRing}/>;
  else if(page==='book') content=<ProjectBookPage/>;
  else if(page==='risk') content=<RiskReplay selectedRing={selectedRing}/>;
  else if(page==='monitoring') content=<MonitoringPage selectedRing={selectedRing}/>;
  else if(page==='operation') content=<OperationPage selectedRing={selectedRing}/>;
  else if(page==='slurry') content=<SlurryGroutingPage selectedRing={selectedRing}/>;
  else if(page==='segment') content=<SegmentQualityPage selectedRing={selectedRing}/>;
  else if(page==='events') content=<EventsPage selectedRing={selectedRing}/>;
  else if(page==='import') content=<ImportPage/>;
  else if(page==='system') content=<SystemPage/>;
  else content=<CommandOverview selectedRing={selectedRing} setSelectedRing={setSelectedRing}/>;
  return <DashboardShell page={page} setPage={setPage}>{content}</DashboardShell>;
}
