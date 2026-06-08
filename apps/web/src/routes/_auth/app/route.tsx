import { authClient } from "@repo/auth/auth-client";
import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { ActionBar } from "@repo/ui/components/action-bar";
import { FeedbackModal } from "@repo/ui/components/feedback-modal";
import { InlineDesigner } from "@repo/ui/components/inline-designer";
import { StatusBar } from "@repo/ui/components/status-bar";
import { useTheme, type AccentTheme } from "@repo/ui/lib/theme-provider";
import { useDismiss } from "@repo/ui/lib/use-dismiss";
import { cn } from "@repo/ui/lib/utils";
import { ActionBarProvider, useActionBar } from "@repo/ui/platform/action-bar-context";
import { useCommands } from "@repo/ui/platform/command-registry";
import { DesignerProvider } from "@repo/ui/platform/designer-context";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { TelemetryProvider, useTelemetry } from "@repo/ui/platform/telemetry-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import {
  UsersIcon,
  PackageIcon,
  FileTextIcon,
  LandmarkIcon,
  UploadCloudIcon,
  MailIcon,
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
import { useTranslation } from "react-i18next";

import { captureFeedbackSnapshot, type FeedbackSnapshot } from "#/lib/feedback-snapshot";
import i18n from "#/lib/i18n";

export const Route = createFileRoute("/_auth/app")({
  component: AppLayout,
});

const PRIMARY_MODULES = [
  {
    label: "Addresses",
    labelKey: "nav.addresses" as const,
    to: "/app/addresses" as const,
    icon: UsersIcon,
    kbd: "⌥1",
  },
  {
    label: "Articles",
    labelKey: "nav.articles" as const,
    to: "/app/articles" as const,
    icon: PackageIcon,
    kbd: "⌥2",
  },
  {
    label: "Documents",
    labelKey: "nav.documents" as const,
    to: "/app/documents" as const,
    icon: FileTextIcon,
    kbd: "⌥3",
  },
  {
    label: "Accounting",
    labelKey: "nav.accounting" as const,
    to: "/app/accounting" as const,
    icon: LandmarkIcon,
    kbd: "⌥4",
  },
  {
    label: "Import",
    labelKey: "nav.import" as const,
    to: "/app/import" as const,
    icon: UploadCloudIcon,
    kbd: "⌥5",
  },
  {
    label: "Email",
    labelKey: "nav.email" as const,
    to: "/app/email" as const,
    icon: MailIcon,
    kbd: "⌥6",
  },
] as const;

const ACCENT_THEMES: { id: AccentTheme; label: string; primary: string }[] = [
  { id: "indigo", label: "Indigo", primary: "#533afd" },
  { id: "ocean", label: "Ocean", primary: "#2563eb" },
  { id: "cyan", label: "Cyan", primary: "#0e7490" },
  { id: "teal", label: "Teal", primary: "#0f766e" },
  { id: "emerald", label: "Emerald", primary: "#047857" },
  { id: "forest", label: "Forest", primary: "#4d7c0f" },
  { id: "amber", label: "Amber", primary: "#b45309" },
  { id: "rose", label: "Rose", primary: "#e11d48" },
  { id: "violet", label: "Violet", primary: "#7c3aed" },
  { id: "slate", label: "Slate", primary: "#475569" },
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
          "flex h-8 items-center gap-2 rounded-md border border-hairline px-2.5 text-[13px] transition-colors",
          "hover:border-hairline-input hover:bg-canvas-soft",
          open && "border-hairline-input bg-canvas-soft",
        )}
      >
        <span className="size-2 flex-none rounded-full" style={{ background: "var(--primary)" }} />
        <span className="flex min-w-0 flex-col text-left leading-none">
          {orgName && (
            <span className="text-[9px] tracking-wider text-ink-mute uppercase">{orgName}</span>
          )}
          <span className="text-[13px] text-ink">{tenantName}</span>
        </span>
        <ChevronDownIcon className="size-3 flex-none text-ink-mute" />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-50 w-64 rounded-md border border-hairline bg-canvas py-1 shadow-lg">
          <div className="px-2.5 py-1.5 text-[10px] tracking-wider text-ink-mute uppercase">
            Switch Tenant
          </div>

          {isSystemAdmin && allTenants.length > 0 ? (
            allTenants.map((t) => {
              const isActive = t.tenantId === activeTenantId;
              return (
                <button
                  key={t.tenantId}
                  onClick={() => !isActive && handleSwitch(t.tenantId)}
                  className={cn(
                    "mx-0 flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-[13px] transition-colors",
                    isActive
                      ? "cursor-default bg-[color-mix(in_oklab,var(--primary)_9%,transparent)]"
                      : "cursor-pointer hover:bg-canvas-soft",
                  )}
                >
                  <span
                    className="size-2 flex-none rounded-full"
                    style={{ background: isActive ? "var(--primary)" : "var(--ink-mute)" }}
                  />
                  <span className="flex min-w-0 flex-1 flex-col leading-none">
                    <span className="truncate text-[10px] tracking-wider text-ink-mute uppercase">
                      {t.orgName}
                    </span>
                    <span className={cn("truncate", isActive ? "text-ink" : "text-ink-secondary")}>
                      {t.tenantName}
                    </span>
                  </span>
                  {isActive && <CheckIcon className="ml-auto size-3.5 flex-none text-ink-mute" />}
                </button>
              );
            })
          ) : (
            <div className="mx-1 flex cursor-default items-center gap-2.5 rounded-sm bg-[color-mix(in_oklab,var(--primary)_9%,transparent)] px-2.5 py-2 text-[13px]">
              <span
                className="size-2 flex-none rounded-full"
                style={{ background: "var(--primary)" }}
              />
              <span className="flex flex-col leading-none">
                {orgName && (
                  <span className="text-[10px] tracking-wider text-ink-mute uppercase">
                    {orgName}
                  </span>
                )}
                <span className="text-ink">{tenantName}</span>
              </span>
              <CheckIcon className="ml-auto size-3.5 text-ink-mute" />
            </div>
          )}

          {!isSystemAdmin && (
            <>
              <div className="mx-1.5 my-1 h-px bg-hairline" />
              <div className="mx-1 flex cursor-default items-center gap-2 rounded-sm px-2.5 py-2 text-[13px] text-ink-mute hover:bg-canvas-soft">
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
    {
      label: "Settings",
      icon: SettingsIcon,
      to: "/app/settings",
      adminOnly: false,
      special: false,
    },
    {
      label: "Administration",
      icon: ShieldCheckIcon,
      to: "/app/admin",
      adminOnly: true,
      special: false,
    },
    {
      label: "Base Tenant",
      icon: GlobeIcon,
      to: "/app/base-tenant",
      adminOnly: true,
      special: true,
    },
  ].filter((i) => !i.adminOnly || isSystemAdmin);

  const isActive = items.some((i) => location.pathname.startsWith(i.to));

  return (
    <div ref={ref} className="relative flex-none">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "grid size-8 place-items-center rounded-md text-ink-secondary transition-colors",
          "hover:bg-canvas-soft hover:text-ink",
          (open || isActive) && "bg-canvas-soft text-ink",
        )}
        title="System"
      >
        <span className="font-mono text-[13px] leading-none">⋯</span>
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-1/2 z-50 w-48 -translate-x-1/2 rounded-md border border-hairline bg-canvas py-1 shadow-lg">
          <div className="px-2.5 py-1.5 text-[10px] tracking-wider text-ink-mute uppercase">
            System
          </div>
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to as any}
              onClick={() => setOpen(false)}
              className={cn(
                "mx-1 flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] text-ink-secondary",
                "hover:bg-canvas-soft hover:text-ink",
                location.pathname.startsWith(item.to) &&
                  "bg-[color-mix(in_oklab,var(--primary)_9%,transparent)] text-ink",
                item.special && "mt-1 border border-dashed border-hairline-input",
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
        className="grid size-[26px] place-items-center rounded-full text-[11px] font-normal select-none"
        style={{
          background: "color-mix(in oklab, var(--primary) 18%, var(--canvas))",
          color: "var(--primary)",
        }}
        title={userName}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-50 w-64 rounded-md border border-hairline bg-canvas py-1 shadow-lg">
          {/* User info */}
          <div className="mb-1 border-b border-hairline px-2.5 py-2.5">
            <div className="text-[13px] text-ink">{userName}</div>
            <div className="text-[11px] text-ink-mute">{userEmail}</div>
          </div>

          {/* User Config */}
          <Link
            to="/app/settings/account"
            onClick={() => setOpen(false)}
            className="mx-auto flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-[13px] text-ink-secondary hover:bg-canvas-soft hover:text-ink"
          >
            {t("avatar.userConfig")}
          </Link>

          {/* Language */}
          <div className="flex items-center justify-between px-2.5 py-2 text-[13px] text-ink-secondary">
            <span>{t("avatar.language")}</span>
            <div className="flex gap-0 rounded-sm bg-black/5 p-0.5 dark:bg-white/10">
              {(["EN", "DE"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "rounded-[3px] px-2 py-0.5 text-[11px] transition-colors",
                    lang === l
                      ? "bg-canvas text-ink dark:bg-white/15"
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
            <div className="flex gap-0 rounded-sm bg-black/5 p-0.5 dark:bg-white/10">
              {(
                [
                  { labelKey: "avatar.day" as const, value: "light" as const, icon: SunIcon },
                  { labelKey: "avatar.night" as const, value: "dark" as const, icon: MoonIcon },
                  { labelKey: "avatar.auto" as const, value: "system" as const, icon: MonitorIcon },
                ] as const
              ).map((m) => (
                <button
                  key={m.value}
                  onClick={() => setTheme(m.value)}
                  title={t(m.labelKey)}
                  className={cn(
                    "flex items-center gap-1 rounded-[3px] px-2 py-0.5 text-[11px] transition-colors",
                    theme === m.value
                      ? "bg-canvas text-ink dark:bg-white/15"
                      : "text-ink-mute hover:text-ink",
                  )}
                >
                  <m.icon className="size-3" />
                </button>
              ))}
            </div>
          </div>

          {/* Theme swatches */}
          <div className="px-2.5 pt-1 pb-2">
            <div className="mb-2 text-[10px] tracking-wider text-ink-mute uppercase">
              {t("avatar.theme")}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {ACCENT_THEMES.map((t) => (
                <button
                  key={t.id}
                  title={t.label}
                  onClick={() => setAccentTheme(t.id)}
                  className={cn(
                    "grid size-7 place-items-center rounded-md transition-all",
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

          <div className="mx-1.5 my-1 h-px bg-hairline" />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="mx-auto flex w-full items-center justify-between rounded-sm px-2.5 py-2 text-left text-[13px] text-destructive hover:bg-canvas-soft"
          >
            <span>{t("avatar.signOut")}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function AppBar({
  isSystemAdmin,
  userName,
  userEmail,
  onFeedbackClick,
}: {
  isSystemAdmin: boolean;
  userName: string;
  userEmail: string;
  onFeedbackClick: () => void;
}) {
  const location = useLocation();
  const { executeCommand } = useCommands();
  const { t } = useTranslation("ui");

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-2.5 border-b border-hairline bg-canvas px-3">
      {/* Brand */}
      <div className="flex flex-none items-center gap-2 px-1">
        <div
          className="grid size-6 flex-none place-items-center rounded-md text-xs"
          style={{
            background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-soft) 100%)",
            color: "var(--primary-fg)",
          }}
        >
          ◇
        </div>
        <span className="text-[15px] tracking-tight text-ink">slopware</span>
      </div>

      <div className="h-5 w-px flex-none bg-hairline" />

      <TenantSwitcher isSystemAdmin={isSystemAdmin} />

      <div className="h-5 w-px flex-none bg-hairline" />

      {/* Module tabs */}
      <nav className="flex flex-none items-center gap-0.5">
        {PRIMARY_MODULES.map((m) => {
          const active = location.pathname.startsWith(m.to);
          return (
            <Link
              key={m.to}
              to={m.to}
              className={cn(
                "group flex h-8 flex-none items-center gap-2 rounded-md px-2.5 text-[13px] transition-colors",
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
                  "rounded-[3px] border px-1 font-mono text-[10px] opacity-0 transition-opacity group-hover:opacity-100",
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
        className="mr-1 ml-auto flex h-[30px] cursor-default items-center gap-2 overflow-hidden rounded-md border border-hairline bg-canvas-soft px-2.5 text-[13px] text-ink-mute transition-colors hover:border-hairline-input"
        style={{ flex: "1 1 auto", maxWidth: "360px", minWidth: 0 }}
      >
        <SearchIcon className="size-3 flex-none" />
        <span className="flex-1 truncate">Search records, articles, documents…</span>
        <span className="ml-auto flex flex-none gap-0.5">
          <span className="rounded-[3px] border border-hairline bg-canvas px-1 font-mono text-[10px] text-ink-mute">
            ⌘
          </span>
          <span className="rounded-[3px] border border-hairline bg-canvas px-1 font-mono text-[10px] text-ink-mute">
            K
          </span>
        </span>
      </div>

      {/* Right rail */}
      <div className="flex flex-none items-center gap-1">
        <button
          onClick={() => executeCommand("show-help")}
          className="grid size-7 place-items-center rounded-sm text-ink-secondary transition-colors hover:bg-canvas-soft hover:text-ink"
          title="Keyboard shortcuts (?)"
        >
          <HelpCircleIcon className="size-[15px]" />
        </button>
        <button
          onClick={onFeedbackClick}
          className="grid size-7 place-items-center rounded-sm text-ink-secondary transition-colors hover:bg-canvas-soft hover:text-ink"
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
  telemetry: { errors: [], apiCalls: [], navigation: [], commands: [] },
};

function AppLayoutInner({
  isSystemAdmin,
  userName,
  userEmail,
  tenantName,
  userId,
  tenantId,
}: {
  isSystemAdmin: boolean;
  userName: string;
  userEmail: string;
  tenantName: string;
  userId: string;
  tenantId: string;
}) {
  const { subCrumb } = useActionBar();
  const { state: focusState } = useFocus();
  const { registerCommand } = useCommands();
  const { getSnapshot } = useTelemetry();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<FeedbackSnapshot>(DEFAULT_SNAPSHOT);
  const prevFeedbackOpen = useRef(false);
  const focusSnapshotRef = useRef(focusState);

  useEffect(() => {
    focusSnapshotRef.current = focusState;
  }, [focusState]);

  // Capture snapshot when modal transitions to open
  useEffect(() => {
    if (feedbackOpen && !prevFeedbackOpen.current) {
      const telemetry = getSnapshot();
      const errors = telemetry.errors;
      const lastError =
        errors.length > 0
          ? { message: errors[errors.length - 1].message, stack: errors[errors.length - 1].stack }
          : null;
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
          telemetry,
        ),
      );
    }
    prevFeedbackOpen.current = feedbackOpen;
  }, [feedbackOpen, userId, tenantId, focusState, getSnapshot]);

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
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <AppBar
        isSystemAdmin={isSystemAdmin}
        userName={userName}
        userEmail={userEmail}
        onFeedbackClick={handleFeedbackClick}
      />

      <ActionBar subCrumb={subCrumb} className="shrink-0" />

      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      <StatusBar tenantName={tenantName} className="shrink-0" />

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        snapshot={snapshot}
      />
      <InlineDesigner />
    </div>
  );
}

function AppLayout() {
  const { user } = Route.useRouteContext();

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

  return (
    <TelemetryProvider>
      <ActionBarProvider>
        <DesignerProvider>
          <AppLayoutInner
            isSystemAdmin={isSystemAdmin}
            userName={userName}
            userEmail={userEmail}
            tenantName={tenantName}
            userId={userId}
            tenantId={tenantId}
          />
        </DesignerProvider>
      </ActionBarProvider>
    </TelemetryProvider>
  );
}
