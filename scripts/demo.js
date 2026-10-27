// One command demo: starts Beacon, then opens a free HTTPS tunnel (Cloudflare) so a phone
// can reach it with microphone + GPS permissions. Requires: brew install cloudflared
import { spawn, spawnSync } from 'node:child_process';
import { start, setPublicUrl } from '../server/index.js';

const port = Number(process.env.PORT || 3000);
await start(port);

const has = spawnSync('which', ['cloudflared']).status === 0;
if (!has) {
  console.log('  ⚠ cloudflared not found. Phones need HTTPS for mic + GPS.\n    Install once:  brew install cloudflared   then re-run: npm run demo\n    (The caller app still works on this computer at http://localhost:' + port + '/caller/)\n');
} else {
  const p = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const onData = (d) => {
    const m = d.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m) {
      setPublicUrl(m[0]);
      console.log(`\n  📱 Phone URL (HTTPS): ${m[0]}/caller/\n     Or click "📱 Phone" in the console for a QR code.\n`);
    }
  };
  p.stdout.on('data', onData); p.stderr.on('data', onData);
  process.on('exit', () => p.kill());
  process.on('SIGINT', () => { p.kill(); process.exit(0); });
}
