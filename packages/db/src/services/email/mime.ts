import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
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

function storageRoot(): string {
  return process.env.STORAGE_PATH || join(homedir(), "slopware/storage");
}

function uniqueValues(values: string[]) {
  return [...new Set(values)];
}

function storagePathCandidates(storageKey: string) {
  const normalized = normalize(storageKey);
  if (normalized.startsWith("..") || normalized.startsWith("/")) return [];

  const relative = normalize(normalized.replace(/^storage\//, ""));
  if (relative.startsWith("..") || relative.startsWith("/")) return [];

  return uniqueValues([
    join(storageRoot(), relative),
    join(process.cwd(), "storage", relative),
    ...(normalized.startsWith("storage/") ? [join(process.cwd(), normalized)] : []),
  ]);
}

export async function loadDraftAttachment(
  attachment: NonNullable<EmailDraftInput["attachments"]>[number],
) {
  if (!attachment.storageKey) return null;
  const path = storagePathCandidates(attachment.storageKey).find((candidate) =>
    existsSync(candidate),
  );
  if (!path) return null;
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

  const hasHtml = Boolean(draft.bodyHtml);

  // Build the body part
  let bodyPart = "";
  if (hasHtml) {
    const altBoundary = `slopware-alt-${randomUUID()}`;
    const altHeaders = [`Content-Type: multipart/alternative; boundary="${altBoundary}"`];

    const plainPart = [
      `--${altBoundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      "Content-Transfer-Encoding: base64",
      "",
      base64Body(draft.bodyText ?? ""),
    ].join("\r\n");

    const htmlPart = [
      `--${altBoundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      "Content-Transfer-Encoding: base64",
      "",
      base64Body(draft.bodyHtml ?? ""),
    ].join("\r\n");

    bodyPart = `${altHeaders.join("\r\n")}\r\n\r\n${plainPart}\r\n${htmlPart}\r\n--${altBoundary}--`;
  } else {
    const plainHeaders = [
      `Content-Type: text/plain; charset=UTF-8`,
      "Content-Transfer-Encoding: base64",
    ];
    bodyPart = `${plainHeaders.join("\r\n")}\r\n\r\n${base64Body(draft.bodyText ?? "")}`;
  }

  if (!loadedAttachments.length) {
    return `${headers.join("\r\n")}\r\n${bodyPart}`;
  }

  const boundary = `slopware-${randomUUID()}`;
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  const parts = [`--${boundary}\r\n${bodyPart}`];

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
