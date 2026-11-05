import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src");
const files = [];
function walkDir(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "test" || ent.name === "ui" || ent.name === "node_modules") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkDir(full);
    else if (full.endsWith(".tsx")) files.push(full);
  }
}
walkDir(root);
const attrNames = new Set(["placeholder", "aria-label", "title", "alt", "label", "emptyMessage", "searchPlaceholder"]);
const findings = [];
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxText(node)) {
      const value = node.getText(ast).replace(/\s+/g, " ").trim();
      if (value.length > 2 && /[\p{L}]/u.test(value)) {
        findings.push({ file: path.relative(root, file), line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, kind: "jsxText", value });
      }
    } else if (ts.isJsxAttribute(node) && attrNames.has(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const value = node.initializer.text.trim();
      if (value.length > 2 && /[\p{L}]/u.test(value)) {
        findings.push({ file: path.relative(root, file), line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, kind: String(node.name.text), value });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
const summary = {};
for (const x of findings) summary[x.kind] = (summary[x.kind] || 0) + 1;
console.log(JSON.stringify({ scanned: files.length, total: findings.length, summary, findings }, null, 2));
