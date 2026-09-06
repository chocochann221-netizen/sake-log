// 和酒ログ 奈良県ストーリースクロール
// 実写中心。鹿→南大門→大仏→正暦寺・菩提酛→酒の源流。
(function(){
  const q=new URLSearchParams(location.search).get('name')||'高知県';
  if(q!=='奈良県')return;
  const body=document.getElementById('body');
  if(!body)return;

  const photos={
    nandaimon:{
      src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/20100716%20Nara%20Todaiji%20Nandaimon%202252.jpg?width=1280',
      href:'https://commons.wikimedia.org/wiki/File:20100716_Nara_Todaiji_Nandaimon_2252.jpg',
      credit:'Photo: Jakub Hałun / Wikimedia Commons / CC BY-SA 4.0'
    },
    daibutsu:{
      src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/The%20Great%20Buddha%20(Daibutsu)%20of%20Nara%20(4797244531).jpg?width=1280',
      href:'https://commons.wikimedia.org/wiki/File:The_Great_Buddha_(Daibutsu)_of_Nara_(4797244531).jpg',
      credit:'Photo: Francisco Restivo / Wikimedia Commons / CC BY 2.0'
    },
    shoryakuji:{
      src:'https://commons.wikimedia.org/wiki/Special:Redirect/file/%E6%AD%A3%E6%9A%A6%E5%AF%BA%20Sh%C5%8Dryaku-ji%2C%20Nara%20-%20Nov%2025%2C%202010.jpg?width=1280',
      href:'https://commons.wikimedia.org/wiki/File:%E6%AD%A3%E6%9A%A6%E5%AF%BA_Sh%C5%8Dryaku-ji%2C_Nara_-_Nov_25%2C_2010.jpg',
      credit:'Photo: Tamago Moffle / Wikimedia Commons / CC BY-SA 2.0'
    }
  };

  const esc=s=>String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const photo=(p,cls='')=>`<figure class="nara-photo ${cls}"><img src="${p.src}" alt="" loading="lazy" decoding="async"><a href="${p.href}" target="_blank" rel="noopener noreferrer">${esc(p.credit)}</a></figure>`;

  const story=document.createElement('div');
  story.className='nara-story';
  story.innerHTML=`
    <section class="nara-opening">
      <p class="nara-eyebrow">A WALK INTO NARA</p>
      <h2>鹿と古都から、<br>酒の記憶へ。</h2>
      <p>朝の奈良を、ゆっくり歩く。鹿のいる景色を抜け、古い門をくぐる。町の時間をたどるうちに、一本の酒につながる奈良が見えてくる。</p>
      <div class="nara-cue">SCROLL TO WALK ↓</div>
    </section>

    <section class="nara-chapter gate">
      ${photo(photos.nandaimon,'full')}
      <div class="nara-copy overlay-copy">
        <span>01 / 南大門</span>
        <h2>門を、<br>くぐる。</h2>
        <p>見上げるほど大きな門と仁王像。ここから、街の音が少しずつ遠くなる。</p>
      </div>
    </section>

    <section class="nara-pause" aria-hidden="true"><div class="line"></div></section>

    <section class="nara-chapter buddha">
      ${photo(photos.daibutsu,'portrait')}
      <div class="nara-copy">
        <span>02 / 東大寺</span>
        <h2>見上げる。</h2>
        <p>長い時間、この場所で人を迎えてきた大仏。写真で知っていたはずの姿も、ここまで歩いてくると少し違って見える。</p>
      </div>
    </section>

    <section class="nara-transition">
      <p class="nara-eyebrow">FROM PRAYER TO SAKE</p>
      <h2>祈りの土地を、<br>もう少し歩く。</h2>
      <p>寺院の歴史をたどっていくと、奈良のもう一つの顔が見えてくる。酒造りの記憶もまた、この土地に積み重なっている。</p>
    </section>

    <section class="nara-chapter sake-origin">
      ${photo(photos.shoryakuji,'full')}
      <div class="nara-copy overlay-copy dark-copy">
        <span>03 / 正暦寺・菩提酛</span>
        <h2>酒の記憶へ。</h2>
        <p>寺院で育まれた酒造りの歴史。その続きを、いま奈良で造られる一本からたどっていく。</p>
      </div>
    </section>
  `;

  body.insertAdjacentElement('afterbegin',story);

  const style=document.createElement('style');
  style.textContent=`
    body:has(.nara-story) .body{padding-top:0}
    .nara-story{margin:0 -18px 34px;background:#f5f2ea;overflow:hidden}
    .nara-opening,.nara-transition{padding:74px 26px 82px;background:#f5f2ea}
    .nara-eyebrow{font-size:10px;font-weight:800;letter-spacing:.18em;color:#7b7568;margin:0 0 18px}
    .nara-opening h2,.nara-transition h2,.nara-copy h2{font-family:serif;font-weight:500;letter-spacing:.03em}
    .nara-opening h2,.nara-transition h2{font-size:36px;line-height:1.35;margin:0 0 24px;color:#2b302b}
    .nara-opening p,.nara-transition p{font-size:14px;line-height:2;color:#5c625c;max-width:34em}
    .nara-cue{margin-top:52px;font-size:9px;letter-spacing:.18em;color:#898276}
    .nara-chapter{position:relative;min-height:88svh;background:#141816;display:flex;align-items:flex-end;overflow:hidden}
    .nara-photo{position:absolute;inset:0;margin:0}
    .nara-photo img{width:100%;height:100%;display:block;object-fit:cover;filter:saturate(.84) contrast(.96)}
    .nara-photo:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(9,12,10,.02) 25%,rgba(9,12,10,.76) 100%);pointer-events:none}
    .nara-photo a{position:absolute;z-index:3;right:10px;bottom:8px;color:rgba(255,255,255,.68);font-size:8px;text-decoration:none;text-shadow:0 1px 4px #000}
    .nara-copy{position:relative;z-index:2;padding:36px 26px 42px;color:#fff;max-width:520px}
    .nara-copy>span{font-size:10px;letter-spacing:.16em;font-weight:800;opacity:.72}
    .nara-copy h2{font-size:38px;line-height:1.28;margin:12px 0 16px}
    .nara-copy p{font-size:13px;line-height:1.9;color:rgba(255,255,255,.86);margin:0}
    .nara-pause{height:46svh;display:grid;place-content:center;background:#172019;color:#dce2dc;text-align:center}
    .nara-pause .line{height:74px;width:1px;background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.3),rgba(255,255,255,0));margin:auto}
    .nara-chapter.buddha{min-height:100svh;background:#0d100e;align-items:center}
    .nara-chapter.buddha .nara-photo{inset:0 0 34% 0}
    .nara-chapter.buddha .nara-photo:after{background:linear-gradient(180deg,rgba(9,12,10,.02),rgba(9,12,10,.45))}
    .nara-chapter.buddha .nara-copy{align-self:flex-end;padding-bottom:52px}
    .nara-transition{background:#ece5d7;padding-top:90px;padding-bottom:96px}
    .nara-transition h2{font-size:38px}
    .sake-origin{min-height:86svh}
    @media(min-width:681px){.nara-story{margin-left:0;margin-right:0;border-radius:0}.nara-opening,.nara-transition{padding-left:48px;padding-right:48px}.nara-copy{padding-left:48px}.nara-chapter.buddha .nara-photo{inset:0 42% 0 0}.nara-chapter.buddha .nara-copy{margin-left:58%;align-self:center}.nara-photo a{font-size:9px}}
  `;
  document.head.appendChild(style);
})();
