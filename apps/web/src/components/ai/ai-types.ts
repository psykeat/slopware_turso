export type AiErrorClass =
  | "AI_UNAVAILABLE"
  | "TASK_NOT_SUPPORTED_IN_CONTEXT"
  | "CONTEXT_NOT_RESOLVABLE"
  | "MODEL_TIMEOUT"
  | "SCHEMA_VALIDATION_FAILED"
  | "APPLY_VALIDATION_FAILED"
  | "STALE_CONTEXT"
  | "UNAUTHORIZED";

export type AiAssistantState =
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

export interface AiStreamChunk {
  type: string;
  id?: string;
  toolCallId?: string;
  toolName?: string;
  args?: string;
  delta?: string;
  content?: string;
  result?: string;
  output?: string;
  finishReason?: string;
}

export interface AiStatusEventData {
  status:
    | "resolving-context"
    | "interpreting"
    | "awaiting-user-input"
    | "building-review"
    | "completed";
  message?: string;
}

export interface AiReviewEventData {
  reviewId: string;
  payload: any;
  validation?: any;
}
