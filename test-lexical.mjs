import { $generateHtmlFromNodes } from "@lexical/html";
import { createEditor } from "lexical";

try {
  const editor = createEditor();
  editor.update(() => {
    const html = $generateHtmlFromNodes(editor, null);
    console.log("HTML:", html);
  });
} catch (e) {
  console.error("Error:", e);
}
