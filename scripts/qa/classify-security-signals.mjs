/** Exact reviewed signal classification. Raw source/value bytes never leave this module. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const limit=1024*1024;
const jwtDigest='a13f9097b1a8f29324dc4bb5954b61f330574674485936aba4e980aa215fd7d5';
const docDigest='a2c62cb92a6c0cd3014b3936b9fc94e00d32871153350db34bea68757c896dfe';
const docContextDigest='f34a120ce02ace0f495d56799e043abe1fff8fac93ea71e0da3b8fab8a3a86cc';
const contexts=new Map([['apps/web/vitest.config.ts','VITE_SUPABASE_PUBLISHABLE_KEY'],['src/integrations/supabase/client.ts','SUPABASE_PUBLISHABLE_KEY']]);
const hash=value=>createHash('sha256').update(value).digest('hex');
function source(root,name,signal,options){
 if(options.mode==='history'){
  if(!/^[a-f0-9]{40}$/i.test(signal.commit))throw new Error('classification-unavailable');
  const git=args=>execFileSync('git',args,{cwd:root,stdio:['ignore','pipe','ignore'],maxBuffer:limit+1,timeout:30000});
  const entry=git(['ls-tree','-z',signal.commit,'--',name]).toString('utf8');
  const match=entry.match(/^100(?:644|755) blob ([a-f0-9]{40})\t/);
  if(!match||entry.slice(entry.indexOf('\t')+1)!==name+'\0')throw new Error('classification-unavailable');
  const size=Number(git(['cat-file','-s',match[1]]).toString('utf8'));
  if(!Number.isSafeInteger(size)||size<0||size>limit)throw new Error('classification-unavailable');
  const bytes=git(['cat-file','blob',match[1]]);if(bytes.length!==size)throw new Error('classification-unavailable');
  return {bytes,blob:match[1]};
 }
 if(options.mode!=='source'||signal.commit!=='')throw new Error('classification-unavailable');
 let file=options.projection??root;
 for(const part of name.split('/')){file=path.join(file,part);const stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw new Error('classification-unavailable');}
 const stat=fs.lstatSync(file);if(!stat.isFile()||stat.size>limit)throw new Error('classification-unavailable');
 const bytes=fs.readFileSync(file);if(bytes.length>limit)throw new Error('classification-unavailable');
 return {bytes,blob:null};
}
export function classifySignal(root,signal,options){
 const unresolved=reason=>({classification:null,reason});
 try{
  const isJwt=signal.category==='jwt'&&contexts.has(signal.path);
  const isDoc=signal.category==='generic-api-key'&&signal.path==='docs/20-seguranca-ci-codigo.md';
  if(!isJwt&&!isDoc)return unresolved('unmatched-signal');
  if(![signal.startLine,signal.endLine,signal.startColumn,signal.endColumn].every(Number.isSafeInteger)||signal.startLine<1||signal.startLine!==signal.endLine||signal.startColumn<1||signal.endColumn<signal.startColumn)return unresolved('invalid-signal-location');
  const {bytes,blob}=source(root,signal.path,signal,options);
  const text=bytes.toString('utf8'),lines=text.split(/\r?\n/),line=lines[signal.startLine-1];
  if(typeof line!=='string')return unresolved('invalid-signal-location');
  const overlaps=(index,length)=>index<signal.endColumn&&index+length>=signal.startColumn;
  let classification,valueSha256,context;
  if(isJwt){
   const candidates=[...line.matchAll(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g)].filter(item=>overlaps(item.index,item[0].length));
   if(candidates.length!==1)return unresolved('ambiguous-signal-candidate');
   const candidate=candidates[0][0];valueSha256=hash(candidate);
   if(valueSha256!==jwtDigest)return unresolved('unmatched-signal');
   const parts=candidate.split('.');
   const decode=part=>{const bytes=Buffer.from(part,'base64url');if(bytes.toString('base64url')!==part)throw new Error('classification-unavailable');return JSON.parse(bytes.toString('utf8'));};
   const header=decode(parts[0]),claims=decode(parts[1]);
   if(Object.keys(header).sort().join(',')!=='alg,typ'||header.alg!=='HS256'||header.typ!=='JWT'||Object.keys(claims).sort().join(',')!=='exp,iat,iss,ref,role'||claims.iss!=='supabase'||claims.role!=='anon'||typeof claims.ref!=='string'||!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||claims.iat<0||claims.exp<=claims.iat)return unresolved('unmatched-signal');
   const constant=contexts.get(signal.path);
   const assignment=new RegExp('\\b'+constant+'\\s*'+(signal.path.startsWith('apps/')?':':'=')+'\\s*["\']([^"\']+)["\']').exec(line);
   if(!assignment||assignment[1]!==candidate)return unresolved('unmatched-signal');
   if(signal.path.startsWith('apps/')? !/\benv\s*:/.test(text)||!/vitest|defineConfig/.test(text) : !/\bcreateClient(?:<[^>\r\n]*>)?\(/.test(text))return unresolved('unmatched-signal');
   classification='public-legacy-anon';context={constant,alg:'HS256',issuer:'supabase',role:'anon',claimKeys:['exp','iat','iss','ref','role'],providerVerified:false,signatureVerified:false};
  }else{
   const candidates=[...line.matchAll(/\bSECRET_KEY\s*=\s*["']?([^\s"';]+)/g)].filter(item=>overlaps(item.index,item[0].length));
   if(candidates.length!==1)return unresolved('ambiguous-signal-candidate');
   valueSha256=hash(candidates[0][1]);if(valueSha256!==docDigest)return unresolved('unmatched-signal');
   const direct=lines.slice(Math.max(0,signal.startLine-4),signal.startLine-1).join('\n');
   if(hash(direct)!==docContextDigest)return unresolved('unmatched-signal');
   let fenced=false,language='';for(let index=0;index<signal.startLine-1;index++){const mark=lines[index].match(/^\s*```([\w-]*)/);if(mark){fenced=!fenced;language=fenced?mark[1]:'';}}
   const nearby=lines.slice(Math.max(0,signal.startLine-15),signal.endLine+8).join('\n');
   if(!fenced||language!=='bash'||!/fals[oa]|fake|fict[ií]ci[oa]|simulad[oa]/i.test(direct)||!/trufflehog/i.test(nearby)||!/\bCI\b|workflow|pipeline/i.test(nearby)||!/falh|fail|bloque|block/i.test(nearby))return unresolved('unmatched-signal');
   classification='fabricated-ci-example';context={assignment:'SECRET_KEY',directContextSha256:docContextDigest,fenceLanguage:'bash',explicitFakeExplanation:true,ciFailureExercise:true,providerVerified:false};
  }
  return {classification,valueSha256,sourceSha256:hash(bytes),blob,commit:signal.commit,context};
 }catch{return unresolved('classification-unavailable');}
}
/** Preserve detector evidence while making reviewed classifications visible. */
export function classifyScannerEvidence(root,stage,options){
 const classified=[],unresolved=[];
 if(stage.count>0&&(stage.signals??[]).length!==stage.count)return {...stage,scannerStatus:stage.status,status:'FAIL',classifiedCount:0,unresolvedCount:stage.count,classified,unresolved:stage.findings.map(finding=>({...finding,classification:null,reason:'missing-signal-location'}))};
 for(const signal of stage.signals??[]){
  const result=stage.exitCode===1?classifySignal(root,signal,options):{classification:null,reason:'scanner-evidence-contradiction'};
  const metadata={category:signal.category,path:signal.path,startLine:signal.startLine,endLine:signal.endLine,startColumn:signal.startColumn,endColumn:signal.endColumn,commit:signal.commit,...result};
  (result.classification?classified:unresolved).push(metadata);
 }
 const covered=classified.length+unresolved.length===stage.count;
 const status=stage.count===0?stage.status:covered&&unresolved.length===0&&classified.length===stage.count&&stage.exitCode===1?'PASS':'FAIL';
 return {...stage,scannerStatus:stage.status,classifiedCount:classified.length,unresolvedCount:covered?unresolved.length:stage.count-classified.length,classified,unresolved,status};
}