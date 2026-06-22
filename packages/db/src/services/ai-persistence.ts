import { eq } from "drizzle-orm";

import { db } from "../index";
import { aiTurn, aiToolCall } from "../schema/sqlite.schema";

export async function createAiTurn(params: { sessionId: string; role: string; message: string }) {
  const [row] = await db
    .insert(aiTurn)
    .values({
      sessionId: params.sessionId,
      role: params.role,
      message: params.message,
    })
    .returning();
  return row;
}

export async function createAiToolCall(params: {
  turnId: string;
  toolName: string;
  input: any;
  status: "pending" | "running" | "done" | "error";
}) {
  const [row] = await db
    .insert(aiToolCall)
    .values({
      turnId: params.turnId,
      toolName: params.toolName,
      input: params.input,
      status: params.status,
      createdAt: new Date(),
    })
    .returning();
  return row;
}

export async function updateAiToolCallStatus(params: {
  toolCallId: string;
  status: "pending" | "running" | "done" | "error";
  input?: any;
  output?: any;
}) {
  const updateData: Record<string, unknown> = {
    status: params.status,
    output: params.output ?? null,
  };
  if (params.input !== undefined) {
    updateData.input = params.input;
  }

  const [row] = await db
    .update(aiToolCall)
    .set(updateData)
    .where(eq(aiToolCall.toolCallId, params.toolCallId))
    .returning();
  return row;
}
