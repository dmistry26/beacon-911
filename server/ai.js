// AI layer: translation + structured triage via Groq (free tier), with free
// fallbacks (MyMemory translate, rules-based triage) so the demo never hard-fails.
// Swappable: point GROQ_BASE_URL at any OpenAI-compatible server (e.g. a PSAP's own
// self-hosted Llama / Whisper stack) without touching the rest of the code.

const BASE = () => process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
const KEY = () => process.env.GROQ_API_KEY;
// Groq renames / retires models often, so ask the API what this key can use and pick the best fit.
const PREF = {
  translate: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'qwen/qwen3-32b'],
  analyze: ['openai/gpt-oss-20b', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile'],
};
const SKIP = /whisper|guard|safeguard|orpheus|allam|tts|embed/i;
let MODELS = { translate: process.env.TRANSLATE_MODEL || null, analyze: process.env.ANALYZE_MODEL || null, stt: process.env.STT_MODEL || null, ready: false };
let modelsP = null;
export function initModels() {
  if (modelsP) return modelsP;
  modelsP = (async () => {
    if (!KEY()) return MODELS;
    try {
      const r = await timedFetch(`${BASE()}/models`, { headers: { Authorization: `Bearer ${KEY()}` } }, 6000);
      const ids = ((await r.json()).data || []).filter((m) => m.active !== false).map((m) => m.id);
      const chat = ids.filter((id) => !SKIP.test(id));
      const first = (list) => list.find((id) => ids.includes(id));
      MODELS.translate ||= first(PREF.translate) || chat.find((id) => /120b|70b|large/i.test(id)) || chat[0] || null;
      MODELS.analyze ||= first(PREF.analyze) || chat.find((id) => /20b|8b|small|instant/i.test(id)) || MODELS.translate;
      MODELS.stt ||= ids.find((id) => /whisper.*turbo/i.test(id)) || ids.find((id) => /whisper/i.test(id)) || null;
      console.log(`  Groq models        : translate=${MODELS.translate}  triage=${MODELS.analyze}  speech=${MODELS.stt}`);
    } catch (e) { console.warn('[ai] could not list Groq models:', e.message); MODELS.translate ||= 'openai/gpt-oss-120b'; MODELS.analyze ||= 'openai/gpt-oss-20b'; MODELS.stt ||= 'whisper-large-v3-turbo'; }
    MODELS.ready = true;
    return MODELS;
  })();
  return modelsP;
}
const TRANSLATE_MODEL = () => MODELS.translate;
const ANALYZE_MODEL = () => MODELS.analyze;

export const LANG_NAME = {
  en: 'English', es: 'Spanish', vi: 'Vietnamese', zh: 'Simplified Mandarin Chinese',
  tl: 'Tagalog (Filipino)', hi: 'Hindi (Devanagari script)', mix: 'Spanish',
};
const MM = { en: 'en', es: 'es', vi: 'vi', zh: 'zh-CN', tl: 'tl', hi: 'hi', mix: 'es' };

export function engineStatus() {
  return {
    llm: !!KEY(),
    provider: KEY() ? 'Groq' : 'offline',
    translateModel: KEY() ? (TRANSLATE_MODEL() || 'detecting…') : 'MyMemory (free fallback)',
    analyzeModel: KEY() ? (ANALYZE_MODEL() || 'detecting…') : 'rules engine',
  };
}

async function timedFetch(url, opts, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); } finally { clearTimeout(t); }
}

async function groq(messages, { model, json = false, max = 500, timeout = 7000 } = {}) {
  await initModels();
  if (typeof model === 'function') model = model();
  const body = { model, messages, temperature: 0, max_tokens: max };
  if (/gpt-oss/i.test(model)) { body.reasoning_effort = 'low'; body.max_tokens = max + 400; }
  else if (/qwen3/i.test(model)) body.reasoning_effort = 'none';
  if (json) body.response_format = { type: 'json_object' };
  const r = await timedFetch(`${BASE()}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY()}` },
    body: JSON.stringify(body),
  }, timeout);
  if (!r.ok) throw new Error(`groq ${r.status} ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() ?? '';
}

const cache = new Map();

// Server-side speech-to-text with automatic language identification (Groq Whisper).
export async function transcribe(buf, mime = 'audio/webm', { language = null } = {}) {
  const t0 = performance.now();
  const ext = /mp4|m4a|aac/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : 'webm';
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: mime }), `utt.${ext}`);
  await initModels();
  fd.append('model', MODELS.stt || 'whisper-large-v3-turbo');
  fd.append('response_format', 'verbose_json');
  fd.append('temperature', '0');
  if (language) fd.append('language', language); // once we know the caller's language, stop Whisper guessing per clip
  const r = await timedFetch(`${BASE()}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${KEY()}` }, body: fd }, 9000);
  if (!r.ok) throw new Error(`whisper ${r.status} ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  const segs = Array.isArray(j.segments) ? j.segments : [];
  const avg = (k) => (segs.length ? segs.reduce((s, x) => s + (x[k] ?? 0), 0) / segs.length : null);
  return { text: (j.text || '').trim(), language: j.language, noSpeech: avg('no_speech_prob'), avgLogprob: avg('avg_logprob'), duration: j.duration ?? null, ms: Math.round(performance.now() - t0) };
}

async function myMemory(text, from, to) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 450))}&langpair=${MM[from]}|${MM[to]}`;
  const r = await timedFetch(url, {}, 5000);
  const j = await r.json();
  const out = j?.responseData?.translatedText;
  if (!out || /MYMEMORY WARNING|INVALID/i.test(out)) throw new Error('mymemory failed');
  return out;
}

// Identify the language when the fast word lists aren't sure (also handles romanized Hindi, pinyin, unaccented Vietnamese).
export async function detectLangLLM(text) {
  if (!KEY()) return null;
  const out = await groq([
    { role: 'system', content: 'Identify the language of an emergency caller\'s message. It may be written in Latin letters (romanized Hindi/Hinglish, Mandarin pinyin, Vietnamese without accents, Tagalog/Taglish). Return ONLY JSON: {"lang": one of "en","es","vi","zh","tl","hi","other", "romanized": true if a non-Latin-script language is written in Latin letters, "confidence": 0-1}.' },
    { role: 'user', content: text },
  ], { model: ANALYZE_MODEL, json: true, max: 80, timeout: 4000 });
  const j = JSON.parse(out);
  return ['en', 'es', 'vi', 'zh', 'tl', 'hi'].includes(j.lang) && (j.confidence ?? 1) >= 0.6 ? { lang: j.lang, romanized: !!j.romanized } : null;
}

export async function translate(text, from, to, { romanized = false, romanizedSource = false } = {}) {
  if (!text || !text.trim() || from === to || (MM[from] === MM[to])) return { text, ms: 0, engine: 'passthrough' };
  const key = `${from}|${to}|${romanized ? 'rom|' : ''}${romanizedSource ? 'romsrc|' : ''}${text}`;
  if (cache.has(key)) return { text: cache.get(key), ms: 0, engine: 'cache' };
  const t0 = performance.now();
  let out = null, engine = '';
  if (KEY()) {
    try {
      out = await groq([
        { role: 'system', content: `You are a certified emergency-call interpreter. Translate the user's message from ${LANG_NAME[from] || 'the source language'}${romanizedSource ? ' typed in Latin letters WITHOUT tone marks or accents (so words are ambiguous: use emergency context, family words like husband/wife/mother, and the most likely meaning)' : ' (it may be typed in Latin letters)'} to ${LANG_NAME[to]}${romanized ? ', written in Latin letters the way people casually type it (romanized, e.g. Hinglish or pinyin), NOT in the native script' : ''} faithfully and completely. Preserve numbers, addresses, names, urgency and tone. Never add, omit, explain, or answer the content. Output only the translation.` },
        { role: 'user', content: text },
      ], { model: TRANSLATE_MODEL, max: 400 });
      engine = 'groq';
    } catch (e) { console.warn('[ai] groq translate failed:', e.message); }
  }
  if (!out && !romanized) {
    try { out = await myMemory(text, from, to); engine = 'mymemory'; }
    catch (e) { console.warn('[ai] mymemory failed:', e.message); }
  }
  if (!out) { out = to === 'en' ? `[untranslated · ${from}] ${text}` : text; engine = 'none'; }
  else cache.set(key, out);
  return { text: out, ms: Math.round(performance.now() - t0), engine };
}

export async function translateMany(text, langs) {
  const result = {};
  const targets = langs.filter((l) => l !== 'en');
  result.en = text;
  if (!targets.length) return result;
  if (KEY()) {
    try {
      const names = targets.map((l) => `"${l}": ${LANG_NAME[l]}`).join(', ');
      const out = await groq([
        { role: 'system', content: `You translate emergency public-safety messages faithfully. Return a JSON object mapping each language code to the translation of the user's English message. Language codes: ${names}.` },
        { role: 'user', content: text },
      ], { model: TRANSLATE_MODEL, json: true, max: 900 });
      const j = JSON.parse(out);
      for (const l of targets) if (typeof j[l] === 'string' && j[l]) result[l] = j[l];
    } catch (e) { console.warn('[ai] batch translate failed:', e.message); }
  }
  await Promise.all(targets.filter((l) => !result[l]).map(async (l) => { result[l] = (await translate(text, 'en', l)).text; }));
  return result;
}

const CATS = ['medical', 'fire', 'crash', 'police', 'gas', 'quake', 'flood', 'other'];
const TAGS = ['trapped', 'explosion', 'mobility', 'child', 'elderly', 'injured', 'unconscious', 'hazmat', 'weapon', 'powerline', 'pregnant', 'collapse', 'smoke'];
const PROTOCOLS = ['cpr', 'breathing', 'choking', 'childbirth', 'bleeding', 'stroke', 'overdose', 'seizure', 'burns', 'structure_fire', 'wildfire_evac', 'earthquake', 'gas_leak', 'vehicle_crash'];

export async function analyzeLLM(englishText) {
  const t0 = performance.now();
  const out = await groq([
    {
      role: 'system',
      content: `You are an emergency-dispatch triage assistant. Read the caller's statements (already translated to English) and return ONLY a JSON object with these keys:
"category": one of ${CATS.join('|')},
"type": short incident label (max 5 words),
"severity": integer 1 (life-threatening) to 4 (non-urgent),
"tags": array containing any of ${TAGS.join(',')} that are EXPLICITLY stated,
"protocol": one of ${PROTOCOLS.join('|')} or null,
"summary": one plain sentence for the dispatcher,
"address": spoken street address/landmark or null,
"confidence": number 0-1.
Never invent facts that are not stated.`,
    },
    { role: 'user', content: englishText },
  ], { model: ANALYZE_MODEL, json: true, max: 350, timeout: 6000 });
  const j = JSON.parse(out);
  return { raw: j, ms: Math.round(performance.now() - t0) };
}

export function mergeAnalysis(h, llm) {
  if (!llm) return h;
  const a = { ...h };
  const conf = typeof llm.confidence === 'number' ? llm.confidence : 0.7;
  if (CATS.includes(llm.category) && conf >= 0.5 && h.confidence < 0.9) {
    a.category = llm.category;
    if (llm.type) a.type = String(llm.type).slice(0, 48);
  }
  if (Number.isInteger(llm.severity) && llm.severity >= 1 && llm.severity <= 4) a.severity = Math.min(h.severity, llm.severity);
  if (Array.isArray(llm.tags)) a.tags = [...new Set([...h.tags, ...llm.tags.filter((t) => TAGS.includes(t))])];
  if (PROTOCOLS.includes(llm.protocol) && (!h.protocolId || h.confidence < 0.8)) a.protocolId = llm.protocol;
  if (llm.summary) a.llmSummary = String(llm.summary).slice(0, 220);
  if (llm.address && !a.address) a.address = String(llm.address);
  a.confidence = Math.max(h.confidence, Math.min(0.97, conf));
  return a;
}
