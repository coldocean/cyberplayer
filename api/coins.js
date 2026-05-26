import { query, getIp, cors } from './_db.js';

const NOW = () => Math.floor(Date.now() / 1000);
const DAY = 86400;
const DAILY_COINS = 100;

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {

  const ip = getIp(req);
  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch {}

  const { action } = req.query;
  const now = NOW();

  // GET /api/coins — get balance only (no auto top-up for guests — they get ONE-TIME 100 via dark-soul join)
  if (req.method === 'GET') {
    await query(`INSERT INTO coins (ip, count, last_daily) VALUES (?, 0, 0) ON CONFLICT(ip) DO NOTHING`, [ip]);
    const row = (await query('SELECT * FROM coins WHERE ip = ?', [ip]))[0];
    const count = Number(row?.count || 0);
    const last_daily = Number(row?.last_daily || 0);
    return res.json({ coins: count, added: 0, daily: DAILY_COINS, next_daily: last_daily + DAY });
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

  // POST /api/coins?action=dark-soul — daily bonus: guests get 100, registered get 400
  if (req.method === 'POST' && action === 'dark-soul') {
    const bonusAmount = Number(body.amount) || DAILY_COINS;
    await query(`INSERT INTO coins (ip, count, last_daily) VALUES (?, 0, 0) ON CONFLICT(ip) DO NOTHING`, [ip]);
    const row = (await query('SELECT count, last_daily FROM coins WHERE ip = ?', [ip]))[0];
    const count = Number(row?.count || 0);
    const last_daily = Number(row?.last_daily || 0);
    
    // Only give bonus if they haven't received daily yet
    if (now - last_daily >= DAY) {
      const newCount = count + bonusAmount;
      await query('UPDATE coins SET count = ?, last_daily = ? WHERE ip = ?', [newCount, now, ip]);
      return res.json({ ok: true, coins: newCount, added: bonusAmount });
    }
    // Already got their daily coins
    return res.json({ ok: true, coins: count, added: 0 });
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

  } catch (err) {
    console.error('coins error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: String(err?.message || err) });
  }
}
