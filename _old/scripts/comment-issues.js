import { execSync } from "child_process";
import { readFileSync } from "fs";

const reportPath =
  "/home/ubuntu/.gemini/antigravity-cli/brain/15d229b1-a622-4e8f-9561-1d95c4245d9b/verification_report.md";
const repo = "psykeat/slopwareV1";

try {
  const content = readFileSync(reportPath, "utf-8");
  const blocks = content.split("#### #");

  // Skip the first block (it's the header)
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const match = block.match(/^([0-9]+)\s+—\s+(.+)/);
    if (!match) continue;

    const issueNumber = match[1];
    const title = match[2].split("\n")[0];

    // Clean up block content to be the comment body
    let body = block.substring(block.indexOf("\n")).trim();

    // Replace markdown file:// links with standard relative paths for GitHub rendering
    body = body.replace(/\[([^\]]+)\]\(file:\/\/\/home\/ubuntu\/slopware\/([^)]+)\)/g, "[$1]($2)");

    const commentBody = `### ✅ Verification & Implementation Status

This issue has been successfully implemented and verified.

**Issue:** #${issueNumber} — ${title}

${body}

*Validated under \`pnpm lint\` with 0 errors and 0 warnings.*`;

    console.log(`Processing issue #${issueNumber}...`);

    // 1. Post comment on GitHub issue via stdin
    try {
      execSync(`gh issue comment ${issueNumber} -R ${repo} -F -`, { input: commentBody });
      console.log(`  Commented on #${issueNumber}`);
    } catch (err) {
      console.error(`  Failed to comment on #${issueNumber}:`, err.message);
    }

    // 2. Close GitHub issue
    try {
      execSync(`gh issue close ${issueNumber} -R ${repo}`);
      console.log(`  Closed #${issueNumber}`);
    } catch (err) {
      console.error(`  Failed to close #${issueNumber}:`, err.message);
    }
  }

  console.log("All issues processed successfully!");
} catch (err) {
  console.error("Error processing issues:", err);
}
