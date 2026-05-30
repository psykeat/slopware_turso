import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join, normalize } from "node:path";

import type { EmailAddress, EmailDraftInput } from "./types";

function escapeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeAddress(address: EmailAddress) {
  const email = escapeHeader(address.email);
  const name = address.name ? escapeHeader(address.name) : "";
  return name ? `"${name.replace(/"/g, '\\"')}" <${email}>` : email;
}

function encodeAddressList(addresses?: EmailAddress[]) {
  return (addresses ?? []).map(encodeAddress).join(", ");
}

function base64Body(value: Buffer | string) {
  return Buffer.from(value).toString("base64");
}

function storagePath(storageKey: string) {
  const relative = normalize(storageKey.replace(/^storage\//, ""));
  if (relative.startsWith("..") || relative.startsWith("/")) return null;
  return join(process.cwd(), "storage", relative);
}

export async function loadDraftAttachment(
  attachment: NonNullable<EmailDraftInput["attachments"]>[number],
) {
  if (!attachment.storageKey) return null;
  const path = storagePath(attachment.storageKey);
  if (!path || !existsSync(path)) return null;
  return {
    ...attachment,
    fileName: attachment.fileName || basename(path),
    bytes: await readFile(path),
  };
}

export async function buildMimeMessage(draft: EmailDraftInput) {
  const from = draft.identityId;
  const headers = [
    `From: ${escapeHeader(from)}`,
    `To: ${encodeAddressList(draft.to)}`,
    draft.cc?.length ? `Cc: ${encodeAddressList(draft.cc)}` : null,
    draft.bcc?.length ? `Bcc: ${encodeAddressList(draft.bcc)}` : null,
    `Subject: ${escapeHeader(draft.subject)}`,
    "MIME-Version: 1.0",
  ].filter(Boolean) as string[];

  const loadedAttachments = (
    await Promise.all(
      (draft.attachments ?? []).map((attachment) => loadDraftAttachment(attachment)),
    )
  ).filter(Boolean) as Array<NonNullable<Awaited<ReturnType<typeof loadDraftAttachment>>>>;

  if (!loadedAttachments.length) {
    const hasHtml = Boolean(draft.bodyHtml);
    headers.push(`Content-Type: ${hasHtml ? "text/html" : "text/plain"}; charset=UTF-8`);
    headers.push("Content-Transfer-Encoding: base64");
    return `${headers.join("\r\n")}\r\n\r\n${base64Body(draft.bodyHtml ?? draft.bodyText ?? "")}`;
  }

  const boundary = `slopware-${randomUUID()}`;
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  const bodyPartHeaders = [
    `Content-Type: ${draft.bodyHtml ? "text/html" : "text/plain"}; charset=UTF-8`,
    "Content-Transfer-Encoding: base64",
  ];
  const parts = [
    `--${boundary}\r\n${bodyPartHeaders.join("\r\n")}\r\n\r\n${base64Body(
      draft.bodyHtml ?? draft.bodyText ?? "",
    )}`,
  ];

  for (const attachment of loadedAttachments) {
    const contentType = attachment.contentType ?? "application/octet-stream";
    parts.push(
      [
        `--${boundary}`,
        `Content-Type: ${contentType}; name="${escapeHeader(attachment.fileName)}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: ${attachment.inlineContentId ? "inline" : "attachment"}; filename="${escapeHeader(
          attachment.fileName,
        )}"`,
        attachment.inlineContentId
          ? `Content-ID: <${escapeHeader(attachment.inlineContentId)}>`
          : null,
        "",
        attachment.bytes.toString("base64"),
      ]
        .filter((line) => line !== null)
        .join("\r\n"),
    );
  }

  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}\r\n--${boundary}--`;
}

export function rawMessage(draft: EmailDraftInput, fromEmail: string) {
  return { ...draft, identityId: fromEmail };
}

export function decodeBase64Url(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}
