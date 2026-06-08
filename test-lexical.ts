import { $generateHtmlFromNodes } from "@lexical/html";
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
global.window = dom.window as any;
global.document = dom.window.document;

const editor = createEditor({
  nodes: [ParagraphNode, TextNode],
  onError: (error) => console.error(error),
});

editor.update(
  () => {
    const root = $getRoot();
    const p = $createParagraphNode();
    p.append($createTextNode("test"));
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
