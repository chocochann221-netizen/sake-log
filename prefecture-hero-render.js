// 和酒ログ 都道府県ヒーロー表示レイヤー
// prefecture-guide.html 本体を大きく変更せず、確定済み47県ヒーローデータを表示へ接続する。
// 画像種別（合成イラスト／権利確認済み写真）は画像台帳側で管理する。
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
    heroSection.style.backgroundPosition = image.position || 'center';
    heroSection.classList.add(image.mediaType === 'composite-illustration' ? 'has-composite-illustration' : 'has-real-photo');
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

  if (image && image.credit) {
    const credit = document.createElement(image.sourcePage ? 'a' : 'span');
    credit.className = 'hero-credit';
    if (image.sourcePage) {
      credit.href = image.sourcePage;
      credit.target = '_blank';
      credit.rel = 'noopener noreferrer';
    }
    credit.textContent = image.credit;
    credit.setAttribute('aria-label', image.sourcePage ? '画像の出典とライセンスを確認する' : image.credit);
    wrap.appendChild(credit);
  }

  // 奈良は47都道府県の基準画面。旧実写定義がキャッシュに残っても、
  // 確定済みの合成イラスト以外へ戻らないよう表示レイヤーで固定する。
  if (prefecture === '奈良県') {
    document.querySelectorAll('a[href*="brewery-list.html?prefecture="]').forEach(link => {
      const url = new URL(link.href, location.href);
      url.searchParams.set('ui', '3');
      link.href = url.pathname.replace(/^\//, '') + url.search;
    });
    const figures = document.querySelectorAll('.editorial-figure');
    const fixed = [
      { src: 'assets/nara-nandaimon-illustration.jpg', alt: '朝霧に包まれた奈良の南大門の合成イラスト' },
      { src: 'assets/nara-kakinoha-sushi-illustration.jpg', alt: '奈良の柿の葉寿司の合成イラスト' }
    ];
    figures.forEach((figure, index) => {
      if (!fixed[index]) return;
      const oldImage = figure.querySelector('img');
      if (!oldImage) return;
      const nextImage = oldImage.cloneNode(false);
      nextImage.src = fixed[index].src;
      nextImage.alt = fixed[index].alt;
      nextImage.removeAttribute('loading');
      const link = oldImage.closest('a');
      if (link) link.replaceWith(nextImage); else oldImage.replaceWith(nextImage);
      const oldCredit = figure.querySelector('.editorial-credit');
      if (oldCredit) {
        const label = document.createElement('span');
        label.className = 'editorial-credit';
        label.textContent = '合成イメージ';
        oldCredit.replaceWith(label);
      }
    });
  }

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
    .hero-credit{display:inline-block;margin-top:12px;color:rgba(255,255,255,.7);font-size:10px;line-height:1.5;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.22)}
    .hero-credit:focus,.hero-credit:hover{color:#fff;border-bottom-color:rgba(255,255,255,.75)}
    .hero-design-note{display:none}
    @media (min-width:681px){.prefecture-hero-v2{min-height:520px}.prefecture-hero-v2>.wrap{padding-bottom:42px}}
  `;
  document.head.appendChild(style);

  // 特殊な物語構成は別ファイルで読み込む。共通ページを肥大化させない。
  const storyModules = {
    '北海道': 'prefecture-hokkaido-story.js?v=1'
  };
  const moduleSrc = storyModules[prefecture];
  if (moduleSrc && !document.querySelector(`script[data-prefecture-story="${prefecture}"]`)) {
    const script = document.createElement('script');
    script.src = moduleSrc;
    script.defer = true;
    script.dataset.prefectureStory = prefecture;
    document.body.appendChild(script);
  }
})();
