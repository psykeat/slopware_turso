import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { useFocus, FocusContextState } from "./focus-manager";

export interface Command {
  id: string;
  scope: "global" | "context" | "local";
  group?: string;
  label: { en: string; de: string };
  shortcut?: string; // e.g., "Alt+1", "F3", "?"
  icon?: string;
  isEnabled?: (state: FocusContextState) => boolean;
  isVisible?: (state: FocusContextState) => boolean;
  handler: (state: FocusContextState) => void | Promise<void>;
}

interface CommandContextValue {
  commands: Command[];
  registerCommand: (command: Command) => () => void;
  executeCommand: (commandId: string) => void;
}

const CommandContext = createContext<CommandContextValue | undefined>(undefined);

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const { state: focusState } = useFocus();
  const [commands, setCommands] = useState<Command[]>([]);

  const registerCommand = useCallback((command: Command) => {
    setCommands((prev) => {
      if (prev.find((c) => c.id === command.id)) return prev;
      return [...prev, command];
    });
    return () => {
      setCommands((prev) => prev.filter((c) => c.id !== command.id));
    };
  }, []);

  const executeCommand = useCallback(
    (commandId: string) => {
      const command = commands.find((c) => c.id === commandId);
      if (command && (!command.isEnabled || command.isEnabled(focusState))) {
        command.handler(focusState);
      }
    },
    [commands, focusState],
  );

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If another handler (e.g. EntityMask) already claimed this event, skip.
      if (e.defaultPrevented) return;

      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable;

      const key = e.key;
      const ctrl = e.ctrlKey;
      const alt = e.altKey;
      const shift = e.shiftKey;

      let shortcut = "";
      if (alt) shortcut += "Alt+";
      if (ctrl) shortcut += "Ctrl+";
      if (shift) shortcut += "Shift+";
      shortcut += key.length === 1 ? key.toUpperCase() : key;

      if (key === "?" && !isInput) {
        shortcut = "?";
      }

      // Skip all shortcuts (except Escape) when focus is inside an editable element.
      if (isInput && key !== "Escape") {
        return;
      }

      const command = commands.find((c) => c.shortcut === shortcut);
      if (command) {
        e.preventDefault();
        executeCommand(command.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commands, executeCommand]);

  const value = useMemo(
    () => ({ commands, registerCommand, executeCommand }),
    [commands, registerCommand, executeCommand],
  );

  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
}

export function useCommands() {
  const context = useContext(CommandContext);
  if (!context) {
    throw new Error("useCommands must be used within a CommandProvider");
  }
  return context;
}
