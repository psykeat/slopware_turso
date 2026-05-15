import { useEffect } from "react";
import { useCommands } from "./command-registry";
import { useNavigate } from "@tanstack/react-router";

export function GlobalCommands() {
  const { registerCommand } = useCommands();
  const navigate = useNavigate();

  useEffect(() => {
    const unregSaveClose = registerCommand({
      id: "save-close",
      scope: "global",
      group: "recordOps",
      label: { en: "Save & Close", de: "Speichern & Schließen" },
      shortcut: "F10",
      isEnabled: (s) => s.area !== "grid",
      handler: () => {
        // no-op fallback — EntityMask handles F10 via its own keydown listener
      },
    });

    const unregister1 = registerCommand({
      id: "nav-addresses",
      scope: "global",
      group: "navigation",
      label: { en: "Addresses", de: "Adressen" },
      shortcut: "Alt+1",
      handler: () => navigate({ to: "/app/addresses" as any }),
    });

    const unregister2 = registerCommand({
      id: "nav-articles",
      scope: "global",
      group: "navigation",
      label: { en: "Articles", de: "Artikel" },
      shortcut: "Alt+2",
      handler: () => navigate({ to: "/app/articles" as any }),
    });

    const unregister3 = registerCommand({
      id: "nav-documents",
      scope: "global",
      group: "navigation",
      label: { en: "Documents", de: "Belege" },
      shortcut: "Alt+3",
      handler: () => navigate({ to: "/app/documents" as any }),
    });

    const unregister0 = registerCommand({
      id: "nav-settings",
      scope: "global",
      group: "navigation",
      label: { en: "Settings", de: "Einstellungen" },
      shortcut: "Alt+0",
      handler: () => navigate({ to: "/app/settings/" as any }),
    });

    const unregStats = registerCommand({
      id: "open-statistics",
      scope: "global",
      group: "navigation",
      label: { en: "Statistics", de: "Statistik" },
      shortcut: "Alt+I",
      handler: () => {
        // StatisticsModule listens for this command
        const event = new CustomEvent("slopware:open-statistics");
        window.dispatchEvent(event);
      },
    });

    const unregPalette = registerCommand({
      id: "open-palette",
      scope: "global",
      group: "navigation",
      label: { en: "Command Palette", de: "Befehlspalette" },
      shortcut: "Ctrl+K",
      handler: () => {
        const event = new CustomEvent("slopware:open-palette");
        window.dispatchEvent(event);
      },
    });

    return () => {
      unregSaveClose();
      unregister1();
      unregister2();
      unregister3();
      unregister0();
      unregStats();
      unregPalette();
    };
  }, [registerCommand, navigate]);

  return null;
}
