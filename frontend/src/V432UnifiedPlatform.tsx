import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts'

type AnyObj = Record<string, any>
type PageKey = 'overview' | 'intelligent' | 'project' | 'risk' | 'monitoring' | 'operation' | 'slurry' | 'segment' | 'events' | 'data' | 'system' | 'evidence'

type NavItem = { key: PageKey; label: string; sub: string; path: string; group: string }

type PlatformData = {
  summary: AnyObj
  advanced: { operation: AnyObj; slurry: AnyObj; segment: AnyObj }
}

const PLATFORM_TITLE = '通苏嘉甬施工监测与盾构研判平台'
const DEVICE_ID = 'DZ1360'

const NAV_ITEMS: NavItem[] = [
  { key: 'overview', label: '指挥总览', sub: '当前环', path: '/', group: '总览' },
  { key: 'intelligent', label: '智能研判', sub: '诊断', path: '/intelligent-analysis', group: '研判' },
  { key: 'project', label: '项目书', sub: '依据', path: '/project-docs', group: '研判' },
  { key: 'risk', label: '风险复盘', sub: '窗口', path: '/risk-replay', group: '研判' },
  { key: 'monitoring', label: '监测异常', sub: '预警', path: '/monitoring-alerts', group: '研判' },
  { key: 'operation', label: '参数诊断', sub: '组合', path: '/operation-diagnosis', group: '专业' },
  { key: 'slurry', label: '泥水注浆', sub: '沉降', path: '/slurry-grouting', group: '专业' },
  { key: 'segment', label: '管片盾尾', sub: '拼装', path: '/segment-quality', group: '专业' },
  { key: 'events', label: '事件闭环', sub: '处置', path: '/events', group: '闭环' },
  { key: 'data', label: '数据接入', sub: '映射', path: '/data-import', group: '系统' },
  { key: 'system', label: '系统状态', sub: '质量', path: '/system-status', group: '系统' },
  { key: 'evidence', label: '证据链', sub: '追溯', path: '/evidence', group: '闭环' },
]

const PATH_TO_KEY = NAV_ITEMS.reduce<Record<string, PageKey>>((acc, item) => {
  acc[item.path] = item.key
  return acc
}, {})

const C = { text: '#eafcff', muted: '#86c9d9', cyan: '#12d9ff', blue: '#2f7dff', green: '#38f5b1', yellow: '#ffd45c', red: '#ff5c7a', bg: '#061426' }

function normalizePath(raw: string) {
  let path = raw || '/'
  path = path.split('?')[0].split('#')[0]
  path = path.replace(/^\/tsjy(?=\/|$)/, '')
  path = path.replace(/^\/preview-[^/]+(?=\/|$)/, '')
  if (!path) path = '/'
  if (!path.startsWith('/')) path = `/${path}`
  if (path.length > 1) path = path.replace(/\/+$/, '')
  if (path === '/event-closure') return '/events'
  if (path === '/ai-diagnosis' || path === '/smart-analysis') return '/intelligent-analysis'
  return path
}

function getLogicalPath() {
  if (window.location.hash.startsWith('#/')) return normalizePath(window.location.hash.slice(1))
  return normalizePath(window.location.pathname)
}

function getBasePrefix() {
  const { pathname } = window.location
  if (pathname.startsWith('/tsjy')) return '/tsjy'
  const preview = pathname.match(/^\/preview-[^/]+/)
  if (preview) return preview[0]
  return ''
}

function realUrlFor(path: string) {
  if (path === '/') return '/tsjy/'
  return `/tsjy${path}`
}

function emitRouteChange() { window.dispatchEvent(new Event('tsjy-v432-route-change')) }

function patchHistoryOnce() {
  const historyAny = window.history as History & { __v432Patched?: boolean }
  if (historyAny.__v432Patched) return
  historyAny.__v432Patched = true
  const rawPushState = window.history.pushState
  const rawReplaceState = window.history.replaceState
  window.history.pushState = function (...args) { const result = rawPushState.apply(this, args); emitRouteChange(); return result }
  window.history.replaceState = function (...args) { const result = rawReplaceState.apply(this, args); emitRouteChange(); return result }
}

function useRoute() {
  const [path, setPath] = useState(() => getLogicalPath())
  useEffect(() => {
    patchHistoryOnce()
    const update = () => setPath(getLogicalPath())
    window.addEventListener('popstate', update)
    window.addEventListener('hashchange', update)
    window.addEventListener('tsjy-v432-route-change', update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hashchange', update)
      window.removeEventListener('tsjy-v432-route-change', update)
    }
  }, [])
  const navigate = (nextPath: string) => {
    const next = normalizePath(nextPath)
    window.history.pushState({}, '', realUrlFor(next))
    setPath(next)
    emitRouteChange()
    window.scrollTo({ top: 0, behavior: 'auto' })
  }
  return { path, navigate }
}

function directApiBase() { const { protocol, hostname } = window.location; return `${protocol}//${hostname}:8100` }

async function fetchJson(url: string, timeoutMs = 12000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return await res.json()
  } finally { window.clearTimeout(timer) }
}

async function fetchApi(path: string) {
  const candidates = [path]
  let lastError: unknown = null
  for (const url of candidates) {
    try { return await fetchJson(url) } catch (error) { lastError = error; console.warn('[V432] API candidate failed:', url, error) }
  }
  throw lastError || new Error('API unavailable')
}

function toNumber(value: any, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback }
function fmt(value: any, unit = '') { if (value === null || value === undefined || value === '') return '--'; const n = Number(value); if (Number.isFinite(n)) { const s = Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2); return `${s}${unit ? ` ${unit}` : ''}` } return `${value}${unit ? ` ${unit}` : ''}` }
function levelClass(value: any) { const text = String(value || ''); if (text.includes('报警') || text.includes('高')) return 'alarm'; if (text.includes('预警') || text.includes('中')) return 'warning'; if (text.includes('关注') || text.includes('复核')) return 'attention'; return 'normal' }

function fallbackSummary() {
  const alerts = [
    { pointCode: 'DB37-01', level: '报警', item: '地表沉降', value: -18.6, unit: 'mm', location: '左线 K32+418', priorityReason: '当前风险窗口内，沉降速率连续增大' },
    { pointCode: 'DBC12-01', level: '报警', item: '地表沉降', value: -16.4, unit: 'mm', location: '左线 K32+421', priorityReason: '邻近建筑控制点，需复核同步注浆' },
    { pointCode: 'ZQC-04', level: '预警', item: '拱顶收敛', value: 8.2, unit: 'mm', location: '联络通道附近', priorityReason: '与仓压波动同窗出现' },
    { pointCode: 'ST-18', level: '关注', item: '水平位移', value: 4.8, unit: 'mm', location: '右线 K32+425', priorityReason: '趋势轻微扩大' },
  ]
  const trend = [
    { time: '21:00', advanceSpeed: 0, chamberPressure1: 6.5, shieldTailGap1: 92, penetration: 2.8, settlement: -12.4, grouting: 32, torque: 410 },
    { time: '21:03', advanceSpeed: 0, chamberPressure1: 6.6, shieldTailGap1: 95, penetration: 2.9, settlement: -13.9, grouting: 34, torque: 418 },
    { time: '21:06', advanceSpeed: 0, chamberPressure1: 6.8, shieldTailGap1: 98, penetration: 3.0, settlement: -15.2, grouting: 31, torque: 430 },
    { time: '21:09', advanceSpeed: 0, chamberPressure1: 6.7, shieldTailGap1: 101, penetration: 2.7, settlement: -16.8, grouting: 29, torque: 426 },
    { time: '21:12', advanceSpeed: 0, chamberPressure1: 6.9, shieldTailGap1: 99, penetration: 2.6, settlement: -18.6, grouting: 28, torque: 432 },
  ]
  return {
    projectName: '通苏嘉甬铁路盾构区间', deviceId: DEVICE_ID, ringNo: 1360, mileage: 'K32+418 ~ K32+426', status: '预警', riskLevel: '报警', riskScore: 82, updatedAt: new Date().toLocaleString(),
    kpis: [
      { title: '当前环号', value: 1360, unit: '环', level: '正常', note: '施工推进基准' },
      { title: '综合风险', value: 82, unit: '分', level: '报警', note: '沉降 + 盾尾间隙' },
      { title: '开挖仓压力', value: 6.8, unit: 'bar', level: '预警', note: '需与推进速度联动' },
      { title: '盾尾间隙', value: 98, unit: 'mm', level: '报警', note: '复核姿态与拼装' },
      { title: '异常测点', value: alerts.length, unit: '个', level: '报警', note: '当前风险窗口内' },
    ],
    alerts, trend,
    actions: [
      { owner: '盾构司机', task: '保持仓压稳定，避免突降突升；复核推进速度为零是否停机保压。', level: '预警' },
      { owner: '测量组', task: '优先复测 DB37-01、DBC12-01，并反馈沉降速率。', level: '报警' },
      { owner: '注浆组', task: '核对同步注浆量、注浆压力与盾尾间隙变化。', level: '预警' },
      { owner: '管片班组', task: '检查当前环拼装姿态、盾尾刷状态和错台风险。', level: '关注' },
    ],
    evidence: [
      { id: 'EV-1360-01', type: '监测', title: 'DB37-01 沉降报警', time: '21:06', status: '已入链' },
      { id: 'EV-1360-02', type: '参数', title: '仓压与盾尾间隙同窗波动', time: '21:09', status: '已入链' },
      { id: 'EV-1360-03', type: '处置', title: '同步注浆复核建议', time: '21:11', status: '待确认' },
      { id: 'EV-1360-04', type: '复测', title: '测量组复测回执', time: '21:18', status: '待回传' },
    ],
    events: [
      { id: 'E-001', title: '沉降报警复核', owner: '测量组', status: '处理中', due: '30分钟内' },
      { id: 'E-002', title: '盾尾间隙复核', owner: '管片班组', status: '待确认', due: '本环完成前' },
      { id: 'E-003', title: '仓压稳定性检查', owner: '盾构司机', status: '处理中', due: '实时' },
      { id: 'E-004', title: '同步注浆复核', owner: '注浆组', status: '待确认', due: '15分钟内' },
    ],
    system: { api: '降级兜底', ws: '未连接', db: '未知', freshness: '本地兜底数据', uptime: 'N/A' },
    dataQuality: [
      { name: '掘进参数', status: '关注', coverage: 86, issue: '部分字段需校准' },
      { name: '监测测点', status: '预警', coverage: 78, issue: '异常测点需人工复核' },
      { name: '事件闭环', status: '正常', coverage: 92, issue: '流程可用' },
      { name: '证据链', status: '关注', coverage: 74, issue: '处置回执待补齐' },
    ],
  }
}

function fallbackAdvanced() {
  const summary = fallbackSummary()
  const baseCards = [
    { title: '推进速度', value: 0, unit: 'mm/min', status: '预警', note: '当前值', score: 72 },
    { title: '开挖仓压力', value: 6.8, unit: 'bar', status: '预警', note: '仓压', score: 68 },
    { title: '盾尾间隙', value: 98, unit: 'mm', status: '报警', note: '间隙', score: 88 },
    { title: '贯入度', value: 3.0, unit: 'mm/r', status: '正常', note: '单环', score: 35 },
    { title: '关联异常', value: summary.alerts.length, unit: '个', status: '报警', note: '监测响应', score: 76 },
  ]
  const components = [
    { name: '推进协调', score: 72, level: '预警', evidence: ['推进速度偏低或停机状态'], suggestion: '确认是否停机、保压或采集未刷新。' },
    { name: '仓压稳定', score: 68, level: '预警', evidence: ['开挖仓压力 6.8 bar'], suggestion: '复核仓压传感器、泥水环流和掘进速度。' },
    { name: '盾尾间隙', score: 88, level: '报警', evidence: ['盾尾间隙 98 mm'], suggestion: '复核盾尾间隙、姿态调整和管片拼装。' },
    { name: '监测响应', score: 70, level: '预警', evidence: ['关联异常 3 个测点'], suggestion: '优先复核当前风险窗口内报警点。' },
  ]
  return {
    operation: { title: '推进、仓压、刀盘与盾尾间隙组合诊断', subtitle: '参数诊断 / V432 专业页', level: '预警', score: 76, summary: '对推进速度、仓压、刀盘负荷、盾尾间隙和监测响应进行组合研判。', cards: baseCards, trend: summary.trend, alerts: summary.alerts, components },
    slurry: { title: '泥水环流、仓压、同步注浆与沉降响应研判', subtitle: '泥水注浆 / V432 专业页', level: '预警', score: 62, summary: '对进排浆平衡、仓压稳定、同步注浆和沉降响应进行联合判断。', cards: baseCards, trend: summary.trend, alerts: summary.alerts, components },
    segment: { title: '盾尾间隙、导向姿态与管片拼装风险复核', subtitle: '管片盾尾 / V432 专业页', level: '报警', score: 82, summary: '对盾尾间隙、姿态偏差、管片拼装和沉降响应进行联合复核。', cards: baseCards, trend: summary.trend, alerts: summary.alerts, components },
  }
}

function mergeSummary(remote: any) {
  const fallback = fallbackSummary()
  const data = remote?.data || remote || {}
  return { ...fallback, ...data, kpis: data.kpis || data.metrics || fallback.kpis, alerts: data.alerts || data.priorityAlerts || data.monitoringAlerts || fallback.alerts, trend: data.trend || data.history || data.recentTrend || fallback.trend, actions: data.actions || data.suggestions || fallback.actions, evidence: data.evidence || data.evidenceChain || fallback.evidence, events: data.events || data.eventList || fallback.events, dataQuality: data.dataQuality || fallback.dataQuality, system: { ...fallback.system, ...(data.system || {}) } }
}
function mergeAdvanced(remote: any) { const fallback = fallbackAdvanced(); const data = remote?.data || remote || {}; return { operation: { ...fallback.operation, ...(data.operation || {}) }, slurry: { ...fallback.slurry, ...(data.slurry || {}) }, segment: { ...fallback.segment, ...(data.segment || {}) } } }

function usePlatformData(): PlatformData & { status: string; loading: boolean; reload: () => void } {
  const [summary, setSummary] = useState(() => fallbackSummary())
  const [advanced, setAdvanced] = useState(() => fallbackAdvanced())
  const [status, setStatus] = useState('正在连接后端')
  const [loading, setLoading] = useState(false)
  const load = async () => {
    setLoading(true)
    try {
      const json = await fetchApi(`/api/report-cockpit/summary?deviceId=${DEVICE_ID}`)
      setSummary(mergeSummary(json))
      setAdvanced(fallbackAdvanced())
      setStatus('后端已连接')
    } catch (error) {
      console.warn('[V432] summary unavailable:', error)
      setSummary(fallbackSummary())
      setAdvanced(fallbackAdvanced())
      setStatus('后端暂不可用，使用稳定兜底数据')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load(); const timer = window.setInterval(load, 10000); return () => window.clearInterval(timer) }, [])
  return { summary, advanced, status, loading, reload: load }
}

function chartBase(title?: string): echarts.EChartsOption { return { backgroundColor: 'transparent', title: title ? { text: title, left: 12, top: 8, textStyle: { color: C.text, fontSize: 13, fontWeight: 700 } } : undefined, textStyle: { color: C.text }, tooltip: { trigger: 'axis', backgroundColor: 'rgba(2,8,18,.92)', borderColor: 'rgba(18,217,255,.4)', textStyle: { color: C.text } }, grid: { left: 42, right: 22, top: title ? 46 : 24, bottom: 32 }, xAxis: { type: 'category', axisLine: { lineStyle: { color: 'rgba(141,244,255,.35)' } }, axisTick: { show: false }, axisLabel: { color: C.muted } }, yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(141,244,255,.12)' } }, axisLabel: { color: C.muted } } } }
function useEChart(option: echarts.EChartsOption, deps: React.DependencyList = []) { const ref = useRef<HTMLDivElement | null>(null); useEffect(() => { if (!ref.current) return undefined; const chart = echarts.init(ref.current); chart.setOption(option, true); const resize = () => chart.resize(); window.addEventListener('resize', resize); const timer = window.setTimeout(resize, 60); return () => { window.clearTimeout(timer); window.removeEventListener('resize', resize); chart.dispose() } }, deps); return ref }
function ChartBox({ option, className = '', deps = [] }: { option: echarts.EChartsOption; className?: string; deps?: React.DependencyList }) { const ref = useEChart(option, deps); return <div ref={ref} className={`v432-chart ${className}`} /> }

function RiskGauge({ score, level }: { score: number; level: any }) { const cls = levelClass(level); const color = cls === 'alarm' ? C.red : cls === 'warning' ? C.yellow : C.cyan; const option: echarts.EChartsOption = { series: [{ type: 'gauge', min: 0, max: 100, radius: '92%', center: ['50%', '58%'], progress: { show: true, width: 14, itemStyle: { color } }, axisLine: { lineStyle: { width: 14, color: [[0.55, 'rgba(56,245,177,.25)'], [0.75, 'rgba(255,212,92,.35)'], [1, 'rgba(255,92,122,.35)']] } }, axisTick: { show: false }, splitLine: { length: 10, lineStyle: { color: 'rgba(223,247,255,.36)' } }, axisLabel: { color: C.muted, fontSize: 10 }, pointer: { width: 5, itemStyle: { color: C.text } }, detail: { valueAnimation: true, formatter: '{value}', color: C.text, fontSize: 28, fontWeight: 900, offsetCenter: [0, '58%'] }, data: [{ value: score, name: String(level || '风险') }], title: { offsetCenter: [0, '82%'], color: C.muted, fontSize: 12 } }] }; return <ChartBox option={option} deps={[score, level]} /> }
function TrendLines({ rows, title = '近时段参数联动' }: { rows: AnyObj[]; title?: string }) { const base = chartBase(title); const option: echarts.EChartsOption = { ...base, legend: { right: 16, top: 8, textStyle: { color: C.muted } }, xAxis: { ...(base.xAxis as AnyObj), data: rows.map((row) => row.time || '') }, yAxis: { ...(base.yAxis as AnyObj) }, series: [{ name: '仓压', type: 'line', smooth: true, data: rows.map((r) => toNumber(r.chamberPressure1)), symbol: 'circle', lineStyle: { color: C.cyan, width: 3 }, itemStyle: { color: C.cyan }, areaStyle: { color: 'rgba(18,217,255,.12)' } }, { name: '盾尾间隙', type: 'line', smooth: true, data: rows.map((r) => toNumber(r.shieldTailGap1) / 12), lineStyle: { color: C.yellow, width: 3 }, itemStyle: { color: C.yellow } }, { name: '沉降', type: 'line', smooth: true, data: rows.map((r) => Math.abs(toNumber(r.settlement))), lineStyle: { color: C.red, width: 3 }, itemStyle: { color: C.red } }] }; return <ChartBox option={option} deps={[rows, title]} /> }
function AlertBar({ rows }: { rows: AnyObj[] }) { const base = chartBase('异常测点优先级'); const option: echarts.EChartsOption = { ...base, xAxis: { ...(base.xAxis as AnyObj), data: rows.map((r) => r.pointCode || r.code || '--') }, yAxis: { ...(base.yAxis as AnyObj) }, series: [{ type: 'bar', data: rows.map((r) => Math.abs(toNumber(r.value, 6))), barMaxWidth: 22, itemStyle: { borderRadius: [6, 6, 0, 0], color: (p: any) => { const cls = levelClass(rows[p.dataIndex]?.level); return cls === 'alarm' ? C.red : cls === 'warning' ? C.yellow : C.cyan } } }] }; return <ChartBox option={option} deps={[rows]} /> }
function RadarScore({ rows, title = '诊断因子雷达' }: { rows: AnyObj[]; title?: string }) { const picked = (rows || []).slice(0, 6); const option: echarts.EChartsOption = { title: { text: title, left: 12, top: 8, textStyle: { color: C.text, fontSize: 13 } }, tooltip: { backgroundColor: 'rgba(2,8,18,.92)', borderColor: 'rgba(18,217,255,.4)', textStyle: { color: C.text } }, radar: { center: ['50%', '56%'], radius: '66%', indicator: picked.map((r) => ({ name: r.name || r.title || '--', max: 100 })), splitLine: { lineStyle: { color: 'rgba(141,244,255,.2)' } }, splitArea: { areaStyle: { color: ['rgba(18,217,255,.03)', 'rgba(18,217,255,.08)'] } }, axisName: { color: C.muted } }, series: [{ type: 'radar', data: [{ value: picked.map((r) => toNumber(r.score, 50)), name: '风险评分' }], lineStyle: { color: C.cyan, width: 3 }, areaStyle: { color: 'rgba(18,217,255,.2)' }, itemStyle: { color: C.cyan } }] }; return <ChartBox option={option} deps={[rows, title]} /> }
function PieStatus({ rows, title = '状态占比' }: { rows: AnyObj[]; title?: string }) { const counts: Record<string, number> = {}; rows.forEach((r) => { const k = r.level || r.status || '正常'; counts[k] = (counts[k] || 0) + 1 }); const option: echarts.EChartsOption = { title: { text: title, left: 12, top: 8, textStyle: { color: C.text, fontSize: 13 } }, tooltip: { trigger: 'item', backgroundColor: 'rgba(2,8,18,.92)', borderColor: 'rgba(18,217,255,.4)', textStyle: { color: C.text } }, legend: { bottom: 0, textStyle: { color: C.muted } }, series: [{ type: 'pie', radius: ['42%', '70%'], center: ['50%', '52%'], data: Object.entries(counts).map(([name, value]) => ({ name, value })), itemStyle: { borderColor: C.bg, borderWidth: 2 }, color: [C.red, C.yellow, C.cyan, C.green] }] }; return <ChartBox option={option} deps={[rows, title]} /> }
function FlowSankey() { const option: echarts.EChartsOption = { title: { text: '泥水-仓压-沉降链路', left: 12, top: 8, textStyle: { color: C.text, fontSize: 13 } }, tooltip: { trigger: 'item', backgroundColor: 'rgba(2,8,18,.92)', borderColor: 'rgba(18,217,255,.4)', textStyle: { color: C.text } }, series: [{ type: 'sankey', top: 48, bottom: 20, left: 20, right: 28, nodeWidth: 14, nodeGap: 14, data: [{ name: '进浆' }, { name: '排浆' }, { name: '仓压' }, { name: '注浆' }, { name: '盾尾' }, { name: '沉降' }], links: [{ source: '进浆', target: '仓压', value: 3 }, { source: '排浆', target: '仓压', value: 2 }, { source: '仓压', target: '盾尾', value: 2 }, { source: '注浆', target: '盾尾', value: 3 }, { source: '盾尾', target: '沉降', value: 4 }], lineStyle: { color: 'gradient', opacity: 0.38 }, itemStyle: { color: C.cyan, borderColor: 'rgba(141,244,255,.48)' }, label: { color: C.text } }] }; return <ChartBox option={option} deps={[]} /> }
function EvidenceGraph({ rows, alerts }: { rows: AnyObj[]; alerts: AnyObj[] }) { const nodes = [{ name: '当前环' }, ...alerts.slice(0, 3).map((r) => ({ name: r.pointCode || r.code || '测点' })), ...rows.slice(0, 4).map((r) => ({ name: r.id || r.title })), { name: '处置闭环' }]; const links = nodes.slice(1).map((node) => ({ source: '当前环', target: node.name, value: 1 })); links.push(...rows.slice(0, 3).map((r) => ({ source: r.id || r.title, target: '处置闭环', value: 1 }))); const option: echarts.EChartsOption = { title: { text: '证据链关系图', left: 12, top: 8, textStyle: { color: C.text, fontSize: 13 } }, tooltip: { backgroundColor: 'rgba(2,8,18,.92)', borderColor: 'rgba(18,217,255,.4)', textStyle: { color: C.text } }, series: [{ type: 'graph', layout: 'force', roam: true, top: 48, bottom: 20, force: { repulsion: 180, edgeLength: 90 }, data: nodes.map((n, i) => ({ ...n, symbolSize: i === 0 ? 58 : 38, itemStyle: { color: i === 0 ? C.yellow : C.cyan } })), links, lineStyle: { color: C.muted, opacity: 0.6 }, label: { show: true, color: C.text, fontSize: 11 } }] }; return <ChartBox option={option} deps={[rows, alerts]} /> }

function TopBar({ path, navigate, status }: { path: string; navigate: (path: string) => void; status: string }) { return <header className="v432-topbar"><section className="v432-brand"><span>AUTONOMOUS SHIELD TUNNELING SYSTEM</span><b>{PLATFORM_TITLE}</b></section><nav className="v432-nav" aria-label="主导航">{NAV_ITEMS.map((item) => { const active = item.path === '/' ? path === '/' : path === item.path; return <a key={item.path} href={realUrlFor(item.path)} className={`v432-nav-item ${active ? 'active' : ''} group-${item.group}`} onClick={(event) => { event.preventDefault(); navigate(item.path) }}><b>{item.label}</b><span>{item.sub}</span></a> })}</nav><section className="v432-status"><b>{new Date().toLocaleDateString()}</b><span>{status}</span></section></header> }
function PageTitle({ eyebrow, title, desc, level }: { eyebrow: string; title: string; desc: string; level?: any }) { return <section className={`v432-page-title ${levelClass(level)}`}><div><span>{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{level ? <b>{level}</b> : null}</section> }
function KpiGrid({ items }: { items: AnyObj[] }) { return <section className="v432-kpi-grid">{(items || []).map((item, index) => <article key={`${item.title}-${index}`} className={`v432-kpi ${levelClass(item.level || item.status)}`}><span>{item.title}</span><b>{fmt(item.value, item.unit || '')}</b><em>{item.note || item.level || item.status || '--'}</em></article>)}</section> }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="v432-panel"><h3>{title}</h3>{children}</section> }
function AlertList({ rows }: { rows: AnyObj[] }) { if (!rows?.length) return <p className="v432-muted">暂无异常。</p>; return <div className="v432-list alerts">{rows.slice(0, 8).map((row, index) => <article key={`${row.pointCode || index}`} className={levelClass(row.level)}><div><b>{row.pointCode || row.code || '--'}</b><span>{row.item || row.type || row.location || '--'}</span></div><p>{row.priorityReason || row.reason || row.location || '--'}</p><em>{fmt(row.value, row.unit || '')} · {row.level || '--'}</em></article>)}</div> }
function ActionList({ rows }: { rows: AnyObj[] }) { return <div className="v432-list actions">{(rows || []).map((row, index) => <article key={`${row.owner}-${index}`} className={levelClass(row.level)}><b>{index + 1}</b><div><h4>{row.owner || row.title || '责任项'}</h4><p>{row.task || row.suggestion || row.desc || '--'}</p></div></article>)}</div> }
function TrendTable({ rows }: { rows: AnyObj[] }) { return <div className="v432-trend"><div className="head"><span>时间</span><span>推进速度</span><span>仓压</span><span>盾尾间隙</span><span>沉降</span></div>{(rows || []).slice(-8).map((row, index) => <div key={`${row.time}-${index}`}><span>{row.time || '--'}</span><span>{fmt(row.advanceSpeed, 'mm/min')}</span><span>{fmt(row.chamberPressure1, 'bar')}</span><span>{fmt(row.shieldTailGap1, 'mm')}</span><span>{fmt(row.settlement, 'mm')}</span></div>)}</div> }
function ComponentScores({ rows }: { rows: AnyObj[] }) { return <div className="v432-score-list">{(rows || []).map((row, index) => <article key={`${row.name}-${index}`} className={levelClass(row.level)}><b>{fmt(row.score)}</b><div><h4>{row.name}｜{row.level || '--'}</h4><p>{(row.evidence || []).join('；') || row.summary || '--'}</p><em>{row.suggestion || '--'}</em></div></article>)}</div> }
function EvidenceMini({ rows }: { rows: AnyObj[] }) { return <div className="v432-evidence-mini">{rows.map((row) => <article key={row.id}><b>{row.id}</b><span>{row.type}</span><p>{row.title}</p><em>{row.status}</em></article>)}</div> }

function OverviewPage({ summary }: { summary: AnyObj }) { return <><PageTitle eyebrow="COMMAND OVERVIEW" title="指挥总览" desc={`${summary.projectName} · ${summary.mileage} · 当前 ${summary.ringNo} 环`} level={summary.riskLevel} /><KpiGrid items={summary.kpis} /><section className="v432-grid three"><Panel title="综合风险仪表"><RiskGauge score={summary.riskScore} level={summary.riskLevel} /></Panel><Panel title="近时段参数趋势"><TrendLines rows={summary.trend} /></Panel><Panel title="异常测点分布"><AlertBar rows={summary.alerts} /></Panel></section><section className="v432-grid two-one"><Panel title="当前优先处置测点"><AlertList rows={summary.alerts} /></Panel><Panel title="今日建议动作"><ActionList rows={summary.actions} /></Panel></section></> }
function IntelligentPage({ summary, advanced }: { summary: AnyObj; advanced: AnyObj }) { const rows = [...(advanced.operation.components || []), ...(advanced.slurry.components || []), ...(advanced.segment.components || [])].slice(0, 8); return <><PageTitle eyebrow="INTELLIGENT DIAGNOSIS" title="智能研判" desc="汇总推进、泥水、盾尾、监测响应，输出可执行处置优先级。" level={summary.riskLevel} /><section className="v432-grid one-one"><Panel title="诊断因子雷达"><RadarScore rows={rows} /></Panel><Panel title="状态占比"><PieStatus rows={[...rows, ...summary.alerts]} /></Panel></section><section className="v432-grid one-one"><Panel title="综合诊断因子"><ComponentScores rows={rows} /></Panel><Panel title="研判结论"><ActionList rows={summary.actions} /></Panel></section></> }
function ProjectDocsPage({ summary }: { summary: AnyObj }) { const docs = [{ name: '施工组织设计', status: '已关联', detail: '用于确认风险处置权限、工序衔接和现场责任边界。', score: 92 }, { name: '监测方案', status: '已关联', detail: '用于确认报警阈值、测点布设和复测频率。', score: 88 }, { name: '盾构参数控制标准', status: '待复核', detail: '当前仓压、推进速度、注浆量需与标准控制值复核。', score: 74 }, { name: '应急处置预案', status: '已关联', detail: '报警等级达到处置触发条件时，进入事件闭环。', score: 86 }]; const base = chartBase('依据关联完整度'); const option: echarts.EChartsOption = { ...base, xAxis: { ...(base.xAxis as AnyObj), data: docs.map((d) => d.name) }, yAxis: { ...(base.yAxis as AnyObj), max: 100 }, series: [{ type: 'bar', data: docs.map((d) => d.score), itemStyle: { borderRadius: [6, 6, 0, 0], color: C.cyan } }] }; return <><PageTitle eyebrow="PROJECT BASIS" title="项目书 / 依据库" desc="把当前风险与施工依据、监测方案、处置预案建立映射。" /><section className="v432-grid one-one"><Panel title="依据关联图"><ChartBox option={option} deps={[summary]} /></Panel><Panel title="当前环依据摘要"><ActionList rows={summary.actions} /></Panel></section><section className="v432-doc-grid">{docs.map((doc) => <article key={doc.name}><b>{doc.name}</b><em>{doc.status}</em><p>{doc.detail}</p></article>)}</section></> }
function RiskReplayPage({ summary }: { summary: AnyObj }) { return <><PageTitle eyebrow="RISK REPLAY" title="风险复盘" desc="按时间窗复盘参数变化、监测响应和处置动作。" level={summary.riskLevel} /><section className="v432-grid one-one"><Panel title="风险窗口趋势"><TrendLines rows={summary.trend} title="仓压-盾尾-沉降复盘" /></Panel><Panel title="报警分布"><AlertBar rows={summary.alerts} /></Panel></section><section className="v432-timeline">{summary.trend.map((row: AnyObj, index: number) => <article key={`${row.time}-${index}`}><b>{row.time}</b><p>仓压 {fmt(row.chamberPressure1, 'bar')}，盾尾间隙 {fmt(row.shieldTailGap1, 'mm')}，沉降 {fmt(row.settlement, 'mm')}。</p><em>{index >= summary.trend.length - 2 ? '风险窗口' : '过程记录'}</em></article>)}</section></> }
function MonitoringPage({ summary }: { summary: AnyObj }) { return <><PageTitle eyebrow="MONITORING ALERTS" title="监测异常" desc="聚焦当前窗口内报警、预警、复测优先级与关联施工参数。" level={summary.riskLevel} /><section className="v432-grid one-one"><Panel title="异常测点柱状图"><AlertBar rows={summary.alerts} /></Panel><Panel title="异常状态占比"><PieStatus rows={summary.alerts} /></Panel></section><section className="v432-grid two-one"><Panel title="异常测点清单"><AlertList rows={summary.alerts} /></Panel><Panel title="复测动作"><ActionList rows={summary.actions.filter((a: AnyObj) => String(a.owner).includes('测量') || String(a.task).includes('测'))} /></Panel></section></> }
function AdvancedPage({ data, type }: { data: AnyObj; type: 'operation' | 'slurry' | 'segment' }) { const name = type === 'operation' ? '参数诊断' : type === 'slurry' ? '泥水注浆' : '管片盾尾'; return <><PageTitle eyebrow="SPECIALIZED DIAGNOSIS" title={name} desc={data.summary} level={data.level} /><KpiGrid items={data.cards || []} /><section className="v432-grid three"><Panel title="诊断雷达"><RadarScore rows={data.components || []} /></Panel><Panel title={type === 'slurry' ? '泥水链路' : '参数趋势'}>{type === 'slurry' ? <FlowSankey /> : <TrendLines rows={data.trend || []} title="专业参数趋势" />}</Panel><Panel title="状态占比"><PieStatus rows={[...(data.components || []), ...(data.alerts || [])]} /></Panel></section><section className="v432-grid one-one"><Panel title="诊断链路"><ComponentScores rows={data.components || []} /></Panel><Panel title="关联异常"><AlertList rows={data.alerts || data.settlementAlerts || []} /></Panel></section></> }
function EventsPage({ summary }: { summary: AnyObj }) { const option: echarts.EChartsOption = { title: { text: '事件闭环状态', left: 12, top: 8, textStyle: { color: C.text, fontSize: 13 } }, tooltip: { trigger: 'item' }, series: [{ type: 'funnel', top: 48, left: '8%', width: '84%', height: '68%', data: summary.events.map((e: AnyObj, i: number) => ({ name: e.status || e.title, value: 100 - i * 18 })), itemStyle: { borderColor: C.bg, borderWidth: 2 }, label: { color: C.text } }] }; return <><PageTitle eyebrow="EVENT LOOP" title="事件闭环" desc="将报警、建议、责任人和回执状态纳入闭环管理。" /><section className="v432-grid one-one"><Panel title="闭环漏斗"><ChartBox option={option} deps={[summary.events]} /></Panel><Panel title="待执行动作"><ActionList rows={summary.actions} /></Panel></section><section className="v432-event-grid">{summary.events.map((event: AnyObj) => <article key={event.id}><b>{event.title}</b><span>{event.owner}</span><em>{event.status}</em><p>时限：{event.due}</p></article>)}</section></> }
function DataPage({ summary }: { summary: AnyObj }) { const base = chartBase('数据接入覆盖率'); const option: echarts.EChartsOption = { ...base, xAxis: { ...(base.xAxis as AnyObj), data: summary.dataQuality.map((d: AnyObj) => d.name) }, yAxis: { ...(base.yAxis as AnyObj), max: 100 }, series: [{ type: 'bar', data: summary.dataQuality.map((d: AnyObj) => d.coverage), itemStyle: { borderRadius: [6, 6, 0, 0], color: C.green } }] }; return <><PageTitle eyebrow="DATA ACCESS" title="数据接入" desc="展示掘进参数、监测测点、事件闭环、证据链的数据质量和接入覆盖。" /><Panel title="接入覆盖率"><ChartBox option={option} deps={[summary.dataQuality]} /></Panel><section className="v432-quality-grid">{summary.dataQuality.map((item: AnyObj) => <article key={item.name} className={levelClass(item.status)}><b>{item.name}</b><span>{item.coverage}%</span><i style={{ width: `${Math.min(100, toNumber(item.coverage, 0))}%` }} /><p>{item.issue}</p></article>)}</section></> }
function SystemPage({ summary, status, loading, reload }: { summary: AnyObj; status: string; loading: boolean; reload: () => void }) { const rows = [{ title: '接口状态', value: status, note: 'summary + specialized-pages-v2' }, { title: 'API', value: summary.system.api, note: '后端接口' }, { title: '数据新鲜度', value: summary.system.freshness, note: summary.updatedAt }, { title: '设备编号', value: summary.deviceId, note: '当前筛选' }]; const option: echarts.EChartsOption = { title: { text: '系统健康度', left: 12, top: 8, textStyle: { color: C.text, fontSize: 13 } }, series: [{ type: 'gauge', min: 0, max: 100, progress: { show: true, width: 12 }, axisLine: { lineStyle: { width: 12 } }, detail: { formatter: '{value}', color: C.text }, data: [{ value: status.includes('后端已连接') ? 92 : status.includes('部分') ? 70 : 42, name: status }] }] }; return <><PageTitle eyebrow="SYSTEM STATUS" title="系统状态" desc="检查接口、数据新鲜度、设备号和前端降级状态。" /><section className="v432-grid one-one"><Panel title="系统健康"><ChartBox option={option} deps={[status]} /></Panel><Panel title="系统指标"><KpiGrid items={rows} /></Panel></section><button className="v432-refresh" type="button" onClick={reload}>{loading ? '刷新中...' : '手动刷新接口'}</button></> }
function EvidencePage({ summary }: { summary: AnyObj }) { return <><PageTitle eyebrow="EVIDENCE CHAIN" title="证据链" desc="把监测异常、参数窗口、处置建议和回执记录串联成可追溯证据链。" /><section className="v432-grid one-one"><Panel title="证据链关系图"><EvidenceGraph rows={summary.evidence} alerts={summary.alerts} /></Panel><Panel title="关联报警"><AlertList rows={summary.alerts} /></Panel></section><EvidenceMini rows={summary.evidence} /></> }

function PageRenderer({ page, summary, advanced, status, loading, reload }: { page: PageKey; summary: AnyObj; advanced: AnyObj; status: string; loading: boolean; reload: () => void }) {
  if (page === 'overview') return <OverviewPage summary={summary} />
  if (page === 'intelligent') return <IntelligentPage summary={summary} advanced={advanced} />
  if (page === 'project') return <ProjectDocsPage summary={summary} />
  if (page === 'risk') return <RiskReplayPage summary={summary} />
  if (page === 'monitoring') return <MonitoringPage summary={summary} />
  if (page === 'operation') return <AdvancedPage type="operation" data={advanced.operation} />
  if (page === 'slurry') return <AdvancedPage type="slurry" data={advanced.slurry} />
  if (page === 'segment') return <AdvancedPage type="segment" data={advanced.segment} />
  if (page === 'events') return <EventsPage summary={summary} />
  if (page === 'data') return <DataPage summary={summary} />
  if (page === 'system') return <SystemPage summary={summary} status={status} loading={loading} reload={reload} />
  if (page === 'evidence') return <EvidencePage summary={summary} />
  return <OverviewPage summary={summary} />
}

function StableStyle() {
  return <style>{`
    .v432-shell{min-height:100vh;background:radial-gradient(circle at 50% 20%,rgba(0,168,255,.18),transparent 38%),linear-gradient(180deg,#020812,#061426 46%,#020812);color:#eafcff;font-family:"Microsoft YaHei","PingFang SC",Arial,sans-serif}.v432-topbar{position:sticky;top:0;z-index:99999;min-height:106px;box-sizing:border-box;display:grid;grid-template-columns:310px minmax(0,1fr)170px;gap:14px;align-items:center;padding:10px 24px;border-bottom:1px solid rgba(18,217,255,.44);background:linear-gradient(180deg,rgba(3,11,20,.98),rgba(3,22,38,.92));box-shadow:0 8px 36px rgba(0,0,0,.42)}.v432-brand{height:70px;box-sizing:border-box;padding:10px 16px;border:1px solid rgba(18,217,255,.4);background:linear-gradient(135deg,rgba(0,139,196,.28),rgba(0,25,52,.74));box-shadow:0 0 18px rgba(18,217,255,.42),inset 0 0 24px rgba(18,217,255,.08);clip-path:polygon(0 10px,10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)}.v432-brand span{display:block;color:#8df4ff;font-size:10px;letter-spacing:.10em}.v432-brand b{display:block;margin-top:5px;font-size:18px;line-height:1.2;color:#fff;text-shadow:0 0 14px rgba(18,217,255,.48)}.v432-nav{display:flex;gap:7px;overflow-x:auto;overflow-y:hidden;padding-bottom:2px}.v432-nav-item{flex:0 0 auto;position:relative;width:96px;height:56px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;padding:0 10px;border:1px solid rgba(18,217,255,.22);background:linear-gradient(180deg,rgba(0,114,175,.16),rgba(0,23,51,.58));color:#aeefff;cursor:pointer;text-align:left;text-decoration:none;clip-path:polygon(0 9px,9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%)}.v432-nav-item.active{border-color:rgba(18,217,255,.72);background:linear-gradient(180deg,rgba(4,199,255,.46),rgba(0,70,134,.70));box-shadow:0 0 22px rgba(18,217,255,.45)}.v432-nav-item b{font-size:13px;color:#fff}.v432-nav-item span{font-size:10px;color:#8fd8e8}.v432-status{text-align:right}.v432-status b{display:block;color:#fff}.v432-status span{color:#38f5b1;font-size:12px}.v432-main{padding:24px}.v432-page-title{display:grid;grid-template-columns:minmax(0,1fr)120px;gap:20px;align-items:center;padding:22px;margin-bottom:18px;border:1px solid rgba(18,217,255,.34);background:linear-gradient(135deg,rgba(0,139,196,.24),rgba(0,22,46,.76)),rgba(0,20,42,.52);box-shadow:0 0 26px rgba(18,217,255,.24);clip-path:polygon(0 14px,14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%)}.v432-page-title span{color:#8df4ff;font-size:13px;font-weight:900;letter-spacing:.08em}.v432-page-title h1{margin:8px 0;font-size:30px;color:#fff}.v432-page-title p{margin:0;color:#b8f4ff;line-height:1.7}.v432-page-title>b{font-size:30px;color:#ffd45c;text-align:right}.v432-kpi-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin:18px 0}.v432-kpi{position:relative;min-height:112px;padding:16px;overflow:hidden;border:1px solid rgba(18,217,255,.22);background:rgba(0,20,42,.58);box-shadow:inset 0 0 22px rgba(18,217,255,.08)}.v432-kpi span{display:block;color:#8df4ff;font-size:12px}.v432-kpi b{display:block;margin-top:10px;color:#fff;font-size:25px}.v432-kpi em{display:block;margin-top:8px;color:#b8f4ff;font-style:normal;font-size:12px}.v432-kpi:after{content:"";position:absolute;left:0;bottom:0;width:70%;height:3px;background:#12d9ff}.v432-kpi.alarm:after{background:#ff5c7a}.v432-kpi.warning:after{background:#ffd45c}.v432-grid{display:grid;gap:18px;margin-top:18px}.v432-grid.three{grid-template-columns:1fr 1.35fr 1fr}.v432-grid.two-one{grid-template-columns:minmax(0,1.4fr)minmax(360px,.9fr)}.v432-grid.one-one{grid-template-columns:1fr 1fr}.v432-panel{padding:18px;border:1px solid rgba(18,217,255,.24);background:rgba(0,20,42,.50);box-shadow:inset 0 0 24px rgba(18,217,255,.06);margin-top:18px}.v432-panel:first-child{margin-top:0}.v432-panel h3{margin:0 0 14px;color:#fff;font-size:17px}.v432-chart{width:100%;height:330px}.v432-grid.three .v432-chart{height:290px}.v432-list,.v432-score-list{display:grid;gap:10px}.v432-list article,.v432-score-list article{display:grid;grid-template-columns:68px 1fr;gap:12px;padding:12px;border:1px solid rgba(18,217,255,.16);background:rgba(0,20,42,.44)}.v432-list.alerts article{grid-template-columns:1fr}.v432-list.alerts b,.v432-score-list h4{color:#fff}.v432-list.alerts span,.v432-list.alerts p,.v432-list.alerts em,.v432-score-list p,.v432-score-list em{color:#b8f4ff;font-style:normal;line-height:1.5}.v432-list.actions article{grid-template-columns:48px 1fr}.v432-list.actions article>b,.v432-score-list article>b{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;color:#061426;background:#ffd45c}.v432-list.actions h4{margin:0 0 5px;color:#fff}.v432-list.actions p{margin:0;color:#b8f4ff;line-height:1.5}.v432-trend{display:grid;gap:8px}.v432-trend>div{display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:8px;align-items:center;padding:9px 10px;border:1px solid rgba(18,217,255,.16);background:rgba(0,20,42,.42)}.v432-trend .head{background:rgba(0,114,175,.22)}.v432-trend span{font-size:12px;color:#eafcff}.v432-doc-grid,.v432-event-grid,.v432-quality-grid,.v432-evidence-mini{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:18px}.v432-doc-grid article,.v432-event-grid article,.v432-quality-grid article,.v432-evidence-mini article{padding:16px;border:1px solid rgba(18,217,255,.20);background:rgba(0,20,42,.50)}.v432-doc-grid b,.v432-event-grid b,.v432-quality-grid b,.v432-evidence-mini b{display:block;color:#fff;margin-bottom:8px}.v432-doc-grid em,.v432-event-grid em,.v432-quality-grid span,.v432-evidence-mini em{color:#ffd45c;font-style:normal;font-weight:900}.v432-doc-grid p,.v432-event-grid p,.v432-quality-grid p,.v432-evidence-mini p{color:#b8f4ff;line-height:1.5}.v432-timeline{display:grid;gap:12px;margin-top:18px}.v432-timeline article{display:grid;grid-template-columns:90px 1fr 120px;gap:14px;align-items:center;padding:14px;border-left:3px solid #12d9ff;background:rgba(0,20,42,.46)}.v432-timeline b{color:#ffd45c}.v432-timeline p{margin:0;color:#eafcff}.v432-timeline em{font-style:normal;color:#8df4ff}.v432-quality-grid article{position:relative;overflow:hidden}.v432-quality-grid article i{position:absolute;left:0;bottom:0;height:4px;background:#12d9ff}.v432-quality-grid article.warning i{background:#ffd45c}.v432-quality-grid article.alarm i{background:#ff5c7a}.v432-refresh{padding:12px 16px;border:0;color:#061426;background:#ffd45c;font-weight:900;box-shadow:0 0 20px rgba(255,212,92,.45);cursor:pointer}.v432-source-tag{position:fixed;right:18px;bottom:18px;z-index:99998;padding:8px 12px;border:1px solid rgba(18,217,255,.32);color:#eafcff;background:rgba(2,8,18,.82);box-shadow:0 0 18px rgba(18,217,255,.24);font-size:12px;font-weight:900;pointer-events:none}.v432-muted{color:#8df4ff}.normal{}.attention{border-color:rgba(141,244,255,.35)!important}.warning{border-color:rgba(255,212,92,.45)!important}.alarm{border-color:rgba(255,92,122,.55)!important}@media(max-width:1500px){.v432-topbar{height:auto;grid-template-columns:1fr}.v432-status{display:none}.v432-nav{flex-wrap:wrap}.v432-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.v432-grid.three,.v432-grid.two-one,.v432-grid.one-one{grid-template-columns:1fr}.v432-doc-grid,.v432-event-grid,.v432-quality-grid,.v432-evidence-mini{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:900px){.v432-main{padding:14px}.v432-kpi-grid,.v432-doc-grid,.v432-event-grid,.v432-quality-grid,.v432-evidence-mini{grid-template-columns:1fr}.v432-trend>div{grid-template-columns:1fr 1fr}.v432-page-title{grid-template-columns:1fr}.v432-page-title>b{text-align:left}.v432-timeline article{grid-template-columns:1fr}}
  `}</style>
}

export default function V432UnifiedPlatform() {
  const { path, navigate } = useRoute()
  const page = PATH_TO_KEY[path] || 'overview'
  const { summary, advanced, status, loading, reload } = usePlatformData()
  const pageMeta = NAV_ITEMS.find((item) => item.key === page)
  return <div className="v432-shell"><StableStyle /><TopBar path={path} navigate={navigate} status={status} /><main className="v432-main"><PageRenderer page={page} summary={summary} advanced={advanced} status={status} loading={loading} reload={reload} /></main><div className="v432-source-tag">V432 ECharts · {pageMeta?.label || '指挥总览'}</div></div>
}
