import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const SEMVER=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const TYPES="feat fix hotfix security refactor test chore docs".split(" ");
export function cmp(a,b){if(!SEMVER.test(a)||!SEMVER.test(b))throw Error("invalid SemVer");for(let i=0;i<3;i++){const x=BigInt(a.split(".")[i]),y=BigInt(b.split(".")[i]);if(x>y)return 1;if(x<y)return -1;}return 0;}
export function validate(c,tags=[],releaseApp=""){
 const e=[];if(!c||!c.apps||Array.isArray(c.apps)||!Array.isArray(c.sites))return ["invalid catalog"];
 for(const k of Object.keys(c))if(!["apps","sites"].includes(k))e.push("global version not allowed");
 for(const [id,v] of Object.entries(c.apps)){
 if(!/^[a-z][a-z0-9-]*-app$/.test(id))e.push("invalid APP_ID "+id);
 if(v!==null&&!SEMVER.test(String(v)))e.push("invalid app version "+id);
 if(v===null){if(tags.some(t=>t.startsWith(id+"/v")))e.push("unpublished app has release "+id);continue;}
 if(id==="consubov-fazendas-app"&&cmp(v,"2.0.0")<0)e.push("CONSUBOV version regression below 2.0.0");
 const last=tags.filter(t=>t.startsWith(id+"/v")).map(t=>t.slice(id.length+2)).filter(v=>SEMVER.test(v)).sort(cmp).at(-1);
 if(last&&cmp(v,last)<(releaseApp===id?1:0))e.push("release regression "+id);
 if(releaseApp===id&&id==="consubov-fazendas-app"&&cmp(v,"2.0.0")<=0)e.push("release must increment 2.0.0");
 }
 const siteSet=new Set();for(const site of c.sites){if(typeof site!=="string"||!/^[a-z][a-z0-9-]*-site$/.test(site))e.push("sites may not have version");else if(siteSet.has(site))e.push("duplicate site");else siteSet.add(site);}
 return e;
}
export function branchErrors(branch,c,legacy=[]){
 if(branch==="main"||branch.startsWith("dependabot/")||legacy.includes(branch))return [];
 const m=/^([^/]+)\/([^/]+)\/([^/]+)$/.exec(branch);
 if(!m||!TYPES.includes(m[1]))return ["branch naming: tipo/escopo/tarefa-descricao"];
 const e=[];if(!Object.hasOwn(c.apps,m[2])&&!c.sites.includes(m[2])&&!["platform","shared-api"].includes(m[2]))e.push("unknown branch scope");
 if(!/^[a-z][a-z0-9]*-[a-z0-9]*\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m[3]))e.push("missing TASK_ID or description");
 if(m[1]==="hotfix"&&!m[3].startsWith("inc-"))e.push("hotfix requires incident");
 return e;
}
export function run(root=ROOT,branchOverride=""){
 const c=JSON.parse(readFileSync(join(root,"config/application-releases.json"),"utf8"));
 const legacy=JSON.parse(readFileSync(join(root,"scripts/qa/legacy-branches.json"),"utf8"));
 const source=readFileSync(join(root,"apps/web/src/lib/appVersion.ts"),"utf8");
 const git=(...args)=>execFileSync("git",args,{cwd:root,encoding:"utf8"}).trim();
 const branch=branchOverride||process.env.RELEASE_BRANCH_NAME||git("symbolic-ref","--short","HEAD");
 const tags=git("tag","--list").split("\n").filter(Boolean);
 const releaseApp=process.argv.includes("--release-app")?process.argv[process.argv.indexOf("--release-app")+1]:"";
 const errors=[...validate(c,tags,releaseApp),...branchErrors(branch,c,legacy)];
 if(!source.includes('applicationReleases.apps[APP_ID]')||!source.includes('"consubov-fazendas-app"'))errors.push("appVersion.ts not linked to per-app catalog");
 return {errors,branch};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const i=process.argv.indexOf("--branch"),r=run(ROOT,i<0?"":process.argv[i+1]);for(const x of r.errors)console.error("FAIL "+x);if(r.errors.length)process.exitCode=1;else console.log("PASS "+r.branch);}catch(e){console.error("FAIL "+e.message);process.exitCode=1;}
}
