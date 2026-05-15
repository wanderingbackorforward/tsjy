export function MetricCard({ label, value, unit, tone = 'normal' }: { label: string; value: string | number | undefined | null; unit?: string; tone?: 'normal' | 'warning' | 'danger' }) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value ?? '--'}{unit && <span>{unit}</span>}</div>
    </div>
  );
}
