// 和酒ログ 都道府県ヒーロー表示レイヤー
// prefecture-guide.html 本体を大きく変更せず、確定済み47県ヒーローデータを表示へ接続する。
// 写真URLは権利確認後に WASHULOG_PREFECTURE_HERO_IMAGES へ追加する前提。
(function () {
  const heroes = window.WASHULOG_PREFECTURE_HERO || {};
  const images = window.WASHULOG_PREFECTURE_HERO_IMAGES || {};
  const params = new URLSearchParams(location.search);
  const prefecture = params.get('name') || '高知県';
  const hero = heroes[prefecture];
  if (!hero) return;

  const heroSection = document.querySelector('.hero');
  const wrap = heroSection && heroSection.querySelector('.wrap');
  const visual = document.getElementById('visual');
  if (!heroSection || !wrap) return;

  heroSection.classList.add('prefecture-hero-v2');
  heroSection.dataset.heroType = hero.type || 'real';

  const image = images[prefecture];
  if (image && image.src) {
    heroSection.style.backgroundImage = `linear-gradient(180deg,rgba(9,20,16,.08),rgba(9,20,16,.76)),url("${String(image.src).replace(/"/g, '%22')}")`;
    heroSection.classList.add('has-real-photo');
  }

  if (visual) {
    visual.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'hero-subject';
    label.textContent = hero.hero || '';
    visual.appendChild(label);
  }

  const journey = document.createElement('div');
  journey.className = 'hero-journey';
  journey.setAttribute('aria-label', 'この土地を巡る物語');
  journey.textContent = hero.flow || '';
  wrap.appendChild(journey);

  if (hero.note) {
    const note = document.createElement('div');
    note.className = 'hero-design-note';
    note.textContent = hero.note;
    wrap.appendChild(note);
  }

  const style = document.createElement('style');
  style.textContent = `
    .prefecture-hero-v2{position:relative;min-height:56svh;display:flex;align-items:flex-end;padding:0;background-color:#203b32;background-size:cover;background-position:center;overflow:hidden}
    .prefecture-hero-v2>.wrap{width:100%;padding:64px 20px 30px;position:relative;z-index:1}
    .prefecture-hero-v2 h1{font-size:clamp(38px,12vw,58px);line-height:1.05;letter-spacing:.02em;text-shadow:0 2px 18px rgba(0,0,0,.2)}
    .prefecture-hero-v2 #intro{max-width:34em;font-size:14px;line-height:1.9}
    .prefecture-hero-v2 .visual-label{margin-top:18px;color:#fff}
    .hero-subject{display:inline-block;padding-top:8px;border-top:1px solid rgba(255,255,255,.48);font-size:13px;font-weight:800;letter-spacing:.06em}
    .hero-journey{margin-top:20px;font-family:serif;font-size:13px;line-height:1.9;color:rgba(255,255,255,.88);max-width:36em}
    .hero-design-note{display:none}
    @media (min-width:681px){.prefecture-hero-v2{min-height:520px}.prefecture-hero-v2>.wrap{padding-bottom:42px}}
  `;
  document.head.appendChild(style);
})();
