export type Attachment = {
  id?: string;
  fileName?: string;
  sizeBytes?: number | null;
  body?: string;
  filename?: string;
  mimeType?: string;
};

export type Sender = {
  name: string;
  email: string;
};
