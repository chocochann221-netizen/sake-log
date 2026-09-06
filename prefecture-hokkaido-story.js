// 和酒ログ 北海道ストーリースクロール
// 流氷→知床→美瑛→札幌→アイヌ文化→函館→食→米→酒。
(function(){
  const q=new URLSearchParams(location.search).get('name')||'高知県';
  if(q!=='北海道')return;
  const body=document.getElementById('body');
  if(!body||document.querySelector('.hokkaido-story'))return;

  const photos={
    drift:{src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Hokkaido-Drift%20ice%2C%20Shiretoko%20Peninsula-xl.jpg?width=1280',href:'https://commons.wikimedia.org/wiki/File:Hokkaido-Drift_ice,_Shiretoko_Peninsula-xl.jpg',credit:'Photo: kkawamura / FIND/47 / Wikimedia Commons / CC BY 4.0'},
    biei:{src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Biei%20Hokkaido.jpg?width=1280',href:'https://commons.wikimedia.org/wiki/File:Biei_Hokkaido.jpg',credit:'Photo: Jialiang Gao / Wikimedia Commons / CC BY-SA 3.0'},
    hakodate:{src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Night%20view%20of%20Hakodate.jpg?width=1280',href:'https://commons.wikimedia.org/wiki/File:Night_view_of_Hakodate.jpg',credit:'Photo: Lombroso / Wikimedia Commons / Public Domain'}
  };
  const esc=s=>String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const photo=(p,alt)=>`<figure class="hk-photo"><img src="${p.src}" alt="${esc(alt)}" loading="lazy" decoding="async"><a href="${p.href}" target="_blank" rel="noopener noreferrer">${esc(p.credit)}</a></figure>`;

  const story=document.createElement('div');
  story.className='hokkaido-story';
  story.innerHTML=`
    <section class="hk-opening"><p class="hk-kicker">HOKKAIDO / A JOURNEY OF DISTANCE</p><h2>広すぎる。<br>だから、旅になる。</h2><p>海の果てから、畑へ。街へ。港へ。北海道は、少し移動するだけで景色が大きく変わる。</p><div class="hk-distance"><span>オホーツク</span><i></i><span>函館</span></div></section>
    <section class="hk-scene ice">${photo(photos.drift,'知床半島の流氷')}<div class="hk-copy light"><span>01 / オホーツク</span><h2>旅は、<br>流氷から始まる。</h2><p>冬の海を埋める白い流氷。知床の冷たい風の向こうに、北海道の大きさが広がっている。</p></div></section>
    <section class="hk-mile"><strong>次の景色まで、まだ遠い。</strong><span>SHIRETOKO → BIEI</span></section>
    <section class="hk-scene biei">${photo(photos.biei,'美瑛の丘と畑')}<div class="hk-copy light"><span>02 / 美瑛</span><h2>海の白から、<br>畑の色へ。</h2><p>丘を越えるたび、畑の色が変わる。知床とはまるで違う北海道が、ここにある。</p></div></section>
    <section class="hk-city"><p class="hk-kicker">03 / SAPPORO</p><h2>そして、街へ。</h2><p>市場の声、冬の空気、温かい食卓。自然の大きさの中にも、北海道の日々の暮らしがある。</p><div class="hk-grid"><span>時計台</span><span>市場</span><span>冬の街</span><span>食卓</span></div></section>
    <section class="hk-culture"><p class="hk-kicker">04 / AINU CULTURE</p><h2>この土地には、<br>もっと長い時間がある。</h2><p>北海道には、自然と深く関わりながら受け継がれてきたアイヌの文化がある。言葉、暮らし、祈り、ものづくり。その時間にも触れてみたい。</p></section>
    <section class="hk-mile dark"><strong>南へ。</strong><span>SAPPORO → HAKODATE</span></section>
    <section class="hk-scene hakodate">${photo(photos.hakodate,'函館山から見た函館の夜景')}<div class="hk-copy light"><span>05 / 函館</span><h2>最後は、<br>夜の港へ。</h2><p>両側を海に挟まれた街に灯りが浮かぶ。長い移動の終わりに、人の営みが近くなる。</p></div></section>
    <section class="hk-sake"><p class="hk-kicker">FROM LAND TO SAKE</p><h2>広い土地を、<br>一本に縮めない。</h2><p>海産物、乳製品、畑作、米づくり。地域が変われば、食も水も暮らしも変わる。飲んだ一本から、その蔵がある町へ向かってみる。</p><div class="hk-path">食 → 米 → 水 → 蔵 → 一本</div></section>`;
  body.insertAdjacentElement('afterbegin',story);

  const style=document.createElement('style');
  style.textContent=`body:has(.hokkaido-story) .body{padding-top:0}.hokkaido-story{margin:0 -18px 36px;background:#eef2f1;overflow:hidden}.hk-opening,.hk-city,.hk-culture,.hk-sake{padding:82px 26px 88px}.hk-opening{background:#eef2f1;min-height:72svh;display:flex;flex-direction:column;justify-content:center}.hk-kicker{font-size:9px;font-weight:800;letter-spacing:.19em;color:#66736e;margin:0 0 20px}.hk-opening h2,.hk-city h2,.hk-culture h2,.hk-sake h2,.hk-copy h2{font-family:serif;font-weight:500;letter-spacing:.02em}.hk-opening h2,.hk-city h2,.hk-culture h2,.hk-sake h2{font-size:40px;line-height:1.28;margin:0 0 24px}.hk-opening p,.hk-city p,.hk-culture p,.hk-sake p{font-size:14px;line-height:2;color:#59655f;max-width:35em}.hk-distance{display:flex;align-items:center;gap:12px;margin-top:52px;font-size:9px;letter-spacing:.14em;color:#74807b}.hk-distance i{height:1px;background:#aab5b0;flex:1}.hk-scene{position:relative;min-height:100svh;background:#111;display:flex;align-items:flex-end;overflow:hidden}.hk-photo{position:absolute;inset:0;margin:0}.hk-photo img{width:100%;height:100%;object-fit:cover;display:block}.hk-photo:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,10,12,.04) 28%,rgba(5,10,12,.8) 100%)}.hk-photo a{position:absolute;z-index:3;right:10px;bottom:8px;font-size:8px;color:rgba(255,255,255,.68);text-decoration:none;text-shadow:0 1px 4px #000}.hk-copy{position:relative;z-index:2;padding:42px 26px 48px;max-width:520px}.hk-copy.light{color:#fff}.hk-copy>span{font-size:9px;font-weight:800;letter-spacing:.16em;opacity:.72}.hk-copy h2{font-size:42px;line-height:1.22;margin:12px 0 18px}.hk-copy p{font-size:13px;line-height:1.9;color:rgba(255,255,255,.86);margin:0}.hk-mile{height:52svh;background:#dfe9e7;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:18px}.hk-mile strong{font-family:serif;font-size:21px;font-weight:500}.hk-mile span{font-size:9px;letter-spacing:.2em;color:#6b7772}.hk-mile.dark{background:#18211e;color:#edf3f0}.hk-mile.dark span{color:#9caaa4}.hk-city{background:#e7e0d4}.hk-grid{margin-top:42px;display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #b8b0a4;border-left:1px solid #b8b0a4}.hk-grid span{padding:24px 12px;border-right:1px solid #b8b0a4;border-bottom:1px solid #b8b0a4;font-family:serif;font-size:16px}.hk-culture{background:#252a27;color:#f0eee6}.hk-culture .hk-kicker,.hk-culture p{color:#b9c0bc}.hk-sake{background:#f4f0e8;padding-top:96px;padding-bottom:104px}.hk-path{margin-top:44px;font-family:serif;font-size:18px;letter-spacing:.08em;color:#425049}@media(min-width:681px){.hokkaido-story{margin-left:0;margin-right:0}.hk-opening,.hk-city,.hk-culture,.hk-sake{padding-left:48px;padding-right:48px}.hk-copy{padding-left:48px}.hk-scene{min-height:760px}.hk-copy h2{font-size:52px}.hk-photo a{font-size:9px}}`;
  document.head.appendChild(style);
})();
