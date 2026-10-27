// Languages supported by Beacon. Shared by dispatcher + caller UIs.
export const LANGS = {
  en: { name: 'English', native: 'English', flag: '🇺🇸', stt: 'en-US', tts: 'en-US' },
  es: { name: 'Spanish', native: 'Español', flag: '🇲🇽', stt: 'es-US', tts: 'es-US' },
  vi: { name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳', stt: 'vi-VN', tts: 'vi-VN' },
  zh: { name: 'Mandarin', native: '中文', flag: '🇨🇳', stt: 'zh-CN', tts: 'zh-CN' },
  tl: { name: 'Tagalog', native: 'Tagalog', flag: '🇵🇭', stt: 'fil-PH', tts: 'fil-PH' },
  hi: { name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳', stt: 'hi-IN', tts: 'hi-IN' },
  mix: { name: 'Mixteco / Triqui', native: 'Mixteco · Triqui', flag: '🌎', stt: 'es-US', tts: 'es-US', interpreter: true },
};
export const LANG_ORDER = ['en', 'es', 'vi', 'zh', 'tl', 'hi', 'mix'];
