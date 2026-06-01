import { LlmConfigForm } from "#/components/llm/LlmConfigForm";

export function LlmConfigView() {
  return (
    <LlmConfigForm
      scope="global"
      title="KI-Konfiguration"
      description="Configure the global LLM service and GitHub integration for the feedback system."
    />
  );
}
