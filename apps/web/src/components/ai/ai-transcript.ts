export type AiTranscriptEntry = {
  id: string;
  kind: "status" | "reasoning" | "tool" | "content";
  title: string;
  detail: string;
};

export function upsertAiTranscriptEntry(
  transcript: AiTranscriptEntry[],
  entry: AiTranscriptEntry,
  replace = false,
): AiTranscriptEntry[] {
  const existingIndex = transcript.findIndex((item) => item.id === entry.id);
  if (existingIndex === -1) {
    return [...transcript, entry];
  }

  const nextTranscript = [...transcript];
  nextTranscript[existingIndex] = replace
    ? entry
    : {
        ...nextTranscript[existingIndex],
        ...entry,
        detail:
          entry.kind === "content" || entry.kind === "reasoning"
            ? `${nextTranscript[existingIndex].detail}${entry.detail}`
            : entry.detail,
      };
  return nextTranscript;
}
