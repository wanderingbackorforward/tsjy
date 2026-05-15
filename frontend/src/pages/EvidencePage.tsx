import { useEffect, useState } from 'react';
import { apiGet } from '../services/api';
import { DataTable } from '../components/Ui';
export default function EvidencePage(){
 const [items,setItems]=useState<any[]>([]); useEffect(()=>{apiGet('/sources').then(d=>setItems(d.items||[])).catch(()=>setItems([]));},[]);
 return <div className="page"><section className="hero-panel"><div><p className="eyebrow">Evidence</p><h1>资料证据与版本追溯</h1><p className="subline">每个入库事实都应该能追溯到来源文件、页码、表格和版本。</p></div></section><div className="panel"><DataTable columns={[{key:'fileName',title:'文件名'},{key:'fileType',title:'类型'},{key:'documentDate',title:'日期'},{key:'description',title:'说明'}]} rows={items}/></div></div>;
}
