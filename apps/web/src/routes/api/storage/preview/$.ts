import { readFile } from "fs/promises";
import { homedir } from "node:os";
import { join, normalize } from "path";

import { createFileRoute } from "@tanstack/react-router";

function storageRoot() {
  return process.env.STORAGE_PATH || join(homedir(), "slopware/storage");
}

export const Route = createFileRoute("/api/storage/preview/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const storageKey = url.searchParams.get("key");
          if (!storageKey) return new Response("Missing key", { status: 400 });

          const relative = normalize(storageKey.replace(/^storage\//, ""));
          if (relative.startsWith("..") || relative.startsWith("/"))
            return new Response("Invalid key", { status: 400 });

          const path = join(storageRoot(), relative);
          const buffer = await readFile(path);

          // Determine content type from extension or default to octet-stream
          const ext = path.split(".").pop()?.toLowerCase();
          const contentType =
            ext === "png"
              ? "image/png"
              : ext === "jpg" || ext === "jpeg"
                ? "image/jpeg"
                : ext === "gif"
                  ? "image/gif"
                  : ext === "webp"
                    ? "image/webp"
                    : "application/octet-stream";

          return new Response(buffer, {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000",
            },
          });
        } catch (err) {
          return new Response("Not Found", { status: 404 });
        }
      },
    },
  },
});
