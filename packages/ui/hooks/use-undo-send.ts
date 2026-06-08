export type EmailData = {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  message?: string;
  attachments?: File[];
  fromEmail?: string;
  scheduleAt?: string;
};
export const deserializeFiles = (files: unknown) => files as any;
export function useUndoSend() {
  return { handleUndoSend: (..._args: any[]) => {} };
}
