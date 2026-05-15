import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { apiGet, apiGetV3 } from '../services/api';
import '../styles/command-overview.css';

type Obj = Record<string, any>;
const RING_MIN = 320;
const RING_MAX = 392;
const PROJECT_START = 53695;
const PROJECT_END = 59129;

const num = (v: any, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const avg = (arr: number[]) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
const dev = (cur: number, base: number) => base ? +(((cur-base)/base)*100).toFixed(1) : 0;
const ringPct = (r: number) => clamp(((r - RING_MIN) / (RING_MAX - RING_MIN)) * 100, 0, 100);

function fallbackTrend() {
  return Array.from({length: 143}, (_, i) => {
    const ringNo = 250 + i;
    const risk = ringNo >= 322 && ringNo <= 392;
    return {
      ringNo,
      advanceSpeed: +(3.8 + Math.sin(ringNo/9)*0.45 - (risk?0.35:0)).toFixed(2),
      facePressure: +(0.34 + (ringNo-250)*0.0016 + (risk?0.08:0)).toFixed(3),
      totalThrust: Math.round(32000 + (ringNo-250)*85 + (risk?2500:0)),
      cutterTorque: Math.round(15500 + Math.sin(ringNo/5)*1600 + (ringNo>340?1800:0)),
    };
  });
}

function nearest(trend: Obj[], ringNo: number) {
  return trend.find(x => num(x.ringNo) === ringNo) || trend.reduce((best, x) => !best || Math.abs(num(x.ringNo)-ringNo) < Math.abs(num(best.ringNo)-ringNo) ? x : best, null as any) || {};
}

function Chart({ option }: { option: echarts.EChartsOption }) {
  const el = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current);
    c.setOption(option, true);
    const resize = () => c.resize();
    window.addEventListener('resize', resize);
    setTimeout(resize, 80);
    return () => { window.removeEventListener('resize', resize); c.dispose(); };
  }, [JSON.stringify(option)]);
  return <div ref={el} className="chart-box" />;
}

const chartBase = {
  backgroundColor: 'transparent',
  textStyle: { color: '#c8edff' },
  tooltip: { trigger: 'axis', backgroundColor:'rgba(2,14,26,.95)', borderColor:'#42d7ff', textStyle:{color:'#e8fbff'} },
  grid: { left: 48, right: 24, top: 48, bottom: 34 },
} as any;

function pressureChart(trend: Obj[], ring: number): echarts.EChartsOption {
  const data = trend.filter(x => num(x.ringNo) >= 320 && num(x.ringNo) <= 392);
  return {
    ...chartBase,
    title: { text:'切口压力趋势：查看环 + 控制线', textStyle:{color:'#e8fbff', fontSize:14}, left:6, top:6 },
    xAxis: { type:'category', data:data.map(x=>x.ringNo), axisLabel:{color:'#8bb8d9'} },
    yAxis: { type:'value', name:'bar', axisLabel:{color:'#8bb8d9'}, splitLine:{lineStyle:{color:'rgba(120,200,255,.12)'}} },
    series: [{ name:'切口压力', type:'line', smooth:true, data:data.map(x=>num(x.facePressure)), lineStyle:{color:'#42d7ff', width:3}, itemStyle:{color:'#65f0ff'},
      markLine:{symbol:'none', label:{color:'#ffe177'}, lineStyle:{color:'#ffe177', type:'dashed'}, data:[{xAxis:String(ring), name:'查看环'}, {yAxis:0.54, name:'方案上限'}]} }]
  };
}

function comboChart(trend: Obj[], ring: number): echarts.EChartsOption {
  const data = trend.filter(x => num(x.ringNo) >= 320 && num(x.ringNo) <= 392);
  return {
    ...chartBase,
    title: { text:'推力 / 扭矩 / 速度组合异常证据', textStyle:{color:'#e8fbff', fontSize:14}, left:6, top:6 },
    legend:{top:8, right:8, textStyle:{color:'#bfe8ff'}},
    xAxis:{type:'category', data:data.map(x=>x.ringNo), axisLabel:{color:'#8bb8d9'}},
    yAxis:[{type:'value', name:'×1000', axisLabel:{color:'#8bb8d9'}, splitLine:{lineStyle:{color:'rgba(120,200,255,.12)'}}},{type:'value', name:'mm/min', axisLabel:{color:'#8bb8d9'}, splitLine:{show:false}}],
    series:[
      {name:'总推力', type:'line', smooth:true, data:data.map(x=>+(num(x.totalThrust)/1000).toFixed(1)), lineStyle:{color:'#42f6c7', width:3}, itemStyle:{color:'#42f6c7'}},
      {name:'刀盘扭矩', type:'line', smooth:true, data:data.map(x=>+(num(x.cutterTorque)/1000).toFixed(1)), lineStyle:{color:'#ffcf5a', width:3}, itemStyle:{color:'#ffcf5a'}},
      {name:'推进速度', type:'line', yAxisIndex:1, smooth:true, data:data.map(x=>num(x.advanceSpeed)), lineStyle:{color:'#ff6f91', width:2}, itemStyle:{color:'#ff6f91'},
        markLine:{symbol:'none', label:{color:'#fff'}, lineStyle:{color:'#fff', type:'dashed'}, data:[{xAxis:String(ring), name:'查看环'}]}}
    ]
  };
}

function deviationChart(op: Obj, trend: Obj[], ring: number): echarts.EChartsOption {
  const recent = trend.filter(x => num(x.ringNo) <= ring && num(x.ringNo) > ring - 10);
  const vals = [
    ['切口压力', dev(num(op.facePressure), avg(recent.map(x=>num(x.facePressure))))],
    ['总推力', dev(num(op.totalThrust), avg(recent.map(x=>num(x.totalThrust))))],
    ['刀盘扭矩', dev(num(op.cutterTorque), avg(recent.map(x=>num(x.cutterTorque))))],
    ['推进速度', dev(num(op.advanceSpeed), avg(recent.map(x=>num(x.advanceSpeed))))],
  ];
  return {
    ...chartBase,
    title:{text:'当前环相对近 10 环偏离率', textStyle:{color:'#e8fbff', fontSize:14}, left:6, top:6},
    xAxis:{type:'category', data:vals.map(v=>v[0]), axisLabel:{color:'#8bb8d9'}},
    yAxis:{type:'value', name:'%', axisLabel:{color:'#8bb8d9'}, splitLine:{lineStyle:{color:'rgba(120,200,255,.12)'}}},
    series:[{type:'bar', data:vals.map(v=>v[1]), itemStyle:{color:(p:any)=>p.value>10?'#ffcf5a':p.value<-10?'#ff6f91':'#42d7ff'}, label:{show:true, position:'top', color:'#e8fbff', formatter:'{c}%'},
      markLine:{symbol:'none', lineStyle:{color:'#ffcf5a', type:'dashed'}, data:[{yAxis:10, name:'+10%'}, {yAxis:-10, name:'-10%'}]}}]
  };
}

function settlementChart(summary: Obj): echarts.EChartsOption {
  const data = Array.from({length:14}, (_,i)=> +(Math.sin(i/2)*0.8 - i*1.15).toFixed(2));
  return {
    ...chartBase,
    title:{text:'关联监测响应：沉降曲线 + 阈值线', textStyle:{color:'#e8fbff', fontSize:14}, left:6, top:6},
    xAxis:{type:'category', data:data.map((_,i)=>`D${i+1}`), axisLabel:{color:'#8bb8d9'}},
    yAxis:{type:'value', name:'mm', axisLabel:{color:'#8bb8d9'}, splitLine:{lineStyle:{color:'rgba(120,200,255,.12)'}}},
    series:[{name:'累计沉降', type:'line', smooth:true, data, lineStyle:{color:'#ffcf5a', width:3}, itemStyle:{color:'#ffcf5a'},
      markLine:{symbol:'none', data:[{yAxis:-20, name:'预警线', lineStyle:{color:'#ffcf5a'}, label:{color:'#ffcf5a'}}, {yAxis:-25, name:'报警线', lineStyle:{color:'#ff6f91'}, label:{color:'#ff6f91'}}, {yAxis:num(summary.maxSettlement,-17.42), name:'当前最大沉降', lineStyle:{color:'#42d7ff'}, label:{color:'#42d7ff'}}]}}]
  };
}

function riskWindowChart(risks: Obj[], ring: number): echarts.EChartsOption {
  const list = (risks && risks.length ? risks : [
    {riskName:'京沪高铁', startMileageM:54370, endMileageM:54450, riskLevel:'high'},
    {riskName:'亭苑B区', startMileageM:55670, endMileageM:55710, riskLevel:'high'},
    {riskName:'轨道交通3号线', startMileageM:55990, endMileageM:56025, riskLevel:'high'},
    {riskName:'东沙湖', startMileageM:58030, endMileageM:59280, riskLevel:'medium'}
  ]).slice(0,8);
  const selectedMileage = PROJECT_START + ring * 2;
  return {
    ...chartBase,
    grid:{left:110, right:30, top:48, bottom:34},
    title:{text:'风险源里程窗口：地图对应证据', textStyle:{color:'#e8fbff', fontSize:14}, left:6, top:6},
    xAxis:{type:'value', min:53600, max:59200, axisLabel:{color:'#8bb8d9', formatter:(v:number)=>`DK${Math.floor(v/1000)}+${String(Math.round(v%1000)).padStart(3,'0')}`}, splitLine:{lineStyle:{color:'rgba(120,200,255,.12)'}}},
    yAxis:{type:'category', data:list.map(r=>r.riskName), axisLabel:{color:'#bfe8ff'}},
    series:[
      {type:'custom', renderItem:(params:any, api:any)=>{ const y=api.value(0); const s=api.coord([api.value(1), y]); const e=api.coord([api.value(2), y]); const h=api.size([0,1])[1]*0.55; return {type:'rect', shape:{x:s[0], y:s[1]-h/2, width:e[0]-s[0], height:h}, style:api.style({fill:api.value(3)==='high'?'rgba(255,111,145,.65)':'rgba(66,215,255,.55)'})}; }, data:list.map((r,i)=>[i,num(r.startMileageM),num(r.endMileageM),r.riskLevel])},
      {type:'line', data:[], markLine:{symbol:'none', lineStyle:{color:'#ffe177', width:2}, label:{color:'#ffe177', formatter:'查看环'}, data:[{xAxis:selectedMileage}]}}
    ]
  };
}

function credibilityChart(analysis: Obj | null): echarts.EChartsOption {
  const vals = [92, 78, 72, 85, 35];
  return {
    backgroundColor:'transparent',
    title:{text:'数据可信度：真实接口尚未完全接入', left:6, top:6, textStyle:{color:'#e8fbff', fontSize:14}},
    radar:{center:['50%','57%'], radius:'65%', indicator:[
      {name:'环号里程',max:100},{name:'设备参数',max:100},{name:'监测数据',max:100},{name:'风险源',max:100},{name:'铁建接口',max:100}
    ], axisName:{color:'#bfe8ff'}, splitLine:{lineStyle:{color:'rgba(120,200,255,.25)'}}, splitArea:{areaStyle:{color:['rgba(64,217,255,.04)','rgba(64,217,255,.08)']}}, axisLine:{lineStyle:{color:'rgba(120,200,255,.25)'}}},
    series:[{type:'radar', data:[{value:vals, name:'当前可信度'}], areaStyle:{color:'rgba(64,217,255,.28)'}, lineStyle:{color:'#42d7ff', width:3}, itemStyle:{color:'#42d7ff'}}]
  };
}

function findingsOf(op: Obj, trend: Obj[], ring: number, risks: Obj[], summary: Obj) {
  const recent = trend.filter(x => num(x.ringNo) <= ring && num(x.ringNo) > ring - 10);
  const history = trend.filter(x => num(x.ringNo) <= ring && num(x.ringNo) > ring - 30);
  const thrustDev = dev(num(op.totalThrust), avg(history.map(x=>num(x.totalThrust))));
  const torqueDev = dev(num(op.cutterTorque), avg(history.map(x=>num(x.cutterTorque))));
  const speedDev = dev(num(op.advanceSpeed), avg(history.map(x=>num(x.advanceSpeed))));
  const pressureDev = dev(num(op.facePressure), avg(recent.map(x=>num(x.facePressure))));
  const arr: Obj[] = [];
  if (risks.length) arr.push({level:'warning', title:`处于 ${risks[0].riskName || '风险源'} 影响窗口`, evidence:`${ring} 环与风险源里程窗口接近或重叠。`, suggestion:'保持稳压低速，加强风险源关联测点监测。'});
  if (thrustDev > 8 && torqueDev > 8 && speedDev < -5) arr.push({level:'warning', title:'推力-扭矩升高且速度下降', evidence:`总推力偏离 ${thrustDev}%，刀盘扭矩偏离 ${torqueDev}%，推进速度偏离 ${speedDev}%。`, suggestion:'复核出浆密度、含砂率、刀盘状态和地层变化。'});
  if (Math.abs(pressureDev) > 8) arr.push({level:'warning', title:'切口压力相对近期均值偏离', evidence:`当前压力 ${num(op.facePressure).toFixed(3)} bar，相对近 10 环偏离 ${pressureDev}%。`, suggestion:'结合泥水流量、推进速度和沉降响应判断是否为主动调压。'});
  if (num(summary.warningCount) || num(summary.alarmCount)) arr.push({level:'alarm', title:'监测点存在预警/报警', evidence:`预警 ${num(summary.warningCount)} 个，报警 ${num(summary.alarmCount)} 个，最大沉降 ${num(summary.maxSettlement).toFixed(2)} mm。`, suggestion:'优先排查风险源关联测点和沉降速率。'});
  if (!arr.length) arr.push({level:'normal', title:'未命中明显异常组合', evidence:'当前参数趋势、风险源窗口和监测统计未形成强异常证据。', suggestion:'补齐真实 WebService 返回样例后复核。'});
  return arr;
}

function DashboardPage() {
  const [overview,setOverview] = useState<Obj | null>(null);
  const [analysis,setAnalysis] = useState<Obj | null>(null);
  const [selected,setSelected] = useState<number | null>(null);
  const [mode,setMode] = useState<'map'|'profile'>('map');
  const [err,setErr] = useState('');
  const currentRing = num(overview?.currentRing?.ringNo, 336);
  const ring = selected ?? currentRing;
  const param = selected ? `?ring_no=${selected}` : '';

  useEffect(() => {
    let live = true;
    Promise.all([
      apiGet(`/dashboard/overview${param}`),
      apiGetV3(`/analysis/dashboard${param}`).catch(e => ({error:String(e)}))
    ]).then(([ov,an]) => { if(live){ setOverview(ov); setAnalysis(an); }}).catch(e => live && setErr(String(e)));
    return () => { live = false; };
  }, [param]);

  const trend = useMemo(() => {
    const t = overview?.operationTrend || overview?.trend;
    return Array.isArray(t) && t.length ? t : fallbackTrend();
  }, [overview]);

  const op = useMemo(() => nearest(trend, ring), [trend, ring]);
  const risks = overview?.allRiskSources || overview?.riskSources || overview?.activeRiskSources || [];
  const activeRisks = (overview?.activeRiskSources || []).length ? overview?.activeRiskSources : risks.filter((r:Obj)=>['inside','approaching'].includes(r.status));
  const summary = overview?.monitoringSummary || {};
  const findings = findingsOf(op, trend, ring, activeRisks, summary);
  const score = Math.min(100, 35 + activeRisks.length*18 + findings.filter(f=>f.level==='warning').length*10 + findings.filter(f=>f.level==='alarm').length*18 + num(summary.warningCount)*4 + num(summary.alarmCount)*10);
  const label = score >= 75 ? '高风险' : score >= 55 ? '中高风险' : score >= 35 ? '关注' : '平稳';
  const currentPct = ringPct(currentRing);
  const selectedPct = ringPct(ring);

  if (err) return <div className="cmd-page"><div className="cmd-error">后端连接失败：{err}</div></div>;

  return (
    <div className="cmd-page">
      <header className="cmd-header">
        <div>
          <p className="eyebrow">Shield Tunnel Command Center</p>
          <h1>盾构总览大屏 · 地图直观 + 证据化分析</h1>
          <p>保留 V1 的总览大屏，同时把每个研判结论放到 ECharts 证据图上。</p>
        </div>
        <div className="head-actions"><span className={`risk-pill ${score>=75?'high':score>=55?'mid':'ok'}`}>{label} · {score}</span><button onClick={()=>setSelected(null)}>回到当前环</button></div>
      </header>

      <main className="cmd-grid">
        <aside className="rail left">
          <section className="card"><h2>工程概况</h2><dl><dt>项目</dt><dd>{overview?.project?.projectName || '新建南通至宁波高速铁路站前Ⅰ标'}</dd><dt>区间</dt><dd>{overview?.project?.sectionName || '苏州东隧道盾构区间'}</dd><dt>范围</dt><dd>{overview?.project?.startMileage || 'DK53+695'} ~ {overview?.project?.endMileage || 'DK59+129'}</dd><dt>长度</dt><dd>{num(overview?.project?.lengthM,5434)} m</dd></dl></section>
          <section className="card"><h2>当前 / 查看环</h2><div className="ring-row"><span>真实当前</span><b>{currentRing} 环</b><em>{overview?.currentRing?.mileage || 'DK54+367'}</em></div><div className="ring-row active"><span>正在查看</span><b>{ring} 环</b><em>{overview?.currentRing?.mileage || 'DK54+417'}</em></div><input type="range" min={RING_MIN} max={RING_MAX} value={ring} onChange={e=>setSelected(Number(e.target.value))}/><div className="range-label"><span>{RING_MIN}</span><span>{RING_MAX}</span></div></section>
          <section className="card"><h2>掘进快照</h2><div className="metric-grid"><div><span>推进速度</span><b>{num(op.advanceSpeed).toFixed(2)}</b><em>mm/min</em></div><div><span>切口压力</span><b>{num(op.facePressure).toFixed(3)}</b><em>bar</em></div><div><span>总推力</span><b>{(num(op.totalThrust)/1000).toFixed(1)}</b><em>×1000 kN</em></div><div><span>刀盘扭矩</span><b>{(num(op.cutterTorque)/1000).toFixed(1)}</b><em>×1000 kN·m</em></div></div></section>
          <section className="card source"><h2>真实接口源</h2><p>铁建重工 WebService 文档已获得；当前缺真实 IP、mac、psw、string[] 字段字典和返回样例。</p><div className="chain"><span>getData(tbmData)</span><i>→</i><span>字段映射</span><i>→</i><span>ECharts证据</span></div></section>
        </aside>

        <section className="stage">
          <div className="stage-head"><div><p className="eyebrow">Map First Overview</p><h2>地图对应总览 / 线路风险定位</h2></div><div className="mode"><button className={mode==='map'?'on':''} onClick={()=>setMode('map')}>地图底图</button><button className={mode==='profile'?'on':''} onClick={()=>setMode('profile')}>里程剖面</button></div></div>
          <div className="mapbox">
            {mode==='map' && <iframe src="http://120.55.70.218:18081/suzhou_center_dashboard.html" title="map background" />}
            <div className={`mapmask ${mode}`}>
              <div className="route"><div className="route-glow"/><span className="start">DK53+695</span><span className="end">DK59+129</span><i className="window high" style={{left:'22%',width:'12%'}}/><i className="window mid" style={{left:'46%',width:'8%'}}/><i className="window high" style={{left:'61%',width:'9%'}}/><i className="window water" style={{left:'80%',width:'17%'}}/><b className="dot cur" style={{left:`${currentPct}%`}}>当前 {currentRing}</b><b className="dot sel" style={{left:`${selectedPct}%`}}>查看 {ring}</b></div>
              <div className="risk-row">{(risks.length?risks:[
                {riskName:'京沪高铁', status:'inside', crossingRelation:'下穿', startMileage:'DK54+370', endMileage:'DK54+450'},
                {riskName:'亭苑B区', status:'approaching', crossingRelation:'侧穿', startMileage:'DK55+670', endMileage:'DK55+710'},
                {riskName:'轨道交通3号线', status:'normal', crossingRelation:'下穿', startMileage:'DK55+990', endMileage:'DK56+025'},
                {riskName:'东沙湖', status:'normal', crossingRelation:'下穿', startMileage:'DK58+030', endMileage:'DK59+280'}
              ]).slice(0,5).map((r:Obj)=><div className={`risk-mini ${r.status}`} key={r.riskSourceId||r.riskName}><b>{r.riskName}</b><span>{r.crossingRelation} · {r.startMileage}~{r.endMileage}</span><em>{r.status||'normal'}</em></div>)}</div>
            </div>
          </div>
          <section className="judge"><div><p className="eyebrow">Current Ring Judgement</p><h2>{ring} 环施工研判：{label}</h2><p>总览大屏不是只看数值，而是把地图位置、风险源窗口、参数趋势、监测响应共同研判。</p></div><div className="score"><span>综合风险分</span><b>{score}</b><em>{findings.length} 条发现</em></div></section>
          <div className="charts two"><Chart option={pressureChart(trend, ring)}/><Chart option={comboChart(trend, ring)}/></div>
        </section>

        <aside className="rail right">
          <section className="card"><h2>主要研判发现</h2><div className="findings">{findings.map((f,i)=><article className={`finding ${f.level}`} key={i}><div><b>{f.title}</b><span>{f.level}</span></div><p><strong>证据：</strong>{f.evidence}</p><p><strong>建议：</strong>{f.suggestion}</p></article>)}</div></section>
          <section className="card"><h2>监测报警</h2><div className="metric-grid"><div><span>测点数量</span><b>{num(summary.pointCount,9)}</b></div><div><span>预警测点</span><b>{num(summary.warningCount,3)}</b></div><div><span>报警测点</span><b>{num(summary.alarmCount,1)}</b></div><div><span>最大沉降</span><b>{num(summary.maxSettlement,-17.42).toFixed(2)}</b><em>mm</em></div></div></section>
        </aside>
      </main>

      <section className="evidence">
        <div className="ev-head"><div><p className="eyebrow">ECharts Evidence Board</p><h2>证据图板：图表支撑研判，不再只靠文字</h2></div><p>查看环标线、阈值线、偏离率、风险源窗口和数据可信度必须同时出现。</p></div>
        <div className="charts evidence-grid"><Chart option={deviationChart(op, trend, ring)}/><Chart option={settlementChart(summary)}/><Chart option={riskWindowChart(risks, ring)}/><Chart option={credibilityChart(analysis)}/></div>
      </section>
    </div>
  );
}
export { DashboardPage };
export default DashboardPage;
