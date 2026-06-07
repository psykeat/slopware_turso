import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Provider = "openai" | "anthropic" | "openrouter" | "google_ai_studio" | "vertex_ai";
type Scope = "global" | "tenant";

interface LlmConfigState {
  provider: Provider;
  endpointUrl: string;
  model: string;
  apiKey: string;
  vertexCredentials: string;
  githubToken: string;
  githubRepo: string;
  vertexProject: string;
  vertexLocation: string;
  isActive: boolean;
}

interface LlmConfigFormProps {
  scope: Scope;
  title: string;
  description: string;
  companyId?: string | null;
}

const PROVIDER_OPTIONS: Array<{ value: Provider; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "google_ai_studio", label: "Google AI Studio" },
  { value: "vertex_ai", label: "Vertex AI" },
];

const PROVIDER_DEFAULTS: Record<Provider, { model: string; baseUrl: string; apiKeyLabel: string }> =
  {
    openai: {
      model: "gpt-4o-mini",
      baseUrl: "https://api.openai.com/v1",
      apiKeyLabel: "API Key",
    },
    anthropic: {
      model: "claude-sonnet-4-5",
      baseUrl: "https://api.anthropic.com",
      apiKeyLabel: "API Key",
    },
    openrouter: {
      model: "openai/gpt-5",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKeyLabel: "API Key",
    },
    google_ai_studio: {
      model: "gemini-2.5-flash",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKeyLabel: "API Key",
    },
    vertex_ai: {
      model: "gemini-2.5-flash",
      baseUrl: "",
      apiKeyLabel: "API Key",
    },
  };

function normalizeProvider(provider?: string): Provider {
  switch (provider) {
    case "openai":
    case "anthropic":
    case "openrouter":
    case "google_ai_studio":
    case "vertex_ai":
      return provider;
    case "gemini":
      return "google_ai_studio";
    default:
      return "google_ai_studio";
  }
}

function buildInitialState(provider: Provider = "google_ai_studio"): LlmConfigState {
  const defaults = PROVIDER_DEFAULTS[provider];
  return {
    provider,
    endpointUrl: defaults.baseUrl,
    model: defaults.model,
    apiKey: "",
    vertexCredentials: "",
    githubToken: "",
    githubRepo: "",
    vertexProject: "",
    vertexLocation: "",
    isActive: true,
  };
}

export function LlmConfigForm({ scope, title, description, companyId }: LlmConfigFormProps) {
  const [config, setConfig] = useState<LlmConfigState>(() => buildInitialState());
  const [showApiKey, setShowApiKey] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<string>("");
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "error">("idle");

  const isTenantScope = scope === "tenant";
  const modelPlaceholder = useMemo(
    () => PROVIDER_DEFAULTS[config.provider].model,
    [config.provider],
  );

  useEffect(() => {
    let active = true;

    const loadConfig = async () => {
      setLoadStatus("loading");
      setSaveStatus("idle");
      setTestStatus("idle");
      setTestResult("");

      try {
        if (scope === "tenant" && !companyId) {
          if (active) setLoadStatus("idle");
          setConfig(buildInitialState());
          return;
        }

        const params = new URLSearchParams({ scope });
        if (scope === "tenant" && companyId) params.set("companyId", companyId);

        const res = await fetch(`/api/ai/llm-config?${params.toString()}`);
        if (!res.ok || !active) {
          if (active) setLoadStatus("error");
          return;
        }

        const data = (await res.json()) as {
          configured?: boolean;
          provider?: string;
          endpointUrl?: string;
          model?: string;
          apiKey?: string;
          vertexCredentials?: string;
          githubToken?: string;
          githubRepo?: string;
          vertexProject?: string;
          vertexLocation?: string;
          isActive?: boolean;
        };
        if (!active) return;

        if (!data.configured) {
          setConfig(buildInitialState());
          setLoadStatus("idle");
          return;
        }

        const provider = normalizeProvider(data.provider);
        setConfig({
          provider,
          endpointUrl: data.endpointUrl || PROVIDER_DEFAULTS[provider].baseUrl,
          model: data.model || PROVIDER_DEFAULTS[provider].model,
          apiKey: data.apiKey || "",
          vertexCredentials: data.vertexCredentials || "",
          githubToken: data.githubToken || "",
          githubRepo: data.githubRepo || "",
          vertexProject: data.vertexProject || "",
          vertexLocation: data.vertexLocation || "",
          isActive: data.isActive ?? true,
        });
        setLoadStatus("idle");
      } catch {
        if (active) setLoadStatus("error");
      }
    };

    void loadConfig();

    return () => {
      active = false;
    };
  }, [companyId, scope]);

  const updateField =
    <K extends keyof LlmConfigState>(field: K) =>
    (value: LlmConfigState[K]) => {
      setConfig((prev) => ({ ...prev, [field]: value }));
      setSaveStatus("idle");
      setTestStatus("idle");
      setTestResult("");
    };

  const handleProviderChange = (provider: Provider) => {
    setConfig((prev) => {
      const previousDefaults = PROVIDER_DEFAULTS[prev.provider];
      const nextDefaults = PROVIDER_DEFAULTS[provider];
      return {
        ...prev,
        provider,
        endpointUrl:
          !prev.endpointUrl || prev.endpointUrl === previousDefaults.baseUrl
            ? nextDefaults.baseUrl
            : prev.endpointUrl,
        model:
          !prev.model || prev.model === previousDefaults.model ? nextDefaults.model : prev.model,
      };
    });
    setSaveStatus("idle");
    setTestStatus("idle");
    setTestResult("");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      if (isTenantScope && !companyId) {
        setSaveStatus("error");
        return;
      }

      const payload = {
        ...config,
        scope,
        ...(isTenantScope ? { companyId } : {}),
      };

      const res = await fetch("/api/ai/llm-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setSaveStatus(res.ok ? "success" : "error");
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestStatus("idle");
    setTestResult("");
    try {
      if (isTenantScope && !companyId) {
        setTestStatus("error");
        setTestResult("No company selected.");
        return;
      }

      const res = await fetch("/api/ai/llm-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          scope,
          ...(isTenantScope ? { companyId } : {}),
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        content?: string;
        model?: string;
        provider?: string;
        timings?: { totalMs?: number; configLoadMs?: number; llmRequestMs?: number };
        error?: string;
        raw?: string;
      } | null;

      if (res.ok && data?.ok) {
        setTestStatus("success");
        setTestResult(
          [
            `provider: ${data.provider || config.provider}`,
            `model: ${data.model || config.model}`,
            `timing: ${data.timings?.totalMs ?? "?"}ms total / ${data.timings?.llmRequestMs ?? "?"}ms LLM`,
            `content: ${data.content || "OK"}`,
          ].join("\n"),
        );
      } else {
        setTestStatus("error");
        const timingLine = data?.timings?.totalMs
          ? `\n timing: ${data.timings.totalMs}ms total`
          : "";
        setTestResult(`${data?.error || data?.raw || `HTTP ${res.status}`}${timingLine}`);
      }
    } catch (err) {
      setTestStatus("error");
      setTestResult(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-xl p-6">
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="mb-1 text-[15px] font-medium text-ink">{title}</h2>
          <p className="text-[13px] text-ink-mute">{description}</p>
        </div>

        {isTenantScope && !companyId && (
          <div className="rounded-md border border-hairline-input bg-canvas-soft px-3 py-2 text-[12px] text-ink-mute">
            Select a company first.
          </div>
        )}

        {loadStatus === "error" && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
            Failed to load existing configuration.
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="llm-provider"
            className="text-[12px] font-medium tracking-wider text-ink-secondary uppercase"
          >
            Provider
          </label>
          <select
            id="llm-provider"
            value={config.provider}
            onChange={(e) => handleProviderChange(e.target.value as Provider)}
            className="h-9 rounded-md border border-hairline-input bg-canvas-soft px-3 text-[13px] text-ink focus:ring-1 focus:ring-primary focus:outline-none"
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="llm-endpoint-url"
            className="text-[12px] font-medium tracking-wider text-ink-secondary uppercase"
          >
            Base URL
          </label>
          <input
            id="llm-endpoint-url"
            type="text"
            value={config.endpointUrl}
            onChange={(e) => updateField("endpointUrl")(e.target.value)}
            placeholder={PROVIDER_DEFAULTS[config.provider].baseUrl}
            className="h-9 rounded-md border border-hairline-input bg-canvas-soft px-3 text-[13px] text-ink placeholder:text-ink-mute focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="llm-model"
            className="text-[12px] font-medium tracking-wider text-ink-secondary uppercase"
          >
            Model
          </label>
          <input
            id="llm-model"
            type="text"
            value={config.model}
            onChange={(e) => updateField("model")(e.target.value)}
            placeholder={modelPlaceholder}
            className="h-9 rounded-md border border-hairline-input bg-canvas-soft px-3 text-[13px] text-ink placeholder:text-ink-mute focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        {config.provider === "vertex_ai" && (
          <>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="llm-vertex-project"
                className="text-[12px] font-medium tracking-wider text-ink-secondary uppercase"
              >
                Vertex Project
              </label>
              <input
                id="llm-vertex-project"
                type="text"
                value={config.vertexProject}
                onChange={(e) => updateField("vertexProject")(e.target.value)}
                placeholder="my-gcp-project"
                className="h-9 rounded-md border border-hairline-input bg-canvas-soft px-3 text-[13px] text-ink placeholder:text-ink-mute focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="llm-vertex-location"
                className="text-[12px] font-medium tracking-wider text-ink-secondary uppercase"
              >
                Vertex Location
              </label>
              <input
                id="llm-vertex-location"
                type="text"
                value={config.vertexLocation}
                onChange={(e) => updateField("vertexLocation")(e.target.value)}
                placeholder="us-central1"
                className="h-9 rounded-md border border-hairline-input bg-canvas-soft px-3 text-[13px] text-ink placeholder:text-ink-mute focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="llm-vertex-credentials"
                className="text-[12px] font-medium tracking-wider text-ink-secondary uppercase"
              >
                Vertex Credentials
              </label>
              <textarea
                id="llm-vertex-credentials"
                value={config.vertexCredentials}
                onChange={(e) => updateField("vertexCredentials")(e.target.value)}
                placeholder='{"type":"service_account", ...} or /path/to/service-account.json'
                className="min-h-24 rounded-md border border-hairline-input bg-canvas-soft px-3 py-2 text-[13px] text-ink placeholder:text-ink-mute focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <p className="text-[11px] text-ink-mute">
                Optional. Leave empty to use ADC. Vertex AI integration requires a service-account
                JSON or application-default credentials, not a Vertex API key.
              </p>
            </div>
          </>
        )}

        {config.provider !== "vertex_ai" && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="llm-api-key"
              className="text-[12px] font-medium tracking-wider text-ink-secondary uppercase"
            >
              {PROVIDER_DEFAULTS[config.provider].apiKeyLabel}
            </label>
            <div className="relative">
              <input
                id="llm-api-key"
                type={showApiKey ? "text" : "password"}
                value={config.apiKey}
                onChange={(e) => updateField("apiKey")(e.target.value)}
                placeholder={
                  config.provider === "openrouter"
                    ? "sk-or-…"
                    : config.provider === "anthropic"
                      ? "sk-ant-…"
                      : "sk-…"
                }
                className="h-9 w-full rounded-md border border-hairline-input bg-canvas-soft px-3 pr-10 text-[13px] text-ink placeholder:text-ink-mute focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-mute hover:text-ink"
              >
                {showApiKey ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="llm-github-token"
            className="text-[12px] font-medium tracking-wider text-ink-secondary uppercase"
          >
            GitHub Token
          </label>
          <div className="relative">
            <input
              id="llm-github-token"
              type={showGithubToken ? "text" : "password"}
              value={config.githubToken}
              onChange={(e) => updateField("githubToken")(e.target.value)}
              placeholder="ghp_…"
              className="h-9 w-full rounded-md border border-hairline-input bg-canvas-soft px-3 pr-10 text-[13px] text-ink placeholder:text-ink-mute focus:ring-1 focus:ring-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowGithubToken((v) => !v)}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-mute hover:text-ink"
            >
              {showGithubToken ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="llm-github-repo"
            className="text-[12px] font-medium tracking-wider text-ink-secondary uppercase"
          >
            GitHub Repository
          </label>
          <input
            id="llm-github-repo"
            type="text"
            value={config.githubRepo}
            onChange={(e) => updateField("githubRepo")(e.target.value)}
            placeholder="owner/repo"
            className="h-9 rounded-md border border-hairline-input bg-canvas-soft px-3 text-[13px] text-ink placeholder:text-ink-mute focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        {isTenantScope && (
          <div className="flex items-center gap-2 rounded-md border border-hairline-input bg-canvas-soft px-3 py-2">
            <input
              id="llm-is-active"
              type="checkbox"
              checked={config.isActive}
              onChange={(e) => updateField("isActive")(e.target.checked)}
              className="size-4 rounded border-hairline-input"
            />
            <label htmlFor="llm-is-active" className="text-[13px] text-ink">
              Active
            </label>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || (isTenantScope && !companyId)}
            className="h-9 rounded-md px-5 text-[13px] text-primary-fg transition-colors disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {saving ? "Saving…" : "Save Configuration"}
          </button>
          {saveStatus === "success" && (
            <span className="text-[13px] text-emerald-600">Saved successfully.</span>
          )}
          {saveStatus === "error" && (
            <span className="text-[13px] text-destructive">Failed to save.</span>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-hairline-input bg-canvas-soft p-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={testing || (isTenantScope && !companyId)}
              className="h-9 rounded-md px-4 text-[13px] text-primary-fg transition-colors disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {testing ? "Testing…" : "Test Configuration"}
            </button>
            {testStatus === "success" && (
              <span className="text-[13px] text-emerald-600">Test passed.</span>
            )}
            {testStatus === "error" && (
              <span className="text-[13px] text-destructive">Test failed.</span>
            )}
          </div>
          {testResult ? (
            <pre className="overflow-auto rounded border border-hairline-input bg-white p-2 text-[12px] whitespace-pre-wrap text-ink-mute">
              {testResult}
            </pre>
          ) : (
            <p className="text-[11px] text-ink-mute">
              Sends a direct ping through the saved provider adapter and returns the structured
              result or error.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
