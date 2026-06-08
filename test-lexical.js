const { JSDOM } = require("jsdom");
const { createEditor } = require("lexical");
const { $generateNodesFromDOM } = require("@lexical/html");

const dom = new JSDOM(`<html><body><p>Test</p></body></html>`);
const editor = createEditor();
editor.update(() => {
  const nodes = $generateNodesFromDOM(editor, dom.window.document);
  console.log(nodes.length);
});
