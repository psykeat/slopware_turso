import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  UsersIcon,
  PackageIcon,
  FileTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  GlobeIcon,
  SearchIcon,
  HelpCircleIcon,
  MessageSquarePlusIcon,
  ChevronDownIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  CheckIcon,
  PlusIcon,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { authClient } from "@repo/auth/auth-client";
import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { ActionBar } from "@repo/ui/components/action-bar";
import { StatusBar } from "@repo/ui/components/status-bar";
import { FeedbackModal } from "@repo/ui/components/feedback-modal";
import { useTheme, type AccentTheme } from "@repo/ui/lib/theme-provider";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { ActionBarProvider, useActionBar } from "@repo/ui/platform/action-bar-context";
import { cn } from "@repo/ui/lib/utils";
import { useDismiss } from "@repo/ui/lib/use-dismiss";
import { useTranslation } from "react-i18next";
import i18n from "#/lib/i18n";
import { captureFeedbackSnapshot, type FeedbackSnapshot } from "#/lib/feedback-snapshot";

export const Route = createFileRoute("/_auth/app")({
  component: AppLayout,
});

const PRIMARY_MODULES = [
  { label: "Addresses", labelKey: "nav.addresses" as const, to: "/app/addresses" as const, icon: UsersIcon, kbd: "⌥1" },
  { label: "Articles",  labelKey: "nav.articles" as const,  to: "/app/articles"  as const, icon: PackageIcon, kbd: "⌥2" },
  { label: "Documents", labelKey: "nav.documents" as const, to: "/app/documents" as const, icon: FileTextIcon, kbd: "⌥3" },
] as const;

const ACCENT_THEMES: { id: AccentTheme; label: string; primary: string }[] = [
  { id: "indigo",  label: "Indigo",  primary: "#533afd" },
  { id: "ocean",   label: "Ocean",   primary: "#2563eb" },
  { id: "cyan",    label: "Cyan",    primary: "#0e7490" },
  { id: "teal",    label: "Teal",    primary: "#0f766e" },
  { id: "emerald", label: "Emerald", primary: "#047857" },
  { id: "forest",  label: "Forest",  primary: "#4d7c0f" },
  { id: "amber",   label: "Amber",   primary: "#b45309" },
  { id: "rose",    label: "Rose",    primary: "#e11d48" },
  { id: "violet",  label: "Violet",  primary: "#7c3aed" },
  { id: "slate",   label: "Slate",   primary: "#475569" },
];

type TenantEntry = { tenantId: string; tenantName: string; orgName: string; isBase: boolean };

function TenantSwitcher({ isSystemAdmin }: { isSystemAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  useDismiss(open, () => setOpen(false), ref);

  const { data: tenantInfo } = useQuery({
    queryKey: ["me", "tenant"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return null;
      return res.json() as Promise<{ tenantId: string; tenantName: string; orgName: string }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: allTenants = [] } = useQuery({
    queryKey: ["tenants", "all"],
    queryFn: async () => {
      const res = await fetch("/api/tenants");
      if (!res.ok) return [] as TenantEntry[];
      return res.json() as Promise<TenantEntry[]>;
    },
    enabled: isSystemAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const handleSwitch = async (tenantId: string) => {
    setOpen(false);
    await fetch("/api/active-tenant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    queryClient.invalidateQueries({ queryKey: ["data"] });
  };

  const tenantName = tenantInfo?.tenantName ?? "…";
  const orgName = tenantInfo?.orgName ?? "";
  const activeTenantId = tenantInfo?.tenantId;

  return (
    <div ref={ref} className="relative flex-none">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-8 px-2.5 border border-hairline rounded-md flex items-center gap-2 text-[13px] transition-colors",
          "hover:bg-canvas-soft hover:border-hairline-input",
          open && "bg-canvas-soft border-hairline-input",
        )}
      >
        <span className="size-2 rounded-full flex-none" style={{ background: "var(--primary)" }} />
        <span className="flex flex-col leading-none text-left min-w-0">
          {orgName && <span className="text-[9px] text-ink-mute uppercase tracking-wider">{orgName}</span>}
          <span className="text-[13px] text-ink">{tenantName}</span>
        </span>
        <ChevronDownIcon className="size-3 text-ink-mute flex-none" />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 w-64 bg-canvas border border-hairline rounded-md shadow-lg z-50 py-1">
          <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-ink-mute">Switch Tenant</div>

          {isSystemAdmin && allTenants.length > 0 ? (
            allTenants.map((t) => {
              const isActive = t.tenantId === activeTenantId;
              return (
                <button
                  key={t.tenantId}
                  onClick={() => !isActive && handleSwitch(t.tenantId)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 mx-0 rounded-sm text-[13px] text-left transition-colors",
                    isActive
                      ? "bg-[color-mix(in_oklab,var(--primary)_9%,transparent)] cursor-default"
                      : "hover:bg-canvas-soft cursor-pointer",
                  )}
                >
                  <span className="size-2 rounded-full flex-none" style={{ background: isActive ? "var(--primary)" : "var(--ink-mute)" }} />
                  <span className="flex flex-col leading-none min-w-0 flex-1">
                    <span className="text-[10px] uppercase tracking-wider text-ink-mute truncate">{t.orgName}</span>
                    <span className={cn("truncate", isActive ? "text-ink" : "text-ink-secondary")}>{t.tenantName}</span>
                  </span>
                  {isActive && <CheckIcon className="size-3.5 ml-auto flex-none text-ink-mute" />}
                </button>
              );
            })
          ) : (
            <div className="flex items-center gap-2.5 px-2.5 py-2 mx-1 rounded-sm cursor-default text-[13px] bg-[color-mix(in_oklab,var(--primary)_9%,transparent)]">
              <span className="size-2 rounded-full flex-none" style={{ background: "var(--primary)" }} />
              <span className="flex flex-col leading-none">
                {orgName && <span className="text-[10px] uppercase tracking-wider text-ink-mute">{orgName}</span>}
                <span className="text-ink">{tenantName}</span>
              </span>
              <CheckIcon className="size-3.5 ml-auto text-ink-mute" />
            </div>
          )}

          {!isSystemAdmin && (
            <>
              <div className="h-px bg-hairline my-1 mx-1.5" />
              <div className="flex items-center gap-2 px-2.5 py-2 mx-1 rounded-sm text-[13px] text-ink-mute hover:bg-canvas-soft cursor-default">
                <PlusIcon className="size-3.5" />
                <span>New Tenant…</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SystemOverflow({ isSystemAdmin }: { isSystemAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  useDismiss(open, () => setOpen(false), ref);

  const items = [
    { label: "Settings", icon: SettingsIcon, to: "/app/settings", adminOnly: false, special: false },
    { label: "Administration", icon: ShieldCheckIcon, to: "/app/admin", adminOnly: true, special: false },
    { label: "Base Tenant", icon: GlobeIcon, to: "/app/base-tenant", adminOnly: true, special: true },
  ].filter((i) => !i.adminOnly || isSystemAdmin);

  const isActive = items.some((i) => location.pathname.startsWith(i.to));

  return (
    <div ref={ref} className="relative flex-none">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "size-8 grid place-items-center rounded-md transition-colors text-ink-secondary",
          "hover:bg-canvas-soft hover:text-ink",
          (open || isActive) && "bg-canvas-soft text-ink",
        )}
        title="System"
      >
        <span className="text-[13px] font-mono leading-none">⋯</span>
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 w-48 bg-canvas border border-hairline rounded-md shadow-lg z-50 py-1">
          <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-ink-mute">System</div>
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to as any}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 mx-1 rounded-sm text-[13px] text-ink-secondary",
                "hover:bg-canvas-soft hover:text-ink",
                location.pathname.startsWith(item.to) &&
                  "bg-[color-mix(in_oklab,var(--primary)_9%,transparent)] text-ink",
                item.special && "border border-dashed border-hairline-input mt-1",
              )}
            >
              <item.icon className="size-3.5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AvatarMenu({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, setTheme, accentTheme, setAccentTheme } = useTheme();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { t, i18n: i18nInstance } = useTranslation("ui");
  const lang = i18nInstance.language === "de" ? "DE" : "EN";
  const setLang = (l: "EN" | "DE") => {
    const next = l.toLowerCase();
    i18n.changeLanguage(next);
    localStorage.setItem("lang", next);
  };
  useDismiss(open, () => setOpen(false), ref);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onResponse: async () => {
          queryClient.setQueryData(authQueryOptions().queryKey, null);
          await router.invalidate();
        },
      },
    });
  };

  return (
    <div ref={ref} className="relative flex-none">
      <button
        onClick={() => setOpen((o) => !o)}
        className="size-[26px] rounded-full grid place-items-center text-[11px] font-normal select-none"
        style={{
          background: "color-mix(in oklab, var(--primary) 18%, var(--canvas))",
          color: "var(--primary)",
        }}
        title={userName}
      >
        {initials}
      </button>

      {open && (
        <div
          className="absolute top-[calc(100%+6px)] right-0 w-64 bg-canvas border border-hairline rounded-md shadow-lg z-50 py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {/* User info */}
          <div className="px-2.5 py-2.5 border-b border-hairline mb-1">
            <div className="text-[13px] text-ink">{userName}</div>
            <div className="text-[11px] text-ink-mute">{userEmail}</div>
          </div>

          {/* User Config */}
          <button className="w-full text-left flex items-center gap-2 px-2.5 py-2 mx-auto text-[13px] text-ink-secondary hover:bg-canvas-soft hover:text-ink rounded-sm">
            {t("avatar.userConfig")}
          </button>

          {/* Language */}
          <div className="flex items-center justify-between px-2.5 py-2 text-[13px] text-ink-secondary">
            <span>{t("avatar.language")}</span>
            <div className="flex p-0.5 gap-0 rounded-sm bg-black/5 dark:bg-white/10">
              {(["EN", "DE"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-[3px] transition-colors",
                    lang === l
                      ? "bg-canvas dark:bg-white/15 text-ink"
                      : "text-ink-mute hover:text-ink",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Day / Night */}
          <div className="flex items-center justify-between px-2.5 py-2 text-[13px] text-ink-secondary">
            <span>{t("avatar.appearance")}</span>
            <div className="flex p-0.5 gap-0 rounded-sm bg-black/5 dark:bg-white/10">
              {([
                { labelKey: "avatar.day" as const, value: "light" as const, icon: SunIcon },
                { labelKey: "avatar.night" as const, value: "dark" as const, icon: MoonIcon },
                { labelKey: "avatar.auto" as const, value: "system" as const, icon: MonitorIcon },
              ] as const).map((m) => (
                <button
                  key={m.value}
                  onClick={() => setTheme(m.value)}
                  title={t(m.labelKey)}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-[3px] flex items-center gap-1 transition-colors",
                    theme === m.value
                      ? "bg-canvas dark:bg-white/15 text-ink"
                      : "text-ink-mute hover:text-ink",
                  )}
                >
                  <m.icon className="size-3" />
                </button>
              ))}
            </div>
          </div>

          {/* Theme swatches */}
          <div className="px-2.5 pb-2 pt-1">
            <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-2">{t("avatar.theme")}</div>
            <div className="grid grid-cols-5 gap-1.5">
              {ACCENT_THEMES.map((t) => (
                <button
                  key={t.id}
                  title={t.label}
                  onClick={() => setAccentTheme(t.id)}
                  className={cn(
                    "size-7 rounded-md grid place-items-center transition-all",
                    accentTheme === t.id && "ring-2 ring-offset-1 ring-offset-canvas",
                  )}
                  style={{
                    background: t.primary,
                    outline: accentTheme === t.id ? `2px solid ${t.primary}` : "none",
                    outlineOffset: "2px",
                  }}
                >
                  {accentTheme === t.id && <CheckIcon className="size-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-hairline my-1 mx-1.5" />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full text-left flex items-center justify-between px-2.5 py-2 text-[13px] text-destructive hover:bg-canvas-soft rounded-sm mx-auto"
          >
            <span>{t("avatar.signOut")}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function AppBar({ isSystemAdmin, userName, userEmail, onFeedbackClick }: {
  isSystemAdmin: boolean;
  userName: string;
  userEmail: string;
  onFeedbackClick: () => void;
}) {
  const location = useLocation();
  const { executeCommand } = useCommands();
  const { t } = useTranslation("ui");

  return (
    <header className="h-12 bg-canvas border-b border-hairline flex items-center px-3 gap-2.5 z-30 relative shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 px-1 flex-none">
        <div
          className="size-6 rounded-md grid place-items-center text-xs flex-none"
          style={{
            background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-soft) 100%)",
            color: "var(--primary-fg)",
          }}
        >
          ◇
        </div>
        <span className="text-[15px] text-ink tracking-tight">slopware</span>
      </div>

      <div className="w-px h-5 bg-hairline flex-none" />

      <TenantSwitcher isSystemAdmin={isSystemAdmin} />

      <div className="w-px h-5 bg-hairline flex-none" />

      {/* Module tabs */}
      <nav className="flex items-center gap-0.5 flex-none">
        {PRIMARY_MODULES.map((m) => {
          const active = location.pathname.startsWith(m.to);
          return (
            <Link
              key={m.to}
              to={m.to}
              className={cn(
                "h-8 px-2.5 rounded-md flex items-center gap-2 text-[13px] transition-colors flex-none group",
                active
                  ? "text-primary-fg"
                  : "text-ink-secondary hover:bg-canvas-soft hover:text-ink",
              )}
              style={active ? { background: "var(--primary)" } : undefined}
            >
              <m.icon className="size-3.5" />
              <span>{t(m.labelKey)}</span>
              <span
                className={cn(
                  "font-mono text-[10px] px-1 border rounded-[3px] opacity-0 group-hover:opacity-100 transition-opacity",
                  active ? "opacity-100" : "",
                )}
                style={
                  active
                    ? {
                        color: "color-mix(in oklab, var(--primary-fg) 85%, transparent)",
                        borderColor: "color-mix(in oklab, var(--primary-fg) 30%, transparent)",
                        background: "color-mix(in oklab, var(--primary-fg) 12%, transparent)",
                      }
                    : { color: "var(--ink-mute)", borderColor: "var(--hairline)" }
                }
              >
                {m.kbd}
              </span>
            </Link>
          );
        })}

        <SystemOverflow isSystemAdmin={isSystemAdmin} />
      </nav>

      {/* Search — grows to fill available space */}
      <div
        className="flex items-center gap-2 h-[30px] px-2.5 border border-hairline rounded-md bg-canvas-soft text-[13px] text-ink-mute overflow-hidden ml-auto mr-1 hover:border-hairline-input transition-colors cursor-default"
        style={{ flex: "1 1 auto", maxWidth: "360px", minWidth: 0 }}
      >
        <SearchIcon className="size-3 flex-none" />
        <span className="truncate flex-1">Search records, articles, documents…</span>
        <span className="flex gap-0.5 ml-auto flex-none">
          <span className="font-mono text-[10px] px-1 border border-hairline rounded-[3px] bg-canvas text-ink-mute">⌘</span>
          <span className="font-mono text-[10px] px-1 border border-hairline rounded-[3px] bg-canvas text-ink-mute">K</span>
        </span>
      </div>

      {/* Right rail */}
      <div className="flex items-center gap-1 flex-none">
        <button
          onClick={() => executeCommand("show-help")}
          className="size-7 grid place-items-center rounded-sm text-ink-secondary hover:bg-canvas-soft hover:text-ink transition-colors"
          title="Keyboard shortcuts (?)"
        >
          <HelpCircleIcon className="size-[15px]" />
        </button>
        <button
          onClick={onFeedbackClick}
          className="size-7 grid place-items-center rounded-sm text-ink-secondary hover:bg-canvas-soft hover:text-ink transition-colors"
          title="Report issue or feedback (Shift+F1)"
        >
          <MessageSquarePlusIcon className="size-[15px]" />
        </button>
        <AvatarMenu userName={userName} userEmail={userEmail} />
      </div>
    </header>
  );
}

const DEFAULT_SNAPSHOT: FeedbackSnapshot = {
  url: "",
  userAgent: "",
  viewport: { width: 0, height: 0 },
  userId: "",
  tenantId: "",
  locale: "",
  lastError: null,
  timestamp: "",
  focusState: {},
};

function AppLayoutInner({ isSystemAdmin, userName, userEmail, tenantName, moduleCrumb, userId, tenantId }: {
  isSystemAdmin: boolean;
  userName: string;
  userEmail: string;
  tenantName: string;
  moduleCrumb: string | undefined;
  userId: string;
  tenantId: string;
}) {
  const { subCrumb } = useActionBar();
  const { state: focusState } = useFocus();
  const { registerCommand } = useCommands();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [lastError, setLastError] = useState<{ message: string; stack?: string } | null>(null);
  const [snapshot, setSnapshot] = useState<FeedbackSnapshot>(DEFAULT_SNAPSHOT);
  const prevFeedbackOpen = useRef(false);

  // Global error capture
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      setLastError({ message: event.message, stack: event.error?.stack });
    };
    const unhandledHandler = (event: PromiseRejectionEvent) => {
      setLastError({ message: String(event.reason), stack: event.reason?.stack });
    };
    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", unhandledHandler);
    return () => {
      window.removeEventListener("error", handler);
      window.removeEventListener("unhandledrejection", unhandledHandler);
    };
  }, []);

  // Capture snapshot when modal transitions to open
  useEffect(() => {
    if (feedbackOpen && !prevFeedbackOpen.current) {
      setSnapshot(
        captureFeedbackSnapshot(
          userId,
          tenantId,
          i18n.language,
          {
            entity: focusState.entity ?? undefined,
            recordId: focusState.recordId ?? undefined,
            panelId: focusState.panel ?? undefined,
          },
          lastError,
        ),
      );
    }
    prevFeedbackOpen.current = feedbackOpen;
  }, [feedbackOpen, userId, tenantId, focusState, lastError]);

  // Register open-feedback command
  useEffect(() => {
    const unregister = registerCommand({
      id: "open-feedback",
      scope: "global",
      group: "workflow",
      label: { en: "Report Issue / Feedback", de: "Problem / Feedback melden" },
      shortcut: "Shift+F1",
      handler: () => setFeedbackOpen(true),
    });
    return unregister;
  }, [registerCommand]);

  const handleFeedbackClick = () => setFeedbackOpen(true);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-canvas">
      <AppBar
        isSystemAdmin={isSystemAdmin}
        userName={userName}
        userEmail={userEmail}
        onFeedbackClick={handleFeedbackClick}
      />

      <ActionBar
        crumbs={moduleCrumb ? [moduleCrumb] : undefined}
        subCrumb={subCrumb}
        className="shrink-0"
      />

      <main className="flex-1 overflow-hidden min-h-0">
        <Outlet />
      </main>

      <StatusBar tenantName={tenantName} className="shrink-0" />

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        snapshot={snapshot}
      />
    </div>
  );
}

function AppLayout() {
  const { user } = Route.useRouteContext();
  const location = useLocation();
  const { t } = useTranslation("ui");

  const userName = (user as any)?.name ?? (user as any)?.user?.name ?? "User";
  const userEmail = (user as any)?.email ?? (user as any)?.user?.email ?? "";
  const userId = (user as any)?.id ?? (user as any)?.user?.id ?? "";
  const isSystemAdmin = (user as any)?.isSystemAdmin ?? false;

  const { data: tenantInfo } = useQuery({
    queryKey: ["me", "tenant"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return null;
      return res.json() as Promise<{ tenantName: string; orgName: string; tenantId?: string }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const tenantName = tenantInfo?.tenantName ?? "";
  const tenantId = tenantInfo?.tenantId ?? "";

  const activeModule = PRIMARY_MODULES.find((m) =>
    location.pathname.startsWith(m.to),
  );
  const moduleCrumb = activeModule ? t(activeModule.labelKey) : undefined;

  return (
    <ActionBarProvider>
      <AppLayoutInner
        isSystemAdmin={isSystemAdmin}
        userName={userName}
        userEmail={userEmail}
        tenantName={tenantName}
        moduleCrumb={moduleCrumb}
        userId={userId}
        tenantId={tenantId}
      />
    </ActionBarProvider>
  );
}
