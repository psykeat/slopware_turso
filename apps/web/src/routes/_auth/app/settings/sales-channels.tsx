import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  PlusIcon,
  SaveIcon,
  WifiIcon,
  WifiOffIcon,
  Loader2Icon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { capability } from "#/server-fns/capabilities";

export const Route = createFileRoute("/_auth/app/settings/sales-channels")({
  component: SalesChannelsPage,
});

interface SalesChannelRecord {
  salesChannelId: string;
  name: string;
  platform: string;
  apiUrl: string;
  credentials: { clientId?: string; clientSecret?: string; appSecret?: string } | null;
  masterDataPolicy: string | null;
  isActive: boolean;
}

const PLATFORMS = [
  { value: "shopware6", label: "Shopware 6" },
  { value: "shopify", label: "Shopify" },
  { value: "woocommerce", label: "WooCommerce" },
  { value: "prestashop", label: "PrestaShop" },
] as const;

function SalesChannelsView() {
  const { setSubCrumb } = useActionBar();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [formName, setFormName] = useState("");
  const [formPlatform, setFormPlatform] = useState("shopware6");
  const [formApiUrl, setFormApiUrl] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [formClientSecret, setFormClientSecret] = useState("");
  const [formAppSecret, setFormAppSecret] = useState("");
  const [formMasterDataPolicy, setFormMasterDataPolicy] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  const { data: channels = [], isLoading } = useQuery<SalesChannelRecord[]>({
    queryKey: ["commerce", "salesChannels"],
    queryFn: async () => {
      const { items } = await capability("commerce.salesChannel.list")({});
      return items as unknown as SalesChannelRecord[];
    },
  });

  const loadChannel = (ch: SalesChannelRecord) => {
    setSelectedId(ch.salesChannelId);
    setIsCreating(false);
    setFormName(ch.name);
    setFormPlatform(ch.platform);
    setFormApiUrl(ch.apiUrl);
    setFormClientId((ch.credentials as any)?.clientId ?? "");
    setFormClientSecret((ch.credentials as any)?.clientSecret ?? "");
    setFormAppSecret((ch.credentials as any)?.appSecret ?? "");
    setFormMasterDataPolicy(ch.masterDataPolicy ?? "");
    setFormIsActive(ch.isActive);
    setSubCrumb(ch.name);
  };

  const startCreate = () => {
    setSelectedId(null);
    setIsCreating(true);
    setFormName("");
    setFormPlatform("shopware6");
    setFormApiUrl("");
    setFormClientId("");
    setFormClientSecret("");
    setFormAppSecret("");
    setFormMasterDataPolicy("");
    setFormIsActive(true);
    setSubCrumb("Neuer Verkaufskanal");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      return (await capability("commerce.salesChannel.create")({
        name: formName,
        platform: formPlatform as any,
        apiUrl: formApiUrl,
        credentials:
          formClientId && formClientSecret
            ? {
                clientId: formClientId,
                clientSecret: formClientSecret,
                ...(formAppSecret ? { appSecret: formAppSecret } : {}),
              }
            : null,
        masterDataPolicy: formMasterDataPolicy || null,
      })) as unknown as SalesChannelRecord;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["commerce", "salesChannels"] });
      loadChannel(created);
      toast.success("Verkaufskanal angelegt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Kein Kanal ausgewählt");
      return (await capability("commerce.salesChannel.update")({
        salesChannelId: selectedId,
        patch: {
          name: formName,
          platform: formPlatform as any,
          apiUrl: formApiUrl,
          credentials:
            formClientId && formClientSecret
              ? {
                  clientId: formClientId,
                  clientSecret: formClientSecret,
                  ...(formAppSecret ? { appSecret: formAppSecret } : {}),
                }
              : null,
          masterDataPolicy: formMasterDataPolicy || null,
          isActive: formIsActive,
        },
      })) as unknown as SalesChannelRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commerce", "salesChannels"] });
      toast.success("Verkaufskanal gespeichert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      return capability("commerce.salesChannel.testConnection")({
        apiUrl: formApiUrl,
        credentials: { clientId: formClientId, clientSecret: formClientSecret },
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Verbindung erfolgreich");
      } else {
        toast.error(`Verbindung fehlgeschlagen: ${result.message}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const showPanel = isCreating || selectedId !== null;
  const isPending = createMutation.isPending || updateMutation.isPending;
  const canTest = !!formApiUrl && !!formClientId && !!formClientSecret;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left: Channel list */}
      <div className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-hairline bg-canvas-soft">
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-hairline px-3">
          <span className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
            Verkaufskanäle
          </span>
          <button
            onClick={startCreate}
            className="flex size-5 items-center justify-center rounded text-ink-mute transition-colors hover:bg-canvas-soft hover:text-ink"
            title="Neuer Verkaufskanal"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-3 py-4 text-[12px] text-ink-mute">Laden…</div>
          ) : channels.length === 0 ? (
            <div className="px-3 py-4 text-[12px] text-ink-mute">
              Keine Verkaufskanäle vorhanden.
            </div>
          ) : (
            channels.map((ch) => {
              const isActive = ch.salesChannelId === selectedId;
              return (
                <button
                  key={ch.salesChannelId}
                  onClick={() => loadChannel(ch)}
                  className={cn(
                    "flex h-auto w-full cursor-pointer flex-col items-start px-3 py-2 text-left transition-colors",
                    isActive
                      ? "bg-primary text-primary-fg"
                      : "text-ink-secondary hover:bg-canvas hover:text-ink",
                  )}
                >
                  <span className="w-full truncate text-[13px]">{ch.name}</span>
                  <span
                    className={cn(
                      "font-mono text-[10px]",
                      isActive ? "text-primary-fg/70" : "text-ink-mute",
                    )}
                  >
                    {PLATFORMS.find((p) => p.value === ch.platform)?.label ?? ch.platform}
                    {!ch.isActive && " · inaktiv"}
                  </span>
                </button>
              );
            })
          )}

          {isCreating && (
            <div className="border-l-2 border-primary bg-[color-mix(in_oklab,var(--primary)_8%,var(--canvas))] px-3 py-2 text-[13px] text-ink">
              Neuer Kanal…
            </div>
          )}
        </div>
      </div>

      {/* Right: Edit form */}
      {showPanel ? (
        <div className="min-w-0 flex-1 overflow-y-auto bg-canvas">
          <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-6">
            <section className="flex flex-col gap-4">
              <h2 className="border-b border-hairline pb-2 text-[14px] font-semibold text-ink">
                {isCreating ? "Neuer Verkaufskanal" : "Verkaufskanal bearbeiten"}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Name</Label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Mein Onlineshop"
                    className="h-8 rounded border border-hairline bg-canvas px-2.5 text-[13px] focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Plattform</Label>
                  <Select
                    value={formPlatform}
                    onValueChange={(v) => v && setFormPlatform(v)}
                  >
                    <SelectTrigger className="h-8 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>API URL</Label>
                  <input
                    type="url"
                    value={formApiUrl}
                    onChange={(e) => setFormApiUrl(e.target.value)}
                    placeholder="https://shop.example.com"
                    className="h-8 rounded border border-hairline bg-canvas px-2.5 font-mono text-[13px] focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="border-b border-hairline pb-2 text-[14px] font-semibold text-ink">
                Zugangsdaten
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Client ID</Label>
                  <input
                    type="text"
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    placeholder="SWIA..."
                    className="h-8 rounded border border-hairline bg-canvas px-2.5 font-mono text-[13px] focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Client Secret</Label>
                  <input
                    type="password"
                    value={formClientSecret}
                    onChange={(e) => setFormClientSecret(e.target.value)}
                    placeholder="••••••••"
                    className="h-8 rounded border border-hairline bg-canvas px-2.5 font-mono text-[13px] focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {formPlatform === "shopware6" && (
                <div className="flex flex-col gap-1.5">
                  <Label>Webhook App-Secret</Label>
                  <input
                    type="password"
                    value={formAppSecret}
                    onChange={(e) => setFormAppSecret(e.target.value)}
                    placeholder="••••••••"
                    className="h-8 rounded border border-hairline bg-canvas px-2.5 font-mono text-[13px] focus:border-primary focus:outline-none"
                  />
                  <p className="text-[11px] text-ink-mute">
                    Geheimnis der Shopware-App zur Signatur-Prüfung eingehender Webhooks (Endpunkt:
                    <span className="font-mono"> /api/shopware/webhook</span>).
                  </p>
                </div>
              )}

              <div className="flex items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testMutation.mutate()}
                  disabled={!canTest || testMutation.isPending}
                >
                  {testMutation.isPending ? (
                    <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                  ) : testMutation.isSuccess && testMutation.data?.success ? (
                    <WifiIcon className="mr-1.5 size-3.5 text-green-600" />
                  ) : testMutation.isSuccess && !testMutation.data?.success ? (
                    <WifiOffIcon className="mr-1.5 size-3.5 text-red-500" />
                  ) : (
                    <WifiIcon className="mr-1.5 size-3.5" />
                  )}
                  Verbindung testen
                </Button>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="border-b border-hairline pb-2 text-[14px] font-semibold text-ink">
                Optionen
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Master Data Policy{" "}
                    <span className="text-[10px] text-ink-mute">(optional)</span>
                  </Label>
                  <input
                    type="text"
                    value={formMasterDataPolicy}
                    onChange={(e) => setFormMasterDataPolicy(e.target.value)}
                    placeholder="z.B. b2b, b2c"
                    className="h-8 rounded border border-hairline bg-canvas px-2.5 text-[13px] focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {!isCreating && (
                <div className="flex items-center gap-6">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="size-4 accent-primary"
                    />
                    <span className="text-[13px] text-ink">Aktiv</span>
                  </label>
                </div>
              )}
            </section>

            <div className="flex justify-end">
              <Button
                onClick={() =>
                  isCreating ? createMutation.mutate() : updateMutation.mutate()
                }
                disabled={!formName || !formApiUrl || isPending}
                size="sm"
              >
                <SaveIcon className="mr-1.5 size-3.5" />
                {isCreating ? "Anlegen" : "Speichern"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-canvas text-[13px] text-ink-mute">
          Wählen Sie einen Verkaufskanal oder legen Sie einen neuen an
        </div>
      )}
    </div>
  );
}

function SalesChannelsPage() {
  return <SalesChannelsView />;
}
