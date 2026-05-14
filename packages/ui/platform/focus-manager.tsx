import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export type FocusArea =
  | "workspace"
  | "panel"
  | "grid"
  | "form"
  | "lookup"
  | "dialog"
  | "designer"
  | "statistics"
  | null;

export interface FocusContextState {
  workspace: string | null;
  panel: string | null;
  area: FocusArea;
  entity: string | null;
  recordId: string | null;
  field: string | null;
  row: number | null;
  mode: "view" | "edit" | "create" | null;
}

interface FocusContextValue {
  state: FocusContextState;
  setFocus: (update: Partial<FocusContextState>) => void;
  resetFocus: () => void;
}

const defaultState: FocusContextState = {
  workspace: null,
  panel: null,
  area: null,
  entity: null,
  recordId: null,
  field: null,
  row: null,
  mode: null,
};

const FocusContext = createContext<FocusContextValue | undefined>(undefined);

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FocusContextState>(defaultState);

  const setFocus = useCallback((update: Partial<FocusContextState>) => {
    setState((prev) => ({ ...prev, ...update }));
  }, []);

  const resetFocus = useCallback(() => {
    setState(defaultState);
  }, []);

  const value = useMemo(() => ({ state, setFocus, resetFocus }), [state, setFocus, resetFocus]);

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocus() {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error("useFocus must be used within a FocusProvider");
  }
  return context;
}
