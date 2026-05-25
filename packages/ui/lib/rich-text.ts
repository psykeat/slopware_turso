export type RichTextNode =
  | { type: "text"; text: string }
  | { type: "break" }
  | {
      type: "element";
      tag: RichTextTag;
      color?: string;
      children: RichTextNode[];
    };

const BLOCK_TAGS = new Set(["p", "div"]);
const ALLOWED_COLORS = /^(#[0-9a-fA-F]{3,8}|rgb(a)?\([^)]*\)|hsl(a)?\([^)]*\)|[a-zA-Z]+)$/;
type RichTextTag = "strong" | "em" | "u" | "span" | "p" | "div";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function normalizeTagName(tagName: string): RichTextTag | null {
  if (tagName === "b") return "strong";
  if (tagName === "i") return "em";
  if (tagName === "strong" || tagName === "em" || tagName === "u" || tagName === "span") {
    return tagName;
  }
  if (tagName === "p" || tagName === "div") return tagName;
  return null;
}

function extractColor(style: string): string | undefined {
  const match = style.match(/color\s*:\s*([^;]+)/i);
  if (!match) return undefined;
  const color = match[1]?.trim();
  if (!color || !ALLOWED_COLORS.test(color)) return undefined;
  return color;
}

function parseOpenTag(rawTag: string): {
  tag: RichTextTag | null;
  color?: string;
  selfClosing: boolean;
} {
  const cleaned = rawTag.replace(/^</, "").replace(/>$/, "").trim();
  const selfClosing = cleaned.endsWith("/");
  const body = selfClosing ? cleaned.slice(0, -1).trim() : cleaned;
  const [tagNameRaw, ...attrParts] = body.split(/\s+/);
  const tagName = normalizeTagName(tagNameRaw?.toLowerCase() ?? "");
  if (!tagName) return { tag: null, selfClosing };

  const attrs = attrParts.join(" ");
  const styleMatch = attrs.match(/style\s*=\s*(["'])(.*?)\1/i);
  const color = tagName === "span" && styleMatch ? extractColor(styleMatch[2] ?? "") : undefined;
  return { tag: tagName, color, selfClosing };
}

export function parseRichTextHtml(input: string | null | undefined): RichTextNode[] {
  if (!input) return [];

  const root: RichTextNode[] = [];
  const stack: Array<{ tag: RichTextTag | null; children: RichTextNode[]; color?: string }> = [
    { tag: null, children: root },
  ];

  const tokens = input.match(/<[^>]+>|[^<]+/g) ?? [];
  for (const token of tokens) {
    if (!token) continue;

    if (token.startsWith("<")) {
      if (/^<\s*br\s*\/?\s*>$/i.test(token)) {
        stack[stack.length - 1]?.children.push({ type: "break" });
        continue;
      }

      if (/^<\s*\/\s*(p|div|strong|b|em|i|u|span)\s*>$/i.test(token)) {
        const tag = token
          .replace(/^<\s*\//, "")
          .replace(/\s*>$/, "")
          .trim()
          .toLowerCase();
        const normalizedTag = normalizeTagName(tag);
        if (!normalizedTag) continue;

        for (let i = stack.length - 1; i > 0; i -= 1) {
          const current = stack[i];
          stack.pop();
          if (current?.tag === normalizedTag) break;
        }
        continue;
      }

      const parsed = parseOpenTag(token);
      if (!parsed.tag) continue;

      const node: RichTextNode = {
        type: "element",
        tag: parsed.tag,
        color: parsed.color,
        children: [],
      };
      stack[stack.length - 1]?.children.push(node);

      if (!parsed.selfClosing) {
        stack.push({
          tag: parsed.tag,
          children: node.children,
          color: parsed.color,
        });
      }
      continue;
    }

    const text = decodeHtmlEntities(token);
    if (text.length === 0) continue;
    stack[stack.length - 1]?.children.push({ type: "text", text });
  }

  return root;
}

function serializeNodes(nodes: RichTextNode[]): string {
  let html = "";

  for (const node of nodes) {
    if (node.type === "text") {
      html += escapeHtml(node.text);
      continue;
    }

    if (node.type === "break") {
      html += "<br />";
      continue;
    }

    const childHtml = serializeNodes(node.children);
    if (node.tag === "span") {
      html += `<span${node.color ? ` style="color: ${escapeHtml(node.color)}"` : ""}>${childHtml}</span>`;
      continue;
    }

    if (node.tag === "strong" || node.tag === "em" || node.tag === "u") {
      html += `<${node.tag}>${childHtml}</${node.tag}>`;
      continue;
    }

    if (node.tag === "p" || node.tag === "div") {
      html += `<${node.tag}>${childHtml}</${node.tag}>`;
      continue;
    }
  }

  return html;
}

export function sanitizeRichTextHtml(input: string | null | undefined): string {
  return serializeNodes(parseRichTextHtml(input));
}

export function richTextToPlainText(input: string | null | undefined): string {
  const nodes = parseRichTextHtml(input);
  const lines: string[] = [];

  const walk = (children: RichTextNode[]) => {
    let currentLine = "";

    for (const node of children) {
      if (node.type === "text") {
        currentLine += node.text;
        continue;
      }

      if (node.type === "break") {
        if (currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = "";
        } else {
          lines.push("");
        }
        continue;
      }

      if (BLOCK_TAGS.has(node.tag)) {
        if (currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = "";
        }
        walk(node.children);
        lines.push("");
        continue;
      }

      walk(node.children);
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  };

  walk(nodes);

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
