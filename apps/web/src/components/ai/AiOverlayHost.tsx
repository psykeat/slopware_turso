import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@repo/ui/components/sheet";
import { useAiOverlay } from "@repo/ui/platform/ai-overlay";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ChevronRightIcon,
  RefreshCcwIcon,
  SparklesIcon,
  TagIcon,
  FileTextIcon,
  CheckCircle2Icon,
} from "lucide-react";
import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { aiCapabilityRegistry } from "#/lib/ai/ai-capability-registry";

type AiErrorClass =
  | "AI_UNAVAILABLE"
  | "TASK_NOT_SUPPORTED_IN_CONTEXT"
  | "CONTEXT_NOT_RESOLVABLE"
  | "MODEL_TIMEOUT"
  | "SCHEMA_VALIDATION_FAILED"
  | "APPLY_VALIDATION_FAILED"
  | "STALE_CONTEXT"
  | "UNAUTHORIZED";

type AiAssistantState =
  | { status: "idle" }
  | { status: "resolving-context" }
  | {
      status: "task-selection";
      supportedTasks: Array<{
        taskScope: string;
        label: string | { en: string; de: string };
        icon: string;
      }>;
    }
  | { status: "loading-task"; taskScope: string }
  | { status: "review"; taskScope: string; reviewId: string; payload: any; validation: any }
  | { status: "applying" }
  | { status: "success"; resultingEntity?: string; resultingId?: string }
  | { status: "error"; errorClass: AiErrorClass; message: string };

export function AiOverlayHost() {
  const { isOpen, setIsOpen, closeAiOverlay, options } = useAiOverlay();
  const { state: focusState, setFocus } = useFocus();
  const { registerCommand } = useCommands();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation("ui");
  const isDe = i18n.language?.startsWith("de");

  const [state, setState] = useState<AiAssistantState>({ status: "idle" });
  const [allAddresses, setAllAddresses] = useState<any[]>([]);
  const [allDocuments, setAllDocuments] = useState<any[]>([]);

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

  // Load all addresses for reviews
  useEffect(() => {
    if (isOpen) {
      fetch("/api/data/address")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setAllAddresses(data))
        .catch(() => setAllAddresses([]));

      fetch("/api/data/document?limit=100&orderBy=documentNo:asc")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setAllDocuments(Array.isArray(data) ? data : (data?.data ?? [])))
        .catch(() => setAllDocuments([]));
    }
  }, [isOpen]);

  const extractOverrides = useCallback(
    (payload: any) => ({
      bundleId: payload?.selectedBundleId || undefined,
      selectedAddressId: payload?.selectedAddressId || undefined,
      selectedDocumentId: payload?.selectedDocumentId || undefined,
      extraReplyInstruction: payload?.extraReplyInstruction || undefined,
    }),
    [],
  );

  const validateReview = useCallback(
    async (reviewId: string, payload: any) => {
      const res = await fetch(`/api/ai/reviews/${reviewId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: extractOverrides(payload),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Validierung fehlgeschlagen");
      }

      return res.json();
    },
    [extractOverrides],
  );

  // 2. Launch Planning
  const runPlanning = useCallback(
    async (taskScope: string, sourceEntity: string, sourceId: string) => {
      setState({ status: "loading-task", taskScope });
      try {
        if (sourceEntity !== "emailThread" || !sourceId) {
          throw new Error("Der AI-Workflow unterstützt in diesem Kontext nur E-Mail-Threads.");
        }

        const interpretRes = await fetch("/api/ai/tasks/mail/interpret-thread", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: sourceId,
            customInstructions: "Fokus auf Kundenzuordnung und Referenzbeleg-Auflösung.",
          }),
        });

        if (!interpretRes.ok) {
          const errData = await interpretRes.json().catch(() => ({}));
          throw new Error(errData.error || "Fehler bei der Interpretation");
        }

        const interpretation = await interpretRes.json();

        const resolveRes = await fetch("/api/ai/tasks/mail/resolve-thread", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interpretationId: interpretation.interpretationId,
          }),
        });

        if (!resolveRes.ok) {
          const errData = await resolveRes.json().catch(() => ({}));
          throw new Error(errData.error || "Fehler bei der Auflösung");
        }

        const resolution = await resolveRes.json();

        const reviewRes = await fetch("/api/ai/tasks/mail/build-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interpretationId: interpretation.interpretationId,
            resolution: resolution.resolution,
          }),
        });

        if (!reviewRes.ok) {
          const errData = await reviewRes.json().catch(() => ({}));
          throw new Error(errData.error || "Fehler beim Erzeugen des Reviews");
        }

        const reviewResult = await reviewRes.json();
        const selectedBundle =
          reviewResult.review.bundles?.find(
            (bundle: any) => bundle.bundleId === reviewResult.review.selectedBundleId,
          ) ??
          reviewResult.review.bundles?.[0] ??
          null;
        const payload = {
          ...reviewResult.review,
          selectedBundleId: reviewResult.review.selectedBundleId ?? null,
          selectedAddressId:
            selectedBundle?.resolverSlots?.find((slot: any) => slot.slotKey === "customer")
              ?.resolvedId ?? null,
          selectedDocumentId:
            selectedBundle?.resolverSlots?.find((slot: any) => slot.slotKey === "referenceDocument")
              ?.resolvedId ?? null,
          extraReplyInstruction: "",
        };
        const validation = await validateReview(reviewResult.reviewId, payload);

        setState({
          status: "review",
          taskScope: reviewResult.review.taskScope,
          reviewId: reviewResult.reviewId,
          payload,
          validation,
        });
      } catch (err: any) {
        setState({
          status: "error",
          errorClass: err.errorClass || "AI_UNAVAILABLE",
          message: err.message || "Analyse fehlgeschlagen",
        });
      }
    },
    [validateReview],
  );

  // 3. Resolve Context (Phase 2)
  const resolveFocusContext = useCallback(async () => {
    setState({ status: "resolving-context" });
    try {
      const invocationContext = {
        workspace: focusState.workspace,
        panel: focusState.panel,
        focusArea: focusState.area,
        entityName: focusState.entity,
        recordId: focusState.recordId,
        mode: focusState.mode,
        invocationSource: "hotkey",
      };

      const res = await fetch("/api/ai/context/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invocationContext),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw {
          errorClass: errData.errorClass || "CONTEXT_NOT_RESOLVABLE",
          message: errData.error || "Fokuskontext konnte nicht aufgelöst werden.",
        };
      }

      const capabilitySet = await res.json();
      const { supportedTasks, sourceEntity, sourceId } = capabilitySet;

      if (!supportedTasks || supportedTasks.length === 0) {
        setState({
          status: "error",
          errorClass: "TASK_NOT_SUPPORTED_IN_CONTEXT",
          message: "Keine unterstützten KI-Aktionen in diesem Kontext gefunden.",
        });
        return;
      }

      // Check if a specific scope is requested in options
      if (
        options?.taskScope &&
        supportedTasks.some((t: any) => t.taskScope === options.taskScope)
      ) {
        void runPlanning(options.taskScope, sourceEntity, sourceId);
      } else if (supportedTasks.length === 1) {
        // Trigger directly if only 1 action is possible
        void runPlanning(supportedTasks[0].taskScope, sourceEntity, sourceId);
      } else {
        // Render Selection list
        setState({ status: "task-selection", supportedTasks });
      }
    } catch (err: any) {
      setState({
        status: "error",
        errorClass: err.errorClass || "AI_UNAVAILABLE",
        message: err.message || "Fehler bei der Kontextauflösung",
      });
    }
  }, [focusState, options, runPlanning]);

  // Hook trigger on open
  useEffect(() => {
    let active = true;
    if (isOpen) {
      const run = async () => {
        if (active) {
          await resolveFocusContext();
        }
      };
      void run();
    }
    return () => {
      active = false;
    };
  }, [isOpen, resolveFocusContext]);

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

  const handleApply = async () => {
    if (state.status !== "review") return;
    const { reviewId, payload } = state;
    setState({ status: "applying" });

    try {
      const res = await fetch(`/api/ai/reviews/${reviewId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: extractOverrides(payload),
        }),
      });

      const applyResult = await res.json();
      if (!res.ok || applyResult.success === false) {
        throw new Error(
          applyResult.errorLogs || applyResult.error || "Aktion konnte nicht gebucht werden",
        );
      }

      setState({ status: "success" });
      toast.success("Aktionen erfolgreich gebucht!");
      queryClient.invalidateQueries();
      const nextUiActions = Array.isArray(applyResult?.nextUiActions)
        ? applyResult.nextUiActions
        : [];
      for (const action of nextUiActions) {
        if (action?.type === "open_document" && action.targetId) {
          window.dispatchEvent(
            new CustomEvent("slopware:open-document", { detail: { documentId: action.targetId } }),
          );
        }
        if (action?.type === "open_email_draft" && action.targetId) {
          window.dispatchEvent(
            new CustomEvent("slopware:open-email-draft", { detail: { draftId: action.targetId } }),
          );
        }
        if (action?.type === "show_toast" && action.label) {
          toast.info(action.label);
        }
      }
      setTimeout(() => {
        closeAiOverlay();
      }, 1000);
    } catch (err: any) {
      setState({
        status: "error",
        errorClass: "APPLY_VALIDATION_FAILED",
        message: err.message || "Aktion fehlgeschlagen",
      });
    }
  };

  const handlePatch = (patch: any) => {
    if (state.status !== "review") return;
    const nextPayload = { ...state.payload, ...patch };
    setState((prev: any) => ({
      ...prev,
      payload: nextPayload,
    }));
    void validateReview(state.reviewId, nextPayload)
      .then((validation) => {
        setState((prev: any) => {
          if (prev.status !== "review" || prev.reviewId !== state.reviewId) return prev;
          return { ...prev, validation };
        });
      })
      .catch(() => {
        // Keep the optimistic selection if validation cannot be refreshed immediately.
      });
  };

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
          {/* Resolving context */}
          {state.status === "resolving-context" && (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <RefreshCcwIcon className="size-6 animate-spin text-primary" />
              <span className="text-[13px] text-ink-mute">Fokuskontext wird geprüft...</span>
            </div>
          )}

          {/* Loading task */}
          {state.status === "loading-task" && (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <RefreshCcwIcon className="size-6 animate-spin text-primary" />
              <span className="text-[13px] text-ink-mute">Analyse läuft...</span>
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
                          : task.label?.[isDe ? "de" : "en"] ||
                            task.label?.de ||
                            task.label?.en ||
                            ""}
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
                return taskDef.renderReview({
                  suggestionPayload: state.payload,
                  validation: state.validation,
                  onPatch: handlePatch,
                  allAddresses,
                  allDocuments,
                });
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
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <CheckCircle2Icon className="size-10 text-emerald-500" />
              <span className="text-[14px] font-semibold text-ink">Erfolgreich gebucht!</span>
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
                      void resolveFocusContext();
                    } else {
                      void resolveFocusContext();
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
      </SheetContent>
    </Sheet>
  );
}
