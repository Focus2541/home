/* Focus Home — service worker
 * เปลี่ยน VERSION ทุกครั้งที่แก้ไฟล์ใด ๆ ใน repo นี้ → แอปจะขึ้นแถบ "มีอัปเดต"
 * แคชเฉพาะไฟล์ของหน้านี้ ไม่ยุ่งกับแอปอื่นบน focus2541.github.io
 */
const VERSION = '1.0.1';
const PREFIX = 'focus-home-';            // ลบเฉพาะแคชที่ขึ้นต้นด้วยชื่อนี้เท่านั้น
const CACHE = PREFIX + VERSION;

const REQUIRED = ['./', './index.html', './manifest.json', './icon.svg'];
const OPTIONAL = ['./icon-192.png', './icon-512.png'];

const SCOPE = self.registration.scope;
const OWN = new Set([...REQUIRED, ...OPTIONAL].map(p => new URL(p, SCOPE).href));

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(REQUIRED.map(async p => {
      const r = await fetch(new Request(p, { cache: 'reload' }));
      if (!r.ok) throw new Error('cache fail ' + p);
      await c.put(new URL(p, SCOPE).href, r);
    }));
    await Promise.all(OPTIONAL.map(async p => {
      try {
        const r = await fetch(new Request(p, { cache: 'reload' }));
        if (r.ok) await c.put(new URL(p, SCOPE).href, r);
      } catch (_) {}
    }));
  })());
  // ไม่ skipWaiting เอง — รอผู้ใช้กด "โหลดใหม่"
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  const t = e.data && e.data.type;
  if (t === 'SKIP_WAITING') self.skipWaiting();
  if (t === 'GET_VERSION' && e.source) e.source.postMessage({ type: 'VERSION', version: VERSION });
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // API ภายนอก: ปล่อยผ่าน
  const clean = url.origin + url.pathname;
  if (!OWN.has(clean)) return;                               // แอปอื่น (/tripbudget/ ฯลฯ): ไม่แตะเลย
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(clean);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) c.put(clean, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') {
        const idx = await c.match(new URL('./', SCOPE).href);
        if (idx) return idx;
      }
      throw err;
    }
  })());
});
