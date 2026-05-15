import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { systemSettings } from "@repo/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "../admin/llm-config";

export const Route = createFileRoute("/api/feedback/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as {
          snapshot: unknown;
          description: string;
        };

        // 1. Read LLM config from system_settings
        const configRow = await db
          .select()
          .from(systemSettings)
          .where(
            and(
              eq(systemSettings.scope, "global"),
              eq(systemSettings.key, "llm_config"),
            ),
          )
          .limit(1);

        if (!configRow[0]) {
          return new Response(JSON.stringify({ configMissing: true }), {
            headers: { "content-type": "application/json" },
          });
        }

        const storedConfig = configRow[0].value as {
          endpointUrl: string;
          model: string;
          apiKey: string;
          githubToken: string;
          githubRepo: string; // format: "owner/repo"
        };

        // Decrypt secrets before use
        const llmConfig = {
          ...storedConfig,
          apiKey: decrypt(storedConfig.apiKey ?? ""),
          githubToken: decrypt(storedConfig.githubToken ?? ""),
        };

        // 2. Build LLM prompt
        const prompt = `You are an ERP system issue tracker. Based on this context and user report, write a GitHub issue.
Respond with JSON only: {"title": "...", "body": "...", "label": "bug" | "enhancement" | "question"}

System context: ${JSON.stringify(body.snapshot, null, 2)}

User says: ${body.description}`;

        // 3. Call LiteLLM microservice
        let issueData: { title: string; body: string; label: string };
        try {
          const llmRes = await fetch(`${llmConfig.endpointUrl}/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt,
              model: llmConfig.model,
              endpoint_url: llmConfig.endpointUrl,
            }),
          });
          if (!llmRes.ok) throw new Error("LLM call failed");
          const llmBody = (await llmRes.json()) as { content: string };
          issueData = JSON.parse(llmBody.content) as {
            title: string;
            body: string;
            label: string;
          };
        } catch {
          // Fallback: use description directly as issue title
          issueData = {
            title: body.description.slice(0, 80),
            body: `**User Report:**\n${body.description}\n\n**Context:**\n\`\`\`json\n${JSON.stringify(body.snapshot, null, 2)}\n\`\`\``,
            label: "bug",
          };
        }

        // 4. Create GitHub issue
        const [owner, repo] = (llmConfig.githubRepo || "/").split("/");
        const ghRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues`,
          {
            method: "POST",
            headers: {
              Authorization: `token ${llmConfig.githubToken}`,
              "Content-Type": "application/json",
              Accept: "application/vnd.github.v3+json",
            },
            body: JSON.stringify({
              title: issueData.title,
              body: issueData.body,
              labels: [issueData.label],
            }),
          },
        );

        if (!ghRes.ok) {
          const errText = await ghRes.text();
          return new Response(
            JSON.stringify({ error: `GitHub API error: ${errText}` }),
            {
              status: 502,
              headers: { "content-type": "application/json" },
            },
          );
        }

        const ghIssue = (await ghRes.json()) as { html_url: string };
        return new Response(JSON.stringify({ issueUrl: ghIssue.html_url }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
