let sakenowaCache = null;
let sakenowaCacheAt = 0;
const SAKENOWA_TTL = 6 * 60 * 60 * 1000;

const json = (body, status = 200, cacheControl = "no-store") =>
  new Response(JSON.stringify(body), {
    status,
    headers: {"Content-Type":"application/json; charset=utf-8","Cache-Control":cacheControl}
  });

async function recognizeSake(request, env) {
  if (request.method !== "POST") return json({error:"Method not allowed"}, 405);
  if (!env.OPENAI_API_KEY) return json({error:"Cloudflare環境変数 OPENAI_API_KEY が未設定です"}, 503);
  try {
    const {front, back} = await request.json();
    if (!front) return json({error:"表ラベル画像が必要です"}, 400);
    const model = env.OPENAI_MODEL || "gpt-5.4-mini";
    const prompt = `日本酒ボトルを解析してください。写真の文字読取とWebでの商品同定を同時に行います。\n\n最重要ルール:\n1. label_facts の ingredients / rice_variety / polishing_ratio / alcohol / volume は「写真に実際に写っている文字」だけから転記。Web知識・商品知識・推測で補完・訂正しない。読めなければ空文字。\n2. candidates はWeb検索で実在確認した商品候補。Webは銘柄・商品名・蔵元・都道府県・分類の同定に使う。\n3. 写真とWebで容量・度数・精米歩合・原材料が違う場合、label_factsは写真の値を保持し、差異は candidate.discrepancies に書く。\n4. 裏ラベルがある場合、法定表示欄を高優先で確認。14/15/16度、720ml/1800ml/1.8Lなどの読み違いに注意。\n5. ingredients は原材料名の行。rice_variety は使用米・品種で、別項目。\n6. 候補は最大3件。URLは実際にWeb検索で確認できたものだけ。\n\nJSONのみ:\n{"label_facts":{"brand":"","product":"","brewery":"","prefecture":"","classification":"","ingredients":"","rice_variety":"","polishing_ratio":"","alcohol":"","volume":"","ocr":""},"candidates":[{"brand":"","product":"","brewery":"","prefecture":"","classification":"","confidence":0.0,"web_verified":true,"reason":"","discrepancies":[]}],"web_sources":[{"title":"","url":"","domain":"","supports":""}],"note":""}`;
    const content=[{type:"input_text",text:prompt},{type:"input_image",image_url:front,detail:"low"}];
    if(back) content.push({type:"input_image",image_url:back,detail:"high"});
    const resp=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({model,max_output_tokens:850,tools:[{type:"web_search"}],input:[{role:"user",content}]})
    });
    const data=await resp.json();
    if(!resp.ok){
      if(resp.status===429) return json({error:data?.error?.message||"OpenAI rate limit",rate_limited:true},429);
      throw new Error(data?.error?.message||"OpenAI recognition error");
    }
    const extractText=(d)=>d.output_text||(d.output||[]).flatMap(x=>x.content||[]).map(x=>x.text||"").join("");
    const cleanJson=(x)=>String(x||"").replace(/^```json\s*/i,"").replace(/^```\s*/,"").replace(/```\s*$/,"").trim();
    let parsed={}; try{parsed=JSON.parse(cleanJson(extractText(data)))}catch{}
    const f=parsed.label_facts||{};
    const candidates=Array.isArray(parsed.candidates)?parsed.candidates.filter(c=>c&&c.brand&&Number(c.confidence||0)>=0.45).slice(0,3):[];
    for(const c of candidates){delete c.ingredients;delete c.rice;delete c.rice_variety;delete c.polishing_ratio;delete c.alcohol;delete c.volume;}
    return json({
      ocr_text:f.ocr||"",
      label_facts:{brand:f.brand||"",product:f.product||"",brewery:f.brewery||"",prefecture:f.prefecture||"",classification:f.classification||"",ingredients:f.ingredients||"",rice_variety:f.rice_variety||"",polishing_ratio:f.polishing_ratio||"",alcohol:f.alcohol||"",volume:f.volume||"",other:[]},
      candidates,
      web_sources:Array.isArray(parsed.web_sources)?parsed.web_sources.filter(x=>x&&/^https?:\/\//i.test(String(x.url||""))).slice(0,5):[],
      note:parsed.note||"",model_name:model,version:"4.9.2",api_calls:1
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
    if (url.pathname === "/.netlify/functions/recognize-sake") return recognizeSake(request, env);
    if (url.pathname === "/.netlify/functions/sakenowa-master") return sakenowaMaster();
    return env.ASSETS.fetch(request);
  }
};
