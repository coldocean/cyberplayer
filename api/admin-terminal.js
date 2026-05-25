import { query, getIp, cors } from './_db.js';
import crypto from 'crypto';

const NOW = () => Math.floor(Date.now() / 1000);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

// Verify auth token → return user or null
async function getUser(req) {
  const auth = req.headers['authorization']?.replace('Bearer ', '');
  if (!auth) return null;
  const rows = await query(
    'SELECT u.id, u.name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?',
    [auth, NOW()]
  );
  return rows[0] || null;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {

  // Ensure visit_log and user IP tables exist
  await query(`CREATE TABLE IF NOT EXISTS visit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    username TEXT,
    user_type TEXT DEFAULT 'dark_soul',
    started_at INTEGER,
    last_seen INTEGER,
    duration_seconds INTEGER DEFAULT 0
  )`).catch(()=>{});

  await query(`CREATE TABLE IF NOT EXISTS zeus_collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type TEXT NOT NULL,
    coins_collected INTEGER NOT NULL,
    buyer_name TEXT,
    buyer_ip TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  )`).catch(()=>{});

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch { body = {}; }

  const { command, pin } = body;
  const cmd0 = command?.trim().split(/\s+/)[0]?.toLowerCase();

  // ═══ Visit heartbeat — no PIN required, anyone can log visits ═══
  if (cmd0 === '!heartbeat') {
    const ip = getIp(req);
    const now = NOW();
    const user = await getUser(req);
    const username = user ? user.name.toLowerCase() : null;
    const userType = user ? 'registered' : 'dark_soul';
    const existing = await query('SELECT id, started_at FROM visit_log WHERE ip = ? AND last_seen > ? ORDER BY last_seen DESC LIMIT 1',
      [ip, now - 1800]);
    if (existing.length) {
      const dur = now - Number(existing[0].started_at);
      await query('UPDATE visit_log SET last_seen = ?, duration_seconds = ?, username = COALESCE(?, username) WHERE id = ?',
        [now, dur, username, existing[0].id]);
    } else {
      await query('INSERT INTO visit_log (ip, username, user_type, started_at, last_seen, duration_seconds) VALUES (?, ?, ?, ?, ?, 0)',
        [ip, username, userType, now, now]);
    }
    return res.json({ ok: true });
  }

  // PIN verification — required for all other commands
  if (pin !== '3436019') return res.status(403).json({ error: 'Invalid PIN' });

  // Auth check — must be admin or superadmin
  const user = await getUser(req);
  const isSuperAdmin = user && (user.role === 'superadmin');
  const isAdmin = user && (user.role === 'superadmin' || user.role === 'admin');

  // Parse command
  const parts = command.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();

  // ═══ !unban ═══
  if (cmd === '!unban') {
    if (!isAdmin) return res.json({ output: '⛔ ACCESS DENIED — admin/superadmin only', type: 'error' });
    const target = parts[1];
    if (!target) return res.json({ output: '⚠ Usage: !unban <nickname|ip>', type: 'warn' });

    // Try by username — find their IPs from sessions
    const userRows = await query('SELECT id, name FROM users WHERE LOWER(name) = ?', [target.toLowerCase()]);
    let unbannedCount = 0;

    if (userRows.length) {
      // Find IPs from sessions
      const sessions = await query('SELECT DISTINCT ip_address FROM sessions WHERE user_id = ?', [userRows[0].id]);
      for (const s of sessions) {
        if (s.ip_address) {
          await query('DELETE FROM bans WHERE ip = ?', [s.ip_address]);
          await query('DELETE FROM attempts WHERE ip = ?', [s.ip_address]);
          unbannedCount++;
        }
      }
      // Also clear all bans just in case
      if (unbannedCount === 0) {
        // Just remove ALL bans (nuclear option for the user)
        await query('DELETE FROM bans');
        await query('DELETE FROM attempts');
        unbannedCount = 1;
      }
      return res.json({ output: `✅ UNBANNED: ${userRows[0].name.toUpperCase()} (cleared ${unbannedCount} IP ban${unbannedCount!==1?'s':''})`, type: 'success' });
    }

    // Try as IP directly
    await query('DELETE FROM bans WHERE ip = ?', [target]);
    await query('DELETE FROM attempts WHERE ip = ?', [target]);
    return res.json({ output: `✅ UNBANNED IP: ${target}`, type: 'success' });
  }

  // ═══ !ban ═══
  if (cmd === '!ban') {
    if (!isAdmin) return res.json({ output: '⛔ ACCESS DENIED — admin/superadmin only', type: 'error' });
    const target = parts[1];
    if (!target) return res.json({ output: '⚠ Usage: !ban <nickname> [reason]', type: 'warn' });
    const reason = parts.slice(2).join(' ') || 'Banned by admin';

    const userRows = await query('SELECT id, name FROM users WHERE LOWER(name) = ?', [target.toLowerCase()]);
    if (!userRows.length) return res.json({ output: `⚠ User "${target}" not found`, type: 'warn' });

    const sessions = await query('SELECT DISTINCT ip_address FROM sessions WHERE user_id = ?', [userRows[0].id]);
    const now = NOW();
    const unbanAt = now + 30 * 86400; // 30 day ban

    let bannedIps = 0;
    for (const s of sessions) {
      if (s.ip_address) {
        await query(`INSERT INTO bans (ip, reason, banned_at, unban_at, pin_retry_after)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(ip) DO UPDATE SET reason=excluded.reason, banned_at=excluded.banned_at, unban_at=excluded.unban_at, pin_retry_after=excluded.pin_retry_after`,
          [s.ip_address, reason, now, unbanAt, unbanAt]);
        bannedIps++;
      }
    }
    // Kill their sessions
    await query('DELETE FROM sessions WHERE user_id = ?', [userRows[0].id]);
    return res.json({ output: `🔨 BANNED: ${userRows[0].name.toUpperCase()} — ${bannedIps} IP(s) blocked for 30 days\nReason: ${reason}`, type: 'success' });
  }

  // ═══ !changepswd ═══
  if (cmd === '!changepswd') {
    if (!isAdmin) return res.json({ output: '⛔ ACCESS DENIED — admin/superadmin only', type: 'error' });
    const target = parts[1];
    const newPass = parts[2];
    if (!target || !newPass) return res.json({ output: '⚠ Usage: !changepswd <username> <newpassword>', type: 'warn' });
    if (newPass.length < 6) return res.json({ output: '⚠ Password must be at least 6 chars', type: 'warn' });

    const userRows = await query('SELECT id, name, role FROM users WHERE LOWER(name) = ?', [target.toLowerCase()]);
    if (!userRows.length) return res.json({ output: `⚠ User "${target}" not found`, type: 'warn' });

    // Non-superadmin can't change superadmin passwords
    if (!isSuperAdmin && userRows[0].role === 'superadmin') {
      return res.json({ output: '⛔ Only superadmin can change superadmin passwords', type: 'error' });
    }

    const hash = hashPassword(newPass);
    await query('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash, NOW(), userRows[0].id]);
    // Kill sessions so they have to re-login
    await query('DELETE FROM sessions WHERE user_id = ?', [userRows[0].id]);
    return res.json({ output: `✅ Password changed for ${userRows[0].name.toUpperCase()} — all sessions killed`, type: 'success' });
  }

  // ═══ !help me (superadmin only) ═══
  if (cmd === '!help' && parts[1]?.toLowerCase() === 'me') {
    if (!isSuperAdmin) return res.json({ output: '⛔ Superadmin only command', type: 'error' });
    const helpText = `
╔══════════════════════════════════════════╗
║        ⛧ HELL TERMINAL — COMMANDS ⛧      ║
╠══════════════════════════════════════════╣
║  ADMIN + SUPERADMIN:                     ║
║  !unban <user>      Unban a user/IP      ║
║  !ban <user> [why]  Ban user for 30 days ║
║  !changepswd <u> <p> Change password     ║
║                                          ║
║  SUPERADMIN ONLY:                        ║
║  !help me           Show this help       ║
║  !userlist show -all    Full stats       ║
║  !userlist show -user <name> User info   ║
║  !zeus              Show Zeus earnings   ║
║  !clear             Clear terminal       ║
╚══════════════════════════════════════════╝`.trim();
    return res.json({ output: helpText, type: 'info' });
  }

  // ═══ !userlist show -all ═══
  if (cmd === '!userlist') {
    if (!isSuperAdmin) return res.json({ output: '⛔ Superadmin only command', type: 'error' });
    const sub = parts[1]?.toLowerCase();
    const flag = parts[2]?.toLowerCase();

    if (sub === 'show' && flag === '-all') {
      const allUsers = await query('SELECT name, role, email, created_at FROM users ORDER BY role, name');
      const superadmins = allUsers.filter(u => u.role === 'superadmin');
      const admins = allUsers.filter(u => u.role === 'admin');
      const regulars = allUsers.filter(u => u.role === 'user');

      // Count dark souls (visits without username in last 24h)
      const darkSouls = await query('SELECT COUNT(DISTINCT ip) as cnt FROM visit_log WHERE user_type = ? AND last_seen > ?', ['dark_soul', NOW() - 86400]);
      const darkSoulCount = darkSouls[0]?.cnt || 0;

      // Active sessions
      const activeSess = await query('SELECT COUNT(*) as cnt FROM sessions WHERE expires_at > ?', [NOW()]);
      const activeCount = activeSess[0]?.cnt || 0;

      let output = `══ SYSTEM STATUS ══\n`;
      output += `Total registered: ${allUsers.length}\n`;
      output += `Active sessions: ${activeCount}\n`;
      output += `Dark souls (24h): ${darkSoulCount}\n\n`;
      output += `👑 SUPERADMINS (${superadmins.length}):\n`;
      superadmins.forEach(u => { output += `  ${u.name} <${u.email}>\n`; });
      output += `\n⚡ ADMINS (${admins.length}):\n`;
      admins.forEach(u => { output += `  ${u.name} <${u.email}>\n`; });
      output += `\n◈ USERS (${regulars.length}):\n`;
      regulars.forEach(u => { output += `  ${u.name} <${u.email}>\n`; });
      output += `\n═══════════════════`;

      return res.json({ output, type: 'info' });
    }

    if (sub === 'show' && (flag === '-user' || flag?.startsWith('-user'))) {
      const targetName = parts[3];
      if (!targetName) return res.json({ output: '⚠ Usage: !userlist show -user <name>', type: 'warn' });

      const userRows = await query('SELECT * FROM users WHERE LOWER(name) = ?', [targetName.toLowerCase()]);
      if (!userRows.length) return res.json({ output: `⚠ User "${targetName}" not found`, type: 'warn' });
      const u = userRows[0];

      // Get sessions
      const sessions = await query('SELECT ip_address, created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [u.id]);

      // Get visit logs
      const visits = await query('SELECT * FROM visit_log WHERE username = ? ORDER BY last_seen DESC LIMIT 5', [u.name.toLowerCase()]);

      // Check if online (active session within last 10 min)
      const recentVisit = await query('SELECT * FROM visit_log WHERE username = ? AND last_seen > ? LIMIT 1', [u.name.toLowerCase(), NOW() - 600]);
      const isOnline = recentVisit.length > 0;

      // Get coins
      const guestCoins = await query('SELECT coins FROM guest_coins WHERE ip IN (SELECT DISTINCT ip_address FROM sessions WHERE user_id = ?)', [u.id]);

      let output = `══ USER: ${u.name.toUpperCase()} ══\n`;
      output += `Role: ${u.role}\n`;
      output += `Email: ${u.email}\n`;
      output += `Status: ${isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}\n`;
      output += `Verified: ${u.email_verified === '1' ? 'Yes' : 'No'}\n`;

      if (visits.length) {
        const last = visits[0];
        const lastTime = new Date(Number(last.last_seen) * 1000).toLocaleString('en-GB');
        output += `Last seen: ${lastTime}\n`;
        output += `Session duration: ${Math.round(last.duration_seconds / 60)} min\n`;
      }

      if (sessions.length) {
        output += `\nRecent IPs:\n`;
        sessions.forEach(s => { output += `  ${s.ip_address || 'unknown'}\n`; });
      }

      if (guestCoins.length) {
        output += `\nCoins: ${guestCoins.map(c => c.coins).join(', ')}\n`;
      }

      // Dark soul visits for this IP
      if (sessions.length && sessions[0].ip_address) {
        const dsVisits = await query('SELECT * FROM visit_log WHERE ip = ? AND user_type = ? ORDER BY last_seen DESC LIMIT 3', [sessions[0].ip_address, 'dark_soul']);
        if (dsVisits.length) {
          output += `\nDark soul visits from same IP:\n`;
          dsVisits.forEach(v => {
            const t = new Date(Number(v.last_seen) * 1000).toLocaleString('en-GB');
            output += `  ${t} — ${Math.round(v.duration_seconds / 60)} min\n`;
          });
        }
      }

      output += `═══════════════════`;
      return res.json({ output, type: 'info' });
    }

    return res.json({ output: '⚠ Usage: !userlist show -all  OR  !userlist show -user <name>', type: 'warn' });
  }

  // ═══ !zeus — show earnings ═══
  if (cmd === '!zeus') {
    if (!isSuperAdmin) return res.json({ output: '⛔ Superadmin only', type: 'error' });
    const totals = await query('SELECT item_type, SUM(coins_collected) as total, COUNT(*) as cnt FROM zeus_collections GROUP BY item_type');
    const grandTotal = await query('SELECT SUM(coins_collected) as total FROM zeus_collections');
    let output = `🪙 ZEUS EARNINGS REPORT 🪙\n══════════════════\n`;
    totals.forEach(t => { output += `${t.item_type}: ${t.total} coins (${t.cnt} transactions)\n`; });
    output += `\nTOTAL COLLECTED: ${grandTotal[0]?.total || 0} coins\n══════════════════`;
    return res.json({ output, type: 'info' });
  }

  // ═══ !clear ═══
  if (cmd === '!clear') {
    return res.json({ output: '', type: 'clear' });
  }

  return res.json({ output: `⚠ Unknown command: ${cmd}\nType !help me for available commands`, type: 'warn' });

  } catch (err) {
    console.error('admin-terminal error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: String(err?.message || err) });
  }
}
