import { useEffect, useState } from 'react';
import { apiGet } from '../services/api';
import { Chart } from '../components/Chart';
export default function OperationDiagnosisPage(){
 const [items,setItems]=useState<any[]>([]); useEffect(()=>{apiGet('/shield/ring-operations?start_ring=250&end_ring=392').then(d=>setItems(d.items||[]));},[]);
 const option={tooltip:{trigger:'axis'},legend:{textStyle:{color:'#9fc3df'}},grid:{left:50,right:50,top:42,bottom:34},xAxis:{type:'category',data:items.map((x:any)=>x.ringNo),axisLabel:{color:'#8fb6d8'}},yAxis:[{type:'value',axisLabel:{color:'#8fb6d8'}},{type:'value',axisLabel:{color:'#8fb6d8'}}],series:[{name:'推力x1000',type:'line',data:items.map((x:any)=>Number(x.totalThrust||0)/1000),lineStyle:{color:'#60f1d3'}},{name:'扭矩x1000',type:'line',data:items.map((x:any)=>Number(x.cutterTorque||0)/1000),lineStyle:{color:'#ffbf69'}},{name:'速度',type:'bar',yAxisIndex:1,data:items.map((x:any)=>x.advanceSpeed),itemStyle:{color:'rgba(82,214,255,.35)'}}]};
 return <main className="analysis-page"><section className="page-hero glass"><div><p className="eyebrow">Operation Diagnosis</p><h2>施工参数诊断</h2><p>关注参数组合异常：推力升高 + 扭矩升高 + 速度下降，压力波动 + 出浆异常等。</p></div></section><section className="analysis-grid"><article className="glass wide"><h3>推力-扭矩-速度组合诊断</h3><Chart option={option} height={420}/></article><article className="glass"><h3>规则命中</h3><div className="finding warning"><b>组合异常规则</b><p>当推力、扭矩同步上升且速度下降时，提示地层阻力增大或刀盘状态异常。</p><small>建议：复核泥浆指标、刀盘状态和地层变化。</small></div></article></section></main>
}
