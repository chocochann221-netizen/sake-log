// 和酒ログ 都道府県ガイド：東海
// 「県の味」を決めつけず、土地・食・酒文化・蔵を知る入口として扱う。
window.WASHULOG_PREFECTURE_DETAIL = window.WASHULOG_PREFECTURE_DETAIL || {};

Object.assign(window.WASHULOG_PREFECTURE_DETAIL, {
  "岐阜県": {
    region: "東海",
    hero: { type: "single", subject: "雪の白川郷", note: "合掌造りの山里と雪。飛騨から美濃へ、山と川がつくる岐阜を旅する入口。" },
    story: "北の飛騨から南の美濃まで、山地と河川に沿って暮らしと町が連なる岐阜。ひとつの『岐阜の味』にまとめず、飛騨・中濃・西濃・東濃それぞれの土地と蔵をたどる。",
    food: ["飛騨牛", "朴葉味噌", "鮎", "漬物ステーキ", "鶏ちゃん"],
    sakeStory: "山の水、寒冷な飛騨、木曽三川へ続く美濃。地形の違いとともに酒蔵が点在する。酒を土地への入口にして、白川郷だけではない岐阜へ視線を広げる。",
    breweries: [
      { brewery: "三千盛", brand: "三千盛", area: "多治見市", url: "https://www.michisakari.com/" },
      { brewery: "玉泉堂酒造", brand: "醴泉・無風", area: "養老町", url: "https://www.minogiku.co.jp/" },
      { brewery: "中島醸造", brand: "小左衛門", area: "瑞浪市", url: "https://kozaemon.jp/" },
      { brewery: "岩村醸造", brand: "女城主", area: "恵那市・岩村", url: "https://www.torokko.co.jp/" },
      { brewery: "平瀬酒造店", brand: "久寿玉", area: "高山市", url: "https://www.kusudama.co.jp/" },
      { brewery: "渡辺酒造店", brand: "蓬莱・W", area: "飛騨市", url: "https://www.sake-hourai.co.jp/" }
    ],
    closing: "県名は答えではなく入口。山を越え、川をたどると、同じ岐阜でも違う酒の風景が見えてくる。"
  },

  "静岡県": {
    region: "東海",
    hero: { type: "single", subject: "茶畑越しの富士山", note: "山梨とは違う、茶の緑と富士山で静岡を一目で感じる一景。" },
    story: "富士山、南アルプス、駿河湾、遠州灘。高い山から海へ水が流れる静岡では、東部・中部・西部で風景も食も変わる。",
    food: ["桜えび", "しらす", "かつお", "うなぎ", "静岡おでん", "わさび"],
    sakeStory: "静岡県酒造組合は県内の蔵を東部・中部・西部で紹介する。南アルプスなどの水系と各地の地形を背景に、蔵ごとの酒造りを見る。『静岡酒はこの味』ではなく、水と人と技術の違いを知る入口にする。",
    breweries: [
      { brewery: "高嶋酒造", brand: "白隠正宗", area: "沼津市", url: "https://www.hakuinmasamune.com/" },
      { brewery: "磯自慢酒造", brand: "磯自慢", area: "焼津市", url: "https://www.isojiman-sake.jp/" },
      { brewery: "初亀醸造", brand: "初亀", area: "藤枝市", url: "https://www.hatsukame.jp/" },
      { brewery: "志太泉酒造", brand: "志太泉", area: "藤枝市", url: "https://shidaizumi.com/" },
      { brewery: "土井酒造場", brand: "開運", area: "掛川市", url: "https://kaiunsake.com/" },
      { brewery: "花の舞酒造", brand: "花の舞", area: "浜松市", url: "https://hananomai.co.jp/" }
    ],
    closing: "富士山だけではない静岡へ。山から海へ流れる水をたどるように、酒蔵を旅する。"
  },

  "愛知県": {
    region: "東海",
    hero: {
      type: "dual",
      subjects: ["名古屋城・金鯱", "犬山城・木曽川"],
      note: "愛知だけの二景ヒーロー。都市と城下町、二つの顔を一枚に置き、県の広がりを最初から見せる。",
      layoutHint: "diagonal-split"
    },
    story: "名古屋の都市文化だけでなく、木曽川沿いの尾張、醸造文化が息づく知多半島、山と川を抱える三河まで。愛知は一枚の風景では収まりきらないから、二つの城を入口に県内へ広がる。",
    food: ["味噌煮込みうどん", "ひつまぶし", "手羽先", "どて煮", "きしめん", "三河湾の魚介"],
    sakeStory: "味噌・たまり・酢・みりんなど発酵文化が身近な愛知。日本酒も尾張・知多・三河に蔵があり、都市のイメージから一歩外へ出ると、地域ごとの醸造の風景が見えてくる。",
    breweries: [
      { brewery: "萬乗醸造", brand: "醸し人九平次", area: "名古屋市緑区", url: "https://kuheiji.co.jp/" },
      { brewery: "澤田酒造", brand: "白老", area: "常滑市", url: "https://hakurou.com/" },
      { brewery: "盛田", brand: "ねのひ", area: "常滑市・小鈴谷", url: "https://moritakk.com/" },
      { brewery: "丸石醸造", brand: "二兎・長誉", area: "岡崎市", url: "https://014.co.jp/" },
      { brewery: "関谷醸造", brand: "蓬莱泉", area: "設楽町", url: "https://www.houraisen.co.jp/" },
      { brewery: "山忠本家酒造", brand: "義侠", area: "愛西市", url: "https://gikyo.co.jp/" }
    ],
    closing: "名古屋城と犬山城、その先へ。尾張・知多・三河を歩くと、愛知の発酵文化と酒がつながって見えてくる。"
  },

  "三重県": {
    region: "東海",
    hero: { type: "single", subject: "伊勢神宮・宇治橋", note: "参宮の入口となる宇治橋。信仰、旅、食、酒へ自然につながる三重の象徴。" },
    story: "伊勢の参宮文化、伊賀の山里、鈴鹿、熊野へ続く紀州。海と山が近い三重では、土地ごとの暮らしと食の違いが酒の背景にも重なる。",
    food: ["伊勢うどん", "てこね寿司", "松阪牛", "伊勢海老", "牡蠣", "あおさ"],
    sakeStory: "伊勢神宮と酒の関わりを入口にしながら、三重の酒文化を伊勢だけに閉じない。鈴鹿・伊賀・名張などへ足を延ばし、海の食と山の食、その土地で醸す蔵を訪ねる。",
    breweries: [
      { brewery: "清水清三郎商店", brand: "作", area: "鈴鹿市", url: "https://seizaburo.jp/" },
      { brewery: "木屋正酒造", brand: "而今・高砂", area: "名張市", url: "https://kiyashow.com/" },
      { brewery: "大田酒造", brand: "半蔵", area: "伊賀市", url: "https://www.hanzo-sake.com/" },
      { brewery: "瀧自慢酒造", brand: "瀧自慢", area: "名張市", url: "https://www.takijiman.jp/" },
      { brewery: "若戎酒造", brand: "若戎・義左衛門", area: "伊賀市", url: "https://www.wakaebis.co.jp/" },
      { brewery: "元坂酒造", brand: "酒屋八兵衛", area: "大台町", url: "https://gensaka.com/" }
    ],
    closing: "伊勢から始まり、伊賀、鈴鹿、紀州へ。参宮の旅を広げるように、三重の酒の土地をたどる。"
  }
});
