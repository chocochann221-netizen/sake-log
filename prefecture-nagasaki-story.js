// 和酒ログ 長崎県ストーリースクロール
// 軍艦島→坂の街→港→夜景→ランタン→島原・雲仙→酒。
// 長崎は「名所の列挙」ではなく、時間と文化の層が重なる感覚をスクロールで見せる。
(function(){
  const q=new URLSearchParams(location.search).get('name')||'高知県';
  if(q!=='長崎県')return;
  const body=document.getElementById('body');
  if(!body||document.querySelector('.nagasaki-story'))return;

  const photos={
    hashima:{
      src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Hashima%2C%20Nagasaki%2C%20Japan%2C%2020240814%201421%203385.jpg?width=1280',
      href:'https://commons.wikimedia.org/wiki/File:Hashima,_Nagasaki,_Japan,_20240814_1421_3385.jpg',
      credit:'Photo: Jakub Hałun / Wikimedia Commons / CC BY 4.0'
    },
    harbor:{
      src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Night%20View%20of%20Nagasaki%20Port%2020151024.JPG?width=1280',
      href:'https://commons.wikimedia.org/wiki/File:Night_View_of_Nagasaki_Port_20151024.JPG',
      credit:'Photo: そらみみ / Wikimedia Commons / CC BY-SA 4.0'
    },
    lantern:{
      src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Nagasaki%20lantern%20Festival%2CNagasaki-city%2CJapan.jpg?width=1280',
      href:'https://commons.wikimedia.org/wiki/File:Nagasaki_lantern_Festival,Nagasaki-city,Japan.jpg',
      credit:'Photo: STA3816 / Wikimedia Commons / CC BY-SA 3.0'
    }
  };

  const esc=s=>String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const photo=(p,alt)=>`<figure class="ng-photo"><img src="${p.src}" alt="${esc(alt)}" loading="lazy" decoding="async"><a href="${p.href}" target="_blank" rel="noopener noreferrer">${esc(p.credit)}</a></figure>`;

  const story=document.createElement('div');
  story.className='nagasaki-story';
  story.innerHTML=`
    <section class="ng-opening">
      <p class="ng-kicker">NAGASAKI / LAYERS OF TIME</p>
      <h2>この街は、<br>ひとつの時代ではない。</h2>
      <p>海の向こうから人と文化が入り、坂の街に暮らしが重なり、港の灯りへつながっていく。長崎は、スクロールするほど時間の層が見えてくる土地。</p>
      <div class="ng-line"><span>海</span><i></i><span>街</span><i></i><span>灯り</span></div>
    </section>

    <section class="ng-scene hashima">
      ${photo(photos.hashima,'長崎沖の端島・軍艦島')}
      <div class="ng-copy light"><span>01 / 端島・軍艦島</span><h2>物語は、<br>海の上から始まる。</h2><p>かつて人が暮らした島の輪郭。観光地として消費するのではなく、産業と生活の痕跡として静かに入口に置く。</p></div>
    </section>

    <section class="ng-step">
      <p class="ng-kicker">02 / THE CITY OF SLOPES</p>
      <h2>船を降りると、<br>街は坂になる。</h2>
      <p>坂、階段、路地、家並み。長崎では「移動すること」そのものが街の景色になる。ここは写真を一枚に固定せず、将来複数の実写を縦に重ねる余白として残す。</p>
      <div class="ng-stairs" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></div>
    </section>

    <section class="ng-harbor-intro">
      <span>03 / PORT</span>
      <h2>坂の先に、<br>また海が見える。</h2>
    </section>

    <section class="ng-scene harbor">
      ${photo(photos.harbor,'夜の長崎港')}
      <div class="ng-copy light"><span>04 / NIGHT VIEW</span><h2>昼の街が、<br>灯りの街に変わる。</h2><p>港を囲む斜面に灯りが重なる。長崎の夜景は「最後のご褒美」ではなく、この街の地形そのものをもう一度見せてくれる。</p></div>
    </section>

    <section class="ng-color-shift">
      <p>そして、色が変わる。</p>
    </section>

    <section class="ng-scene lantern">
      ${photo(photos.lantern,'長崎ランタンフェスティバル')}
      <div class="ng-copy light"><span>05 / LANTERN</span><h2>異国文化は、<br>飾りではなく日常の一部。</h2><p>中国文化をはじめ、長崎には外から来た文化が街の中で形を変えながら残っている。ランタンの光を、長崎の文化の厚みへつなげる。</p></div>
    </section>

    <section class="ng-another">
      <p class="ng-kicker">ANOTHER NAGASAKI</p>
      <h2>長崎市だけで、<br>長崎県は終わらない。</h2>
      <p>島原半島、雲仙、温泉、火山、海。ここで一度ページの空気を変え、「もう一つの長崎」を見せる。都市の物語から、自然と暮らしの物語へ。</p>
      <div class="ng-regions"><span>島原</span><span>雲仙</span><span>温泉</span><span>火山</span></div>
    </section>

    <section class="ng-sake">
      <p class="ng-kicker">FROM PORT TO SAKE</p>
      <h2>港町の記憶から、<br>一本の酒へ。</h2>
      <p>魚介、卓袱料理、異文化の食、島原の水と農。長崎の酒も、ひとつの「県の味」にまとめず、蔵のある土地と食卓から見ていく。</p>
      <div class="ng-path">海 → 街 → 食 → 水 → 蔵 → 一本</div>
    </section>
  `;
  body.insertAdjacentElement('afterbegin',story);

  const style=document.createElement('style');
  style.textContent=`
    body:has(.nagasaki-story) .body{padding-top:0}
    .nagasaki-story{margin:0 -18px 36px;background:#f1eee7;overflow:hidden}
    .ng-opening,.ng-step,.ng-another,.ng-sake{padding:82px 26px 92px}
    .ng-opening{min-height:72svh;display:flex;flex-direction:column;justify-content:center;background:#e9e3d7}
    .ng-kicker{font-size:9px;font-weight:800;letter-spacing:.2em;color:#746e65;margin:0 0 20px}
    .ng-opening h2,.ng-step h2,.ng-another h2,.ng-sake h2,.ng-copy h2,.ng-harbor-intro h2{font-family:serif;font-weight:500;letter-spacing:.02em}
    .ng-opening h2,.ng-step h2,.ng-another h2,.ng-sake h2{font-size:40px;line-height:1.3;margin:0 0 24px;color:#2e302d}
    .ng-opening p,.ng-step p,.ng-another p,.ng-sake p{font-size:14px;line-height:2;color:#5b5d58;max-width:35em}
    .ng-line{display:flex;align-items:center;gap:10px;margin-top:50px;font-size:9px;letter-spacing:.16em;color:#756f67}.ng-line i{height:1px;background:#b7afa3;flex:1}
    .ng-scene{position:relative;min-height:96svh;background:#111;display:flex;align-items:flex-end;overflow:hidden}
    .ng-photo{position:absolute;inset:0;margin:0}.ng-photo img{width:100%;height:100%;object-fit:cover;display:block;filter:saturate(.92)}.ng-photo:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,8,8,.03) 25%,rgba(5,8,8,.8) 100%)}
    .ng-photo a{position:absolute;z-index:3;right:10px;bottom:8px;font-size:8px;color:rgba(255,255,255,.7);text-decoration:none;text-shadow:0 1px 4px #000}
    .ng-copy{position:relative;z-index:2;padding:42px 26px 48px;max-width:520px}.ng-copy.light{color:#fff}.ng-copy>span,.ng-harbor-intro>span{font-size:9px;font-weight:800;letter-spacing:.16em;opacity:.74}.ng-copy h2{font-size:42px;line-height:1.22;margin:12px 0 18px}.ng-copy p{font-size:13px;line-height:1.9;color:rgba(255,255,255,.86);margin:0}
    .ng-step{background:#d7d0c4;min-height:76svh}.ng-stairs{margin-top:48px;display:flex;flex-direction:column;align-items:flex-start;gap:7px}.ng-stairs b{height:1px;background:#8e877d;display:block}.ng-stairs b:nth-child(1){width:35%}.ng-stairs b:nth-child(2){width:48%}.ng-stairs b:nth-child(3){width:62%}.ng-stairs b:nth-child(4){width:76%}.ng-stairs b:nth-child(5){width:92%}
    .ng-harbor-intro{height:46svh;background:#25313a;color:#edf1f3;display:flex;flex-direction:column;justify-content:center;padding:40px 26px}.ng-harbor-intro h2{font-size:34px;line-height:1.35;margin:12px 0 0}.ng-harbor-intro>span{color:#aebbc2}
    .ng-color-shift{height:30svh;display:grid;place-items:center;background:linear-gradient(180deg,#19191b,#541b1d);color:#f6ded4}.ng-color-shift p{font-family:serif;font-size:18px;letter-spacing:.12em}
    .ng-scene.lantern .ng-photo:after{background:linear-gradient(180deg,rgba(30,3,4,.06),rgba(32,4,5,.76))}
    .ng-another{background:#e6e8e2;min-height:72svh}.ng-regions{margin-top:42px;display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #aeb3ab;border-left:1px solid #aeb3ab}.ng-regions span{padding:22px 12px;border-right:1px solid #aeb3ab;border-bottom:1px solid #aeb3ab;font-family:serif;font-size:17px}
    .ng-sake{background:#f5f0e5;padding-top:96px;padding-bottom:104px}.ng-path{margin-top:44px;font-family:serif;font-size:18px;letter-spacing:.06em;color:#47514a}
    @media(min-width:681px){.nagasaki-story{margin-left:0;margin-right:0}.ng-opening,.ng-step,.ng-another,.ng-sake{padding-left:48px;padding-right:48px}.ng-copy{padding-left:48px}.ng-harbor-intro{padding-left:48px}.ng-scene{min-height:760px}.ng-copy h2{font-size:52px}.ng-photo a{font-size:9px}}
  `;
  document.head.appendChild(style);
})();
