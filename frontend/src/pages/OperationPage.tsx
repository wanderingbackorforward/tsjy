import { useEffect, useState } from 'react';
import { apiGet } from '../services/api';
import { MiniLineChart, DataTable, StatusBadge } from '../components/Ui';
import { useRingContext } from '../store/RingContext';
export default function OperationPage(){
  const { effectiveRingNo } = useRingContext(); const [items,setItems]=useState<any[]>([]);
  useEffect(()=>{apiGet('/shield/ring-operations?start_ring=250&end_ring=392').then(d=>setItems(d.items||[]));},[]);
  return <div className="page"><section className="hero-panel"><div><p className="eyebrow">Shield Operation</p><h1>掘进参数分析</h1><p className="subline">查看环：{effectiveRingNo ?? '--'}，曲线高亮该环参数。</p></div></section><section className="grid-2"><div className="panel"><h2>切口压力</h2><MiniLineChart data={items} xKey="ringNo" yKey="facePressure" activeX={effectiveRingNo}/></div><div className="panel"><h2>刀盘扭矩</h2><MiniLineChart data={items} xKey="ringNo" yKey="cutterTorque" activeX={effectiveRingNo}/></div></section><div className="panel"><DataTable columns={[{key:'ringNo',title:'环号'},{key:'advanceSpeed',title:'推进速度'},{key:'facePressure',title:'切口压力'},{key:'totalThrust',title:'总推力'},{key:'cutterTorque',title:'刀盘扭矩'},{key:'alertLevel',title:'状态',render:r=><StatusBadge value={r.alertLevel}/>}]} rows={items.slice(-80)} /></div></div>;
}
