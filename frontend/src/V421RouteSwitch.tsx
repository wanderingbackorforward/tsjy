import React from 'react';
import V421EchartsCockpit from './V421EchartsCockpit';

export default function V421RouteSwitch({ fallback }: { fallback: React.ReactNode }) {
  const path = window.location.pathname;
  if (path === '/' || path === '/advanced-cockpit' || path === '/monitoring-alerts') {
    return <V421EchartsCockpit />;
  }
  return <>{fallback}</>;
}
