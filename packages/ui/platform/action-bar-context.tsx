import React, { createContext, useContext, useState } from "react";

interface ActionBarContextValue {
  subCrumb: string | undefined;
  setSubCrumb: (value: string | undefined) => void;
}

const ActionBarContext = createContext<ActionBarContextValue>({
  subCrumb: undefined,
  setSubCrumb: () => {},
});

export function ActionBarProvider({ children }: { children: React.ReactNode }) {
  const [subCrumb, setSubCrumb] = useState<string | undefined>(undefined);
  return (
    <ActionBarContext.Provider value={{ subCrumb, setSubCrumb }}>
      {children}
    </ActionBarContext.Provider>
  );
}

export function useActionBar() {
  return useContext(ActionBarContext);
}
