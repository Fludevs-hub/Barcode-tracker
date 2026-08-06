'use strict';

// ponytail: in-memory fixed-window limiter. Single-process only — swap the Map
// for a shared store (Redis) if you ever run more than one instance.
const buckets = new Map();

function rateLimit({ windowMs, max, key }) {
  return (req, res, next) => {
    const id = String(key(req));
    const now = Date.now();
    let b = buckets.get(id);
    if (!b || now > b.reset) {
      b = { count: 0, reset: now + windowMs };
      buckets.set(id, b);
    }
    b.count += 1;
    if (b.count > max) {
      const retry = Math.ceil((b.reset - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ error: `Too many attempts. Try again in ${retry}s.` });
    }
    next();
  };
}

// Drop expired buckets so the Map can't grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k);
}, 60_000).unref();

const ipKey = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

module.exports = { rateLimit, ipKey };

if (require.main === module) {
  // self-check: max 3 in the window → 3 pass, next 2 blocked.
  const mw = rateLimit({ windowMs: 1000, max: 3, key: () => 'x' });
  let passed = 0;
  let blocked = 0;
  const res = { setHeader() {}, status() { return { json() { blocked += 1; } }; } };
  for (let i = 0; i < 5; i += 1) mw({}, res, () => { passed += 1; });
  console.assert(passed === 3 && blocked === 2, `expected 3 pass / 2 block, got ${passed}/${blocked}`);
  console.log('rateLimit self-check ok');
}
