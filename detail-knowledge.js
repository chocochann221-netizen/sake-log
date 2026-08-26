// Record detail -> Knowledge Cellar, official brewery bridge, and Washu Log v1 memory layer.
// Kept separate from app.js so the existing recording / photo / recognition flows stay stable.
(function(){
  function valueOf(id){return document.getElementById(id)?.value?.trim()||"";}

  // Keep record persistence compatible while adding v1 fields without touching the recognition core.
  if(typeof insert==="function"){
    const originalInsert=insert;
    insert=async function(table,obj){
      if(table==="drinking_records" && obj){
        if(!("rice_variety" in obj)){
          const el=document.getElementById("riceVariety");
          obj={...obj,rice_variety:el?.value?.trim()||null};
        }
        if(!("companion_name" in obj)){
          obj={...obj,companion_name:valueOf("companion")||null};
        }
      }
      return originalInsert(table,obj);
    };
  }

  if(typeof updateRow==="function"){
    const originalUpdateRow=updateRow;
    updateRow=async function(table,id,obj){
      if(table==="drinking_records" && obj && document.getElementById("eCompanion")){
        obj={...obj,companion_name:valueOf("eCompanion")||null};
      }
      return originalUpdateRow(table,id,obj);
    };
  }

  function addV1Styles(){
    if(document.getElementById("washulogV1Styles"))return;
    const style=document.createElement("style");
    style.id="washulogV1Styles";
    style.textContent=`
      :root{--washi:#f6f0e5;--ink:#29251f;--wood:#74533a;--wood2:#9a7758;--moss:#536656;--line:#ddd0bf;--paper:#fffdf8}
      body{background:var(--washi);color:var(--ink)}
      header{background:rgba(255,253,248,.96);border-bottom-color:var(--line)}
      .brand{letter-spacing:.04em}.pill{background:#eee3d4;color:var(--wood)}
      .card{background:var(--paper);border-color:var(--line);box-shadow:0 5px 18px rgba(80,60,40,.045)}
      .hero{background:linear-gradient(145deg,#fffaf0,#eee4d4);position:relative;overflow:hidden}
      .hero:after{content:"";position:absolute;width:88px;height:88px;border:12px solid rgba(116,83,58,.10);right:-26px;top:-32px;border-radius:50%}
      .primary{background:var(--wood);color:white}.secondary{background:#eee5d8;color:#674a34}.outline{background:#fffdf8;border-color:var(--line);color:var(--ink)}
      nav{background:#fffdf8;border-top-color:var(--line)}.navbtn.active{color:var(--wood)}
      .tag{background:#eee8dc;color:#64513e}.sake-card{border-color:var(--line);background:#fffdf9}.sake-comment,.detail-info>div{background:#f7f1e7}
      .memory-prompt{margin:14px 0 2px;padding:14px 15px;border-left:3px solid var(--wood2);background:#f7f0e6;border-radius:4px 12px 12px 4px}
      .memory-prompt strong{display:block;margin-bottom:3px}.memory-prompt span{font-size:12px;color:#756b60;line-height:1.6}
      .memory-strip{margin:14px 0;padding:13px 14px;background:#f7f0e6;border-radius:14px;line-height:1.7}
      .memory-strip b{color:var(--wood)}
      #foodPreview,#memoryPreview{width:100%;max-height:260px;object-fit:cover;border-radius:14px;margin-top:8px}
    `;
    document.head.appendChild(style);
  }

  function ensureCompanionField(){
    if(document.getElementById("companion"))return;
    const restaurant=document.getElementById("restaurant");
    if(!restaurant)return;
    const restaurantLabel=restaurant.previousElementSibling;
    const label=document.createElement("label");
    label.setAttribute("for","companion");
    label.textContent="誰と飲んだ？（任意）";
    const input=document.createElement("input");
    input.id="companion";
    input.placeholder="例：家族と、○○さんと、一人でゆっくり";
    if(restaurantLabel)restaurantLabel.parentNode.insertBefore(label,restaurantLabel);
    else restaurant.parentNode.insertBefore(label,restaurant);
    label.insertAdjacentElement("afterend",input);
  }

  function addMemoryPrompt(){
    if(document.querySelector(".memory-prompt"))return;
    const section=document.querySelector(".memory-photo-section");
    if(!section)return;
    const h=section.querySelector("h3");
    if(!h)return;
    const box=document.createElement("div");
    box.className="memory-prompt";
    box.innerHTML="<strong>酒だけじゃなく、今日の時間も。</strong><span>料理や食卓の写真はAIで判定しません。未来の自分が見て思い出せれば、それで十分です。</span>";
    h.insertAdjacentElement("afterend",box);
  }

  function renameShell(){
    document.title="和酒ログ";
    const brand=document.querySelector("header .brand");
    if(brand)brand.innerHTML='🍶 和酒ログ <span class="pill">v1 preview</span>';
    const homeTitle=document.querySelector("#homeView .hero h2");
    if(homeTitle)homeTitle.textContent="今日、何を飲む？";
    const save=document.getElementById("saveRecordBtn");
    if(save)save.textContent="この一杯をLOGする";
    const historyTitle=document.querySelector("#historyView h2");
    if(historyTitle)historyTitle.textContent="🍶 MY LOG";
    const historyCopy=document.querySelector("#historyView .small");
    if(historyCopy)historyCopy.textContent="飲んだ酒と、その日にあった時間を残していきます。";
    const analysisTitle=document.querySelector("#analysisView h2");
    if(analysisTitle)analysisTitle.textContent="📊 わたしの和酒ログ";
  }

  addV1Styles();
  renameShell();
  ensureCompanionField();
  addMemoryPrompt();

  if(typeof resetRecord==="function"){
    const originalResetRecord=resetRecord;
    resetRecord=function(){
      originalResetRecord();
      const companion=document.getElementById("companion");
      if(companion)companion.value="";
    };
  }

  // Show "who with" naturally in MY LOG, without turning the app into a social feed.
  if(typeof renderRows==="function"){
    const originalRenderRows=renderRows;
    renderRows=function(rows){
      const displayRows=(rows||[]).map(r=>({
        ...r,
        restaurant_name:[r.companion_name?`${r.companion_name}と`:"",r.restaurant_name||""].filter(Boolean).join(" ・ ")
      }));
      return originalRenderRows(displayRows);
    };
  }

  if(typeof openRecordDetail!=="function") return;
  const originalOpenRecordDetail=openRecordDetail;

  function riceVarietyOf(r){return r?.rice_variety||r?.riceVariety||r?.riceVarietyName||"";}
  function buildKnowledgeUrl(r){
    const q=new URLSearchParams();
    if(r?.brand_name)q.set("brand",r.brand_name);if(r?.product_name)q.set("product",r.product_name);if(r?.rice)q.set("rice",r.rice);
    const rv=riceVarietyOf(r);if(rv)q.set("riceVariety",rv);if(r?.polishing_ratio)q.set("polishing",r.polishing_ratio);if(r?.classification)q.set("classification",r.classification);
    return "knowledge-entry.html?"+q.toString();
  }
  function injectRiceVariety(r){
    const body=document.getElementById("detailBody"),rv=riceVarietyOf(r);if(!body||!rv||body.querySelector("[data-rice-variety]"))return;
    const info=body.querySelector(".detail-info");if(!info)return;const item=document.createElement("div");item.setAttribute("data-rice-variety","");item.innerHTML=`<b>使用米・原料米</b><span></span>`;item.querySelector("span").textContent=rv;
    const polishing=[...info.children].find(el=>/精米歩合/.test(el.textContent||""));if(polishing)info.insertBefore(item,polishing);else info.appendChild(item);
  }
  function injectMemoryStrip(r){
    const body=document.getElementById("detailBody");if(!body||!r||body.querySelector("[data-memory-strip]"))return;
    if(!r.companion_name&&!r.restaurant_name)return;
    const rating=body.querySelector(".detail-rating");if(!rating)return;
    const box=document.createElement("div");box.className="memory-strip";box.setAttribute("data-memory-strip","");
    const parts=[];
    if(r.companion_name)parts.push(`<b>誰と</b> ${escapeHtml(r.companion_name)}`);
    if(r.restaurant_name)parts.push(`<b>どこで</b> ${escapeHtml(r.restaurant_name)}`);
    box.innerHTML=parts.join("<br>");
    rating.insertAdjacentElement("afterend",box);
  }
  function injectKnowledgeLink(r){
    const body=document.getElementById("detailBody");if(!body||!r||body.querySelector(".knowledge-entry-card"))return;const actions=body.querySelector(".detail-actions");if(!actions)return;
    const card=document.createElement("a");card.className="knowledge-entry-card";card.href=buildKnowledgeUrl(r);card.innerHTML=`<span class="knowledge-entry-kicker">この一本から、もう少し奥へ</span><strong>この一本を、もっと知る</strong><span class="knowledge-entry-copy">米、精米歩合、造り方など、この酒に関係するところだけを知識の蔵から案内します。</span><span class="knowledge-entry-arrow">知識の蔵へ →</span>`;actions.parentNode.insertBefore(card,actions);
  }
  async function getOfficialMaster(r){
    if(!r?.brand_name||typeof authFetch!=="function")return null;
    try{
      const url=BASE+"/rest/v1/sake_master?select=brewery_name,brewery_official_url,product_official_url&brand_name=eq."+encodeURIComponent(r.brand_name)+"&limit=1";
      const res=await authFetch(url,{headers:{apikey:cfgKey(),Authorization:"Bearer "+S.token}});if(!res.ok)return null;const rows=await res.json();return rows?.[0]||null;
    }catch(e){console.warn("official brewery lookup",e);return null;}
  }
  function injectOfficialLink(master){
    const body=document.getElementById("detailBody"),actions=body?.querySelector(".detail-actions");if(!body||!actions||body.querySelector("[data-official-brewery]"))return;
    const url=master?.product_official_url||master?.brewery_official_url;if(!/^https?:\/\//i.test(url||""))return;
    const a=document.createElement("a");a.setAttribute("data-official-brewery","");a.className="knowledge-entry-card";a.href=url;a.target="_blank";a.rel="noopener noreferrer";
    const brewery=master?.brewery_name||"蔵元";a.innerHTML=`<span class="knowledge-entry-kicker">造り手の言葉へ</span><strong>造り手を知る</strong><span class="knowledge-entry-copy"></span><span class="knowledge-entry-arrow">蔵元公式サイトへ ↗</span>`;a.querySelector(".knowledge-entry-copy").textContent=brewery+"の公式ページで、この酒と酒造りをもっと知る。";actions.parentNode.insertBefore(a,actions);
  }

  openRecordDetail=async function(recordId){
    await originalOpenRecordDetail(recordId);
    try{
      const r=S?.detailRecord;
      injectRiceVariety(r);
      injectMemoryStrip(r);
      injectKnowledgeLink(r);
      injectOfficialLink(await getOfficialMaster(r));
    }catch(e){console.warn("detail knowledge bridge",e);}
  };

  if(typeof renderRecordEditor==="function"){
    const originalRenderRecordEditor=renderRecordEditor;
    renderRecordEditor=function(r){
      originalRenderRecordEditor(r);
      if(document.getElementById("eCompanion"))return;
      const restaurant=document.getElementById("eRestaurant");
      if(!restaurant)return;
      const wrap=document.createElement("div");
      wrap.innerHTML='<label>誰と飲んだ？</label><input id="eCompanion">';
      wrap.querySelector("input").value=r?.companion_name||"";
      restaurant.closest("div")?.insertAdjacentElement("beforebegin",wrap);
    };
  }
})();