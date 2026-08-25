// Record detail -> Knowledge Cellar bridge.
// Kept separate from app.js so the existing recording / photo flows stay untouched.
(function(){
  // drinking_records now has rice_variety. Add it at the persistence boundary so
  // the existing, stable save flow in app.js does not need a large rewrite.
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

  function riceVarietyOf(r){
    return r?.rice_variety || r?.riceVariety || r?.riceVarietyName || "";
  }

  function buildKnowledgeUrl(r){
    const q=new URLSearchParams();
    if(r?.brand_name)q.set("brand",r.brand_name);
    if(r?.product_name)q.set("product",r.product_name);
    if(r?.rice)q.set("rice",r.rice);
    const riceVariety=riceVarietyOf(r);
    if(riceVariety)q.set("riceVariety",riceVariety);
    if(r?.polishing_ratio)q.set("polishing",r.polishing_ratio);
    if(r?.classification)q.set("classification",r.classification);
    return "knowledge-entry.html?"+q.toString();
  }

  function injectRiceVariety(r){
    const body=document.getElementById("detailBody");
    const riceVariety=riceVarietyOf(r);
    if(!body||!riceVariety||body.querySelector("[data-rice-variety]")) return;

    const info=body.querySelector(".detail-info");
    if(!info) return;

    const item=document.createElement("div");
    item.setAttribute("data-rice-variety","");
    item.innerHTML=`<b>使用米・原料米</b><span></span>`;
    item.querySelector("span").textContent=riceVariety;
    const polishing=[...info.children].find(el=>/精米歩合/.test(el.textContent||""));
    if(polishing) info.insertBefore(item,polishing);
    else info.appendChild(item);
  }

  function injectKnowledgeLink(r){
    const body=document.getElementById("detailBody");
    if(!body||!r||body.querySelector(".knowledge-entry-card")) return;
    const actions=body.querySelector(".detail-actions");
    if(!actions) return;

    const card=document.createElement("a");
    card.className="knowledge-entry-card";
    card.href=buildKnowledgeUrl(r);
    card.innerHTML=`
      <span class="knowledge-entry-kicker">この一本から、もう少し奥へ</span>
      <strong>この一本を、もっと知る</strong>
      <span class="knowledge-entry-copy">米、精米歩合、造り方など、この酒に関係するところだけを知識の蔵から案内します。</span>
      <span class="knowledge-entry-arrow">知識の蔵へ →</span>`;
    actions.parentNode.insertBefore(card,actions);
  }

  openRecordDetail=async function(recordId){
    await originalOpenRecordDetail(recordId);
    try{
      const r=S?.detailRecord;
      injectRiceVariety(r);
      injectKnowledgeLink(r);
    }catch(e){ console.warn("detail knowledge bridge",e); }
  };
})();
