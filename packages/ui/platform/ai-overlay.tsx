import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface AiOverlayOptions {
  taskScope?: string;
}

export interface AiOverlayContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  openAiOverlay: (options?: AiOverlayOptions) => void;
  requestAiOverlay: (options?: AiOverlayOptions) => void;
  closeAiOverlay: () => void;
  options: AiOverlayOptions | null;
}

const AiOverlayContext = createContext<AiOverlayContextValue | undefined>(undefined);

export function AiOverlayProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AiOverlayOptions | null>(null);

  const openAiOverlay = useCallback((newOptions?: AiOverlayOptions) => {
    setOptions(newOptions || null);
    setIsOpen(true);
  }, []);

  const closeAiOverlay = useCallback(() => {
    setIsOpen(false);
    setOptions(null);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      setIsOpen,
      openAiOverlay,
      requestAiOverlay: openAiOverlay,
      closeAiOverlay,
      options,
    }),
    [isOpen, openAiOverlay, closeAiOverlay, options],
  );

  return <AiOverlayContext.Provider value={value}>{children}</AiOverlayContext.Provider>;
}

export function useAiOverlay() {
  const context = useContext(AiOverlayContext);
  if (!context) {
    throw new Error("useAiOverlay must be used within an AiOverlayProvider");
  }
  return context;
}
