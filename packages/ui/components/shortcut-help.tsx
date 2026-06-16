import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/utils";
import { useCommandList, useCommands } from "../platform/command-registry";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

const GROUPS = [
  {
    key: "navigation",
    labelKey: "shortcuts.navigation" as const,
    ids: [
      "show-help",
      "nav-addresses",
      "nav-articles",
      "nav-documents",
      "nav-settings",
      "open-palette",
    ],
  },
  {
    key: "recordOps",
    labelKey: "shortcuts.recordOps" as const,
    ids: ["edit-record", "create-record", "archive-record", "duplicate-record", "save-close"],
  },
  {
    key: "workflow",
    labelKey: "shortcuts.workflow" as const,
    ids: [
      "open-document",
      "post-document",
      "transform-record",
      "print-document",
      "open-statistics",
    ],
  },
] as const;

const NAV_KEYS = [
  { labelKey: "shortcuts.moveUpDown" as const, keys: ["↑", "↓"] },
  { labelKey: "shortcuts.firstLast" as const, keys: ["Home", "End"] },
  { labelKey: "shortcuts.nextPrevField" as const, keys: ["Tab", "⇧Tab"] },
  { labelKey: "shortcuts.confirm" as const, keys: ["Enter"] },
] as const;

function KbdChips({ shortcut }: { shortcut: string }) {
  const parts = shortcut === "?" ? ["?"] : shortcut.split("+");
  return (
    <div className="flex items-center gap-0.5">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="inline-flex h-5 items-center rounded border border-hairline-input bg-canvas-soft px-1.5 font-mono text-[10px] text-ink-mute"
        >
          {part}
        </kbd>
      ))}
    </div>
  );
}

function ShortcutRow({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div className="flex items-center justify-between border-b border-hairline py-1.5 last:border-b-0">
      <span className="text-[13px] text-ink-secondary">{label}</span>
      <KbdChips shortcut={shortcut} />
    </div>
  );
}

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  const { t, i18n } = useTranslation("ui");
  const commands = useCommandList();
  const { registerCommand } = useCommands();

  useEffect(() => {
    return registerCommand({
      id: "show-help",
      scope: "global",
      group: "navigation",
      label: { en: "Keyboard Shortcuts", de: "Tastenkürzel" },
      shortcut: "?",
      handler: () => setOpen(true),
    });
  }, [registerCommand]);

  const commandById = (id: string) => commands.find((c) => c.id === id);

  const getLabel = (cmd: ReturnType<typeof commandById>) => {
    if (!cmd) return null;
    return i18n.language === "de" ? cmd.label.de : cmd.label.en;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-light text-ink">
            {t("shortcuts.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-2 gap-x-10">
          {/* Left column: navigation + recordOps */}
          <div>
            {GROUPS.slice(0, 2).map((group) => {
              const rows = group.ids
                .map((id) => {
                  const cmd = commandById(id);
                  if (!cmd || !cmd.shortcut) return null;
                  return { id, label: getLabel(cmd) ?? id, shortcut: cmd.shortcut };
                })
                .filter(Boolean) as { id: string; label: string; shortcut: string }[];

              if (rows.length === 0) return null;

              return (
                <div key={group.key} className="mb-4">
                  <p
                    className={cn(
                      "mt-4 mb-1 text-[10px] tracking-wider text-ink-mute uppercase first:mt-0",
                    )}
                  >
                    {t(group.labelKey)}
                  </p>
                  {rows.map((row) => (
                    <ShortcutRow key={row.id} label={row.label} shortcut={row.shortcut} />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Right column: workflow + grid navigation */}
          <div>
            {GROUPS.slice(2).map((group) => {
              const rows = group.ids
                .map((id) => {
                  const cmd = commandById(id);
                  if (!cmd || !cmd.shortcut) return null;
                  return { id, label: getLabel(cmd) ?? id, shortcut: cmd.shortcut };
                })
                .filter(Boolean) as { id: string; label: string; shortcut: string }[];

              if (rows.length === 0) return null;

              return (
                <div key={group.key} className="mb-4">
                  <p className="mt-4 mb-1 text-[10px] tracking-wider text-ink-mute uppercase first:mt-0">
                    {t(group.labelKey)}
                  </p>
                  {rows.map((row) => (
                    <ShortcutRow key={row.id} label={row.label} shortcut={row.shortcut} />
                  ))}
                </div>
              );
            })}

            {/* Grid navigation keys */}
            <div className="mb-4">
              <p className="mt-4 mb-1 text-[10px] tracking-wider text-ink-mute uppercase">
                {t("shortcuts.gridNavigation")}
              </p>
              {NAV_KEYS.map((item) => (
                <div
                  key={item.labelKey}
                  className="flex items-center justify-between border-b border-hairline py-1.5 last:border-b-0"
                >
                  <span className="text-[13px] text-ink-secondary">{t(item.labelKey)}</span>
                  <div className="flex items-center gap-0.5">
                    {item.keys.map((key, i) => (
                      <kbd
                        key={i}
                        className="inline-flex h-5 items-center rounded border border-hairline-input bg-canvas-soft px-1.5 font-mono text-[10px] text-ink-mute"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
