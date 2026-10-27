// Beacon core: call lifecycle, AI pipeline, clustering, hazard deltas, triage scoring,
// AI intake (surge), dispatch + unit simulation. Pure in-memory state.
import { EventEmitter } from 'node:events';
import { hav, round } from './util.js';
import { heuristics, TAG_LABELS, CRITICAL_TAGS, TAG_WEIGHT, nativeDanger, classifyAnswer } from './heuristics.js';
import { translate, translateMany, analyzeLLM, mergeAnalysis, engineStatus, detectLangLLM } from './ai.js';
import { phrase, KINDS, TAP_EN } from './phrases.js';
import { cardForLang, CARD_BY_ID } from './protocols.js';
import { buildFleet, recommend, route, pointAlong, TYPE_META, STATIONS } from './fleet.js';
import * as geo from './geo.js';
import { detectLang, isRomanized } from './detect.js';
import { LANGS } from '../public/shared/lang.js';

export const bus = new EventEmitter();

export const S = {
  mode: 'routine',
  calls: new Map(),
  incidents: new Map(),
  units: buildFleet(),
  routes: new Map(),           // unitId -> {id, coords}
  audit: [],
  broadcasts: [],
  seq: { call: 0, inc: 0, line: 0, hz: 0, bc: 0 },
  scale: Number(process.env.SIM_SCALE || 6),
  sim: { running: false, scenario: null, total: 0, spawned: 0, startedAt: 0 },
  surgeSuggested: false,
  publicUrl: null,
  dirty: true,
  startedAt: Date.now(),
};

export const touch = () => { S.dirty = true; };
const now = () => Date.now();

export function audit(actor, action, detail = '', ref = {}) {
  S.audit.push({ t: now(), actor, action, detail, ...ref });
  if (S.audit.length > 400) S.audit.splice(0, S.audit.length - 400);
  touch();
}

const toCaller = (callId, msg) => bus.emit('toCaller', callId, msg);

const fakePhone = () => `(831) 555-${String(Math.floor(100 + Math.random() * 899)).padStart(4, '0')}`;

// ---------------------------------------------------------------- calls
export function newCall({ lang = 'en', mode = 'voice', loc = null, source = 'live', phone = null, access = {}, forceIntake = false, device = null } = {}) {
  const prev = device ? [...S.calls.values()].reverse().find((c) => c.device === device && now() - c.createdAt < 30 * 60 * 1000) : null;
  if (prev) phone = prev.phone;
  const id = `C${++S.seq.call}`;
  const call = {
    id, num: S.seq.call, phone: phone || fakePhone(), lang, mode, source, access,
    state: 'ringing', createdAt: now(), answeredAt: null, endedAt: null,
    loc, lines: [], interim: '', analysis: null, incidentId: null,
    latency: {}, intake: { step: 'none' }, protocols: [], deltaIds: [],
    flags: lang === 'mix' ? { interpreter: true } : {},
    device, _q: Promise.resolve(),
  };
  if (prev) call.flags.repeatCaller = prev.num;
  S.calls.set(id, call);
  audit('SYSTEM', 'call.new', `#${call.num} ${lang} ${mode}${source === 'sim' ? ' (sim)' : ''}`, { callId: id });
  if (loc && source === 'live') reverseGeocode(call);
  if (S.mode === 'surge' || forceIntake) setTimeout(() => startIntake(call), source === 'live' ? 1400 : 0);
  touch();
  return call;
}

async function reverseGeocode(call) {
  if (!call.loc) return;
  const g = await geo.reverse(call.loc.lat, call.loc.lng);
  if (call.loc) { call.loc.address = g.address; call.loc.city = g.city; call.loc.civic = g.civic; call.loc.geoMs = g.ms; }
  if (call.incidentId) refreshIncident(S.incidents.get(call.incidentId));
  touch();
}

export function updateLoc(call, loc) {
  const first = !call.loc;
  call.loc = { ...(call.loc || {}), ...loc, source: loc.source || 'gps' };
  if (first || !call.loc.address) reverseGeocode(call);
  else {
    const prev = call._lastGeo;
    if (!prev || hav(prev, loc) > 60) { call._lastGeo = { lat: loc.lat, lng: loc.lng }; reverseGeocode(call); }
  }
  if (call.incidentId) refreshIncident(S.incidents.get(call.incidentId));
  touch();
}

function addLine(call, o) {
  const line = { id: ++S.seq.line, t: now(), ...o };
  call.lines.push(line);
  if (call.lines.length > 120) call.lines.shift();
  touch();
  return line;
}

export function callerInterim(call, text) { call.interim = text; touch(); }

export function callerText(call, text, opts = {}) {
  call._q = call._q.then(() => processCallerText(call, text, opts)).catch((e) => console.error('[callerText]', e));
  return call._q;
}

export function setCallLang(call, lang, how) {
  if (!LANGS[lang] || lang === call.lang) return;
  const from = call.lang;
  call.lang = lang;
  call.flags.langAuto = { from, to: lang, how };
  call.flags.interpreter = lang === 'mix';
  audit('AI', 'lang.detect', `Call #${call.num}: ${LANGS[from]?.name} → ${LANGS[lang].name} (${how})`, { callId: call.id });
  toCaller(call.id, { t: 'call.lang', lang });
  touch();
}

async function processCallerText(call, text, { sttMs = 0, pre = null, tap = false, detected = null } = {}) {
  if (call.state === 'ended' || call.state === 'abandoned') return;
  if (!pre && !tap && call.source === 'live' && call.lang !== 'mix') {
    // trust Whisper only for utterances long enough to identify reliably; otherwise use text analysis
    // the words themselves are stronger evidence than Whisper's label (it often says "English" for accented speech)
    let byText = detectLang(text), how = 'text analysis';
    // word lists unsure (e.g. romanized Hinglish / pinyin)? ask the language model
    if (!byText && process.env.GROQ_API_KEY && text.trim().length >= 6) {
      try { const r = await detectLangLLM(text); if (r) { byText = r.lang; how = r.romanized ? 'AI (romanized text)' : 'AI language ID'; } } catch (e) { console.warn('[ai] language ID failed:', e.message); }
    }
    const byWhisper = detected && text.length >= 10 ? detected : null;
    const det = byText || byWhisper;
    if (det) setCallLang(call, det, byText ? how : 'Whisper');
    // remember if they type in Latin letters, so replies come back the same way
    if (call.mode !== 'voice' || !detected) call.flags.romanized = isRomanized(text, call.lang);
  }
  let en = pre ?? text, trMs = 0, engine = pre ? 'pre-translated' : 'none';
  if (!pre && call.lang !== 'en' && !tap) {
    const r = await translate(text, call.lang, 'en', { romanizedSource: !!call.flags.romanized });
    en = r.text; trMs = r.ms; engine = r.engine;
  }
  call.interim = '';
  addLine(call, { who: 'caller', orig: text, en, lang: call.lang, trMs, engine, tap });
  call.latency.in = { stt: sttMs, translate: trMs, triage: null, route: null, total: null, engine };
  touch();

  const a0 = performance.now();
  await analyzeCall(call);
  const triageMs = Math.round(performance.now() - a0);
  call.latency.in.triage = triageMs;
  call.latency.in.total = sttMs + trMs + triageMs;
  assignIncident(call);
  touch();

  const inc = S.incidents.get(call.incidentId);
  if (inc) scheduleRecommend(inc, call);
  if (call.state === 'intake') await intakeOnLine(call);
  else if (call.state === 'ai_resolved') escalate(call, 'caller spoke again after the AI finished');
}

async function analyzeCall(call) {
  const en = call.lines.filter((l) => l.who === 'caller').map((l) => l.en).join(' ');
  const h = heuristics(en);
  let a = h, engine = 'rules';
  if (process.env.GROQ_API_KEY && call.source === 'live') {
    try {
      const r = await analyzeLLM(en);
      a = mergeAnalysis(h, r.raw);
      engine = 'llm+rules';
    } catch (e) { console.warn('[ai] analyze failed:', e.message); }
  }
  const native = nativeDanger(call.lines.filter((l) => l.who === 'caller').map((l) => l.orig).join(' '), call.lang).filter((t) => !a.tags.includes(t));
  if (native.length) a = { ...a, tags: [...a.tags, ...native], nativeTags: native };
  call.analysis = { ...a, engine, updatedAt: now() };
  // spoken address -> geocode as backup / cross-check for GPS
  if (a.address && a.address !== call.spokenAddress && call.source === 'live') {
    call.spokenAddress = a.address;
    geo.forward(a.address).then((g) => {
      if (!g) return;
      if (!call.loc) { call.loc = { lat: g.lat, lng: g.lng, acc: 80, address: g.address, source: 'spoken' }; assignIncident(call); }
      else if (hav(call.loc, g) > 400) call.flags.locMismatch = `Caller said “${a.address}” — ${Math.round(hav(call.loc, g))} m from GPS pin`;
      touch();
    });
  }
}

// ---------------------------------------------------------------- incidents (clustering)
const RADIUS = { fire: 1400, quake: 1500, flood: 1500, gas: 600, crash: 250, medical: 35, police: 150, other: 100 };

function incidentOfCall(call) { return call.incidentId ? S.incidents.get(call.incidentId) : null; }

function detach(call) {
  const old = incidentOfCall(call);
  if (!old) return;
  old.callIds = old.callIds.filter((id) => id !== call.id);
  if (!old.callIds.length && !old.units.length) S.incidents.delete(old.id);
  else refreshIncident(old);
  call.incidentId = null;
}

export function assignIncident(call) {
  const a = call.analysis;
  if (!a) return;
  const cur = incidentOfCall(call);
  if (cur && cur.category !== a.category && !cur.locked) detach(call);
  if (call.incidentId) { refreshIncident(S.incidents.get(call.incidentId)); updateHazards(S.incidents.get(call.incidentId), call); return; }
  let target = null;
  if (call.loc) {
    const R = RADIUS[a.category] ?? 100;
    for (const inc of S.incidents.values()) {
      if (inc.status === 'closed' || inc.category !== a.category || !inc.center) continue;
      if (now() - inc.lastCallAt > 45 * 60 * 1000) continue;
      if (hav(inc.center, call.loc) <= R + (inc.radius || 0) * 0.5) { target = inc; break; }
    }
  }
  if (!target) {
    const id = `I${++S.seq.inc}`;
    target = {
      id, num: S.seq.inc, category: a.category, type: a.type, severity: a.severity, tags: [], callIds: [],
      center: null, radius: 0, address: '', summary: '', hazards: [], units: [], status: 'open',
      createdAt: now(), lastCallAt: now(), timeline: [], rec: null, protocolId: a.protocolId, locked: false,
    };
    S.incidents.set(id, target);
    target.timeline.push({ t: now(), text: `Event opened from call #${call.num}` });
    audit('AI', 'event.open', `Event #${target.num} · ${a.type}`, { incId: id });
  }
  target.callIds.push(call.id);
  target.lastCallAt = now();
  call.incidentId = target.id;
  if (target.callIds.length > 1) audit('AI', 'event.cluster', `Call #${call.num} grouped into Event #${target.num} (${target.callIds.length} calls)`, { incId: target.id, callId: call.id });
  refreshIncident(target);
  updateHazards(target, call);
  flagOutlier(target);
}

function flagOutlier(inc) {
  if (!inc.center) return;
  inc.nearEvent = null;
  for (const o of S.incidents.values()) {
    if (o.id === inc.id || o.status === 'closed' || !o.center || o.category === inc.category) continue;
    if (['fire', 'quake', 'flood'].includes(o.category) && o.callIds.length >= 3 && hav(o.center, inc.center) <= (o.radius || 0) + 1500) { inc.nearEvent = o.id; break; }
  }
}

export function refreshIncident(inc) {
  if (!inc) return;
  const calls = inc.callIds.map((id) => S.calls.get(id)).filter(Boolean);
  const located = calls.filter((c) => c.loc);
  if (located.length) {
    const lat = located.reduce((s, c) => s + c.loc.lat, 0) / located.length;
    const lng = located.reduce((s, c) => s + c.loc.lng, 0) / located.length;
    inc.center = { lat, lng };
    inc.radius = Math.max(60, ...located.map((c) => hav(inc.center, c.loc))) + 60;
    const nearest = located.slice().sort((a, b) => hav(inc.center, a.loc) - hav(inc.center, b.loc))[0];
    inc.address = nearest.loc.address || inc.address || '';
  }
  const analysed = calls.filter((c) => c.analysis);
  if (analysed.length) {
    const best = analysed.slice().sort((a, b) => a.analysis.severity - b.analysis.severity || b.analysis.confidence - a.analysis.confidence)[0];
    inc.severity = best.analysis.severity;
    inc.type = best.analysis.type;
    inc.category = best.analysis.category;
    inc.protocolId = best.analysis.protocolId || inc.protocolId;
    inc.tags = [...new Set(analysed.flatMap((c) => c.analysis.tags))];
    const firstLine = best.lines.find((l) => l.who === 'caller');
    inc.summary = best.analysis.llmSummary || (firstLine ? firstLine.en : '');
  }
  inc.callCount = calls.length;
}

function updateHazards(inc, call) {
  const a = call.analysis;
  if (!inc || !a) return;
  const lastCaller = [...call.lines].reverse().find((l) => l.who === 'caller');
  for (const tag of a.tags) {
    if (!TAG_LABELS[tag]) continue;
    const label = a.details?.[tag] || TAG_LABELS[tag];
    const ex = inc.hazards.find((h) => h.tag === tag && h.label === label);
    if (ex) {
      if (!ex.callIds.includes(call.id)) {
        ex.callIds.push(call.id); ex.count++;
        ex.conf = Math.min(0.99, ex.conf + 0.06);
        touch();
      }
      continue;
    }
    const delta = inc.callIds.length > 1 || inc.hazards.length > 0;
    const h = {
      id: `H${++S.seq.hz}`, tag, label, critical: CRITICAL_TAGS.includes(tag),
      callIds: [call.id], callNum: call.num, lang: call.lang, count: 1,
      quote: (lastCaller?.en || '').slice(0, 140), orig: (lastCaller?.orig || '').slice(0, 140),
      conf: round(Math.min(0.95, a.confidence + (a.engine === 'llm+rules' ? 0.04 : 0)), 2),
      isDelta: delta, status: 'new', at: now(),
    };
    inc.hazards.push(h);
    if (delta) call.deltaIds.push(h.id);
    inc.timeline.push({ t: now(), text: `${delta ? 'Hazard delta' : 'Hazard'}: ${label} (call #${call.num})`, hazard: true });
    audit('AI', delta ? 'hazard.delta' : 'hazard.flag', `${label} · call #${call.num} → Event #${inc.num}`, { incId: inc.id, callId: call.id });
    if (delta && h.critical) bus.emit('toast', { kind: 'hazard', text: `Hazard delta on Event #${inc.num}: ${label}`, incId: inc.id });
  }
}

// debounced recommendation (routing)
function scheduleRecommend(inc, call) {
  clearTimeout(inc._recTimer);
  inc._recTimer = setTimeout(async () => {
    if (!inc.center || inc.status === 'closed') return;
    const sig = `${inc.category}|${inc.type}|${inc.tags.join(',')}|${inc.units.length}|${Math.round(inc.center.lat * 500)}|${Math.round(inc.center.lng * 500)}|${inc.callIds.length >= 12}`;
    if (inc.rec && inc.rec.sig === sig) {
      if (call?.latency?.in && call.latency.in.route == null) { call.latency.in.route = 0; touch(); }
      return;
    }
    const r = await recommend(inc, S.units);
    inc.rec = { ...r, sig, at: now() };
    if (call?.latency?.in) { call.latency.in.route = r.ms; call.latency.in.total = (call.latency.in.total || 0) + r.ms; }
    touch();
  }, 350);
}

// ---------------------------------------------------------------- scoring
const SEV_BASE = { 1: 105, 2: 75, 3: 50, 4: 25 };
export function scoreCall(call) {
  const a = call.analysis;
  let s = 0;
  const reasons = [];
  if (!a) { s = 30; reasons.push('unclassified'); }
  else {
    s += SEV_BASE[a.severity] ?? 25;
    reasons.push(a.type);
    for (const t of a.tags) {
      const w = TAG_WEIGHT[t];
      if (w) { s += w; if (w >= 12) reasons.push(TAG_LABELS[t]); }
    }
  }
  if (call.deltaIds.length) { s += 15; reasons.push('new information'); }
  const inc = incidentOfCall(call);
  if (inc && inc.callIds.length > 1 && !call.deltaIds.length && a && a.severity > 1 && !a.tags.some((t) => CRITICAL_TAGS.includes(t))) { s -= 30; reasons.push(`duplicate · Event #${inc.num}`); }
  const waiting = ['ringing', 'intake', 'escalated'].includes(call.state);
  if (waiting) {
    const w = (now() - call.createdAt) / 1000;
    s += Math.min(20, w / 15);
    if (w > 45) reasons.push(`waiting ${Math.floor(w / 60)}:${String(Math.floor(w % 60)).padStart(2, '0')}`);
  }
  if (call.state === 'escalated') { s += 10; reasons.push(call.flags.escalateReason ? `AI escalated: ${call.flags.escalateReason}` : 'AI escalated'); }
  if (call.flags.repeatCaller) reasons.push(`called again (#${call.flags.repeatCaller})`);
  if (call.flags.interpreter) reasons.push('interpreter needed');
  const pr = s >= 105 ? 1 : s >= 75 ? 2 : s >= 50 ? 3 : 4;
  return { score: Math.round(s), priority: pr, reasons };
}

// ---------------------------------------------------------------- AI intake (surge)
function placeName(call, inc) {
  const addr = call.loc?.address || inc?.address || '';
  return addr.split(',')[0] || 'your area';
}

function aiSay(call, key, vars = {}) {
  const kindKey = vars.kindKey;
  const mk = (lang) => phrase(lang, key, kindKey ? { kind: (KINDS[lang] || KINDS.en)[kindKey], place: vars.place } : vars);
  const orig = mk(call.lang), en = mk('en');
  const line = addLine(call, { who: 'ai', orig, en, lang: call.lang, engine: 'pre-translated', trMs: 0 });
  toCaller(call.id, { t: 'call.say', who: 'ai', text: orig, en, lang: call.lang, lineId: line.id, quick: key === 'qHurt' && call.mode === 'text' ? ['yes', 'no'] : null });
  return line;
}

export function startIntake(call) {
  if (call.state !== 'ringing') return;
  call.state = 'intake';
  call.intake = { step: 'what', since: now() };
  call.answeredBy = 'AI';
  toCaller(call.id, { t: 'call.answered', by: 'ai', mode: S.mode });
  audit('AI', 'intake.start', `AI answered call #${call.num} (${call.lang})`, { callId: call.id });
  setTimeout(() => {
    aiSay(call, 'aiGreet');
    if (call.flags.repeatCaller) return setTimeout(() => escalate(call, `called again (earlier call #${call.flags.repeatCaller}) — situation may be worse`), 700);
    if (call.lang === 'mix') return setTimeout(() => escalate(call, 'needs an Indigenous-language interpreter'), 700);
    setTimeout(() => aiSay(call, 'qWhat'), call.source === 'live' ? 900 : 200);
  }, call.source === 'live' ? 300 : 50);
  touch();
}

const ESCALATE_TAGS = ['trapped', 'unconscious', 'mobility', 'injured', 'child', 'elderly', 'weapon', 'pregnant', 'explosion', 'collapse'];

async function intakeOnLine(call) {
  const a = call.analysis;
  if (!a) return;
  const crit = a.tags.some((t) => ESCALATE_TAGS.includes(t)) || a.category === 'medical' || a.severity <= 1;
  const inc = incidentOfCall(call);
  const live = call.source === 'live';
  const wait = (ms) => new Promise((r) => setTimeout(r, live ? ms : Math.min(ms, 150)));
  const last = [...call.lines].reverse().find((l) => l.who === 'caller');
  // when in doubt, a human takes the call
  if (call.lang !== 'en' && last && !last.tap && (last.engine === 'none' || /^\[untranslated/.test(last.en))) return escalate(call, 'translation failed');
  if (a.confidence < 0.6) return escalate(call, 'AI is not sure what is happening');
  if (a.nativeTags?.length) return escalate(call, `danger words in caller's language: ${a.nativeTags.join(', ')}`);
  if (call.intake.step === 'what') {
    if (crit) return escalate(call, 'critical details in first report');
    await wait(500);
    const known = knownEventFor(call);
    if (known) {
      aiSay(call, 'known', { kindKey: ['fire', 'quake', 'flood', 'gas', 'crash'].includes(known.category) ? known.category : 'other', place: placeName(call, known) });
      audit('AI', 'intake.known', `Call #${call.num} told about known Event #${known.num}`, { callId: call.id, incId: known.id });
      call.flags.knownEvent = known.id;
      await wait(1100);
    }
    call.intake.step = 'hurt';
    aiSay(call, 'qHurt');
  } else if (call.intake.step === 'hurt') {
    if (crit) return escalate(call, 'injury or hazard reported');
    const answer = classifyAnswer(last?.en);
    if (answer === 'unsure') return escalate(call, 'caller is not sure if anyone is hurt');
    if (answer !== 'no') return escalate(call, 'caller did not clearly say no one is hurt');
    // the AI may only close calls that duplicate an incident dispatch already knows about
    if (!inc || inc.callIds.length <= 1) return escalate(call, 'new incident — needs a human');
    await wait(400);
    sendSafetyCard(call, inc);
    await wait(600);
    aiSay(call, 'closing');
    call.intake.step = 'done';
    call.state = 'ai_resolved';
    call.resolvedAt = now();
    toCaller(call.id, { t: 'call.info', state: 'ai_resolved' });
    audit('AI', 'intake.resolved', `Call #${call.num} handled by AI intake — no new hazards`, { callId: call.id });
    // a live caller who stays on the line probably still needs help
    if (live) setTimeout(() => { if (call.state === 'ai_resolved' && !call.endedAt) escalate(call, 'caller stayed on the line after the AI finished'); }, 45000);
  }
  touch();
}

// Safety instructions the AI gives callers it can close (they are near a known event, not in need of rescue).
// Uses the same pre-translated, human-written protocol cards; nothing is AI-generated.
const SAFETY_CARD = { fire: 'wildfire_evac', gas: 'gas_leak', quake: 'earthquake' };
function sendSafetyCard(call, inc) {
  const cardId = SAFETY_CARD[inc?.category || call.analysis?.category];
  const card = cardId && cardForLang(cardId, call.lang);
  if (!card) return;
  aiSay(call, 'safety');
  const orig = card.steps.map((st, i) => `${i + 1}. ${st}`).join(' ');
  const en = card.stepsEn.map((st, i) => `${i + 1}. ${st}`).join(' ');
  const line = addLine(call, { who: 'ai', orig, en, lang: call.lang, engine: 'pre-translated', trMs: 0, protocol: { cardId, step: -1, title: card.title } });
  call.protocols.push({ cardId, step: -1, t: now() });
  toCaller(call.id, { t: 'call.protocol', card, step: -1, all: true, lineId: line.id });
}

function knownEventFor(call) {
  const a = call.analysis;
  if (!a || !call.loc) return null;
  for (const inc of S.incidents.values()) {
    if (inc.status === 'closed' || !inc.center || inc.category !== a.category) continue;
    if (!['fire', 'quake', 'flood', 'gas', 'crash'].includes(inc.category)) continue;
    if (inc.callIds.length >= 4 && hav(inc.center, call.loc) <= (inc.radius || 0) + 700) return inc;
  }
  return null;
}

export function escalate(call, why = 'caller requested') {
  if (['active', 'ended', 'abandoned'].includes(call.state) || call.state === 'escalated') return;
  aiSay(call, 'connecting');
  call.state = 'escalated';
  call.escalatedAt = now();
  call.intake.step = 'dispatcher';
  call.flags.escalateReason = why;
  toCaller(call.id, { t: 'call.info', state: 'escalated' });
  audit('AI', 'intake.escalate', `Call #${call.num} escalated to dispatcher — ${why}`, { callId: call.id });
  if (call.source === 'live') bus.emit('toast', { kind: 'escalate', text: `Call #${call.num} needs a dispatcher: ${why}`, callId: call.id });
  touch();
}

// ---------------------------------------------------------------- dispatcher actions
export function answerCall(callId) {
  const call = S.calls.get(callId);
  if (!call || ['active', 'ended'].includes(call.state)) return;
  const wasRinging = call.state === 'ringing';
  call.state = 'active';
  call.answeredAt = now();
  call.answeredBy = 'Dispatcher';
  call.flags.callback = false;
  toCaller(call.id, { t: 'call.answered', by: 'dispatcher', mode: S.mode });
  const key = wasRinging ? 'greet' : 'takeover';
  const orig = phrase(call.lang, key), en = phrase('en', key);
  const line = addLine(call, { who: 'dispatcher', orig, en, lang: call.lang, engine: 'pre-translated', trMs: 0 });
  call.latency.out = { stt: 0, translate: 0, tts: null, total: null, engine: 'pre-translated', lineId: line.id };
  toCaller(call.id, { t: 'call.say', who: 'dispatcher', text: orig, en, lang: call.lang, lineId: line.id });
  audit('DISPATCHER', wasRinging ? 'call.answer' : 'call.takeover', `Call #${call.num}`, { callId: call.id });
  touch();
}

export async function dispatcherSay(callId, text, { sttMs = 0 } = {}) {
  const call = S.calls.get(callId);
  if (!call || !text.trim() || ['ended', 'abandoned'].includes(call.state)) return;
  const r = await translate(text.trim(), 'en', call.lang, { romanized: !!call.flags.romanized });
  const line = addLine(call, { who: 'dispatcher', orig: r.text, en: text.trim(), lang: call.lang, engine: r.engine, trMs: r.ms });
  call.latency.out = { stt: sttMs, translate: r.ms, tts: null, total: null, engine: r.engine, lineId: line.id };
  const quick = call.mode === 'text' && /\?\s*$/.test(text) && /^\s*(is|are|do|does|did|can|could|will|would|have|has|was|were|should|any)\b/i.test(text) ? ['yes', 'no'] : null;
  toCaller(call.id, { t: 'call.say', who: 'dispatcher', text: r.text, en: text.trim(), lang: call.lang, lineId: line.id, quick });
  touch();
}

export function callerTtsReport(callId, ms, lineId) {
  const call = S.calls.get(callId);
  if (!call?.latency?.out || (lineId && call.latency.out.lineId !== lineId)) return;
  const o = call.latency.out;
  o.tts = ms;
  o.total = (o.stt || 0) + (o.translate || 0) + ms;
  touch();
}

export function protocolSend(callId, cardId, step = 0) {
  const call = S.calls.get(callId);
  const card = cardForLang(cardId, call?.lang);
  if (!call || !card) return;
  const idx = Math.max(0, Math.min(card.steps.length - 1, step));
  const line = addLine(call, { who: 'dispatcher', orig: card.steps[idx], en: card.stepsEn[idx], lang: call.lang, engine: 'pre-translated', trMs: 0, protocol: { cardId, step: idx, title: card.title } });
  call.latency.out = { stt: 0, translate: 0, tts: null, total: null, engine: 'pre-translated', lineId: line.id };
  call.protocols.push({ cardId, step: idx, t: now() });
  toCaller(call.id, { t: 'call.protocol', card, step: idx, lineId: line.id });
  audit('DISPATCHER', 'protocol.send', `${card.title} · step ${idx + 1} → call #${call.num}`, { callId: call.id });
  touch();
}

export function endCall(callId, by = 'dispatcher') {
  const call = S.calls.get(callId);
  if (!call || ['ended', 'abandoned'].includes(call.state)) return;
  const unanswered = ['ringing', 'intake', 'escalated'].includes(call.state);
  call.endedAt = now();
  if (by === 'caller' && unanswered) { call.state = 'abandoned'; call.flags.callback = true; }
  else call.state = call.state === 'ai_resolved' ? 'ai_resolved' : 'ended';
  if (by === 'dispatcher') toCaller(call.id, { t: 'call.end', by: 'dispatcher' });
  audit(by === 'caller' ? 'CALLER' : 'DISPATCHER', 'call.end', `Call #${call.num} ${call.state}`, { callId: call.id });
  touch();
}

export function callerHelp(callId) {
  const call = S.calls.get(callId);
  if (call && ['intake', 'ai_resolved'].includes(call.state)) {
    if (call.state === 'ai_resolved') call.state = 'intake';
    escalate(call, 'caller asked for a human');
  }
}

export async function dispatchUnits(incId, unitIds) {
  const inc = S.incidents.get(incId);
  if (!inc || !inc.center) return;
  for (const uid of unitIds) {
    const u = S.units.find((x) => x.id === uid);
    if (!u || u.status !== 'avail') continue;
    const r = await route(u, inc.center);
    u.route = r; u.routeId++; u.prog = 0; u.status = 'enroute'; u.incidentId = inc.id;
    u.t0 = now(); u.travelSec = Math.max(8, r.dur / S.scale); u.etaSec = Math.round(r.dur);
    S.routes.set(u.id, { id: u.routeId, coords: r.coords });
    bus.emit('route', u.id, { id: u.routeId, coords: r.coords });
    if (!inc.units.includes(u.id)) inc.units.push(u.id);
    inc.timeline.push({ t: now(), text: `${u.label} dispatched · ETA ${Math.round(r.dur / 60)} min${r.approx ? ' (est.)' : ''}`, unit: true });
    audit('DISPATCHER', 'unit.dispatch', `${u.label} → Event #${inc.num} (ETA ${Math.round(r.dur / 60)} min, route ${r.cached ? 'cached' : r.ms + ' ms'})`, { incId: inc.id });
  }
  inc.status = 'dispatched';
  inc.rec = null;
  scheduleRecommend(inc, null);
  notifyEta();
  touch();
}

export function tickUnits() {
  let moved = false;
  for (const u of S.units) {
    if (u.status !== 'enroute' || !u.route) continue;
    const f = Math.min(1, (now() - u.t0) / 1000 / u.travelSec);
    const p = pointAlong(u.route, f * u.route.dist);
    u.lat = p.lat; u.lng = p.lng; u.prog = f;
    u.etaSec = Math.round((1 - f) * u.route.dur);
    moved = true;
    if (f >= 1) {
      u.status = 'onscene'; u.etaSec = 0;
      const inc = S.incidents.get(u.incidentId);
      if (inc) {
        inc.timeline.push({ t: now(), text: `${u.label} on scene`, unit: true });
        audit('SYSTEM', 'unit.arrive', `${u.label} on scene · Event #${inc.num}`, { incId: inc.id });
      }
    }
  }
  if (moved) touch();
}

export function notifyEta() {
  for (const inc of S.incidents.values()) {
    const en = inc.units.map((id) => S.units.find((u) => u.id === id)).filter((u) => u && u.status !== 'avail');
    if (!en.length) continue;
    const enroute = en.filter((u) => u.status === 'enroute').sort((a, b) => a.etaSec - b.etaSec)[0];
    const msg = enroute
      ? { t: 'call.eta', unit: enroute.label, type: TYPE_META[enroute.type].name, etaSec: enroute.etaSec, scale: S.scale, status: 'enroute' }
      : { t: 'call.eta', unit: en[0].label, type: TYPE_META[en[0].type].name, etaSec: 0, status: 'onscene' };
    for (const cid of inc.callIds) {
      const c = S.calls.get(cid);
      if (c && c.source === 'live' && !['ended', 'abandoned'].includes(c.state)) toCaller(cid, msg);
    }
  }
}

export function closeIncident(incId) {
  const inc = S.incidents.get(incId);
  if (!inc) return;
  inc.status = 'closed';
  for (const uid of inc.units) {
    const u = S.units.find((x) => x.id === uid);
    if (u) { u.status = 'avail'; u.lat = u.home.lat; u.lng = u.home.lng; u.incidentId = null; u.route = null; bus.emit('route', u.id, null); S.routes.delete(u.id); }
  }
  for (const cid of inc.callIds) {
    const c = S.calls.get(cid);
    if (c && !['ended', 'abandoned'].includes(c.state)) {
      c.state = c.state === 'ai_resolved' ? 'ai_resolved' : 'ended'; c.endedAt = now();
      if (c.source === 'live') toCaller(cid, { t: 'call.end', by: 'dispatcher' });
    }
  }
  audit('DISPATCHER', 'event.close', `Event #${inc.num} closed — units released`, { incId });
  touch();
}

export async function broadcast(text, incId = 'all') {
  const incs = incId === 'all' ? [...S.incidents.values()].filter((i) => i.status !== 'closed') : [S.incidents.get(incId)].filter(Boolean);
  const calls = incs.flatMap((i) => i.callIds.map((id) => S.calls.get(id))).filter((c) => c && !['ended'].includes(c.state));
  const langs = [...new Set(calls.map((c) => (c.lang === 'mix' ? 'es' : c.lang)))];
  const tr = await translateMany(text, langs);
  let delivered = 0;
  for (const c of calls) {
    const l = c.lang === 'mix' ? 'es' : c.lang;
    const orig = tr[l] || text;
    addLine(c, { who: 'broadcast', orig, en: text, lang: c.lang, engine: 'broadcast' });
    if (c.source === 'live') toCaller(c.id, { t: 'call.broadcast', text: orig, en: text, lang: c.lang });
    delivered++;
  }
  const rec = { id: ++S.seq.bc, t: now(), text, incId, delivered, langs };
  S.broadcasts.push(rec);
  for (const i of incs) i.timeline.push({ t: now(), text: `Broadcast to ${delivered} callers (${langs.length} languages): “${text}”`, broadcast: true });
  audit('DISPATCHER', 'broadcast', `“${text}” → ${delivered} callers in ${langs.length} languages`, {});
  touch();
  return rec;
}

export async function hazardAction(incId, hid, action) {
  const inc = S.incidents.get(incId);
  const h = inc?.hazards.find((x) => x.id === hid);
  if (!h) return;
  if (action === 'confirm') { h.status = 'confirmed'; h.conf = Math.min(1, h.conf + 0.05); }
  else if (action === 'dismiss') h.status = 'dismissed';
  else if (action === 'rescue') {
    h.status = 'actioned';
    const cands = S.units.filter((u) => u.status === 'avail' && u.type === 'R').sort((a, b) => hav(a, inc.center) - hav(b, inc.center));
    const pickU = cands[0] || S.units.filter((u) => u.status === 'avail' && u.type === 'E').sort((a, b) => hav(a, inc.center) - hav(b, inc.center))[0];
    if (pickU) await dispatchUnits(incId, [pickU.id]);
  }
  audit('DISPATCHER', `hazard.${action}`, `${h.label} · Event #${inc.num}`, { incId });
  touch();
}

export function mergeIncidents(srcId, dstId) {
  const src = S.incidents.get(srcId), dst = S.incidents.get(dstId);
  if (!src || !dst || src === dst) return;
  for (const cid of src.callIds) { const c = S.calls.get(cid); if (c) { c.incidentId = dst.id; dst.callIds.push(cid); } }
  for (const h of src.hazards) { if (!dst.hazards.find((x) => x.tag === h.tag && x.label === h.label)) dst.hazards.push(h); }
  for (const u of src.units) if (!dst.units.includes(u)) { dst.units.push(u); const unit = S.units.find((x) => x.id === u); if (unit) unit.incidentId = dst.id; }
  dst.locked = true;
  S.incidents.delete(srcId);
  refreshIncident(dst);
  dst.rec = null;
  dst.timeline.push({ t: now(), text: `Merged Event #${src.num} into this event` });
  audit('DISPATCHER', 'event.merge', `Event #${src.num} → #${dst.num}`, { incId: dst.id });
  if (dst.center) scheduleRecommend(dst, null);
  touch();
}

export function splitCall(callId) {
  const call = S.calls.get(callId);
  if (!call || !call.incidentId) return;
  const old = incidentOfCall(call);
  old.callIds = old.callIds.filter((id) => id !== call.id);
  refreshIncident(old);
  call.incidentId = null;
  const id = `I${++S.seq.inc}`;
  const a = call.analysis;
  const inc = { id, num: S.seq.inc, category: a.category, type: a.type, severity: a.severity, tags: [], callIds: [call.id], center: null, radius: 0, address: '', summary: '', hazards: [], units: [], status: 'open', createdAt: now(), lastCallAt: now(), timeline: [{ t: now(), text: `Split from Event #${old.num}` }], rec: null, protocolId: a.protocolId, locked: true };
  S.incidents.set(id, inc);
  call.incidentId = id;
  refreshIncident(inc);
  updateHazards(inc, call);
  if (inc.center) scheduleRecommend(inc, call);
  audit('DISPATCHER', 'event.split', `Call #${call.num} split from Event #${old.num}`, { incId: id });
  touch();
}

export function interpBridge(callId) {
  const c = S.calls.get(callId);
  if (!c) return;
  addLine(c, { who: 'system', orig: 'Language-line interpreter (Mixteco / Triqui) bridged — simulated', en: 'Language-line interpreter bridged (simulated)', lang: 'en', engine: 'system' });
  c.flags.interpreterBridged = true;
  toCaller(c.id, { t: 'call.info', interpreter: true });
  audit('DISPATCHER', 'interpreter.bridge', `Call #${c.num} interpreter bridged`, { callId });
  touch();
}

export function verifyLoc(callId) {
  const c = S.calls.get(callId);
  if (c?.loc) { c.loc.verified = true; audit('DISPATCHER', 'loc.verify', `Call #${c.num} location verified`, { callId }); touch(); }
}

export async function setLoc(callId, lat, lng) {
  const c = S.calls.get(callId);
  if (!c) return;
  c.loc = { ...(c.loc || {}), lat, lng, acc: 15, source: 'dispatcher', verified: true };
  await reverseGeocode(c);
  const inc = incidentOfCall(c);
  if (inc) { refreshIncident(inc); inc.rec = null; scheduleRecommend(inc, c); }
  audit('DISPATCHER', 'loc.set', `Call #${c.num} pin moved → ${c.loc.address}`, { callId });
  touch();
}

export function tapReport(call, { cat, detail, trapped }) {
  const key = `${cat}.${detail}`;
  let en = TAP_EN[key] || 'I need help.';
  if (trapped) en += ' Someone is trapped.';
  return en;
}

export function setMode(mode) {
  if (!['routine', 'surge'].includes(mode) || S.mode === mode) return;
  S.mode = mode;
  S.surgeSuggested = false;
  audit('DISPATCHER', 'mode.set', `Mode → ${mode.toUpperCase()}`);
  if (mode === 'surge') {
    for (const c of S.calls.values()) if (c.state === 'ringing') startIntake(c);
  }
  for (const c of S.calls.values()) if (c.source === 'live' && !['ended', 'abandoned'].includes(c.state)) toCaller(c.id, { t: 'call.info', mode });
  touch();
}

export function resetAll() {
  for (const c of S.calls.values()) if (c.source === 'live') toCaller(c.id, { t: 'call.end', by: 'reset' });
  for (const i of S.incidents.values()) clearTimeout(i._recTimer);
  S.calls.clear(); S.incidents.clear(); S.audit.length = 0; S.broadcasts.length = 0;
  S.units = buildFleet(); S.routes.clear();
  S.seq = { call: 0, inc: 0, line: 0, hz: 0, bc: 0 };
  S.surgeSuggested = false;
  S.sim = { running: false, scenario: null, total: 0, spawned: 0, startedAt: 0 };
  audit('SYSTEM', 'reset', 'Console reset');
  bus.emit('routesReset');
  touch();
}

// ---------------------------------------------------------------- surge suggestion
export function checkSurge() {
  if (S.mode === 'surge') { S.surgeSuggested = false; return; }
  const recent = [...S.calls.values()].filter((c) => now() - c.createdAt < 3 * 60 * 1000 && c.loc);
  let clustered = 0;
  for (const c of recent) if (recent.filter((o) => hav(o.loc, c.loc) < 1500).length >= 8) { clustered = 8; break; }
  const was = S.surgeSuggested;
  S.surgeSuggested = clustered >= 8;
  if (S.surgeSuggested && !was) { audit('AI', 'surge.suggest', '8+ calls within 1.5 km in 3 min — suggest Surge Mode'); touch(); }
}

// ---------------------------------------------------------------- snapshot
function callJSON(c) {
  const sc = scoreCall(c);
  return {
    id: c.id, num: c.num, phone: c.phone, lang: c.lang, mode: c.mode, source: c.source, state: c.state, access: c.access,
    createdAt: c.createdAt, answeredAt: c.answeredAt, endedAt: c.endedAt, answeredBy: c.answeredBy,
    loc: c.loc, spokenAddress: c.spokenAddress, lines: c.lines.slice(-60), interim: c.interim,
    analysis: c.analysis, incidentId: c.incidentId, latency: c.latency, flags: c.flags, intake: c.intake,
    protocols: c.protocols.slice(-6), deltaIds: c.deltaIds,
    score: sc.score, priority: sc.priority, reasons: sc.reasons,
  };
}

function incJSON(i) {
  const { _recTimer, ...rest } = i;
  const calls = i.callIds.map((id) => S.calls.get(id)).filter(Boolean);
  const pr = calls.length ? Math.min(...calls.map((c) => scoreCall(c).priority)) : 4;
  return { ...rest, priority: pr, langs: [...new Set(calls.map((c) => c.lang))], liveCalls: calls.filter((c) => c.source === 'live').map((c) => c.id) };
}

export function snapshot() {
  const calls = [...S.calls.values()];
  const incs = [...S.incidents.values()];
  const open = incs.filter((i) => i.status !== 'closed');
  const unitsAvail = {};
  for (const u of S.units) { unitsAvail[u.type] = unitsAvail[u.type] || { total: 0, avail: 0 }; unitsAvail[u.type].total++; if (u.status === 'avail') unitsAvail[u.type].avail++; }
  const handled = calls.filter((c) => c.state === 'ai_resolved').length;
  return {
    now: now(), mode: S.mode, scale: S.scale, surgeSuggested: S.surgeSuggested, publicUrl: S.publicUrl,
    engine: engineStatus(), sim: S.sim,
    calls: calls.map(callJSON),
    incidents: incs.map(incJSON),
    units: S.units.map((u) => ({ id: u.id, label: u.label, type: u.type, station: u.stationName, lat: u.lat, lng: u.lng, status: u.status, incidentId: u.incidentId, routeId: u.routeId, prog: u.prog, etaSec: u.etaSec || 0 })),
    audit: S.audit.slice(-80),
    broadcasts: S.broadcasts.slice(-8),
    stats: {
      calls: calls.length,
      live: calls.filter((c) => !['ended', 'abandoned', 'ai_resolved'].includes(c.state)).length,
      aiHandled: handled,
      events: open.length,
      absorbed: open.reduce((s, i) => s + Math.max(0, i.callIds.length - 1), 0),
      callbacks: calls.filter((c) => c.state === 'abandoned' && c.flags.callback).length,
      unitsAvail,
      dispatcherTouched: calls.filter((c) => c.answeredBy === 'Dispatcher').length,
    },
  };
}

// ---------------------------------------------------------------- EIDO-shaped export
export function eido(incId) {
  const i = S.incidents.get(incId);
  if (!i) return null;
  const calls = i.callIds.map((id) => S.calls.get(id)).filter(Boolean);
  return {
    note: 'Simplified demonstration export shaped after NENA EIDO (NENA-STA-021). Not schema-validated.',
    eidoMessage: {
      incident: {
        incidentTrackingIdentifier: `BEACON-${i.num}`,
        incidentType: i.type, incidentPriority: `P${incPriority(i)}`, incidentStatus: i.status,
        incidentStartTime: new Date(i.createdAt).toISOString(),
        location: {
          pidfLo: i.center ? { point: { pos: `${i.center.lat} ${i.center.lng}`, srsName: 'urn:ogc:def:crs:EPSG::4326' }, uncertainty: Math.round(i.radius) } : null,
          civicAddress: calls.find((c) => c.loc?.civic)?.loc.civic || null, address: i.address,
        },
        narrative: calls.flatMap((c) => c.lines.filter((l) => l.who === 'caller').slice(0, 2).map((l) => ({ callNumber: c.num, language: c.lang, original: l.orig, english: l.en }))),
        hazards: i.hazards.map((h) => ({ label: h.label, status: h.status, confidence: h.conf, reportedByCalls: h.callIds.length })),
        resources: i.units.map((u) => { const un = S.units.find((x) => x.id === u); return { unit: un?.label, status: un?.status }; }),
        calls: calls.map((c) => ({ id: c.id, language: c.lang, mode: c.mode, handledBy: c.answeredBy || 'AI intake' })),
      },
    },
  };
}
const incPriority = (i) => Math.min(...i.callIds.map((id) => { const c = S.calls.get(id); return c ? scoreCall(c).priority : 4; }), 4);

export { CARD_BY_ID, STATIONS };
