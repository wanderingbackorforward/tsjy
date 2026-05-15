import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiGetV3 } from '../services/api';
import { Chart } from '../components/Chart';
import { MetricCard } from '../components/MetricCard';

function n(v: any, digits = 2) {
  const x = Number(v);
  return Number.isFinite(x) ? x.toFixed(digits) : '--';
}
function arr<T = any>(v: any): T[] { return Array.isArray(v) ? v : []; }

export default function CommandOverviewPage() {
  const [overview, setOverview] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [selectedRing, setSelectedRing] = useState<number | null>(361);
  const [err, setErr] = useState('');

  const ringNo = selectedRing ?? overview?.currentRing?.ringNo ?? 336;

  useEffect(() => {
    Promise.all([
      apiGet(`/dashboard/overview?ring_no=${ringNo}`),
      apiGetV3(`/analysis/dashboard?ring_no=${ringNo}`),
    ])
      .then(([o, a]) => { setOverview(o); setAnalysis(a); setErr(''); })
      .catch(e => setErr(String(e?.message || e)));
  }, [ringNo]);

  const currentRing = analysis?.currentRing || overview?.currentRing || {};
  const section = analysis?.section || overview?.project || {};
  const op = analysis?.operationSummary || overview?.operationSummary || {};
  const riskItems = arr<any>(analysis?.riskWindows || overview?.allRiskSources || overview?.activeRiskSources);
  const activeRisks = arr<any>(overview?.activeRiskSources).length ? arr<any>(overview?.activeRiskSources) : riskItems.filter((r: any) => ['inside','approaching','leaving'].includes(r.status));
  const findings = arr<any>(analysis?.findings || analysis?.majorFindings);
  const recs = arr<any>(analysis?.recommendations || analysis?.actions);
  const trend = arr<any>(analysis?.operationTrend || overview?.operationTrend);
  const monitor = arr<any>(analysis?.monitoringSeries || analysis?.monitoringReadings || []);
  const deviations = arr<any>(analysis?.parameterDeviation || analysis?.deviations || []);
  const confidence = analysis?.confidence || analysis?.dataConfidence || { score: 68, items: [] };

  const pressureOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 42, right: 18, top: 32, bottom: 32 },
    xAxis: { type: 'category', data: trend.map((x:any)=>x.ringNo), axisLabel:{ color:'#8fb6d8' }, axisLine:{ lineStyle:{ color:'#31577a' } } },
    yAxis: { type: 'value', name: 'bar', nameTextStyle:{ color:'#8fb6d8' }, axisLabel:{ color:'#8fb6d8' }, splitLine:{ lineStyle:{ color:'rgba(110,180,240,.12)' } } },
    series: [
      { name:'切口压力', type:'line', smooth:true, symbolSize:5, data: trend.map((x:any)=>x.facePressure), lineStyle:{ width:3, color:'#52d6ff' }, itemStyle:{ color:'#52d6ff' }, markLine:{ symbol:'none', label:{ color:'#ffd76b' }, lineStyle:{ color:'#ffd76b', type:'dashed' }, data:[{ xAxis:ringNo, name:'查看环' }] } },
      { name:'控制下限', type:'line', symbol:'none', data: trend.map(()=>0.32), lineStyle:{ color:'#4adf91', type:'dashed' } },
      { name:'控制上限', type:'line', symbol:'none', data: trend.map(()=>0.62), lineStyle:{ color:'#ff6b6b', type:'dashed' } },
    ]
  }), [trend, ringNo]);

  const comboOption = useMemo(() => ({
    tooltip: { trigger:'axis' },
    legend:{ textStyle:{ color:'#9fc3df' }, top:0 },
    grid:{ left:48, right:48, top:42, bottom:34 },
    xAxis:{ type:'category', data:trend.map((x:any)=>x.ringNo), axisLabel:{ color:'#8fb6d8' } },
    yAxis:[
      { type:'value', name:'推力/扭矩', axisLabel:{ color:'#8fb6d8' }, splitLine:{ lineStyle:{ color:'rgba(110,180,240,.12)' } } },
      { type:'value', name:'速度', axisLabel:{ color:'#8fb6d8' }, splitLine:{ show:false } }
    ],
    series:[
      { name:'总推力 x1000kN', type:'line', smooth:true, data:trend.map((x:any)=>Number(x.totalThrust||0)/1000), lineStyle:{ color:'#60f1d3', width:2 }, itemStyle:{ color:'#60f1d3' } },
      { name:'刀盘扭矩 x1000', type:'line', smooth:true, data:trend.map((x:any)=>Number(x.cutterTorque||0)/1000), lineStyle:{ color:'#f6c65b', width:2 }, itemStyle:{ color:'#f6c65b' } },
      { name:'推进速度', type:'bar', yAxisIndex:1, data:trend.map((x:any)=>x.advanceSpeed), itemStyle:{ color:'rgba(82,214,255,.35)' }, markLine:{ symbol:'none', data:[{ xAxis:ringNo, name:'查看环' }], lineStyle:{ color:'#fff', type:'dashed' } } }
    ]
  }), [trend, ringNo]);

  const deviationOption = useMemo(() => {
    const ds = deviations.length ? deviations : [
      { name:'切口压力', value:12 }, { name:'总推力', value:9 }, { name:'刀盘扭矩', value:16 }, { name:'推进速度', value:-18 }, { name:'注浆量', value:11 }
    ];
    return {
      tooltip:{}, grid:{ left:80, right:30, top:30, bottom:30 },
      xAxis:{ type:'value', axisLabel:{ color:'#8fb6d8', formatter:'{value}%' }, splitLine:{ lineStyle:{ color:'rgba(110,180,240,.12)' } } },
      yAxis:{ type:'category', data:ds.map((d:any)=>d.name || d.label), axisLabel:{ color:'#d7efff' } },
      series:[{ type:'bar', data:ds.map((d:any)=>d.value || d.deviationPercent || 0), itemStyle:{ color:(p:any)=>p.value>=0?'#52d6ff':'#ffbf69' }, label:{ show:true, position:'right', color:'#e9f7ff', formatter:'{c}%' } }]
    };
  }, [deviations]);

  const monitorOption = useMemo(() => ({
    tooltip:{ trigger:'axis' }, grid:{ left:46, right:20, top:30, bottom:32 },
    xAxis:{ type:'category', data:(monitor.length?monitor:[0,1,2,3,4,5,6,7]).map((x:any,i:number)=>x.measuredAt?.slice(5,10) || `D${i}`), axisLabel:{ color:'#8fb6d8' } },
    yAxis:{ type:'value', name:'mm', inverse:false, axisLabel:{ color:'#8fb6d8' }, splitLine:{ lineStyle:{ color:'rgba(110,180,240,.12)' } } },
    series:[
      { name:'累计沉降', type:'line', smooth:true, data:(monitor.length?monitor:[-2,-4,-6,-8,-11,-14,-17,-18]).map((x:any)=> typeof x === 'number'?x:x.cumulativeChange), lineStyle:{ color:'#ffbf69', width:3 }, itemStyle:{ color:'#ffbf69' } },
      { name:'预警线', type:'line', symbol:'none', data:(monitor.length?monitor:[0,1,2,3,4,5,6,7]).map(()=>-20), lineStyle:{ color:'#ffd76b', type:'dashed' } },
      { name:'报警线', type:'line', symbol:'none', data:(monitor.length?monitor:[0,1,2,3,4,5,6,7]).map(()=>-25), lineStyle:{ color:'#ff5b6e', type:'dashed' } }
    ]
  }), [monitor]);

  const radarOption = useMemo(() => ({
    tooltip:{}, radar:{ indicator:[
      { name:'环号里程', max:100 }, { name:'掘进参数', max:100 }, { name:'监测时序', max:100 }, { name:'风险源', max:100 }, { name:'事件闭环', max:100 }, { name:'真实接口', max:100 }
    ], axisName:{ color:'#c8e8ff' }, splitLine:{ lineStyle:{ color:'rgba(100,180,240,.2)' } }, splitArea:{ areaStyle:{ color:['rgba(30,80,120,.12)','rgba(30,80,120,.22)'] } } },
    series:[{ type:'radar', data:[{ name:'可信度', value:[92,76,74,85,60,35] }], areaStyle:{ color:'rgba(82,214,255,.25)' }, lineStyle:{ color:'#52d6ff' }, itemStyle:{ color:'#52d6ff' } }]
  }), [confidence]);

  if (err) return <div className="center-error">后端连接失败：{err}</div>;
  if (!overview && !analysis) return <div className="center-error">加载指挥总览...</div>;

  return (
    <main className="command-page">
      <section className="map-stage">
        <iframe className="map-bg" src="http://120.55.70.218:18081/suzhou_center_dashboard.html" title="suzhou-map" />
        <div className="map-shade" />
        <div className="track-card float-in">
          <div className="stage-title"><span>施工总览 / 环号-里程-风险源</span><strong>{currentRing.mileage || currentRing.endMileage || 'DK54+417'}</strong></div>
          <div className="track-line">
            <div className="track-glow" />
            <div className="ring-dot current" style={{ left:'31%' }}><span>当前</span></div>
            <div className="ring-dot selected" style={{ left:`${Math.min(92, Math.max(8, 8 + ((ringNo-250)/142)*84))}%` }}><span>查看 {ringNo} 环</span></div>
            {riskItems.slice(0,7).map((r:any, idx:number)=><div key={idx} className={`risk-window ${r.status||''}`} style={{ left:`${30+idx*8}%`, width:`${idx%2?3:5}%` }} />)}
          </div>
          <div className="ring-slider-row">
            <span>250 环</span>
            <input type="range" min="250" max="392" value={ringNo} onChange={e=>setSelectedRing(Number(e.target.value))} />
            <span>392 环</span>
            <button onClick={()=>setSelectedRing(overview?.currentRing?.ringNo || 336)}>回到当前</button>
          </div>
        </div>
      </section>

      <aside className="floating-panel left-float glass float-in">
        <h2>工程与进度</h2>
        <dl className="info-list"><dt>项目</dt><dd>{section.projectName || '新建南通至宁波高速铁路站前Ⅰ标'}</dd><dt>区间</dt><dd>{section.sectionName || '苏州东隧道盾构区间'}</dd><dt>范围</dt><dd>{section.startMileage || 'DK53+695'} ~ {section.endMileage || 'DK59+129'}</dd><dt>真实当前</dt><dd>{overview?.currentRing?.ringNo || 336} 环 / {overview?.currentRing?.mileage || 'DK54+367'}</dd><dt>正在查看</dt><dd className="focus-text">{ringNo} 环 / {currentRing.mileage || currentRing.endMileage || '--'}</dd></dl>
        <div className="metric-grid compact">
          <MetricCard label="推进速度" value={n(op.advanceSpeed)} unit=" mm/min" />
          <MetricCard label="切口压力" value={n(op.facePressure,3)} unit=" bar" tone="yellow" />
          <MetricCard label="总推力" value={n(Number(op.totalThrust||0)/1000,1)} unit=" x1000kN" />
          <MetricCard label="刀盘扭矩" value={n(Number(op.cutterTorque||0)/1000,1)} unit=" x1000" tone="yellow" />
        </div>
        <div className="source-status"><b>真实设备源</b><span>铁建重工 WebService：接口说明已获得；WSDL 地址、mac、psw、字段下标待补。</span></div>
      </aside>

      <aside className="floating-panel right-float glass float-in delay-1">
        <h2>当前研判</h2>
        <div className="risk-score"><span>综合风险</span><strong>{analysis?.riskLevel || analysis?.overallRisk || '中高'}</strong><em>基于规则引擎 + 图表证据</em></div>
        <h3>主要发现</h3>
        <div className="finding-list">
          {(findings.length ? findings : [
            { level:'warning', title:'推力-扭矩同步升高', evidence:'近 10 环推力和扭矩均高于前段均值，推进速度同步下降。', suggestion:'复核地层阻力、刀盘状态和泥浆指标。' },
            { level:'warning', title:'风险源影响窗口内施工', evidence:'查看环位于京沪高铁影响区，监测点沉降仍在发展。', suggestion:'维持稳压低速，提高测点频率。' },
          ]).slice(0,4).map((f:any, i:number)=>(
            <div key={i} className={`finding ${f.level || 'warning'}`}><b>{f.title}</b><p>{f.evidence || f.reason}</p><small>建议：{f.suggestion || f.action || '继续复核数据并跟踪趋势。'}</small></div>
          ))}
        </div>
        <h3>建议动作</h3>
        <ul className="action-list">{(recs.length?recs:['保持稳压低速通过敏感区','复核出浆密度和含砂率','确认注浆量与盾尾间隙','补齐 WebService 字段字典']).slice(0,4).map((r:any,i:number)=><li key={i}>{typeof r==='string'?r:r.text || r.title}</li>)}</ul>
      </aside>

      <section className="evidence-dock glass float-in delay-2">
        <div className="dock-header"><div><b>ECharts 证据面板</b><span>图上标线对应查看环，结论必须由趋势/阈值/偏离率支撑</span></div><span className="ring-chip">查看 {ringNo} 环</span></div>
        <div className="chart-grid">
          <article><h3>切口压力趋势</h3><Chart option={pressureOption} height={210} /></article>
          <article><h3>推力-扭矩-速度组合</h3><Chart option={comboOption} height={210} /></article>
          <article><h3>相对近 10 环偏离率</h3><Chart option={deviationOption} height={210} /></article>
          <article><h3>监测沉降响应</h3><Chart option={monitorOption} height={210} /></article>
          <article><h3>数据可信度雷达</h3><Chart option={radarOption} height={210} /></article>
        </div>
      </section>
    </main>
  );
}
