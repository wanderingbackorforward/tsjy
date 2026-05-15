import { useState } from 'react';
import { apiUpload } from '../services/api';

export function DataPipelinePage() {
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function onFile(file: File | null) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('data_category', 'shield_operation');
    setLoading(true);
    try { setPreview(await apiUpload('/imports/upload', form)); }
    finally { setLoading(false); }
  }

  return (
    <div className="page">
      <section className="hero-panel"><div><p className="eyebrow">Data Pipeline</p><h1>数据接入 / 字段映射 / 校验</h1><p className="subline">V2 强调原始数据留存、字段映射、标准业务入库，而不是前端直接认现场字段。</p></div></section>
      <section className="pipeline-grid">
        {['来源文件', '原始行 raw', '字段映射 mapping', '标准业务表 domain', '稳定 API', '前端可视化'].map((x, i) => <div className="pipeline-step" key={x}><span>{i + 1}</span><b>{x}</b></div>)}
      </section>
      <section className="panel"><h2>上传预览</h2><input type="file" accept=".xlsx,.csv,.docx" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />{loading && <p>解析中...</p>}{preview && <><h3>识别字段</h3><div className="mapping-table">{preview.mappings.map((m: any) => <div key={m.sourceFieldName}><span>{m.sourceFieldName}</span><b>{m.suggestedStandardField || '待人工确认'}</b><em>{m.status}</em></div>)}</div><h3>样例行</h3><pre>{JSON.stringify(preview.sampleRows?.slice(0, 2), null, 2)}</pre></>}</section>
    </div>
  );
}
