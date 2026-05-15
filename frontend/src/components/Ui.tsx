export function StatusBadge({ value }: { value?: string }) {
  const v = value || 'unknown';
  return <span className={`badge ${v}`}>{v}</span>;
}

export function MetricCard({ label, value, unit, tone = 'blue' }: { label: string; value: any; unit?: string; tone?: string }) {
  return <div className={`metric-card ${tone}`}><span>{label}</span><strong>{value ?? '--'}</strong>{unit && <em>{unit}</em>}</div>;
}

export function MiniLineChart({ data, xKey, yKey, activeX, label }: { data: any[]; xKey: string; yKey: string; activeX?: number | null; label?: string }) {
  const values = data.map(d => Number(d[yKey])).filter(v => Number.isFinite(v));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = max - min || 1;
  const w = 520;
  const h = 150;
  const pts = data.map((d, i) => {
    const x = data.length <= 1 ? 0 : (i / (data.length - 1)) * w;
    const y = h - ((Number(d[yKey]) - min) / span) * (h - 20) - 10;
    return `${x},${y}`;
  }).join(' ');
  const activeIndex = activeX == null ? -1 : data.findIndex(d => Number(d[xKey]) === Number(activeX));
  let activePoint: any = null;
  if (activeIndex >= 0) {
    const d = data[activeIndex];
    const x = data.length <= 1 ? 0 : (activeIndex / (data.length - 1)) * w;
    const y = h - ((Number(d[yKey]) - min) / span) * (h - 20) - 10;
    activePoint = { x, y, value: d[yKey] };
  }
  return <div className="chart-card">
    {label && <div className="chart-title">{label}</div>}
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs><linearGradient id={`g-${yKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#59d7ff"/><stop offset="1" stopColor="#1b6fff"/></linearGradient></defs>
      <polyline points={pts} fill="none" stroke={`url(#g-${yKey})`} strokeWidth="3" />
      {activePoint && <><line x1={activePoint.x} x2={activePoint.x} y1="0" y2={h} stroke="#ffd166" strokeDasharray="4 4"/><circle cx={activePoint.x} cy={activePoint.y} r="5" fill="#ffd166"/></>}
    </svg>
  </div>;
}

export function DataTable({ columns, rows }: { columns: { key: string; title: string; render?: (row: any) => any }[]; rows: any[] }) {
  return <div className="table-wrap"><table><thead><tr>{columns.map(c => <th key={c.key}>{c.title}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{columns.map(c => <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}</tbody></table></div>;
}
