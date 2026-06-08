import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback } from "react";
import { toast } from "sonner";

import { AiAssistantState } from "../ai-types";

export function useAiActionApply(
  state: AiAssistantState,
  setState: React.Dispatch<React.SetStateAction<AiAssistantState>>,
  setPendingMemories: React.Dispatch<React.SetStateAction<any[]>>,
  closeAiOverlay: () => void,
) {
  const queryClient = useQueryClient();

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

  const handleApply = useCallback(async () => {
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
  }, [state, setState, extractOverrides, queryClient, setPendingMemories, closeAiOverlay]);

  const handlePatch = useCallback(
    (patch: any) => {
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
    },
    [state, setState, validateReview],
  );

  return { handleApply, handlePatch };
}
