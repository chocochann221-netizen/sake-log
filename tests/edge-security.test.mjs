import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edgeModule } from './helpers.mjs';
const { ownedStoragePath } = edgeModule('supabase/functions/_shared/storage-ownership.ts', {}, ['ownedStoragePath']);
function exportsModule(globals={}) {
  return edgeModule('supabase/functions/personal-data-export/index.ts', {
    ownedStoragePath, strToU8: text=>new TextEncoder().encode(text),zipSync:()=>new Uint8Array([1,2,3]),...globals,
  }, ['rows','downloadStorageObject','generateExport','csvCell','createRequest','requireRecentAuthentication','createDownloadUrl']);
}
test('privileged paths reject another owner, traversal, encoding and URL delimiters',()=>{
  for(const path of ['B/photo.jpg','A/../B/photo.jpg','A/%2e%2e/B.jpg','A//photo','/A/photo','A/p?x','A/p#x','A/p\\x','A/./photo']) assert.throws(()=>ownedStoragePath('A',path),/OWNERSHIP/);
  assert.equal(ownedStoragePath('A','A/record/photo.jpg'),'A/record/photo.jpg');
});
test('export refuses a forged other-user photo path before privileged download',async()=>{
  const requests=[];const statuses=[];const m=exportsModule();
  m.rows=async table=>table==='sake_photos'?[{storage_path:'B/secret.jpg'}]:[];
  m.updateRequest=async(id,patch)=>{statuses.push(patch);return {id,...patch};};
  m.getRequest=async()=>({status:'preparing'});
  m.api=async(path,init)=>{requests.push({path,init});return Response.json({});};
  await m.generateExport({id:'req-A',user_id:'A'}, {id:'A'});
  assert.equal(requests.length,0);
  assert.equal(statuses.at(-1).status,'failed');assert.equal(statuses.at(-1).error_code,'STORAGE_OWNERSHIP_INVALID');
});
test('export reads all pages even when the server caps below requested limit',async()=>{
  const offsets=[];const m=exportsModule();
  m.api=async path=>{const q=new URL('http://local'+path).searchParams;assert.equal(q.get('user_id'),'eq.A');const offset=Number(q.get('offset'));offsets.push(offset);return Response.json(offset<3?[{id:offset}]:[]);};
  assert.equal((await m.rows('drinking_records','A','user_id','id,user_id')).length,3);
  assert.deepEqual(offsets,[0,1,2,3]);
});
test('export stops oversized streams before buffering the whole response',async()=>{
  let cancelled=false;const m=exportsModule();
  m.api=async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(8));},cancel(){cancelled=true;}}));
  await assert.rejects(()=>m.downloadStorageObject('sake-photos','A/p','A',4),/EXPORT_TOO_LARGE/);assert.equal(cancelled,true);
});
test('CSV does not execute spreadsheet formulas and keeps original JSON separate',()=>{
  const m=exportsModule();assert.equal(m.csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');assert.equal(m.csvCell('日本酒'),'"日本酒"');
});
test('cancellation racing with export publication cannot resurrect ready and removes ZIP',async()=>{
  const requests=[];const m=exportsModule();
  m.rows=async()=>[];
  m.updateRequest=async(id,patch,statuses)=>{assert.ok(statuses);return patch.status==='ready'?undefined:{id,...patch};};
  m.getRequest=async()=>({status:'preparing'});
  m.api=async(path,init)=>{requests.push({path,method:init?.method});return Response.json({});};
  await m.generateExport({id:'request-A',user_id:'A',reference_code:'WD-test'}, {id:'A'});
  assert.deepEqual(requests.map(x=>x.method),['POST','DELETE']);assert.match(requests[1].path,/A\/request-A\/WD-test.zip/);
});
test('recent authentication uses verified amr, not refreshed iat',()=>{
  const m=exportsModule();const req=claims=>new Request('https://local',{headers:{Authorization:'Bearer x.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.x'}});
  const now=Math.floor(Date.now()/1000);
  assert.throws(()=>m.requireRecentAuthentication(req({iat:now,amr:[{timestamp:now-3600}]})),/RECENT_AUTH_REQUIRED/);
  assert.doesNotThrow(()=>m.requireRecentAuthentication(req({amr:[{timestamp:now}]})));
});
function deletionModule({foreign=false, storageFailure=false}={}) {
  const calls=[];const offsets=[];let deleted=false;
  const admin={
    from(table) {
      return {
        select(column) {
          const chain = {
            eq(key, value) { assert.equal(key, 'user_id'); assert.equal(value, 'A'); return chain; },
            order() { return chain; },
            async range(start) {
              offsets.push([table, start]);
              return {data: start ? [] : table === 'sake_photos' ? [{[column]: foreign ? 'B/private.jpg' : 'A/photo.jpg'}] : table === 'personal_data_export_requests' ? [{[column]: 'A/request/export.zip'}] : []};
            },
          };
          return chain;
        },
        delete() {
          const chain = { eq() { return chain; }, then(resolve) { resolve({error: null}); } };
          return chain;
        },
      };
    },
    storage:{from(bucket){return {async list(prefix,{offset}){calls.push(['list',bucket,prefix]);return {data:bucket==='sake-photos'&&!offset?[{id:'orphan',name:'orphan.jpg'}]:[]};},async remove(paths){calls.push(['remove',bucket,paths]);return {error:storageFailure?new Error('failure'):null};}};}},
    auth:{admin:{async deleteUser(uid){assert.equal(uid,'A');deleted=true;return {error:null};}}},
  };
  const m=edgeModule('supabase/functions/delete-account/index.ts',{ownedStoragePath,createClient:(url,key,opts)=>opts?.global?{auth:{getUser:async()=>({data:{user:{id:'A'}}})}}:admin});
  const run=(body={confirmation:'DELETE_MY_ACCOUNT'},authorization='Bearer test')=>m.handler(new Request('https://local',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify(body)}));
  return {run,calls,offsets,get deleted(){return deleted;}};
}
test('account deletion rejects foreign paths before any destructive request',async()=>{
  const m=deletionModule({foreign:true});assert.equal((await m.run()).status,500);assert.equal(m.calls.length,0);assert.equal(m.deleted,false);
});
test('account deletion removes owned export ZIP and orphan uploads before auth user',async()=>{
  const m=deletionModule();const response=await m.run();assert.equal(response.status,200);assert.equal(m.deleted,true);
  assert.ok(m.calls.some(([action,bucket,paths])=>action==='remove'&&bucket==='personal-data-exports'&&paths.includes('A/request/export.zip')));
  assert.ok(m.calls.some(([action,bucket,paths])=>action==='remove'&&bucket==='sake-photos'&&paths.includes('A/orphan.jpg')));
  assert.ok(m.offsets.some(([table,offset])=>table==='sake_photos'&&offset===1));
});
test('account deletion failure never deletes auth identity; confirmation is required',async()=>{
  const m=deletionModule({storageFailure:true});assert.equal((await m.run()).status,500);assert.equal(m.deleted,false);
  assert.equal((await m.run({confirm_email:'a@example.invalid'})).status,400);
  assert.equal((await m.run({},'')).status,401);
});
function lineModule(userId='A') {
  const writes=[];const requests=[];
  const admin={from(){const chain={select(){return chain;},eq(){return chain;},maybeSingle:async()=>({data:null}),insert:async value=>{writes.push(value);return {error:null};}};return chain;}};
  const m=edgeModule('supabase/functions/line-login/index.ts',{
    createClient:(url,key,options)=>options?.global?{auth:{getUser:async()=>({data:{user:{id:userId}}})}}:admin,
    fetch:async url=>{requests.push(url);return Response.json(url.endsWith('/token')?{access_token:'test-token',id_token:'test-id-token'}:{sub:'private-LINE-identity',name:'test'});},
  },['buildLineAuthorizeUrl','readState']);
  return {m,writes,requests};
}
test('LINE link callback only hands off code; it cannot mutate mapping without session',async()=>{
  const {m,writes,requests}=lineModule();const url=new URL(await m.buildLineAuthorizeUrl('https://sake-log-git.pages.dev/','link','A'));
  const response=await m.handler(new Request('https://local?code=test-code&state='+encodeURIComponent(url.searchParams.get('state'))));
  assert.equal(response.status,302);assert.match(response.headers.get('location'),/#line_link_code=/);assert.equal(requests.length,0);assert.equal(writes.length,0);
});
test('LINE link completion rejects a different authenticated account before token exchange',async()=>{
  const {m,writes,requests}=lineModule('B');const url=new URL(await m.buildLineAuthorizeUrl('https://sake-log-git.pages.dev/','link','A'));
  const response=await m.handler(new Request('https://local',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({action:'complete_link',code:'test-code',state:url.searchParams.get('state')})}));
  assert.equal(response.status,403);assert.equal(requests.length,0);assert.equal(writes.length,0);
});
test('LINE link completion hashes subject and inserts mapping without upsert overwrite',async()=>{
  const {m,writes}=lineModule();const url=new URL(await m.buildLineAuthorizeUrl('https://sake-log-git.pages.dev/','link','A'));
  const response=await m.handler(new Request('https://local',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({action:'complete_link',code:'test-code',state:url.searchParams.get('state')})}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{linked:true});assert.equal(writes.length,1);assert.match(writes[0].line_sub_hash,/^[a-f0-9]{64}$/);assert.equal(writes[0].user_id,'A');assert.ok(!JSON.stringify(writes).includes('private-LINE-identity'));
});
test('LINE tampered state is rejected',async()=>{
  const {m}=lineModule();const url=new URL(await m.buildLineAuthorizeUrl('https://sake-log-git.pages.dev/','link','A'));
  await assert.rejects(()=>m.readState(url.searchParams.get('state')+'tampered'),/signature/);
});
