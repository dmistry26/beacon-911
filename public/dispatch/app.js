import { LANGS } from '/shared/lang.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mmss = (sec) => { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
const setHTML = (el, html) => { if (el._h !== html) { el.innerHTML = html; el._h = html; return true; } return false; };
const flag = (l) => LANGS[l]?.flag || '🌐';

let ST = null;
let CARDS = [];
const routes = {};
const sel = { callId: null, incId: null, tab: 'call', card: {}, unchecked: {}, showDone: false, confirmed: new Set(), lastCallForScroll: null };
let ws, unlocked = false;

// ------------------------------------------------------------------ websocket
function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=dispatcher`);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'state') { ST = m; schedule(); }
    else if (m.t === 'route') { if (m.route) routes[m.unitId] = m.route; else delete routes[m.unitId]; schedule(); }
    else if (m.t === 'routesReset') { for (const k in routes) delete routes[k]; }
    else if (m.t === 'toast') toast(m.kind, m.text, m);
  };
  ws.onclose = () => setTimeout(connect, 1000);
}
const send = (o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
connect();
fetch('/api/protocols').then((r) => r.json()).then((c) => { CARDS = c; schedule(); });

let raf = 0;
function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }

// ------------------------------------------------------------------ helpers
const getCall = (id) => ST?.calls.find((c) => c.id === id);
const getInc = (id) => ST?.incidents.find((i) => i.id === id);
const selCall = () => getCall(sel.callId);

function toast(kind, text, m = {}) {
  const el = document.createElement('div');
  el.className = `toast ${kind || ''}`;
  el.textContent = text;
  el.style.cursor = 'pointer';
  el.onclick = () => { if (m.incId) selectInc(m.incId, true); else if (m.callId) selectCall(m.callId); el.remove(); };
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'hazard' ? 9000 : 5500);
  if (kind === 'hazard' || kind === 'escalate') beep([880, 660], 0.12);
}

let actx;
function beep(freqs, dur = 0.2) {
  if (!unlocked) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, actx.currentTime + i * dur);
      g.gain.exponentialRampToValueAtTime(0.18, actx.currentTime + i * dur + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (i + 1) * dur);
      o.connect(g).connect(actx.destination);
      o.start(actx.currentTime + i * dur); o.stop(actx.currentTime + (i + 1) * dur + 0.05);
    });
  } catch { /* ignore */ }
}
setInterval(() => { if (ST?.calls.some((c) => c.state === 'ringing' && c.source === 'live')) beep([440, 480], 0.45); }, 2200);

$('#startShift').onclick = () => { unlocked = true; $('#splash').remove(); beep([660], 0.1); };
if (location.search.includes('nosplash')) { unlocked = true; $('#splash')?.remove(); }

setInterval(() => { $('#clock').textContent = new Date().toLocaleTimeString([], { hour12: false }); }, 500);

// ------------------------------------------------------------------ render root
let lastMode = null;
function render() {
  if (!ST) return;
  document.body.classList.toggle('surge', ST.mode === 'surge');
  document.body.classList.toggle('routine', ST.mode !== 'surge');
  if (sel.callId && !getCall(sel.callId)) sel.callId = null;
  if (sel.incId && !getInc(sel.incId)) sel.incId = null;
  if (ST.mode !== 'surge' && sel.tab === 'events') setTab('call');
  if (ST.mode === 'surge' && lastMode !== 'surge' && !selCall()) setTab('events');
  lastMode = ST.mode;
  document.body.classList.toggle('intake-open', !!sel.showIntake);
  autoFocusLive();
  renderTop(); renderQueue(); renderSide(); renderBottom(); renderMap(); renderBanner(); renderBroadcast();
}

// bring a brand-new live (phone) call into focus so the demo never needs a hunt-and-click
const seenLive = new Set();
function autoFocusLive() {
  for (const c of ST.calls) {
    if (c.source !== 'live' || seenLive.has(c.id)) continue;
    seenLive.add(c.id);
    const cur = selCall();
    if (!cur || cur.source !== 'live' || ['ended', 'abandoned'].includes(cur.state)) {
      sel.callId = c.id; if (c.incidentId) sel.incId = c.incidentId; setTab('call');
      if (c.loc) { if (mapReady) map.flyTo({ center: [c.loc.lng, c.loc.lat], zoom: 13.4, duration: 900 }); else pendingFly = { center: [c.loc.lng, c.loc.lat], zoom: 13.4 }; }
    }
  }
}
let pendingFly = null;

// ------------------------------------------------------------------ top bar
function renderTop() {
  $$('#modesw button').forEach((b) => b.classList.toggle('on', b.dataset.mode === ST.mode));
  const s = ST.stats;
  const tot = Object.values(s.unitsAvail).reduce((a, b) => ({ t: a.t + b.total, a: a.a + b.avail }), { t: 0, a: 0 });
  const surge = ST.mode === 'surge';
  setHTML($('#stats'), `
    ${surge ? `<div class="stat big"><b>${s.calls} → ${s.events}</b><span>calls → events</span></div>` : ''}
    <div class="stat"><b>${s.live}</b><span>active calls</span></div>
    ${surge ? `<div class="stat ${s.absorbed ? 'hot' : ''}"><b>${s.absorbed}</b><span>dupes absorbed</span></div><div class="stat"><b>${s.aiHandled}</b><span>AI-handled</span></div>` : ''}
    <div class="stat"><b>${tot.a}/${tot.t}</b><span>units free</span></div>`);
  const e = ST.engine;
  setHTML($('#engine'), e.llm ? 'AI · FULL (Groq)' : 'AI · BASIC MODE');
  $('#engine').className = `chip ${e.llm ? 'ok' : 'warn'}`;
  $('#engine').title = e.llm ? `Translation: ${e.translateModel}\nTriage: ${e.analyzeModel}` : 'No Groq key found, so Beacon uses a slower free translator and simple rules for triage.\nAdd GROQ_API_KEY to the .env file and restart for full speed and accuracy.';
  const sb = $('#simBtn');
  sb.textContent = ST.sim.running ? `■ Stop simulation · ${ST.sim.spawned}/${ST.sim.total}` : '▶ Simulate wildfire surge';
  $('#demoBtn').textContent = ST.sim.running ? 'Demo · running ▾' : 'Demo ▾';
  sb.className = `btn ${ST.sim.running ? 'danger' : 'warn'}`;
  if (document.activeElement !== $('#scale')) $('#scale').value = String(ST.scale);
}

// ------------------------------------------------------------------ queue
function queueCalls() {
  const surge = ST.mode === 'surge';
  let list = ST.calls.filter((c) => ['ringing', 'intake', 'escalated', 'active'].includes(c.state));
  if (surge) list = list.filter((c) => c.state !== 'intake' || c.id === sel.callId);
  if (surge) list.sort((a, b) => b.score - a.score);
  else list.sort((a, b) => (b.state === 'ringing') - (a.state === 'ringing') || a.createdAt - b.createdAt);
  return list;
}

function renderQueue() {
  const surge = ST.mode === 'surge';
  $('#qtitle').textContent = surge ? 'NEEDS YOU · MOST URGENT FIRST' : 'CALL QUEUE';
  const list = queueCalls();
  const intakeN = ST.calls.filter((c) => c.state === 'intake').length;
  const aiDone = ST.calls.filter((c) => c.state === 'ai_resolved');
  const cb = ST.calls.filter((c) => c.state === 'abandoned' && c.flags.callback);
  $('#qcount').textContent = `${list.length} shown`;
  const now = ST.now;
  let html = list.map((c) => {
    const t = c.analysis?.type || (c.state === 'ringing' ? 'Incoming 911 call' : 'Listening…');
    const wait = c.state === 'active' ? now - c.answeredAt : now - c.createdAt;
    const chips = (c.reasons || []).slice(1, 4).map((r) => `<span class="rs ${/trapped|new info|unresponsive|weapon|AI escalated|cannot|explosion/i.test(r) ? 'hot' : ''}">${esc(r)}</span>`).join('');
    const st = c.state === 'active' ? '<span class="rs" style="background:#124a39;color:#35d6a3">ON CALL</span>' : c.state === 'escalated' ? '<span class="rs hot">ESCALATED</span>' : c.state === 'intake' ? '<span class="rs" style="color:#c46bff">AI INTAKE</span>' : '';
    return `<div class="qrow p${c.priority} ${c.state === 'ringing' ? 'ring' : ''} ${c.id === sel.callId ? 'sel' : ''}" data-call="${c.id}">
      <div class="pbadge">P${c.priority}</div>
      <div><div class="qt"><b>#${c.num}</b>${flag(c.lang)} ${esc(t)}${c.source === 'live' ? '<span class="livechip">LIVE</span>' : ''}</div>
      <div class="qs">${st}${chips}${c.flags.interpreter ? '<span class="rs new">INTERPRETER</span>' : ''}</div></div>
      <div class="qw">${c.state === 'ringing' ? `<button class="ansbtn" data-act="answer" data-call="${c.id}">ANSWER</button>` : mmss(wait / 1000)}</div>
    </div>`;
  }).join('');
  if (!list.length) html = surge
    ? `<div class="note" style="padding:24px;text-align:center;line-height:1.6"><b style="color:var(--grn)">Nothing needs you right now.</b><br>The AI is answering the other callers. Calls that mention someone trapped or hurt will appear here.</div>`
    : `<div class="note" style="padding:24px;text-align:center">No calls waiting.<br>Place a call from the Beacon caller app.</div>`;
  const done = (aiDone.length || cb.length)
    ? `<div class="qfoot" data-act="toggledone"><span>✓ Handled by AI · ${aiDone.length} &nbsp; ↩ Hung up, call back · ${cb.length}</span><span>${sel.showDone ? '▾' : '▸'}</span></div>` : '';
  let doneRows = '';
  if (sel.showDone) {
    doneRows = [...cb, ...aiDone].slice(-40).reverse().map((c) => `<div class="qrow qdone p${c.priority}" data-call="${c.id}"><div class="pbadge">${c.state === 'abandoned' ? '↩' : '🤖'}</div><div><div class="qt"><b>#${c.num}</b>${flag(c.lang)} ${esc(c.analysis?.type || 'No details')}</div><div class="qs"><span class="rs ${c.state === 'abandoned' ? 'hot' : ''}">${c.state === 'abandoned' ? 'HUNG UP — CALL BACK' : 'AI-HANDLED · no new hazards'}</span></div></div><div class="qw"></div></div>`).join('');
  }
  setHTML($('#qlist'), html + done + doneRows);
}

$('#qlist').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]');
  if (act?.dataset.act === 'answer') { e.stopPropagation(); send({ t: 'answer', callId: act.dataset.call }); selectCall(act.dataset.call); return; }
  if (act?.dataset.act === 'toggledone') { sel.showDone = !sel.showDone; render(); return; }
  const row = e.target.closest('.qrow');
  if (row) selectCall(row.dataset.call);
});

function selectCall(id, fly = true) {
  sel.callId = id; sel.tab = 'call';
  const c = getCall(id);
  if (c?.incidentId) sel.incId = c.incidentId;
  setTab('call');
  if (fly && c?.loc && mapReady) map.flyTo({ center: [c.loc.lng, c.loc.lat], zoom: Math.max(map.getZoom(), 13.2), duration: 900 });
  render();
}
function selectInc(id, fly = true) {
  sel.incId = id; if (ST?.mode === 'surge') setTab('events');
  const i = getInc(id);
  if (fly && i?.center && mapReady) map.flyTo({ center: [i.center.lng, i.center.lat], zoom: i.radius > 800 ? 13.4 : 14.5, duration: 900 });
  render();
}

// ------------------------------------------------------------------ side tabs
function setTab(t) {
  sel.tab = t;
  $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  $$('.pane').forEach((p) => p.classList.toggle('on', p.id === `pane-${t}`));
}
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { setTab(b.dataset.tab); render(); } });

function renderSide() {
  const open = ST.incidents.filter((i) => i.status !== 'closed');
  $('#evBadge').textContent = open.length || '';
  $('#evBadge').style.display = open.length ? '' : 'none';
  if (sel.tab === 'call') renderCall();
  else if (sel.tab === 'events') renderEvents();
  else if (sel.tab === 'units') renderUnits();
  else renderAudit();
}

// ------------------------------------------------------------------ CALL pane
function renderCall() {
  const c = selCall();
  $('#c-empty').hidden = !!c;
  $('#c-body').hidden = !c;
  if (!c) return;
  const inc = getInc(c.incidentId);
  const L = LANGS[c.lang];
  const ended = ['ended', 'abandoned'].includes(c.state);

  // header
  const stLabel = { ringing: 'RINGING', intake: 'AI INTAKE', escalated: 'ESCALATED', active: 'ON CALL', ai_resolved: 'AI-HANDLED', ended: 'ENDED', abandoned: 'HUNG UP' }[c.state];
  const btns = c.state === 'ringing' ? `<button class="btn ok" data-act="answer">☎ ANSWER</button>`
    : ['intake', 'escalated', 'ai_resolved'].includes(c.state) ? `<button class="btn ok" data-act="answer">☎ TAKE OVER</button>`
    : c.state === 'active' ? `<button class="btn danger" data-act="end">End call</button>` : '';
  const acc = c.access || {};
  const timer = c.state === 'active' ? mmss((ST.now - c.answeredAt) / 1000) : c.state === 'ringing' ? mmss((ST.now - c.createdAt) / 1000) : '';
  setHTML($('#c-head'), `
    <div class="chh"><span class="pbadge p${c.priority}" style="display:grid;width:30px;height:24px;border-radius:4px">P${c.priority}</span><h3>CALL #${c.num}</h3><span class="mono" style="color:var(--tx2)">${esc(c.phone)}</span><span class="timer">${timer}</span></div>
    <div class="chips">
      <span class="chip cy">${L.flag} ${esc(L.name)}</span>
      ${c.flags.langAuto ? `<span class="chip ok" title="Switched from ${esc(LANGS[c.flags.langAuto.from]?.name)} using ${esc(c.flags.langAuto.how)}">🌐 AUTO-DETECTED · ${esc(c.flags.langAuto.how)}</span>` : ''}
      <span class="chip ${c.state === 'active' ? 'ok' : c.state === 'escalated' ? 'red' : ''}">${stLabel}</span>
      <span class="chip">${{ voice: '🎙 VOICE', text: '⌨ TEXT · RTT' }[c.mode] || c.mode}</span>
      ${c.source === 'sim' ? '<span class="chip">SIMULATED</span>' : ''}
      ${acc.deaf || c.mode === 'text' ? '<span class="chip warn">CAPTIONS</span>' : ''}${acc.blind ? '<span class="chip warn">VOICE GUIDE</span>' : ''}${acc.large ? '<span class="chip warn">LARGE TEXT</span>' : ''}
      ${c.flags.romanized ? '<span class="chip">TYPING IN LATIN LETTERS · replies sent the same way</span>' : ''}
      ${c.flags.interpreter ? '<span class="chip warn">MIXTECO / TRIQUI — INTERPRETER</span>' : ''}
      ${c.flags.knownEvent ? '<span class="chip">TOLD ABOUT KNOWN EVENT</span>' : ''}
    </div>
    <div class="acts">${btns}${c.flags.interpreter ? '<button class="btn" data-act="interp">🔗 Bridge language-line interpreter</button>' : ''}</div>`);

  // location
  const loc = c.loc;
  setHTML($('#c-loc'), loc ? `
    <span style="font-size:15px">📍</span>
    <div style="flex:1;min-width:0"><div class="addr">${esc(loc.address || `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`)}</div>
    <div style="color:var(--tx3);font-size:11px">${loc.source === 'sim' ? 'Simulated location' : loc.source === 'gps' ? `Phone GPS · ±${Math.round(loc.acc || 0)} m` : loc.source === 'spoken' ? 'From spoken address' : 'Dispatcher-set'}${loc.source === 'gps' ? ' · drag the pin on the map to correct' : ''}</div></div>
    ${loc.verified ? '<span class="chip ok">✓ VERIFIED</span>' : `<button class="btn sm" data-act="verify">Verify location</button>`}
    ${c.flags.locMismatch ? `<div class="warnline">⚠ ${esc(c.flags.locMismatch)}</div>` : ''}
    ${c.state === 'ringing' || (!loc.address && loc.source === 'gps') ? '' : ''}` : `<span class="chip warn">NO LOCATION — ask caller for address</span>`);

  // transcript
  const tr = $('#c-tr');
  const atBottom = tr.scrollTop + tr.clientHeight >= tr.scrollHeight - 30 || sel.lastCallForScroll !== c.id;
  const rows = c.lines.map((l) => lineHTML(l, c)).join('') + (c.interim ? `<div class="ln caller interim"><div class="who">CALLER</div><div><div class="e">${esc(c.interim)} …</div></div></div>` : '');
  if (setHTML(tr, rows || '<div class="note">Waiting for the caller…</div>') && atBottom) tr.scrollTop = tr.scrollHeight;
  if (sel.lastCallForScroll !== c.id) { sel.lastCallForScroll = c.id; tr.scrollTop = tr.scrollHeight; }
  const si = $('#say-in');
  si.disabled = ended; $('#say-send').disabled = ended;
  si.placeholder = ended ? 'Call ended' : c.lang === 'en' ? 'Type or speak to the caller' : `Speak/type in English → ${L.name} for the caller`;

  // incident
  const a = c.analysis;
  if (a) {
    const conf = Math.round(a.confidence * 100);
    const ck = (f) => (sel.confirmed.has(`${c.id}:${f}`) ? '<span style="color:var(--grn)">✓</span>' : `<button class="btn sm" data-act="confirm" data-f="${f}">Confirm</button>`);
    const confirmed = sel.confirmed.has(`${c.id}:type`);
    setHTML($('#c-inc'), `<div class="sec"><div class="assess"><span class="pbadge p${c.priority}" style="display:grid;width:30px;height:24px;border-radius:4px">P${c.priority}</span><span class="t">${esc(a.type)}</span><span class="conf ${conf < 70 ? 'low' : ''}"><i style="width:${conf}%"></i></span><span class="mono" style="color:var(--tx3)">${conf}%</span>${confirmed ? '<span style="color:var(--grn);margin-left:auto">✓ confirmed</span>' : `<button class="btn sm" data-act="confirm" data-f="type" title="Confirm the AI's classification">Looks right</button>`}</div>
      <div class="tagrow">${a.tags.map((t) => `<span class="tag ${['trapped', 'unconscious', 'weapon', 'explosion', 'collapse', 'mobility'].includes(t) ? 'crit' : ''}">${esc(a.details?.[t] || t)}</span>`).join('')}</div>
      <div class="sumtxt">${esc(a.llmSummary || inc?.summary || '')}${ST.mode === 'surge' && inc ? ` · <a href="#" data-act="openinc" data-inc="${inc.id}" style="color:var(--cy)">Event #${inc.num} (${inc.callIds.length} calls)</a>${inc.callIds.length > 1 ? ' <a href="#" data-act="split" style="color:var(--tx3)">split out</a>' : ''}` : ''}</div></div>`);
  } else setHTML($('#c-inc'), '');

  // protocol
  const sug = a?.protocolId || inc?.protocolId;
  const cardId = sel.card[c.id] || sug || null;
  const card = CARDS.find((x) => x.id === cardId);
  if (!card && !ended && c.state !== 'ringing' && c.analysis) {
    setHTML($('#c-proto'), `<div class="sec"><h4>WHAT TO TELL THE CALLER</h4><div class="note" style="padding:0 0 8px">No instructions suggested yet. Keep asking questions, or pick a card:</div>
      <div class="cardchips">${CARDS.map((k) => `<span class="cchip" data-act="card" data-card="${k.id}">${k.icon} ${esc(k.title)}</span>`).join('')}</div></div>`);
  } else if (card && !ended && c.state !== 'ringing') {
    const sentSteps = new Set(c.protocols.filter((p) => p.cardId === cardId).map((p) => p.step));
    const last = c.protocols.filter((p) => p.cardId === cardId).at(-1)?.step ?? -1;
    const order = [...CARDS].sort((x, y) => (y.id === sug) - (x.id === sug));
    setHTML($('#c-proto'), `<div class="sec"><h4>WHAT TO TELL THE CALLER <span class="chip ok">verified protocol · sends instantly in their language</span></h4>
      <div class="cardchips">${(sel.allCards ? order : order.filter((k) => k.id === cardId || k.id === sug)).map((k) => `<span class="cchip ${k.id === cardId ? 'on' : k.id === sug ? 'sug' : ''}" data-act="card" data-card="${k.id}">${k.icon} ${esc(k.title)}${k.id === sug && k.id !== cardId ? ' ★' : ''}</span>`).join('')}<span class="cchip" data-act="allcards">${sel.allCards ? 'fewer ▴' : 'other cards ▾'}</span></div>
      <div style="margin-bottom:8px">${card.questions.map((q) => `<span class="qq" data-act="ask" data-q="${esc(q)}">❓ ${esc(q)}</span>`).join('')}</div>
      ${card.steps.map((s, i) => `<div class="step ${sentSteps.has(i) ? 'sent' : ''}"><div class="n">${i + 1}</div><div>${esc(s.en)}${c.lang !== 'en' ? `<div class="tl">${flag(c.lang)} ${esc(s[c.lang] || s.en)}</div>` : ''}</div><button class="btn sm ${sentSteps.has(i) ? '' : 'primary'}" data-act="pstep" data-step="${i}">${sentSteps.has(i) ? 'Resend' : 'Send'}</button></div>`).join('')}
      <div class="acts"><button class="btn primary" data-act="pnext" data-next="${Math.min(card.steps.length - 1, last + 1)}">Send ${last < 0 ? 'step 1' : last + 1 >= card.steps.length ? 'last step again' : `step ${last + 2}`} ▸</button></div></div>`);
  } else setHTML($('#c-proto'), '');

  // dispatch recommendation
  renderRec(c, inc);
}

function lineHTML(l, c) {
  const same = c.lang === 'en' || l.orig === l.en;
  const who = { caller: 'CALLER', dispatcher: 'YOU', ai: 'BEACON AI', broadcast: 'BROADCAST', system: 'SYSTEM' }[l.who] || l.who;
  const meta = [];
  if (l.protocol) meta.push(`📋 ${esc(l.protocol.title)} · ${l.protocol.step < 0 ? 'all steps, sent by AI' : `step ${l.protocol.step + 1}`}`);
  if (l.trMs) meta.push(`translated in ${l.trMs} ms · ${esc(l.engine)}`);
  else if (l.engine === 'pre-translated') meta.push('pre-translated · 0 ms');
  if (l.tap) meta.push('silent tap report');
  const o = same ? '' : `<div class="o">${flag(c.lang)} ${esc(l.orig)}</div>`;
  const e = `<div class="e">${esc(l.en)}</div>`;
  const body = l.who === 'caller' || l.who === 'ai' ? o + e : e + (same ? '' : `<div class="o">→ ${flag(c.lang)} ${esc(l.orig)}</div>`);
  return `<div class="ln ${l.who}"><div class="who">${who}</div><div>${body}<div class="m">${meta.join(' · ')}</div></div></div>`;
}

function renderRec(c, inc) {
  if (c.state === 'ringing') { setHTML($('#c-rec'), ''); return; }
  if (!inc || !inc.center || ['ended', 'abandoned'].includes(c.state)) { setHTML($('#c-rec'), inc && !inc.center ? '<div class="sec"><h4>DISPATCH</h4><div class="note">No location yet — cannot route units.</div></div>' : ''); return; }
  const unch = (sel.unchecked[inc.id] ||= new Set());
  const slots = inc.rec?.slots || [];
  const picks = slots.filter((s) => s.unitId && !unch.has(s.unitId));
  const assigned = inc.units.map((id) => ST.units.find((u) => u.id === id)).filter(Boolean);
  setHTML($('#c-rec'), `<div class="sec"><h4>SEND HELP <span class="chip cy">nearest units by road</span></h4>
    ${slots.map((s) => s.unitId ? `<div class="slot"><input type="checkbox" data-act="chk" data-u="${s.unitId}" ${unch.has(s.unitId) ? '' : 'checked'}><span class="ub ${s.type}">${esc(s.label)}</span><div>${esc(s.station)}<div style="color:var(--tx3);font-size:10.5px">${(s.distM / 1609).toFixed(1)} mi${s.approx ? ' · est.' : ' · by road'}</div></div><span class="eta">${mmss(s.etaSec)}</span><span></span></div>` : `<div class="slot short"><span></span><span class="ub ${s.type}">${s.type}</span><div>No ${esc(s.label)} available — request mutual aid</div><span></span><span></span></div>`).join('') || '<div class="note">Computing…</div>'}
    <div class="acts"><button class="btn primary" data-act="dispatch" ${picks.length ? '' : 'disabled'}>🚨 Dispatch ${picks.length} unit${picks.length === 1 ? '' : 's'}</button>${assigned.length ? '<button class="btn" data-act="closeinc">Close event · release units</button>' : ''}</div>
    ${assigned.length ? `<div style="margin-top:10px">${assigned.map((u) => `<div class="slot"><span></span><span class="ub ${u.type}">${esc(u.label)}</span><div>${u.status === 'onscene' ? 'On scene' : 'En route'} <span style="color:var(--tx3)">(demo ${ST.scale}×)</span></div><span class="eta">${u.status === 'onscene' ? '✓' : mmss(u.etaSec)}</span><span></span></div>`).join('')}</div>` : ''}</div>`);
}

// call-pane delegation
$('#pane-call').addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const c = selCall(); if (!c) return;
  const inc = getInc(c.incidentId);
  const a = t.dataset.act;
  if (a === 'answer') send({ t: 'answer', callId: c.id });
  else if (a === 'end') send({ t: 'end', callId: c.id });
  else if (a === 'verify') send({ t: 'verify', callId: c.id });
  else if (a === 'confirm') { sel.confirmed.add(`${c.id}:${t.dataset.f}`); render(); }
  else if (a === 'split') send({ t: 'split', callId: c.id });
  else if (a === 'openinc') { e.preventDefault(); selectInc(t.dataset.inc); }
  else if (a === 'allcards') { sel.allCards = !sel.allCards; render(); }
  else if (a === 'card') { sel.card[c.id] = t.dataset.card; render(); }
  else if (a === 'pstep') send({ t: 'protocol', callId: c.id, cardId: sel.card[c.id] || c.analysis?.protocolId || inc?.protocolId, step: +t.dataset.step });
  else if (a === 'pnext') send({ t: 'protocol', callId: c.id, cardId: sel.card[c.id] || c.analysis?.protocolId || inc?.protocolId, step: +t.dataset.next });
  else if (a === 'ask') send({ t: 'say', callId: c.id, text: t.dataset.q });
  else if (a === 'interp') send({ t: 'interp', callId: c.id });
  else if (a === 'chk') { const s = (sel.unchecked[inc.id] ||= new Set()); t.checked ? s.delete(t.dataset.u) : s.add(t.dataset.u); render(); }
  else if (a === 'dispatch' && inc) {
    const unch = sel.unchecked[inc.id] || new Set();
    send({ t: 'dispatch', incId: inc.id, unitIds: (inc.rec?.slots || []).filter((s) => s.unitId && !unch.has(s.unitId)).map((s) => s.unitId) });
  } else if (a === 'closeinc' && inc) send({ t: 'close', incId: inc.id });
});

// say box
function doSay(text, sttMs = 0) {
  const c = selCall(); if (!c || !text.trim()) return;
  send({ t: 'say', callId: c.id, text: text.trim(), sttMs });
}
$('#say-send').onclick = () => { doSay($('#say-in').value); $('#say-in').value = ''; };
$('#say-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') { doSay(e.target.value); e.target.value = ''; } });

// dispatcher microphone -> English speech recognition
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false, lastInterimAt = 0;
$('#say-mic').onclick = () => {
  if (!SR) return toast('escalate', 'Speech recognition needs Chrome or Safari. Type instead.');
  if (listening) { listening = false; rec?.stop(); $('#say-mic').classList.remove('on'); return; }
  rec = new SR(); rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = true;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) { const stt = lastInterimAt ? Date.now() - lastInterimAt : 280; doSay(r[0].transcript, Math.max(60, Math.min(stt, 1500))); $('#say-in').value = ''; lastInterimAt = 0; }
      else { lastInterimAt = Date.now(); $('#say-in').value = r[0].transcript; }
    }
  };
  rec.onend = () => { if (listening) { try { rec.start(); } catch { /* */ } } };
  rec.onerror = (e) => { if (e.error === 'not-allowed') { listening = false; $('#say-mic').classList.remove('on'); toast('escalate', 'Microphone permission denied'); } };
  listening = true; rec.start(); $('#say-mic').classList.add('on');
};

// ------------------------------------------------------------------ EVENTS pane
function renderEvents() {
  const open = ST.incidents.filter((i) => i.status !== 'closed').sort((a, b) => a.priority - b.priority || b.callIds.length - a.callIds.length);
  if (!open.length) { setHTML($('#pane-events'), '<div class="empty">No active events.<br>Calls are grouped into events automatically.</div>'); return; }
  setHTML($('#pane-events'), `<div class="note" style="padding:10px 14px 0">Each card is <b>one real incident</b>, however many people called about it. <span style="color:var(--red)">Red Δ items</span> are new dangers that only some callers reported.</div>` + open.map((i) => {
    const hz = i.hazards.filter((h) => h.status !== 'dismissed').sort((a, b) => (b.critical - a.critical) || (b.isDelta - a.isDelta) || (b.at - a.at));
    const units = i.units.map((id) => ST.units.find((u) => u.id === id)).filter(Boolean);
    const near = i.nearEvent ? ST.incidents.find((x) => x.id === i.nearEvent) : null;
    const rec = (i.rec?.slots || []).filter((s) => s.unitId);
    return `<div class="ev p${i.priority} ${i.id === sel.incId ? 'sel' : ''}" data-inc="${i.id}">
      <div class="evh"><span class="pbadge p${i.priority}" style="display:grid">P${i.priority}</span><b>EVENT #${i.num}</b><span>${esc(i.type)}</span><span class="evc">${i.callIds.length} call${i.callIds.length > 1 ? 's' : ''}</span></div>
      <div class="evaddr">📍 ${esc(i.address || 'location pending')}${i.center && i.callIds.length > 1 ? ` · ~${Math.round(i.radius)} m radius` : ''}</div>
      <div class="evsum">${esc(i.summary)}</div>
      <div class="evmeta">${i.langs.map((l) => `<span class="rs">${flag(l)} ${LANGS[l]?.name}</span>`).join('')}${near ? `<span class="rs new">outlier · near Event #${near.num}</span>` : ''}${i.callIds.length > 2 ? `<span class="rs">${i.callIds.length - 1} duplicates absorbed</span>` : ''}</div>
      ${hz.length ? `<div class="hzs"><div class="note" style="padding:6px 12px 2px;font-weight:700;letter-spacing:.1em;font-size:10px">DANGERS REPORTED — CHECK THESE</div>${hz.map((h) => `<div class="hzr ${h.critical ? 'crit' : ''} ${h.status}"><div class="d">${h.isDelta ? 'Δ' : '!'}</div><div><b>${esc(h.label)}</b>${h.status === 'confirmed' ? ' <span style="color:var(--grn)">✓ confirmed</span>' : ''}${h.status === 'actioned' ? ' <span style="color:var(--grn)">✓ rescue sent</span>' : ''}<div class="q">“${esc(h.quote)}” — call #${h.callNum} ${flag(h.lang)} · confidence ${Math.round(h.conf * 100)}%${h.count > 1 ? ` · corroborated ×${h.count}` : ''}</div></div>
        <div class="hzb">${h.status === 'new' ? `${h.critical ? `<button class="btn sm danger" data-act="hz" data-a="rescue" data-h="${h.id}">Dispatch rescue</button>` : ''}<button class="btn sm" data-act="hz" data-a="confirm" data-h="${h.id}">Confirm</button><button class="btn sm ghost" data-act="hz" data-a="dismiss" data-h="${h.id}">Dismiss</button>` : ''}<button class="btn sm ghost" data-act="listen" data-call="${h.callIds[0]}">Open call</button></div></div>`).join('')}</div>` : ''}
      <div class="evu">${units.length ? units.map((u) => `<span class="u ${u.status}">${esc(u.label)} ${u.status === 'onscene' ? '✓ on scene' : `· ${mmss(u.etaSec)}`}</span>`).join('') : `<span>No units assigned${rec.length ? ` · ${rec.length} recommended (${rec.map((s) => s.label).join(', ')})` : ''}</span>`}</div>
      <div class="eva">
        <button class="btn primary sm" data-act="evdispatch" ${rec.length ? '' : 'disabled'}>🚨 Dispatch recommended (${rec.length})</button>
        <button class="btn sm" data-act="evlocate">Locate</button>
        <button class="btn sm" data-act="evmerge">Merge…</button>
        <a class="btn sm" href="/api/incident/${i.id}/eido" download style="text-decoration:none">EIDO ⤓</a>
        ${units.length ? '<button class="btn sm ghost" data-act="evclose">Close</button>' : ''}
      </div>
      ${i.id === sel.incId ? `<div class="evtl">${i.timeline.slice(-12).reverse().map((t) => `<div>${new Date(t.t).toLocaleTimeString([], { hour12: false })} · ${esc(t.text)}</div>`).join('')}</div>` : ''}
    </div>`;
  }).join(''));
}
$('#pane-events').addEventListener('click', (e) => {
  const card = e.target.closest('.ev'); if (!card) return;
  const id = card.dataset.inc, t = e.target.closest('[data-act]');
  if (!t) { sel.incId = id; render(); return; }
  const inc = getInc(id);
  const a = t.dataset.act;
  if (a === 'hz') send({ t: 'hazard', incId: id, hid: t.dataset.h, action: t.dataset.a });
  else if (a === 'listen') selectCall(t.dataset.call);
  else if (a === 'evdispatch') send({ t: 'dispatch', incId: id, unitIds: (inc.rec?.slots || []).filter((s) => s.unitId).map((s) => s.unitId) });
  else if (a === 'evlocate') selectInc(id, true);
  else if (a === 'evclose') send({ t: 'close', incId: id });
  else if (a === 'evmerge') openMerge(id);
});

function openMerge(src) {
  const others = ST.incidents.filter((i) => i.id !== src && i.status !== 'closed');
  const m = $('#modal');
  m.hidden = false;
  m.innerHTML = `<div class="mcard"><h3>Merge Event #${getInc(src).num} into…</h3><div style="color:var(--tx3)">All calls, hazards and units move to the chosen event.</div><div class="mlist">${others.map((o) => `<button class="btn" data-dst="${o.id}">Event #${o.num} · ${esc(o.type)} · ${o.callIds.length} calls</button>`).join('') || '<div class="note">No other events.</div>'}</div><div class="acts"><button class="btn ghost" data-close>Cancel</button></div></div>`;
  m.onclick = (e) => {
    if (e.target === m || e.target.dataset.close !== undefined) m.hidden = true;
    const d = e.target.closest('[data-dst]');
    if (d) { send({ t: 'merge', src, dst: d.dataset.dst }); m.hidden = true; }
  };
}

// ------------------------------------------------------------------ UNITS / AUDIT
function renderUnits() {
  const order = { enroute: 0, onscene: 1, avail: 2 };
  const us = ST.units.slice().sort((a, b) => order[a.status] - order[b.status] || a.label.localeCompare(b.label));
  setHTML($('#pane-units'), us.map((u) => `<div class="urow" data-u="${u.id}"><span class="ub ${u.type}">${esc(u.label)}</span><div>${esc(u.station)}${u.incidentId ? ` <span style="color:var(--tx3)">→ Event #${getInc(u.incidentId)?.num ?? '?'}</span>` : ''}</div><span class="st ${u.status}">${u.status === 'enroute' ? `EN ROUTE ${mmss(u.etaSec)}` : u.status === 'onscene' ? 'ON SCENE' : 'AVAILABLE'}</span></div>`).join(''));
}
$('#pane-units').addEventListener('click', (e) => { const r = e.target.closest('.urow'); const u = r && ST.units.find((x) => x.id === r.dataset.u); if (u && mapReady) map.flyTo({ center: [u.lng, u.lat], zoom: 13 }); });
function renderAudit() {
  setHTML($('#pane-audit'), `<div class="note" style="padding:10px 12px">Append-only log of every AI suggestion and human decision.</div>` + ST.audit.slice().reverse().map((a) => `<div class="arow"><span class="t">${new Date(a.t).toLocaleTimeString([], { hour12: false })}</span><span class="a ${a.actor}">${a.actor}</span><span>${esc(a.detail || a.action)}</span></div>`).join(''));
}

// ------------------------------------------------------------------ bottom: AI intake monitor (surge only)
function renderBottom() {
  if (ST.mode !== 'surge') return;
  const talking = ST.calls.filter((x) => x.state === 'intake').length;
  const head = `<div class="intakebar" data-act="toggleintake"><span>🤖 <b>AI is talking to ${talking} caller${talking === 1 ? '' : 's'}</b> in their own language. You only get pulled in if someone is trapped or hurt.</span><span class="lnk">${sel.showIntake ? 'Hide ▾' : 'Watch the conversations ▸'}</span></div>`;
  let body = '';
  if (sel.showIntake) {
    const tiles = ST.calls.filter((x) => ['intake', 'escalated', 'ai_resolved'].includes(x.state)).sort((a, b) => (b.lines.at(-1)?.t || 0) - (a.lines.at(-1)?.t || 0)).slice(0, 36);
    body = `<div class="tiles">${tiles.map((x) => {
      const last = x.lines.at(-1);
      return `<div class="tile ${x.state}" data-call="${x.id}"><div class="th"><span>#${x.num} ${flag(x.lang)}</span><span class="stt">${x.state === 'intake' ? 'AI TALKING' : x.state === 'escalated' ? 'NEEDS YOU' : '✓ DONE'}</span></div><div class="tl">${last ? `${last.who === 'ai' ? '🤖' : '🗣'} ${esc(last.en)}` : '…'}</div></div>`;
    }).join('') || '<div class="note">No conversations yet.</div>'}</div>`;
  }
  setHTML($('#intake'), head + body);
}
$('#intake').addEventListener('click', (e) => { if (e.target.closest('[data-act=toggleintake]')) { sel.showIntake = !sel.showIntake; render(); return; } const t = e.target.closest('.tile'); if (t) selectCall(t.dataset.call); });

// ------------------------------------------------------------------ banner / resources / broadcast
function renderBanner() {
  let html = '';
  if (ST.surgeSuggested && ST.mode === 'routine') html = `<div><span>⚠ Call surge detected — 8+ calls within 1.5 km in 3 min.</span><button class="btn warn" data-act="surgeon">Enable Surge Mode</button></div>`;
  else if (ST.mode === 'surge') {
    const st = ST.stats, needs = ST.calls.filter((c) => c.state === 'escalated' || c.state === 'ringing').length;
    const talking = ST.calls.filter((c) => c.state === 'intake').length;
    html = `<div class="surgeon"><b>SURGE MODE</b><span><b>${st.calls}</b> calls → grouped into <b>${st.events}</b> events · AI talking to <b>${talking}</b> · AI finished <b>${st.aiHandled}</b> · <b style="color:${needs ? '#ff9aa2' : '#8fe8c1'}">${needs ? `${needs} need you` : 'nothing needs you'}</b></span></div>`;
  }
  setHTML($('#banner'), html);
  // resource board
  const names = { E: 'ENG', T: 'TRK', M: 'ALS', R: 'RSC', P: 'PD' };
  const ua = ST.stats.unitsAvail;
  const low = Object.entries(ua).filter(([, v]) => v.avail <= 1);
  setHTML($('#resboard'), ST.mode === 'surge' || ST.units.some((u) => u.status !== 'avail') ? `<h5>RESOURCES · AVAILABLE / TOTAL</h5>${['E', 'T', 'M', 'R', 'P'].map((k) => { const v = ua[k] || { avail: 0, total: 1 }; return `<div class="rb ${v.avail <= 1 ? 'low' : ''}"><span>${names[k]}</span><div class="meter"><i style="width:${(v.avail / v.total) * 100}%"></i></div><span>${v.avail}/${v.total}</span></div>`; }).join('')}${low.length ? `<div class="rbwarn">⚠ Low: ${low.map(([k, v]) => `${names[k]} (${v.avail})`).join(', ')} — consider mutual aid</div>` : ''}` : '');
}
$('#banner').addEventListener('click', (e) => { if (e.target.dataset.act === 'surgeon') send({ t: 'mode', mode: 'surge' }); });

let bcSig = '';
function renderBroadcast() {
  $('#bcbar').hidden = ST.mode !== 'surge';
  const open = ST.incidents.filter((i) => i.status !== 'closed');
  const sig = open.map((i) => `${i.id}:${i.callIds.length}`).join();
  if (sig !== bcSig) {
    const cur = $('#bc-target').value;
    $('#bc-target').innerHTML = `<option value="all">All active callers</option>` + open.map((i) => `<option value="${i.id}">Event #${i.num} · ${esc(i.type)} (${i.callIds.length})</option>`).join('');
    if ([...$('#bc-target').options].some((o) => o.value === cur)) $('#bc-target').value = cur;
    bcSig = sig;
  }
}
$('#bc-send').onclick = () => { const t = $('#bc-text').value.trim(); if (!t) return; send({ t: 'broadcast', text: t, incId: $('#bc-target').value }); $('#bc-text').value = ''; };
$('#bc-text').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#bc-send').click(); });

// ------------------------------------------------------------------ header controls
$('#demoBtn').onclick = (e) => { e.stopPropagation(); $('#demoMenu').hidden = !$('#demoMenu').hidden; };
document.addEventListener('click', (e) => { if (!e.target.closest('.simctl')) $('#demoMenu').hidden = true; });
$('#moreTab').onclick = () => { document.body.classList.toggle('more'); };
$('#modesw').onclick = (e) => { const b = e.target.closest('button'); if (b) send({ t: 'mode', mode: b.dataset.mode }); };
$('#simBtn').onclick = () => { $('#demoMenu').hidden = true; send({ t: 'sim', on: !ST.sim.running, scenario: 'wildfire' }); };
$('#scale').onchange = (e) => send({ t: 'scale', scale: +e.target.value });
$('#resetBtn').onclick = () => { if (confirm('Reset the console? All calls, events and dispatched units will be cleared.')) { sel.callId = null; sel.incId = null; send({ t: 'reset' }); } };
$('#qrBtn').onclick = async () => {
  $('#demoMenu').hidden = true;
  const r = await (await fetch('/api/caller-url')).json();
  const m = $('#modal'); m.hidden = false;
  m.innerHTML = `<div class="mcard"><h3>Place a call from your phone</h3><div style="color:var(--tx2)">Scan with your phone camera to open the Beacon caller app.</div><div class="qr"><img src="/api/qr.svg?${Date.now()}" style="width:100%;height:100%"></div><code>${esc(r.url)}</code>${r.secure ? '' : `<div style="color:var(--yel);margin-top:10px;font-size:12px">⚠ Phones require HTTPS for microphone + GPS. Run <b>npm run demo</b> to start a free secure tunnel, or paste a public HTTPS URL below.</div><div style="display:flex;gap:6px;margin-top:8px"><input id="pub" placeholder="https://xxxx.trycloudflare.com" style="flex:1"><button class="btn primary" id="pubOk">Use</button></div>`}<div class="acts"><button class="btn ghost" data-close>Close</button></div></div>`;
  m.onclick = (e) => { if (e.target === m || e.target.dataset.close !== undefined) m.hidden = true; if (e.target.id === 'pubOk') { send({ t: 'publicUrl', url: $('#pub').value.trim().replace(/\/$/, '') }); m.hidden = true; } };
};

// ------------------------------------------------------------------ MAP
let map, mapReady = false;
const markers = { units: new Map(), incs: new Map(), pin: null };
const PCOL = ['match', ['get', 'pr'], 1, '#ff3b47', 2, '#ff8a3d', 3, '#f5c542', '#6b7c93'];
const UCOL = { E: '#ff5a4f', T: '#ff9f1c', M: '#35d6a3', R: '#c46bff', P: '#4da3ff' };

function initMap() {
  map = new maplibregl.Map({
    container: 'map', style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    center: [-121.98, 37.02], zoom: 9.4, attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.on('load', () => {
    const empty = { type: 'FeatureCollection', features: [] };
    for (const s of ['calls', 'incs', 'routes', 'acc']) map.addSource(s, { type: 'geojson', data: empty });
    map.addLayer({ id: 'inc-fill', type: 'fill', source: 'incs', paint: { 'fill-color': PCOL, 'fill-opacity': 0.13 } });
    map.addLayer({ id: 'inc-line', type: 'line', source: 'incs', paint: { 'line-color': PCOL, 'line-width': 1.6, 'line-dasharray': [3, 2] } });
    map.addLayer({ id: 'acc-fill', type: 'fill', source: 'acc', paint: { 'fill-color': '#4da3ff', 'fill-opacity': 0.14 } });
    map.addLayer({ id: 'acc-line', type: 'line', source: 'acc', paint: { 'line-color': '#4da3ff', 'line-width': 1.4 } });
    map.addLayer({ id: 'route-casing', type: 'line', source: 'routes', paint: { 'line-color': '#000', 'line-width': 6, 'line-opacity': 0.5 }, layout: { 'line-cap': 'round' } });
    map.addLayer({ id: 'route-line', type: 'line', source: 'routes', paint: { 'line-color': ['get', 'color'], 'line-width': 3 }, layout: { 'line-cap': 'round' } });
    map.addLayer({ id: 'calls-glow', type: 'circle', source: 'calls', paint: { 'circle-color': PCOL, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 5, 14, 16], 'circle-opacity': 0.18, 'circle-blur': 0.8 } });
    map.addLayer({ id: 'calls-dot', type: 'circle', source: 'calls', paint: { 'circle-color': PCOL, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 14, 6], 'circle-stroke-color': ['case', ['get', 'sel'], '#fff', '#0b0f14'], 'circle-stroke-width': ['case', ['get', 'sel'], 2.5, 1] } });
    map.on('click', 'calls-dot', (e) => { const id = e.features[0].properties.id; if (id) selectCall(id, false); });
    map.on('mouseenter', 'calls-dot', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'calls-dot', () => { map.getCanvas().style.cursor = ''; });
    mapReady = true;
    map.resize();
    if (pendingFly) { map.jumpTo(pendingFly); pendingFly = null; }
    schedule();
  });
}
initMap();
new ResizeObserver(() => { if (map) map.resize(); }).observe($('#center'));

function circlePoly(c, r, n = 56) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    pts.push([c.lng + (r * Math.cos(a)) / (111320 * Math.cos((c.lat * Math.PI) / 180)), c.lat + (r * Math.sin(a)) / 111320]);
  }
  return pts;
}

function renderMap() {
  if (!mapReady) return;
  // calls
  const cf = ST.calls.filter((c) => c.loc && !['ended'].includes(c.state)).map((c) => ({ type: 'Feature', properties: { id: c.id, pr: c.priority, sel: c.id === sel.callId }, geometry: { type: 'Point', coordinates: [c.loc.lng, c.loc.lat] } }));
  map.getSource('calls').setData({ type: 'FeatureCollection', features: cf });
  // incident areas
  const open = ST.incidents.filter((i) => i.status !== 'closed' && i.center);
  map.getSource('incs').setData({ type: 'FeatureCollection', features: open.filter((i) => i.callIds.length > 1 || i.category === 'fire').map((i) => ({ type: 'Feature', properties: { pr: i.priority }, geometry: { type: 'Polygon', coordinates: [circlePoly(i.center, Math.max(i.radius, 90))] } })) });
  // routes
  const rf = ST.units.filter((u) => u.status === 'enroute' && routes[u.id]).map((u) => ({ type: 'Feature', properties: { color: UCOL[u.type] }, geometry: { type: 'LineString', coordinates: routes[u.id].coords } }));
  map.getSource('routes').setData({ type: 'FeatureCollection', features: rf });
  // accuracy circle + draggable pin for selected live call
  const c = selCall();
  const accF = c?.loc && c.loc.source === 'gps' && c.loc.acc ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circlePoly(c.loc, Math.max(c.loc.acc, 8))] } }] : [];
  map.getSource('acc').setData({ type: 'FeatureCollection', features: accF });
  if (c?.source === 'live' && c.loc && !['ended', 'abandoned'].includes(c.state)) {
    if (!markers.pin) {
      const el = document.createElement('div'); el.className = 'pin'; el.title = 'Drag to correct the caller location';
      markers.pin = new maplibregl.Marker({ element: el, draggable: true, anchor: 'bottom' }).setLngLat([c.loc.lng, c.loc.lat]).addTo(map);
      markers.pin.on('dragend', () => { const ll = markers.pin.getLngLat(); const cc = selCall(); if (cc) send({ t: 'setloc', callId: cc.id, lat: ll.lat, lng: ll.lng }); });
    }
    if (!markers.pin._dragging) markers.pin.setLngLat([c.loc.lng, c.loc.lat]);
  } else if (markers.pin) { markers.pin.remove(); markers.pin = null; }

  // unit markers (outer element is owned by MapLibre; style the inner node only)
  const seen = new Set();
  for (const u of ST.units) {
    seen.add(u.id);
    let m = markers.units.get(u.id);
    if (!m) {
      const el = document.createElement('div');
      const inner = document.createElement('div');
      inner.onclick = () => { const cur = ST.units.find((x) => x.id === u.id); if (cur?.incidentId) selectInc(cur.incidentId, false); };
      el.appendChild(inner);
      m = new maplibregl.Marker({ element: el }).setLngLat([u.lng, u.lat]).addTo(map);
      markers.units.set(u.id, m);
    }
    const inner = m.getElement().firstChild;
    const cls = `um ${u.type} ${u.status}`;
    if (inner.className !== cls) inner.className = cls;
    if (inner.textContent !== u.label) inner.textContent = u.label;
    inner.title = `${u.label} · ${u.station} · ${u.status}`;
    m.setLngLat([u.lng, u.lat]);
  }
  // incident badges
  const seenI = new Set();
  for (const i of open) {
    seenI.add(i.id);
    let m = markers.incs.get(i.id);
    if (!m) {
      const el = document.createElement('div');
      const inner = document.createElement('div');
      inner.onclick = () => selectInc(i.id, false);
      el.appendChild(inner);
      m = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([i.center.lng, i.center.lat]).addTo(map);
      markers.incs.set(i.id, m);
    }
    const inner = m.getElement().firstChild;
    const cls = `im p${i.priority} ${i.id === sel.incId ? 'sel' : ''}`;
    if (inner.className !== cls) inner.className = cls;
    const html = `<b>${i.callIds.length}</b><span>${esc(i.type)}</span>`;
    if (inner._h !== html) { inner.innerHTML = html; inner._h = html; }
    m.setLngLat([i.center.lng, i.center.lat]);
  }
  for (const [id, m] of markers.units) if (!seen.has(id)) { m.remove(); markers.units.delete(id); }
  for (const [id, m] of markers.incs) if (!seenI.has(id)) { m.remove(); markers.incs.delete(id); }
}
