const BASE="https://mtshsijgfmottgkbgnir.supabase.co";
const $=id=>document.getElementById(id);
const S={signup:false,user:null,token:null,refreshToken:null,photo:null,backPhoto:null,foodPhoto:null,memoryPhoto:null,lat:null,lng:null,recognition:null,currentImageCacheKey:null,currentFrontHash:null,currentBackHash:null,detailRecord:null};
const photoObjectUrls=new Map();
const cfgKey=()=>localStorage.getItem("sakelog_pubkey")||"";
const msg=(el,text,type="ok")=>el.innerHTML=text?`<div class="msg ${type}">${escapeHtml(text)}</div>`:"";
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

function show(id){
 ["setupView","authView",...Array.from(document.querySelectorAll(".page")).map(x=>x.id)].forEach(x=>$(x)?.classList.add("hidden"));
 $(id).classList.remove("hidden");
 $("bottomNav").classList.toggle("hidden",!S.user);
 document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("active",b.dataset.page===id));
 if(id==="homeView")loadRecent();
 if(id==="historyView")loadHistory();
 if(id==="profileView")loadProfile();
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
 const make=()=>fetch(url,{...options,headers:{...(options.headers||{}),apikey:cfgKey(),Authorization:"Bearer "+S.token}});
 let r=await make();
 if(r.status===401){
  const t=await r.clone().text().catch(()=>"");
  if(/jwt expired|expired|invalid jwt/i.test(t)){
   await refreshSession();
   r=await make();
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
 const email=$("email").value.trim(),password=$("password").value;
 if(!email||password.length<6){msg($("authMsg"),"メールアドレスと6文字以上のパスワードを入力してください。","err");return}
 const path=S.signup?"/auth/v1/signup":"/auth/v1/token?grant_type=password";
 try{
  const r=await fetch(BASE+path,{method:"POST",headers:headers(),body:JSON.stringify({email,password})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.msg||d.message||"HTTP "+r.status);
  if(S.signup&&!d.access_token){msg($("authMsg"),"✓ 登録を受け付けました。確認メールが届く場合はメール認証後にログインしてください。","ok");return}
  saveSession(d);
  $("userEmail").textContent=S.user?.email||"";
  show("homeView");
 }catch(e){msg($("authMsg"),e.message,"err")}
};

function restore(){
 S.token=localStorage.getItem("sakelog_token");
 S.refreshToken=localStorage.getItem("sakelog_refresh_token");
 try{S.user=JSON.parse(localStorage.getItem("sakelog_user")||"null")}catch{}
 if(cfgKey()&&S.token&&S.user){$("userEmail").textContent=S.user.email||"";show("homeView")}
 else if(cfgKey())show("authView");else show("setupView");
}
function logout(){
 ["sakelog_token","sakelog_refresh_token","sakelog_user"].forEach(k=>localStorage.removeItem(k));
 S.user=null;S.token=null;S.refreshToken=null;show("authView");
}
$("logoutTop").onclick=logout;

function resetRecord(){
 S.currentImageCacheKey=null; S.currentFrontHash=null; S.currentBackHash=null;
 S.photo=null;S.backPhoto=null;S.recognition=null;S.lat=null;S.lng=null;
 ["brand","product","brewery","prefecture","classification","rice","polishing","alcohol","volume","restaurant","price","comment"].forEach(id=>$(id).value="");
 $("preview").classList.add("hidden");$("backPreview").classList.add("hidden");$("analyzeBtn").classList.add("hidden");$("candidateBox").classList.add("hidden");msg($("analysisMsg"),"");$("rating").value=4;$("ratingVal").textContent="4.0";$("locMsg").textContent="";msg($("recordMsg"),"");
 show("recordView");
}
$("manualBtn").onclick=resetRecord;
$("rating").oninput=()=> $("ratingVal").textContent=Number($("rating").value).toFixed(1);

function updateAnalyzeButton(){
 $("analyzeBtn").classList.toggle("hidden",!S.photo);
}
function attachPhoto(file){
 const keepBack=S.backPhoto;
 resetRecord();
 S.backPhoto=keepBack;
 S.photo=file;$("preview").src=URL.createObjectURL(file);$("preview").classList.remove("hidden");
 if(S.backPhoto){$("backPreview").src=URL.createObjectURL(S.backPhoto);$("backPreview").classList.remove("hidden");}
 updateAnalyzeButton();msg($("recordMsg"),"表ラベルを選択しました。裏ラベルも追加すると識別精度を上げやすくなります。","info");
}
function attachBackPhoto(file){
 if(!S.photo) resetRecord();
 S.backPhoto=file;$("backPreview").src=URL.createObjectURL(file);$("backPreview").classList.remove("hidden");
 updateAnalyzeButton();msg($("recordMsg"),"裏ラベルを追加しました。表＋裏を同じ1本として保存します。","info");
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
$("cameraBtn").onclick=()=> $("cameraInput").click();
$("galleryBtn").onclick=()=> $("galleryInput").click();
$("backCameraBtn").onclick=()=> $("backCameraInput").click();
$("backGalleryBtn").onclick=()=> $("backGalleryInput").click();
$("cameraInput").onchange=e=>{const f=e.target.files?.[0];if(f)attachPhoto(f)};
$("galleryInput").onchange=e=>{const f=e.target.files?.[0];if(f)attachPhoto(f)};
$("backCameraInput").onchange=e=>{const f=e.target.files?.[0];if(f)attachBackPhoto(f)};
$("backGalleryInput").onchange=e=>{const f=e.target.files?.[0];if(f)attachBackPhoto(f)};
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

$("analyzeBtn").onclick=async()=>{
 $("analyzeBtn").disabled=true;
 msg($("analysisMsg"),"📚 共有辞書 → 確定済み記録 → AIキャッシュ → AI解析の順で探します…","info");
 try{
   const frontData=await fileToDataURL(S.photo,"front");
   const backData=S.backPhoto?await fileToDataURL(S.backPhoto,"back"):null;
   const cacheKey=await buildImageCacheKey(frontData,backData);
   S.currentImageCacheKey=cacheKey;
   S.currentFrontHash=await imageDHash(frontData);
   S.currentBackHash=backData?await imageDHash(backData):null;

   // 0. 酒ログ共有辞書。高い画像類似度のときだけAI不要で採用。
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
     const swDict=await matchSakenowaFacts(dictionaryRecordToFacts(dict.row));
     renderSakenowaMatches(swDict);
     msg($("analysisMsg"),
       `📚 酒ログ共有辞書から候補を見つけました（画像一致度 ${Math.round(dict.sim.score*100)}%）。不足項目はAIでラベルから補完します。${swDict[0]&&swDict[0].score>=.72?" さけのわ銘柄DBでも確認できました。":""} 現物ラベルを確認して保存してください。`,
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

   // 2. AI解析済みキャッシュ
   let d=null;
   if(d){
     d={...d,cache_hit:true};
   }else{
     // 3. 完全新規だけAI
     msg($("analysisMsg"),"共有辞書に未登録の新しい日本酒です。AIでラベル読取＋Web照合を行っています…","info");
     const body={front:frontData,back:backData};
     const r=await fetch("/.netlify/functions/recognize-sake",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
     d=await r.json().catch(()=>({}));
     if(!r.ok) throw new Error(d.error||"AI解析 HTTP "+r.status);
     saveAiCache(cacheKey,d);
   }

   S.recognition=d;
   renderCandidates(d.candidates||[]);
   const top=(d.candidates||[])[0];
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
   if(/rate limit|429|TPM/i.test(text)){
     msg($("analysisMsg"),"APIの一時的な利用上限です。この日本酒が共有辞書にまだ無い完全新規のためAIが必要です。写真は保持しています。少し待って再試行するか、今回は手入力して保存すれば次回から共有辞書で候補化できます。","err");
   }else{
     msg($("analysisMsg"),"AI解析エラー: "+text+"。手入力して保存すれば、その内容を酒ログ共有辞書の候補として蓄積できます。","err");
   }
 }finally{$("analyzeBtn").disabled=false}
};

$("locateBtn").onclick=()=>{
 if(!navigator.geolocation){$("locMsg").textContent="位置情報を利用できません";return}
 $("locMsg").textContent="現在地を取得中…";
 navigator.geolocation.getCurrentPosition(p=>{S.lat=p.coords.latitude;S.lng=p.coords.longitude;$("locMsg").textContent=`現在地取得済み (${S.lat.toFixed(5)}, ${S.lng.toFixed(5)})`},e=>$("locMsg").textContent=e.message,{enableHighAccuracy:true,timeout:15000})
};

async function uploadPhoto(file){
 const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
 const path=`${S.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
 const r=await authFetch(BASE+"/storage/v1/object/sake-photos/"+encodeURI(path),{method:"POST",headers:{"Content-Type":file.type||"image/jpeg","x-upsert":"false"},body:file});
 if(!r.ok)throw new Error("写真保存エラー HTTP "+r.status+" "+await r.text());
 return path;
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

$("saveRecordBtn").onclick=async()=>{
if(S.savingRecord)return;
S.savingRecord=true;
 const brand=$("brand").value.trim();
 if(!brand){
  S.savingRecord=false;
  msg($("recordMsg"),"銘柄を入力してください","err");
  return;
}
 $("saveRecordBtn").disabled=true;msg($("recordMsg"),"保存中…","info");
 try{
  const rec=await insert("drinking_records",{
   user_id:S.user.id,brand_name:brand,product_name:$("product").value.trim()||null,brewery_name:$("brewery").value.trim()||null,
   prefecture:$("prefecture").value.trim()||null,classification:$("classification").value.trim()||null,
   rice:$("rice").value.trim()||null,polishing_ratio:$("polishing").value.trim()||null,
   alcohol:$("alcohol").value.trim()||null,volume:$("volume").value.trim()||null,
   drank_at:new Date().toISOString(),restaurant_name:$("restaurant").value.trim()||null,latitude:S.lat,longitude:S.lng,
   price_yen:$("price").value?Number($("price").value):null,rating:Number($("rating").value),comment:$("comment").value.trim()||null
  });
  let frontPhotoRow=null;
  if(S.photo){
   const path=await uploadPhoto(S.photo);
   frontPhotoRow=await insert("sake_photos",{user_id:S.user.id,drinking_record_id:rec.id,photo_type:"front",storage_path:path,mime_type:S.photo.type||"image/jpeg"});
  }
  if(S.backPhoto){
   const path=await uploadPhoto(S.backPhoto);
   await insert("sake_photos",{user_id:S.user.id,drinking_record_id:rec.id,photo_type:"back",storage_path:path,mime_type:S.backPhoto.type||"image/jpeg"});
  }
if(S.foodPhoto){
  const path=await uploadPhoto(S.foodPhoto);
  await insert("sake_photos",{
    user_id:S.user.id,
    drinking_record_id:rec.id,
    photo_type:"food",
    storage_path:path,
    mime_type:S.foodPhoto.type||"image/jpeg"
  });
}

if(S.memoryPhoto){
  const path=await uploadPhoto(S.memoryPhoto);
  await insert("sake_photos",{
    user_id:S.user.id,
    drinking_record_id:rec.id,
    photo_type:"memory",
    storage_path:path,
    mime_type:S.memoryPhoto.type||"image/jpeg"
  });
}
  if(S.recognition){
   const top=(S.recognition.candidates||[])[0]||{};
   const rr=await insert("recognition_results",{user_id:S.user.id,drinking_record_id:rec.id,photo_id:frontPhotoRow?.id||null,
     ocr_text:S.recognition.ocr_text||null,predicted_brand:top.brand||null,predicted_product:top.product||null,predicted_brewery:top.brewery||null,
     confidence:top.confidence??null,candidates:S.recognition.candidates||[],web_sources:S.recognition.web_sources||[],model_name:S.recognition.model_name||"openai"});
   if(top.brand && (brand!==top.brand || ($("product").value.trim()||"")!==(top.product||""))){
     await insert("corrections",{user_id:S.user.id,recognition_result_id:rr.id,predicted_brand:top.brand,predicted_product:top.product||null,
       correct_brand:brand,correct_product:$("product").value.trim()||null,correct_brewery:$("brewery").value.trim()||null,reason:"user_confirmed"});
   }
  }
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
  msg($("recordMsg"),
  "✓ Supabaseに保存しました。共有辞書へ学習しました。",
  "ok");
  setTimeout(()=>show("homeView"),700);
}catch(e){
  S.savingRecord=false;
  $("saveRecordBtn").disabled=false;
  msg($("recordMsg"),e.message,"err");
}finally{
  S.savingRecord=false;
  $("saveRecordBtn").disabled=false;
}
};
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
         ["原材料",r.rice],["精米歩合",r.polishing_ratio],["アルコール",r.alcohol],
         ["容量",r.volume],["価格",r.price_yen?Number(r.price_yen).toLocaleString()+"円":""],
         ["飲んだ店",r.restaurant_name]
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
   try{
     await updateRow("drinking_records",r.id,{
       brand_name:$("eBrand").value.trim()||null,
       product_name:$("eProduct").value.trim()||null,
       brewery_name:$("eBrewery").value.trim()||null,
       prefecture:$("ePrefecture").value.trim()||null,
       classification:$("eClass").value.trim()||null,
       rice:$("eRice").value.trim()||null,
       polishing_ratio:$("ePolishing").value.trim()||null,
       alcohol:$("eAlcohol").value.trim()||null,
       volume:$("eVolume").value.trim()||null,
       restaurant_name:$("eRestaurant").value.trim()||null,
       price_yen:$("ePrice").value?Number($("ePrice").value):null,
       rating:$("eRating").value?Number($("eRating").value):null,
       comment:$("eComment").value.trim()||null
     });
    
const photoInputs=[
  ["editFrontPhoto","deleteFrontPhoto","front"],
  ["editBackPhoto","deleteBackPhoto","back"],
  ["editFoodPhoto","deleteFoodPhoto","food"],
  ["editMemoryPhoto","deleteMemoryPhoto","memory"]
];
    
for(const [inputId,deleteId,photoType] of photoInputs){
    const file=$(inputId)?.files?.[0];
const shouldDelete=$(deleteId)?.checked;

if(!file && !shouldDelete)continue;

  const oldPhotos=await getRecordPhotos(r.id);
 
const old=oldPhotos.find(p=>p.photo_type===photoType);

let path=null;
if(file){
  path=await uploadPhoto(file);
}
  if(old){
    await deleteRows(
      "sake_photos",
      "drinking_record_id=eq."+encodeURIComponent(r.id)+
      "&photo_type=eq."+encodeURIComponent(photoType)
    ).catch(()=>{});

    await authFetch(
      BASE+"/storage/v1/object/sake-photos/"+encodeURI(old.storage_path),
      {method:"DELETE"}
    ).catch(()=>{});
  }

if(file){
  await insert("sake_photos",{
    user_id:S.user.id,
    drinking_record_id:r.id,
    photo_type:photoType,
    storage_path:path,
    mime_type:file.type||"image/jpeg"
  });
}
  
     msg($("editMsg"),"✓ 更新しました","ok");
     setTimeout(()=>openRecordDetail(r.id),500);
   }catch(e){msg($("editMsg"),e.message,"err")}
   finally{$("saveEditBtn").disabled=false}
 };
}
async function deleteCurrentRecord(){
 const r=S.detailRecord;
 if(!r)return;
 if(!confirm(`「${[r.brand_name,r.product_name].filter(Boolean).join(" ")}」の記録を削除しますか？`))return;
 try{
   const photos=await getRecordPhotos(r.id);
   // DB上の関連データを先に削除。Storage実体は残る可能性があるため、後で安全に消す。
   await deleteRows("corrections","recognition_result_id=in.(select id from recognition_results where drinking_record_id=eq."+encodeURIComponent(r.id)+")").catch(()=>{});
   await deleteRows("recognition_results","drinking_record_id=eq."+encodeURIComponent(r.id)).catch(()=>{});
   await deleteRows("sake_photos","drinking_record_id=eq."+encodeURIComponent(r.id)).catch(()=>{});
   await deleteRows("drinking_records","id=eq."+encodeURIComponent(r.id));
   // Storageファイル削除
   for(const p of photos||[]){
     await authFetch(BASE+"/storage/v1/object/sake-photos/"+encodeURI(p.storage_path),{method:"DELETE"}).catch(()=>{});
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
 $("profileBody").innerHTML=`<p><b>${escapeHtml(S.user?.email||"")}</b></p><div class="small">Supabase Auth接続済み<br>写真: sake-photos<br>記録: drinking_records</div><button class="btn outline" onclick="logout()">ログアウト</button>`;
}
document.querySelectorAll(".navbtn").forEach(b=>b.onclick=()=>b.dataset.page==="recordView"?resetRecord():show(b.dataset.page));
restore();

if($("detailBackBtn")) $("detailBackBtn").onclick=()=>show("historyView");
