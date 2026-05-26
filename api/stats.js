import { query, getIp, cors } from './_db.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { action } = req.query;
    const ip = getIp(req);

    // Ensure visitors table exists
    await query(`CREATE TABLE IF NOT EXISTS visitors (
      ip TEXT PRIMARY KEY,
      last_seen INTEGER NOT NULL DEFAULT 0,
      first_seen INTEGER NOT NULL DEFAULT 0,
      is_registered INTEGER NOT NULL DEFAULT 0
    )`);

    // POST /api/stats?action=ping — heartbeat from client
    if (req.method === 'POST' && action === 'ping') {
      let body = {};
      try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch {}
      const now = Math.floor(Date.now() / 1000);
      const isReg = body.registered ? 1 : 0;
      await query(
        `INSERT INTO visitors (ip, last_seen, first_seen, is_registered) VALUES (?, ?, ?, ?)
         ON CONFLICT(ip) DO UPDATE SET last_seen = ?, is_registered = ?`,
        [ip, now, now, isReg, now, isReg]
      );
      return res.json({ ok: true });
    }

    // GET /api/stats — return counts (admin only, but we check client-side)
    if (req.method === 'GET') {
      const now = Math.floor(Date.now() / 1000);
      const threshold15m = now - 900;   // active in last 15 min
      const threshold24h = now - 86400; // active in last 24h

      const activeRows = await query('SELECT COUNT(*) as cnt, SUM(CASE WHEN is_registered = 0 THEN 1 ELSE 0 END) as guests, SUM(CASE WHEN is_registered = 1 THEN 1 ELSE 0 END) as registered FROM visitors WHERE last_seen >= ?', [threshold15m]);
      const dailyRows = await query('SELECT COUNT(*) as cnt, SUM(CASE WHEN is_registered = 0 THEN 1 ELSE 0 END) as guests, SUM(CASE WHEN is_registered = 1 THEN 1 ELSE 0 END) as registered FROM visitors WHERE last_seen >= ?', [threshold24h]);
      const totalRows = await query('SELECT COUNT(*) as cnt FROM visitors');

      const active = activeRows[0] || { cnt: 0, guests: 0, registered: 0 };
      const daily = dailyRows[0] || { cnt: 0, guests: 0, registered: 0 };
      const total = totalRows[0] || { cnt: 0 };

      return res.json({
        active: { total: Number(active.cnt || 0), dark_souls: Number(active.guests || 0), sinners: Number(active.registered || 0) },
        daily:  { total: Number(daily.cnt || 0), dark_souls: Number(daily.guests || 0), sinners: Number(daily.registered || 0) },
        all_time: Number(total.cnt || 0)
      });
    }

    res.status(405).end();
  } catch (err) {
    console.error('stats error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: String(err?.message || err) });
  }
}
