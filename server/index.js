import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';

try { process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')); } catch { /* no .env */ }

import * as E from './engine.js';
import { startSim, stopSim } from './sim.js';
import { CARDS } from './protocols.js';
import { transcribe, initModels } from './ai.js';
import { whisperLang } from './detect.js';

const { S, bus } = E;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'), { etag: true, maxAge: 0, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache, must-revalidate') }));
app.get('/', (_req, res) => res.redirect('/dispatch/'));
app.get('/caller', (_req, res) => res.redirect('/caller/'));
app.get('/api/config', (_req, res) => res.json({ whisper: !!process.env.GROQ_API_KEY }));
app.post('/api/stt', express.raw({ type: () => true, limit: '10mb' }), async (req, res) => {
  const call = S.calls.get(String(req.query.callId));
  if (!call || !process.env.GROQ_API_KEY || !req.body?.length) return res.json({ text: '' });
  try {
    // Hint the language once it's known (caller picked it, or they've already spoken), so short clips
    // aren't guessed as random languages.
    // Known = the caller picked a non-English language on the phone, or has already spoken.
    // (English isn't hinted up front: an English-set phone may still be used by a Spanish speaker.)
    const known = call.access?.auto === false || call.lang !== 'en' || call.lines.some((l) => l.who === 'caller');
    const hint = known ? (call.lang === 'mix' ? 'es' : call.lang) : null;
    const mime = String(req.query.mime || req.headers['content-type'] || 'audio/webm');
    let r = await transcribe(req.body, mime, { language: hint });
    // Hindi heard as Urdu comes back in Urdu script; re-run it as Hindi to get Devanagari the caller can read.
    if (/urdu/i.test(r.language || '') && hint !== 'hi') { const again = await transcribe(req.body, mime, { language: 'hi' }); again.ms += r.ms; r = again; r.language = 'hindi'; }
    const text = r.text.replace(/\s+/g, ' ').trim();
    const lang = whisperLang(r.language) || hint;
    const voicedMs = Number(req.query.voicedMs || 0) || null; // how much real voice the phone heard in this clip
    const bare = text.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim();
    const reason =
      text.length < 2 ? 'empty'
      : /thanks for watching|please subscribe|subt[ií]tulos|amara\.org|subtitles by/i.test(text) ? 'hallucination'
      : (r.noSpeech ?? 0) > 0.6 ? 'no speech'
      : (r.avgLogprob ?? 0) < -1.0 ? 'low confidence'
      : voicedMs !== null && voicedMs < 300 ? 'almost no voice in clip'
      : /^(gracias|muchas gracias|thank you|thanks|so|you|bye|hmm+|mm+|uh+|um+|okay bye)$/.test(bare) && (voicedMs === null || voicedMs < 900) ? 'likely noise (Whisper hallucination)'
      : !lang ? `unsupported language (${r.language})`
      : null;
    if (reason) { console.log(`[stt] dropped "${text.slice(0, 40)}" — ${reason}`); return res.json({ text: '', dropped: reason }); }
    E.callerText(call, text, { sttMs: r.ms, detected: lang });
    res.json({ text, lang, ms: r.ms });
  } catch (e) { console.warn('[stt]', e.message); res.json({ text: '', error: e.message }); }
});
app.get('/api/protocols', (_req, res) => res.json(CARDS));
app.get('/api/incident/:id/eido', (req, res) => {
  const j = E.eido(req.params.id);
  if (!j) return res.status(404).json({ error: 'not found' });
  res.setHeader('Content-Disposition', `attachment; filename="beacon-event-${req.params.id}.eido.json"`);
  res.json(j);
});

function lanIp() {
  for (const ifs of Object.values(os.networkInterfaces())) for (const i of ifs || []) if (i.family === 'IPv4' && !i.internal) return i.address;
  return 'localhost';
}
export function callerUrl() { return `${S.publicUrl || `http://${lanIp()}:${PORT}`}/caller/`; }
app.get('/api/caller-url', (_req, res) => res.json({ url: callerUrl(), secure: !!S.publicUrl }));
app.get('/api/qr.svg', async (_req, res) => {
  res.type('image/svg+xml').send(await QRCode.toString(callerUrl(), { type: 'svg', margin: 1, color: { dark: '#0b0f14', light: '#ffffff' } }));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const dispatchers = new Set();
const callerSockets = new Map(); // callId -> ws

const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
const toDispatchers = (o) => { const s = JSON.stringify(o); for (const ws of dispatchers) if (ws.readyState === 1) ws.send(s); };

bus.on('toCaller', (callId, msg) => { const ws = callerSockets.get(callId); if (ws) send(ws, msg); });
bus.on('toast', (t) => toDispatchers({ t: 'toast', ...t }));
bus.on('route', (unitId, r) => toDispatchers({ t: 'route', unitId, route: r }));
bus.on('routesReset', () => toDispatchers({ t: 'routesReset' }));

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const role = url.searchParams.get('role');
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  if (role === 'dispatcher') {
    dispatchers.add(ws);
    send(ws, { t: 'state', ...E.snapshot() });
    for (const [unitId, r] of S.routes) send(ws, { t: 'route', unitId, route: r });
    ws.on('close', () => dispatchers.delete(ws));
    ws.on('message', (m) => { try { handleDispatcher(ws, JSON.parse(m)); } catch (e) { console.error('[dispatcher msg]', e); } });
  } else {
    ws.callId = null;
    ws.on('message', (m) => { try { handleCaller(ws, JSON.parse(m)); } catch (e) { console.error('[caller msg]', e); } });
    ws.on('close', () => {
      const id = ws.callId;
      if (!id || callerSockets.get(id) !== ws) return;
      callerSockets.delete(id);
      setTimeout(() => { if (!callerSockets.has(id)) E.endCall(id, 'caller'); }, 15000);
    });
  }
});

function handleCaller(ws, m) {
  if (m.t === 'start') {
    const call = E.newCall({ lang: m.lang || 'en', mode: m.mode || 'voice', loc: m.loc ? { ...m.loc, source: m.loc.source || 'gps' } : null, access: m.access || {}, device: typeof m.device === 'string' ? m.device.slice(0, 64) : null });
    ws.callId = call.id;
    callerSockets.set(call.id, ws);
    send(ws, { t: 'call.created', callId: call.id, num: call.num });
    return;
  }
  if (m.t === 'resume') {
    const call = S.calls.get(m.callId);
    if (call && !['ended', 'abandoned'].includes(call.state)) {
      ws.callId = call.id; callerSockets.set(call.id, ws);
      send(ws, { t: 'call.resumed', callId: call.id, state: call.state });
    } else send(ws, { t: 'call.end', by: 'expired' });
    return;
  }
  const call = ws.callId && S.calls.get(ws.callId);
  if (!call) return;
  switch (m.t) {
    case 'loc': E.updateLoc(call, { lat: m.lat, lng: m.lng, acc: m.acc, source: m.source || 'gps' }); break;
    case 'say': E.callerText(call, m.text, { sttMs: m.sttMs || 0 }); break;
    case 'interim': E.callerInterim(call, m.text); break;
    case 'tap': {
      const en = E.tapReport(call, m);
      E.callerText(call, m.label || en, { pre: en, tap: true });
      break;
    }
    case 'tts': E.callerTtsReport(call.id, m.ms, m.lineId); break;
    case 'help': E.callerHelp(call.id); break;
    case 'end': E.endCall(call.id, 'caller'); break;
    case 'prefs': call.access = { ...call.access, ...m.access }; break;
  }
}

function handleDispatcher(ws, m) {
  switch (m.t) {
    case 'answer': E.answerCall(m.callId); break;
    case 'say': E.dispatcherSay(m.callId, m.text, { sttMs: m.sttMs || 0 }); break;
    case 'protocol': E.protocolSend(m.callId, m.cardId, m.step); break;
    case 'end': E.endCall(m.callId, 'dispatcher'); break;
    case 'mode': E.setMode(m.mode); break;
    case 'dispatch': E.dispatchUnits(m.incId, m.unitIds); break;
    case 'close': E.closeIncident(m.incId); break;
    case 'broadcast': E.broadcast(m.text, m.incId || 'all').then((r) => send(ws, { t: 'toast', kind: 'ok', text: `Broadcast delivered to ${r.delivered} callers in ${r.langs.length} languages` })); break;
    case 'hazard': E.hazardAction(m.incId, m.hid, m.action); break;
    case 'merge': E.mergeIncidents(m.src, m.dst); break;
    case 'split': E.splitCall(m.callId); break;
    case 'interp': E.interpBridge(m.callId); break;
    case 'verify': E.verifyLoc(m.callId); break;
    case 'setloc': E.setLoc(m.callId, m.lat, m.lng); break;
    case 'sim': m.on ? startSim(m.scenario) : stopSim(); break;
    case 'scale': S.scale = Math.max(1, Math.min(30, m.scale)); E.touch(); break;
    case 'reset': stopSim(); E.resetAll(); break;
    case 'publicUrl': S.publicUrl = m.url; E.touch(); break;
  }
}

// heartbeat + simulation loops
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } }, 20000);
setInterval(() => E.tickUnits(), 500);
setInterval(() => E.notifyEta(), 3000);
setInterval(() => E.checkSurge(), 2000);
setInterval(() => { if (S.dirty && dispatchers.size) { S.dirty = false; toDispatchers({ t: 'state', ...E.snapshot() }); } else if (S.dirty) S.dirty = false; }, 180);
// wait-time based priority drift + clock
setInterval(() => E.touch(), 1000);

export function start(port = PORT) {
  initModels();
  return new Promise((resolve) => server.listen(port, () => {
    console.log(`\n  Beacon is running\n  Dispatcher console : http://localhost:${port}/dispatch/\n  Caller app (local) : http://localhost:${port}/caller/\n  AI engine          : ${E.snapshot().engine.provider}\n`);
    resolve(server);
  }));
}
export function setPublicUrl(url) { S.publicUrl = url; E.touch(); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) start();
