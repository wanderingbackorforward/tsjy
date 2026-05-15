const navItems = [
  ['overview', '指挥总览', '地图/研判'],
  ['ring', '单环分析', '证据链'],
  ['risk', '风险复盘', '穿越窗口'],
  ['monitoring', '监测异常', '阈值/趋势'],
  ['operation', '参数诊断', '组合异常'],
  ['data', '数据接入', '接口/映射'],
  ['system', '系统状态', '数据质量'],
] as const;

export function PageShell({ page, setPage, children }: { page: string; setPage: (p: string) => void; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar glass">
        <div className="brand-block">
          <div className="eyebrow">SHIELD TUNNEL ANALYTICS</div>
          <h1>盾构施工监控研判平台</h1>
        </div>
        <nav className="topnav">
          {navItems.map(([key, title, sub]) => (
            <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}>
              <b>{title}</b><span>{sub}</span>
            </button>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
