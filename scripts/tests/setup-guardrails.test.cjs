const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
test("Codespace setup cannot start phase gates or auto-publish evidence",()=>{
 const source=fs.readFileSync(path.join(root,"scripts/codespace-post-create.sh"),"utf8");
 assert.doesNotMatch(source,/nohup|run-phase5-codespace-reporter|git\s+push/);
 assert.match(source,/frozen-lockfile|setup-codespace/);
});
