import { useEffect, useState } from 'react';
import { apiGet } from '../services/api';
import { useRingContext } from '../store/RingContext';
import { DataTable } from '../components/Ui';
export default function RingTimelinePage(){
  const { effectiveRingNo, setSelectedRingNo } = useRingContext();
  const [items,setItems]=useState<any[]>([]);
  useEffect(()=>{apiGet('/rings/timeline?start_ring=250&end_ring=392').then(d=>setItems(d.items||[]));},[]);
  return <div className="page"><section className="hero-panel"><div><p className="eyebrow">Ring Timeline</p><h1>环号进度 / 里程主轴</h1><p className="subline">平台的核心不是图表，而是环号-里程-日期这条主轴。</p></div><div className="score">{effectiveRingNo ?? '--'}</div></section><div className="panel"><h2>点击环号联动全局查看</h2><div className="ring-strip">{items.filter((_,i)=>i%5===0).map(r=><button key={r.ringNo} onClick={()=>setSelectedRingNo(r.ringNo)} className={r.ringNo===effectiveRingNo?'active':''}>{r.ringNo}</button>)}</div></div><div className="panel"><DataTable columns={[{key:'ringNo',title:'环号'},{key:'workDate',title:'日期'},{key:'startMileage',title:'起点'},{key:'endMileage',title:'终点'},{key:'constructionStage',title:'阶段'}]} rows={items.slice(0,120)} /></div></div>;
}
