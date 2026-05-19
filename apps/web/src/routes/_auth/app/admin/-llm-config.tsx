import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";

interface LlmConfig {
  endpointUrl: string;
  model: string;
  apiKey: string;
  githubToken: string;
  githubRepo: string;
}

export function LlmConfigView() {
  const [config, setConfig] = useState<LlmConfig>({
    endpointUrl: "",
    model: "openai/gpt-4o-mini",
    apiKey: "",
    githubToken: "",
    githubRepo: "",
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  const handleChange = (field: keyof LlmConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prev) => ({ ...prev, [field]: e.target.value }));
    setSaveStatus("idle");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/admin/llm-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setSaveStatus("success");
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl p-6">
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="mb-1 text-[15px] font-medium text-ink">KI-Konfiguration</h2>
          <p className="text-[13px] text-ink-mute">
            Configure the LLM service and GitHub integration for the feedback system.
          </p>
        </div>

        {/* Endpoint URL */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="llm-endpoint-url"
            className="text-[12px] font-medium tracking-wider text-ink-secondary uppercase"
          >
            Endpoint URL
          </label>
          <input
            id="llm-endpoint-url"
            type="text"
            value={config.endpointUrl}
            onChange={handleChange("endpointUrl")}
            placeholder="http://localhost:8000"
            className="h-9 rounded-md border border-hairline-input bg-canvas-soft px-3 text-[13px] text-ink placeholder:text-ink-mute focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        {/* Model */}
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
            onChange={handleChange("model")}
            placeholder="openai/gpt-4o-mini"
            className="h-9 rounded-md border border-hairline-input bg-canvas-soft px-3 text-[13px] text-ink placeholder:text-ink-mute focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        {/* API Key */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="llm-api-key"
            className="text-[12px] font-medium tracking-wider text-ink-secondary uppercase"
          >
            API Key
          </label>
          <div className="relative">
            <input
              id="llm-api-key"
              type={showApiKey ? "text" : "password"}
              value={config.apiKey}
              onChange={handleChange("apiKey")}
              placeholder="sk-…"
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
          <p className="text-[11px] text-ink-mute">API key stored encrypted in database.</p>
        </div>

        {/* GitHub Token */}
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
              onChange={handleChange("githubToken")}
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
          <p className="text-[11px] text-ink-mute">GitHub PAT stored encrypted in database.</p>
        </div>

        {/* GitHub Repo */}
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
            onChange={handleChange("githubRepo")}
            placeholder="owner/repo"
            className="h-9 rounded-md border border-hairline-input bg-canvas-soft px-3 text-[13px] text-ink placeholder:text-ink-mute focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
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
      </div>
    </div>
  );
}
