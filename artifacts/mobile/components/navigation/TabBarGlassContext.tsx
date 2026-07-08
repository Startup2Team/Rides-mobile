import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type TabBarGlassContextValue = {
  hasGlassContent: boolean;
  setHasGlassContent: (next: boolean) => void;
};

const TabBarGlassContext = createContext<TabBarGlassContextValue | null>(null);

export function TabBarGlassProvider({ children }: { children: React.ReactNode }) {
  const [hasGlassContent, setHasGlassContentState] = useState(false);

  const setHasGlassContent = useCallback((next: boolean) => {
    setHasGlassContentState(next);
  }, []);

  const value = useMemo(() => ({ hasGlassContent, setHasGlassContent }), [hasGlassContent, setHasGlassContent]);

  return <TabBarGlassContext.Provider value={value}>{children}</TabBarGlassContext.Provider>;
}

export function useTabBarGlass() {
  const context = useContext(TabBarGlassContext);
  if (!context) {
    return {
      hasGlassContent: false,
      setHasGlassContent: () => {},
    };
  }
  return context;
}
