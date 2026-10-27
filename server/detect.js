// Fast, offline language identification for caller text (en / es / vi / zh / tl / hi).
// Script-based for Devanagari / CJK / Vietnamese; stop-word scoring for Latin-script languages.
const WORDS = {
  en: 'the is are and my i you he she not to of in it help please there was we a on at has have can need his her they this that with for am im him them fire hurt breathing house'.split(' '),
  es: 'el la los las de que y en un una mi no es está esta por favor con se me ayuda esposo esposa casa hay necesito tiene su para lo muy estoy están tengo respira respirando incendio ayúdenme socorro hijo hijos mamá papá se cayó cayó fuego humo'.split(' '),
  tl: 'ang ng sa na ako ka po mga ay hindi may si ni ito siya namin nila tulong pakiusap bahay nasusunog kami ko mo naipit humihinga nandito dito asawa anak sunog tulungan paki lang din rin pa naman'.split(' '),
  vi: 'toi tôi cần giúp đỡ nhà cháy không bị và của là có chồng vợ con xin làm ơn nhờ khong chong tho nha chay giup cuu bat tinh ket toi oi minh dang roi'.split(' '),
  // romanized Hindi ("Hinglish") and Mandarin pinyin, as people commonly type them
  hi: 'mere meri mera hai hain nahi nahin kya kar raha rahe rahi ho ko ka ki ke mein hum aap papa maa ghar aag saans saas madad jaldi bachao gaye gaya phas phase phans chal sakte bhai bahut abhi kuch koi yahan wahan ji'.split(' '),
  zh: 'wo de ni shi bu le zai you ta zhangfu huxi jiuming bangzhu huozai haizi mama baba kuai jia women zhe nali ma qing yisheng shoushang bei kun zhaohuo laopo'.split(' '),
};
const SETS = Object.fromEntries(Object.entries(WORDS).map(([k, v]) => [k, new Set(v)]));

export function detectLang(text) {
  const s = (text || '').trim();
  if (s.length < 3) return null;
  const letters = [...s].filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return null;
  const count = (re) => letters.filter((c) => re.test(c)).length;
  const dev = count(/[ऀ-ॿ]/), cjk = count(/[一-鿿]/);
  if (dev / letters.length > 0.4) return 'hi';
  if (cjk / letters.length > 0.4) return 'zh';
  if (/[ăâđêôơưĂÂĐÊÔƠƯ]/.test(s) || count(/[Ạ-ỹ]/) >= 1) return 'vi';
  if (count(/[^\u0000-ɏḀ-ỿ]/) / letters.length > 0.5) return null; // some other script
  const toks = s.toLowerCase().normalize('NFC').split(/[^\p{L}']+/u).filter(Boolean);
  if (toks.length < 2) return null;
  const score = {};
  for (const k of Object.keys(SETS)) score[k] = toks.filter((w) => SETS[k].has(w)).length;
  if (/[ñ¿¡áéíóú]/i.test(s)) score.es += 2;
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const [best, bs] = ranked[0], second = ranked[1][1];
  if (bs >= 2 && bs >= second * 1.6) return best;
  if (bs >= 1 && second === 0 && toks.length <= 4 && (best !== 'en')) return best;
  return null;
}

// True when a Hindi / Mandarin / Vietnamese caller is writing in Latin letters instead of their native script.
export function isRomanized(text, lang) {
  const s = text || '';
  if (lang === 'hi') return !/[\u0900-\u097F]/.test(s) && /[a-z]/i.test(s);
  if (lang === 'zh') return !/[\u4E00-\u9FFF]/.test(s) && /[a-z]/i.test(s);
  if (lang === 'vi') return !/[ăâđêôơưĂÂĐÊÔƠƯ\u1EA0-\u1EF9]/.test(s) && /[a-z]/i.test(s);
  return false;
}

// Whisper returns full language names
// Spoken Hindi and Urdu are nearly identical, and Whisper often labels Hindi speech as Urdu.
const WHISPER = { english: 'en', spanish: 'es', vietnamese: 'vi', chinese: 'zh', mandarin: 'zh', tagalog: 'tl', filipino: 'tl', hindi: 'hi', urdu: 'hi' };
export const whisperLang = (name) => WHISPER[String(name || '').toLowerCase()] || null;
