import React, { useCallback } from "react";

import { AiAssistantState } from "../ai-types";

export function useAiContextResolution(
  setState: React.Dispatch<React.SetStateAction<AiAssistantState>>,
  runPlanning: (taskScope: string, sourceEntity: string, sourceId: string) => Promise<void>,
) {
  const resolveFocusContext = useCallback(
    async (focusState: any, options?: any) => {
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

        if (
          options?.taskScope &&
          supportedTasks.some((t: any) => t.taskScope === options.taskScope)
        ) {
          void runPlanning(options.taskScope, sourceEntity, sourceId);
        } else if (supportedTasks.length === 1) {
          void runPlanning(supportedTasks[0].taskScope, sourceEntity, sourceId);
        } else {
          setState({ status: "task-selection", supportedTasks });
        }
      } catch (err: any) {
        setState({
          status: "error",
          errorClass: err.errorClass || "AI_UNAVAILABLE",
          message: err.message || "Fehler bei der Kontextauflösung",
        });
      }
    },
    [setState, runPlanning],
  );

  return { resolveFocusContext };
}
