const fs = require("fs");
const content = fs.readFileSync(
  "/home/ubuntu/slopware/node_modules/.pnpm/@lexical+html@0.45.0/node_modules/@lexical/html/dist/LexicalHtml.js",
  "utf-8",
);
const match = content.match(/throw new Error\((.*?)\)/g);
console.log(match);
