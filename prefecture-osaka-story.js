// 和酒ログ 大阪府 地域スペース
// 地域を説明しない。写真とリズムだけを置く。
(function(){
  const q=new URLSearchParams(location.search).get('name')||'高知県';
  if(q!=='大阪府')return;
  const body=document.getElementById('body');
  if(!body||document.querySelector('.osaka-story'))return;

  const story=document.createElement('div');
  story.className='osaka-story';
  story.setAttribute('aria-label','大阪の風景');
  story.innerHTML=`
    <section class="os-scene tower" aria-hidden="true"></section>
    <section class="os-cut white" aria-hidden="true"></section>
    <section class="os-scene neon" aria-hidden="true"></section>
    <section class="os-triptych" aria-hidden="true"><i></i><i></i><i></i></section>
    <section class="os-scene festival" aria-hidden="true"></section>
    <section class="os-breath" aria-hidden="true"></section>
  `;
  body.insertAdjacentElement('afterbegin',story);

  const style=document.createElement('style');
  style.textContent=`
    body:has(.osaka-story) .body{padding-top:0}
    .osaka-story{margin:0 -18px 36px;overflow:hidden;background:#111}
    .os-scene{height:94svh;position:relative;background-position:center;background-size:cover}
    .os-scene:after{content:'';position:absolute;inset:0;pointer-events:none}
    .os-scene.tower{background:linear-gradient(155deg,#e75b37 0 38%,#f1cf3c 38% 57%,#1c1b1a 57% 100%)}
    .os-scene.tower:after{width:28vw;max-width:170px;height:64svh;left:50%;top:17%;transform:translateX(-50%);background:#eee7d6;clip-path:polygon(43% 0,57% 0,62% 27%,78% 40%,63% 45%,60% 100%,40% 100%,37% 45%,22% 40%,38% 27%);opacity:.88}
    .os-cut{height:14svh}.os-cut.white{background:#f8f5ed}
    .os-scene.neon{height:82svh;background:radial-gradient(circle at 22% 26%,#ffdf38 0 4%,transparent 5%),radial-gradient(circle at 78% 32%,#f23968 0 6%,transparent 7%),linear-gradient(120deg,#0b1323,#34213d 42%,#111826)}
    .os-scene.neon:after{background:repeating-linear-gradient(90deg,transparent 0 12%,rgba(255,255,255,.09) 12% 13%,transparent 13% 24%);transform:skewY(-4deg)}
    .os-triptych{height:48svh;display:grid;grid-template-columns:1fr 1.25fr .85fr;gap:3px;background:#0c0c0c;padding:3px}
    .os-triptych i:nth-child(1){background:linear-gradient(180deg,#283244 0 48%,#d5c7a7 48%)}
    .os-triptych i:nth-child(2){background:radial-gradient(circle at 50% 52%,#e6a949 0 12%,#c46b32 13% 26%,#ece1c4 27% 29%,#171717 30%)}
    .os-triptych i:nth-child(3){background:repeating-linear-gradient(0deg,#e2d2af 0 7%,#2a2928 7% 10%)}
    .os-scene.festival{height:88svh;background:linear-gradient(175deg,#b7d2dc 0 38%,#d6c09a 38% 60%,#322b26 60%)}
    .os-scene.festival:after{background:repeating-linear-gradient(74deg,transparent 0 9%,rgba(83,44,23,.5) 9% 11%,transparent 11% 20%);clip-path:polygon(0 56%,100% 30%,100% 100%,0 100%)}
    .os-breath{height:72svh;background:linear-gradient(180deg,#eee8dc,#dcd3c3);position:relative}
    .os-breath:after{content:'';position:absolute;width:1px;height:24svh;background:rgba(50,48,42,.18);left:50%;top:24svh}
    @media(min-width:681px){.osaka-story{margin-left:0;margin-right:0}.os-scene{height:760px}.os-scene.neon{height:650px}.os-triptych{height:420px}.os-breath{height:540px}}
  `;
  document.head.appendChild(style);
})();
