const BASE="https://mtshsijgfmottgkbgnir.supabase.co";
const PUBLISHABLE_KEY="sb_publishable_iN9jbt45ga1sPbzt5aw-0w_iWs8eWW-";
const $=id=>document.getElementById(id);
const S={signup:false,user:null,token:null,refreshToken:null,photo:null,backPhoto:null,foodPhoto:null,memoryPhoto:null,lat:null,lng:null,recognition:null,currentImageCacheKey:null,currentFrontHash:null,currentBackHash:null,detailRecord:null,authBusy:false,currentEventId:null,currentEventSakeId:null,currentSakeId:null,currentSaveRequestId:null,currentEventPhotoRequestId:null,selectedRecognitionCandidate:null};
const photoObjectUrls=new Map();
let freshPhotoPickerConfirmed=false;
const cfgKey=()=>localStorage.getItem("sakelog_pubkey")||PUBLISHABLE_KEY;
const msg=(el,text,type="ok")=>el.innerHTML=text?`<div class="msg ${type}">${escapeHtml(text)}</div>`:"";
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));


function updateNetworkState(){
  const online=navigator.onLine!==false;
  const banner=$("networkBanner");
  if(banner)banner.classList.toggle("hidden",online);
  document.body.dataset.network=online?"online":"offline";
  return online;
}
function requireOnline(messageText){
  if(updateNetworkState())return true;
  alert(messageText||"現在オフラインです。通信が戻ってからもう一度お試しください。");
  return false;
}
window.addEventListener("online",async()=>{
  updateNetworkState();
  if(S.user){
    await cleanupPendingRollbacks().catch(()=>{});
    await cleanupPendingStorageDeletes().catch(()=>{});
    await recoverInterruptedOperations().catch(()=>{});
   if($("recoveryNotice")?.classList.contains("hidden")) maybeShowDraftRecoveryNotice();
  }
});
window.addEventListener("offline",()=>updateNetworkState());
updateNetworkState();

window.addEventListener("error",e=>{
  console.error("JavaScript error:",e.error||e.message);
  const el=$("recordMsg")||$("editMsg");
  if(el){
    el.innerHTML='<div class="msg err">システムエラー：'+
      escapeHtml(e.message||"JavaScriptエラーが発生しました")+
      '</div>';
  }
});

window.addEventListener("unhandledrejection",e=>{
  console.error("Unhandled promise rejection:",e.reason);
  const text=e.reason?.message||String(e.reason||"処理エラーが発生しました");
  const el=$("recordMsg")||$("editMsg");
  if(el){
    el.innerHTML='<div class="msg err">処理エラー：'+
      escapeHtml(text)+
      '</div>';
  }
});

function syncActiveNav(id){
 const navPage=id==="detailView" ? "historyView" : id;
 document.querySelectorAll(".navbtn").forEach(b=>{
   const active=b.dataset.page===navPage;
   b.classList.toggle("active",active);
   b.classList.toggle("is-active",active);
   if(active)b.setAttribute("aria-current","page");
   else b.removeAttribute("aria-current");
 });
}
function show(id){
 const protectedViews=new Set(["homeView","eventView","recordView","completeView","historyView","detailView","analysisView","profileView"]);
 if(protectedViews.has(id)&&!S.user){id="authView"}
 ["setupView","authView",...Array.from(document.querySelectorAll(".page")).map(x=>x.id)].forEach(x=>$(x)?.classList.add("hidden"));
 $(id).classList.remove("hidden");
 $("bottomNav").classList.toggle("hidden",!S.user);
 if($("logoutTop")) $("logoutTop").classList.toggle("hidden",!S.user);
 syncActiveNav(id);
 if(id==="homeView")loadRecent();
 if(id==="historyView")loadHistory();
 if(id==="profileView"){
   loadProfile();
   loadProfileEventHistory().catch(()=>{});
   loadProfileEventStats().catch(()=>{});
   loadProfileEventYearReview().catch(()=>{});
   loadProfileEventDiscoveries().catch(()=>{});
   loadProfileEventPhotos().catch(()=>{});
 }
 if(id==="analysisView")loadAnalysis();
}
function headers(auth=false){
 const h={"apikey":cfgKey(),"Content-Type":"application/json"};
 if(auth&&S.token)h["Authorization"]="Bearer "+S.token;
 return h;
}
function saveSession(d){
 S.token=d.access_token||S.token;
 S.refreshToken=d.refresh_token||S.refreshToken;
 S.user=d.user||S.user;
 if(S.token)localStorage.setItem("sakelog_token",S.token);
 if(S.refreshToken)localStorage.setItem("sakelog_refresh_token",S.refreshToken);
 if(S.user)localStorage.setItem("sakelog_user",JSON.stringify(S.user));
}

function currentAppRedirectUrl(){
 return location.origin + location.pathname;
}

function startOAuth(provider){
 const redirectTo=currentAppRedirectUrl();
 const url=new URL(BASE+"/auth/v1/authorize");
 url.searchParams.set("provider",provider);
 url.searchParams.set("redirect_to",redirectTo);
 location.assign(url.toString());
}

function startLineLogin(){
 const redirectTo=currentAppRedirectUrl();
 const url=new URL(BASE+"/functions/v1/line-login");
 url.searchParams.set("redirect_to",redirectTo);
 location.assign(url.toString());
}

async function startLineLink(){
 if(!S.token||!S.user){
   alert("先に連携したい和酒ログアカウントへログインしてください。");
   return;
 }
 try{
   const r=await fetch(BASE+"/functions/v1/line-login",{
     method:"POST",
     headers:{
       "apikey":cfgKey(),
       "Authorization":"Bearer "+S.token,
       "Content-Type":"application/json"
     },
     body:JSON.stringify({redirect_to:currentAppRedirectUrl()})
   });
   const d=await r.json().catch(()=>null);
   if(!r.ok||!d?.authorize_url)throw new Error(d?.error||"LINE連携を開始できませんでした");
   location.assign(d.authorize_url);
 }catch(e){
   alert(e?.message||"LINE連携を開始できませんでした");
 }
}

async function loadSocialProviders(){
 try{
   const r=await fetch(BASE+"/auth/v1/settings",{headers:{apikey:cfgKey()}});
   if(!r.ok)return;
   const d=await r.json().catch(()=>null);
   const ext=d?.external||{};

   const map=[
     ["googleLoginBtn","google"],
     ["appleLoginBtn","apple"],
     ["lineLoginBtn","custom:line"]
   ];
   for(const [id,key] of map){
     const el=$(id);
     if(el)el.classList.toggle("hidden",key==="custom:line" ? false : ext[key]!==true);
   }

   const box=$("socialLoginBox");
   if(box){
     const any=map.some(([id])=>!$(id)?.classList.contains("hidden"));
     box.classList.toggle("hidden",!any);
   }
 }catch{}
}

async function consumeOAuthCallback(){
 const hash=new URLSearchParams(location.hash.replace(/^#/,""));

 const lineLinked=hash.get("line_linked");
 if(lineLinked==="1"){
   localStorage.setItem("sakelog_line_linked_notice","1");
   history.replaceState(null,"",location.pathname+location.search);
   return false;
 }

 const lineError=hash.get("line_error");
 if(lineError){
   history.replaceState(null,"",location.pathname+location.search);
   msg($("authMsg"),lineError,"err");
   return false;
 }

 const lineTokenHash=hash.get("line_token_hash");
 if(lineTokenHash){
   try{
     const r=await fetch(BASE+"/auth/v1/verify",{
       method:"POST",
       headers:{"apikey":cfgKey(),"Content-Type":"application/json"},
       body:JSON.stringify({token_hash:lineTokenHash,type:"email"})
     });
     const d=await r.json().catch(()=>null);
     if(!r.ok||!d?.access_token||!d?.user)throw new Error(d?.msg||d?.message||"LINEログインの完了に失敗しました");
     saveSession(d);
     history.replaceState(null,"",location.pathname+location.search);
     return true;
   }catch(e){
     clearSession();
     history.replaceState(null,"",location.pathname+location.search);
     msg($("authMsg"),e?.message||"LINEログインの完了に失敗しました","err");
     return false;
   }
 }

 let access=hash.get("access_token");
 let refresh=hash.get("refresh_token");

 // Custom OIDC providers such as LINE can return an authorization code
 // instead of tokens in the URL hash. Exchange it with Supabase first.
 const code=new URLSearchParams(location.search).get("code");
 if(!access&&code){
   try{
     const verifierKey=Object.keys(localStorage).find(k=>k.includes("code-verifier"));
     const verifier=verifierKey?localStorage.getItem(verifierKey):null;
     if(verifier){
       const r=await fetch(BASE+"/auth/v1/token?grant_type=pkce",{
         method:"POST",
         headers:{"apikey":cfgKey(),"Content-Type":"application/json"},
         body:JSON.stringify({auth_code:code,code_verifier:verifier})
       });
       const d=await r.json().catch(()=>null);
       if(r.ok&&d?.access_token){
         access=d.access_token;
         refresh=d.refresh_token||null;
       }
     }
   }catch{}
 }
 if(!access)return false;

 S.token=access;
 S.refreshToken=refresh||null;
 localStorage.setItem("sakelog_token",access);
 if(refresh)localStorage.setItem("sakelog_refresh_token",refresh);

 try{
   const r=await fetch(BASE+"/auth/v1/user",{
     headers:{apikey:cfgKey(),Authorization:"Bearer "+access}
   });
   const user=await r.json().catch(()=>null);
   if(!r.ok||!user?.id)throw new Error("OAuth user load failed");
   S.user=user;
   localStorage.setItem("sakelog_user",JSON.stringify(user));
   history.replaceState(null,"",location.pathname+location.search);
   return true;
 }catch{
   clearSession();
   return false;
 }
}
async function refreshSession(){
 if(!S.refreshToken)throw new Error("ログインの有効期限が切れました。もう一度ログインしてください。");
 const r=await fetch(BASE+"/auth/v1/token?grant_type=refresh_token",{
  method:"POST",headers:{"apikey":cfgKey(),"Content-Type":"application/json"},
  body:JSON.stringify({refresh_token:S.refreshToken})
 });
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.access_token)throw new Error(d.message||d.msg||"ログインの更新に失敗しました。");
 saveSession(d);return true;
}
async function authFetch(url,options={}){
 const make=async()=>{
   try{
     return await fetch(url,{
       ...options,
       headers:{...(options.headers||{}),apikey:cfgKey(),Authorization:"Bearer "+S.token}
     });
   }catch(e){
     if(e instanceof TypeError || /fetch|network|offline/i.test(String(e?.message||e))){
       throw new Error("通信できません。電波状況を確認してもう一度お試しください。");
     }
     throw e;
   }
 };
 let r=await make();
 if(r.status===401){
  const t=await r.clone().text().catch(()=>"");
  if(/jwt expired|expired|invalid jwt|jwt issued at future|issued at future|not yet valid/i.test(t)){
   try{
     await refreshSession();
   }catch{
     clearSession();
     show("authView");
     throw new Error("ログインの有効期限が切れました。もう一度ログインしてください。");
   }
   r=await make();
   if(r.status===401){
     const retryText=await r.clone().text().catch(()=>"");
     if(/jwt issued at future|issued at future|not yet valid/i.test(retryText)){
       clearSession();
       show("authView");
       throw new Error("端末の日時がサーバーとずれています。スマホの「日付と時刻」を自動設定にして、もう一度ログインしてください。");
     }
   }
  }
 }
 return r;
}
async function testConnection(){
 const key=$("key").value.trim();
 if(!key.startsWith("sb_publishable_")){msg($("setupMsg"),"Publishable keyを確認してください。","err");return false}
 try{
  const r=await fetch(BASE+"/auth/v1/settings",{headers:{apikey:key}});
  if(!r.ok)throw new Error("HTTP "+r.status);
  msg($("setupMsg"),"✓ Supabaseに接続できました。HTTP "+r.status,"ok");return true;
 }catch(e){msg($("setupMsg"),"接続失敗: "+e.message,"err");return false}
}
$("key").value=cfgKey();
$("testBtn").onclick=testConnection;
$("saveSetup").onclick=async()=>{if(await testConnection()){localStorage.setItem("sakelog_pubkey",$("key").value.trim());show("authView")}};

$("toggleAuth").onclick=()=>{S.signup=!S.signup;$("authTitle").textContent=S.signup?"新規登録":"ログイン";$("authBtn").textContent=S.signup?"新規登録":"ログイン";$("toggleAuth").textContent=S.signup?"登録済み → ログイン":"初めて使う → 新規登録";msg($("authMsg"),"")};

$("authBtn").onclick=async()=>{
 if(S.authBusy)return;
 const email=$("email").value.trim(),password=$("password").value;
 if(!email){msg($("authMsg"),"メールアドレスを入力してください。","err");return}
 if(S.signup&&password.length<8){msg($("authMsg"),"新規登録のパスワードは8文字以上にしてください。","err");return}
 if(!S.signup&&password.length<6){msg($("authMsg"),"パスワードを入力してください。","err");return}
 S.authBusy=true;
 $("authBtn").disabled=true;
 const path=S.signup?"/auth/v1/signup":"/auth/v1/token?grant_type=password";
 try{
  const r=await fetch(BASE+path,{method:"POST",headers:headers(),body:JSON.stringify({email,password})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.msg||d.message||"HTTP "+r.status);
  if(S.signup&&!d.access_token){msg($("authMsg"),"✓ 登録を受け付けました。確認メールが届く場合はメール認証後にログインしてください。","ok");return}
  saveSession(d);
  $("password").value="";
  $("userEmail").textContent=S.user?.email||"";
  show("homeView"); loadMyUpcomingEventList().catch(()=>{});
 }catch(e){msg($("authMsg"),e.message,"err")}
 finally{
  S.authBusy=false;
  $("authBtn").disabled=false;
 }
};

function clearSession(){
 ["sakelog_token","sakelog_refresh_token","sakelog_user","sakelog_access_token"].forEach(k=>localStorage.removeItem(k));

 // 共用端末でも前ユーザーの画面・写真Blobをメモリに残さない。
 for(const url of photoObjectUrls.values()){
   try{URL.revokeObjectURL(url)}catch{}
 }
 photoObjectUrls.clear();

 S.user=null;
 S.token=null;
 S.refreshToken=null;
 S.detailRecord=null;
 S.photo=null;
 S.backPhoto=null;
 S.foodPhoto=null;
 S.memoryPhoto=null;
 S.recognition=null;
 S.selectedRecognitionCandidate=null;
 S.currentImageCacheKey=null;
 S.currentFrontHash=null;
 S.currentBackHash=null;
 S.lat=null;
 S.lng=null;
 S.authBusy=false;
 S.currentSaveRequestId=null;
 S.currentEventPhotoRequestId=null;
 S.selectedRecognitionCandidate=null;
 clearLocalOperation(PENDING_SAVE_STATE_KEY);
 clearLocalOperation(PENDING_EVENT_PHOTO_STATE_KEY);

 if($("password")) $("password").value="";
 if($("userEmail")) $("userEmail").textContent="";
}
async function verifyCurrentUser(){
 if(!S.token)return false;
 const r=await fetch(BASE+"/auth/v1/user",{headers:{apikey:cfgKey(),Authorization:"Bearer "+S.token}});
 if(r.status===401&&S.refreshToken){
   try{await refreshSession()}catch{return false}
   return verifyCurrentUser();
 }
 if(!r.ok)return false;
 const user=await r.json().catch(()=>null);
 if(!user?.id)return false;
 S.user=user;
 localStorage.setItem("sakelog_user",JSON.stringify(user));
 return true;
}
async function restore(){
 await loadSocialProviders();

 if(await consumeOAuthCallback()){
   $("userEmail").textContent=S.user?.email||"";
   await cleanupPendingRollbacks().catch(()=>{});
   await cleanupPendingStorageDeletes().catch(()=>{});
   show("homeView"); loadMyUpcomingEventList().catch(()=>{});
   await recoverInterruptedOperations().catch(()=>{});
   if($("recoveryNotice")?.classList.contains("hidden")) maybeShowDraftRecoveryNotice();
   return;
 }

 S.token=localStorage.getItem("sakelog_token");
 S.refreshToken=localStorage.getItem("sakelog_refresh_token");
 show("authView");
 if(await verifyCurrentUser()){
   $("userEmail").textContent=S.user.email||"";
   await cleanupPendingRollbacks().catch(()=>{});
   await cleanupPendingStorageDeletes().catch(()=>{});
   show("homeView"); loadMyUpcomingEventList().catch(()=>{});
   await recoverInterruptedOperations().catch(()=>{});
   if($("recoveryNotice")?.classList.contains("hidden")) maybeShowDraftRecoveryNotice();
   if(localStorage.getItem("sakelog_line_linked_notice")==="1"){
     localStorage.removeItem("sakelog_line_linked_notice");
     alert("LINEをこの和酒ログアカウントに連携しました。次回からLINEでも同じ記録に入れます。");
   }
 }else{
   clearSession();
   show("authView");
 }
}
async function logout(){
 if(S.token){
   await fetch(BASE+"/auth/v1/logout",{method:"POST",headers:{apikey:cfgKey(),Authorization:"Bearer "+S.token}}).catch(()=>{});
 }
 clearSession();
 show("authView");
}
$("logoutTop").onclick=logout;


function hasCurrentRecordWork(){
  const fieldValue=RECORD_DRAFT_FIELDS.some(id=>String($(id)?.value||"").trim());
  return fieldValue || !!(S.photo||S.backPhoto||S.foodPhoto||S.memoryPhoto||S.currentEventId||S.currentSakeId);
}
function confirmStartFreshRecord(){
  const draft=readRecordDraft();
  const hasDraft=!!(draft&&draft.userId===S.user?.id);
  if(!hasDraft && !hasCurrentRecordWork())return true;
  return confirm("入力途中の一杯があります。\n\n今の内容を破棄して、新しい一杯を始めますか？");
}
function startFreshRecord(){
  if(!confirmStartFreshRecord())return false;
  clearRecordDraft();
  resetRecord();
  return true;
}
function recordViewIsVisible(){
  return !$("recordView")?.classList.contains("hidden");
}
function replaceFrontPhotoWithoutReset(file){
  if(!file)return;
  S.photo=file;
  $("preview").src=URL.createObjectURL(file);
  $("preview").classList.remove("hidden");
  S.recognition=null;
  S.selectedRecognitionCandidate=null;
  S.currentImageCacheKey=null;
  S.currentFrontHash=null;
  updateAnalyzeButton();
  saveRecordDraft();
  msg($("recordMsg"),"表ラベルを変更しました。入力済みの内容はそのまま残しています。","info");
}
function replaceBackPhotoWithoutReset(file){
  if(!file)return;
  S.backPhoto=file;
  $("backPreview").src=URL.createObjectURL(file);
  $("backPreview").classList.remove("hidden");
  S.recognition=null;
  S.selectedRecognitionCandidate=null;
  S.currentImageCacheKey=null;
  S.currentBackHash=null;
  updateAnalyzeButton();
  saveRecordDraft();
  msg($("recordMsg"),"裏ラベルを変更しました。入力済みの内容はそのまま残しています。","info");
}

function resetRecord(){
 S.currentImageCacheKey=null; S.currentFrontHash=null; S.currentBackHash=null;
 S.photo=null;S.backPhoto=null;S.foodPhoto=null;S.memoryPhoto=null;S.recognition=null;S.selectedRecognitionCandidate=null;S.lat=null;S.lng=null;S.currentEventId=null;S.currentEventSakeId=null;S.currentSakeId=null;S.currentSaveRequestId=null;
 ["brand","product","brewery","prefecture","classification","rice","riceVariety","polishing","alcohol","volume","restaurant","price","comment"].forEach(id=>{if($(id))$(id).value=""});
 ["preview","backPreview","foodPreview","memoryPreview"].forEach(id=>$(id)?.classList.add("hidden"));
 ["cameraInput","galleryInput","backCameraInput","backGalleryInput","foodCameraInput","foodGalleryInput","memoryCameraInput","memoryGalleryInput"].forEach(id=>{if($(id))$(id).value=""});
 $("analyzeBtn").classList.add("hidden");$("candidateBox").classList.add("hidden");msg($("analysisMsg"),"");if($("recordValidationMsg"))$("recordValidationMsg").innerHTML="";["polishing","alcohol","volume","price","prefecture","brand","product","brewery"].forEach(id=>$(id)?.classList.remove("field-error","field-warning"));$("rating").value=4;$("ratingVal").textContent="4.0";$("locMsg").textContent="";msg($("recordMsg"),"");
 show("recordView");
}
$("manualBtn").onclick=()=>{startFreshRecord()};
$("rating").oninput=()=> $("ratingVal").textContent=Number($("rating").value).toFixed(1);

function updateAnalyzeButton(){
 $("analyzeBtn").classList.toggle("hidden",!(S.photo||S.backPhoto));
}
function attachPhoto(file){
 if(!file)return;
 if(recordViewIsVisible() && hasCurrentRecordWork()){
   replaceFrontPhotoWithoutReset(file);
   return;
 }
 if(freshPhotoPickerConfirmed){
   freshPhotoPickerConfirmed=false;
   clearRecordDraft();
   resetRecord();
 }else if(!startFreshRecord())return;
 S.photo=file;
 $("preview").src=URL.createObjectURL(file);
 $("preview").classList.remove("hidden");
 updateAnalyzeButton();
 saveRecordDraft();
 msg($("recordMsg"),"表ラベルを選択しました。裏ラベルも追加すると識別精度を上げやすくなります。","info");
}
function attachBackPhoto(file){
 if(!file)return;
 if(recordViewIsVisible() && hasCurrentRecordWork()){
   replaceBackPhotoWithoutReset(file);
   return;
 }
 if(freshPhotoPickerConfirmed){
   freshPhotoPickerConfirmed=false;
   clearRecordDraft();
   resetRecord();
 }else if(!startFreshRecord())return;
 S.backPhoto=file;
 $("backPreview").src=URL.createObjectURL(file);
 $("backPreview").classList.remove("hidden");
 updateAnalyzeButton();
 saveRecordDraft();
 msg($("recordMsg"),"裏ラベルを選択しました。裏ラベルだけでも解析・保存できます。","info");
}
function attachFoodPhoto(file){
  S.foodPhoto=file;
  $("foodPreview").src=URL.createObjectURL(file);
  $("foodPreview").classList.remove("hidden");
}

function attachMemoryPhoto(file){
  S.memoryPhoto=file;
  $("memoryPreview").src=URL.createObjectURL(file);
  $("memoryPreview").classList.remove("hidden");
}
$("cameraBtn").onclick=()=>{if(confirmStartFreshRecord()){freshPhotoPickerConfirmed=true;$("cameraInput").click()}};
$("galleryBtn").onclick=()=>{if(confirmStartFreshRecord()){freshPhotoPickerConfirmed=true;$("galleryInput").click()}};
$("backCameraBtn").onclick=()=>{if(confirmStartFreshRecord()){freshPhotoPickerConfirmed=true;$("backCameraInput").click()}};
$("backGalleryBtn").onclick=()=>{if(confirmStartFreshRecord()){freshPhotoPickerConfirmed=true;$("backGalleryInput").click()}};
function clearFreshPhotoPickerConfirmationSoon(){
  setTimeout(()=>{freshPhotoPickerConfirmed=false},500);
}
$("cameraInput").onchange=e=>{const f=e.target.files?.[0];if(f)attachPhoto(f);else clearFreshPhotoPickerConfirmationSoon()};
$("galleryInput").onchange=e=>{const f=e.target.files?.[0];if(f)attachPhoto(f);else clearFreshPhotoPickerConfirmationSoon()};
$("backCameraInput").onchange=e=>{const f=e.target.files?.[0];if(f)attachBackPhoto(f);else clearFreshPhotoPickerConfirmationSoon()};
$("backGalleryInput").onchange=e=>{const f=e.target.files?.[0];if(f)attachBackPhoto(f);else clearFreshPhotoPickerConfirmationSoon()};
$("foodCameraInput").onchange=e=>{
  const f=e.target.files?.[0];
  if(f)attachFoodPhoto(f);
};

$("foodGalleryInput").onchange=e=>{
  const f=e.target.files?.[0];
  if(f)attachFoodPhoto(f);
};

$("memoryCameraInput").onchange=e=>{
  const f=e.target.files?.[0];
  if(f)attachMemoryPhoto(f);
};

$("memoryGalleryInput").onchange=e=>{
  const f=e.target.files?.[0];
  if(f)attachMemoryPhoto(f);
};
$("recordFrontGalleryBtn").onclick=()=> $("galleryInput").click();
$("recordBackGalleryBtn").onclick=()=> $("backGalleryInput").click();
$("recordFrontCameraBtn").onclick=()=> $("cameraInput").click();
$("recordBackCameraBtn").onclick=()=> $("backCameraInput").click();

$("foodCameraBtn").onclick=()=> $("foodCameraInput").click();
$("foodGalleryBtn").onclick=()=> $("foodGalleryInput").click();
$("memoryCameraBtn").onclick=()=> $("memoryCameraInput").click();
$("memoryGalleryBtn").onclick=()=> $("memoryGalleryInput").click();

async function fileToDataURL(file,mode="front"){
 const raw=await new Promise((resolve,reject)=>{
   const r=new FileReader();
   r.onload=()=>resolve(r.result);
   r.onerror=reject;
   r.readAsDataURL(file);
 });
 
 return await new Promise((resolve)=>{
   const img=new Image();
   img.onload=()=>{
     // 表ラベルは軽量、裏ラベルは小さい数字を読むため高精細。
     const isBack=mode==="back";
     const MAX=isBack?1800:1024;
     const QUALITY=isBack?0.90:0.78;
     const scale=Math.min(1,MAX/Math.max(img.width,img.height));
     const w=Math.max(1,Math.round(img.width*scale));
     const h=Math.max(1,Math.round(img.height*scale));
     const c=document.createElement("canvas");
     c.width=w;c.height=h;
     const ctx=c.getContext("2d");
     ctx.imageSmoothingEnabled=true;
     ctx.imageSmoothingQuality="high";
     ctx.drawImage(img,0,0,w,h);
     resolve(c.toDataURL("image/jpeg",QUALITY));
   };
   img.onerror=()=>resolve(raw);
   img.src=raw;
 });
}
function confidenceLabel(v){
 const n=Math.max(0,Math.min(1,Number(v)||0));
 if(n>=0.9)return "非常に高い";
 if(n>=0.75)return "高い";
 if(n>=0.55)return "中程度";
 return "低い";
}
function renderSources(sources){
 if(!sources?.length)return "";
 return `<div style="margin-top:12px"><b>Web確認元</b>${sources.map(s=>{
   const title=escapeHtml(s.title||s.domain||"確認元");
   const url=String(s.url||"");
   if(!/^https?:\/\//i.test(url))return "";
   return `<div class="small" style="margin-top:7px"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${title} ↗</a>${s.supports?`<br>${escapeHtml(s.supports)}`:""}</div>`;
 }).join("")}</div>`;
}
function applyCandidate(c){
 if(!c)return;
 S.selectedRecognitionCandidate=c;
 const f=S.recognition?.label_facts||{};
 $("brand").value=f.brand||c.brand||"";
 $("product").value=f.product||c.product||"";
 $("brewery").value=f.brewery||c.brewery||"";
 $("prefecture").value=f.prefecture||c.prefecture||"";
 $("classification").value=f.classification||c.classification||"";
 // 個体差がある項目は、今回の瓶ラベルから読めた値だけを使う
 $("rice").value=f.ingredients||"";
     if($("riceVariety")) $("riceVariety").value=f.rice_variety||f.rice||"";
 $("polishing").value=f.polishing_ratio||"";
 $("alcohol").value=f.alcohol||"";
 $("volume").value=f.volume||"";
}
function productSpecScore(f,c){
  let score=0;
  let total=0;

  const norm=v=>String(v||"")
    .toLowerCase()
    .replace(/\s+/g,"")
    .replace(/[‐-‒–—―ー\-・･]/g,"");

  const add=(a,b,weight=1)=>{
    if(!a) return;
    total+=weight;
    if(!b) return;

    const aa=norm(a);
    const bb=norm(b);

    if(aa && bb && (aa===bb || aa.includes(bb) || bb.includes(aa))){
      score+=weight;
    }
  };

  // 商品そのものを特定する情報を重視
  add(f.product,c.product,4);
  add(f.rice_variety,c.rice_variety,3);
  add(f.polishing_ratio,c.polishing_ratio,3);

  // 補助情報
  add(f.classification,c.classification,2);
  add(f.alcohol,c.alcohol,1);

  // 銘柄・蔵元も取れていれば照合
  add(f.brand,c.brand,3);
  add(f.brewery,c.brewery,2);

  return total ? score/total : 0;
}
function renderCandidates(items){
  // 同一商品の重複候補をまとめる
  const normalizeCandidateText=v=>String(v||"")
    .toLowerCase()
    .replace(/1800\s*ml|1\.8\s*l|720\s*ml|300\s*ml|一升瓶/g,"")
    .replace(/\s+/g,"")
    .replace(/[（）()・\-ー_]/g,"");

  const seen=new Set();
  const uniqueItems=(items||[]).filter(c=>{
    const key=[
      normalizeCandidateText(c.brand),
      normalizeCandidateText(c.product),
      normalizeCandidateText(c.brewery)
    ].join("|");

    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
 $("candidateBox").classList.remove("hidden");
 if(!items?.length){
   const f=S.recognition?.label_facts||{};
   const hasLabelIdentity=!!(f.brand||f.product||f.brewery);
   if(hasLabelIdentity){
     $("candidateBox").innerHTML='<div class="msg info"><b>📷 ラベル読取候補</b><br>'+
       escapeHtml([f.brand,f.product].filter(Boolean).join(" ")||"商品名を一部読取")+
       (f.brewery?'<br><span class="small">'+escapeHtml(f.brewery)+'</span>':"")+
       '<br><span class="small">Web確認はできませんでしたが、写真から読めた情報で記録できます。</span></div>';
   }else{
     $("candidateBox").innerHTML='<div class="msg err"><b>ラベルから商品名を十分に読み取れませんでした。</b><br>裏ラベルを正面から大きく撮るか、別角度の写真を試してください。</div>';
   }
   return;
 }
 $("candidateBox").innerHTML='<div class="msg info"><b>AI・Web照合結果</b><br>'+
 uniqueItems.map((c,i)=>{
   const pct=Math.round(Math.max(0,Math.min(1,Number(c.confidence)||0))*100);
   const spec=productSpecScore(S.recognition?.label_facts||{},c);
const webVerified=c.web_verified===true;
const labelSpecVerified=pct>=90 && spec>=0.9;
   const checks=[
     c.evidence?.front_label?`表: ${escapeHtml(c.evidence.front_label)}`:"",
     c.evidence?.back_label?`裏: ${escapeHtml(c.evidence.back_label)}`:"",
     c.evidence?.web_match?`Web: ${escapeHtml(c.evidence.web_match)}`:""
   ].filter(Boolean).join("<br>");
   return `<button class="btn outline candidate" data-i="${i}" style="text-align:left">
     <b>${i+1}. ${escapeHtml([c.brand,c.product].filter(Boolean).join(" "))}</b><br>
     <span class="small">${escapeHtml(c.brewery||"蔵元不明")}</span><br>
     ${webVerified
  ?"✓ Web確認済み"
  :labelSpecVerified
    ?"✓ ラベル・仕様一致"
    :"△ 要確認"}
    <span class="small">商品仕様一致 ${Math.round(spec*100)}%</span><br>
     ${checks?`<div class="small" style="margin-top:6px">${checks}</div>`:""}
   </button>`;
 }).join("")+
 renderSources(S.recognition?.web_sources||[])+
 '<div class="small" style="margin-top:10px">※Web情報は本人確認用です。度数・容量などは現物ラベルを優先します。</div></div>';
 document.querySelectorAll(".candidate").forEach(b=>b.onclick=()=>{
   const c=uniqueItems[Number(b.dataset.i)];
   applyCandidate(c);
   msg($("analysisMsg"),"この候補を入力欄へ反映しました。度数・容量などは現物ラベルを確認して保存してください。","ok");
 });
}


const DICT_TABLE="sake_dictionary_signatures";

const MASTER_TABLE="sake_master";
const BAD_MASTER_WORDS=new Set(["確認中","未確認","不明","不詳","unknown","候補","解析中","未判定",""]);
function cleanMasterText(v){return String(v||"").normalize("NFKC").trim()}
function isUsableMasterBrand(v){
  const x=cleanMasterText(v).toLowerCase();
  return x.length>0 && !BAD_MASTER_WORDS.has(x) && !/^(確認|未確認|不明|不詳|unknown|候補|解析中|未判定)/i.test(x);
}
async function rpc(fn,args={}){
  const r=await authFetch(BASE+"/rest/v1/rpc/"+fn,{
    method:"POST",
    headers:{"Content-Type":"application/json","Prefer":"return=representation"},
    body:JSON.stringify(args)
  });
  const d=await r.json().catch(()=>null);
  if(!r.ok)throw new Error((d&&d.message)||"HTTP "+r.status);
  return d;
}
async function learnToSakeMaster(values){
  const brand=cleanMasterText(values.brand);
  if(!isUsableMasterBrand(brand))return {skipped:true,reason:"invalid_brand"};
  try{
    const d=await rpc("learn_sake_master",{
      p_brand_name:brand,
      p_product_name:cleanMasterText(values.product)||null,
      p_brewery_name:cleanMasterText(values.brewery)||null,
      p_prefecture:cleanMasterText(values.prefecture)||null,
      p_classification:cleanMasterText(values.classification)||null,
      p_ingredients:cleanMasterText(values.ingredients)||null,
      p_rice_variety:cleanMasterText(values.rice_variety)||null,
      p_polishing_ratio:cleanMasterText(values.polishing_ratio)||null,
      p_alcohol:cleanMasterText(values.alcohol)||null,
      p_volume:cleanMasterText(values.volume)||null
    });
    return {ok:true,data:d};
  }catch(e){
    console.warn("sake_master learning skipped",e);
    return {ok:false,error:e};
  }
}
function currentConfirmedValues(){
  return {
    brand:$("brand").value.trim(),
    product:$("product").value.trim(),
    brewery:$("brewery").value.trim(),
    prefecture:$("prefecture").value.trim(),
    classification:$("classification").value.trim(),
    ingredients:$("rice").value.trim(),
    rice_variety:$("riceVariety")?.value?.trim()||"",
    polishing_ratio:$("polishing").value.trim(),
    alcohol:$("alcohol").value.trim(),
    volume:$("volume").value.trim()
  };
}


let SAKENOWA_MASTER=null;
function normJP(s){return String(s||"").normalize("NFKC").toLowerCase().replace(/株式会社|有限会社|合資会社|合同会社|酒造/g,"").replace(/[\s　・･\-ー_（）()「」『』【】]/g,"")}
function grams(s){const x=normJP(s),a=[];if(x.length<2)return x?[x]:[];for(let i=0;i<x.length-1;i++)a.push(x.slice(i,i+2));return a}
function simText(a,b){
 const x=normJP(a),y=normJP(b);if(!x||!y)return 0;if(x===y)return 1;
 if(x.includes(y)||y.includes(x))return .6+.35*Math.min(x.length,y.length)/Math.max(x.length,y.length);
 const A=grams(x),B=grams(y),used=new Set();let hit=0;
 for(const q of A){const j=B.findIndex((v,i)=>v===q&&!used.has(i));if(j>=0){used.add(j);hit++}}
 return 2*hit/(A.length+B.length||1)
}
async function loadSakenowaMaster(){
 if(SAKENOWA_MASTER)return SAKENOWA_MASTER;
 try{const r=await fetch("/.netlify/functions/sakenowa-master"),d=await r.json();if(!r.ok)throw 0;return SAKENOWA_MASTER=d}catch{return null}
}

async function matchWashuMasterFacts(f){
  try{
    const rows=await select(
      MASTER_TABLE,
      "select=id,brand_name,product_name,brewery_name,prefecture,classification,rice_variety,polishing_ratio_text,alcohol_text,verified,status&status=eq.confirmed&verified=eq.true&limit=500"
    );
    const qb=f?.brand||"", qp=f?.product||"", qbr=f?.brewery||"", qpref=f?.prefecture||"";
    const out=[];
    for(const m of rows||[]){
      const brandScore=qb?simText(qb,m.brand_name):0;
      const productScore=qp?simText(qp,m.product_name):0;
      const breweryScore=qbr?simText(qbr,m.brewery_name):0;
      const prefScore=qpref?simText(qpref,m.prefecture):0;

      let score=brandScore*.48 + productScore*.32 + breweryScore*.16 + prefScore*.04;
      if(brandScore>=.99) score+=.08;
      if(productScore>=.99) score+=.08;
      if(breweryScore>=.9) score+=.04;

      if(
        brandScore>=.72 &&
        (productScore>=.48 || breweryScore>=.72 || (!qp && breweryScore>=.8))
      ){
        out.push({
          sake_id:m.id,
          brand:m.brand_name||"",
          product:m.product_name||"",
          brewery:m.brewery_name||"",
          prefecture:m.prefecture||"",
          classification:m.classification||"",
          rice_variety:m.rice_variety||"",
          polishing_ratio:m.polishing_ratio_text||"",
          alcohol:m.alcohol_text||"",
          confidence:Math.min(1,score),
          web_verified:true,
          master_verified:true,
          reason:"和酒ログの確認済み商品masterと照合",
          evidence:{web_match:"和酒ログ確認済みmaster"}
        });
      }
    }
    return out.sort((a,b)=>b.confidence-a.confidence).slice(0,5);
  }catch(e){
    console.warn("Washu master lookup skipped",e);
    return [];
  }
}

function mergeRecognitionCandidates(aiCandidates,masterCandidates){
  const all=[...(masterCandidates||[]),...(aiCandidates||[])];
  const seen=new Set();
  return all.filter(c=>{
    const key=[normJP(c.brand),normJP(c.product),normJP(c.brewery)].join("|");
    if(!key.replace(/\|/g,"")) return false;
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a,b)=>Number(b.confidence||0)-Number(a.confidence||0)).slice(0,5);
}

async function matchSakenowaFacts(f){
 const m=await loadSakenowaMaster();if(!m)return [];
 const breweries=new Map(m.breweries.map(x=>[x.id,x])),areas=new Map(m.areas.map(x=>[x.id,x]));
 const qb=f?.brand||f?.product||"",qbr=f?.brewery||"",qp=f?.prefecture||"",out=[];
 for(const b of m.brands){const br=breweries.get(b.breweryId)||{},ar=areas.get(br.areaId)||{};
  const bs=simText(qb,b.name),brs=qbr?simText(qbr,br.name):0,ps=qp?simText(qp,ar.name):0;
  let score=bs*.76+brs*.18+ps*.06;if(bs>=.99)score+=.08;if(brs>=.9)score+=.05;
  if(score>=.42)out.push({brand:b.name,brewery:br.name||"",prefecture:ar.name||"",brandId:b.id,score:Math.min(1,score)});
 }
 return out.sort((a,b)=>b.score-a.score).slice(0,5)
}

async function loadUpcomingEventsForSake(sakeId){
  if(!sakeId)return [];
  try{
    const rows=await rpc("upcoming_events_for_sake",{p_sake_id:sakeId,p_limit:5});
    return Array.isArray(rows)?rows:[];
  }catch(e){
    console.warn("upcoming event lookup skipped",e);
    return [];
  }
}

function renderUpcomingEventsForSake(items){
  const old=document.getElementById("upcomingSakeEvents");
  if(old) old.remove();
  if(!items?.length)return;

  const box=document.createElement("div");
  box.id="upcomingSakeEvents";
  box.className="sakenowa-box";

  const formatDate=v=>{
    try{
      const d=new Date(v);
      return d.toLocaleDateString("ja-JP",{month:"numeric",day:"numeric",weekday:"short"});
    }catch{return ""}
  };

  box.innerHTML=
    "<b>📅 このお酒に会えるイベント</b>"+
    items.map(e=>{
      const place=[e.prefecture,e.city,e.venue_name].filter(Boolean).join(" ");
      const link=/^https?:\/\//i.test(e.official_url||"")
        ? `<a href="${escapeHtml(e.official_url)}" target="_blank" rel="noopener noreferrer">公式情報 ↗</a>`
        : "";
      return `
        <div style="padding:9px 0;border-bottom:1px solid #eee;">
          <b>${escapeHtml(e.title||"イベント")}</b><br>
          <span class="small">${escapeHtml(formatDate(e.starts_at))}${place?" ／ "+escapeHtml(place):""}</span>
          ${e.reservation_required?'<br><span class="small">予約・事前手続きあり</span>':""}
          ${link?'<br><span class="small">'+link+'</span>':""}
        </div>
      `;
    }).join("");

  $("analysisMsg").insertAdjacentElement("afterend",box);
}

function renderSakenowaMatches(items){
 const old=document.getElementById("sakenowaMatches");if(old)old.remove();if(!items?.length)return;
 const box=document.createElement("div");box.id="sakenowaMatches";box.className="sakenowa-box";
 box.innerHTML="<b>🍶 さけのわ銘柄DB照合</b>"+items.slice(0,3).map(x=>`<div class="sakenowa-candidate"><b>${escapeHtml(x.brand)}</b>${x.brewery?" ／ "+escapeHtml(x.brewery):""}${x.prefecture?"（"+escapeHtml(x.prefecture)+"）":""} <span class="small">銘柄一致度 ${Math.round(x.score*100)}%</span></div>`).join("")+'<div class="small"><a href="https://sakenowa.com" target="_blank" rel="noopener">さけのわデータ</a>を利用しています。</div>';
 $("analysisMsg").insertAdjacentElement("afterend",box)
}


async function imageDHash(dataUrl){
  return await new Promise((resolve)=>{
    const img=new Image();
    img.onload=()=>{
      try{
        const c=document.createElement("canvas");
        c.width=9;c.height=8;
        const ctx=c.getContext("2d",{willReadFrequently:true});
        ctx.drawImage(img,0,0,9,8);
        const d=ctx.getImageData(0,0,9,8).data;
        let bits=0n, pos=0n;
        const lum=(x,y)=>{
          const i=(y*9+x)*4;
          return d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114;
        };
        for(let y=0;y<8;y++){
          for(let x=0;x<8;x++){
            if(lum(x,y)>lum(x+1,y)) bits|=(1n<<pos);
            pos++;
          }
        }
        resolve(bits.toString(16).padStart(16,"0"));
      }catch{resolve(null)}
    };
    img.onerror=()=>resolve(null);
    img.src=dataUrl;
  });
}
function hammingHex64(a,b){
  try{
    let x=BigInt("0x"+a)^BigInt("0x"+b), n=0;
    while(x){n+=Number(x&1n);x>>=1n}
    return n;
  }catch{return 64}
}
function hashSimilarity(a,b){
  if(!a||!b)return null;
  return 1-hammingHex64(a,b)/64;
}
function dictionaryScore(row,frontHash,backHash){
  const fs=hashSimilarity(frontHash,row.front_hash);
  const bs=hashSimilarity(backHash,row.back_hash);
  const vals=[fs,bs].filter(v=>v!==null);
  if(!vals.length)return {score:0,front:fs,back:bs};
  let score=vals.reduce((a,b)=>a+b,0)/vals.length;
  // 表裏が両方合う候補を少し優遇
  if(fs!==null&&bs!==null) score=Math.min(1,score+0.025);
  return {score,front:fs,back:bs};
}
async function lookupSharedDictionary(frontHash,backHash){
  try{
    const rows=await select(DICT_TABLE,
      "select=id,front_hash,back_hash,brand_name,product_name,brewery_name,prefecture,classification,ingredients,rice_variety,polishing_ratio,alcohol,volume,created_at&order=created_at.desc&limit=500");
    let best=null;
    for(const row of rows||[]){
      const sim=dictionaryScore(row,frontHash,backHash);
      if(!best||sim.score>best.sim.score)best={row,sim};
    }
    if(!best)return null;
    // 誤認識防止を優先した厳しめ閾値。
    // 表裏あり: 平均90%以上かつ各84%以上。片面だけ: 95%以上。
    const both=best.sim.front!==null&&best.sim.back!==null;
    const ok=both
      ? best.sim.score>=0.90 && best.sim.front>=0.84 && best.sim.back>=0.84
      : best.sim.score>=0.95;
    return ok?best:null;
  }catch(e){
    // migration未実行などの場合は辞書機能だけ静かにスキップ
    return null;
  }
}
function dictionaryRecordToFacts(row){
  return {
    brand:row.brand_name||"", product:row.product_name||"", brewery:row.brewery_name||"",
    prefecture:row.prefecture||"", classification:row.classification||"",
    ingredients:row.ingredients||"", rice_variety:row.rice_variety||"",
    polishing_ratio:row.polishing_ratio||"", alcohol:row.alcohol||"", volume:row.volume||"",
    ocr:""
  };
}
function applyDictionaryRow(row){
  const f=dictionaryRecordToFacts(row);

  const setIfEmpty=(id,v)=>{
    const el=$(id);
    if(el && !el.value.trim() && v){
      el.value=v;
    }
  };

  // 辞書は補助情報としてのみ使用
  setIfEmpty("brand",f.brand);
  setIfEmpty("brewery",f.brewery);
  setIfEmpty("prefecture",f.prefecture);

  // 商品個体の情報は今回の写真を優先
  setIfEmpty("product",f.product);
  setIfEmpty("classification",f.classification);
  setIfEmpty("rice",f.ingredients);
  setIfEmpty("riceVariety",f.rice_variety);
  setIfEmpty("polishing",f.polishing_ratio);
  setIfEmpty("alcohol",f.alcohol);
  setIfEmpty("volume",f.volume);
}
async function saveToSharedDictionary(){
  if(!S.currentFrontHash&&!S.currentBackHash)return;
  try{
    const obj={
      user_id:S.user.id,
      front_hash:S.currentFrontHash||null,
      back_hash:S.currentBackHash||null,
      brand_name:$("brand").value.trim(),
      product_name:$("product").value.trim()||null,
      brewery_name:$("brewery").value.trim()||null,
      prefecture:$("prefecture").value.trim()||null,
      classification:$("classification").value.trim()||null,
      ingredients:$("rice").value.trim()||null,
      rice_variety:$("riceVariety")?.value?.trim()||null,
      polishing_ratio:$("polishing").value.trim()||null,
      alcohol:$("alcohol").value.trim()||null,
      volume:$("volume").value.trim()||null
    };
    if(!isUsableMasterBrand(obj.brand_name))return;

    const filters=["user_id=eq."+encodeURIComponent(S.user.id)];
    if(obj.front_hash)filters.push("front_hash=eq."+encodeURIComponent(obj.front_hash));
    if(obj.back_hash)filters.push("back_hash=eq."+encodeURIComponent(obj.back_hash));
    const rows=await select(DICT_TABLE,filters.join("&")+"&order=created_at.desc&limit=5").catch(()=>[]);
    let same=null;
    for(const row of rows){
      const frontOK=!obj.front_hash || row.front_hash===obj.front_hash;
      const backOK=!obj.back_hash || row.back_hash===obj.back_hash;
      if(frontOK&&backOK){same=row;break}
    }
    if(same?.id){
      const copy={...obj}; delete copy.user_id;
      await updateRow(DICT_TABLE,same.id,copy);
    }else{
      await insert(DICT_TABLE,obj);
    }
  }catch(e){
    console.warn("dictionary save skipped",e);
  }
}

const AI_CACHE_PREFIX="sakelog_ai_cache_v1:";
async function sha256Text(text){
  const data=new TextEncoder().encode(text);
  const hash=await crypto.subtle.digest("SHA-256",data);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function buildImageCacheKey(frontData,backData){
  return AI_CACHE_PREFIX + await sha256Text(String(frontData||"")+"|"+String(backData||""));
}
function loadAiCache(key){
  try{
    const raw=localStorage.getItem(key);
    if(!raw)return null;
    const obj=JSON.parse(raw);
    // 30日で自然失効
    if(!obj?.savedAt || Date.now()-obj.savedAt>30*24*60*60*1000){
      localStorage.removeItem(key);
      return null;
    }
    return obj.data||null;
  }catch{return null}
}
function saveAiCache(key,data){
  try{
    localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),data}));
  }catch{}
}

const CONFIRMED_CACHE_PREFIX="sakelog_confirmed_v1:";
function confirmedKey(aiKey){return CONFIRMED_CACHE_PREFIX+String(aiKey||"").replace(AI_CACHE_PREFIX,"")}
function loadConfirmedCache(aiKey){
  try{
    const raw=localStorage.getItem(confirmedKey(aiKey));
    if(!raw)return null;
    const obj=JSON.parse(raw);
    if(!obj?.savedAt || Date.now()-obj.savedAt>365*24*60*60*1000){
      localStorage.removeItem(confirmedKey(aiKey));
      return null;
    }
    return obj.data||null;
  }catch{return null}
}
function saveConfirmedCache(aiKey,data){
  if(!aiKey)return;
  try{localStorage.setItem(confirmedKey(aiKey),JSON.stringify({savedAt:Date.now(),data}))}catch{}
}
function applyConfirmedRecord(rec){
  if(!rec)return;
  $("brand").value=rec.brand||"";
  $("product").value=rec.product||"";
  $("brewery").value=rec.brewery||"";
  $("prefecture").value=rec.prefecture||"";
  $("classification").value=rec.classification||"";
  $("rice").value=rec.ingredients||rec.rice||"";
  if($("riceVariety")) $("riceVariety").value=rec.rice_variety||"";
  $("polishing").value=rec.polishing_ratio||"";
  $("alcohol").value=rec.alcohol||"";
  $("volume").value=rec.volume||"";
}
async function findSupabasePastRecord(facts){
  if(!facts?.brand)return null;
  try{
    let q='select=*&brand_name=eq.'+encodeURIComponent(facts.brand);
    if(facts.product) q+='&product_name=eq.'+encodeURIComponent(facts.product);
    q+='&order=drank_at.desc&limit=1';
    const rows=await select("drinking_records",q);
    return rows?.[0]||null;
  }catch{return null}
}
function mergePastIntoEmptyFields(row){
  if(!row)return;
  const setIfEmpty=(id,v)=>{const el=$(id); if(el && !el.value.trim() && v) el.value=v};
  setIfEmpty("brand",row.brand_name);
  setIfEmpty("product",row.product_name);
  setIfEmpty("brewery",row.brewery_name);
  setIfEmpty("prefecture",row.prefecture);
  setIfEmpty("classification",row.classification);
  setIfEmpty("rice",row.rice);
  setIfEmpty("polishing",row.polishing_ratio);
  setIfEmpty("alcohol",row.alcohol);
  setIfEmpty("volume",row.volume);
}



async function uploadEventPhoto(file,eventId,requestId){
  if(!file||!eventId||!requestId)throw new Error("写真またはイベントが選択されていません");
  const body=await preparePhotoForUpload(file);
  const ext=(body!==file || !/^(image\/jpeg|image\/png|image\/webp)$/i.test(file.type||""))
    ?"jpg"
    :((file.name?.split(".").pop()||"jpg").toLowerCase());
  const path=`${S.user.id}/${eventId}/${requestId}.${ext}`;
  const pending=readLocalOperation(PENDING_EVENT_PHOTO_STATE_KEY);
  if(pending&&pending.requestId===requestId){
    writeLocalOperation(PENDING_EVENT_PHOTO_STATE_KEY,{...pending,storagePath:path});
  }
  const url=BASE+"/storage/v1/object/event-photos/"+encodeURI(path);
  const contentType=body.type||file.type||"image/jpeg";
  const r=await authFetch(url,{
    method:"POST",
    headers:{"Content-Type":contentType,"x-upsert":"true"},
    body
  });
  if(!r.ok){
    const detail=await r.text().catch(()=>"");
    throw new Error("イベント写真保存エラー HTTP "+r.status+(detail?" "+detail:""));
  }
  return path;
}


let eventPhotoUploadBusy=false;
function setEventPhotoUploadDisabled(disabled){
  ["eventPhotoCameraInput","eventPhotoGalleryInput"].forEach(id=>{
    const el=$(id); if(el)el.disabled=disabled;
  });
  document.querySelectorAll('[data-event-photo-pick]').forEach(btn=>{
    btn.disabled=disabled;
    btn.style.opacity=disabled?".55":"";
  });
}

async function addEventPhoto(file){
  const eventId=S.currentEventId;
  if(!eventId||!file||eventPhotoUploadBusy)return;
  if(!requireOnline("現在オフラインです。イベント写真は通信が戻ってから追加してください。"))return;
  eventPhotoUploadBusy=true;
  setEventPhotoUploadDisabled(true);
  const requestId=S.currentEventPhotoRequestId||makeClientRequestId();
  S.currentEventPhotoRequestId=requestId;
  writeLocalOperation(PENDING_EVENT_PHOTO_STATE_KEY,{
    userId:S.user.id,
    requestId,
    eventId,
    storagePath:null,
    startedAt:Date.now()
  });
  try{
    msg($("eventPhotoMsg"),"写真を送信しています…","info");
    const path=await uploadEventPhoto(file,eventId,requestId);
    try{
      await idempotentInsert("event_photos",{
        event_id:eventId,
        user_id:S.user.id,
        client_request_id:requestId,
        storage_path:path,
        caption:($("eventPhotoCaption")?.value||"").trim()||null,
        moderation_status:"pending",
        face_review_status:"not_checked",
        is_public:false,
        audience:"event_members",
        face_policy:"review_for_public",
        uploaded_by_participant:true
      },"user_id,client_request_id");
    }catch(e){
      try{await deleteStorageObjectFromBucket("event-photos",path)}catch{}
      throw e;
    }
    msg(
      $("eventPhotoMsg"),
      "📷 写真を追加しました。まずイベント参加者内だけで共有され、一般公開は確認後に行われます。",
      "ok"
    );
    if($("eventPhotoCaption")) $("eventPhotoCaption").value="";
    clearLocalOperation(PENDING_EVENT_PHOTO_STATE_KEY);
    S.currentEventPhotoRequestId=null;
    setTimeout(()=>openEventDetail(eventId),700);
  }catch(e){
    const pending=readLocalOperation(PENDING_EVENT_PHOTO_STATE_KEY);
    if(pending?.storagePath){
      try{await deleteStorageObjectFromBucket("event-photos",pending.storagePath)}catch{}
    }
    clearLocalOperation(PENDING_EVENT_PHOTO_STATE_KEY);
    S.currentEventPhotoRequestId=null;
    msg($("eventPhotoMsg"),"写真を追加できませんでした："+(e.message||e),"err");
  }finally{
    eventPhotoUploadBusy=false;
    setEventPhotoUploadDisabled(false);
    if($("eventPhotoCameraInput"))$("eventPhotoCameraInput").value="";
    if($("eventPhotoGalleryInput"))$("eventPhotoGalleryInput").value="";
  }
}

function wireEventPhotoInputs(){
  if($("eventPhotoCameraInput")){
    $("eventPhotoCameraInput").onchange=e=>{
      const f=e.target.files?.[0];
      if(f)addEventPhoto(f);
    };
  }
  if($("eventPhotoGalleryInput")){
    $("eventPhotoGalleryInput").onchange=e=>{
      const f=e.target.files?.[0];
      if(f)addEventPhoto(f);
    };
  }
}




async function loadProfileEventStats(){
  const box=$("profileEventStats");
  if(!box||!S.user)return;
  box.innerHTML="読み込み中…";
  try{
    const rows=await rpc("my_event_activity_stats",{});
    const s=Array.isArray(rows)?rows[0]:rows;
    if(!s){
      box.innerHTML='<div class="small">まだイベント記録はありません。</div>';
      return;
    }
    box.innerHTML=`
      <div class="stats-grid" style="margin-top:10px">
        <div class="stat-card"><b>これから行く</b><strong>${Number(s.planned_events||0)}</strong><span class="small"> 件</span></div>
        <div class="stat-card"><b>行ったイベント</b><strong>${Number(s.attended_events||0)}</strong><span class="small"> 件</span></div>
        <div class="stat-card"><b>イベントで飲んだ酒</b><strong>${Number(s.event_drink_logs||0)}</strong><span class="small"> 本</span></div>
        <div class="stat-card"><b>残した思い出写真</b><strong>${Number(s.event_photos||0)}</strong><span class="small"> 枚</span></div>
      </div>
      <div class="small" style="margin-top:8px">イベントに行くほど、ここに自分だけの日本酒の旅が積み重なります。</div>
    `;
  }catch(e){
    console.warn("profile event stats failed",e);
    box.innerHTML='<div class="small">イベント記録を読み込めませんでした。</div>';
  }
}



async function loadProfileEventDiscoveries(){
  const box=$("profileEventDiscoveries");
  if(!box||!S.user)return;
  box.innerHTML="読み込み中…";
  try{
    const data=await rpc("my_event_discovery_stats",{});
    const s=Array.isArray(data)?data[0]:data;
    const latest=Array.isArray(s?.latest_discoveries)?s.latest_discoveries:[];
    box.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">
        <div style="padding:12px;border-radius:14px;background:#fffaf4">
          <div class="small">イベントで初めて出会った酒</div>
          <div style="font-size:27px;font-weight:900">${Number(s?.new_sakes_discovered||0)} <span class="small">本</span></div>
        </div>
        <div style="padding:12px;border-radius:14px;background:#f3f7f4">
          <div class="small">イベントで初めて出会った蔵</div>
          <div style="font-size:27px;font-weight:900">${Number(s?.new_breweries_discovered||0)} <span class="small">蔵</span></div>
        </div>
      </div>
      ${latest.length?`
        <div style="margin-top:14px"><b>最近の出会い</b></div>
        ${latest.map(x=>`
          <button class="btn outline" style="text-align:left;margin-top:7px" onclick="openRecordDetail('${escapeHtml(x.id)}')">
            <b>${escapeHtml([x.brand_name,x.product_name].filter(Boolean).join(" ")||"名称未登録")}</b><br>
            <span class="small">${escapeHtml(x.brewery_name||"")}</span>
          </button>
        `).join("")}
      `:'<div class="small" style="margin-top:9px">イベントで新しい一杯をLOGすると、ここに「出会い」が残ります。</div>'}
    `;
  }catch(e){
    console.warn("event discovery stats failed",e);
    box.innerHTML='<div class="small">イベントでの出会いを読み込めませんでした。</div>';
  }
}

async function loadProfileEventYearReview(){
  const box=$("profileEventYearReview");
  if(!box||!S.user)return;
  box.innerHTML="読み込み中…";
  try{
    const year=new Date().getFullYear();
    const data=await rpc("my_event_year_review",{p_year:year});
    const s=Array.isArray(data)?data[0]:data;
    const topSakes=Array.isArray(s?.top_sakes)?s.top_sakes:[];
    box.innerHTML=`
      <div class="small">${year}年の和酒ログ</div>
      <div style="margin-top:10px;padding:12px;border-radius:14px;background:#fffaf4">
        <b>行ったイベント</b>
        <div style="font-size:26px;font-weight:900;margin-top:2px">${Number(s?.attended_event_count||0)} <span class="small">件</span></div>
        ${s?.top_prefecture?`<div class="small" style="margin-top:6px">いちばん足を運んだ地域：<b>${escapeHtml(s.top_prefecture)}</b>（${Number(s.top_prefecture_event_count||0)}件）</div>`:""}
      </div>
      <div style="margin-top:14px"><b>イベントで出会った酒 ベスト3</b></div>
      ${topSakes.length?topSakes.map((x,i)=>`
        <button class="btn outline" style="text-align:left;margin-top:8px" onclick="openRecordDetail('${escapeHtml(x.record_id)}')">
          <b>${i+1}. ${escapeHtml([x.brand_name,x.product_name].filter(Boolean).join(" ")||"名称未登録")}</b><br>
          <span class="small">${escapeHtml(x.brewery_name||"")}${x.rating!=null?" ／ ★ "+Number(x.rating).toFixed(1):""}</span>
          ${x.event_title?`<br><span class="small">${escapeHtml(x.event_title)}</span>`:""}
        </button>
      `).join(""):'<div class="small" style="margin-top:7px">イベントで飲んだ酒をLOGすると、ここにベスト3が育っていきます。</div>'}
    `;
  }catch(e){
    console.warn("profile event year review failed",e);
    box.innerHTML='<div class="small">今年の振り返りを読み込めませんでした。</div>';
  }
}


async function requestMyEventPhotoDeletion(photoId){
  if(!requireOnline("現在オフラインです。削除依頼は通信が戻ってから送信してください。"))return;
  const reason=prompt("削除理由（任意）","");
  if(reason===null)return;
  const ok=confirm("この写真の削除を依頼しますか？\n一般公開中の場合は、依頼と同時に公開停止されます。");
  if(!ok)return;
  try{
    await rpc("request_event_photo_deletion",{
      p_photo_id:photoId,
      p_reason:reason.trim()||null
    });
    alert("削除依頼を受け付けました。公開中の写真は公開停止されています。");
    await loadProfileEventPhotos();
  }catch(e){
    alert("削除依頼を送れませんでした。\n\n"+(e.message||e));
  }
}

function eventPhotoStatusLabel(p){
  if(p.deletion_requested_at)return "削除依頼中";
  if(p.is_public && p.audience==="public" && p.moderation_status==="approved")return "一般公開中";
  if(p.moderation_status==="approved" && p.audience==="event_members")return "参加者内のみ";
  if(p.moderation_status==="rejected")return "非承認";
  if(p.moderation_status==="hold")return "確認中";
  return "確認待ち";
}

async function loadProfileEventPhotos(){
  const box=$("profileEventPhotos");
  if(!box||!S.user)return;
  box.innerHTML="読み込み中…";
  try{
    const rows=await select(
      "event_photos",
      "select=id,event_id,storage_path,caption,moderation_status,face_review_status,is_public,audience,created_at,deletion_requested_at,deletion_request_reason"+
      "&user_id=eq."+encodeURIComponent(S.user.id)+
      "&order=created_at.desc&limit=50"
    );

    if(!rows.length){
      box.innerHTML='<div class="small">まだイベント写真はありません。</div>';
      return;
    }

    const items=[];
    for(const p of rows){
      const url=await createSignedStorageUrl("event-photos",p.storage_path,1800);
      items.push({...p,url});
    }

    box.innerHTML=`
      <div class="small" style="margin-bottom:8px">自分が投稿した写真だけ表示しています。公開状態の確認と削除依頼ができます。</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
        ${items.map(p=>`
          <div style="border:1px solid #e1e7e3;border-radius:14px;padding:9px;background:#fff">
            ${p.url?`<img src="${escapeHtml(p.url)}" alt="" style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:9px;background:#eee">`:"<div class='small'>画像を表示できません</div>"}
            <div class="small" style="margin-top:7px;line-height:1.55">
              <b>${escapeHtml(eventPhotoStatusLabel(p))}</b><br>
              ${p.caption?escapeHtml(p.caption):"ひとことなし"}
              ${p.face_review_status && p.face_review_status!=="not_checked"?"<br>顔確認："+escapeHtml(p.face_review_status):""}
            </div>
            ${p.deletion_requested_at
              ?'<div class="small" style="margin-top:7px;color:#a22">削除依頼を受け付けています。</div>'
              :`<button class="btn outline" style="padding:8px 10px;font-size:12px;margin-top:7px;border-color:#c66;color:#a22" onclick="requestMyEventPhotoDeletion('${escapeHtml(p.id)}')">削除を依頼</button>`}
          </div>
        `).join("")}
      </div>
    `;
  }catch(e){
    console.warn("profile event photos failed",e);
    box.innerHTML='<div class="small">イベント写真を読み込めませんでした。</div>';
  }
}

async function loadProfileEventHistory(){
  const box=$("profileEventHistory");
  if(!box||!S.user)return;
  box.innerHTML="読み込み中…";
  try{
    const parts=await select(
      "event_participations",
      "select=event_id,status,created_at,updated_at&user_id=eq."+encodeURIComponent(S.user.id)+
      "&order=created_at.desc&limit=100"
    );

    if(!parts.length){
      box.innerHTML='<div class="small">イベントの予定・参加履歴はまだありません。</div>';
      return;
    }

    const rows=[];
    for(const p of parts){
      const events=await select(
        "events",
        "select=id,title,starts_at,ends_at,venue_name,prefecture,city,official_url,reservation_required"+
        "&id=eq."+encodeURIComponent(p.event_id)+"&limit=1"
      );
      const e=events?.[0];
      if(e)rows.push({...e,participation_status:p.status,joined_at:p.created_at});
    }

    const now=new Date();
    const upcoming=[];
    const past=[];

    for(const e of rows){
      const end=e.ends_at?new Date(e.ends_at):new Date(e.starts_at);
      const isPast=end<now || ["checked_in","attended"].includes(e.participation_status);
      (isPast?past:upcoming).push(e);
    }

    upcoming.sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
    past.sort((a,b)=>new Date(b.starts_at)-new Date(a.starts_at));

    const renderEventRow=(e,isPast)=>{
      const place=[e.prefecture,e.city,e.venue_name].filter(Boolean).join(" ");
      const status=isPast
        ? (e.participation_status==="attended"?"参加済み":e.participation_status==="checked_in"?"参加記録あり":"過去の予定")
        : "参加予定";
      return `
        <button class="btn outline" style="text-align:left;margin-top:8px" onclick="openEventDetail('${escapeHtml(e.id)}')">
          <b>${escapeHtml(e.title||"イベント")}</b><br>
          <span class="small">${escapeHtml(formatDateJP(e.starts_at))}${place?" ／ "+escapeHtml(place):""}</span><br>
          <span class="small">${escapeHtml(status)}${e.reservation_required&&!isPast?" ／ 公式申込・予約を確認":""}</span>
        </button>
      `;
    };

    box.innerHTML=
      '<div style="margin-top:8px"><b>これから行く</b></div>'+
      (upcoming.length?upcoming.map(e=>renderEventRow(e,false)).join(""):'<div class="small" style="margin-top:6px">予定はありません。</div>')+
      '<div style="margin-top:18px"><b>行ったイベント</b></div>'+
      (past.length?past.map(e=>renderEventRow(e,true)).join(""):'<div class="small" style="margin-top:6px">参加履歴はまだありません。</div>');
  }catch(e){
    console.warn("profile event history failed",e);
    box.innerHTML='<div class="small">イベント履歴を読み込めませんでした。</div>';
  }
}

async function loadMyUpcomingEventList(){
  const box=$("upcomingEventList");
  if(!box||!S.user)return;
  box.innerHTML="読み込み中…";
  try{
    const parts=await select(
      "event_participations",
      "select=event_id,status&user_id=eq."+encodeURIComponent(S.user.id)+
      "&status=in.(going,checked_in,attended)&order=created_at.desc&limit=20"
    );
    if(!parts.length){
      box.innerHTML='<div class="small">参加予定はまだありません。</div>';
      return;
    }

    const rows=[];
    for(const p of parts){
      const events=await select(
        "events",
        "select=id,title,starts_at,ends_at,venue_name,prefecture,city,official_url,reservation_required"+
        "&id=eq."+encodeURIComponent(p.event_id)+"&limit=1"
      );
      const e=events?.[0];
      if(!e)continue;
      const end=e.ends_at?new Date(e.ends_at):new Date(e.starts_at);
      if(end<new Date() && p.status==="going")continue;
      rows.push({...e,participation_status:p.status});
    }

    rows.sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
    if(!rows.length){
      box.innerHTML='<div class="small">これから参加予定のイベントはありません。</div>';
      return;
    }

    box.innerHTML=rows.map(e=>{
      const place=[e.prefecture,e.city,e.venue_name].filter(Boolean).join(" ");
      const status=e.participation_status==="going"?"参加予定":e.participation_status==="checked_in"?"参加中":"参加済み";
      return `
        <button class="btn outline" style="text-align:left;margin-top:8px" onclick="openEventDetail('${escapeHtml(e.id)}')">
          <b>${escapeHtml(e.title||"イベント")}</b><br>
          <span class="small">${escapeHtml(formatDateJP(e.starts_at))}${place?" ／ "+escapeHtml(place):""}</span><br>
          <span class="small">和酒ログ：${escapeHtml(status)}${e.reservation_required?" ／ 公式申込・予約を確認":" "}</span>
        </button>
      `;
    }).join("");
  }catch(e){
    console.warn("upcoming event list failed",e);
    box.innerHTML='<div class="small">参加予定を読み込めませんでした。</div>';
  }
}

async function loadPublishedEvents(){
  try{
    return await select(
      "events",
      "select=id,title,starts_at,ends_at,venue_name,prefecture,city,organizer_display_name,official_url,fee_note,reservation_required&status=eq.published&approval_status=eq.approved&visibility=eq.public&order=starts_at.asc&limit=50"
    );
  }catch(e){
    console.warn("event load failed",e);
    return [];
  }
}


async function editMyEventPhotoCaption(photoId,currentCaption){
  const next=prompt("写真のひとことを編集",currentCaption||"");
  if(next===null)return;
  try{
    await updateRow("event_photos",photoId,{caption:next.trim()||null});
    await openEventDetail(S.currentEventId);
  }catch(e){
    alert("コメントを更新できませんでした。\n\n"+(e.message||e));
  }
}

async function showEvents(){
  syncActiveNav("homeView");
  show("eventView");
  $("eventBody").innerHTML="<p>イベントを読み込んでいます...</p>";
  const rows=(await loadPublishedEvents()).filter(e=>!e.ends_at || new Date(e.ends_at)>=new Date());
  if(!rows.length){
    $("eventBody").innerHTML="<h2>📅 日本酒イベント</h2><p class='small'>現在、公開中のイベント情報はありません。</p>";
    return;
  }
  $("eventBody").innerHTML="<h2>📅 日本酒イベント</h2>"+
    rows.map(e=>{
      const place=[e.prefecture,e.city,e.venue_name].filter(Boolean).join(" ");
      return `
        <button class="btn outline" style="text-align:left;margin-top:10px" onclick="openEventDetail('${escapeHtml(e.id)}')">
          <b>${escapeHtml(e.title||"イベント")}</b><br>
          <span class="small">${escapeHtml(formatDateJP(e.starts_at))}${place?" ／ "+escapeHtml(place):""}</span>
        </button>
      `;
    }).join("");
}



async function createSignedStorageUrl(bucket,path,expiresIn=1800){
  if(!path)return null;
  try{
    const r=await authFetch(
      BASE+"/storage/v1/object/sign/"+encodeURIComponent(bucket)+"/"+encodeURI(path),
      {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({expiresIn})
      }
    );
    const d=await r.json().catch(()=>null);
    if(!r.ok)throw new Error((d&&d.message)||"HTTP "+r.status);
    const signed=d?.signedURL||d?.signedUrl||d?.signed_url;
    if(!signed)return null;
    return /^https?:\/\//i.test(signed)?signed:BASE+"/storage/v1"+signed;
  }catch(e){
    console.warn("signed storage url skipped",e);
    return null;
  }
}


async function loadCurrentEventPhotos(eventId,limit=18){
  if(!eventId)return [];
  try{
    const rows=await select(
      "event_photos",
      "select=id,storage_path,caption,created_at,user_id,audience,is_public,moderation_status,face_review_status"+
      "&event_id=eq."+encodeURIComponent(eventId)+
      "&order=created_at.desc&limit="+Math.max(1,Math.min(limit,30))
    );
    const out=[];
    for(const row of rows||[]){
      const url=await createSignedStorageUrl("event-photos",row.storage_path,1800);
      if(url)out.push({...row,url});
    }
    return out;
  }catch(e){
    console.warn("current event photo load skipped",e);
    return [];
  }
}

function renderCurrentEventPhotos(items){
  if(!items?.length){
    return '<div class="small" style="margin-top:8px">まだ写真はありません。最初の1枚を残してみませんか。</div>';
  }
  return `
    <div style="margin-top:12px">
      <div class="small" style="font-weight:800;margin-bottom:8px">みんなの思い出</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px">
        ${items.map(p=>`
          <figure style="margin:0">
            <img
              src="${escapeHtml(p.url)}"
              alt="${escapeHtml(p.caption||"イベント写真")}"
              loading="lazy"
              style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:10px;background:#eee"
            >
            ${p.caption?`<figcaption class="small" style="margin-top:3px;line-height:1.35">${escapeHtml(p.caption)}</figcaption>`:""}
            ${p.user_id===S.user?.id?`<button type="button" class="btn outline" style="padding:6px 8px;font-size:11px;margin-top:4px" onclick='editMyEventPhotoCaption(${JSON.stringify(p.id)}, ${JSON.stringify(p.caption||"")})'>ひとこと編集</button>`:""}
          </figure>
        `).join("")}
      </div>
    </div>
  `;
}

async function loadPreviousEventPublicPhotos(previousEventId,limit=6){
  if(!previousEventId)return [];
  try{
    const rows=await select(
      "event_photos",
      "select=id,storage_path,caption,created_at&event_id=eq."+encodeURIComponent(previousEventId)+
      "&audience=eq.public&is_public=eq.true&moderation_status=eq.approved"+
      "&face_review_status=in.(no_face,processed)&order=created_at.desc&limit="+Math.max(1,Math.min(limit,12))
    );
    const out=[];
    for(const row of rows||[]){
      const url=await createSignedStorageUrl("event-photos",row.storage_path,1800);
      if(url)out.push({...row,url});
    }
    return out;
  }catch(e){
    console.warn("previous event photo load skipped",e);
    return [];
  }
}

function renderPreviousEventPhotos(items){
  if(!items?.length)return "";
  return `
    <div style="margin-top:12px">
      <div class="small" style="font-weight:800;margin-bottom:8px">📷 去年の写真</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px">
        ${items.slice(0,6).map(p=>`
          <figure style="margin:0">
            <img
              src="${escapeHtml(p.url)}"
              alt="${escapeHtml(p.caption||"去年のイベント写真")}"
              loading="lazy"
              style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:10px;background:#eee"
            >
            ${p.caption?`<figcaption class="small" style="margin-top:3px;line-height:1.35">${escapeHtml(p.caption)}</figcaption>`:""}
          </figure>
        `).join("")}
      </div>
    </div>
  `;
}


async function loadMyEventDrinkSummary(eventId){
  try{
    const rows=await rpc("my_event_drink_summary",{p_event_id:eventId});
    const out=[];
    for(const row of Array.isArray(rows)?rows:[]){
      let photoUrl=null;
      if(row.front_photo_path){
        photoUrl=await createSignedStorageUrl("sake-photos",row.front_photo_path,1800);
      }
      out.push({...row,photoUrl});
    }
    return out;
  }catch(e){
    console.warn("event drink summary lookup skipped",e);
    return [];
  }
}

function renderMyEventDrinkSummary(items){
  if(!items?.length)return "";
  const avg=items.reduce((s,x)=>s+Number(x.rating||0),0)/items.length;
  const top=[...items].sort((a,b)=>Number(b.rating||0)-Number(a.rating||0))[0];
  return `
    <div style="margin-top:20px;padding:14px;border:1px solid #e1e7e3;border-radius:16px;background:#f7f9f7">
      <div class="small" style="font-weight:800;color:#238464">あなたのこの日のLOG</div>
      <h3 style="margin:5px 0 8px">${items.length}本を飲みました 🍶</h3>
      <div class="small" style="margin-bottom:10px">
        平均評価 ${avg.toFixed(1)}
        ${top? " ／ 一番高かった一杯："+escapeHtml([top.brand_name,top.product_name].filter(Boolean).join(" ")) : ""}
      </div>
      <div style="display:grid;gap:10px">
        ${items.map(x=>`
          <button class="btn outline" style="text-align:left;display:grid;grid-template-columns:${x.photoUrl?"64px ":""}1fr;gap:10px;align-items:center;margin:0" onclick="openRecordDetail('${escapeHtml(x.record_id)}')">
            ${x.photoUrl?`<img src="${escapeHtml(x.photoUrl)}" alt="" style="width:64px;height:78px;object-fit:cover;border-radius:9px;background:#eee">`:""}
            <span>
              <b>${escapeHtml([x.brand_name,x.product_name].filter(Boolean).join(" ")||"名称未登録")}</b><br>
              <span class="small">${escapeHtml(x.brewery_name||"")}${x.rating?" ／ "+escapeHtml(stars(x.rating))+" "+Number(x.rating).toFixed(1):""}</span>
              ${x.comment?`<br><span class="small">${escapeHtml(x.comment)}</span>`:""}
            </span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

async function loadPreviousEventMemory(eventId){
  try{
    const rows=await rpc("previous_event_memory_summary",{p_event_id:eventId});
    return Array.isArray(rows)&&rows.length?rows[0]:null;
  }catch(e){
    console.warn("previous event memory lookup skipped",e);
    return null;
  }
}

function renderPreviousEventMemory(memory){
  if(!memory)return "";
  const place=[memory.previous_prefecture,memory.previous_city,memory.previous_venue_name].filter(Boolean).join(" ");
  return `
    <div style="margin-top:20px;padding:14px;border:1px solid #e1e7e3;border-radius:16px;background:#fffaf4">
      <div class="small" style="font-weight:800;color:#8a5f3c">去年の様子</div>
      <h3 style="margin:5px 0 8px">${escapeHtml(memory.previous_title||"前回開催")}</h3>
      <div class="small" style="line-height:1.75">
        ${escapeHtml(formatDateJP(memory.previous_starts_at))}
        ${place?"<br>"+escapeHtml(place):""}
        <br>参加蔵：${Number(memory.brewery_count||0)}蔵
        ／ 出品酒：${Number(memory.sake_count||0)}本
        ${Number(memory.public_photo_count||0)>0?"<br>公開写真："+Number(memory.public_photo_count)+"枚":""}
        ${Number(memory.my_log_count||0)>0
          ?"<br><b>あなたは去年このイベントで "+Number(memory.my_log_count)+"本 LOGしています 🍶</b>"
          :""}
      </div>
      <button class="btn outline" style="margin-top:10px" onclick="openEventDetail('${escapeHtml(memory.previous_event_id)}')">
        去年のイベントを見る
      </button>
    </div>
  `;
}


async function loadMyEventParticipation(eventId){
  try{
    const rows=await select(
      "event_participations",
      "select=id,status,created_at,updated_at&event_id=eq."+encodeURIComponent(eventId)+
      "&user_id=eq."+encodeURIComponent(S.user.id)+"&limit=1"
    );
    return rows?.[0]||null;
  }catch(e){
    console.warn("participation lookup failed",e);
    return null;
  }
}



const eventActionLocks=new Set();

function lockEventAction(key){
  if(eventActionLocks.has(key))return false;
  eventActionLocks.add(key);
  return true;
}
function unlockEventAction(key){ eventActionLocks.delete(key); }

function setEventActionButtonsDisabled(eventId,disabled){
  document.querySelectorAll('[data-event-action="'+CSS.escape(String(eventId))+'"]').forEach(btn=>{
    btn.disabled=disabled;
    btn.style.opacity=disabled?".55":"";
    btn.style.pointerEvents=disabled?"none":"";
  });
}

async function checkInCurrentEvent(eventId){
  if(!requireOnline("現在オフラインです。参加記録は通信が戻ってから残してください。"))return;
  const key="checkin:"+eventId;
  if(!lockEventAction(key))return;
  setEventActionButtonsDisabled(eventId,true);
  try{
    const rows=await rpc("check_in_event",{p_event_id:eventId});
    const result=Array.isArray(rows)?rows[0]:rows;
    alert("和酒ログに参加記録を残しました。\n※主催者側の受付・入場チェックインとは連動していません。");
    await openEventDetail(eventId);
    await loadMyUpcomingEventList().catch(()=>{});
    await loadProfileEventHistory().catch(()=>{});
  }catch(e){
    const t=String(e.message||e);
    if(/only available around the event date/i.test(t)){
      alert("参加記録は、イベント開催日前後に残せます。");
    }else{
      alert("参加記録を残せませんでした。\n\n"+t);
    }
  }finally{
    unlockEventAction(key);
    setEventActionButtonsDisabled(eventId,false);
  }
}

function canShowEventCheckIn(e){
  try{
    const now=Date.now();
    const start=new Date(e.starts_at).getTime()-6*60*60*1000;
    const end=new Date(e.ends_at||e.starts_at).getTime()+12*60*60*1000;
    return now>=start && now<=end;
  }catch{return false}
}

async function joinCurrentEvent(eventId){
  if(!requireOnline("現在オフラインです。参加予定への追加は通信が戻ってから行ってください。"))return;
  const key="join:"+eventId;
  if(!lockEventAction(key))return;
  setEventActionButtonsDisabled(eventId,true);
  try{
    const rows=await rpc("join_event",{p_event_id:eventId});
    const result=Array.isArray(rows)?rows[0]:rows;
    alert(result?.capacity
      ? "和酒ログの参加予定に追加しました。\n※公式サイト・主催者への申込は別途必要です。\n現在 "+Number(result.going_count||0)+" / "+Number(result.capacity)+"人"
      : "和酒ログの参加予定に追加しました。\n※これは公式申込ではありません。");
    await openEventDetail(eventId);
  }catch(e){
    const t=String(e.message||e);
    if(/full/i.test(t)) alert("このイベントは定員に達しています。");
    else if(/does not accept|no_application|invite/i.test(t)) alert("このイベントはアプリ内から参加申込できません。公式案内をご確認ください。");
    else alert("参加予定に追加できませんでした。\n\n"+t);
  }finally{
    unlockEventAction(key);
    setEventActionButtonsDisabled(eventId,false);
  }
}

async function leaveCurrentEvent(eventId){
  if(!requireOnline("現在オフラインです。参加予定の変更は通信が戻ってから行ってください。"))return;
  const ok=confirm("参加予定から外しますか？");
  if(!ok)return;
  const key="leave:"+eventId;
  if(!lockEventAction(key))return;
  setEventActionButtonsDisabled(eventId,true);
  try{
    await rpc("leave_event",{p_event_id:eventId});
    await openEventDetail(eventId);
  }catch(e){
    alert("参加予定を変更できませんでした。\n\n"+(e.message||e));
  }finally{
    unlockEventAction(key);
    setEventActionButtonsDisabled(eventId,false);
  }
}

function renderEventParticipation(e,myParticipation){
  if(e.participation_type==="no_application"){
    return '<div class="small" style="margin-top:10px">このイベントはアプリ内申込の対象外です。公式情報をご確認ください。</div>';
  }
  if(e.participation_type==="invite_only"){
    return '<div class="small" style="margin-top:10px">このイベントは招待制です。</div>';
  }
  if(myParticipation){
    const checked=["checked_in","attended"].includes(myParticipation.status);
    return `
      <div style="margin-top:12px;padding:12px;border-radius:14px;background:#edf5f1">
        <b>${checked?"✓ 和酒ログに参加記録があります":"✓ 和酒ログの参加予定に入っています"}</b>
        <div class="small" style="margin-top:4px">これは和酒ログ内の記録です。公式サイト・主催者への申込、受付、入場チェックインとは連動していません。</div>
        <div class="small" style="margin-top:4px">当日はここからお酒をLOGしたり、写真を残せます。</div>
        ${!checked&&canShowEventCheckIn(e)?`
          <button class="btn secondary" style="margin-top:8px" data-event-action="${escapeHtml(e.id)}" onclick="checkInCurrentEvent('${escapeHtml(e.id)}')">📍 和酒ログに参加記録を残す</button>
          <div class="small" style="margin-top:4px">※主催者側の受付・入場処理ではありません。</div>
        `:""}
        ${!checked?`<button class="btn outline" style="margin-top:8px" data-event-action="${escapeHtml(e.id)}" onclick="leaveCurrentEvent('${escapeHtml(e.id)}')">参加予定から外す</button>`:""}
      </div>
    `;
  }
  return `
    <button class="btn primary" style="margin-top:12px" data-event-action="${escapeHtml(e.id)}" onclick="joinCurrentEvent('${escapeHtml(e.id)}')">
      和酒ログの参加予定に追加
    </button>
    <div class="small" style="margin-top:5px">※公式の申込・予約ではありません。</div>
    ${e.reservation_required?'<div class="small" style="margin-top:4px"><b>このイベントは公式側で予約・申込が必要です。</b></div>':""}
    ${e.capacity?'<div class="small" style="margin-top:4px">和酒ログ内の予定登録目安：'+Number(e.capacity)+'人</div>':""}
  `;
}

async function openEventDetail(eventId){
  S.currentEventId=eventId;
  show("eventView");
  $("eventBody").innerHTML="<p>イベント詳細を読み込んでいます...</p>";
  try{
    const events=await select("events","select=*&id=eq."+encodeURIComponent(eventId)+"&limit=1");
    const e=events?.[0];
    if(!e) throw new Error("イベントが見つかりません");

    const myParticipation=await loadMyEventParticipation(eventId);
    const memory=await loadPreviousEventMemory(eventId);
    const previousPhotos=memory?.previous_event_id
      ? await loadPreviousEventPublicPhotos(memory.previous_event_id,6)
      : [];
    const currentPhotos=await loadCurrentEventPhotos(eventId,18);
    const myDrinkSummary=await loadMyEventDrinkSummary(eventId);

    const sakes=await select(
      "event_sakes",
      "select=id,sake_id,brand_name,product_name,brewery_name,classification,serving_note,beverage_category,master_eligible,display_order&event_id=eq."+encodeURIComponent(eventId)+"&order=display_order.asc"
    );

    const official=/^https?:\/\//i.test(e.official_url||"")
      ? `<a href="${escapeHtml(e.official_url)}" target="_blank" rel="noopener noreferrer">公式情報 ↗</a>`
      : "";

    $("eventBody").innerHTML=`
      <h2>${escapeHtml(e.title||"イベント")}</h2>
      <div class="small" style="line-height:1.8">
        ${escapeHtml(formatDateJP(e.starts_at))}
        ${e.venue_name?"<br>"+escapeHtml([e.prefecture,e.city,e.venue_name].filter(Boolean).join(" ")):""}
        ${e.organizer_display_name?"<br>主催："+escapeHtml(e.organizer_display_name):""}
        ${e.fee_note?"<br>料金："+escapeHtml(e.fee_note):""}
        ${e.reservation_required?"<br>予約・事前手続きあり":""}
        ${official?"<br>"+official:""}
      </div>
      ${renderEventParticipation(e,myParticipation)}
      ${renderPreviousEventMemory(memory)}
      ${renderPreviousEventPhotos(previousPhotos)}
      ${renderMyEventDrinkSummary(myDrinkSummary)}
      <div style="margin-top:20px;padding:14px;border:1px solid #e1e7e3;border-radius:16px">
        <h3 style="margin-bottom:6px">📷 このイベントの思い出を残す</h3>
        <div class="small" style="line-height:1.65">参加者の写真はまずイベント内だけで共有します。一般公開されるのは、管理側で確認された写真だけです。</div>
        <label style="margin-top:10px">ひとこと（任意）</label>
        <input id="eventPhotoCaption" maxlength="120" placeholder="例：今年もこのメンバーで乾杯！">
        <div class="grid" style="margin-top:8px">
          <button class="btn outline" data-event-photo-pick type="button" onclick="document.getElementById('eventPhotoCameraInput').click()">📷 撮影する</button>
          <button class="btn outline" data-event-photo-pick type="button" onclick="document.getElementById('eventPhotoGalleryInput').click()">🖼 写真を選ぶ</button>
        </div>
        <div id="eventPhotoMsg"></div>
        ${renderCurrentEventPhotos(currentPhotos)}
      </div>
      <h3 style="margin-top:20px">このイベントで飲めるお酒</h3>
      ${sakes.length?sakes.map(s=>`
        <div style="padding:12px 0;border-bottom:1px solid #eee">
          <b>${escapeHtml([s.brand_name,s.product_name].filter(Boolean).join(" "))}</b><br>
          <span class="small">${escapeHtml(s.brewery_name||"")}${s.classification?" ／ "+escapeHtml(s.classification):""}${s.serving_note?" ／ "+escapeHtml(s.serving_note):""}</span>
          ${s.master_eligible? `
            <button class="btn secondary" style="margin-top:8px" onclick="logEventSake('${escapeHtml(eventId)}','${escapeHtml(s.id)}','${escapeHtml(s.sake_id||"")}')">🍶 この一杯をLOG</button>
          `:"<div class='small' style='margin-top:6px'>イベント出品情報として掲載</div>"}
        </div>
      `).join(""):"<p class='small'>出品酒情報は準備中です。</p>"}
    `;
  }catch(e){
    $("eventBody").innerHTML="<p>取得エラー："+escapeHtml(e.message)+"</p>";
  }
}

async function logEventSake(eventId,eventSakeId,sakeId){
  try{
    const rows=await select(
      "event_sakes",
      "select=brand_name,product_name,brewery_name,classification,sake_id&event_id=eq."+encodeURIComponent(eventId)+"&id=eq."+encodeURIComponent(eventSakeId)+"&limit=1"
    );
    const s=rows?.[0];
    if(!s) throw new Error("出品酒が見つかりません");

    resetRecord();
    S.currentEventId=eventId;
    S.currentEventSakeId=eventSakeId;
    S.currentSakeId=s.sake_id||sakeId||null;

    $("brand").value=s.brand_name||"";
    $("product").value=s.product_name||"";
    $("brewery").value=s.brewery_name||"";
    $("classification").value=s.classification||"";
    msg($("recordMsg"),"📅 イベントの出品酒から記録を開始しました。写真を追加しても、そのままLOGしてもOKです。","info");
    saveRecordDraft();
  }catch(e){
    alert("イベントから記録を開始できませんでした。\n\n"+e.message);
  }
}

if($("eventsBtn")) $("eventsBtn").onclick=showEvents;
if($("eventBackBtn")) $("eventBackBtn").onclick=()=>{
  show("homeView");
  loadMyUpcomingEventList().catch(()=>{});
};
wireEventPhotoInputs();

$("analyzeBtn").onclick=async()=>{
 syncActiveNav("recordView");
 $("analyzeBtn").disabled=true;
 msg($("analysisMsg"),"📚 共有辞書 → 確定済み記録 → AIキャッシュ → AI解析の順で探します…","info");
 try{
   const frontData=S.photo?await fileToDataURL(S.photo,"front"):null;
   const backData=S.backPhoto?await fileToDataURL(S.backPhoto,"back"):null;
   if(!frontData&&!backData) throw new Error("ラベル写真を選択してください");
   const cacheKey=await buildImageCacheKey(frontData,backData);
   S.currentImageCacheKey=cacheKey;
   S.currentFrontHash=await imageDHash(frontData);
   S.currentBackHash=backData?await imageDHash(backData):null;

   // 0. 酒ログ共有辞書。高い画像類似度のときだけAI不要で採用。
   let swDict=[];
   const dict=await lookupSharedDictionary(S.currentFrontHash,S.currentBackHash);
   if(dict){
     applyDictionaryRow(dict.row);
     S.recognition={
       label_facts:dictionaryRecordToFacts(dict.row),
       candidates:[{
         brand:dict.row.brand_name||"",product:dict.row.product_name||"",
         brewery:dict.row.brewery_name||"",prefecture:dict.row.prefecture||"",
         classification:dict.row.classification||"",
         confidence:dict.sim.score,web_verified:false,
         reason:"酒ログ共有辞書の画像類似候補"
       }],
       web_sources:[],dictionary_hit:true
     };
     renderCandidates(S.recognition.candidates);
     swDict=await matchSakenowaFacts(dictionaryRecordToFacts(dict.row));
     renderSakenowaMatches(swDict);
     msg($("analysisMsg"),
       `📚 酒ログ共有辞書から候補を見つけました（画像一致度 ${Math.round(dict.sim.score*100)}%）。候補を確認しています…`,
       "ok");
   }

   // 1. この端末でユーザーが以前「保存」まで確定した同じ写真
   const confirmed=loadConfirmedCache(cacheKey);
   if(confirmed){
     applyConfirmedRecord(confirmed);
     S.recognition=confirmed.recognition||null;
     renderCandidates(S.recognition?.candidates||[]);
     msg($("analysisMsg"),"✅ 同じ写真の「確定済み記録」を再利用しました。AIは使っていません。","ok");
   }

   // 確定済み記録は最優先。完全一致ならAIを使わない。
   if(confirmed){
     return;
   }

   // 共有辞書は厳しい画像類似度を通過した候補だけ。見つかったらAIを使わない。
   if(dict){
     msg($("analysisMsg"),
       `📚 酒ログ共有辞書から候補を見つけました（画像一致度 ${Math.round(dict.sim.score*100)}%）。AIは使っていません。${swDict[0]&&swDict[0].score>=.72?" さけのわ銘柄DBでも確認できました。":""} 現物ラベルを確認して保存してください。`,
       "ok");
     return;
   }

   // 2. AI解析済みキャッシュ
   let d=loadAiCache(cacheKey);
   if(d){
     d={...d,cache_hit:true};
   }else{
     // 3. 完全新規だけAI
     msg($("analysisMsg"),"共有辞書に未登録の新しい日本酒です。AIでラベル読取＋Web照合を行っています…","info");
     const body={front:frontData,back:backData};
     const r=await authFetch("/.netlify/functions/recognize-sake",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
     d=await r.json().catch(()=>({}));
     if(!r.ok) throw new Error(d.error||"AI解析 HTTP "+r.status);
     saveAiCache(cacheKey,d);
   }

   const masterMatches=await matchWashuMasterFacts(d.label_facts||{});
   d={...d,candidates:mergeRecognitionCandidates(d.candidates||[],masterMatches)};
   S.recognition=d;
   renderCandidates(d.candidates||[]);
   const top=(d.candidates||[])[0];
   if(top?.sake_id){
     const upcomingEvents=await loadUpcomingEventsForSake(top.sake_id);
     renderUpcomingEventsForSake(upcomingEvents);
   }else{
     renderUpcomingEventsForSake([]);
   }
   if(top){
     if(!confirmed){
  applyCandidate(top);
}else{
  const setAiIfEmpty=(id,v)=>{
    const el=$(id);
    if(el && !el.value.trim() && v) el.value=v;
  };
  setAiIfEmpty("brand",top.brand);
  setAiIfEmpty("product",top.product);
  setAiIfEmpty("brewery",top.brewery);
  setAiIfEmpty("prefecture",top.prefecture);
  setAiIfEmpty("classification",top.classification);
  setAiIfEmpty("rice",top.ingredients);
  setAiIfEmpty("riceVariety",top.rice_variety);
  setAiIfEmpty("polishing",top.polishing_ratio);
  setAiIfEmpty("alcohol",top.alcohol);
  setAiIfEmpty("volume",top.volume);
}
   }else{
     const f=d.label_facts||{};
     $("brand").value=f.brand||"";
     $("product").value=f.product||"";
     $("brewery").value=f.brewery||"";
     $("prefecture").value=f.prefecture||"";
     $("classification").value=f.classification||"";
     $("rice").value=f.ingredients||"";
     if($("riceVariety")) $("riceVariety").value=f.rice_variety||f.rice||"";
     $("polishing").value=f.polishing_ratio||"";
     $("alcohol").value=f.alcohol||"";
     $("volume").value=f.volume||"";
   }

   const f=d.label_facts||{};
   const past=await findSupabasePastRecord({
     brand:$("brand").value.trim()||f.brand||"",
     product:$("product").value.trim()||f.product||""
   });
   if(past) mergePastIntoEmptyFields(past);

   const sw=await matchSakenowaFacts({brand:$("brand").value.trim()||f.brand||"",product:$("product").value.trim()||f.product||"",brewery:$("brewery").value.trim()||f.brewery||"",prefecture:$("prefecture").value.trim()||f.prefecture||""});
   renderSakenowaMatches(sw);
   // さけのわは銘柄・蔵元・地域の正規化だけ。個体スペックは上書きしない。
   if(sw[0]&&sw[0].score>=.88){
     $("brand").value=sw[0].brand||$("brand").value;
     if(sw[0].brewery)$("brewery").value=sw[0].brewery;
     if(sw[0].prefecture)$("prefecture").value=sw[0].prefecture;
   }

   if(d.cache_hit){
     msg($("analysisMsg"),"♻️ AI解析済みキャッシュを再利用しました。APIは使っていません。","ok");
   }else{
     msg($("analysisMsg"),top?.web_verified
       ?"✓ AI＋Web照合完了。写真の情報を優先して自動入力しました。保存すると酒ログ共有辞書にも学習されます。"
       :"📷 写真から読めた情報を自動入力しました。保存すると酒ログ共有辞書にも学習されます。","ok");
   }
 }catch(e){
   const text=String(e.message||e);
   if(/本日のAI認識上限|短時間のAI認識回数|rate limit|429|TPM/i.test(text)){
     msg($("analysisMsg"),"AI認識の利用上限に達しました。写真はそのまま残っています。時間をおいて再度試すか、このまま手入力・「確認中」で記録できます。","err");
   }else if(/通信できません|failed to fetch|network|offline/i.test(text)){
     msg($("analysisMsg"),"通信できませんでした。写真と入力内容は残っています。通信が戻ってからもう一度「AIで銘柄候補を探す」を押してください。","err");
   }else if(/時間内に完了|timeout|timed out/i.test(text)){
     msg($("analysisMsg"),"解析に時間がかかっています。写真は残っているので、少し時間をおいてもう一度試せます。このまま記録することもできます。","err");
   }else{
     msg($("analysisMsg"),"銘柄候補を取得できませんでした。写真と入力内容は残っています。このまま手入力、または「確認中」で記録できます。","err");
   }
 }finally{$("analyzeBtn").disabled=false}
};

$("locateBtn").onclick=()=>{
 if(!navigator.geolocation){$("locMsg").textContent="位置情報を利用できません";return}
 $("locMsg").textContent="現在地を取得中…";
 navigator.geolocation.getCurrentPosition(p=>{S.lat=p.coords.latitude;S.lng=p.coords.longitude;$("locMsg").textContent=`現在地取得済み (${S.lat.toFixed(5)}, ${S.lng.toFixed(5)})`},e=>$("locMsg").textContent=e.message,{enableHighAccuracy:true,timeout:15000})
};

async function preparePhotoForUpload(file){
 // スマホの高解像度写真はStorage送信前に軽量化する。
 // AI用画像とは別で、思い出として十分な画質を残す。
 if(!file)return file;
 try{
   if(file.size<=2.5*1024*1024 && /^(image\/jpeg|image\/webp)$/i.test(file.type||"")){
     return file;
   }
   const url=URL.createObjectURL(file);
   try{
     const img=await new Promise((resolve,reject)=>{
       const el=new Image();
       el.onload=()=>resolve(el);
       el.onerror=()=>reject(new Error("画像を開けませんでした"));
       el.src=url;
     });
     const MAX=2200;
     const scale=Math.min(1,MAX/Math.max(img.width,img.height));
     const w=Math.max(1,Math.round(img.width*scale));
     const h=Math.max(1,Math.round(img.height*scale));
     const c=document.createElement("canvas");
     c.width=w;c.height=h;
     const ctx=c.getContext("2d");
     ctx.imageSmoothingEnabled=true;
     ctx.imageSmoothingQuality="high";
     ctx.drawImage(img,0,0,w,h);
     const blob=await new Promise((resolve,reject)=>
       c.toBlob(b=>b?resolve(b):reject(new Error("画像圧縮に失敗しました")),"image/jpeg",0.88)
     );
     return blob;
   }finally{
     URL.revokeObjectURL(url);
   }
 }catch(e){
   console.warn("photo compression skipped",e);
   return file;
 }
}
async function uploadPhoto(file){
 const body=await preparePhotoForUpload(file);
 const ext=(body!==file || !/^(image\/jpeg|image\/png|image\/webp)$/i.test(file.type||""))?"jpg":((file.name?.split(".").pop()||"jpg").toLowerCase());
 const path=`${S.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
 const url=BASE+"/storage/v1/object/sake-photos/"+encodeURI(path);
 const contentType=body.type||file.type||"image/jpeg";
 let lastError=null;
 for(let attempt=0;attempt<2;attempt++){
   try{
     const r=await authFetch(url,{
       method:"POST",
       headers:{"Content-Type":contentType,"x-upsert":"true"},
       body
     });
     if(r.ok)return path;
     const detail=await r.text().catch(()=>"");
     lastError=new Error("写真保存エラー HTTP "+r.status+(detail?" "+detail:""));
     // 4xxは同じ内容を再送しても改善しないので即終了。
     if(r.status<500 && r.status!==408 && r.status!==429)break;
   }catch(e){
     lastError=e;
   }
   if(attempt===0)await new Promise(resolve=>setTimeout(resolve,900));
 }
 const sizeMb=((body.size||file.size||0)/1024/1024).toFixed(1);
 throw new Error((lastError?.message||"写真保存に失敗しました")+"（送信画像 約"+sizeMb+"MB）");
}



const RECORD_DRAFT_KEY="sakelog_record_draft_v1";
const RECORD_DRAFT_FIELDS=["brand","product","brewery","prefecture","classification","rice","riceVariety","polishing","alcohol","volume","restaurant","price","comment"];

function readRecordDraft(){
  try{
    const d=JSON.parse(localStorage.getItem(RECORD_DRAFT_KEY)||"null");
    return d&&typeof d==="object"?d:null;
  }catch{return null}
}
function clearRecordDraft(){
  try{localStorage.removeItem(RECORD_DRAFT_KEY)}catch{}
}
function saveRecordDraft(){
  if(!S.user)return;
  const values={};
  let hasValue=false;
  for(const id of RECORD_DRAFT_FIELDS){
    const el=$(id);
    if(!el)continue;
    values[id]=el.value||"";
    if(String(values[id]).trim())hasValue=true;
  }
  const rating=$("rating")?.value||"4";
  const hasContext=!!(S.currentEventId||S.currentSakeId||S.lat||S.lng);
  if(!hasValue && !hasContext && rating==="4"){
    clearRecordDraft();
    return;
  }
  try{
    localStorage.setItem(RECORD_DRAFT_KEY,JSON.stringify({
      userId:S.user.id,
      values,
      rating,
      currentEventId:S.currentEventId||null,
      currentEventSakeId:S.currentEventSakeId||null,
      currentSakeId:S.currentSakeId||null,
      lat:S.lat??null,
      lng:S.lng??null,
      hadFrontPhoto:!!S.photo,
      hadBackPhoto:!!S.backPhoto,
      hadFoodPhoto:!!S.foodPhoto,
      hadMemoryPhoto:!!S.memoryPhoto,
      savedAt:Date.now()
    }));
  }catch{}
}
function restoreRecordDraftToForm(){
  const d=readRecordDraft();
  if(!d||d.userId!==S.user?.id)return false;

  for(const id of RECORD_DRAFT_FIELDS){
    if($(id))$(id).value=d.values?.[id]||"";
  }
  if($("rating")){
    $("rating").value=d.rating||"4";
    $("ratingVal").textContent=Number($("rating").value).toFixed(1);
  }

  S.currentEventId=d.currentEventId||null;
  S.currentEventSakeId=d.currentEventSakeId||null;
  S.currentSakeId=d.currentSakeId||null;
  S.lat=d.lat??null;
  S.lng=d.lng??null;

  show("recordView");
  const photoNote=(d.hadFrontPhoto||d.hadBackPhoto||d.hadFoodPhoto||d.hadMemoryPhoto)
    ?" 写真は端末の安全上、自動復元できないため必要な写真だけ選び直してください。"
    :"";
  msg($("recordMsg"),"前回入力途中だった内容を復元しました。"+photoNote,"info");
  return true;
}
function discardRecordDraft(){
  clearRecordDraft();
  showRecoveryNotice("");
}
function resumeRecordDraft(){
  if(restoreRecordDraftToForm())showRecoveryNotice("");
}
function maybeShowDraftRecoveryNotice(){
  const d=readRecordDraft();
  if(!d)return;
  if(d.userId!==S.user?.id){clearRecordDraft();return}
  const age=Date.now()-Number(d.savedAt||0);
  if(age>7*24*60*60*1000){clearRecordDraft();return}
  showRecoveryNotice(
    '<b>入力途中の一杯があります。</b>'+
    '<div class="small" style="margin-top:5px">保存前にアプリを閉じても、文字入力はこの端末に残しています。</div>'+
    '<div class="grid" style="margin-top:9px">'+
      '<button class="btn secondary" onclick="resumeRecordDraft()">入力を続ける</button>'+
      '<button class="btn outline" onclick="discardRecordDraft()">破棄する</button>'+
    '</div>'
  );
}
function wireRecordDraftAutosave(){
  let timer=null;
  const schedule=()=>{
    clearTimeout(timer);
    timer=setTimeout(saveRecordDraft,250);
  };
  for(const id of RECORD_DRAFT_FIELDS){
    $(id)?.addEventListener("input",schedule);
    $(id)?.addEventListener("change",schedule);
  }
  $("rating")?.addEventListener("input",schedule);
}

const PENDING_SAVE_STATE_KEY="sakelog_pending_save_state_v1";
const PENDING_EVENT_PHOTO_STATE_KEY="sakelog_pending_event_photo_state_v1";

function readLocalOperation(key){
  try{
    const v=JSON.parse(localStorage.getItem(key)||"null");
    return v&&typeof v==="object"?v:null;
  }catch{return null}
}
function writeLocalOperation(key,value){
  try{
    if(value)localStorage.setItem(key,JSON.stringify(value));
    else localStorage.removeItem(key);
  }catch{}
}
function clearLocalOperation(key){writeLocalOperation(key,null)}

function showRecoveryNotice(html){
  const box=$("recoveryNotice");
  if(!box)return;
  if(!html){box.innerHTML="";box.classList.add("hidden");return}
  box.innerHTML='<div class="card" style="border-color:#d8c9a9;background:#fffaf1">'+html+'</div>';
  box.classList.remove("hidden");
}

async function recoverInterruptedOperations(){
  if(!S.user)return;

  const notices=[];

  // Drinking record recovery.
  const pendingSave=readLocalOperation(PENDING_SAVE_STATE_KEY);
  if(pendingSave){
    if(pendingSave.userId!==S.user.id){
      clearLocalOperation(PENDING_SAVE_STATE_KEY);
    }else if(pendingSave.requestId){
      try{
        const rows=await select(
          "drinking_records",
          "select=id,brand_name,product_name,brewery_name,created_at&client_request_id=eq."+
          encodeURIComponent(pendingSave.requestId)+"&limit=1"
        );
        const rec=rows?.[0];
        if(rec){
          const photos=await select(
            "sake_photos",
            "select=photo_type&drinking_record_id=eq."+encodeURIComponent(rec.id)
          ).catch(()=>[]);
          const have=new Set((photos||[]).map(x=>x.photo_type));
          const expected=Array.isArray(pendingSave.expectedPhotoTypes)?pendingSave.expectedPhotoTypes:[];
          const missing=expected.filter(x=>!have.has(x));
          if(missing.length){
            notices.push(
              '<b>前回のLOGは途中まで保存されています。</b>'+
              '<div class="small" style="margin-top:5px">二重登録はしていません。写真の一部が未保存の可能性があります。内容を確認してください。</div>'+
              '<button class="btn outline" style="margin-top:9px" onclick="openRecordDetail(\''+escapeHtml(rec.id)+'\')">前回のLOGを確認</button>'
            );
          }else{
            notices.push(
              '<b>前回のLOGは保存できていました ✓</b>'+
              '<div class="small" style="margin-top:5px">通信が途切れても、同じ記録を重複して作らず確認できました。</div>'+
              '<button class="btn outline" style="margin-top:9px" onclick="openRecordDetail(\''+escapeHtml(rec.id)+'\')">保存した一杯を見る</button>'
            );
          }
        }else{
          notices.push(
            '<b>前回の保存は完了していませんでした。</b>'+
            '<div class="small" style="margin-top:5px">重複したLOGは作られていません。必要ならもう一度記録してください。</div>'
          );
        }
      }catch(e){
        console.warn("save recovery check skipped",e);
      }finally{
        clearLocalOperation(PENDING_SAVE_STATE_KEY);
        S.currentSaveRequestId=null;
      }
    }
  }

  // Event photo recovery.
  const pendingPhoto=readLocalOperation(PENDING_EVENT_PHOTO_STATE_KEY);
  if(pendingPhoto){
    if(pendingPhoto.userId!==S.user.id){
      clearLocalOperation(PENDING_EVENT_PHOTO_STATE_KEY);
    }else if(pendingPhoto.requestId){
      try{
        const rows=await select(
          "event_photos",
          "select=id,event_id&client_request_id=eq."+encodeURIComponent(pendingPhoto.requestId)+"&limit=1"
        );
        if(rows?.length){
          notices.push(
            '<b>前回のイベント写真は保存できていました ✓</b>'+
            '<div class="small" style="margin-top:5px">写真の二重登録はありません。</div>'
          );
        }else{
          if(pendingPhoto.storagePath){
            try{await deleteStorageObjectFromBucket("event-photos",pendingPhoto.storagePath)}catch(e){
              console.warn("orphan event photo cleanup pending",e);
            }
          }
          notices.push(
            '<b>前回のイベント写真は登録完了していませんでした。</b>'+
            '<div class="small" style="margin-top:5px">途中の画像データは可能な範囲で整理しました。必要ならもう一度追加してください。</div>'
          );
        }
      }catch(e){
        console.warn("event photo recovery check skipped",e);
      }finally{
        clearLocalOperation(PENDING_EVENT_PHOTO_STATE_KEY);
        S.currentEventPhotoRequestId=null;
      }
    }
  }

  showRecoveryNotice(notices.join('<div style="height:10px"></div>'));
}

function makeClientRequestId(){
  try{return crypto.randomUUID()}catch{
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,ch=>{
      const r=Math.random()*16|0,v=ch==="x"?r:(r&3|8);
      return v.toString(16);
    });
  }
}
async function idempotentInsert(table,obj,conflictCols){
  const q="?on_conflict="+encodeURIComponent(conflictCols);
  const r=await authFetch(BASE+"/rest/v1/"+table+q,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Prefer":"resolution=merge-duplicates,return=representation"
    },
    body:JSON.stringify(obj)
  });
  const d=await r.json().catch(()=>null);
  if(!r.ok)throw new Error((d&&d.message)||"HTTP "+r.status);
  return Array.isArray(d)?d[0]:d;
}

async function insert(table,obj){
 const r=await authFetch(BASE+"/rest/v1/"+table,{method:"POST",headers:{"Content-Type":"application/json","Prefer":"return=representation"},body:JSON.stringify(obj)});
 const d=await r.json().catch(()=>null);
 if(!r.ok)throw new Error((d&&d.message)||"HTTP "+r.status);
 return Array.isArray(d)?d[0]:d;
}
async function select(table,query=""){
 const r=await authFetch(BASE+"/rest/v1/"+table+"?"+query,{headers:{"Content-Type":"application/json","Accept":"application/json"}});
 const d=await r.json().catch(()=>[]);
 if(!r.ok)throw new Error((d&&d.message)||"HTTP "+r.status);
 return d;
}
async function updateRow(table,id,obj){
 const r=await authFetch(BASE+"/rest/v1/"+table+"?id=eq."+encodeURIComponent(id),{
   method:"PATCH",
   headers:{"Content-Type":"application/json","Prefer":"return=representation"},
   body:JSON.stringify(obj)
 });
 const d=await r.json().catch(()=>null);
 if(!r.ok)throw new Error((d&&d.message)||"HTTP "+r.status);
 return Array.isArray(d)?d[0]:d;
}
async function deleteRows(table,query){
 const r=await authFetch(BASE+"/rest/v1/"+table+"?"+query,{method:"DELETE",headers:{"Content-Type":"application/json"}});
 if(!r.ok){
   const d=await r.json().catch(()=>null);
   throw new Error((d&&d.message)||"HTTP "+r.status);
 }
 return true;
}

const PENDING_ROLLBACK_KEY="sakelog_pending_rollbacks_v1";
function readPendingRollbacks(){
 try{
   const v=JSON.parse(localStorage.getItem(PENDING_ROLLBACK_KEY)||"[]");
   return Array.isArray(v)?v:[];
 }catch{return []}
}
function writePendingRollbacks(items){
 try{
   if(items.length)localStorage.setItem(PENDING_ROLLBACK_KEY,JSON.stringify(items));
   else localStorage.removeItem(PENDING_ROLLBACK_KEY);
 }catch{}
}
function queuePendingRollback(recordId,storagePaths=[]){
 if(!recordId)return;
 const items=readPendingRollbacks().filter(x=>x?.recordId!==recordId);
 items.push({recordId,storagePaths:[...new Set(storagePaths.filter(Boolean))],queuedAt:Date.now()});
 writePendingRollbacks(items);
}
async function deleteStorageObjectFromBucket(bucket,path){
 if(!path)return true;
 const r=await authFetch(BASE+"/storage/v1/object/"+encodeURIComponent(bucket)+"/"+encodeURI(path),{method:"DELETE"});
 if(r.ok||r.status===404)return true;
 throw new Error("写真クリーンアップ HTTP "+r.status);
}
async function deleteStorageObject(path){
 return deleteStorageObjectFromBucket("sake-photos",path);
}

const PENDING_STORAGE_DELETE_KEY="sakelog_pending_storage_deletes_v1";
function readPendingStorageDeletes(){
 try{
   const v=JSON.parse(localStorage.getItem(PENDING_STORAGE_DELETE_KEY)||"[]");
   return Array.isArray(v)?v:[];
 }catch{return []}
}
function writePendingStorageDeletes(items){
 try{
   const clean=[...new Set((items||[]).filter(Boolean))];
   if(clean.length)localStorage.setItem(PENDING_STORAGE_DELETE_KEY,JSON.stringify(clean));
   else localStorage.removeItem(PENDING_STORAGE_DELETE_KEY);
 }catch{}
}
function queuePendingStorageDelete(path){
 if(!path)return;
 writePendingStorageDeletes([...readPendingStorageDeletes(),path]);
}
async function cleanupPendingStorageDeletes(){
 const remaining=[];
 for(const path of readPendingStorageDeletes()){
   try{await deleteStorageObject(path)}catch{remaining.push(path)}
 }
 writePendingStorageDeletes(remaining);
 return remaining.length===0;
}
async function rollbackRecord(item){
 if(!item?.recordId)return true;
 try{
   const r=await authFetch(BASE+"/rest/v1/rpc/delete_my_drinking_record",{
     method:"POST",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({p_record_id:item.recordId})
   });
   const d=await r.json().catch(()=>null);
   if(!r.ok)throw new Error((d&&d.message)||"HTTP "+r.status);

   const paths=[
     ...new Set([
       ...((d&&Array.isArray(d.storage_paths))?d.storage_paths:[]),
       ...(item.storagePaths||[])
     ].filter(Boolean))
   ];

   for(const path of paths){
     try{await deleteStorageObject(path)}
     catch{queuePendingStorageDelete(path)}
   }
   return true;
 }catch(e){
   console.warn("record rollback pending",item.recordId,e);
   return false;
 }
}
async function cleanupPendingRollbacks(){
 const items=readPendingRollbacks();
 if(!items.length)return true;
 const remaining=[];
 for(const item of items){
   if(!(await rollbackRecord(item)))remaining.push(item);
 }
 writePendingRollbacks(remaining);
 return remaining.length===0;
}


const JAPAN_PREFECTURES=[
"北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
"新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
"奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
"熊本県","大分県","宮崎県","鹿児島県","沖縄県"
];

function normalizeNumberText(v){
  return String(v||"")
    .replace(/[０-９．]/g,ch=>"０１２３４５６７８９．".indexOf(ch)===10?".":"0123456789"["０１２３４５６７８９".indexOf(ch)])
    .replace(/,/g,"");
}
function firstNumber(v){
  const m=normalizeNumberText(v).match(/-?\d+(?:\.\d+)?/);
  return m?Number(m[0]):null;
}
function volumeMl(v){
  const s=normalizeNumberText(v).toLowerCase();
  const n=firstNumber(s);
  if(n===null)return null;
  if(/(?:^|[^m])l\b|リットル/.test(s) && !/ml|ｍｌ/.test(s))return n*1000;
  return n;
}

function normalizedCompareText(v){
  return String(v||"").normalize("NFKC").toLowerCase()
    .replace(/株式会社|有限会社|合資会社|合同会社/g,"")
    .replace(/[\s　・･\-ー_（）()「」『』【】]/g,"");
}
function valuesClearlyDifferent(a,b,threshold=.45){
  const aa=normalizedCompareText(a),bb=normalizedCompareText(b);
  if(!aa||!bb)return false;
  if(aa===bb||aa.includes(bb)||bb.includes(aa))return false;
  try{return simText(a,b)<threshold}catch{return aa!==bb}
}
function recognitionReference(){
  if(!S.recognition)return null;
  const f=S.recognition.label_facts||{};
  const c=S.selectedRecognitionCandidate||(S.recognition.candidates||[])[0]||{};
  return {
    brand:f.brand||c.brand||"",
    product:f.product||c.product||"",
    brewery:f.brewery||c.brewery||"",
    prefecture:f.prefecture||c.prefecture||"",
    classification:f.classification||c.classification||"",
    polishing_ratio:f.polishing_ratio||c.polishing_ratio||"",
    alcohol:f.alcohol||c.alcohol||"",
    volume:f.volume||c.volume||""
  };
}
function recognitionDiscrepancies(){
  const ref=recognitionReference();
  if(!ref)return [];
  const out=[];
  const current={
    brand:$("brand")?.value||"",
    product:$("product")?.value||"",
    brewery:$("brewery")?.value||"",
    prefecture:$("prefecture")?.value||"",
    classification:$("classification")?.value||"",
    polishing_ratio:$("polishing")?.value||"",
    alcohol:$("alcohol")?.value||"",
    volume:$("volume")?.value||""
  };

  if(valuesClearlyDifferent(current.brand,ref.brand,.4)){
    out.push({field:"brand",label:"銘柄",read:ref.brand,input:current.brand});
  }
  if(valuesClearlyDifferent(current.product,ref.product,.38)){
    out.push({field:"product",label:"商品名",read:ref.product,input:current.product});
  }
  if(valuesClearlyDifferent(current.brewery,ref.brewery,.42)){
    out.push({field:"brewery",label:"蔵元",read:ref.brewery,input:current.brewery});
  }

  const pNow=firstNumber(current.polishing_ratio),pRef=firstNumber(ref.polishing_ratio);
  if(pNow!==null&&pRef!==null&&Math.abs(pNow-pRef)>=5){
    out.push({field:"polishing",label:"精米歩合",read:ref.polishing_ratio,input:current.polishing_ratio});
  }
  const aNow=firstNumber(current.alcohol),aRef=firstNumber(ref.alcohol);
  if(aNow!==null&&aRef!==null&&Math.abs(aNow-aRef)>=2){
    out.push({field:"alcohol",label:"アルコール度数",read:ref.alcohol,input:current.alcohol});
  }
  const vNow=volumeMl(current.volume),vRef=volumeMl(ref.volume);
  if(vNow!==null&&vRef!==null&&Math.abs(vNow-vRef)>=100){
    out.push({field:"volume",label:"容量",read:ref.volume,input:current.volume});
  }
  return out;
}

function validateRecordForm({render=true}={}){
  const errors=[];
  const warnings=[];
  const fields={};

  const polishing=firstNumber($("polishing")?.value);
  if(polishing!==null){
    if(polishing<=0||polishing>100){errors.push("精米歩合は1〜100%の範囲で確認してください。");fields.polishing="error"}
    else if(polishing<20){warnings.push("精米歩合が20%未満です。ラベルの数字をもう一度確認してください。");fields.polishing="warning"}
  }

  const alcohol=firstNumber($("alcohol")?.value);
  if(alcohol!==null){
    if(alcohol<0||alcohol>100){errors.push("アルコール度数は0〜100%の範囲で確認してください。");fields.alcohol="error"}
    else if(alcohol<5||alcohol>30){warnings.push("アルコール度数が一般的な日本酒の範囲から外れています。ラベル表記を確認してください。");fields.alcohol="warning"}
  }

  const ml=volumeMl($("volume")?.value);
  if(ml!==null){
    if(ml<=0){errors.push("容量は0より大きい値を入力してください。");fields.volume="error"}
    else if(ml<100||ml>10000){warnings.push("容量の値が珍しいため、ml / L の単位を確認してください。");fields.volume="warning"}
  }

  const priceText=String($("price")?.value||"").trim();
  if(priceText){
    const price=Number(normalizeNumberText(priceText));
    if(!Number.isFinite(price)||price<0){errors.push("価格は0円以上の数字で入力してください。");fields.price="error"}
    else if(price>1000000){warnings.push("価格が100万円を超えています。桁数を確認してください。");fields.price="warning"}
  }

  const pref=String($("prefecture")?.value||"").trim();
  if(pref && !JAPAN_PREFECTURES.includes(pref)){
    warnings.push("都道府県名が標準表記と異なります。例：奈良県、京都府、東京都。");
    fields.prefecture="warning";
  }

  const brand=String($("brand")?.value||"").trim();
  const product=String($("product")?.value||"").trim();
  const brewery=String($("brewery")?.value||"").trim();
  if(brand && product && brand===product){
    warnings.push("銘柄と商品名が同じ文字になっています。分け方を確認してください。");
    fields.brand=fields.product="warning";
  }
  if(brewery && !/(酒造|酒蔵|醸造|酒店|株式会社|有限会社|合名会社|合同会社|本家|本舗)/.test(brewery) && brewery.length<=3){
    warnings.push("蔵元名が短いため、入力途中でないか確認してください。");
    fields.brewery="warning";
  }

  const recognitionDiffs=recognitionDiscrepancies();
  for(const d of recognitionDiffs){
    warnings.push(d.label+"がラベル読取結果と大きく異なります（読取："+d.read+" ／ 入力："+d.input+"）。");
    if(fields[d.field]!=="error")fields[d.field]="warning";
  }

  if(render){
    ["polishing","alcohol","volume","price","prefecture","brand","product","brewery"].forEach(id=>{
      const el=$(id); if(!el)return;
      el.classList.remove("field-error","field-warning");
      if(fields[id]==="error")el.classList.add("field-error");
      else if(fields[id]==="warning")el.classList.add("field-warning");
    });
    const box=$("recordValidationMsg");
    if(box){
      const parts=[];
      if(errors.length)parts.push('<div class="msg err"><b>入力を確認してください</b><br>'+errors.map(escapeHtml).join("<br>")+'</div>');
      if(warnings.length)parts.push('<div class="msg info"><b>念のため確認</b><br>'+warnings.map(escapeHtml).join("<br>")+'</div>');
      box.innerHTML=parts.join("");
    }
  }
  return {errors,warnings};
}
function wireRecordValidation(){
  const ids=["polishing","alcohol","volume","price","prefecture","brand","product","brewery"];
  let timer=null;
  const run=()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>validateRecordForm({render:true}),250);
  };
  ids.forEach(id=>{
    $(id)?.addEventListener("input",run);
    $(id)?.addEventListener("blur",()=>validateRecordForm({render:true}));
  });
}

$("saveRecordBtn").onclick=async()=>{
 syncActiveNav("recordView");
 if(!requireOnline("現在オフラインです。入力内容は消えません。通信が戻ってから保存してください。"))return;
 const validation=validateRecordForm({render:true});
 if(validation.errors.length){
   msg($("recordMsg"),"入力内容に確認が必要な項目があります。赤い欄を確認してください。","err");
   return;
 }
 if(validation.warnings.length){
   const ok=confirm("入力内容に確認したい項目があります。\n\n・"+validation.warnings.join("\n・")+"\n\nこの内容で保存しますか？");
   if(!ok)return;
 }
 if(S.savingRecord)return;
 S.savingRecord=true;
 let brand=$("brand").value.trim();
 if(!brand){
   if(S.photo||S.backPhoto){
     brand="確認中";
     $("brand").value=brand;
     msg($("recordMsg"),"銘柄を特定できなかったため「確認中」として保存します。あとから編集できます。","info");
   }else{
     S.savingRecord=false;
     msg($("recordMsg"),"銘柄を入力してください","err");
     return;
   }
 }
 $("saveRecordBtn").disabled=true;
 msg($("recordMsg"),"保存中…","info");

 let rec=null;
 const uploadedPaths=[];
 try{
   // 前回、通信断などで巻き戻せなかった保存があれば先に掃除する。
   await cleanupPendingRollbacks();

   if(!S.currentSaveRequestId)S.currentSaveRequestId=makeClientRequestId();
   const expectedPhotoTypes=[
     S.photo?"front":null,
     S.backPhoto?"back":null,
     S.foodPhoto?"food":null,
     S.memoryPhoto?"memory":null
   ].filter(Boolean);
   writeLocalOperation(PENDING_SAVE_STATE_KEY,{
     userId:S.user.id,
     requestId:S.currentSaveRequestId,
     expectedPhotoTypes,
     startedAt:Date.now()
   });
   rec=await idempotentInsert("drinking_records",{
     user_id:S.user.id,
     client_request_id:S.currentSaveRequestId,
     sake_id:S.currentSakeId||null,
     event_id:S.currentEventId||null,
     brand_name:brand,
     product_name:$("product").value.trim()||null,
     brewery_name:$("brewery").value.trim()||null,
     prefecture:$("prefecture").value.trim()||null,
     classification:$("classification").value.trim()||null,
     rice:$("rice").value.trim()||null,
     rice_variety:$("riceVariety")?.value?.trim()||null,
     polishing_ratio:$("polishing").value.trim()||null,
     alcohol:$("alcohol").value.trim()||null,
     volume:$("volume").value.trim()||null,
     drank_at:new Date().toISOString(),
     restaurant_name:$("restaurant").value.trim()||null,
     latitude:S.lat,
     longitude:S.lng,
     price_yen:$("price").value?Number($("price").value):null,
     rating:Number($("rating").value),
     comment:$("comment").value.trim()||null
   },"user_id,client_request_id");

   let frontPhotoRow=null;
   const photos=[
     ["front",S.photo],
     ["back",S.backPhoto],
     ["food",S.foodPhoto],
     ["memory",S.memoryPhoto]
   ];
   for(const [photoType,file] of photos){
     if(!file)continue;
     const path=await uploadPhoto(file);
     uploadedPaths.push(path);
     const row=await insert("sake_photos",{
       user_id:S.user.id,
       drinking_record_id:rec.id,
       photo_type:photoType,
       storage_path:path,
       mime_type:file.type||"image/jpeg"
     });
     if(photoType==="front")frontPhotoRow=row;
   }

   if(S.recognition){
     const top=S.selectedRecognitionCandidate||(S.recognition.candidates||[])[0]||{};
     const recognitionDiffFields=recognitionDiscrepancies().map(x=>x.field);
     const rr=await insert("recognition_results",{
       user_id:S.user.id,
       drinking_record_id:rec.id,
       photo_id:frontPhotoRow?.id||null,
       ocr_text:S.recognition.ocr_text||null,
       predicted_brand:top.brand||null,
       predicted_product:top.product||null,
       predicted_brewery:top.brewery||null,
       confidence:top.confidence??null,
       candidates:S.recognition.candidates||[],
       web_sources:S.recognition.web_sources||[],
       model_name:S.recognition.model_name||"openai"
     });
     if(top.brand&&(brand!==top.brand||($("product").value.trim()||"")!==(top.product||""))){
       await insert("corrections",{
         user_id:S.user.id,
         recognition_result_id:rr.id,
         predicted_brand:top.brand,
         predicted_product:top.product||null,
         correct_brand:brand,
         correct_product:$("product").value.trim()||null,
         correct_brewery:$("brewery").value.trim()||null,
         reason:recognitionDiffFields.length
           ?"user_corrected:"+recognitionDiffFields.join(",")
           :"user_confirmed"
       });
     }
   }

   // ここまで全て成功して初めて、端末側の確定キャッシュと共有辞書を更新する。
   if(S.currentImageCacheKey){
     saveConfirmedCache(S.currentImageCacheKey,{
       brand:$("brand").value.trim(),
       product:$("product").value.trim(),
       brewery:$("brewery").value.trim(),
       prefecture:$("prefecture").value.trim(),
       classification:$("classification").value.trim(),
       ingredients:$("rice").value.trim(),
       rice_variety:$("riceVariety")?.value?.trim()||"",
       polishing_ratio:$("polishing").value.trim(),
       alcohol:$("alcohol").value.trim(),
       volume:$("volume").value.trim(),
       recognition:S.recognition||null
     });
   }
   await saveToSharedDictionary();

   msg($("recordMsg"),"✓ 保存しました。","ok");
   clearLocalOperation(PENDING_SAVE_STATE_KEY);
   clearRecordDraft();
   S.currentSaveRequestId=null;
   setTimeout(()=>showRecordComplete(rec),350);
 }catch(e){
   let rollbackClean=true;
   if(rec?.id){
     queuePendingRollback(rec.id,uploadedPaths);
     rollbackClean=await cleanupPendingRollbacks();
   }else{
     // record作成前に写真を上げる経路は通常ないが、念のためStorageだけ掃除。
     for(const path of uploadedPaths){
       try{await deleteStorageObject(path)}catch{rollbackClean=false}
     }
   }
   if(rollbackClean){
     clearLocalOperation(PENDING_SAVE_STATE_KEY);
     S.currentSaveRequestId=null;
   }
   const suffix=rollbackClean
     ?" 保存途中のデータは取り消しました。入力内容と写真はこの画面に残っています。"
     :" 保存途中のデータは次回起動時にも確認します。入力内容と写真はこの画面に残っています。";
   saveRecordDraft();
   msg($("recordMsg"),"保存できませんでした: "+(e.message||e)+"。"+suffix,"err");
 }finally{
   S.savingRecord=false;
   $("saveRecordBtn").disabled=false;
 }
};
function showRecordComplete(rec){
 if(!rec?.id){
   show("homeView");
   loadMyUpcomingEventList().catch(()=>{});
   return;
 }
 const title=[rec.brand_name,rec.product_name].filter(Boolean).join(" ")||"今日の一杯";
 const brewery=rec.brewery_name||"";
 const rating=Number(rec.rating||0);
 $("completeBody").innerHTML=`
   <div class="complete-kicker">WASHU LOG</div>
   <div class="complete-mark">✓</div>
   <h2>今日の一杯を、残しました。</h2>
   <div class="complete-sake">
     <strong>${escapeHtml(title)}</strong>
     ${brewery?`<span>${escapeHtml(brewery)}</span>`:""}
     ${rating?`<div class="complete-rating">${escapeHtml(stars(rating))} <small>${rating.toFixed(1)}</small></div>`:""}
   </div>
   <p class="complete-copy">写真も、その日の記憶も。あとでこの一杯から振り返れます。</p>
   <button id="completeDetailBtn" class="btn primary">この一杯を見る</button>
   <button id="completeHomeBtn" class="btn outline">ホームへ戻る</button>
 `;
 show("completeView");
 $("completeDetailBtn").onclick=()=>openRecordDetail(rec.id);
 $("completeHomeBtn").onclick=()=>{
   show("homeView");
   loadMyUpcomingEventList().catch(()=>{});
 };
}

function formatDateJP(v){
 if(!v)return "";
 try{return new Intl.DateTimeFormat("ja-JP",{year:"numeric",month:"short",day:"numeric"}).format(new Date(v))}catch{return ""}
}
function stars(v){
 const n=Math.max(0,Math.min(5,Number(v)||0));
 return "★".repeat(Math.round(n))+"☆".repeat(5-Math.round(n));
}
function renderRows(rows){
 if(!rows.length)return '<div class="small">まだ記録がありません。</div>';
 return '<div class="history-grid">'+rows.map(r=>{
   const title=[r.brand_name,r.product_name].filter(Boolean).join(" ");
   const tags=[r.prefecture,r.classification].filter(Boolean);
   const specs=[
     ["蔵元",r.brewery_name],
     ["原材料",r.rice],
     ["精米歩合",r.polishing_ratio],
     ["アルコール",r.alcohol],
     ["容量",r.volume],
     ["価格",r.price_yen?Number(r.price_yen).toLocaleString()+"円":""]
   ].filter(x=>x[1]);
   return `<article class="sake-card" data-record-id="${escapeHtml(r.id)}" onclick="openRecordDetail(\'${escapeHtml(r.id)}\')" style="cursor:pointer">
     <div class="sake-thumb placeholder" data-thumb="${escapeHtml(r.id)}">🍶</div>
     <div class="sake-main">
       <div class="sake-title">${escapeHtml(title||"名称未登録")}</div>
       <div class="sake-sub">${escapeHtml(r.brewery_name||"蔵元未登録")}</div>
       ${tags.length?`<div class="sake-badges">${tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>`:""}
       <div class="sake-rating">${escapeHtml(stars(r.rating))} <span class="small">${Number(r.rating||0).toFixed(1)}</span></div>
       <div class="sake-meta">${escapeHtml(formatDateJP(r.drank_at))}${r.restaurant_name?" ・ "+escapeHtml(r.restaurant_name):""}</div>
       ${r.comment?`<div class="sake-comment">${escapeHtml(r.comment)}</div>`:""}
     </div>
     ${specs.length?`<details class="sake-details" onclick="event.stopPropagation()"><summary>この一本の詳細を見る</summary><div class="spec-grid">${specs.map(([k,v])=>`<div><b>${escapeHtml(k)}</b>${escapeHtml(v)}</div>`).join("")}</div></details>`:""}
   </article>`;
 }).join("")+'</div>';
}


async function loadFrontPhotoMap(recordIds){
 if(!recordIds?.length)return {};
 const clean=recordIds.filter(Boolean);
 if(!clean.length)return {};
 try{
   const q="select=drinking_record_id,storage_path,photo_type&photo_type=eq.front&drinking_record_id=in.("+clean.join(",")+")";
   const rows=await select("sake_photos",q);
   const map={};
   for(const p of rows||[]) if(!map[p.drinking_record_id]) map[p.drinking_record_id]=p.storage_path;
   return map;
 }catch{return {}}
}
async function storageObjectUrl(path){
 if(!path)return null;
 if(photoObjectUrls.has(path))return photoObjectUrls.get(path);
 try{
   const r=await authFetch(BASE+"/storage/v1/object/sake-photos/"+encodeURI(path),{});
   if(!r.ok)return null;
   const blob=await r.blob();
   const url=URL.createObjectURL(blob);
   photoObjectUrls.set(path,url);
   return url;
 }catch{return null}
}
async function hydrateHistoryPhotos(rows,containerId){
 const map=await loadFrontPhotoMap(rows.map(r=>r.id));
 await Promise.all(rows.map(async r=>{
   const el=document.querySelector(`#${containerId} [data-thumb="${CSS.escape(String(r.id))}"]`);
   const path=map[r.id];
   if(!el||!path)return;
   const url=await storageObjectUrl(path);
   if(!url)return;
   const img=document.createElement("img");
   img.className="sake-thumb";
   img.src=url;
   img.alt=[r.brand_name,r.product_name].filter(Boolean).join(" ")||"日本酒";
   img.loading="lazy";
   el.replaceWith(img);
 }));
}

async function getRecordPhotos(recordId){
 try{
   return await select("sake_photos","select=*&drinking_record_id=eq."+encodeURIComponent(recordId)+"&order=created_at.asc");
 }catch{return []}
}
async function renderPhotoForPath(path,alt){
 if(!path)return '<div class="detail-photo empty">🍶</div>';
 const url=await storageObjectUrl(path);
 return url
   ? `<img class="detail-photo" src="${escapeHtml(url)}" alt="${escapeHtml(alt||"日本酒")}">`
   : '<div class="detail-photo empty">🍶</div>';
}
async function openRecordDetail(recordId){
 try{
   show("detailView");
   $("detailBody").innerHTML="読み込み中…";
   const rows=await select("drinking_records","select=*&id=eq."+encodeURIComponent(recordId)+"&limit=1");
   const r=rows?.[0];
   if(!r)throw new Error("記録が見つかりません");
   S.detailRecord=r;
   const photos=await getRecordPhotos(recordId);
   const front=photos.find(p=>p.photo_type==="front");
   const back=photos.find(p=>p.photo_type==="back");
   const food=photos.find(p=>p.photo_type==="food");
const memory=photos.find(p=>p.photo_type==="memory");
  const frontHtml=await renderPhotoForPath(front?.storage_path,[r.brand_name,r.product_name].filter(Boolean).join(" "));
   const backHtml=await renderPhotoForPath(back?.storage_path,"裏ラベル");
   const foodHtml=food
  ? await renderPhotoForPath(food.storage_path,"料理写真")
  : "";

const memoryHtml=memory
  ? await renderPhotoForPath(memory.storage_path,"思い出写真")
  : "";
  const tags=[r.prefecture,r.classification].filter(Boolean);
   const title=[r.brand_name,r.product_name].filter(Boolean).join(" ");
   $("detailBody").innerHTML=`
     <div class="detail-photo-section">
  <h3>ラベル</h3>
  <div class="detail-hero">${frontHtml}${backHtml}</div>
</div>
${foodHtml||memoryHtml?`
<div class="detail-photo-section">
  <h3>この日の思い出</h3>
  <div class="detail-hero">${foodHtml}${memoryHtml}</div>
</div>
`:""}
    <div class="detail-title">${escapeHtml(title||"名称未登録")}</div>
     <div class="detail-brewery">${escapeHtml(r.brewery_name||"蔵元未登録")}</div>
     ${tags.length?`<div class="detail-tags">${tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>`:""}
     <div class="detail-rating">${escapeHtml(stars(r.rating))} <span class="small">${Number(r.rating||0).toFixed(1)}</span></div>
     <div class="small">${escapeHtml(formatDateJP(r.drank_at))}${r.restaurant_name?" ・ "+escapeHtml(r.restaurant_name):""}</div>
     <div class="detail-info">
       ${[
         ["原材料",r.rice],["使用米・原料米",r.rice_variety],["精米歩合",r.polishing_ratio],["アルコール",r.alcohol],
         ["価格",r.price_yen?Number(r.price_yen).toLocaleString()+"円":""]
       ].filter(x=>x[1]).map(([k,v])=>`<div><b>${escapeHtml(k)}</b>${escapeHtml(v)}</div>`).join("")}
     </div>
     ${r.comment?`<div class="detail-comment">${escapeHtml(r.comment)}</div>`:""}
     <div class="detail-actions">
       <button id="editRecordBtn" class="btn secondary">✏️ 編集する</button>
       <button id="deleteRecordBtn" class="btn danger">🗑️ 削除する</button>
     </div>`;
   $("editRecordBtn").onclick=()=>renderRecordEditor(r);
   $("deleteRecordBtn").onclick=()=>deleteCurrentRecord();
 }catch(e){
   $("detailBody").innerHTML=`<div class="msg err">${escapeHtml(e.message)}</div>`;
 }
}
function renderRecordEditor(r){
 $("detailBody").innerHTML=`
   <h2>記録を編集</h2>
   <div class="edit-grid">
     <div><label>銘柄</label><input id="eBrand" value="${escapeHtml(r.brand_name||"")}"></div>
     <div><label>商品名</label><input id="eProduct" value="${escapeHtml(r.product_name||"")}"></div>
     <div><label>蔵元</label><input id="eBrewery" value="${escapeHtml(r.brewery_name||"")}"></div>
     <div><label>都道府県</label><input id="ePrefecture" value="${escapeHtml(r.prefecture||"")}"></div>
     <div><label>特定名称・酒類区分</label><input id="eClass" value="${escapeHtml(r.classification||"")}"></div>
     <div><label>原材料</label><input id="eRice" value="${escapeHtml(r.rice||"")}"></div>
     <div><label>使用米・原料米</label><input id="eRiceVariety" value="${escapeHtml(r.rice_variety||"")}"></div>
     <div><label>精米歩合</label><input id="ePolishing" value="${escapeHtml(r.polishing_ratio||"")}"></div>
     <div><label>アルコール</label><input id="eAlcohol" value="${escapeHtml(r.alcohol||"")}"></div>
     <div><label>容量</label><input id="eVolume" value="${escapeHtml(r.volume||"")}"></div>
     <div><label>飲んだ店</label><input id="eRestaurant" value="${escapeHtml(r.restaurant_name||"")}"></div>
     <div><label>価格（円）</label><input id="ePrice" type="number" value="${escapeHtml(r.price_yen??"")}"></div>
     <div><label>評価（1〜5）</label><input id="eRating" type="number" min="1" max="5" step="0.5" value="${escapeHtml(r.rating??4)}"></div>
     <div class="full"><label>コメント</label><textarea id="eComment">${escapeHtml(r.comment||"")}</textarea></div>
   </div>

<div class="full">
  <h3>📷 写真を編集</h3>

  <label>表ラベル</label>
  <input id="editFrontPhoto" type="file" accept="image/*">
  <label><input id="deleteFrontPhoto" type="checkbox"> この写真を削除</label>

  <label>裏ラベル</label>
  <input id="editBackPhoto" type="file" accept="image/*">
  <label><input id="deleteBackPhoto" type="checkbox"> この写真を削除</label>

  <label>料理写真</label>
  <input id="editFoodPhoto" type="file" accept="image/*">
  <label><input id="deleteFoodPhoto" type="checkbox"> この写真を削除</label>

  <label>思い出写真</label>
  <input id="editMemoryPhoto" type="file" accept="image/*">
  <label><input id="deleteMemoryPhoto" type="checkbox"> この写真を削除</label>
</div>
   
   <div class="detail-actions">
     <button id="saveEditBtn" class="btn primary">変更を保存</button>
     <button id="cancelEditBtn" class="btn outline">キャンセル</button>
   </div>
   <div id="editMsg"></div>`;
 $("cancelEditBtn").onclick=()=>openRecordDetail(r.id);
 $("saveEditBtn").onclick=async()=>{
   $("saveEditBtn").disabled=true;
   msg($("editMsg"),"保存中…","info");
   const originalRecord={
     brand_name:r.brand_name??null,
     product_name:r.product_name??null,
     brewery_name:r.brewery_name??null,
     prefecture:r.prefecture??null,
     classification:r.classification??null,
     rice:r.rice??null,
     rice_variety:r.rice_variety??null,
     polishing_ratio:r.polishing_ratio??null,
     alcohol:r.alcohol??null,
     volume:r.volume??null,
     restaurant_name:r.restaurant_name??null,
     price_yen:r.price_yen??null,
     rating:r.rating??null,
     comment:r.comment??null
   };
   let recordTextUpdated=false;
   try{
     await updateRow("drinking_records",r.id,{
       brand_name:$("eBrand").value.trim()||null,
       product_name:$("eProduct").value.trim()||null,
       brewery_name:$("eBrewery").value.trim()||null,
       prefecture:$("ePrefecture").value.trim()||null,
       classification:$("eClass").value.trim()||null,
       rice:$("eRice").value.trim()||null,
       rice_variety:$("eRiceVariety")?.value?.trim()||null,
       polishing_ratio:$("ePolishing").value.trim()||null,
       alcohol:$("eAlcohol").value.trim()||null,
       volume:$("eVolume").value.trim()||null,
       restaurant_name:$("eRestaurant").value.trim()||null,
       price_yen:$("ePrice").value?Number($("ePrice").value):null,
       rating:$("eRating").value?Number($("eRating").value):null,
       comment:$("eComment").value.trim()||null
     });
     recordTextUpdated=true;
    
const photoInputs=[
  ["editFrontPhoto","deleteFrontPhoto","front"],
  ["editBackPhoto","deleteBackPhoto","back"],
  ["editFoodPhoto","deleteFoodPhoto","food"],
  ["editMemoryPhoto","deleteMemoryPhoto","memory"]
];

await cleanupPendingStorageDeletes().catch(()=>{});

for(const [inputId,deleteId,photoType] of photoInputs){
  const file=$(inputId)?.files?.[0];
  const shouldDelete=$(deleteId)?.checked;
  if(!file&&!shouldDelete)continue;

  const oldPhotos=await getRecordPhotos(r.id);
  const old=oldPhotos.find(p=>p.photo_type===photoType);

  if(file){
    // 新しい写真を先に保存し、古いDB行の削除まで成功した時だけ差し替え確定。
    // 古いDB行の削除に失敗した場合は、新しい写真を巻き戻して重複を残さない。
    let newPath=null;
    let newRow=null;
    try{
      newPath=await uploadPhoto(file);
      newRow=await insert("sake_photos",{
        user_id:S.user.id,
        drinking_record_id:r.id,
        photo_type:photoType,
        storage_path:newPath,
        mime_type:file.type||"image/jpeg"
      });

      if(old?.id){
        try{
          await deleteRows("sake_photos","id=eq."+encodeURIComponent(old.id));
        }catch(e){
          // 差し替え確定前の失敗なので、新しい方だけ取り消して古い写真を残す。
          try{await deleteRows("sake_photos","id=eq."+encodeURIComponent(newRow.id))}catch{}
          try{await deleteStorageObject(newPath)}catch{queuePendingStorageDelete(newPath)}
          throw e;
        }

        // 古いStorage実体の削除失敗は表示には影響しないため、後で再試行する。
        try{await deleteStorageObject(old.storage_path)}
        catch{queuePendingStorageDelete(old.storage_path)}
      }
    }catch(e){
      // upload成功・DB insert失敗など、未確定の新規Storageだけ掃除。
      if(newPath && !newRow){
        try{await deleteStorageObject(newPath)}catch{queuePendingStorageDelete(newPath)}
      }
      throw e;
    }
  }else if(shouldDelete&&old?.id){
    await deleteRows("sake_photos","id=eq."+encodeURIComponent(old.id));
    try{await deleteStorageObject(old.storage_path)}
    catch{queuePendingStorageDelete(old.storage_path)}
  }
}
     msg($("editMsg"),"✓ 更新しました","ok");
     setTimeout(()=>openRecordDetail(r.id),500);
   }catch(e){
     if(recordTextUpdated){
       try{await updateRow("drinking_records",r.id,originalRecord)}
       catch(rollbackError){console.warn("record edit rollback failed",rollbackError)}
     }
     msg($("editMsg"),"更新できませんでした: "+(e.message||e)+"。変更前の内容を保持するよう復旧しました。","err");
   }
   finally{$("saveEditBtn").disabled=false}
 };
}
async function deleteCurrentRecord(){
 const r=S.detailRecord;
 if(!r)return;
 if(!confirm(`「${[r.brand_name,r.product_name].filter(Boolean).join(" ")}」の記録を削除しますか？`))return;
 try{
   const photos=await getRecordPhotos(r.id);
   const item={recordId:r.id,storagePaths:(photos||[]).map(p=>p.storage_path).filter(Boolean)};
   queuePendingRollback(item.recordId,item.storagePaths);
   const clean=await cleanupPendingRollbacks();
   if(!clean){
     alert("記録の削除を受け付けました。残った写真データは次回接続時に自動で整理します。");
   }
   S.detailRecord=null;
   show("historyView");
 }catch(e){
   alert("削除できませんでした: "+e.message);
 }
}

async function loadRecent(){
 try{
   const rows=await select("drinking_records","select=*&order=drank_at.desc&limit=6");
   $("recentList").innerHTML=renderRows(rows);
   hydrateHistoryPhotos(rows,"recentList");
 }catch(e){$("recentList").innerHTML=`<div class="msg err">${escapeHtml(e.message)}</div>`}
}
async function loadHistory(){
 try{
   const rows=await select("drinking_records","select=*&order=drank_at.desc&limit=50");
   $("historyList").innerHTML=renderRows(rows);
   hydrateHistoryPhotos(rows,"historyList");
 }catch(e){$("historyList").innerHTML=`<div class="msg err">${escapeHtml(e.message)}</div>`}
}

function avg(nums){
 const arr=nums.map(Number).filter(n=>Number.isFinite(n));
 return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
}
function countBy(rows,key){
 const m={};
 for(const r of rows){
   const v=String(r[key]||"").trim();
   if(!v)continue;
   m[v]=(m[v]||0)+1;
 }
 return Object.entries(m).sort((a,b)=>b[1]-a[1]);
}
function avgBy(rows,key){
 const m={};
 for(const r of rows){
   const k=String(r[key]||"").trim();
   const rating=Number(r.rating);
   if(!k||!Number.isFinite(rating))continue;
   if(!m[k])m[k]=[];
   m[k].push(rating);
 }
 return Object.entries(m).map(([k,v])=>[k,avg(v),v.length]).sort((a,b)=>b[1]-a[1]);
}
function renderRank(items,formatter=(v)=>v){
 if(!items.length)return '<div class="small">まだ集計できる記録がありません。</div>';
 const max=Math.max(...items.map(x=>Number(x[1])||0),1);
 return '<div class="rank-list">'+items.slice(0,5).map((x,i)=>`
   <div class="rank-row">
     <div class="rank-num">${i+1}</div>
     <div><b>${escapeHtml(x[0])}</b><div class="bar"><span style="width:${Math.max(4,Math.round((Number(x[1])||0)/max*100))}%"></span></div></div>
     <div>${escapeHtml(String(formatter(x[1],x)))}</div>
   </div>`).join("")+'</div>';
}
function buildTasteInsight(rows){
 if(rows.length<2)return "記録が増えると、好みの傾向をここに表示します。";
 const cls=avgBy(rows,"classification").filter(x=>x[2]>=1);
 const pref=avgBy(rows,"prefecture").filter(x=>x[2]>=1);
 const brewery=avgBy(rows,"brewery_name").filter(x=>x[2]>=1);
 const bits=[];
 if(cls[0])bits.push(`「${cls[0][0]}」の平均評価は ${cls[0][1].toFixed(1)}`);
 if(pref[0])bits.push(`都道府県では「${pref[0][0]}」の評価が高め`);
 if(brewery[0])bits.push(`酒蔵では「${brewery[0][0]}」が高評価`);
 return bits.length?bits.join("。")+"。":"まだはっきりした傾向は出ていません。";
}
async function loadAnalysis(){
 try{
   const rows=await select("drinking_records","select=*&order=drank_at.desc&limit=500");
   const body=$("analysisBody");
   if(!rows.length){body.innerHTML='<div class="small">まだ記録がありません。</div>';return}
   const ratings=rows.map(r=>Number(r.rating)).filter(Number.isFinite);
   const prefectures=countBy(rows,"prefecture");
   const classes=countBy(rows,"classification");
   const breweries=countBy(rows,"brewery_name");
   const topRated=[...rows].filter(r=>Number.isFinite(Number(r.rating))).sort((a,b)=>Number(b.rating)-Number(a.rating)).slice(0,5);
   const uniqueBreweries=new Set(rows.map(r=>r.brewery_name).filter(Boolean)).size;
   const uniquePrefectures=new Set(rows.map(r=>r.prefecture).filter(Boolean)).size;
   const uniqueBrands=new Set(rows.map(r=>[r.brand_name,r.product_name].filter(Boolean).join(" ")).filter(Boolean)).size;

   body.innerHTML=`
     <div class="stats-grid">
       <div class="stat-card"><b>飲んだ本数</b><strong>${rows.length}</strong></div>
       <div class="stat-card"><b>平均評価</b><strong>${avg(ratings).toFixed(1)}</strong></div>
       <div class="stat-card"><b>酒蔵数</b><strong>${uniqueBreweries}</strong></div>
       <div class="stat-card"><b>都道府県数</b><strong>${uniquePrefectures}</strong></div>
     </div>
     <div class="insight">🍶 ${escapeHtml(buildTasteInsight(rows))}</div>

     <div class="analysis-section"><h3>よく飲む酒類</h3>${renderRank(classes)}</div>
     <div class="analysis-section"><h3>よく飲む都道府県</h3>${renderRank(prefectures)}</div>
     <div class="analysis-section"><h3>よく飲む酒蔵</h3>${renderRank(breweries)}</div>

     <div class="analysis-section"><h3>評価TOP</h3>
       ${topRated.map((r,i)=>`<div class="top-sake">
         <b>${i+1}. ${escapeHtml([r.brand_name,r.product_name].filter(Boolean).join(" "))}</b>
         <div class="small">${escapeHtml(r.brewery_name||"")} ${r.prefecture?"・"+escapeHtml(r.prefecture):""}</div>
         <div>${escapeHtml(stars(r.rating))} ${Number(r.rating).toFixed(1)}</div>
       </div>`).join("")}
     </div>

     <div class="analysis-section"><h3>コレクション</h3>
       <div class="small">${uniqueBrands}銘柄を記録しています。</div>
     </div>`;
 }catch(e){
   $("analysisBody").innerHTML=`<div class="msg err">${escapeHtml(e.message)}</div>`;
 }
}

async function loadProfile(){
 const isLineOnly=String(S.user?.email||"").endsWith("@line.washulog.invalid");
 const lineArea=isLineOnly
   ? `<div style="margin-top:18px;padding:14px;background:#f7f9f7;border-radius:12px">
        <b>LINEでログイン中</b>
        <div class="small" style="margin-top:5px">このLINEアカウントは単独の和酒ログアカウントとして利用中です。</div>
      </div>`
   : `<div style="margin-top:18px;padding:14px;background:#f7f9f7;border-radius:12px">
        <b>LINE連携</b>
        <div class="small" style="margin-top:5px">このアカウントにLINEを連携すると、次回からLINEでも同じ記録を開けます。別ユーザーのデータと自動統合することはありません。</div>
        <button id="linkLineBtn" class="btn outline" style="margin-top:10px">LINEをこのアカウントに連携</button>
      </div>`;

 $("profileBody").innerHTML=`
   <p><b>${escapeHtml(S.user?.email||"")}</b></p>
   <div class="small">和酒ログにログイン中です。</div>
   <button class="btn outline" onclick="logout()">ログアウト</button>
   ${lineArea}
   <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e3ded4">
     <div style="font-weight:700;margin-bottom:6px">アカウント</div>
     <div class="small" style="margin-bottom:10px">アカウントを削除すると、飲酒記録・写真・参加情報など本人に紐づくデータは削除され、元に戻せません。</div>
     <button id="deleteAccountBtn" class="btn outline" style="border-color:#b64b4b;color:#a33131">アカウントを削除</button>
     <div id="deleteAccountMsg"></div>
   </div>`;
 const btn=$("deleteAccountBtn");
 if(btn)btn.onclick=deleteMyAccount;
 const lineBtn=$("linkLineBtn");
 if(lineBtn)lineBtn.onclick=startLineLink;
}
function clearAllLocalUserData(){
 try{
   const keepPubKey=localStorage.getItem("sakelog_pubkey");
   const keys=[];
   for(let i=0;i<localStorage.length;i++){
     const k=localStorage.key(i);
     if(k&&k.startsWith("sakelog_"))keys.push(k);
   }
   keys.forEach(k=>localStorage.removeItem(k));
   if(keepPubKey)localStorage.setItem("sakelog_pubkey",keepPubKey);
 }catch{}
 clearSession();
}

async function deleteMyAccount(){
 if(!S.user?.email)return;

 const first=confirm(
   "和酒ログのアカウントを削除します。\n\n飲酒記録、写真、参加情報など本人に紐づくデータは削除され、元に戻せません。\n\n続けますか？"
 );
 if(!first)return;

 const entered=prompt("確認のため、登録メールアドレスを入力してください。");
 if(entered===null)return;

 if(entered.trim().toLowerCase()!==String(S.user.email).trim().toLowerCase()){
   msg($("deleteAccountMsg"),"メールアドレスが一致しません。アカウントは削除されていません。","err");
   return;
 }

 const finalCheck=confirm("最終確認です。アカウントと本人データを完全に削除しますか？");
 if(!finalCheck)return;

 const btn=$("deleteAccountBtn");
 if(btn)btn.disabled=true;
 msg($("deleteAccountMsg"),"アカウントを削除しています…","info");

 try{
   const r=await authFetch(BASE+"/functions/v1/delete-account",{
     method:"POST",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({confirm_email:entered.trim()})
   });
   const d=await r.json().catch(()=>null);
   if(!r.ok)throw new Error(d?.error||"アカウント削除に失敗しました");

   clearAllLocalUserData();
   show("authView");
   msg($("authMsg"),"アカウントを削除しました。ご利用ありがとうございました。","ok");
 }catch(e){
   msg(
     $("deleteAccountMsg"),
     (e?.message||"アカウントを削除できませんでした。")+" 通信状況を確認して、もう一度お試しください。",
     "err"
   );
 }finally{
   if(btn)btn.disabled=false;
 }
}

if($("googleLoginBtn")) $("googleLoginBtn").onclick=()=>startOAuth("google");
if($("appleLoginBtn")) $("appleLoginBtn").onclick=()=>startOAuth("apple");
if($("lineLoginBtn")) $("lineLoginBtn").onclick=startLineLogin;

document.querySelectorAll(".navbtn").forEach(b=>b.onclick=()=>{
  if(b.dataset.page==="recordView"){
    startFreshRecord();
  }else show(b.dataset.page);
});
wireRecordDraftAutosave();
wireRecordValidation();
restore();

if($("detailBackBtn")) $("detailBackBtn").onclick=()=>show("historyView");

