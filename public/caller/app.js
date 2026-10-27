import { LANGS, LANG_ORDER } from '/shared/lang.js';
import { tr } from './i18n.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get: (k, d) => { try { const v = localStorage.getItem('beacon.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('beacon.' + k, JSON.stringify(v)); } catch { /* */ } } };

// ------------------------------------------------------------------ prefs
const params = new URLSearchParams(location.search);
function detectLang() {
  const q = params.get('lang'); if (q && LANGS[q]) return q;
  const saved = store.get('lang'); if (saved && LANGS[saved]) return saved;
  const n = (navigator.language || 'en').toLowerCase();
  if (n.startsWith('es')) return 'es'; if (n.startsWith('vi')) return 'vi'; if (n.startsWith('zh')) return 'zh';
  if (n.startsWith('tl') || n.startsWith('fil')) return 'tl'; if (n.startsWith('hi')) return 'hi';
  return 'en';
}
const P = { lang: detectLang(), deaf: false, blind: false, large: false, mute: false, auto: true, loc: params.get('loc') || store.get('loc', 'oakridge') };
const PRESETS = {
  gps: { n: 'Real GPS' },
  oakridge: { n: 'Oakridge Mall, San José', lat: 37.25247, lng: -121.86297 },
  benlomond: { n: 'Ben Lomond · fire zone', lat: 37.0838, lng: -122.0812 },
  santacruz: { n: 'Santa Cruz', lat: 36.9741, lng: -122.0308 },
  scottsvalley: { n: 'Scotts Valley', lat: 37.0511, lng: -122.0147 },
  sanjose: { n: 'San José (Blossom Valley)', lat: 37.2440, lng: -121.8560 },
  monterey: { n: 'Monterey', lat: 36.6002, lng: -121.8947 },
  pasorobles: { n: 'Paso Robles', lat: 35.6266, lng: -120.6910 },
};

if (!PRESETS[P.loc]) P.loc = 'oakridge'; // old/unknown demo location -> safe default

const S = { screen: 'home', mode: 'voice', callId: null, num: null, state: 'idle', by: null, t0: 0, live: false, listening: false, speaking: 0, interimAt: 0, lineSeen: new Set(), etaBase: null, voiceOK: true, protoOpen: false };
let lastPos = null, locState = 'unknown';
const CFG = { whisper: false };
fetch('/api/config').then((r) => r.json()).then((c) => Object.assign(CFG, c)).catch(() => {});
let ws, wsReady = [], watchId = null, timerId = null, etaTimer = null;

// ------------------------------------------------------------------ websocket
function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=caller`);
  ws.onopen = () => { wsReady.splice(0).forEach((f) => f()); if (S.callId && S.live) send({ t: 'resume', callId: S.callId }); };
  ws.onmessage = (e) => onMsg(JSON.parse(e.data));
  ws.onclose = () => setTimeout(connect, 1000);
}
const send = (o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
const whenOpen = () => new Promise((r) => (ws && ws.readyState === 1 ? r() : wsReady.push(r)));
connect();

// ------------------------------------------------------------------ i18n helpers
const t = (k) => tr(P.lang, k);
function applyLang() {
  const L = LANGS[P.lang];
  document.documentElement.lang = P.lang === 'mix' ? 'es' : P.lang;
  $('#langFlag').textContent = L.flag; $('#langName').textContent = L.native;
  $('#callLbl').textContent = t('call'); $('#tagline').textContent = P.lang === 'mix' ? tr('es', 'tag') : t('tag');
  $('#typeLbl').textContent = t('type'); $('#demoNote').textContent = t('demo');
  $('#textIn').placeholder = t('typehere'); $('#humanBtn').textContent = t('human'); $('#setTitle').textContent = t('langTitle');
  $('#sheet [id=langList]').innerHTML = LANG_ORDER.map((k) => `<button class="lb ${k === P.lang ? 'on' : ''}" data-lang="${k}"><span>${LANGS[k].flag}</span><div><b>${LANGS[k].native}</b><small>${LANGS[k].name}</small></div></button>`).join('');
  document.body.classList.toggle('large', P.large);
  renderLocChip();
  if (S.screen === 'call') { renderStatus(); renderChips(); $('#textIn').placeholder = t('typehere'); }
}
applyLang();
renderLocChip();

// ------------------------------------------------------------------ settings sheet
const openSheet = () => { $('#sheet').hidden = false; };
$('#langBtn').onclick = openSheet;
$('#closeSheet').onclick = () => { $('#sheet').hidden = true; };
$('#sheet').addEventListener('click', (e) => {
  if (e.target === $('#sheet')) $('#sheet').hidden = true;
  const lb = e.target.closest('[data-lang]');
  if (lb) { P.lang = lb.dataset.lang; store.set('lang', P.lang); applyLang(); if (P.blind) say(t('call'), true); }
  const lc = e.target.closest('[data-loc]');
  if (lc) { P.loc = lc.dataset.loc; store.set('loc', P.loc); lastPos = null; renderLocList(); renderLocChip(); if (P.loc === 'gps') requestLoc(); }
});
let logoTaps = 0, logoT = 0;
$('#logo').onclick = () => { const n = Date.now(); logoTaps = n - logoT < 1500 ? logoTaps + 1 : 1; logoT = n; if (logoTaps >= 5) { logoTaps = 0; $('#demoLoc').hidden = false; renderLocList(); openSheet(); } };
function renderLocList() { $('#locList').innerHTML = Object.entries(PRESETS).map(([k, v]) => `<button data-loc="${k}" class="${P.loc === k ? 'on' : ''}">${v.n}</button>`).join(''); }
if (params.get('loc')) { $('#demoLoc').hidden = false; renderLocList(); }

// ------------------------------------------------------------------ speech (TTS)
let voices = [];
const loadVoices = () => { voices = speechSynthesis.getVoices(); };
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function pickVoice(lang) {
  const want = LANGS[lang].tts.toLowerCase(); const base = want.split('-')[0];
  const alt = base === 'fil' ? 'tl' : base;
  return voices.find((v) => v.lang.toLowerCase().replace('_', '-') === want) || voices.find((v) => v.lang.toLowerCase().startsWith(base)) || voices.find((v) => v.lang.toLowerCase().startsWith(alt)) || null;
}
let speakQ = Promise.resolve();
function speak(text, lang, lineId) {
  if (!('speechSynthesis' in window) || !text) return Promise.resolve();
  S.speaking++; pauseRec();
  speakQ = speakQ.then(() => new Promise((res) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(lang);
    if (v) u.voice = v; else if (S.voiceOK && lang !== 'en') { S.voiceOK = false; addBubble('sys', t('novoice')); }
    u.lang = LANGS[lang].tts; u.rate = 1.02;
    const t0 = performance.now(); let started = false;
    u.onstart = () => { if (!started) { started = true; if (lineId) send({ t: 'tts', ms: Math.round(performance.now() - t0), lineId }); } };
    const done = () => res();
    u.onend = done; u.onerror = done;
    setTimeout(() => { if (!started) { done(); } }, 6000);
    speechSynthesis.speak(u);
  })).then(() => { S.speaking = Math.max(0, S.speaking - 1); if (!S.speaking) { S.spokeAt = Date.now(); resumeRec(); } });
  return speakQ;
}
// announcements for voice-guidance (blind) users
const say = (text, cancel = false) => { if (cancel) try { speechSynthesis.cancel(); } catch { /* */ } return speak(text, P.lang); };
function unlockAudio() {
  try {
    if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume();
  } catch { /* */ }
}

// ------------------------------------------------------------------ tones
let actx, ringId = null;
function tone(freqs, dur, vol = 0.15) {
  try {
    if (!actx) return;
    const o = actx.createOscillator(), g = actx.createGain();
    const t0 = actx.currentTime;
    o.type = 'sine'; freqs.forEach((f, i) => o.frequency.setValueAtTime(f, t0 + i * dur));
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.03); g.gain.setValueAtTime(vol, t0 + dur * freqs.length - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * freqs.length);
    o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur * freqs.length + 0.05);
  } catch { /* */ }
}
function startRing() { stopRing(); const r = () => { tone([440], 1.0, 0.12); setTimeout(() => tone([480], 1.0, 0.12), 0); }; r(); ringId = setInterval(r, 3000); }
function stopRing() { if (ringId) clearInterval(ringId); ringId = null; }
const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* */ } };
function notifyUser() {
  vib([120, 60, 120]);
  if (P.deaf) { const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
}

// ------------------------------------------------------------------ location
function renderLocChip() {
  const el = $('#locChip'); if (!el) return;
  const preset = PRESETS[P.loc];
  let txt, cls = '';
  if (!window.isSecureContext) { txt = `⚠ ${t('locinsecure')}`; cls = 'bad'; }
  else if (preset && preset.lat) { txt = `📍 Demo location: ${preset.n}`; cls = 'warn'; }
  else if (lastPos || locState === 'granted') { txt = `📍 ${t('locready')}`; cls = 'ok'; }
  else if (locState === 'denied') { txt = `🚫 ${t('locblocked')}`; cls = 'bad'; }
  else txt = `📍 ${t('locenable')}`;
  el.textContent = txt; el.className = `locchip ${cls}`;
}
function requestLoc() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (p) => { lastPos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; locState = 'granted'; renderLocChip(); },
    (e) => { if (e.code === 1) locState = 'denied'; renderLocChip(); },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
}
$('#locChip').onclick = () => {
  if (PRESETS[P.loc]?.lat) { $('#demoLoc').hidden = false; renderLocList(); openSheet(); return; }
  requestLoc();
};
try {
  navigator.permissions?.query({ name: 'geolocation' }).then((r) => {
    locState = r.state; renderLocChip();
    if (r.state === 'granted' && !PRESETS[P.loc]?.lat) requestLoc();
    r.onchange = () => { locState = r.state; renderLocChip(); };
  });
} catch { /* not supported */ }

function getLocation(maxWait = 2500) {
  const preset = PRESETS[P.loc];
  if (preset && preset.lat) {
    const j = () => (Math.random() - 0.5) * 0.0004;
    lastPos = { lat: preset.lat + j(), lng: preset.lng + j(), acc: 9 };
    return Promise.resolve(lastPos);
  }
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    let done = false;
    const fin = (p) => { if (!done) { done = true; resolve(p); } };
    setTimeout(() => fin(lastPos), Math.max(maxWait, 6000));
    navigator.geolocation.getCurrentPosition((p) => { lastPos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; locState = 'granted'; fin(lastPos); }, (e) => { if (e.code === 1) locState = 'denied'; fin(null); }, { enableHighAccuracy: true, timeout: Math.max(maxWait, 6000), maximumAge: 30000 });
  });
}
function watchLocation() {
  if (PRESETS[P.loc]?.lat || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition((p) => {
    lastPos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
    send({ t: 'loc', ...lastPos, source: 'gps' }); renderChips();
  }, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
}

// ------------------------------------------------------------------ call lifecycle
function show(screen) {
  S.screen = screen;
  $('#home').hidden = screen !== 'home'; $('#call').hidden = screen !== 'call';
}

async function startCall(mode) {
  unlockAudio();
  if (P.blind) say(t('g_call'), true);
  vib(40);
  S.mode = P.lang === 'mix' && mode === 'voice' ? 'text' : mode;
  Object.assign(S, { state: 'connecting', by: null, live: true, callId: null, t0: 0, lineSeen: new Set(), voiceOK: true });
  $('#caps').innerHTML = ''; $('#live').textContent = ''; $('#etaBar').hidden = true; $('#bcast').hidden = true; $('#proto').hidden = true; $('#quick').hidden = true;
  show('call'); renderStatus(); renderChips(); renderControls();
  startRing();
  const loc = await getLocation(2500);
  renderChips();
  await whenOpen();
  let device = store.get('device', null);
  if (!device) { device = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('device', device); }
  send({ t: 'start', device, lang: P.lang, mode: S.mode, loc, access: { deaf: P.deaf, blind: P.blind, large: P.large, mute: P.mute, auto: P.auto } });
  watchLocation();
  if (P.lang === 'mix') addBubble('sys', tr('es', 'interp'));
}

function onMsg(m) {
  switch (m.t) {
    case 'call.created': S.callId = m.callId; S.num = m.num; S.state = 'ringing'; renderStatus(); break;
    case 'call.answered': {
      stopRing(); S.state = m.by === 'ai' ? 'ai' : 'live'; S.by = m.by; if (!S.t0) { S.t0 = Date.now(); startTimer(); }
      tone([660, 880], 0.12, 0.12); vib([60, 40, 60]);
      renderStatus(); renderControls();
      if (S.mode === 'voice') { S.listening = true; startRec(); if (P.blind) say(t('g_live')); }
      break;
    }
    case 'call.say': onSay(m); break;
    case 'call.protocol': onProtocol(m); break;
    case 'call.eta': onEta(m); break;
    case 'call.broadcast': onBroadcast(m); break;
    case 'call.info': onInfo(m); break;
    case 'call.end': endCall(true); break;
    case 'call.lang': onLang(m.lang); break;
    case 'call.resumed': break;
  }
}

function onLang(lang) {
  if (!LANGS[lang] || lang === P.lang) return;
  P.lang = lang;               // not persisted: detection is per call
  applyLang();
  addBubble('sys', `🌐 ${t('detected')}: ${LANGS[lang].native}`);
  vib(40);
  if (rec) { pauseRec(); resumeRec(); }   // restart speech recognition in the new language
}

function onInfo(m) {
  if (m.state === 'escalated') { S.state = 'live'; S.by = 'dispatcher-pending'; $('#humanRow').hidden = true; renderStatus(); }
  if (m.state === 'ai_resolved') { renderControls(); }
  if (m.interpreter) addBubble('sys', t('interpOn'));
}

function onSay(m) {
  if (S.lineSeen.has(m.lineId)) return; S.lineSeen.add(m.lineId);
  const lang = P.lang;
  addBubble(m.who === 'ai' ? 'ai' : 'dispatcher', m.text);
  notifyUser();
  if (m.who === 'dispatcher') { S.by = 'dispatcher'; renderStatus(); }
  if (m.quick) showQuick(); else $('#quick').hidden = true;
  if (!P.deaf) speak(m.text, lang, m.lineId); else send({ t: 'tts', ms: 0, lineId: m.lineId });
  if (m.who === 'ai') renderControls();
}

function showQuick() {
  const q = $('#quick'); q.hidden = false;
  q.innerHTML = `<button class="y" data-q="yes">${esc(t('yes'))}</button><button class="n" data-q="no">${esc(t('no'))}</button>`;
}
$('#quick').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const word = t(b.dataset.q);
  send({ t: 'say', text: word, sttMs: 0 }); addBubble('out', word); $('#quick').hidden = true; vib(30);
});

function onProtocol(m) {
  const c = m.card;
  if (S.lineSeen.has(m.lineId)) return; S.lineSeen.add(m.lineId);
  S.protoOpen = true;
  const pr = $('#proto'); pr.hidden = false;
  const bpm = c.metronome;
  pr.innerHTML = `<div class="ph"><b>${c.icon} ${esc(c.stepsEn ? c.title : c.title)}</b><button class="x" aria-label="Close">✕</button></div>
    ${bpm ? `<div class="metro"><div class="beat p" style="--bpm-ms:${Math.round(60000 / bpm)}ms"></div><div><b>${esc(t('beat'))}</b><div style="color:var(--tx3);font-size:.8em">${bpm} / min</div></div></div>` : ''}
    ${c.steps.map((s, i) => `<div class="stp ${m.all ? 'cur' : i < m.step ? 'done' : i === m.step ? 'cur' : ''}"><i>${i + 1}</i><div>${esc(s)}</div></div>`).join('')}`;
  pr.querySelector('.x').onclick = () => { pr.hidden = true; stopMetro(); };
  if (m.all) {
    const text = c.steps.map((st, i) => `${i + 1}. ${st}`).join('\n');
    addBubble('ai', text); notifyUser();
    if (!P.deaf) speak(c.steps.join(' '), P.lang, m.lineId); else send({ t: 'tts', ms: 0, lineId: m.lineId });
    return;
  }
  const cur = pr.querySelector('.cur'); cur && cur.scrollIntoView({ block: 'nearest' });
  addBubble('dispatcher', c.steps[m.step]);
  notifyUser();
  if (bpm && m.step >= 2) startMetro(bpm); else stopMetro();
  if (!P.deaf) speak(c.steps[m.step], P.lang, m.lineId); else send({ t: 'tts', ms: 0, lineId: m.lineId });
}
let metroId = null;
function startMetro(bpm) { stopMetro(); const tick = () => { tone([1000], 0.05, 0.2); vib(35); }; tick(); metroId = setInterval(tick, 60000 / bpm); }
function stopMetro() { if (metroId) clearInterval(metroId); metroId = null; }

function onEta(m) {
  const bar = $('#etaBar');
  bar.hidden = false;
  S.etaBase = { at: Date.now(), sec: m.etaSec, scale: m.scale || 1, unit: m.unit, type: m.type, status: m.status };
  renderEta();
  if (!etaTimer) etaTimer = setInterval(renderEta, 1000);
}
function renderEta() {
  const e = S.etaBase; if (!e) return;
  const left = Math.max(0, e.sec - ((Date.now() - e.at) / 1000) * e.scale);
  const arrived = e.status === 'onscene' || left <= 0;
  const mm = Math.floor(left / 60), ss = Math.floor(left % 60);
  $('#etaBar').innerHTML = `<span class="ic">${e.type?.includes('Amb') ? '🚑' : e.type?.includes('Police') ? '🚔' : '🚒'}</span><div><b>${esc(t('onway'))}</b><small>${esc(e.unit)} · ${esc(e.type || '')}</small></div><div class="big">${arrived ? esc(t('onscene')) : `${mm}:${String(ss).padStart(2, '0')}`}</div>`;
  if (arrived && e.status !== 'announced') { e.status = 'announced'; notifyUser(); if (!P.deaf) speak(t('onscene'), P.lang); }
}

function onBroadcast(m) {
  const b = $('#bcast'); b.hidden = false;
  b.innerHTML = `<small>${esc(t('update'))}</small><div>${esc(m.text)}</div>`;
  addBubble('sys', `${t('update')}: ${m.text}`);
  notifyUser(); vib([200, 80, 200, 80, 200]); tone([880, 660, 880], 0.14, 0.15);
  if (!P.deaf) speak(m.text, P.lang);
  setTimeout(() => { b.hidden = true; }, 45000);
}

function endCall(fromServer = false) {
  if (!S.live) return;
  S.live = false; S.listening = false; stopRec(); stopRing(); stopMetro();
  if (!fromServer) send({ t: 'end' });
  if (watchId != null) navigator.geolocation.clearWatch(watchId); watchId = null;
  clearInterval(timerId); clearInterval(etaTimer); etaTimer = null;
  try { speechSynthesis.cancel(); } catch { /* */ }
  addBubble('sys', t('ended')); vib([200]);
  $('#status').textContent = t('ended'); $('#status').classList.remove('ok');
  S.callId = null; S.state = 'idle'; S.etaBase = null;
  setTimeout(() => { if (!S.live) { show('home'); } }, 1800);
}
$('#endBtn').onclick = () => endCall(false);

// ------------------------------------------------------------------ call UI
function renderStatus() {
  const st = $('#status');
  let txt = t('calling'); let ok = false;
  if (S.state === 'ringing') txt = t('ringing');
  else if (S.state === 'ai') txt = `${t('connected')} · ${t('ai')}`;
  else if (S.state === 'live') { txt = `${t('connected')} · ${t('disp')}`; ok = true; }
  if (S.state === 'live' && S.by === 'dispatcher-pending') txt = `${t('connected')} · ${t('waiting')}`;
  st.textContent = txt; st.classList.toggle('ok', ok || S.state === 'ai');
}
function renderChips() {
  const chips = [];
  chips.push(lastPos ? `<span class="chip ok">${esc(t('locok'))}${lastPos.acc ? ` · ±${Math.round(lastPos.acc)} m` : ''}</span>` : S.state === 'connecting' ? `<span class="chip">${esc(t('finding'))}</span>` : `<span class="chip warn">${esc(!window.isSecureContext ? t('locinsecure') : locState === 'denied' ? t('locblocked') : t('locno'))}</span>`);
  chips.push(`<span class="chip">${LANGS[P.lang].flag} ${esc(LANGS[P.lang].native)}</span>`);
  if (P.deaf) chips.push('<span class="chip warn">CC</span>');
  $('#chips').innerHTML = chips.join('');
}
function startTimer() { clearInterval(timerId); const tick = () => { const s = Math.floor((Date.now() - S.t0) / 1000); $('#timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }; tick(); timerId = setInterval(tick, 1000); }

function addBubble(kind, text) {
  const c = $('#caps');
  const d = document.createElement('div');
  if (kind === 'out') { d.className = 'b out'; d.textContent = text; }
  else if (kind === 'sys') { d.className = 'b sys'; d.textContent = text; }
  else { d.className = `b in ${kind}`; d.innerHTML = `<small>${esc(kind === 'ai' ? t('ai') : t('disp'))}</small>${esc(text)}`; }
  c.appendChild(d); c.scrollTop = c.scrollHeight;
}

function renderControls() {
  const m = S.mode;
  $('#voiceCtl').hidden = m !== 'voice'; $('#textCtl').hidden = m !== 'text';
  $('#humanRow').hidden = !(S.state === 'ai');
  if (m === 'voice') { $('#micBtn').classList.toggle('on', S.listening); }
}

// mic + recognition
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, recWanted = false;
function startRec() {
  recWanted = true;
  if (P.auto && CFG.whisper && navigator.mediaDevices?.getUserMedia && window.MediaRecorder) return startWhisper();
  if (!SR) { recWanted = false; addBubble('sys', t('nomic')); switchMode('text'); return; }
  if (rec) return;
  rec = new SR();
  rec.lang = LANGS[P.lang].stt; rec.continuous = true; rec.interimResults = true;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        const txt = r[0].transcript.trim(); if (!txt) continue;
        const stt = S.interimAt ? Math.min(1500, Math.max(60, Date.now() - S.interimAt)) : 300;
        S.interimAt = 0; $('#live').textContent = '';
        addBubble('out', txt); send({ t: 'say', text: txt, sttMs: stt });
      } else { S.interimAt = Date.now(); const txt = r[0].transcript; $('#live').textContent = txt; send({ t: 'interim', text: txt }); }
    }
  };
  rec.onerror = (e) => { if (['not-allowed', 'service-not-allowed'].includes(e.error)) { recWanted = false; rec = null; addBubble('sys', t('nomic')); switchMode('text'); } };
  rec.onend = () => { rec = null; if (recWanted && S.live && !S.speaking && S.mode === 'voice') setTimeout(() => { if (recWanted && !rec) startRec(); }, 200); };
  try { rec.start(); $('#micBtn').classList.add('on'); $('#micBtn').classList.remove('paused'); } catch { rec = null; }
}
function pauseRec() { if (rec) { try { rec.abort(); } catch { /* */ } rec = null; } $('#micBtn')?.classList.add('paused'); }
function resumeRec() { if (recWanted && S.live && S.mode === 'voice' && !rec && !wh) setTimeout(() => startRec(), 250); }
function stopRec() { recWanted = false; stopWhisper(); if (rec) { try { rec.abort(); } catch { /* */ } rec = null; } $('#micBtn').classList.remove('on'); }
$('#micBtn').onclick = () => { if (recWanted) { S.listening = false; stopRec(); } else { S.listening = true; startRec(); } vib(20); };
$('#kbBtn').onclick = () => switchMode('text');
function switchMode(m) { stopRec(); S.listening = false; S.mode = m; renderControls(); send({ t: 'prefs', access: { mode: m } }); if (m === 'text') setTimeout(() => $('#textIn').focus(), 100); }

// ---- automatic language detection by voice: record each utterance (simple VAD) -> server Whisper
let wh = null;
async function startWhisper() {
  if (wh) return;
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { recWanted = false; addBubble('sys', t('nomic')); switchMode('text'); return; }
  const ac = actx || new (window.AudioContext || window.webkitAudioContext)(); ac.resume && ac.resume();
  const an = ac.createAnalyser(); an.fftSize = 1024;
  const src = ac.createMediaStreamSource(stream); src.connect(an);
  const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  wh = { stream, an, src, buf: new Float32Array(an.fftSize), mime, mr: null, chunks: [], lastVoice: 0, started: 0, floor: 0.006, busy: 0 };
  wh.timer = setInterval(whTick, 40);
  $('#micBtn').classList.add('on'); $('#micBtn').classList.remove('paused');
}
function stopWhisper() {
  if (!wh) return;
  clearInterval(wh.timer);
  try { wh.mr && wh.mr.state !== 'inactive' && (wh.mr.onstop = null, wh.mr.stop()); } catch { /* */ }
  try { wh.src.disconnect(); } catch { /* */ }
  wh.stream.getTracks().forEach((tr) => tr.stop());
  wh = null;
}
function whTick() {
  if (!wh) return;
  // don't record while the phone is talking, or in the echo just after it stops
  if (S.speaking || Date.now() - (S.spokeAt || 0) < 900) { if (wh.mr) whAbort(); $('#micBtn').classList.add('paused'); return; }
  $('#micBtn').classList.remove('paused');
  wh.an.getFloatTimeDomainData(wh.buf);
  let sum = 0; for (let i = 0; i < wh.buf.length; i++) sum += wh.buf[i] * wh.buf[i];
  const rms = Math.sqrt(sum / wh.buf.length), now = Date.now();
  const thr = Math.max(0.02, wh.floor * 3.5);
  if (rms > thr) {
    wh.lastVoice = now;
    if (wh.mr) wh.voiced++;
    if (!wh.mr) {
      try {
        wh.mr = new MediaRecorder(wh.stream, wh.mime ? { mimeType: wh.mime } : undefined);
        wh.chunks = []; wh.started = now; wh.voiced = 1;
        wh.mr.ondataavailable = (e) => e.data.size && wh.chunks.push(e.data);
        wh.mr.start();
        $('#live').textContent = '🎙 …';
      } catch { wh.mr = null; }
    }
  } else if (!wh.mr) wh.floor = wh.floor * 0.97 + rms * 0.03;
  if (wh.mr && (now - wh.lastVoice > 900 || now - wh.started > 15000)) whFinish();
}
function whAbort() { const mr = wh.mr; wh.mr = null; try { mr.onstop = null; mr.stop(); } catch { /* */ } $('#live').textContent = ''; }
function whFinish() {
  const mr = wh.mr, dur = Date.now() - wh.started, chunks = wh.chunks, mime = wh.mime || mr.mimeType, voiced = wh.voiced || 0;
  wh.mr = null;
  mr.onstop = async () => {
    if (dur < 700 || voiced < 6) { $('#live').textContent = ''; return; } // too short or mostly silence: noise, not speech
    $('#live').textContent = '…';
    try {
      const blob = new Blob(chunks, { type: mime });
      const r = await fetch(`/api/stt?callId=${encodeURIComponent(S.callId)}&mime=${encodeURIComponent(mime)}&voicedMs=${voiced * 40}`, { method: 'POST', headers: { 'Content-Type': mime || 'application/octet-stream' }, body: blob });
      const j = await r.json();
      $('#live').textContent = '';
      if (j.text) addBubble('out', j.text);
    } catch { $('#live').textContent = ''; }
  };
  try { mr.stop(); } catch { $('#live').textContent = ''; }
}

// text mode (real-time text: every keystroke streamed)
let rttT = 0;
$('#textIn').addEventListener('input', (e) => { const now = Date.now(); if (now - rttT > 90) { rttT = now; send({ t: 'interim', text: e.target.value }); } });
$('#textCtl').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#textIn').value.trim(); if (!v) return;
  addBubble('out', v); send({ t: 'say', text: v, sttMs: 0 }); $('#textIn').value = ''; $('#quick').hidden = true; vib(20);
});
$('#humanBtn').onclick = () => { send({ t: 'help' }); $('#humanRow').hidden = true; vib(40); };

// ------------------------------------------------------------------ entry buttons
$('#callBtn').onclick = () => startCall(P.mute || P.deaf ? 'text' : 'voice');
$('#typeBtn').onclick = () => startCall('text');
$('#proto').addEventListener('click', () => {});
window.addEventListener('beforeunload', () => { if (S.live) send({ t: 'end' }); });

// voice-guidance: announce the home screen once
if (P.blind) setTimeout(() => say(`Beacon. ${t('call')}.`), 600);
// let the whole lower screen act as the call button for blind users
document.body.addEventListener('click', (e) => { if (P.blind && S.screen === 'home' && !e.target.closest('button, .sheet') ) startCall('voice'); });
