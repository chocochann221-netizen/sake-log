import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { require } from './helpers.mjs';
const { chromium } = require('playwright');
let browser;
before(async () => { browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] }); });
after(async () => { await browser?.close(); });
async function app(t, handler) {
  const context = await browser.newContext({ viewport: {width: 393, height: 851}, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  t.after(() => context.close());
  await context.route('https://**/*', async route => {
    const url = route.request().url();
    const response = await handler?.(url, route.request());
    await route.fulfill(response || {status:200,contentType:'application/json',body:url.includes('/settings') ? '{"external":{"google":true}}':'[]'});
  });
  const page = await context.newPage();
  await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:8788/');
  await page.waitForFunction(() => !document.getElementById('authView').classList.contains('hidden'));
  return page;
}
const json = (data, status=200) => ({status,contentType:'application/json',body:JSON.stringify(data)});
const signIn = page => page.evaluate(() => saveSession({access_token:'test-A',refresh_token:'refresh-A',user:{id:'A',email:'a@example.invalid'}}));
test('parallel expired requests share one refresh', async t => {
  let refreshes=0;
  const page=await app(t, async(url, req)=>{
    if(url.includes('grant_type=refresh_token')) { refreshes++; await new Promise(r=>setTimeout(r,50)); return json({access_token:'new-A',refresh_token:'new-refresh-A',user:{id:'A'}}); }
    if(url.includes('/rest/v1/test')) return req.headers().authorization==='Bearer new-A'?json([]):json({message:'JWT expired'},401);
  });
  await signIn(page);
  await page.evaluate(()=>Promise.all([authFetch(BASE+'/rest/v1/test'),authFetch(BASE+'/rest/v1/test')]));
  assert.equal(refreshes,1);
});
test('late refresh cannot resurrect a logged-out session', async t=>{
  const page=await app(t,async url=>{if(url.includes('grant_type=refresh_token')) {await new Promise(r=>setTimeout(r,100));return json({access_token:'late-A',user:{id:'A'}});}});
  await signIn(page);
  const result=await page.evaluate(async()=>{const p=refreshSession().catch(()=>{});clearSession();await p;return {user:S.user,token:S.token};});
  assert.deepEqual(result,{user:null,token:null});
});
test('failed recovery preserves the request id for reconciliation',async t=>{
  const page=await app(t,url=>url.includes('/rest/v1/')?json({message:'unavailable'},503):undefined);
  await signIn(page);
  const pending=await page.evaluate(async()=>{writeLocalOperation(PENDING_SAVE_STATE_KEY,{userId:'A',requestId:'pending-1'});await recoverInterruptedOperations();return readLocalOperation(PENDING_SAVE_STATE_KEY);});
  assert.equal(pending?.requestId,'pending-1');
});
test('logout clears private UI, in-memory history, reauthentication copy and previews',async t=>{
  const page=await app(t);await signIn(page);
  const result=await page.evaluate(()=>{S.historyRows=[{comment:'private'}];S.personalDataRequest={id:'private'};document.getElementById('recentList').textContent='private';saveSessionBeforeDataReauth();clearSession();return {rows:S.historyRows,request:S.personalDataRequest,recent:document.getElementById('recentList').textContent,reauth:sessionStorage.getItem('sakelog_data_reauth_session')};});
  assert.deepEqual(result,{rows:[],request:null,recent:'',reauth:null});
});
test('failed record deletion does not report success',async t=>{
  const page=await app(t,url=>url.includes('/rpc/delete_my_drinking_record')?json({message:'unavailable'},503):undefined);await signIn(page);
  const result=await page.evaluate(async()=>{S.detailRecord={id:'record-A'};requestDeleteCurrentRecord();await deleteCurrentRecord();return {dialog:document.getElementById('deleteRecordDialog').open,error:document.getElementById('deleteRecordMsg').textContent,record:S.detailRecord?.id};});
  assert.equal(result.dialog,true);assert.match(result.error,/削除できません/);assert.equal(result.record,'record-A');
});
test('account deletion uses provider-neutral confirmation and blocks double submission',async t=>{
  const bodies=[];
  const page=await app(t,async(url,req)=>{if(url.includes('/functions/v1/delete-account')){bodies.push(req.postDataJSON());await new Promise(r=>setTimeout(r,50));return json({status:'deleted'});}});
  await signIn(page);
  await page.evaluate(async()=>{S.user.email=null;requestDeleteMyAccount();document.getElementById('deleteAccountConfirmation').value='DELETE_MY_ACCOUNT';syncDeleteAccountConfirmation();await Promise.all([deleteMyAccount(),deleteMyAccount()]);});
  assert.deepEqual(bodies,[{confirmation:'DELETE_MY_ACCOUNT'}]);
});
test('signup shows confirmation, cooldown and address correction without another signup',async t=>{
  let signups=0;
  const page=await app(t,url=>{if(url.includes('/signup')){signups++;return json({id:'pending-user'});}});
  await page.locator('#toggleAuth').click();await page.locator('#email').fill('test@example.invalid');await page.locator('#password').fill('example-password');await page.locator('#authBtn').click();
  await page.locator('#emailConfirmationView').waitFor({state:'visible'});
  assert.equal(await page.locator('#resendConfirmationBtn').isDisabled(),true);
  await page.locator('#changeConfirmationEmailBtn').click();assert.equal(await page.locator('#email').inputValue(),'test@example.invalid');assert.equal(signups,1);
});
test('uninitiated LINE callback cannot install an attacker session',async t=>{
  let verifies=0;const page=await app(t,url=>{if(url.includes('/auth/v1/verify'))verifies++;});
  await page.evaluate(async()=>{location.hash='line_token_hash=attacker-token&line_challenge=attacker';await consumeOAuthCallback();});
  assert.equal(verifies,0);assert.equal(await page.evaluate(()=>S.user),null);assert.equal(new URL(page.url()).hash,'');
});
test('expired user verification retries only once and retains credentials during network outage',async t=>{
  let checks=0,refreshes=0;
  const page=await app(t,url=>{if(url.includes('/auth/v1/user')){checks++;return json({},401);}if(url.includes('refresh_token')){refreshes++;return json({access_token:'still-invalid',refresh_token:'test',user:{id:'A'}});}});
  await signIn(page);assert.equal(await page.evaluate(()=>verifyCurrentUser()),false);assert.equal(checks,2);assert.equal(refreshes,1);
});
test('lost record-insert reply retains idempotency key for retry',async t=>{
  const page=await app(t,url=>url.includes('/rest/v1/drinking_records')?json({message:'upstream timeout'},504):undefined);await signIn(page);
  const value=await page.evaluate(async()=>{resetRecord(false);document.getElementById('brand').value='試験酒';await document.getElementById('commitRecordBtn').onclick();return {id:S.currentSaveRequestId,pending:readLocalOperation(PENDING_SAVE_STATE_KEY),message:document.getElementById('recordConfirmMsg').textContent};});
  assert.ok(value.id);assert.equal(value.pending.requestId,value.id);assert.doesNotMatch(value.message,/取り消しました/);
});
test('double save makes one record request and offline save makes none',async t=>{
  let inserts=0;
  const page=await app(t,async(url,req)=>{if(url.includes('/rest/v1/drinking_records')&&req.method()==='POST'){inserts++;await new Promise(r=>setTimeout(r,50));return json([{id:'record-A',brand_name:'試験酒'}]);}});await signIn(page);
  await page.evaluate(async()=>{resetRecord(false);document.getElementById('brand').value='試験酒';await Promise.all([document.getElementById('commitRecordBtn').onclick(),document.getElementById('commitRecordBtn').onclick()]);});
  assert.equal(inserts,1);
  page.on('dialog',dialog=>dialog.dismiss());await page.context().setOffline(true);
  await page.evaluate(async()=>{resetRecord(false);document.getElementById('brand').value='試験酒2';await document.getElementById('commitRecordBtn').onclick();});
  assert.equal(inserts,1);assert.equal(await page.locator('#brand').inputValue(),'試験酒2');
});
test('record update with zero authorized rows cannot report success',async t=>{
  const page=await app(t);await signIn(page);
  const result=await page.evaluate(async()=>{try{await updateRow('drinking_records','other-user-record',{comment:'test'});return 'unexpected success';}catch(e){return e.message;}});
  assert.match(result,/更新対象を確認できません/);
});
test('selected photo previews are released on reset and Android-width text stays in viewport',async t=>{
  const page=await app(t);await signIn(page);
  const state=await page.evaluate(()=>{const revoked=[];const revoke=URL.revokeObjectURL;URL.revokeObjectURL=url=>{revoked.push(url);revoke(url);};previewObjectUrl(new Blob(['photo']), 'front');previewObjectUrl(new Blob(['photo2']),'front');resetRecord(false);return {count:revoked.length,size:previewObjectUrls.size};});
  assert.deepEqual(state,{count:2,size:0});
  for(const width of [320,360,393,412]){
    await page.setViewportSize({width,height:740});
    await page.evaluate(()=>showEmailConfirmation('long-address-'.repeat(20)+'@example.invalid'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
  }
});
test('transient refresh failure retains session for recovery',async t=>{
  const page=await app(t,url=>url.includes('grant_type=refresh_token')?json({},503):url.includes('/rest/')?json({message:'JWT expired'},401):undefined);await signIn(page);
  const result=await page.evaluate(async()=>{try{await authFetch(BASE+'/rest/v1/test');}catch{}return {user:S.user?.id,token:S.token};});
  assert.deepEqual(result,{user:'A',token:'test-A'});
});
test('late history response after logout cannot repopulate another account',async t=>{
  const page=await app(t,async url=>{if(url.includes('/rest/v1/drinking_records')){await new Promise(r=>setTimeout(r,80));return json([{id:'private',brand_name:'A private'}]);}});await signIn(page);
  const result=await page.evaluate(async()=>{const pending=loadHistory();clearSession();saveSession({access_token:'test-B',user:{id:'B'}});await pending;return {rows:S.historyRows,text:document.getElementById('historyList').textContent};});
  assert.deepEqual(result.rows,[]);assert.doesNotMatch(result.text,/A private/);
});
test('OAuth code exchange uses only the initiating tab verifier and removes callback code',async t=>{
  let sent;
  const page=await app(t,(url,req)=>{if(url.includes('grant_type=pkce')){sent=req.postDataJSON();return json({access_token:'oauth-token',refresh_token:'oauth-refresh'});}if(url.includes('/auth/v1/user'))return json({id:'A'});});
  await page.evaluate(async()=>{sessionStorage.setItem('sakelog_oauth_verifier','test-tab-verifier');localStorage.setItem('unrelated-code-verifier','wrong');history.replaceState(null,'','?code=test-code&other=kept');await consumeOAuthCallback();});
  assert.deepEqual(sent,{auth_code:'test-code',code_verifier:'test-tab-verifier'});assert.equal(new URL(page.url()).search,'?other=kept');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('sakelog_oauth_verifier')),null);
});
test('pending operations and input drafts stay isolated across account switching',async t=>{
  const page=await app(t);await signIn(page);
  const result=await page.evaluate(()=>{
    writeLocalOperation(PENDING_SAVE_STATE_KEY,{userId:'A',requestId:'A-pending'});
    document.getElementById('brand').value='A private';saveRecordDraft();clearSession();
    saveSession({access_token:'test-B',user:{id:'B'}});
    const bDraft=readRecordDraft();writeLocalOperation(PENDING_SAVE_STATE_KEY,{userId:'B',requestId:'B-pending'});
    clearSession();saveSession({access_token:'test-A',user:{id:'A'}});
    return {bDraft,pending:readLocalOperation(PENDING_SAVE_STATE_KEY)?.requestId,draft:readRecordDraft()?.values.brand};
  });
  assert.deepEqual(result,{bDraft:null,pending:'A-pending',draft:'A private'});
});
test('late password-login response cannot replace a newer account session',async t=>{
  const page=await app(t,async url=>{if(url.includes('grant_type=password')){await new Promise(r=>setTimeout(r,80));return json({access_token:'late-A',refresh_token:'late-refresh',user:{id:'A',email:'a@example.invalid'}});}});
  const result=await page.evaluate(async()=>{document.getElementById('email').value='a@example.invalid';document.getElementById('password').value='example-password';const login=document.getElementById('authBtn').onclick();clearSession();saveSession({access_token:'test-B',user:{id:'B'}});await login;return {user:S.user.id,token:S.token};});
  assert.deepEqual(result,{user:'B',token:'test-B'});
});
test('scheduled draft autosave cannot overwrite the next account draft',async t=>{
  const page=await app(t);await signIn(page);
  await page.evaluate(()=>{document.getElementById('brand').value='A draft';document.getElementById('brand').dispatchEvent(new Event('input'));clearSession();saveSession({access_token:'test-B',user:{id:'B'}});writeLocalOperation(RECORD_DRAFT_KEY,{userId:'B',values:{brand:'B retained'},savedAt:Date.now()});});
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>readRecordDraft().values.brand),'B retained');
});
