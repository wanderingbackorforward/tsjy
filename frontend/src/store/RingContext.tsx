import React, { createContext, useContext, useMemo, useState } from 'react';

type RingContextValue = {
  currentRingNo: number | null;
  selectedRingNo: number | null;
  effectiveRingNo: number | null;
  setCurrentRingNo: (v: number | null) => void;
  setSelectedRingNo: (v: number | null) => void;
  resetToCurrent: () => void;
};

const RingContext = createContext<RingContextValue | null>(null);

export function RingProvider({ children }: { children: React.ReactNode }) {
  const [currentRingNo, setCurrentRingNo] = useState<number | null>(null);
  const [selectedRingNo, setSelectedRingNo] = useState<number | null>(null);
  const value = useMemo(() => ({
    currentRingNo,
    selectedRingNo,
    effectiveRingNo: selectedRingNo ?? currentRingNo,
    setCurrentRingNo,
    setSelectedRingNo,
    resetToCurrent: () => setSelectedRingNo(null),
  }), [currentRingNo, selectedRingNo]);
  return <RingContext.Provider value={value}>{children}</RingContext.Provider>;
}

export function useRingContext() {
  const ctx = useContext(RingContext);
  if (!ctx) throw new Error('useRingContext must be used within RingProvider');
  return ctx;
}
