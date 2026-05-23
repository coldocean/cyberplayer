import { query, getIp, cors } from './_db.js';

const NOW = () => Math.floor(Date.now() / 1000);
const DAY = 86400;
const WEEK = 7 * DAY;

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = getIp(req);
  const { action } = req.query;

  // GET /api/ban?action=check  — check if IP is banned
  if (req.method === 'GET' && action === 'check') {
    const rows = await query('SELECT * FROM bans WHERE ip = ?', [ip]);
    const ban = rows[0];
    const now = NOW();
    if (ban && ban.unban_at && Number(ban.unban_at) > now) {
      return res.json({
        banned: true,
        unban_at: Number(ban.unban_at),
        pin_retry_after: Number(ban.pin_retry_after) || 0,
        reason: ban.reason,
        seconds_left: Number(ban.unban_at) - now
      });
    }
    // Check if in 7-day PIN retry lockout
    if (ban && ban.pin_retry_after && Number(ban.pin_retry_after) > now) {
      return res.json({
        banned: false,
        pin_locked: true,
        pin_retry_after: Number(ban.pin_retry_after),
        seconds_left: Number(ban.pin_retry_after) - now
      });
    }
    return res.json({ banned: false, pin_locked: false });
  }

  // POST /api/ban  { type: 'pin'|'pass' }  — report a wrong attempt
  if (req.method === 'POST') {
    let body = {};
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch {}
    const type = body.type || 'pin';
    const now = NOW();

    // Upsert attempt counter
    await query(`INSERT INTO attempts (ip, pin_count, pass_count, last_at)
      VALUES (?, 0, 0, ?)
      ON CONFLICT(ip) DO UPDATE SET last_at = excluded.last_at`,
      [ip, now]);

    if (type === 'pin') {
      await query('UPDATE attempts SET pin_count = pin_count + 1 WHERE ip = ?', [ip]);
    } else {
      await query('UPDATE attempts SET pass_count = pass_count + 1 WHERE ip = ?', [ip]);
    }

    const att = (await query('SELECT * FROM attempts WHERE ip = ?', [ip]))[0];
    const totalWrong = Number(att?.pin_count || 0) + Number(att?.pass_count || 0);

    if (totalWrong >= 1) {
      // Ban for 24h, PIN retry locked for 7 days
      const unban_at = now + DAY;
      const pin_retry_after = now + WEEK;
      await query(`INSERT INTO bans (ip, reason, banned_at, unban_at, pin_retry_after)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(ip) DO UPDATE SET
          reason = excluded.reason,
          banned_at = excluded.banned_at,
          unban_at = excluded.unban_at,
          pin_retry_after = excluded.pin_retry_after`,
        [ip, `wrong_${type}`, now, unban_at, pin_retry_after]);

      return res.json({
        banned: true,
        unban_at,
        pin_retry_after,
        seconds_left: DAY,
        reason: `wrong_${type}`
      });
    }

    return res.json({ banned: false });
  }

  res.status(405).end();
}
