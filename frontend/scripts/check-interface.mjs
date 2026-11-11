// Local browser check: node frontend/scripts/check-interface.mjs
// Uses an isolated Chrome profile; never touches the user's browser session.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const output = path.resolve('.taste-skill');
const authenticated = process.argv.includes('--admin');
let sessionSetup = "localStorage.setItem('acj-camp-location-prompt:guest', 'handled');";
if (authenticated) {
  const require = createRequire(path.resolve('backend/package.json'));
  const settings = require('dotenv').parse(await readFile('backend/.env'));
  const { Pool } = require('pg');
  const pool = new Pool({ host: settings.DB_HOST, port: settings.DB_PORT, database: settings.DB_NAME, user: settings.DB_USER, password: settings.DB_PASSWORD });
  try {
    const user = (await pool.query("SELECT id FROM usuarios WHERE rol = 'admin' AND estado = 'activo' LIMIT 1")).rows[0];
    if (!user) throw new Error('No active administrator for read-only UI checks');
    const token = require('jsonwebtoken').sign({ id: user.id }, settings.JWT_SECRET || 'acj-camp-dev-secret', { expiresIn: '5m' });
    sessionSetup += `localStorage.setItem('token', ${JSON.stringify(token)}); localStorage.setItem('acj-camp-location-prompt:${user.id}', 'handled');`;
  } finally { await pool.end(); }
}
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(output, 'qa-chrome-'));
const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((file) => file && existsSync(file));
if (!chrome) throw new Error('Chrome or Edge is required for the browser check');
const child = spawn(chrome, ['--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await pause(100); }
  }
  if (!port) throw new Error('Browser did not start');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let next = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return;
    const action = pending.get(message.id);
    if (!action) return;
    pending.delete(message.id);
    message.error ? action.reject(new Error(message.error.message)) : action.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++next;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: sessionSetup });
  if (process.argv.includes('--hero')) {
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.__galleryRefresh = [];
      window.__galleryRequests = 0;
      const originalInterval = window.setInterval;
      window.setInterval = function(callback, ms, ...args) { if (ms === 60000) window.__galleryRefresh.push(callback); return originalInterval(callback, ms, ...args); };
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...args) { if (String(url).includes('/lugares/galeria')) window.__galleryRequests++; return originalOpen.call(this, method, url, ...args); };
    ` });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://localhost:3000' });
    for (let i = 0; i < 80; i++) {
      await pause(150);
      if (await evaluate("!!document.querySelector('.camp-hero-gallery__current') && window.__galleryRequests > 0")) break;
    }
    const current = () => evaluate("document.querySelector('.camp-hero-gallery__current').getAttribute('src')");
    const initial = await current();
    await pause(8700);
    const rotates = (await current()) !== initial;
    const noControls = await evaluate("!document.querySelector('.camp-hero-gallery-controls')");
    const requestsBefore = await evaluate('window.__galleryRequests');
    await evaluate('window.__galleryRefresh.at(-1)()');
    await pause(300);
    const refreshes = (await evaluate('window.__galleryRequests')) > requestsBefore;
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(output, 'portada-rotativa-1440.png'), Buffer.from(shot.data, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: false });
    await pause(300);
    const mobileFits = await evaluate("document.documentElement.scrollWidth <= innerWidth");
    const mobileShot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(output, 'portada-rotativa-390.png'), Buffer.from(mobileShot.data, 'base64'));
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await pause(300);
    const reducedPhoto = await current();
    await pause(8500);
    const noAutoplayForReduced = (await current()) === reducedPhoto;
    const checks = { rotates, noControls, refreshes, mobileFits, noAutoplayForReduced };
    console.log(JSON.stringify(checks));
    if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
  } else if (process.argv.includes('--satellite')) {
    const results = [];
    for (const width of [1440, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await send('Page.navigate', { url: 'http://localhost:3000/mapa' });
      for (let i = 0; i < 80; i++) {
        await pause(150);
        if (await evaluate("!!document.querySelector('button[aria-label=\"Capas del mapa\"]')")) break;
      }
      await evaluate("document.querySelector('button[aria-label=\"Capas del mapa\"]').click()");
      await pause(100);
      await evaluate("document.querySelector('input[name=\"capa\"][value=\"satelite\"]').click()");
      for (let i = 0; i < 80; i++) {
        await pause(150);
        if (await evaluate("[...document.querySelectorAll('.leaflet-tile')].some(i => i.src.includes('s2cloudless') && i.complete && i.naturalWidth > 0)")) break;
      }
      const checks = await evaluate(`(() => ({
        selected: document.querySelector('input[value="satelite"]').checked,
        tilesLoaded: [...document.querySelectorAll('.leaflet-tile')].some(i => i.src.includes('s2cloudless') && i.complete && i.naturalWidth > 0),
        attribution: document.querySelector('.leaflet-control-attribution')?.textContent.includes('CC BY-NC-SA'),
        overflow: document.documentElement.scrollWidth > innerWidth + 1
      }))()`);
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(output, `satelite-${width}.png`), Buffer.from(screenshot.data, 'base64'));
      await evaluate("document.querySelector('input[name=\"capa\"][value=\"osm\"]').click()");
      await pause(200);
      const returnsToOsm = await evaluate("document.querySelector('input[value=\"osm\"]').checked && !document.querySelector('.leaflet-control-attribution')?.textContent.includes('CC BY-NC-SA')");
      results.push({ width, ...checks, returnsToOsm });
    }
    console.log(JSON.stringify(results, null, 2));
    if (results.some((r) => !r.selected || !r.tilesLoaded || !r.attribution || r.overflow || !r.returnsToOsm)) process.exitCode = 1;
  } else if (process.argv.includes('--photos')) {
    const places = await (await fetch('http://localhost:5000/api/lugares')).json();
    const reviews = await (await fetch('http://localhost:5000/api/resenas')).json();
    const reviewedPlace = reviews.resenas.find((r) => Array.isArray(r.fotos) && r.fotos.length && places.lugares.some((p) => p.id === r.lugar_id));
    const place = places.lugares.find((p) => p.id === reviewedPlace?.lugar_id) || places.lugares.find((p) => Array.isArray(p.fotos) && p.fotos.length);
    if (!place) throw new Error('No place with photos is available for this check');
    const expectedPhotos = [...new Set([...(place.fotos || []), ...reviews.resenas.filter((r) => r.lugar_id === place.id).flatMap((r) => r.fotos || [])])];
    const results = [];
    for (const width of [1440, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await send('Page.navigate', { url: `http://localhost:3000/lugar/${place.id}` });
      for (let i = 0; i < 80; i++) {
        await pause(150);
        if (await evaluate("!!document.querySelector('button[aria-label^=\"Ampliar foto\"]')")) break;
      }
      const open = () => evaluate("(() => { const b = document.querySelector('button[aria-label^=\"Ampliar foto\"]'); b.focus(); b.click(); })()");
      const galleryPhotos = await evaluate("[...document.querySelectorAll('section[aria-label=\"Fotos del campamento\"] img')].map(i => i.getAttribute('src'))");
      const galleryCombined = galleryPhotos.length === expectedPhotos.length && expectedPhotos.every((src) => galleryPhotos.includes(src));
      await open();
      await pause(300);
      const opened = await evaluate("!!document.querySelector('.camp-image-viewer:modal') && document.body.style.overflow === 'hidden' && document.activeElement?.getAttribute('aria-label') === 'Cerrar imagen'");
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(output, `visor-${width}.png`), Buffer.from(screenshot.data, 'base64'));
      await evaluate("document.querySelector('button[aria-label=\"Cerrar imagen\"]').click()");
      await pause(100);
      const closedByButton = await evaluate("!document.querySelector('.camp-image-viewer') && document.body.style.overflow !== 'hidden' && document.activeElement?.getAttribute('aria-label')?.startsWith('Ampliar foto')");
      await open();
      await pause(100);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await pause(100);
      const closedByEscape = await evaluate("!document.querySelector('.camp-image-viewer')");
      await open();
      await pause(100);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 2, y: 2, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 2, y: 2, button: 'left', clickCount: 1 });
      await pause(100);
      const closedByBackdrop = await evaluate("!document.querySelector('.camp-image-viewer')");
      results.push({ width, galleryCombined, photos: galleryPhotos.length, opened, closedByButton, closedByEscape, closedByBackdrop });
    }
    console.log(JSON.stringify(results, null, 2));
    if (results.some((r) => !r.galleryCombined || !r.opened || !r.closedByButton || !r.closedByEscape || !r.closedByBackdrop)) process.exitCode = 1;
  } else {
  const results = [];
  for (const width of [1440, 768, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const route of authenticated ? ['/', '/admin', '/reservas', '/mi-perfil', '/mis-lugares', '/mapa'] : ['/', '/buscar', '/login', '/mapa']) {
      await send('Page.navigate', { url: `http://localhost:3000${route}` });
      for (let i = 0; i < 80; i++) {
        await pause(150);
        if (await evaluate("document.readyState === 'complete' && !!document.querySelector('.camp-nav-shell') && !document.querySelector('.camp-loading')")) break;
      }
      await pause(400);
      const checks = await evaluate(`(() => {
        const input = document.querySelector('.camp-map-search input');
        const box = document.querySelector('.camp-map-search');
        const ir = input?.getBoundingClientRect(), br = box?.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          title: document.querySelector('h1')?.textContent,
          active: document.querySelector('.camp-nav-link[aria-current="page"]')?.textContent,
          searchContained: !ir || (ir.left >= br.left && ir.right <= br.right && ir.top >= br.top && ir.bottom <= br.bottom),
          imagesBroken: [...document.querySelectorAll('main img')].filter(i => i.complete && !i.naturalWidth).length
        };
      })()`);
      let menuWorks = true;
      if (width <= 1100) {
        await evaluate("document.querySelector('.camp-nav-toggle').click()");
        await pause(100);
        menuWorks = await evaluate("document.querySelector('.camp-nav-toggle').getAttribute('aria-expanded') === 'true' && getComputedStyle(document.querySelector('.camp-nav-links')).display !== 'none'");
        await evaluate("document.querySelector('.camp-nav-links').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
        await pause(100);
        menuWorks = menuWorks && await evaluate("document.querySelector('.camp-nav-toggle').getAttribute('aria-expanded') === 'false'");
      }
      results.push({ width, route, menuWorks, ...checks });
      if (width === 1440 || width === 390) {
        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        await writeFile(path.join(output, `${authenticated ? 'admin-' : ''}${route === '/' ? 'inicio' : route.slice(1)}-${width}.png`), Buffer.from(screenshot.data, 'base64'));
      }
    }
  }
  await send('Page.navigate', { url: 'http://localhost:3000' });
  for (let i = 0; i < 80; i++) {
    await pause(150);
    if (await evaluate("!!document.querySelector('#home-search')")) break;
  }
  await evaluate(`(() => {
    const input = document.querySelector('#home-search');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '7 LAGUNAS');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await pause(100);
  await evaluate("document.querySelector('.camp-home-search').requestSubmit()");
  for (let i = 0; i < 80; i++) {
    await pause(150);
    if (await evaluate("location.pathname === '/buscar' && !!document.querySelector('.camp-explore-toolbar')")) break;
  }
  const searchWorks = await evaluate("new URLSearchParams(location.search).get('busqueda') === '7 LAGUNAS' && document.querySelector('.camp-explore-toolbar input')?.value === '7 LAGUNAS' && [...document.querySelectorAll('.camp-card h2')].every(h => h.textContent.toUpperCase().includes('7 LAGUNAS'))");
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await pause(1500);
  const reducedMotion = await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches && document.getAnimations().every(a => !a.effect?.target?.closest('.camp-app'))");
  const report = { results, reducedMotion, searchWorks };
  await writeFile(path.join(output, `${authenticated ? 'admin-' : ''}interface-report.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!reducedMotion || !searchWorks || results.some((result) => result.overflow || !result.searchContained || !result.title || !result.menuWorks)) process.exitCode = 1;
  }
} finally {
  socket?.close();
  child.kill();
}
