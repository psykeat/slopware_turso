import { normalizeMailReviewPayload } from "@repo/db/services/mail-review-contract";
import React, { useCallback, useEffect, useRef } from "react";

import { upsertAiTranscriptEntry, type AiTranscriptEntry } from "../ai-transcript";
import {
  AiAssistantState,
  AiStreamChunk,
  AiStatusEventData,
  AiReviewEventData,
  AiErrorClass,
} from "../ai-types";

export function useAiTaskStream(
  setState: React.Dispatch<React.SetStateAction<AiAssistantState>>,
  isOpen: boolean,
) {
  const eventSourceRef = useRef<EventSource | null>(null);

  const upsertTranscriptEntry = useCallback(
    (entry: AiTranscriptEntry, replace = false) => {
      setState((prev) => {
        if (prev.status !== "loading-task") return prev;
        return { ...prev, transcript: upsertAiTranscriptEntry(prev.transcript, entry, replace) };
      });
    },
    [setState],
  );

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

  const runPlanning = useCallback(
    async (taskScope: string, sourceEntity: string, sourceId: string) => {
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
        if (!sourceEntity || !sourceId) {
          throw new Error("Fehlender Kontext für den AI-Workflow.");
        }

        const sessionRes = await fetch("/api/ai/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ focusType: sourceEntity, focusId: sourceId }),
        });

        if (!sessionRes.ok) {
          const errData = await sessionRes.json().catch(() => ({}));
          throw new Error(errData.error || "Fehler beim Erstellen der KI-Sitzung");
        }

        const { sessionId } = await sessionRes.json();
        const sseUrl = `/api/ai/sessions/${sessionId}/sse`;
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        es.addEventListener("status", (event) => {
          try {
            const data = JSON.parse(event.data) as AiStatusEventData;
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
              if (eventSourceRef.current === es) eventSourceRef.current = null;
            }
          } catch {
            // ignore
          }
        });

        es.addEventListener("chunk", (event) => {
          try {
            const chunk = JSON.parse(event.data) as AiStreamChunk;
            const type = chunk.type || "";
            const id = chunk.toolCallId || chunk.id || `${type}-${Date.now()}`;

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
                detail: chunk.delta || "Agent prüft Hinweise.",
              });
              return;
            }

            if (type === "STEP_FINISHED") {
              upsertTranscriptEntry(
                { id, kind: "reasoning", title: "Denken", detail: chunk.content || "" },
                true,
              );
              return;
            }

            if (type === "TOOL_CALL_START" || type === "TOOL_CALL_ARGS") {
              upsertTranscriptEntry({
                id,
                kind: "tool",
                title: `Tool: ${chunk.toolName || "lookup"}`,
                detail:
                  chunk.args ||
                  chunk.delta ||
                  (type === "TOOL_CALL_START" ? "wird ausgeführt" : ""),
              });
              return;
            }

            if (type === "TOOL_CALL_END") {
              upsertTranscriptEntry(
                {
                  id,
                  kind: "tool",
                  title: `Tool: ${chunk.toolName || "lookup"}`,
                  detail: chunk.result || chunk.output || "abgeschlossen",
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
                  detail: chunk.delta || chunk.content || "",
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
                detail: `Finish reason: ${chunk.finishReason || "stop"}`,
              });
            }
          } catch {
            // ignore
          }
        });

        es.addEventListener("review", (event) => {
          try {
            const data = JSON.parse(event.data) as AiReviewEventData;
            const normalizedPayload = normalizeMailReviewPayload(data.payload);
            setState({
              status: "review",
              taskScope,
              reviewId: data.reviewId,
              payload: normalizedPayload,
              validation: data.validation ?? {},
            });
            es.close();
            if (eventSourceRef.current === es) eventSourceRef.current = null;
          } catch (err: any) {
            setState({
              status: "error",
              errorClass: "SCHEMA_VALIDATION_FAILED",
              message: err.message || "Fehler beim Laden des Entwurfs",
            });
          }
        });

        es.addEventListener("error", (event: any) => {
          let errorData = {
            errorClass: "AI_UNAVAILABLE" as AiErrorClass,
            message: "Analyse fehlgeschlagen",
          };
          try {
            errorData = JSON.parse(event.data);
          } catch {
            // ignore
          }

          setState({
            status: "error",
            errorClass: errorData.errorClass || "AI_UNAVAILABLE",
            message: errorData.message || "Fehler während der Analyse",
          });

          es.close();
          if (eventSourceRef.current === es) eventSourceRef.current = null;
        });
      } catch (err: any) {
        setState({
          status: "error",
          errorClass: err.errorClass || "AI_UNAVAILABLE",
          message: err.message || "Analyse fehlgeschlagen",
        });
      }
    },
    [setState, upsertTranscriptEntry],
  );

  return { runPlanning };
}
