// Record detail -> Knowledge Cellar bridge.
// Kept separate from app.js so the existing recording / photo flows stay untouched.
(function(){
  if(typeof openRecordDetail!=="function") return;

  const originalOpenRecordDetail=openRecordDetail;

  function buildKnowledgeUrl(r){
    const q=new URLSearchParams();
    if(r?.brand_name)q.set("brand",r.brand_name);
    if(r?.product_name)q.set("product",r.product_name);
    if(r?.rice)q.set("rice",r.rice);
    if(r?.polishing_ratio)q.set("polishing",r.polishing_ratio);
    if(r?.classification)q.set("classification",r.classification);
    return "knowledge-entry.html?"+q.toString();
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
    try{ injectKnowledgeLink(S?.detailRecord); }catch(e){ console.warn("knowledge link",e); }
  };
})();
