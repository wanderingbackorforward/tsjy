import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export function Chart({ option, className = '', height = 220 }: { option: any; className?: string; height?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chart.setOption(option, true);
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [option]);

  return <div ref={ref} className={className} style={{ width: '100%', height }} />;
}
