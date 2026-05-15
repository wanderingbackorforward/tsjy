import { useEffect, useState } from 'react';
import { apiGet } from '../services/api';
import { MiniLineChart, DataTable } from '../components/Ui';
export default function SlurryPage(){
 const [items,setItems]=useState<any[]>([]); useEffect(()=>{apiGet('/slurry-grouting/records?start_ring=320&end_ring=392').then(d=>setItems(d.items||[]));},[]);
 return <div className="page"><section className="hero-panel"><div><p className="eyebrow">Slurry & Grouting</p><h1>泥水与同步注浆</h1><p className="subline">用于解释掌子面稳定、沉降、上浮与盾尾风险。</p></div></section><section className="grid-2"><div className="panel"><h2>出浆比重</h2><MiniLineChart data={items} xKey="ringNo" yKey="slurryOutDensity" /></div><div className="panel"><h2>注浆量</h2><MiniLineChart data={items} xKey="ringNo" yKey="groutingVolume" /></div></section><div className="panel"><DataTable columns={[{key:'ringNo',title:'环号'},{key:'slurryInDensity',title:'进浆比重'},{key:'slurryOutDensity',title:'出浆比重'},{key:'viscosity',title:'粘度'},{key:'groutingVolume',title:'注浆量'},{key:'groutingPressure',title:'注浆压力'}]} rows={items.slice(-60)} /></div></div>;
}
