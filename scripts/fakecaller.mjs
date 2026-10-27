// dev helper: simulate a phone caller. node scripts/fakecaller.mjs <port> <lang> "<text>"
import WebSocket from 'ws';
const [port, lang, text] = process.argv.slice(2);
const ws = new WebSocket(`ws://localhost:${port}/ws?role=caller`);
ws.on('open', () => ws.send(JSON.stringify({ t: 'start', lang, mode: 'text', loc: { lat: 37.0838, lng: -122.0812, acc: 9 } })));
ws.on('message', (m) => {
  const j = JSON.parse(m);
  console.log('<-', JSON.stringify(j).slice(0, 220));
  if (j.t === 'call.answered') setTimeout(() => ws.send(JSON.stringify({ t: 'say', text, sttMs: 310 })), 500);
});
setTimeout(() => process.exit(0), 9000);
