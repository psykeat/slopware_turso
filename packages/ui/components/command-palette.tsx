import React, { useState, useEffect, useRef, useMemo } from "react";
import { useCommands } from "../platform/command-registry";
import { useFocus } from "../platform/focus-manager";
import { useTranslation } from "react-i18next";
import { SearchIcon } from "lucide-react";

function KbdChip({ shortcut }: { shortcut: string }) {
  const tokens = shortcut.split("+");
  return (
    <span className="flex items-center gap-0.5">
      {tokens.map((token, i) => (
        <kbd
          key={i}
          className="h-5 px-1 font-mono text-[10px] border border-hairline-input bg-canvas-soft rounded text-ink-mute"
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
    const q = query.toLowerCase();
    return commands.filter((cmd) => {
      if (!cmd.isVisible || cmd.isVisible(focusState)) {
        const label = cmd.label[lang].toLowerCase();
        return !q || label.includes(q) || cmd.shortcut?.toLowerCase().includes(q);
      }
      return false;
    });
  }, [commands, query, focusState, lang]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
    }
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
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
        setOpen(false);
        executeCommand(cmd.id);
      }
    }
  }

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/30"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="w-full max-w-lg bg-canvas rounded-xl border border-hairline shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 h-12 border-b border-hairline">
          <SearchIcon className="size-4 text-ink-mute shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands…"
            className="flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-mute outline-none"
          />
          <kbd className="h-5 px-1.5 font-mono text-[10px] border border-hairline-input bg-canvas-soft rounded text-ink-mute">
            Esc
          </kbd>
        </div>

        {/* Command list */}
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-ink-mute">No commands found.</div>
          ) : (
            filtered.map((cmd, idx) => {
              const active = idx === selectedIdx;
              return (
                <button
                  key={cmd.id}
                  className="w-full flex items-center gap-3 px-4 h-10 text-left cursor-pointer transition-colors"
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
                    setOpen(false);
                    executeCommand(cmd.id);
                  }}
                >
                  <span className="flex-1 text-[13px] text-ink truncate">{cmd.label[lang]}</span>
                  {cmd.shortcut && (
                    <span className="shrink-0 ml-2">
                      <KbdChip shortcut={cmd.shortcut} />
                    </span>
                  )}
                  {cmd.scope !== "global" && (
                    <span className="text-[10px] text-ink-mute uppercase tracking-wider border border-hairline px-1.5 rounded-full">
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
