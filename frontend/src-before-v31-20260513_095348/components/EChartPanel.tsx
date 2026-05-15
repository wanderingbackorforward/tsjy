import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface Props {
  title: string;
  subtitle?: string;
  option: echarts.EChartsOption;
  height?: number;
  className?: string;
}

export default function EChartPanel({ title, subtitle, option, height = 320, className = '' }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption(option, true);
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [option]);

  return (
    <section className={`chart-panel ${className}`}>
      <div className="chart-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div ref={ref} style={{ width: '100%', height }} />
    </section>
  );
}
