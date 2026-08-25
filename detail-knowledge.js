// Record detail -> Knowledge Cellar, official brewery, and structured edit bridge.
// Kept separate from app.js so the existing recording / photo flows stay untouched.
(function(){
  if(typeof insert==="function"){
    const originalInsert=insert;
    insert=async function(table,obj){
      if(table==="drinking_records" && obj && !("rice_variety" in obj)){
        const el=document.getElementById("riceVariety");
        obj={...obj,rice_variety:el?.value?.trim()||null};
      }
      return originalInsert(table,obj);
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
  function injectKnowledgeLink(r){
    const body=document.getElementById("detailBody");if(!body||!r||body.querySelector(".knowledge-entry-card"))return;const actions=body.querySelector(".detail-actions");if(!actions)return;
    const card=document.createElement("a");card.className="knowledge-entry-card";card.href=buildKnowledgeUrl(r);card.innerHTML=`<span class="knowledge-entry-kicker">この一本から、もう少し奥へ</span><strong>この一本を、もっと知る</strong><span class="knowledge-entry-copy">米、精米歩合、造り方など、この酒に関係するところだけを知識の蔵から案内します。</span><span class="knowledge-entry-arrow">知識の蔵へ →</span>`;actions.parentNode.insertBefore(card,actions);
  }
  function connectStructuredEditor(r){
    const btn=document.getElementById("editRecordBtn");
    if(!btn||!r?.id)return;
    btn.onclick=()=>{location.href="record-edit.html?id="+encodeURIComponent(r.id);};
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
    try{const r=S?.detailRecord;connectStructuredEditor(r);injectRiceVariety(r);injectKnowledgeLink(r);injectOfficialLink(await getOfficialMaster(r));}catch(e){console.warn("detail bridge",e);}
  };
})();
