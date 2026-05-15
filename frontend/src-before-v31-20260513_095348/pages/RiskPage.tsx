import { useEffect, useState } from 'react';
import { apiGet } from '../services/api';
import { useRingContext } from '../store/RingContext';
import { DataTable, StatusBadge } from '../components/Ui';
export default function RiskPage(){
  const { effectiveRingNo } = useRingContext();
  const [items,setItems]=useState<any[]>([]);
  useEffect(()=>{apiGet(`/risk-sources${effectiveRingNo?`?ring_no=${effectiveRingNo}`:''}`).then(d=>setItems(d.items||[]));},[effectiveRingNo]);
  return <div className="page"><section className="hero-panel"><div><p className="eyebrow">Risk Corridor</p><h1>风险源穿越分析</h1><p className="subline">当前有效环号：{effectiveRingNo ?? '--'}。状态由里程区间计算，不靠人工标颜色。</p></div></section><div className="risk-grid">{items.map(r=><div className={`panel risk-card ${r.status}`} key={r.riskSourceId}><div><b>{r.riskName}</b><StatusBadge value={r.status}/></div><p>{r.riskType} · {r.crossingRelation}</p><strong>{r.startMileage} ~ {r.endMileage}</strong><small>关联测点 {r.monitoringPointCount} 个</small></div>)}</div><div className="panel"><DataTable columns={[{key:'riskName',title:'风险源'},{key:'riskType',title:'类型'},{key:'crossingRelation',title:'关系'},{key:'startMileage',title:'起点'},{key:'endMileage',title:'终点'},{key:'status',title:'状态',render:r=><StatusBadge value={r.status}/>}]} rows={items}/></div></div>;
}
