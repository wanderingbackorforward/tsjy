import { ReactNode } from 'react';

const nav = [
  ['dashboard', '指挥总览', 'Command'],
  ['rings', '环号进度', 'Ring Timeline'],
  ['risk', '风险源', 'Risk'],
  ['monitoring', '监测分析', 'Monitoring'],
  ['operation', '掘进参数', 'Operation'],
  ['slurry', '泥水注浆', 'Slurry'],
  ['intake', '数据接入', 'Data Intake'],
  ['evidence', '资料证据', 'Evidence'],
  ['system', '系统状态', 'System'],
];

export default function AppShell({ page, setPage, children }: { page: string; setPage: (p: string) => void; children: ReactNode }) {
  return <div className="app-shell">
    <aside className="side-nav">
      <div className="brand"><span>盾构</span><b>Monitor V2</b><small>数据接入驱动的监控平台</small></div>
      <nav>{nav.map(([key, cn, en]) => <button key={key} onClick={() => setPage(key)} className={page === key ? 'active' : ''}><b>{cn}</b><em>{en}</em></button>)}</nav>
      <div className="nav-note">V2 重构重点：不堆大屏，先把数据接入、标准模型、环号联动和风险复盘立起来。</div>
    </aside>
    <main>{children}</main>
  </div>;
}
