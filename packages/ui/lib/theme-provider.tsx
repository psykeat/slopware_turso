import { ScriptOnce } from "@tanstack/react-router";
import { createContext, use, useEffect, useState } from "react";

type Mode = "dark" | "light" | "system";
export type AccentTheme =
  | "indigo" | "ocean" | "cyan" | "teal" | "emerald"
  | "forest" | "amber" | "rose" | "violet" | "slate";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultMode?: Mode;
  defaultAccentTheme?: AccentTheme;
};

type ThemeProviderState = {
  theme: Mode;
  setTheme: (theme: Mode) => void;
  accentTheme: AccentTheme;
  setAccentTheme: (theme: AccentTheme) => void;
};

function getModeScript(modeKey: string, accentKey: string, defaultMode: Mode) {
  const k = JSON.stringify(modeKey);
  const ak = JSON.stringify(accentKey);
  const fallback = JSON.stringify(defaultMode);
  return `(function(){try{
    var t=localStorage.getItem(${k});
    if(t!=='light'&&t!=='dark'&&t!=='system'){t=${fallback}}
    var d=matchMedia('(prefers-color-scheme: dark)').matches;
    var r=t==='system'?(d?'dark':'light'):t;
    var e=document.documentElement;
    if(r==='dark'){e.classList.add('dark')}else{e.classList.remove('dark')}
    e.style.colorScheme=r;
    var ac=localStorage.getItem(${ak})||'indigo';
    e.setAttribute('data-theme',ac);
  }catch(e){}})();`;
}

const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: "system",
  setTheme: () => {},
  accentTheme: "indigo",
  setAccentTheme: () => {},
});

function applyMode(mode: Mode) {
  const root = document.documentElement;
  const resolved =
    mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : mode;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.style.colorScheme = resolved;
}

function applyAccent(accent: AccentTheme) {
  document.documentElement.setAttribute("data-theme", accent);
}

const VALID_ACCENTS: AccentTheme[] = [
  "indigo",
  "ocean",
  "cyan",
  "teal",
  "emerald",
  "forest",
  "amber",
  "rose",
  "violet",
  "slate",
];

function readStoredMode(defaultMode: Mode) {
  if (typeof window === "undefined") return defaultMode;
  const storedMode = window.localStorage.getItem("theme");
  return storedMode === "light" || storedMode === "dark" || storedMode === "system"
    ? storedMode
    : defaultMode;
}

function readStoredAccent(defaultAccentTheme: AccentTheme) {
  if (typeof window === "undefined") return defaultAccentTheme;
  const storedAccent = window.localStorage.getItem("accent-theme");
  return VALID_ACCENTS.includes(storedAccent as AccentTheme)
    ? (storedAccent as AccentTheme)
    : defaultAccentTheme;
}

export function ThemeProvider({
  children,
  defaultMode = "system",
  defaultAccentTheme = "indigo",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Mode>(() => readStoredMode(defaultMode));
  const [accentTheme, setAccentThemeState] = useState<AccentTheme>(() =>
    readStoredAccent(defaultAccentTheme),
  );

  useEffect(() => {
    applyMode(theme);
  }, [theme]);

  useEffect(() => {
    applyAccent(accentTheme);
  }, [accentTheme]);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyMode("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (next: Mode) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", next);
    }
    setThemeState(next);
  };

  const setAccentTheme = (next: AccentTheme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("accent-theme", next);
    }
    setAccentThemeState(next);
  };

  return (
    <ThemeProviderContext value={{ theme, setTheme, accentTheme, setAccentTheme }}>
      <ScriptOnce>{getModeScript("theme", "accent-theme", defaultMode)}</ScriptOnce>
      {children}
    </ThemeProviderContext>
  );
}

export function useTheme() {
  const context = use(ThemeProviderContext);
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
