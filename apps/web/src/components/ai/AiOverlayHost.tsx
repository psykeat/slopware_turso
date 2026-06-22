import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@repo/ui/components/sheet";
import { resolveLocalizedText } from "@repo/ui/lib/localized-text";
import { useAiOverlay } from "@repo/ui/platform/ai-overlay";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useFocus } from "@repo/ui/platform/focus-manager";
import {
  AlertCircleIcon,
  ChevronRightIcon,
  RefreshCcwIcon,
  SparklesIcon,
  TagIcon,
  FileTextIcon,
  CheckCircle2Icon,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { aiCapabilityRegistry } from "#/lib/ai/ai-capability-registry";

import { AiAssistantState, AiErrorClass } from "./ai-types";
import { useAiActionApply } from "./hooks/useAiActionApply";
import { useAiContextResolution } from "./hooks/useAiContextResolution";
import { useAiTaskStream } from "./hooks/useAiTaskStream";
import { MailComposeDraftPanel } from "./MailComposeDraftPanel";

class ReviewRenderBoundary extends React.Component<
  {
    taskScope: string;
    onReset: () => void;
    children: React.ReactNode;
  },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("AI review renderer crashed", {
      taskScope: this.props.taskScope,
      error,
      info,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4 text-[12px] text-red-800">
          <div className="font-semibold">KI-Review konnte nicht gerendert werden</div>
          <div>
            Der Entwurf enthält unvollständige oder ungültige Daten. Sie können den AI-Flow
            schließen und neu starten.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
            >
              Erneut versuchen
            </button>
            <button
              type="button"
              onClick={this.props.onReset}
              className="rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
            >
              Overlay schließen
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function AiOverlayHost() {
  const { isOpen, setIsOpen, closeAiOverlay, options } = useAiOverlay();
  const { state: focusState, setFocus } = useFocus();
  const { registerCommand } = useCommands();
  const { i18n } = useTranslation("ui");

  const [state, setState] = useState<AiAssistantState>({ status: "idle" });
  const [pendingMemories, setPendingMemories] = useState<any[]>([]);

  const { runPlanning } = useAiTaskStream(setState, isOpen);
  const { resolveFocusContext } = useAiContextResolution(setState, runPlanning);
  const { handleApply, handlePatch } = useAiActionApply(
    state,
    setState,
    setPendingMemories,
    closeAiOverlay,
  );

  // 1. Hierarchic escape / overlay focus registration in command-registry
  useEffect(() => {
    if (!isOpen) return;

    // Transition area focus to ai-assistant
    setFocus({ area: "ai-assistant" });

    const unregEsc = registerCommand({
      id: "ai-assistant-esc",
      scope: "local",
      group: "ai",
      label: { en: "Close AI Overlay", de: "KI-Overlay schließen" },
      shortcut: "Escape",
      isEnabled: () => isOpen,
      handler: () => {
        closeAiOverlay();
      },
    });

    return () => {
      unregEsc();
      // Restore workspace area on close
      setFocus({ area: "workspace" });
    };
  }, [isOpen, closeAiOverlay, registerCommand, setFocus]);

  // Hook trigger on open — skip context resolution for compose-draft scope
  useEffect(() => {
    let active = true;
    if (isOpen && !options?.composeDraftContext) {
      const run = async () => {
        if (active) {
          await resolveFocusContext(focusState, options);
        }
      };
      void run();
    }
    return () => {
      active = false;
    };
  }, [isOpen, resolveFocusContext, focusState, options]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      if (state.status !== "idle") {
        setTimeout(() => {
          setState({ status: "idle" });
        }, 0);
      }
    }
  }, [isOpen, state.status]);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Tag":
        return <TagIcon className="size-4.5" />;
      case "FileText":
        return <FileTextIcon className="size-4.5" />;
      default:
        return <SparklesIcon className="size-4.5" />;
    }
  };

  const getErrorTitle = (errClass: AiErrorClass) => {
    switch (errClass) {
      case "AI_UNAVAILABLE":
        return "KI-Dienst nicht verfügbar";
      case "TASK_NOT_SUPPORTED_IN_CONTEXT":
        return "Keine Aktionen unterstützt";
      case "CONTEXT_NOT_RESOLVABLE":
        return "Kontext nicht auflösbar";
      case "MODEL_TIMEOUT":
        return "Timeout bei KI-Anfrage";
      case "SCHEMA_VALIDATION_FAILED":
        return "Fehler bei Datenanalyse";
      case "APPLY_VALIDATION_FAILED":
        return "Buchung fehlgeschlagen";
      case "STALE_CONTEXT":
        return "Daten veraltet (Stale Context)";
      default:
        return "Fehler aufgetreten";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="flex h-full w-full flex-col overflow-hidden border-l border-hairline bg-canvas p-6 sm:max-w-md md:max-w-lg">
        <SheetHeader className="mb-4 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <SparklesIcon className="size-4.5 text-primary" />
            <span>KI-Assistent / AI Assistant</span>
          </SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Compose-draft scope — direct panel, no SSE pipeline */}
          {options?.composeDraftContext && (
            <MailComposeDraftPanel
              to={options.composeDraftContext.to}
              subject={options.composeDraftContext.subject}
              context={options.composeDraftContext.context}
              onClose={closeAiOverlay}
            />
          )}

          {/* Resolving context */}
          {!options?.composeDraftContext && state.status === "resolving-context" && (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <RefreshCcwIcon className="size-6 animate-spin text-primary" />
              <span className="text-[13px] text-ink-mute">Fokuskontext wird geprüft...</span>
            </div>
          )}

          {/* Loading task */}
          {state.status === "loading-task" && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 rounded-md border border-hairline bg-canvas-soft px-4 py-3">
                <RefreshCcwIcon className="size-6 animate-spin text-primary" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-ink">
                    {state.statusText || "Analyse läuft..."}
                  </div>
                  <div className="text-[11px] text-ink-mute">
                    Der Agent iteriert über sichere Lese-Tools und baut danach die Review auf.
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-hairline bg-canvas p-3">
                <div className="text-[11px] font-semibold tracking-wider text-ink-mute uppercase">
                  Live-Transkript
                </div>
                <div className="max-h-[22rem] space-y-2 overflow-y-auto">
                  {state.transcript.length === 0 ? (
                    <div className="rounded-sm border border-dashed border-hairline bg-canvas-soft px-3 py-2 text-[12px] text-ink-mute">
                      Warten auf erste Agentenschritte...
                    </div>
                  ) : (
                    state.transcript.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-sm border border-hairline bg-canvas-soft px-3 py-2"
                      >
                        <div className="text-[10px] font-bold tracking-wider text-ink-mute uppercase">
                          {entry.title}
                        </div>
                        <div className="mt-1 text-[12px] leading-relaxed whitespace-pre-wrap text-ink">
                          {entry.detail || " "}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Task selection */}
          {state.status === "task-selection" && (
            <div className="space-y-4 py-2">
              <div className="mb-2 text-[12px] text-ink-secondary">
                Wählen Sie eine der unterstützten KI-Aktionen für diesen Bereich aus:
              </div>
              <div className="divide-y divide-hairline rounded-md border border-hairline bg-canvas">
                {state.supportedTasks.map((task) => (
                  <button
                    key={task.taskScope}
                    onClick={() => {
                      if (focusState.recordId) {
                        void runPlanning(task.taskScope, "emailThread", focusState.recordId);
                      }
                    }}
                    className="group flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-canvas-soft"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-primary">{getIcon(task.icon)}</span>
                      <span className="text-[13px] font-medium text-ink">
                        {typeof task.label === "string"
                          ? task.label
                          : resolveLocalizedText(task.label, i18n.language)}
                      </span>
                    </div>
                    <ChevronRightIcon className="size-4 text-ink-mute transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Review status */}
          {state.status === "review" && (
            <div className="space-y-4">
              {(() => {
                const taskDef = aiCapabilityRegistry.get(state.taskScope);
                if (!taskDef) {
                  return (
                    <div className="text-[13px] text-ink-mute">Review Renderer nicht gefunden.</div>
                  );
                }
                return (
                  <ReviewRenderBoundary
                    key={`${state.reviewId || state.taskScope}`}
                    taskScope={state.taskScope}
                    onReset={closeAiOverlay}
                  >
                    {taskDef.renderReview({
                      suggestionPayload: state.payload,
                      validation: state.validation,
                      onPatch: handlePatch,
                    })}
                  </ReviewRenderBoundary>
                );
              })()}
            </div>
          )}

          {/* Applying actions */}
          {state.status === "applying" && (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <RefreshCcwIcon className="size-6 animate-spin text-primary" />
              <span className="text-[13px] text-ink-mute">
                Aktionen werden transaktional gebucht...
              </span>
            </div>
          )}

          {/* Success actions */}
          {state.status === "success" && (
            <div className="flex animate-in flex-col gap-6 py-4 duration-300 fade-in">
              <div className="flex flex-col items-center justify-center gap-3">
                <CheckCircle2Icon className="size-10 text-emerald-500" />
                <span className="text-[14px] font-semibold text-ink">Erfolgreich gebucht!</span>
              </div>

              {pendingMemories.length > 0 && (
                <div className="space-y-4 rounded-lg border border-hairline bg-canvas p-4">
                  <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                    <span>💡</span>
                    <span>KI-Gedächtnis: Erkenntnisse bestätigen</span>
                  </div>
                  <div className="text-[11px] leading-relaxed text-ink-mute">
                    Die KI hat diese Notizen aus dem Vorgang extrahiert. Möchten Sie sie für
                    zukünftige Interaktionen speichern?
                  </div>
                  <div className="space-y-2">
                    {pendingMemories.map((mem) => (
                      <div
                        key={mem.memoryId}
                        className="flex items-start justify-between gap-3 rounded border border-hairline bg-canvas-soft p-3 text-[12px]"
                      >
                        <div className="space-y-1">
                          <div className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary uppercase">
                            {mem.kind}
                          </div>
                          <div className="leading-relaxed font-medium text-ink">{mem.text}</div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/ai/memories/${mem.memoryId}/confirm`, {
                                method: "POST",
                              });
                              setPendingMemories((prev) =>
                                prev.filter((m) => m.memoryId !== mem.memoryId),
                              );
                              toast.success("Erkenntnis gespeichert!");
                            }}
                            className="cursor-pointer rounded bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-500/20"
                          >
                            Ja
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/ai/memories/${mem.memoryId}/reject`, {
                                method: "POST",
                              });
                              setPendingMemories((prev) =>
                                prev.filter((m) => m.memoryId !== mem.memoryId),
                              );
                              toast.info("Erkenntnis verworfen");
                            }}
                            className="cursor-pointer rounded bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20"
                          >
                            Nein
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Standardized error boxes */}
          {state.status === "error" && (
            <div className="rounded-md border border-destructive/20 bg-[color-mix(in_oklab,var(--destructive)_8%,transparent)] p-4 text-[13px]">
              <div className="flex items-center gap-2 font-semibold text-ink">
                <AlertCircleIcon className="size-4 text-destructive" />
                <span>{getErrorTitle(state.errorClass)}</span>
              </div>
              <div className="mt-2 leading-relaxed text-ink-secondary">{state.message}</div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    if (state.errorClass === "APPLY_VALIDATION_FAILED" && focusState.recordId) {
                      setState({ status: "idle" });
                      void resolveFocusContext(focusState, options);
                    } else {
                      void resolveFocusContext(focusState, options);
                    }
                  }}
                  className="rounded-sm bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-fg hover:opacity-90"
                >
                  Erneut versuchen
                </button>
                <button
                  onClick={closeAiOverlay}
                  className="rounded-sm border border-hairline bg-canvas px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-canvas-soft"
                >
                  Schließen
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action footer */}
        {state.status === "review" && (
          <div className="flex shrink-0 gap-2 border-t border-hairline pt-4">
            <button
              onClick={handleApply}
              disabled={state.validation?.validationStatus === "blocked"}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-sm bg-primary text-[12px] font-medium text-primary-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SparklesIcon className="size-4" />
              <span>Aktionen buchen</span>
            </button>
            <button
              onClick={closeAiOverlay}
              className="h-9 rounded-sm border border-hairline px-3 text-[12px] text-ink-secondary hover:bg-canvas-soft"
            >
              Abbrechen
            </button>
          </div>
        )}

        {state.status === "success" && pendingMemories.length > 0 && (
          <div className="flex shrink-0 gap-2 border-t border-hairline pt-4">
            <button
              onClick={closeAiOverlay}
              className="h-9 flex-1 rounded-sm bg-primary text-[12px] font-medium text-primary-fg hover:opacity-90"
            >
              Fertig / Schließen
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
