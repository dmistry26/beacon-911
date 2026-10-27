// dev check: each fail-safe rule escalates (or not) as expected, during a simulated surge
import WebSocket from 'ws';
const URL = 'ws://localhost:3111/ws';
const d = new WebSocket(`${URL}?role=dispatcher`); let last;
d.on('message', (m) => { const j = JSON.parse(m); if (j.t === 'state') last = j; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(400); d.send(JSON.stringify({ t: 'sim', on: true })); await sleep(14000);

function caller(name, lang, lines, { device = Math.random().toString(36), after = null } = {}) {
  return new Promise((resolve) => {
    const c = new WebSocket(`${URL}?role=caller`); let i = 0, id;
    c.on('open', () => c.send(JSON.stringify({ t: 'start', device, lang, mode: 'text', loc: { lat: 37.0838, lng: -122.0812, acc: 9 } })));
    c.on('message', (m) => {
      const j = JSON.parse(m);
      if (j.t === 'call.created') id = j.callId;
      if (j.t === 'call.say' && j.who === 'ai' && /what is happening|is anyone hurt/i.test(j.en) && i < lines.length) setTimeout(() => c.send(JSON.stringify({ t: 'say', text: lines[i++], sttMs: 200 })), 600);
      if (j.t === 'call.info' && j.state === 'ai_resolved' && after) setTimeout(() => c.send(JSON.stringify({ t: 'say', text: after, sttMs: 200 })), 800);
    });
    setTimeout(() => { const call = last.calls.find((x) => x.id === id); console.log(name.padEnd(34), (call?.state || '?').toUpperCase().padEnd(12), call?.flags?.escalateReason || '', '| lines:', call?.lines.map((l) => l.who[0] + ':' + l.en.slice(0, 28)).join(' / ')); resolve(); }, 16000);
  });
}
await caller('A clear "no" (duplicate fire)', 'es', ['Hay un incendio grande en una casa al otro lado de la calle.', 'No, todos salimos.']);
await caller('B "I don\'t know"', 'es', ['Hay un incendio grande en una casa al otro lado de la calle.', 'No sé.']);
await caller('C "Yes"', 'es', ['Hay un incendio grande en una casa al otro lado de la calle.', 'Sí.']);
await caller('D spoke again after closing', 'es', ['Hay un incendio grande en una casa al otro lado de la calle.', 'No, todos salimos.'], { after: 'Espere, ahora el humo entra a mi casa.' });
await caller('E first call from a device', 'es', ['Hay un incendio grande en una casa al otro lado de la calle.', 'No, todos salimos.'], { device: 'same-phone' });
await caller('E repeat call from same device', 'es', ['Hay un incendio grande en una casa al otro lado de la calle.'], { device: 'same-phone' });
await caller('F Mixteco/Triqui caller', 'mix', []);
const st = {}; last.calls.filter((c) => c.source === 'sim').forEach((c) => (st[c.state] = (st[c.state] || 0) + 1)); console.log('simulated calls:', st);
process.exit(0);
