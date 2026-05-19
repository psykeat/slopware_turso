import { authClient } from "@repo/auth/auth-client";
import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  MailIcon,
  UserRoundIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type AccountUser = {
  name?: string | null;
  email?: string | null;
};

export const Route = createFileRoute("/_auth/app/settings/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user } = Route.useRouteContext();
  const currentUser = user as AccountUser;
  const queryClient = useQueryClient();
  const router = useRouter();
  const { t } = useTranslation("ui");
  const { setSubCrumb } = useActionBar();

  const [displayName, setDisplayName] = useState(currentUser.name ?? "");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    setSubCrumb(t("account.title"));
    return () => setSubCrumb(undefined);
  }, [setSubCrumb, t]);

  const updateNameMutation = useMutation({
    mutationFn: async () => {
      const name = displayName.trim();
      if (!name) throw new Error(t("account.nameRequired"));

      const { error } = await authClient.updateUser({ name });
      if (error) throw new Error(error.message || t("account.nameError"));
    },
    onSuccess: () => {
      toast.success(t("account.nameSuccess"));
      void queryClient.invalidateQueries({ queryKey: authQueryOptions().queryKey });
      void router.invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message || t("account.nameError"));
    },
  });

  const changeEmailMutation = useMutation({
    mutationFn: async () => {
      const email = newEmail.trim();
      if (!email) throw new Error(t("account.emailRequired"));

      const { error } = await authClient.changeEmail({
        newEmail: email,
        callbackURL: "/app/settings/account",
      });
      if (error) throw new Error(error.message || t("account.emailError"));
    },
    onSuccess: () => {
      toast.success(t("account.emailSuccess"));
      setNewEmail("");
    },
    onError: (error: Error) => {
      toast.error(error.message || t("account.emailError"));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!currentPassword) throw new Error(t("account.currentPasswordRequired"));
      if (!nextPassword) throw new Error(t("account.newPasswordRequired"));
      if (nextPassword !== confirmPassword) throw new Error(t("account.passwordMismatch"));

      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword: nextPassword,
        revokeOtherSessions: true,
      });
      if (error) throw new Error(error.message || t("account.passwordError"));
    },
    onSuccess: () => {
      toast.success(t("account.passwordSuccess"));
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast.error(error.message || t("account.passwordError"));
    },
  });

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-6">
        <div className="flex items-center gap-3 text-sm text-ink-secondary">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={
              <Link to="/app/settings">
                <ArrowLeftIcon className="size-3.5" />
                {t("account.back")}
              </Link>
            }
          />
        </div>

        <section className="rounded-xl border border-hairline bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary)_5%,var(--canvas))_0%,var(--canvas)_100%)] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              className="grid size-12 place-items-center rounded-full text-sm font-medium"
              style={{
                background: "color-mix(in oklab, var(--primary) 16%, var(--canvas))",
                color: "var(--primary)",
              }}
            >
              {(displayName || currentUser.email || "U")
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-ink">
                  {t("account.title")}
                </h1>
                <span className="rounded-full border border-hairline bg-canvas px-2 py-0.5 text-[11px] tracking-wider text-ink-mute uppercase">
                  {t("account.selfService")}
                </span>
              </div>
              <p className="max-w-2xl text-sm text-ink-secondary">{t("account.description")}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setDisplayName(displayName.trim());
              updateNameMutation.mutate();
            }}
            className="rounded-xl border border-hairline bg-canvas p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary">
                <UserRoundIcon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-medium text-ink">{t("account.displayNameTitle")}</h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  {t("account.displayNameDescription")}
                </p>

                <div className="mt-4 grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="display-name">{t("account.displayNameLabel")}</Label>
                    <Input
                      id="display-name"
                      name="display-name"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder={t("account.displayNamePlaceholder")}
                      disabled={updateNameMutation.isPending}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={updateNameMutation.isPending}>
                      {updateNameMutation.isPending && (
                        <LoaderCircleIcon className="animate-spin" />
                      )}
                      {t("account.saveName")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </form>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              changeEmailMutation.mutate();
            }}
            className="rounded-xl border border-hairline bg-canvas p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary">
                <MailIcon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-medium text-ink">{t("account.emailTitle")}</h2>
                <p className="mt-1 text-sm text-ink-secondary">{t("account.emailDescription")}</p>

                <div className="mt-4 grid gap-4">
                  <div className="grid gap-2">
                    <Label>{t("account.currentEmailLabel")}</Label>
                    <div className="rounded-sm border border-hairline bg-canvas-soft px-3 py-2 text-sm text-ink-secondary">
                      {currentUser.email || "—"}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="new-email">{t("account.newEmailLabel")}</Label>
                    <Input
                      id="new-email"
                      name="new-email"
                      type="email"
                      value={newEmail}
                      onChange={(event) => setNewEmail(event.target.value)}
                      placeholder={t("account.newEmailPlaceholder")}
                      disabled={changeEmailMutation.isPending}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={changeEmailMutation.isPending}>
                      {changeEmailMutation.isPending && (
                        <LoaderCircleIcon className="animate-spin" />
                      )}
                      {t("account.changeEmail")}
                    </Button>
                    <span className="text-xs text-ink-mute">{t("account.emailNote")}</span>
                  </div>
                </div>
              </div>
            </div>
          </form>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              changePasswordMutation.mutate();
            }}
            className="rounded-xl border border-hairline bg-canvas p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary">
                <KeyRoundIcon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-medium text-ink">{t("account.passwordTitle")}</h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  {t("account.passwordDescription")}
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="current-password">{t("account.currentPasswordLabel")}</Label>
                    <Input
                      id="current-password"
                      name="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      placeholder={t("account.currentPasswordPlaceholder")}
                      disabled={changePasswordMutation.isPending}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="new-password">{t("account.newPasswordLabel")}</Label>
                    <Input
                      id="new-password"
                      name="new-password"
                      type="password"
                      value={nextPassword}
                      onChange={(event) => setNextPassword(event.target.value)}
                      placeholder={t("account.newPasswordPlaceholder")}
                      disabled={changePasswordMutation.isPending}
                    />
                  </div>

                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor="confirm-password">{t("account.confirmPasswordLabel")}</Label>
                    <Input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder={t("account.confirmPasswordPlaceholder")}
                      disabled={changePasswordMutation.isPending}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={changePasswordMutation.isPending}>
                    {changePasswordMutation.isPending && (
                      <LoaderCircleIcon className="animate-spin" />
                    )}
                    {t("account.changePassword")}
                  </Button>
                  <span className="text-xs text-ink-mute">{t("account.passwordNote")}</span>
                </div>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
