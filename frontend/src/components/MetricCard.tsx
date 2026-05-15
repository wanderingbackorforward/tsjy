export function MetricCard({ label, value, unit, hint, tone = 'blue' }: { label: string; value: any; unit?: string; hint?: string; tone?: string }) {
  return (
    <div className={`metric-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value ?? '--'}{unit ? <em>{unit}</em> : null}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}
