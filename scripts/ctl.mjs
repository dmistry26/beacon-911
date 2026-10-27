// tiny dev helper: node scripts/ctl.mjs <port> <json message>
import WebSocket from 'ws';
const [port, ...rest] = process.argv.slice(2);
const ws = new WebSocket(`ws://localhost:${port}/ws?role=dispatcher`);
ws.on('open', () => { for (const m of rest) ws.send(m); setTimeout(() => process.exit(0), 300); });
