import { useEffect, useState } from 'react';
import { apiGet } from '../services/api';
import { DataTable, MiniLineChart, StatusBadge } from '../components/Ui';
export default function MonitoringPage(){
  const [points,setPoints]=useState<any[]>([]); const [point,setPoint]=useState<any>(null); const [readings,setReadings]=useState<any[]>([]);
  useEffect(()=>{apiGet('/monitoring/points').then(d=>{setPoints(d.items||[]); const first=(d.items||[])[0]; if(first) setPoint(first);});},[]);
  useEffect(()=>{if(point?.pointCode) apiGet(`/monitoring/readings?point_code=${point.pointCode}`).then(d=>setReadings(d.readings||[]));},[point?.pointCode]);
  return <div className="page"><section className="hero-panel"><div><p className="eyebrow">Monitoring Analysis</p><h1>监测分析</h1><p className="subline">测点、阈值、累计变化、变化速率需要和风险源及环号关联。</p></div></section><section className="grid-2"><div className="panel"><h2>测点列表</h2><DataTable columns={[{key:'pointCode',title:'测点'},{key:'monitoringObject',title:'对象'},{key:'riskName',title:'风险源'},{key:'alertLevel',title:'状态',render:r=><StatusBadge value={r.alertLevel}/>}]} rows={points} /></div><div className="panel"><h2>{point?.pointCode || '测点'} 累计变化</h2><MiniLineChart data={readings} xKey="measuredAt" yKey="cumulativeChange"/><div className="chips">{points.slice(0,8).map(p=><button key={p.pointId} onClick={()=>setPoint(p)} className={point?.pointId===p.pointId?'active':''}>{p.pointCode}</button>)}</div></div></section></div>;
}
