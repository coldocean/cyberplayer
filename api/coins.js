import { query, getIp, cors } from './_db.js';

const NOW = () => Math.floor(Date.now() / 1000);
const DAY = 86400;

function isWeekend() {
  const d = new Date();
  const day = d.getUTCDay(); // 0=Sun,6=Sat
  const hour = d.getUTCHours();
  // Fri 18:00 UTC → Sun 23:59 UTC
  if (day === 6 || day === 0) return true;
  if (day === 5 && hour >= 18) return true;
  return false;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = getIp(req);
  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch {}

  const { action } = req.query;
  const now = NOW();
  const weekend = isWeekend();

  // GET /api/coins — get balance + trigger daily top-up
  if (req.method === 'GET') {
    // Upsert row
    await query(`INSERT INTO coins (ip, count, last_daily) VALUES (?, 0, 0) ON CONFLICT(ip) DO NOTHING`, [ip]);
    let row = (await query('SELECT * FROM coins WHERE ip = ?', [ip]))[0];
    let count = Number(row?.count || 0);
    let last_daily = Number(row?.last_daily || 0);
    let added = 0;

    // Daily top-up: give coins if last_daily was >24h ago
    if (now - last_daily >= DAY) {
      added = weekend ? 20 : 10;
      count += added;
      await query('UPDATE coins SET count = ?, last_daily = ? WHERE ip = ?', [count, now, ip]);
    }

    return res.json({ coins: count, added, is_weekend: weekend, next_daily: last_daily + DAY });
  }

  // POST /api/coins { action: 'spend', amount }
  if (req.method === 'POST' && action === 'spend') {
    const amount = Number(body.amount || 1);
    await query(`INSERT INTO coins (ip, count, last_daily) VALUES (?, 0, 0) ON CONFLICT(ip) DO NOTHING`, [ip]);
    const row = (await query('SELECT count FROM coins WHERE ip = ?', [ip]))[0];
    const count = Number(row?.count || 0);
    if (count < amount) return res.json({ ok: false, coins: count, error: 'insufficient' });
    const newCount = count - amount;
    await query('UPDATE coins SET count = ? WHERE ip = ?', [newCount, ip]);
    return res.json({ ok: true, coins: newCount });
  }

  // POST /api/coins { action: 'add', amount }
  if (req.method === 'POST' && action === 'add') {
    const amount = Number(body.amount || 0);
    await query(`INSERT INTO coins (ip, count, last_daily) VALUES (?, 0, 0) ON CONFLICT(ip) DO NOTHING`, [ip]);
    await query('UPDATE coins SET count = count + ? WHERE ip = ?', [amount, ip]);
    const row = (await query('SELECT count FROM coins WHERE ip = ?', [ip]))[0];
    return res.json({ ok: true, coins: Number(row?.count || 0) });
  }

  res.status(405).end();
}
