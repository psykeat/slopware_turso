/* eslint-disable */
// @ts-nocheck
import { SiGmail } from "@icons-pack/react-simple-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MailIcon, TrashIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface TenantEmailSettingsPanelProps {
  title: string;
}

type EmailAccount = {
  emailAccountId: string;
  provider: "gmail" | "microsoft";
  displayName: string;
  primaryEmail: string;
  status: string;
  grantedByUserId?: string | null;
  grantedScopes?: unknown | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
};

export function TenantEmailSettingsPanel({ title }: TenantEmailSettingsPanelProps) {
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery<EmailAccount[]>({
    queryKey: ["email", "accounts"],
    queryFn: async () => {
      const res = await fetch("/api/email/accounts");
      if (!res.ok) throw new Error("Failed to fetch email accounts");
      return res.json();
    },
  });

  const connectProvider = useCallback((provider: "google" | "microsoft") => {
    window.location.href = `/api/email/accounts/connect/${provider}`;
  }, []);

  const revokeAccount = useCallback(
    async (accountId: string) => {
      setRevoking(accountId);
      try {
        const res = await fetch(`/api/email/accounts/${accountId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          toast.error(await res.text());
          return;
        }
        toast.success("Account revoked successfully");
        queryClient.invalidateQueries({ queryKey: ["email"] });
      } catch (e) {
        toast.error("An error occurred");
      } finally {
        setRevoking(null);
      }
    },
    [queryClient],
  );

  return (
    <div className="max-w-3xl p-6">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="mb-1 text-[15px] font-medium text-ink">{title}</h2>
          <p className="text-[13px] text-ink-mute">
            Manage your connected email accounts for this tenant.
          </p>
        </div>

        <div className="rounded-md border border-hairline-input bg-canvas p-4">
          <h3 className="mb-4 text-[14px] font-medium text-ink">Email Account hinzufügen</h3>
          <div className="flex gap-3">
            <button
              onClick={() => connectProvider("google")}
              className="flex h-9 items-center justify-center gap-2 rounded-md border border-hairline px-4 text-[13px] font-medium text-ink-secondary hover:bg-canvas-soft hover:text-ink"
            >
              <SiGmail className="size-4" style={{ color: "#ea4335" }} />
              Connect Gmail
            </button>
            <button
              onClick={() => connectProvider("microsoft")}
              className="flex h-9 items-center justify-center gap-2 rounded-md border border-hairline px-4 text-[13px] font-medium text-ink-secondary hover:bg-canvas-soft hover:text-ink"
            >
              <MailIcon className="size-4" style={{ color: "#0078d4" }} />
              Connect Microsoft Graph
            </button>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-[14px] font-medium text-ink">Connected Accounts</h3>
          {isLoading ? (
            <div className="text-[13px] text-ink-mute">Loading...</div>
          ) : accounts.length === 0 ? (
            <div className="rounded-md border border-hairline bg-canvas-soft px-4 py-3 text-[13px] text-ink-mute">
              No email accounts connected.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {accounts.map((account) => (
                <div
                  key={account.emailAccountId}
                  className="flex items-center justify-between rounded-md border border-hairline bg-canvas p-4"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{account.primaryEmail}</span>
                      <span className="rounded bg-canvas-soft px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-ink-mute uppercase">
                        {account.provider}
                      </span>
                    </div>
                    {account.displayName && account.displayName !== account.primaryEmail && (
                      <div className="text-[12px] text-ink-secondary">{account.displayName}</div>
                    )}
                    <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-ink-mute">
                      <div>Status: {account.status}</div>
                      {account.lastSyncAt && (
                        <div>
                          Last Sync: {new Date(account.lastSyncAt).toLocaleString()}{" "}
                          {account.lastSyncStatus && `(${account.lastSyncStatus})`}
                        </div>
                      )}
                      {account.grantedByUserId && <div>Granted By: {account.grantedByUserId}</div>}
                      {account.grantedScopes && (
                        <div>Scopes: {JSON.stringify(account.grantedScopes)}</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => revokeAccount(account.emailAccountId)}
                    disabled={revoking === account.emailAccountId}
                    className="flex h-8 items-center justify-center gap-1.5 rounded px-3 text-[12px] font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <TrashIcon className="size-3.5" />
                    {revoking === account.emailAccountId ? "Revoking..." : "Revoke"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
