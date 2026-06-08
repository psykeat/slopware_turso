import { $generateHtmlFromNodes } from "@lexical/html";
import { LinkNode, $createLinkNode } from "@lexical/link";
// @ts-expect-error
// eslint-disable-next-line
import { JSDOM } from "jsdom";
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  ParagraphNode,
  TextNode,
} from "lexical";

const dom = new JSDOM();
// @ts-expect-error
// eslint-disable-next-line
global.window = dom.window as any;
// @ts-expect-error
// eslint-disable-next-line
global.document = dom.window.document;

const editor = createEditor({
  nodes: [ParagraphNode, TextNode, LinkNode],
});

editor.update(
  () => {
    const root = $getRoot();
    const p = $createParagraphNode();
    const link = $createLinkNode("https://example.com");
    link.append($createTextNode("test"));
    p.append(link);
    root.append(p);
  },
  { discrete: true },
);

editor.getEditorState().read(() => {
  try {
    const html = $generateHtmlFromNodes(editor, null);
    console.log("HTML:", html);
  } catch (err) {
    console.error("Error generating HTML:", err);
  }
});
