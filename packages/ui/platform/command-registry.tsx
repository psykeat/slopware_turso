import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
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

const COMMAND_SCOPE_PRIORITY: Record<Command["scope"], number> = { local: 0, context: 1, global: 2 };

interface CommandContextValue {
  commands: Command[];
  registerCommand: (command: Command) => () => void;
  executeCommand: (commandId: string) => void;
  subscribeToExecutions: (cb: (commandId: string) => void) => () => void;
}

const CommandContext = createContext<CommandContextValue | undefined>(undefined);

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const { state: focusState } = useFocus();
  const [commands, setCommands] = useState<Command[]>([]);
  const executionSubscribers = useRef<Set<(id: string) => void>>(new Set());

  const registerCommand = useCallback((command: Command) => {
    setCommands((prev) => {
      if (prev.find((c) => c.id === command.id)) return prev;
      return [...prev, command];
    });
    return () => {
      setCommands((prev) => prev.filter((c) => c.id !== command.id));
    };
  }, []);

  const subscribeToExecutions = useCallback((cb: (id: string) => void) => {
    executionSubscribers.current.add(cb);
    return () => {
      executionSubscribers.current.delete(cb);
    };
  }, []);

  const executeCommand = useCallback(
    (commandId: string) => {
      const command = commands.find((c) => c.id === commandId);
      if (command && (!command.isEnabled || command.isEnabled(focusState))) {
        command.handler(focusState);
        executionSubscribers.current.forEach((cb) => cb(commandId));
      }
    },
    [commands, focusState],
  );

  const resolveShortcut = useCallback(
    (shortcut: string) => {
      return [...commands]
        .map((command, index) => ({ command, index }))
        .filter(({ command }) => command.shortcut === shortcut)
        .sort((a, b) => {
          const scopeDelta = COMMAND_SCOPE_PRIORITY[a.command.scope] - COMMAND_SCOPE_PRIORITY[b.command.scope];
          if (scopeDelta !== 0) return scopeDelta;
          return a.index - b.index;
        })
        .map(({ command }) => command)
        .find((command) => !command.isEnabled || command.isEnabled(focusState));
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
      const meta = e.metaKey;

      let shortcut = "";
      if (alt) shortcut += "Alt+";
      if (ctrl) shortcut += "Ctrl+";
      if (meta) shortcut += "Meta+";
      if (shift) shortcut += "Shift+";
      shortcut += key.length === 1 ? key.toUpperCase() : key;

      if (key === "?" && !isInput) {
        shortcut = "?";
      }

      const isModifierShortcut = ctrl || alt || meta;
      const isFunctionKey = /^F\d{1,2}$/i.test(key);
      const allowInEditable = key === "?" || key === "Escape" || isModifierShortcut || isFunctionKey;

      // Skip plain text editing keys in editable elements, but allow function keys
      // and modifier shortcuts so local commands still work in forms and lookups.
      if (isInput && !allowInEditable) {
        return;
      }

      const command = resolveShortcut(shortcut);
      if (command) {
        e.preventDefault();
        executeCommand(command.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commands, executeCommand, resolveShortcut]);

  const value = useMemo(
    () => ({ commands, registerCommand, executeCommand, subscribeToExecutions }),
    [commands, registerCommand, executeCommand, subscribeToExecutions],
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
