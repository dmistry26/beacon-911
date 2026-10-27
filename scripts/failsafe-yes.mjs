// dev check: a caller who answers "Sí" to "is anyone hurt or trapped?" must go to a human
import WebSocket from 'ws';
const URL = 'ws://localhost:3111/ws';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const d = new WebSocket(`${URL}?role=dispatcher`); let last;
d.on('message', (m) => { const j = JSON.parse(m); if (j.t === 'state') last = j; });
await sleep(400); d.send(JSON.stringify({ t: 'sim', on: true })); await sleep(14000);
const c = new WebSocket(`${URL}?role=caller`); let id, i = 0;
const lines = ['Hay un incendio grande en una casa al otro lado de la calle.', 'Sí.'];
c.on('open', () => c.send(JSON.stringify({ t: 'start', device: 'yes-test', lang: 'es', mode: 'text', loc: { lat: 37.0838, lng: -122.0812, acc: 9 } })));
c.on('message', (m) => {
  const j = JSON.parse(m);
  if (j.t === 'call.created') id = j.callId;
  if (j.t === 'call.say') console.log(`  +${((Date.now() - t0) / 1000).toFixed(1)}s phone hears (${j.who}):`, j.en);
  if (j.t === 'call.say' && j.who === 'ai' && /what is happening|is anyone hurt/i.test(j.en) && i < lines.length) {
    const text = lines[i++];
    setTimeout(() => { console.log(`  +${((Date.now() - t0) / 1000).toFixed(1)}s caller says:`, text); c.send(JSON.stringify({ t: 'say', text, sttMs: 200 })); }, 600);
  }
});
const t0 = Date.now();
await sleep(20000);
const call = last.calls.find((x) => x.id === id);
console.log('STATE:', call?.state, '|', call?.flags?.escalateReason || '');
process.exit(0);
