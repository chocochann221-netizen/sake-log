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

const json = (body, status = 200, cacheControl = "no-store") =>
  new Response(JSON.stringify(body), {
    status,
    headers: {"Content-Type":"application/json; charset=utf-8","Cache-Control":cacheControl}
  });

async function recognizeSake(request, env) {
  if (request.method !== "POST") return json({error:"Method not allowed"}, 405);
  const user=await requireUser(request);
  if(!user)return json({error:"ログインが必要です"},401);
  if (!env.OPENAI_API_KEY) return json({error:"Cloudflare環境変数 OPENAI_API_KEY が未設定です"}, 503);
  try {
    const {front, back} = await request.json();
    if (!front) return json({error:"表ラベル画像が必要です"}, 400);
    const model = env.OPENAI_MODEL || "gpt-5.4-mini";
    const prompt = `
あなたは日本酒の商品同定専門AIです。
表ラベルと裏ラベルの画像を読み、日本酒を「銘柄だけ」ではなく可能な限り商品単位まで特定してください。

重要ルール:
1. 表ラベル・裏ラベルの文字を両方読む。
2. 大きな銘柄名だけで判定しない。
3. 蔵元名、都道府県、特定名称、原料米、精米歩合、アルコール度数、
   「大辛口」「生酒」「無濾過」「山田錦」などの商品識別語を必ず利用する。
4. 「原材料名」と「原料米・使用米・酒米品種」は必ず別情報として扱う。
   ingredients にはラベルに記載された原材料名をそのまま入れる。例：「米（国産）・米麹（国産米）」
   rice_variety には酒米の品種だけを入れる。例：「山田錦」「雄町」「五百万石」。原材料名から酒米品種を推測しない。
4. 裏ラベルの製造者名は非常に重要な照合材料として扱う。
5. 読めた文字を使ってWeb検索し、蔵元公式サイトや信頼できる商品情報と照合する。
6. 商品名の一部しか読めなくても、銘柄＋特徴語から商品候補を作る。
   例: ラベルに「正雪」「大辛口」が読めれば product を空欄にせず
   「大辛口」またはWeb照合で確認できた正式商品名を入れる。
7. 確証のない情報は断定せず、候補を最大3件返す。
8. JSON以外は絶対に出力しない。

次のJSON形式だけを返してください:

{
  "label_facts": {
    "ocr": "表裏から読めた重要文字",
    "brand": "銘柄名",
    "product": "商品名・サブネーム・識別語",
    "brewery": "蔵元・製造者",
    "prefecture": "都道府県",
    "classification": "純米吟醸・本醸造など",
"ingredients": "原材料名。例：米（国産）、米こうじ（国産米）",
"rice_variety": "酒米の品種。例：山田錦",
"polishing_ratio": "精米歩合。例：60%",
"alcohol": "アルコール度数。例：14度",
"volume": "内容量。例：720ml"
  },
  "candidates": [
    {
      "brand": "銘柄",
      "product": "商品名",
      "brewery": "蔵元",
      "prefecture": "都道府県",
      "classification": "種類",
      "confidence": 0.0,
      "reason": "この候補にした根拠"
    }
  ],
  "web_sources": [],
  "note": ""
}

特に重要:
brand が読めているのに product が完全には読めない場合でも、
ラベル上の商品識別語を product に必ず入れてください。
`;
    const content=[{type:"input_text",text:prompt},{type:"input_image",image_url:front,detail:"low"}];
    if(back) content.push({type:"input_image",image_url:back,detail:"high"});
    const resp=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({model,max_output_tokens:2000,tools:[{type:"web_search"}],input:[{role:"user",content}]})
    });
    const data=await resp.json();
    if(!resp.ok){
      if(resp.status===429) return json({error:data?.error?.message||"OpenAI rate limit",rate_limited:true},429);
      throw new Error(data?.error?.message||"OpenAI recognition error");
    }
    const extractText=(d)=>d.output_text||(d.output||[]).flatMap(x=>x.content||[]).map(x=>x.text||"").join("");
    const cleanJson=(x)=>String(x||"").replace(/^```json\s*/i,"").replace(/^```\s*/,"").replace(/```\s*$/,"").trim();
    const rawText=extractText(data);
let parsed={};
try{
  parsed=JSON.parse(cleanJson(rawText));
}catch(e){
  return json({
    error:"AI返答JSON解析失敗: "+e.message,
    raw_text:rawText.slice(0,1500)
  },500);
}
    const f=parsed.label_facts||{};

// AIが返す項目名の揺れを、酒ログ側の項目名に統一
const nf={
  ...f,
  classification:f.classification||f.type||"",
  ingredients:f.ingredients||"",
  rice_variety:f.rice_variety||f.rice||"",
  polishing_ratio:f.polishing_ratio||f.polishing||"",
  alcohol:f.alcohol||"",
  volume:f.volume||""
};

// 銘柄候補にも、写真から読み取ったラベル情報を引き継ぐ
const candidates=Array.isArray(parsed.candidates)
  ? parsed.candidates
      .filter(c=>c&&c.brand&&Number(c.confidence||0)>=0.45)
      .slice(0,3)
      .map(c=>({
        ...c,
        classification:c.classification||c.type||nf.classification,
        ingredients:c.ingredients||nf.ingredients,
        rice_variety:c.rice_variety||nf.rice_variety,
        polishing_ratio:c.polishing_ratio||nf.polishing_ratio,
        alcohol:c.alcohol||nf.alcohol,
        volume:c.volume||nf.volume
      }))
  :[];

return json({
  ocr_text:nf.ocr||"",
  label_facts:{
    brand:nf.brand||"",
    product:nf.product||"",
    brewery:nf.brewery||"",
    prefecture:nf.prefecture||"",
    classification:nf.classification||"",
    ingredients:nf.ingredients||"",
    rice_variety:nf.rice_variety||"",
    polishing_ratio:nf.polishing_ratio||"",
    alcohol:nf.alcohol||"",
    volume:nf.volume||"",
    other:nf.other||[]
  },
  candidates,
  web_sources:Array.isArray(parsed.web_sources)
    ? parsed.web_sources
        .filter(x=>x&&/^https?:\/\//i.test(String(x.url||"")))
        .slice(0,5)
    :[],
  note:parsed.note||"",
  model_name:model,
  version:"4.9.2",
  api_calls:1
});
  } catch(e) { return json({error:e.message},500); }
}

async function sakenowaMaster() {
  try {
    if(sakenowaCache && Date.now()-sakenowaCacheAt<SAKENOWA_TTL) return json({...sakenowaCache,cached:true},200,"public, max-age=21600");
    const base="https://muro.sakenowa.com/sakenowa-data/api/";
    const rs=await Promise.all(["brands","breweries","areas"].map(x=>fetch(base+x)));
    if(rs.some(r=>!r.ok)) throw new Error("さけのわデータ取得に失敗しました");
    const [brands,breweries,areas]=await Promise.all(rs.map(r=>r.json()));
    sakenowaCache={brands:brands.brands||[],breweries:breweries.breweries||[],areas:areas.areas||[]}; sakenowaCacheAt=Date.now();
    return json({...sakenowaCache,cached:false},200,"public, max-age=21600");
  } catch(e) { return json({error:e.message},502); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Keep the existing frontend endpoints unchanged during the Netlify -> Cloudflare migration.
    if (url.pathname === "/.netlify/functions/recognize-sake" || url.pathname === "/api/recognize-sake") return recognizeSake(request, env);
    if (url.pathname === "/.netlify/functions/sakenowa-master" || url.pathname === "/api/sakenowa-master") return sakenowaMaster();
    return env.ASSETS.fetch(request);
  }
};
