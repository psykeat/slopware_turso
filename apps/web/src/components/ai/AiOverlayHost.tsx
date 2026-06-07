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
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { aiCapabilityRegistry } from "#/lib/ai/ai-capability-registry";

import { upsertAiTranscriptEntry, type AiTranscriptEntry } from "./ai-transcript";

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
  | {
      status: "loading-task";
      taskScope: string;
      statusText?: string;
      transcript: Array<{
        id: string;
        kind: "status" | "reasoning" | "tool" | "content";
        title: string;
        detail: string;
      }>;
    }
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
  const [pendingMemories, setPendingMemories] = useState<any[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const upsertTranscriptEntry = useCallback((entry: AiTranscriptEntry, replace = false) => {
    setState((prev) => {
      if (prev.status !== "loading-task") return prev;
      return { ...prev, transcript: upsertAiTranscriptEntry(prev.transcript, entry, replace) };
    });
  }, []);

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

  // Cleanup event source on close or unmount
  useEffect(() => {
    if (!isOpen && eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

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
      // Clean up previous event source if active
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setState({
        status: "loading-task",
        taskScope,
        statusText: "Analyse wird gestartet...",
        transcript: [],
      });

      try {
        if (sourceEntity !== "emailThread" || !sourceId) {
          throw new Error("Der AI-Workflow unterstützt in diesem Kontext nur E-Mail-Threads.");
        }

        // 1. Create session
        const sessionRes = await fetch("/api/ai/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            focusType: sourceEntity,
            focusId: sourceId,
          }),
        });

        if (!sessionRes.ok) {
          const errData = await sessionRes.json().catch(() => ({}));
          throw new Error(errData.error || "Fehler beim Erstellen der KI-Sitzung");
        }

        const { sessionId } = await sessionRes.json();

        // 2. Connect to SSE
        const sseUrl = `/api/ai/sessions/${sessionId}/sse`;
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        es.addEventListener("status", (event) => {
          try {
            const data = JSON.parse(event.data);
            setState((prev) => {
              if (prev.status === "loading-task") {
                let statusText = "Analyse läuft...";
                if (data.status === "resolving-context")
                  statusText = "Fokuskontext wird geprüft...";
                else if (data.status === "interpreting")
                  statusText = "E-Mail wird interpretiert...";
                else if (data.status === "awaiting-user-input")
                  statusText = data.message || "Benutzereingabe erforderlich...";
                else if (data.status === "building-review") statusText = "Entwurf wird erstellt...";
                else if (data.status === "completed") statusText = "Analyse abgeschlossen.";
                return { ...prev, statusText };
              }
              return prev;
            });
            if (data.status === "completed") {
              es.close();
              if (eventSourceRef.current === es) {
                eventSourceRef.current = null;
              }
            }
          } catch {
            // ignore
          }
        });

        es.addEventListener("chunk", (event) => {
          try {
            const chunk = JSON.parse(event.data) as Record<string, unknown>;
            const chunkAny = chunk as any;
            const type = typeof chunkAny.type === "string" ? chunkAny.type : "";
            const id =
              typeof chunkAny.toolCallId === "string"
                ? chunkAny.toolCallId
                : typeof chunkAny.id === "string"
                  ? chunkAny.id
                  : `${type}-${Date.now()}`;

            if (type === "RUN_STARTED") {
              upsertTranscriptEntry({
                id,
                kind: "status",
                title: "Run gestartet",
                detail: "Agentic cycle gestartet.",
              });
              return;
            }

            if (type === "STEP_STARTED") {
              upsertTranscriptEntry({
                id,
                kind: "reasoning",
                title: "Denken",
                detail: typeof chunk.delta === "string" ? chunk.delta : "Agent prüft Hinweise.",
              });
              return;
            }

            if (type === "STEP_FINISHED") {
              upsertTranscriptEntry(
                {
                  id,
                  kind: "reasoning",
                  title: "Denken",
                  detail: typeof chunk.content === "string" ? chunk.content : "",
                },
                true,
              );
              return;
            }

            if (type === "TOOL_CALL_START") {
              upsertTranscriptEntry({
                id,
                kind: "tool",
                title: `Tool: ${typeof chunkAny.toolName === "string" ? chunkAny.toolName : "lookup"}`,
                detail:
                  typeof chunkAny.args === "string"
                    ? chunkAny.args
                    : typeof chunkAny.delta === "string"
                      ? chunkAny.delta
                      : "wird ausgeführt",
              });
              return;
            }

            if (type === "TOOL_CALL_ARGS") {
              upsertTranscriptEntry({
                id,
                kind: "tool",
                title: `Tool: ${typeof chunkAny.toolName === "string" ? chunkAny.toolName : "lookup"}`,
                detail:
                  typeof chunkAny.args === "string"
                    ? chunkAny.args
                    : typeof chunkAny.delta === "string"
                      ? chunkAny.delta
                      : "",
              });
              return;
            }

            if (type === "TOOL_CALL_END") {
              upsertTranscriptEntry(
                {
                  id,
                  kind: "tool",
                  title: `Tool: ${typeof chunkAny.toolName === "string" ? chunkAny.toolName : "lookup"}`,
                  detail:
                    typeof chunkAny.result === "string"
                      ? chunkAny.result
                      : typeof chunkAny.output === "string"
                        ? chunkAny.output
                        : "abgeschlossen",
                },
                true,
              );
              return;
            }

            if (type === "TEXT_MESSAGE_CONTENT" || type === "TEXT_MESSAGE_END") {
              upsertTranscriptEntry(
                {
                  id,
                  kind: "content",
                  title: "Antwort",
                  detail:
                    typeof chunkAny.delta === "string"
                      ? chunkAny.delta
                      : typeof chunkAny.content === "string"
                        ? chunkAny.content
                        : "",
                },
                type === "TEXT_MESSAGE_END",
              );
              return;
            }

            if (type === "RUN_FINISHED") {
              upsertTranscriptEntry({
                id,
                kind: "status",
                title: "Run beendet",
                detail: `Finish reason: ${
                  typeof chunkAny.finishReason === "string" ? chunkAny.finishReason : "stop"
                }`,
              });
            }
          } catch {
            // ignore chunk parsing errors
          }
        });

        es.addEventListener("review", async (event) => {
          try {
            const data = JSON.parse(event.data);
            setState({
              status: "review",
              taskScope,
              reviewId: data.reviewId,
              payload: data.payload,
              validation: data.validation,
            });
            es.close();
            if (eventSourceRef.current === es) {
              eventSourceRef.current = null;
            }
          } catch (err: any) {
            setState({
              status: "error",
              errorClass: "SCHEMA_VALIDATION_FAILED",
              message: err.message || "Fehler beim Laden des Entwurfs",
            });
          }
        });

        es.addEventListener("error", (event: any) => {
          let errorData = { errorClass: "AI_UNAVAILABLE", message: "Analyse fehlgeschlagen" };
          try {
            errorData = JSON.parse(event.data);
          } catch {
            // ignore
          }

          setState({
            status: "error",
            errorClass: (errorData.errorClass as AiErrorClass) || "AI_UNAVAILABLE",
            message: errorData.message || "Fehler während der Analyse",
          });

          es.close();
          if (eventSourceRef.current === es) {
            eventSourceRef.current = null;
          }
        });
      } catch (err: any) {
        setState({
          status: "error",
          errorClass: err.errorClass || "AI_UNAVAILABLE",
          message: err.message || "Analyse fehlgeschlagen",
        });
      }
    },
    [],
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

      const extracted = applyResult.extractedMemories || [];
      if (extracted.length > 0) {
        setPendingMemories(extracted);
      }

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

      if (extracted.length === 0) {
        setTimeout(() => {
          closeAiOverlay();
        }, 1000);
      }
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
