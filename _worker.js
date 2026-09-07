let sakenowaCache = null;
let sakenowaCacheAt = 0;
const SAKENOWA_TTL = 6 * 60 * 60 * 1000;
const SUPABASE_URL = "https://mtshsijgfmottgkbgnir.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_iN9jbt45ga1sPbzt5aw-0w_iWs8eWW-";

async function requireUser(request) {
  const authorization=request.headers.get("Authorization")||"";
  if(!authorization.startsWith("Bearer ")) return null;
  const response=await fetch(SUPABASE_URL+"/auth/v1/user",{
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:authorization}
  });
  if(!response.ok)return null;
  const user=await response.json().catch(()=>null);
  return user?.id?user:null;
}

async function getProfile(request,userId){
  const authorization=request.headers.get("Authorization")||"";
  if(!authorization.startsWith("Bearer "))return null;
  const response=await fetch(
    SUPABASE_URL+"/rest/v1/profiles?select=plan,role&id=eq."+encodeURIComponent(userId)+"&limit=1",
    {headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:authorization}}
  );
  if(!response.ok)return null;
  const rows=await response.json().catch(()=>[]);
  return rows?.[0]||null;
}

async function consumeRecognitionQuota(request){
  const authorization=request.headers.get("Authorization")||"";
  if(!authorization.startsWith("Bearer ")) return {ok:false,status:401,error:"ログインが必要です"};
  const response=await fetch(SUPABASE_URL+"/rest/v1/rpc/consume_ai_recognition_quota",{
    method:"POST",
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:authorization,"Content-Type":"application/json"},
    body:"{}"
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok)return {ok:false,status:503,error:"AI利用回数の確認に失敗しました"};
  if(!data?.allowed){
    return {
      ok:false,status:429,
      error:data?.reason==="daily_limit"?"本日のAI認識上限に達しました。時間をおいてもう一度お試しください。":"短時間のAI認識回数が上限に達しました。少し時間をおいてお試しください。",
      quota:data||null
    };
  }
  return {ok:true,quota:data};
}

const json = (body, status = 200, cacheControl = "no-store") =>
  new Response(JSON.stringify(body), {status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":cacheControl}});

function extractResponseText(d){
  return d?.output_text||(d?.output||[]).flatMap(x=>x.content||[]).map(x=>x.text||"").join("");
}
function cleanJson(x){
  return String(x||"").replace(/^```json\s*/i,"").replace(/^```\s*/,"").replace(/```\s*$/,"").trim();
}

async function recognizeSake(request, env) {
  if (request.method !== "POST") return json({error:"Method not allowed"}, 405);
  const contentLength=Number(request.headers.get("Content-Length")||0);
  if(contentLength && contentLength>14*1024*1024)return json({error:"画像データが大きすぎます"},413);
  const user=await requireUser(request);
  if(!user)return json({error:"ログインが必要です"},401);
  if (!env.OPENAI_API_KEY) return json({error:"Cloudflare環境変数 OPENAI_API_KEY が未設定です"}, 503);

  try {
    const {front, back} = await request.json();
    if (!front && !back) return json({error:"ラベル画像が必要です"}, 400);
    const totalImageChars=String(front||"").length+String(back||"").length;
    if(totalImageChars>13*1024*1024)return json({error:"画像データが大きすぎます"},413);

    const quotaCheck=await consumeRecognitionQuota(request);
    if(!quotaCheck.ok){
      const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
      if(quotaCheck.quota?.retry_after_seconds)headers["Retry-After"]=String(quotaCheck.quota.retry_after_seconds);
      return new Response(JSON.stringify({error:quotaCheck.error,rate_limited:quotaCheck.status===429,quota:quotaCheck.quota||null}),{status:quotaCheck.status,headers});
    }

    const model = env.OPENAI_MODEL || "gpt-5.6-terra";
    const prompt = `
あなたは日本酒の商品同定専門AIです。
表ラベルと裏ラベルの画像を読み、日本酒を「銘柄だけ」ではなく可能な限り商品単位まで特定してください。
重要ルール:
1. 表ラベル・裏ラベルの文字を両方読む。
2. 大きな銘柄名だけで判定しない。
3. 蔵元名、都道府県、特定名称、原料米、精米歩合、アルコール度数、「大辛口」「生酒」「無濾過」「山田錦」などの商品識別語を必ず利用する。
4. ingredients は原材料名、rice_variety は酒米品種として分ける。原材料名から酒米品種を推測しない。
5. 裏ラベルの製造者名は重要な照合材料として扱う。
6. 読めた文字を使ってWeb検索し、蔵元公式サイトや信頼できる商品情報と照合する。
7. 商品名の一部しか読めなくても、銘柄＋特徴語から商品候補を作る。
8. 確証のない情報は断定せず、候補を最大3件返す。
9. JSON以外は絶対に出力しない。
返却JSON:
{"label_facts":{"ocr":"","brand":"","product":"","brewery":"","prefecture":"","classification":"","ingredients":"","rice_variety":"","polishing_ratio":"","alcohol":"","volume":""},"candidates":[{"brand":"","product":"","brewery":"","prefecture":"","classification":"","confidence":0.0,"reason":""}],"web_sources":[],"note":""}`;
    const content=[{type:"input_text",text:prompt}];
    if(front) content.push({type:"input_image",image_url:front,detail:"high"});
    if(back) content.push({type:"input_image",image_url:back,detail:"high"});
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),45000);
    let resp;
    try{
      resp=await fetch("https://api.openai.com/v1/responses",{
        method:"POST",headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},
        body:JSON.stringify({model,max_output_tokens:2000,tools:[{type:"web_search"}],input:[{role:"user",content}]}),signal:controller.signal
      });
    }finally{clearTimeout(timeout);}
    const data=await resp.json();
    if(!resp.ok){
      if(resp.status===429)return json({error:data?.error?.message||"OpenAI rate limit",rate_limited:true},429);
      throw new Error(data?.error?.message||"OpenAI recognition error");
    }
    const rawText=extractResponseText(data);
    let parsed={};
    try{parsed=JSON.parse(cleanJson(rawText));}
    catch(e){return json({error:"AI返答JSON解析失敗: "+e.message,raw_text:rawText.slice(0,1500)},500);}
    const f=parsed.label_facts||{};
    const nf={...f,classification:f.classification||f.type||"",ingredients:f.ingredients||"",rice_variety:f.rice_variety||f.rice||"",polishing_ratio:f.polishing_ratio||f.polishing||"",alcohol:f.alcohol||"",volume:f.volume||""};
    const candidates=Array.isArray(parsed.candidates)?parsed.candidates.filter(c=>c&&c.brand&&Number(c.confidence||0)>=0.45).slice(0,3).map(c=>({...c,classification:c.classification||c.type||nf.classification,ingredients:c.ingredients||nf.ingredients,rice_variety:c.rice_variety||nf.rice_variety,polishing_ratio:c.polishing_ratio||nf.polishing_ratio,alcohol:c.alcohol||nf.alcohol,volume:c.volume||nf.volume})):[];
    return json({ocr_text:nf.ocr||"",quota:quotaCheck.quota||null,label_facts:{brand:nf.brand||"",product:nf.product||"",brewery:nf.brewery||"",prefecture:nf.prefecture||"",classification:nf.classification||"",ingredients:nf.ingredients||"",rice_variety:nf.rice_variety||"",polishing_ratio:nf.polishing_ratio||"",alcohol:nf.alcohol||"",volume:nf.volume||"",other:nf.other||[]},candidates,web_sources:Array.isArray(parsed.web_sources)?parsed.web_sources.filter(x=>x&&/^https?:\/\//i.test(String(x.url||""))).slice(0,5):[],note:parsed.note||"",model_name:model,version:"4.9.2",api_calls:1});
  } catch(e) {
    if(e?.name==="AbortError")return json({error:"AI解析が時間内に完了しませんでした。写真はそのまま記録できます。",retryable:true},504);
    return json({error:e.message||"AI解析に失敗しました",retryable:true},500);
  }
}

async function extractEventFlyer(request, env){
  if(request.method!=="POST")return json({error:"Method not allowed"},405);
  const user=await requireUser(request);
  if(!user)return json({error:"ログインが必要です"},401);
  const profile=await getProfile(request,user.id);
  const allowed=profile&&(profile.plan==="premium"||profile.plan==="admin"||profile.role==="admin");
  if(!allowed)return json({error:"イベントチラシ解析は課金ユーザー向け機能です"},403);
  if(!env.OPENAI_API_KEY)return json({error:"画像解析を利用できません"},503);
  try{
    const {image}=await request.json();
    if(!image)return json({error:"チラシ画像が必要です"},400);
    if(String(image).length>13*1024*1024)return json({error:"画像データが大きすぎます"},413);
    const model=env.OPENAI_MODEL||"gpt-5.6-terra";
    const prompt=`あなたは日本酒イベント情報の入力補助です。添付チラシから、書かれている事実だけを抽出してください。推測で埋めないでください。曖昧な項目は空文字にしてください。開催年、日付、時間、会場、料金、主催者、予約・申込要否、参加酒蔵、参加店舗、出品酒、問い合わせ、公式URLやQRに関する文字情報を丁寧に読みます。複数会場・回遊型なら venue_type を roaming、単一会場なら single としてください。JSON以外は返さないでください。
返却形式:
{"title":"","subtitle":"","start_date":"YYYY-MM-DD or empty","end_date":"YYYY-MM-DD or empty","start_time":"HH:MM or empty","end_time":"HH:MM or empty","prefecture":"","city":"","venue_name":"","address":"","venue_type":"single|roaming|unknown","fee_note":"","organizer":"","reservation_required":null,"application_note":"","contact":"","official_url":"","participating_breweries":[],"participating_shops":[],"sake_names":[],"notes":"","confidence":{"title":0,"date":0,"venue":0},"needs_confirmation":[]}`;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),45000);
    let resp;
    try{
      resp=await fetch("https://api.openai.com/v1/responses",{
        method:"POST",headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},
        body:JSON.stringify({model,max_output_tokens:2200,input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:image,detail:"high"}]}]}),signal:controller.signal
      });
    }finally{clearTimeout(timeout);}
    const data=await resp.json();
    if(!resp.ok)throw new Error(data?.error?.message||"チラシ解析に失敗しました");
    const raw=extractResponseText(data);
    let parsed;
    try{parsed=JSON.parse(cleanJson(raw));}catch(e){return json({error:"チラシ解析結果を読み取れませんでした",raw_text:raw.slice(0,1200)},500);}
    return json({extracted:parsed,model_name:model,version:"1.0"});
  }catch(e){
    if(e?.name==="AbortError")return json({error:"チラシ解析が時間内に完了しませんでした。もう一度お試しください。",retryable:true},504);
    return json({error:e.message||"チラシ解析に失敗しました",retryable:true},500);
  }
}

async function sakenowaMaster() {
  try {
    if(sakenowaCache && Date.now()-sakenowaCacheAt<SAKENOWA_TTL)return json({...sakenowaCache,cached:true},200,"public, max-age=21600");
    const base="https://muro.sakenowa.com/sakenowa-data/api/";
    const rs=await Promise.all(["brands","breweries","areas"].map(x=>fetch(base+x)));
    if(rs.some(r=>!r.ok))throw new Error("さけのわデータ取得に失敗しました");
    const [brands,breweries,areas]=await Promise.all(rs.map(r=>r.json()));
    sakenowaCache={brands:brands.brands||[],breweries:breweries.breweries||[],areas:areas.areas||[]};
    sakenowaCacheAt=Date.now();
    return json({...sakenowaCache,cached:false},200,"public, max-age=21600");
  } catch(e) { return json({error:e.message},502); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/.netlify/functions/recognize-sake") return recognizeSake(request, env);
    if (url.pathname === "/.netlify/functions/extract-event-flyer") return extractEventFlyer(request, env);
    if (url.pathname === "/.netlify/functions/sakenowa-master") return sakenowaMaster();
    return env.ASSETS.fetch(request);
  }
};
