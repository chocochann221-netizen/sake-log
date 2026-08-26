// 和酒ログ MAP: 飲酒記録を地図に出すための共通判定。
// 原則: 自宅は絶対に地点化しない。緯度経度がない記録を推測で置かない。
(function(g){
  function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
  function mapRecord(record){
    if(!record)return {show:false,reason:'no_record'};
    const type=record.place_type||'';
    if(type==='home')return {show:false,reason:'home'};
    const lat=num(record.latitude),lng=num(record.longitude);
    if(lat===null||lng===null)return {show:false,reason:'no_coordinates'};
    if(lat<-90||lat>90||lng<-180||lng>180)return {show:false,reason:'invalid_coordinates'};
    // shop / event は地点表示可。other は明示的な座標が保存されている場合のみ可。
    if(!['shop','event','other'].includes(type))return {show:false,reason:'unknown_place_type'};
    const label=record.restaurant_name||({shop:'飲んだお店',event:'イベント',other:'飲んだ場所'}[type]);
    return {show:true,reason:'ok',lat,lng,label,placeType:type,recordId:record.id||null,brandName:record.brand_name||'',productName:record.product_name||'',drankAt:record.drank_at||null};
  }
  function mapRecords(records){return (records||[]).map(mapRecord).filter(x=>x.show);}
  g.WASHULOG_MAP_RULES={mapRecord,mapRecords};
})(window);
