import { useDebouncedValue } from "@tanstack/react-pacer";
import { SearchIcon } from "lucide-react";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCommands } from "../platform/command-registry";
import { useFocus } from "../platform/focus-manager";

function KbdChip({ shortcut }: { shortcut: string }) {
  const tokens = shortcut.split("+");
  return (
    <span className="flex items-center gap-0.5">
      {tokens.map((token, i) => (
        <kbd
          key={i}
          className="h-5 rounded border border-hairline-input bg-canvas-soft px-1 font-mono text-[10px] text-ink-mute"
        >
          {token}
        </kbd>
      ))}
    </span>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, { wait: 150 });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { commands, executeCommand } = useCommands();
  const { state: focusState } = useFocus();
  const { i18n } = useTranslation("ui");
  const lang = i18n.language === "de" ? "de" : "en";

  useEffect(() => {
    const handler = () => setOpen((prev) => !prev);
    window.addEventListener("slopware:open-palette", handler);
    return () => window.removeEventListener("slopware:open-palette", handler);
  }, []);

  const filtered = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return commands.filter((cmd) => {
      if (!cmd.isVisible || cmd.isVisible(focusState)) {
        const label = cmd.label[lang].toLowerCase();
        return !q || label.includes(q) || cmd.shortcut?.toLowerCase().includes(q);
      }
      return false;
    });
  }, [commands, debouncedQuery, focusState, lang]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const closePalette = () => {
    setQuery("");
    setSelectedIdx(0);
    setOpen(false);
  };

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      closePalette();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[selectedIdx];
      if (cmd) {
        closePalette();
        executeCommand(cmd.id);
      }
    }
  }

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[20vh]"
      onClick={closePalette}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-hairline bg-canvas shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex h-12 items-center gap-2 border-b border-hairline px-4">
          <SearchIcon className="size-4 shrink-0 text-ink-mute" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            placeholder="Search commands…"
            className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-mute"
          />
          <kbd className="h-5 rounded border border-hairline-input bg-canvas-soft px-1.5 font-mono text-[10px] text-ink-mute">
            Esc
          </kbd>
        </div>

        {/* Command list */}
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-ink-mute">
              No commands found.
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const active = idx === selectedIdx;
              return (
                <button
                  key={cmd.id}
                  className="flex h-10 w-full cursor-pointer items-center gap-3 px-4 text-left transition-colors"
                  style={
                    active
                      ? {
                          background: "color-mix(in oklab, var(--primary) 9%, transparent)",
                          borderLeft: "2px solid var(--primary)",
                        }
                      : { borderLeft: "2px solid transparent" }
                  }
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onClick={() => {
                    closePalette();
                    executeCommand(cmd.id);
                  }}
                >
                  <span className="flex-1 truncate text-[13px] text-ink">{cmd.label[lang]}</span>
                  {cmd.shortcut && (
                    <span className="ml-2 shrink-0">
                      <KbdChip shortcut={cmd.shortcut} />
                    </span>
                  )}
                  {cmd.scope !== "global" && (
                    <span className="rounded-full border border-hairline px-1.5 text-[10px] tracking-wider text-ink-mute uppercase">
                      {cmd.scope}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
