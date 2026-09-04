// 和酒ログ 都道府県ガイド：四国
// 「県の味」を決めつけず、土地・食・酒文化・蔵を知る入口として扱う。
window.WASHULOG_PREFECTURE_DETAIL = window.WASHULOG_PREFECTURE_DETAIL || {};

Object.assign(window.WASHULOG_PREFECTURE_DETAIL, {
  "徳島県": {
    region: "四国",
    hero: { type: "single", subject: "阿波おどり", note: "場所ではなく、人の熱気を主役に。踊りの躍動から阿波の暮らしへ入る。" },
    story: "吉野川が東西を貫き、鳴門の海から祖谷の山深い土地まで風景が大きく変わる徳島。阿波おどりの熱気を入口に、川・山・海とともに育った暮らしをたどる。",
    food: ["鳴門鯛", "すだち", "鳴門金時", "阿波尾鶏", "そば米汁", "祖谷そば"],
    sakeStory: "徳島県酒造組合は、吉野川の水、山麓の米、杜氏の技を阿波の酒の背景として紹介している。県産酒米・県内採取の水・県内醸造による純米酒『阿波十割』や、LEDを利用して育種された酵母など、土地と新しい技術の両方から徳島の酒を見る。",
    breweries: [
      { brewery: "本家松浦酒造場", brand: "鳴門鯛", area: "鳴門市", url: "https://narutotai.jp/" },
      { brewery: "三芳菊酒造", brand: "三芳菊", area: "三好市・池田", url: "https://miyoshikiku.com/" },
      { brewery: "芳水酒造", brand: "芳水", area: "三好市・井川", url: "https://www.housui.com/" },
      { brewery: "中和商店", brand: "今小町", area: "三好市・池田", url: "https://imakomachi.co.jp/" },
      { brewery: "那賀酒造", brand: "旭若松", area: "那賀町", url: "https://tokushimasake.com/kuramoto/" },
      { brewery: "司菊酒造", brand: "司菊・きらい", area: "美馬市", url: "https://tokushimasake.com/kuramoto/" }
    ],
    closing: "踊りの熱気から、吉野川を上流へ。鳴門、阿波、祖谷へと進むほど、徳島の酒の背景が変わって見えてくる。"
  },

  "香川県": {
    region: "四国",
    hero: { type: "single", subject: "金刀比羅宮・785段の石段", note: "石段を下から見上げ、『これを登るのか』と感じる体験型ヒーロー。" },
    story: "瀬戸内海、多島美、讃岐平野、ため池、こんぴら参り。小さな県土の中に海・平野・島・参詣文化が凝縮する香川を、785段の石段から歩き始める。",
    food: ["讃岐うどん", "骨付鳥", "オリーブ", "小豆島そうめん", "瀬戸内の魚介", "しょうゆ豆"],
    sakeStory: "香川県酒造組合には現在6社が参加し、琴平の『こんぴら酒』、財田川の伏流水、小豆島の島酒など、それぞれ異なる土地の酒がある。県独自の『さぬきオリーブ酵母清酒』も、香川の食との組み合わせを楽しむ新しい入口になっている。",
    breweries: [
      { brewery: "西野金陵", brand: "金陵", area: "琴平町", url: "https://www.nishino-kinryo.co.jp/" },
      { brewery: "丸尾本店", brand: "悦凱陣", area: "琴平町", url: "https://sanuki-sake.com/" },
      { brewery: "川鶴酒造", brand: "川鶴", area: "観音寺市", url: "https://kawatsuru.com/" },
      { brewery: "綾菊酒造", brand: "綾菊", area: "綾川町", url: "https://www.ayakiku.com/" },
      { brewery: "勇心酒造", brand: "勇心", area: "綾川町", url: "http://www.yushin-brewer.com/" },
      { brewery: "小豆島酒造", brand: "森・MORIKUNI", area: "小豆島町", url: "https://www.morikuni.jp/" }
    ],
    closing: "こんぴらさんを登った先から、讃岐平野、瀬戸内、小豆島へ。うどんだけではない香川の発酵と酒を旅する。"
  },

  "愛媛県": {
    region: "四国",
    hero: { type: "single", subject: "道後温泉本館", note: "湯けむりと旅情。温泉の一夜から、伊予の食と酒へ自然につなぐ。" },
    story: "石鎚山を背負う東予、道後と松山の中予、リアス式海岸と宇和海を抱く南予。愛媛県酒造組合も県内をこの三地域に分けて蔵を紹介しており、ひとつの県の中で風土と文化が変わる。",
    food: ["鯛めし", "じゃこ天", "宇和島鯛めし", "柑橘", "せんざんき", "瀬戸内・宇和海の魚介"],
    sakeStory: "四国山地、とりわけ石鎚山系の水と、瀬戸内海・宇和海の食。愛媛の酒は土地の食卓と一緒に見ると輪郭が深まる。県独自の酒造好適米『しずく媛』も、現在の愛媛の酒造りを知る鍵のひとつ。",
    breweries: [
      { brewery: "石鎚酒造", brand: "石鎚", area: "西条市", url: "https://www.ishizuchi.co.jp/" },
      { brewery: "成龍酒造", brand: "伊予賀儀屋", area: "西条市", url: "https://www.seiryosyuzo.com/" },
      { brewery: "水口酒造", brand: "仁喜多津", area: "松山市・道後", url: "https://www.dogobeer.com/" },
      { brewery: "栄光酒造", brand: "酒仙栄光・Laugh with SAKE", area: "松山市", url: "https://www.eikoo.com/" },
      { brewery: "酒六酒造", brand: "京ひな", area: "内子町", url: "https://www.sakaroku-syuzo.co.jp/" },
      { brewery: "梅錦山川", brand: "梅錦", area: "四国中央市", url: "https://www.umenishiki.com/" }
    ],
    closing: "道後で一杯、その次は石鎚の麓へ、宇和海へ。東予・中予・南予を巡ると、愛媛の酒が三つの風景を持っていることに気づく。"
  },

  "高知県": {
    region: "四国",
    hero: { type: "single", subject: "坂本龍馬 × 桂浜 × 太平洋", note: "銅像ではなく、史実の肖像を基準にした龍馬と太平洋。横顔が分かる構図で『誰？』を避ける。本番は実写・史料基準で再現性を優先。" },
    story: "太平洋に長く開いた海岸線と、四万十川、仁淀川、山間の集落。桂浜から海の向こうを見る龍馬を入口に、東西に長い土佐の土地と人の気質をたどる。",
    food: ["かつおのたたき", "皿鉢料理", "うつぼ", "土佐あかうし", "田舎寿司", "文旦"],
    sakeStory: "高知には東部から西部まで酒蔵が点在し、酒と宴席の文化も土地の魅力のひとつ。『土佐酒＝辛口』だけで終わらせず、高知酵母や蔵ごとの個性、海・川・山の食との関係から一本ずつ見る。",
    breweries: [
      { brewery: "酔鯨酒造", brand: "酔鯨", area: "高知市・土佐市", url: "https://suigei.co.jp/" },
      { brewery: "司牡丹酒造", brand: "司牡丹・船中八策", area: "佐川町", url: "https://www.tsukasabotan.co.jp/" },
      { brewery: "濱川商店", brand: "美丈夫", area: "田野町", url: "https://www.bijofu.jp/" },
      { brewery: "土佐鶴酒造", brand: "土佐鶴", area: "安田町", url: "https://tosatsuru.co.jp/" },
      { brewery: "亀泉酒造", brand: "亀泉", area: "土佐市", url: "https://www.kameizumi.co.jp/" },
      { brewery: "無手無冠", brand: "無手無冠", area: "四万十町", url: "https://mutemuka.com/" }
    ],
    closing: "桂浜の水平線から、東の安芸、西の四万十へ。龍馬だけでは終わらない土佐を、酒と食から歩いていく。"
  }
});
