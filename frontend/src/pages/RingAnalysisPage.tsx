import { useEffect, useState } from 'react';
import { apiGetV3 } from '../services/api';
import { Chart } from '../components/Chart';

export default function RingAnalysisPage() {
  const [ring, setRing] = useState(361);
  const [data, setData] = useState<any>(null);
  useEffect(()=>{ apiGetV3(`/analysis/rings/${ring}`).then(setData).catch(()=>setData(null)); },[ring]);
  const findings = Array.isArray(data?.findings) ? data.findings : [];
  const evidence = Array.isArray(data?.evidence) ? data.evidence : [];
  const option = { tooltip:{}, grid:{left:70,right:30,top:30,bottom:30}, xAxis:{type:'value', axisLabel:{color:'#8fb6d8'}}, yAxis:{type:'category', data:['压力','推力','扭矩','速度','沉降'], axisLabel:{color:'#dff4ff'}}, series:[{type:'bar', data:[12,15,19,-18,68], label:{show:true, formatter:'{c}%', color:'#fff'}, itemStyle:{color:(p:any)=>p.value>20?'#ff5b6e':p.value<0?'#ffbf69':'#52d6ff'}}] };
  return <main className="analysis-page"><section className="page-hero glass"><div><p className="eyebrow">Ring Workbench</p><h2>单环分析工作台</h2><p>围绕一个环号，把参数、风险源、监测、事件和建议组织成证据链。</p></div><div className="ring-input"><span>分析环号</span><input type="number" value={ring} onChange={e=>setRing(Number(e.target.value))}/></div></section><section className="analysis-grid"><article className="glass"><h3>综合结论</h3><div className="big-risk">{data?.riskLevel || '中高'}</div><p>{data?.summary || '当前环处于风险源影响窗口内，推力/扭矩趋势偏高，建议稳压低速并复核泥水与注浆记录。'}</p></article><article className="glass"><h3>偏离证据</h3><Chart option={option} height={260}/></article><article className="glass wide"><h3>规则命中与建议</h3><div className="finding-list">{(findings.length?findings:[{title:'推力-扭矩-速度组合异常', evidence:'推力与扭矩上升，推进速度下降。', suggestion:'复核地层阻力、刀盘状态和泥浆循环。'}]).map((f:any,i:number)=><div className="finding" key={i}><b>{f.title}</b><p>{f.evidence}</p><small>{f.suggestion}</small></div>)}</div></article><article className="glass wide"><h3>证据链</h3><div className="evidence-list">{(evidence.length?evidence:['shield_ring_operation: 掘进参数','risk_source: 风险源窗口','监测读数正式表: 监测曲线','event_log: 事件闭环']).map((e:any,i:number)=><span key={i}>{typeof e==='string'?e:e.label || e.source}</span>)}</div></article></section></main>;
}
