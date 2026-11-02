import test from 'node:test';
import assert from 'node:assert/strict';
import { isAuthorizedModernPushMachine } from '../../supabase/functions/send-push-notification/pushMachineAuth.ts';

const SECRET='sb_secret_synthetic_machine_key';
const READ=(vars)=>name=>vars[name];
const ADMIN='sb_secret_generic_admin_synthetic';
const CONFIG=JSON.stringify({default:ADMIN,push:SECRET});
const verify=(apikey, vars)=>isAuthorizedModernPushMachine(apikey,READ(vars));
const ON={CONSUBOV_PUSH_MODERN_MACHINE_KEY_ENABLED:'true',SUPABASE_SECRET_KEYS:CONFIG};

test('valid matching secret after explicit opt-in',()=>assert.equal(verify(SECRET,ON),true));
test('injected secret without flag remains disabled',()=>assert.equal(verify(SECRET,{SUPABASE_SECRET_KEYS:CONFIG}),false));
test('explicit false remains disabled',()=>assert.equal(verify(SECRET,{...ON,CONSUBOV_PUSH_MODERN_MACHINE_KEY_ENABLED:'false'}),false));
test('invalid flag remains disabled',()=>assert.equal(verify(SECRET,{...ON,CONSUBOV_PUSH_MODERN_MACHINE_KEY_ENABLED:'enabled'}),false));
test('empty flag remains disabled',()=>assert.equal(verify(SECRET,{...ON,CONSUBOV_PUSH_MODERN_MACHINE_KEY_ENABLED:''}),false));
test('wrong secret denied',()=>assert.equal(verify('sb_secret_wrong',ON),false));
test('secret prefix only denied',()=>assert.equal(verify('sb_secret_',ON),false));
test('publishable key denied',()=>assert.equal(verify('sb_publishable_synthetic',ON),false));
test('legacy JWT denied as modern apikey',()=>assert.equal(verify('eyJabc123',ON),false));
test('missing apikey denied',()=>assert.equal(verify(null,ON),false));
test('empty apikey denied',()=>assert.equal(verify('',ON),false));
test('modern flag without key set denied',()=>assert.equal(verify(SECRET,{CONSUBOV_PUSH_MODERN_MACHINE_KEY_ENABLED:'true'}),false));
test('malformed JSON denied without throwing',()=>assert.equal(verify(SECRET,{...ON,SUPABASE_SECRET_KEYS:'{'}),false));
test('empty JSON denied',()=>assert.equal(verify(SECRET,{...ON,SUPABASE_SECRET_KEYS:''}),false));
test('array config denied',()=>assert.equal(verify(SECRET,{...ON,SUPABASE_SECRET_KEYS:'[]'}),false));
test('null config denied',()=>assert.equal(verify(SECRET,{...ON,SUPABASE_SECRET_KEYS:'null'}),false));
test('missing named push key denied',()=>assert.equal(verify(SECRET,{...ON,SUPABASE_SECRET_KEYS:'{"other":"sb_secret_other"}'}),false));
test('public value in push slot denied',()=>assert.equal(verify('sb_secret_wrong',{...ON,SUPABASE_SECRET_KEYS:'{"push":"sb_publishable_abc"}'}),false));
test('whitespace in configured push denied',()=>assert.equal(verify(SECRET,{...ON,SUPABASE_SECRET_KEYS:JSON.stringify({push:SECRET+' '})}),false));
test('other named secrets do not interfere',()=>assert.equal(verify(SECRET,{...ON,SUPABASE_SECRET_KEYS:JSON.stringify({other:'sb_secret_other',default:ADMIN,push:SECRET})}),true));
test('near-match is rejected',()=>assert.equal(verify(SECRET+'x',ON),false));
test('case change rejected',()=>assert.equal(verify(SECRET.toUpperCase(),ON),false));

test('generic project-wide default key denied for push',()=>assert.equal(verify(ADMIN,ON),false));
test('named push required even if default key equals candidate',()=>assert.equal(verify(SECRET,{...ON,SUPABASE_SECRET_KEYS:JSON.stringify({default:SECRET})}),false));

test('named push alias of default rejected even with opt-in',()=>assert.equal(verify(SECRET,{...ON,SUPABASE_SECRET_KEYS:JSON.stringify({default:SECRET,push:SECRET})}),false));
