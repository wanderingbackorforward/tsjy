import { useEffect, useState } from 'react';
import { apiGet } from '../services/api';
export default function SystemStatusPage(){
 const [status,setStatus]=useState<any>(null); useEffect(()=>{apiGet('/system/status').then(setStatus)},[]); if(!status) return <div className="page"><div className="loading">加载系统状态...</div></div>;
 return <div className="page"><section className="hero-panel"><div><p className="eyebrow">System Status</p><h1>系统状态 / 数据准备度</h1><p className="subline">后端模式：{status.mode}</p></div><div className="score">{status.dataQuality.readyScore}%</div></section><section className="grid-2"><div className="panel"><h2>P0 数据准备度</h2>{status.dataQuality.checks.map((c:any)=><div className="quality-row" key={c.key}><span>{c.ok?'已具备':'待补齐'}</span><b>{c.name}</b><em>{c.count} 条</em></div>)}</div><div className="panel"><h2>核心表数据量</h2><div className="table-counts">{status.tableCounts.map((t:any)=><div key={t.tableName}><span>{t.tableName}</span><b>{t.rowCount}</b></div>)}</div></div></section></div>;
}
