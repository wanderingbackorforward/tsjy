import { useState } from 'react';
import { apiUpload } from '../services/api';
import { DataTable, StatusBadge } from '../components/Ui';
export default function DataIntakePage(){
 const [result,setResult]=useState<any>(null); const [cat,setCat]=useState('shield_operation');
 async function upload(e:any){ e.preventDefault(); const file=e.currentTarget.file.files?.[0]; if(!file) return; const fd=new FormData(); fd.append('file',file); fd.append('data_category',cat); const data=await apiUpload('/imports/upload',fd); setResult(data); }
 return <div className="page"><section className="hero-panel"><div><p className="eyebrow">Data Intake</p><h1>数据接入中心</h1><p className="subline">上传不是直接入业务表；先进入 raw/staging，再映射、校验、提交。</p></div></section><div className="panel"><form className="upload-form" onSubmit={upload}><select value={cat} onChange={e=>setCat(e.target.value)}><option value="shield_operation">盾构掘进参数</option><option value="monitoring_reading">监测日报</option><option value="risk_source">风险源台账</option></select><input name="file" type="file" accept=".xlsx,.csv,.docx"/><button>上传并预览</button></form></div>{result&&<section className="grid-2"><div className="panel"><h2>字段映射建议</h2><DataTable columns={[{key:'sourceFieldName',title:'源字段'},{key:'suggestedStandardField',title:'标准字段'},{key:'confidence',title:'置信度'},{key:'status',title:'状态',render:r=><StatusBadge value={r.status}/>}]} rows={result.mappingSuggestions||[]} /></div><div className="panel"><h2>样例行</h2><pre>{JSON.stringify(result.sampleRows||[],null,2)}</pre></div></section>}</div>;
}
