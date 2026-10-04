// Records the setup walkthrough to MP4, one exact frame at a time.
//
//   node tools/record-video.js --chapter 0 --out ../videos/project-july-setup.mp4
//   node tools/record-video.js --chapter 3 --out ../videos/project-july-sw2.mp4
//
// Needs the local preview server (it loads http://localhost:8123/setup/player.html?record), Chrome,
// and ffmpeg. The player's ?record mode exposes window.__rec, which advances its clock by exactly one
// frame per call, so the video is smooth at 30 fps however slowly the frames render. CSS animations
// run on the browser's own clock, so their playback rate is scaled to match the capture speed.

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? a.concat([[v.slice(2), all[i + 1]]]) : a), []));
const CHAPTER = Number(args.chapter || 0);
const OUT = path.resolve(args.out || `../videos/walkthrough-${CHAPTER}.mp4`);
const URL_ = args.url || 'http://localhost:8123/setup/player.html?record';
const THEME = args.theme || 'dark';
const W = 800, H = 450, SCALE = 1.6;       // laid out small so text reads on a phone; captured at 1280×720
const FPS = 30, FRAME_MS = 1000 / FPS;
const TAIL_S = 1.2, END_S = 2.6;           // hold on the last frame, then the end card
const CHROME = args.chrome || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333 + CHAPTER;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pj-rec-'));
  const frames = path.join(work, 'frames');
  fs.mkdirSync(frames);
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(work, 'profile')}`,
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--mute-audio', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); }
      catch { await sleep(200); }
    }
    if (!target) throw new Error('Chrome did not start');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map(), waiters = [];
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
      else if (m.method) waiters.filter(w => w.method === m.method).forEach(w => { w.res(m.params); waiters.splice(waiters.indexOf(w), 1); });
    };
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
    const once = method => new Promise(res => waiters.push({ method, res }));
    const js = async (expression, awaitPromise = false) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
      return r.result.value;
    };

    await send('Page.enable');
    await send('Animation.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: THEME }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: URL_ });
    await loaded;
    await js(`document.fonts.ready.then(() => new Promise(r => setTimeout(r, 1500)))`, true);
    if (!(await js('!!window.__rec'))) throw new Error('Player is not in record mode (no window.__rec)');

    await js(`__rec.play(${CHAPTER})`);
    let n = 0, rate = 1, t0 = Date.now(), endAt = null, endShown = false, tailFrames = 0;
    const shot = async () => {
      const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92, fromSurface: true });
      fs.writeFileSync(path.join(frames, String(++n).padStart(5, '0') + '.jpg'), Buffer.from(data, 'base64'));
    };
    for (;;) {
      const f0 = Date.now();
      await js(`__rec.frame(${FRAME_MS})`);
      await shot();
      if (endAt === null && await js('__rec.finished()')) endAt = n;
      if (endAt !== null) {
        tailFrames++;
        if (!endShown && tailFrames >= TAIL_S * FPS) { await js('__rec.showEnd()'); endShown = true; }
        if (tailFrames >= (TAIL_S + END_S) * FPS) break;
      }
      if (n > FPS * 150) throw new Error('Walkthrough did not finish');
      // keep CSS animations in step with the virtual clock: one frame of wall time ≈ one frame of video
      const took = Date.now() - f0;
      const next = Math.max(0.02, Math.min(1, FRAME_MS / Math.max(1, took)));
      if (Math.abs(next - rate) / rate > 0.15) { rate = next; await send('Animation.setPlaybackRate', { playbackRate: rate }); }
      if (n % FPS === 0) process.stdout.write(`\r${(n / FPS).toFixed(0)} s recorded (${((Date.now() - t0) / 1000).toFixed(0)} s)   `);
    }
    process.stdout.write(`\n${n} frames\n`);
    ws.close();

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'),
      '-vf', 'scale=1280:720:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
    console.log(`Wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB, ${(n / FPS).toFixed(1)} s)`);
  } finally {
    chrome.kill();
    await sleep(500);
    try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
  }
}

main().catch(e => { console.error(e); process.exit(1); });
