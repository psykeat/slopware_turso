import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENCRYPTION_KEY_HEX =
  process.env.EMAIL_ENCRYPTION_SECRET ?? process.env.ENCRYPTION_SECRET ?? "";
const ENCRYPTION_KEY =
  ENCRYPTION_KEY_HEX.length === 64 ? Buffer.from(ENCRYPTION_KEY_HEX, "hex") : null;

export function encryptEmailCredentials(value: unknown): string {
  const text = JSON.stringify(value);
  if (!ENCRYPTION_KEY) return text;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptEmailCredentials<T = unknown>(encoded: string): T {
  if (!ENCRYPTION_KEY) return JSON.parse(encoded) as T;

  const parts = encoded.split(":");
  if (parts.length !== 3) return JSON.parse(encoded) as T;

  const [ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(cipherHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return JSON.parse(
    Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"),
  ) as T;
}
