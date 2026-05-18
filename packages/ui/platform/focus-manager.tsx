import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export type FocusArea =
  | "workspace"
  | "panel"
  | "tree"
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
  treeEntity: string | null;
  treePanel: string | null;
  treeRecordId: string | null;
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
  treeEntity: null,
  treePanel: null,
  treeRecordId: null,
  field: null,
  row: null,
  mode: null,
};

const FocusContext = createContext<FocusContextValue | undefined>(undefined);

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FocusContextState>(defaultState);

  const setFocus = useCallback((update: Partial<FocusContextState>) => {
    setState((prev) => {
      const next = { ...prev, ...update };
      return Object.is(prev, next) || shallowFocusEqual(prev, next) ? prev : next;
    });
  }, []);

  const resetFocus = useCallback(() => {
    setState((prev) => (shallowFocusEqual(prev, defaultState) ? prev : defaultState));
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

function shallowFocusEqual(a: FocusContextState, b: FocusContextState) {
  return (
    a.workspace === b.workspace &&
    a.panel === b.panel &&
    a.area === b.area &&
    a.entity === b.entity &&
    a.recordId === b.recordId &&
    a.treeEntity === b.treeEntity &&
    a.treePanel === b.treePanel &&
    a.treeRecordId === b.treeRecordId &&
    a.field === b.field &&
    a.row === b.row &&
    a.mode === b.mode
  );
}
