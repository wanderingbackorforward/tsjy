import { useEffect, useState } from 'react';
import { apiGet } from '../services/api';
import { Chart } from '../components/Chart';
export default function RiskReviewPage(){
 const [items,setItems]=useState<any[]>([]); useEffect(()=>{apiGet('/risk-sources?ring_no=361').then(d=>setItems(d.items||[]));},[]);
 const option={tooltip:{},grid:{left:80,right:30,top:30,bottom:40},xAxis:{type:'value',min:53695,max:59129,axisLabel:{color:'#8fb6d8'}},yAxis:{type:'category',data:items.slice(0,8).map(x=>x.riskName),axisLabel:{color:'#dff4ff'}},series:[{type:'bar',data:items.slice(0,8).map(x=>[x.startMileageM||54000,x.endMileageM||54500]),itemStyle:{color:'#52d6ff'}}]};
 return <main className="analysis-page"><section className="page-hero glass"><div><p className="eyebrow">Risk Review</p><h2>风险源穿越复盘</h2><p>按里程窗口查看穿越前、中、后，结合参数和监测响应判断控制是否合理。</p></div></section><section className="analysis-grid"><article className="glass wide"><h3>风险源里程窗口</h3><Chart option={option} height={360}/></article><article className="glass wide"><h3>风险源清单</h3><table className="data-table"><thead><tr><th>名称</th><th>类型</th><th>关系</th><th>里程</th><th>状态</th><th>测点</th></tr></thead><tbody>{items.map((r:any)=><tr key={r.riskSourceId}><td>{r.riskName}</td><td>{r.riskType}</td><td>{r.crossingRelation}</td><td>{r.startMileage}~{r.endMileage}</td><td><span className={`badge ${r.status}`}>{r.status}</span></td><td>{r.monitoringPointCount}</td></tr>)}</tbody></table></article></section></main>
}
