import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import './v421-echarts-cockpit.css';

type AnyObj = Record<string, any>;

const NAV = [
  ['/', '指挥总览', '一屏总览'],
  ['/risk-replay', '风险复盘', '穿越窗口'],
  ['/monitoring-alerts', '监测预警', '邻近测点'],
  ['/operation-diagnosis', '参数诊断', '组合异常'],
  ['/slurry-grouting', '泥水注浆', '沉降归因'],
  ['/segment-quality', '管片盾尾', '姿态复核'],
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

function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(v: any, unit = '') {
  if (v === null || v === undefined || v === '') return '--';
  const n = Number(v);
  if (Number.isFinite(n)) {
    const s = Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2);
    return `${s}${unit}`;
  }
  return `${v}${unit}`;
}

function fieldValue(root: AnyObj, key: string) {
  return root?.fields?.[key]?.displayValue ?? root?.fields?.[key]?.value ?? root?.[key];
}

function EChart(props: { option: AnyObj; height?: number | string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption(props.option, true);
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
    };
  }, [props.option]);
  return <div ref={ref} style={{ width: '100%', height: props.height || 260 }} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = window.location.pathname;
  return (
    <div className="v421">
      <header className="v421-top">
        <div className="v421-brand">
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
        <div className="v421-clock">
          <b>{new Date().toLocaleDateString()}</b>
          <span>实时研判</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function riskWindowOption(pos: AnyObj) {
  const head = num(pos.headMileageM, 54380);
  const risks = (pos.nearestRiskSources || []).slice(0, 5);
  const min = Math.min(head - 80, ...risks.map((r: AnyObj) => num(r.startMileageM, head)));
  const max = Math.max(head + 80, ...risks.map((r: AnyObj) => num(r.endMileageM, head)));
  return {
    backgroundColor: 'transparent',
    grid: { left: 34, right: 28, top: 36, bottom: 30 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'value',
      min,
      max,
      axisLabel: { color: '#aeefff', formatter: (v: number) => `DK${Math.floor(v / 1000)}+${String(Math.round(v % 1000)).padStart(3, '0')}` },
      splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } },
    },
    yAxis: { type: 'value', show: false, min: 0, max: 1 },
    series: [
      {
        name: '风险窗口',
        type: 'line',
        data: [[min, 0.5], [max, 0.5]],
        symbol: 'none',
        lineStyle: { color: '#12d9ff', width: 3 },
        markLine: {
          symbol: 'none',
          label: { color: '#ffd45c', formatter: `当前 ${pos.headMileageText || ''}` },
          lineStyle: { color: '#ffd45c', width: 3 },
          data: [{ xAxis: head }],
        },
        markArea: {
          itemStyle: { color: 'rgba(255,80,80,.22)', borderColor: 'rgba(255,80,80,.58)', borderWidth: 1 },
          label: { color: '#fff' },
          data: risks.map((r: AnyObj) => [
            { name: r.riskName || '风险源', xAxis: num(r.startMileageM, head) },
            { xAxis: num(r.endMileageM, head) },
          ]),
        },
      },
    ],
  };
}

function poseRadarOption(pos: AnyObj) {
  const m = pos.guidanceMetrics || {};
  const v = (k: string, scale = 1) => num(m[k]?.value, 0) * scale;
  return {
    radar: {
      radius: '68%',
      indicator: [
        { name: '盾首水平', max: 60 },
        { name: '盾首垂直', max: 60 },
        { name: '盾中水平', max: 60 },
        { name: '盾尾水平', max: 60 },
        { name: '滚转×10', max: 50 },
        { name: '俯仰×10', max: 50 },
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
          Math.abs(v('headHorizontalOffset')),
          Math.abs(v('headVerticalOffset')),
          Math.abs(v('middleHorizontalOffset')),
          Math.abs(v('tailHorizontalOffset')),
          Math.abs(v('roll', 10)),
          Math.abs(v('pitch', 10)),
        ],
        areaStyle: { color: 'rgba(18,217,255,.24)' },
        lineStyle: { color: '#38f5b1', width: 3 },
        itemStyle: { color: '#ffd45c' },
      }],
    }],
  };
}

function predictionOption(pos: AnyObj) {
  const m = pos.guidanceMetrics || {};
  const headH = num(m.headHorizontalOffset?.value, 0);
  const headV = num(m.headVerticalOffset?.value, 0);
  const hTrend = num(m.horizontalTrend?.value, 0);
  const vTrend = num(m.verticalTrend?.value, 0);
  const preds = pos.predictionOffsets || [];
  const x = [0, 1, 2, 3, 4, 5];
  const h = x.map((d) => {
    if (d === 0) return headH;
    const item = preds.find((p: AnyObj) => num(p.distanceM) === d);
    return item?.horizontalOffset?.value ?? headH + hTrend * d;
  });
  const v = x.map((d) => {
    if (d === 0) return headV;
    const item = preds.find((p: AnyObj) => num(p.distanceM) === d);
    return item?.verticalOffset?.value ?? headV + vTrend * d;
  });
  return {
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: '#dffcff' }, top: 0 },
    grid: { left: 42, right: 16, top: 42, bottom: 28 },
    xAxis: { type: 'category', data: x.map((d) => `${d}m`), axisLabel: { color: '#baf8ff' } },
    yAxis: { type: 'value', name: 'mm', nameTextStyle: { color: '#baf8ff' }, axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    series: [
      { name: '水平偏差', type: 'line', smooth: true, data: h, lineStyle: { width: 3, color: '#12d9ff' }, itemStyle: { color: '#12d9ff' }, areaStyle: { color: 'rgba(18,217,255,.18)' } },
      { name: '垂直偏差', type: 'line', smooth: true, data: v, lineStyle: { width: 3, color: '#ffd45c' }, itemStyle: { color: '#ffd45c' } },
    ],
  };
}

function historyOption(history: AnyObj) {
  const items = history?.items || [];
  const xs = items.map((x: AnyObj) => String(x.timestamp || x.receivedAt || '').slice(11, 19));
  return {
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: '#dffcff' }, top: 0 },
    grid: { left: 42, right: 18, top: 42, bottom: 30 },
    xAxis: { type: 'category', data: xs, axisLabel: { color: '#baf8ff', rotate: 35 } },
    yAxis: [
      { type: 'value', name: '速度/压力', axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
      { type: 'value', name: '间隙', axisLabel: { color: '#baf8ff' }, splitLine: { show: false } },
    ],
    series: [
      { name: '推进速度', type: 'line', smooth: true, data: items.map((x: AnyObj) => num(x.advanceSpeed)), lineStyle: { color: '#38f5b1', width: 3 }, itemStyle: { color: '#38f5b1' } },
      { name: '开挖仓压力1#', type: 'line', smooth: true, data: items.map((x: AnyObj) => num(x.chamberPressure1)), lineStyle: { color: '#12d9ff', width: 3 }, itemStyle: { color: '#12d9ff' } },
      { name: '盾尾间隙1#', type: 'bar', yAxisIndex: 1, data: items.map((x: AnyObj) => num(x.shieldTailGap1)), itemStyle: { color: '#ffd45c' } },
    ],
  };
}

function alertsOption(alerts: AnyObj) {
  const items = alerts?.items || [];
  const top = items.slice(0, 12).reverse();
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 88, right: 28, top: 20, bottom: 24 },
    xAxis: { type: 'value', name: '距离m', axisLabel: { color: '#baf8ff' }, splitLine: { lineStyle: { color: 'rgba(18,217,255,.12)' } } },
    yAxis: { type: 'category', data: top.map((x: AnyObj) => x.pointCode || '--'), axisLabel: { color: '#baf8ff' } },
    series: [{
      name: '距当前位置/风险源',
      type: 'bar',
      data: top.map((x: AnyObj) => x.distanceM ?? 0),
      label: { show: true, position: 'right', color: '#eaffff', formatter: (p: AnyObj) => `${p.value || '--'}m` },
      itemStyle: { color: (p: AnyObj) => p.dataIndex >= top.length - 3 ? '#ff6b7b' : '#12d9ff' },
    }],
  };
}

function metric(m: AnyObj, key: string) {
  const f = m?.[key];
  return <div className="v421-metric"><span>{f?.nameCn || key}</span><b>{fmt(f?.value, f?.unit || '')}</b></div>;
}

function Cockpit() {
  const posResp = useApi('/api/position-context?deviceId=DZ1360', 5000);
  const historyResp = useApi('/api/tbm/history?deviceId=DZ1360&limit=80', 8000);
  const alertsResp = useApi('/api/monitoring/nearby-alerts?deviceId=DZ1360&limit=36', 8000);
  const tbmResp = useApi('/api/tbm/frontend-summary?deviceId=DZ1360', 5000);

  const pos = posResp.data?.data || {};
  const alerts = alertsResp.data?.data || {};
  const history = historyResp.data?.data || {};
  const tbm = tbmResp.data?.data || {};
  const gm = pos.guidanceMetrics || {};
  const matchedRisk = pos.matchedRiskSources?.[0];
  const latestItems = alerts.items || [];

  const riskOption = useMemo(() => riskWindowOption(pos), [JSON.stringify(pos.nearestRiskSources), pos.headMileageM]);
  const poseOption = useMemo(() => poseRadarOption(pos), [JSON.stringify(pos.guidanceMetrics)]);
  const predOption = useMemo(() => predictionOption(pos), [JSON.stringify(pos.predictionOffsets), JSON.stringify(pos.guidanceMetrics)]);
  const histOption = useMemo(() => historyOption(history), [JSON.stringify(history.items || [])]);
  const alertOption = useMemo(() => alertsOption(alerts), [JSON.stringify(alerts.items || [])]);

  const advanceSpeed = fieldValue(tbm, 'advanceSpeed');
  const penetration = fieldValue(tbm, 'penetration');
  const pressure1 = fieldValue(tbm, 'chamberPressure1');
  const gap1 = fieldValue(tbm, 'shieldTailGap1');

  return (
    <Shell>
      <section className="v421-hero">
        <div>
          <span>实时导向研判 / 风险源联动 / 监测预警邻近排序</span>
          <h1>第 {fmt(pos.guidanceRing, '')} 环 · {pos.headMileageText || '--'} · {matchedRisk ? `${matchedRisk.crossingRelation || ''}${matchedRisk.riskName}` : '风险源复核'}</h1>
          <p>
            盾首 {pos.headMileageText || '--'}，盾中 {pos.middleMileageText || '--'}，盾尾 {pos.tailMileageText || '--'}。
            {pos.engineeringRing?.ringNo ? ` 工程环 ${pos.engineeringRing.ringNo}，施工阶段：${pos.engineeringRing.constructionStage || '--'}。` : ''}
          </p>
        </div>
        <div className="v421-hero-kpis">
          <b>{pos.headMileageText || '--'}</b>
          <span>{matchedRisk ? `${matchedRisk.riskName} / ${matchedRisk.protectionLevel || matchedRisk.riskLevel || ''}` : '实时导向'}</span>
        </div>
      </section>

      <section className="v421-cockpit-grid">
        <aside className="v421-panel v421-left">
          <h3>当前位置与风险窗口</h3>
          <div className="v421-info-list">
            <p><span>导向环号</span><b>{fmt(pos.guidanceRing)}</b></p>
            <p><span>工程环号</span><b>{pos.engineeringRing?.ringNo || '--'}</b></p>
            <p><span>盾首里程</span><b>{pos.headMileageText || '--'}</b></p>
            <p><span>当前风险源</span><b>{matchedRisk?.riskName || '--'}</b></p>
            <p><span>关系/等级</span><b>{matchedRisk ? `${matchedRisk.crossingRelation || '--'} / ${matchedRisk.protectionLevel || matchedRisk.riskLevel || '--'}` : '--'}</b></p>
          </div>

          <h3>导向姿态</h3>
          <div className="v421-metrics">
            {metric(gm, 'headHorizontalOffset')}
            {metric(gm, 'headVerticalOffset')}
            {metric(gm, 'roll')}
            {metric(gm, 'pitch')}
            {metric(gm, 'horizontalTrend')}
            {metric(gm, 'verticalTrend')}
          </div>
        </aside>

        <section className="v421-main-visual">
          <div className="v421-tunnel">
            <div className="v421-shield">
              <i />
              <strong>{pos.headMileageText || 'DK--'}</strong>
              <span>盾构姿态 / 风险窗口 / 监测响应联动</span>
            </div>
            <div className="v421-risk-tag">{matchedRisk ? `${matchedRisk.riskName}${matchedRisk.crossingRelation || ''}` : '待匹配风险源'}</div>
          </div>

          <div className="v421-panel">
            <h3>风险窗口里程轴</h3>
            <EChart option={riskOption} height={250} />
          </div>
        </section>

        <aside className="v421-panel v421-right">
          <h3>离当前位置最近的预警</h3>
          <div className="v421-alert-list">
            {latestItems.slice(0, 8).map((x: AnyObj, idx: number) => (
              <div key={`${x.pointCode}-${idx}`} className={`level-${x.alertLevelCn || '待复核'}`}>
                <b>{x.pointCode || '--'}</b>
                <span>{x.alertLevelCn || '--'} · {x.monitoringItemCn || '--'}</span>
                <em>{x.distanceM === null || x.distanceM === undefined ? x.rankingReason : `距当前 ${fmt(x.distanceM, 'm')}`}</em>
              </div>
            ))}
            {!latestItems.length ? <p className="v421-empty">暂无邻近预警，检查 /api/monitoring/nearby-alerts</p> : null}
          </div>
        </aside>
      </section>

      <section className="v421-chart-grid">
        <div className="v421-panel">
          <h3>盾构姿态雷达</h3>
          <EChart option={poseOption} height={280} />
        </div>
        <div className="v421-panel">
          <h3>前方 1～5m 偏差预测</h3>
          <EChart option={predOption} height={280} />
          <small>若导向预测字段为空，则按当前偏差与趋势作短距推演展示。</small>
        </div>
        <div className="v421-panel">
          <h3>近时段掘进参数联动</h3>
          <EChart option={histOption} height={280} />
        </div>
        <div className="v421-panel">
          <h3>邻近预警排序</h3>
          <EChart option={alertOption} height={280} />
          <small>排序优先级：当前风险源 / 最近风险源 / 测点里程距离 / 报警等级 / 最新时间。</small>
        </div>
      </section>

      <section className="v421-bottom-grid">
        <div className="v421-panel">
          <h3>当前参数快照</h3>
          <div className="v421-param-row">
            <p><span>推进速度</span><b>{fmt(advanceSpeed, 'mm/min')}</b></p>
            <p><span>贯入度</span><b>{fmt(penetration, 'mm/r')}</b></p>
            <p><span>开挖仓压力1#</span><b>{fmt(pressure1, 'bar')}</b></p>
            <p><span>盾尾间隙1#</span><b>{fmt(gap1, 'mm')}</b></p>
          </div>
        </div>
        <div className="v421-panel">
          <h3>当前研判结论</h3>
          <ul className="v421-conclusion">
            <li>当前位置已由实时导向里程进入工程里程体系，不再使用演示公式作为主结论。</li>
            <li>当前位于 {matchedRisk?.riskName || '风险源'} 窗口附近，监测预警按当前位置邻近关系优先展示。</li>
            <li>姿态、泥水、注浆、管片盾尾后续均可围绕同一里程点联动分析。</li>
          </ul>
        </div>
      </section>
    </Shell>
  );
}

export default Cockpit;
