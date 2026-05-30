import { SparklesIcon } from "lucide-react";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/sheet";
import { cn } from "../lib/utils";

type AiOverlayContent = {
  title: React.ReactNode;
  description?: React.ReactNode;
  content: React.ReactNode;
  className?: string;
};

type AiOverlayContextValue = {
  isOpen: boolean;
  openAiOverlay: (content: AiOverlayContent) => void;
  closeAiOverlay: () => void;
  requestAiOverlay: () => void;
};

const AiOverlayContext = createContext<AiOverlayContextValue | undefined>(undefined);

export function AiOverlayProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [overlay, setOverlay] = useState<AiOverlayContent | null>(null);

  const openAiOverlay = useCallback((content: AiOverlayContent) => {
    setOverlay(content);
    setIsOpen(true);
  }, []);

  const closeAiOverlay = useCallback(() => {
    setIsOpen(false);
  }, []);

  const requestAiOverlay = useCallback(() => {
    window.dispatchEvent(new CustomEvent("slopware:open-ai"));
  }, []);

  const value = useMemo(
    () => ({ isOpen, openAiOverlay, closeAiOverlay, requestAiOverlay }),
    [closeAiOverlay, isOpen, openAiOverlay, requestAiOverlay],
  );

  return (
    <AiOverlayContext.Provider value={value}>
      {children}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          className={cn(
            "flex h-full w-full flex-col overflow-hidden border-l border-hairline bg-canvas p-6 sm:max-w-md md:max-w-lg",
            overlay?.className,
          )}
        >
          {overlay ? (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                  <SparklesIcon className="size-4.5 text-primary" />
                  <span>{overlay.title}</span>
                </SheetTitle>
                {overlay.description ? (
                  <SheetDescription className="text-[12px] text-ink-mute">
                    {overlay.description}
                  </SheetDescription>
                ) : null}
              </SheetHeader>
              {overlay.content}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </AiOverlayContext.Provider>
  );
}

export function useAiOverlay() {
  const context = useContext(AiOverlayContext);
  if (!context) {
    throw new Error("useAiOverlay must be used within an AiOverlayProvider");
  }
  return context;
}
