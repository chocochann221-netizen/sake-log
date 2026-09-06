// 和酒ログ 大阪府ストーリースクロール
// 太陽の塔→ネオン→新世界→食→だんじり→酒。
(function(){
  const q=new URLSearchParams(location.search).get('name')||'高知県';
  if(q!=='大阪府')return;
  const body=document.getElementById('body');
  if(!body||document.querySelector('.osaka-story'))return;

  const story=document.createElement('div');
  story.className='osaka-story';
  story.innerHTML=`
    <section class="os-opening"><p class="os-kicker">OSAKA / TOO MUCH IS JUST ENOUGH</p><h2>まとまらない。<br>それが、大阪。</h2><p>芸術、ネオン、商い、食、祭り。ひと駅動くだけで、空気が変わる。</p><div class="os-cue">SCROLL. 次、もう来ます ↓</div></section>
    <section class="os-poster tower"><div class="os-number">01</div><div class="os-copy"><span>万博記念公園</span><h2>最初から、<br>普通じゃない。</h2><p>太陽の塔が、空に向かって立っている。大阪の旅は、いきなり強い。</p></div></section>
    <section class="os-flash"><strong>ほな、次。</strong><span>EXPO → NEON</span></section>
    <section class="os-poster neon"><div class="os-word">夜</div><div class="os-copy"><span>道頓堀</span><h2>静かにする気、<br>あんまりない。</h2><p>看板、人、川、光。夜になっても、街の勢いは落ちない。</p></div></section>
    <section class="os-split"><div><small>03</small><strong>新世界</strong><p>通天閣、路地、店の気配。</p></div><div><small>04</small><strong>粉もん</strong><p>たこ焼き、お好み焼き。街角から湯気が立つ。</p></div><div><small>05</small><strong>商い</strong><p>店と客、人と人の距離が近い。</p></div></section>
    <section class="os-festival"><p class="os-kicker">06 / KISHIWADA</p><h2>街は、<br>走ることもある。</h2><p>岸和田だんじり祭。木の車輪の音と掛け声が、街を一気に祭りへ変える。</p><div class="os-speed">祭 → 人 → 音 → 街</div></section>
    <section class="os-quiet"><p class="os-kicker">THEN, SAKE</p><h2>少しだけ、<br>静かな方へ。</h2><p>賑やかな街を離れると、酒を醸す時間がある。水、米、造り手。大阪の一本にも、ちゃんと土地がある。</p><div class="os-path">街の記憶 → 食 → 水 → 蔵 → 一本</div></section>`;
  body.insertAdjacentElement('afterbegin',story);

  const style=document.createElement('style');
  style.textContent=`body:has(.osaka-story) .body{padding-top:0}.osaka-story{margin:0 -18px 36px;overflow:hidden;background:#f2eee5}.os-opening,.os-festival,.os-quiet{padding:72px 24px 82px}.os-opening{min-height:76svh;display:flex;flex-direction:column;justify-content:center;background:#f0df36;color:#181818}.os-kicker{font-size:9px;font-weight:900;letter-spacing:.18em;margin:0 0 18px;opacity:.62}.os-opening h2,.os-copy h2,.os-festival h2,.os-quiet h2{font-family:serif;font-weight:600}.os-opening h2{font-size:44px;line-height:1.14;margin:0 0 24px}.os-opening p,.os-festival p,.os-quiet p{font-size:14px;line-height:2;max-width:34em}.os-cue{margin-top:48px;font-size:10px;font-weight:900;letter-spacing:.08em}.os-poster{min-height:90svh;position:relative;display:flex;align-items:flex-end;padding:28px 24px 44px;overflow:hidden}.os-poster.tower{background:#e54b2d;color:#fff}.os-poster.neon{background:#101523;color:#fff}.os-number,.os-word{position:absolute;right:-12px;top:8px;font-family:serif;font-size:46vw;line-height:.8;font-weight:900;opacity:.13}.os-copy{position:relative;z-index:2;max-width:500px}.os-copy span{font-size:10px;font-weight:900;letter-spacing:.15em}.os-copy h2{font-size:43px;line-height:1.17;margin:10px 0 18px}.os-copy p{font-size:13px;line-height:1.9;margin:0;max-width:32em}.os-flash{height:30svh;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:24px;transform:rotate(-2deg) scale(1.03)}.os-flash strong{font-family:serif;font-size:28px}.os-flash span{font-size:8px;letter-spacing:.15em}.os-split{display:grid;grid-template-columns:1fr;background:#171717;color:#fff}.os-split>div{padding:38px 24px;border-bottom:1px solid #444;min-height:180px}.os-split small{font-size:9px;opacity:.5}.os-split strong{display:block;font-family:serif;font-size:30px;margin:8px 0}.os-split p{font-size:12px;opacity:.7;margin:0}.os-festival{background:#d6e3ea;min-height:70svh;display:flex;flex-direction:column;justify-content:center}.os-festival h2,.os-quiet h2{font-size:40px;line-height:1.22;margin:0 0 20px}.os-speed{margin-top:38px;font-size:18px;font-weight:900;letter-spacing:.08em}.os-quiet{background:#e9e2d3;min-height:78svh;display:flex;flex-direction:column;justify-content:center}.os-path{margin-top:42px;padding-top:18px;border-top:1px solid #a99f8c;font-family:serif;font-size:16px;letter-spacing:.05em}@media(min-width:681px){.osaka-story{margin-left:0;margin-right:0}.os-opening,.os-festival,.os-quiet{padding-left:48px;padding-right:48px}.os-poster{padding-left:48px}.os-number,.os-word{font-size:300px}.os-split{grid-template-columns:repeat(3,1fr)}.os-split>div{border-right:1px solid #444;border-bottom:0}}`;
  document.head.appendChild(style);
})();
