import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM encryption for individual secret strings (e.g. sales-channel
// client secrets). Mirrors the email credential-crypto format
// `iv:authTag:cipher` (all hex) and shares the same key material.
//
// Robustness contract used by callers for zero-downtime rollout:
//   - No key configured  → value is returned unchanged (plaintext fallback).
//   - decryptSecret() on any value that is not a valid `iv:tag:cipher`
//     ciphertext returns it unchanged, so legacy plaintext rows keep working
//     until they are next written (and re-encrypted).
const KEY_HEX = process.env.ENCRYPTION_SECRET ?? process.env.EMAIL_ENCRYPTION_SECRET ?? "";
const KEY = KEY_HEX.length === 64 ? Buffer.from(KEY_HEX, "hex") : null;

export function encryptSecret(plain: string): string {
  if (!KEY) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(encoded: string): string {
  if (!KEY) return encoded;
  const parts = encoded.split(":");
  if (parts.length !== 3) return encoded; // legacy plaintext
  const [ivHex, authTagHex, cipherHex] = parts;
  try {
    const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(cipherHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Not actually ciphertext produced by this key — treat as plaintext.
    return encoded;
  }
}
