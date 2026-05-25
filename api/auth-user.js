import { query, cors } from './_db.js';
import crypto from 'crypto';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.SITE_URL || 'https://cyberplayer.vercel.app';

function genId() { return 'usr_' + crypto.randomBytes(12).toString('hex'); }
function genToken() { return crypto.randomBytes(32).toString('hex'); }
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}
function genSessionToken() { return crypto.randomBytes(48).toString('base64url'); }
const NOW = () => Math.floor(Date.now() / 1000);
const HOUR = 3600;
const DAY = 86400;
const WEEK = 7 * DAY;

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) { console.error('No RESEND_API_KEY'); return false; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'CyberPlayer <noreply@digitalslayer.com>', to: [to], subject, html })
    });
    return r.ok;
  } catch { return false; }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch {}
  const { action } = req.query;

  // ── REGISTER ──
  if (req.method === 'POST' && action === 'register') {
    const { name, email, password } = body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    // Check email not taken
    const existing = await query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });
    // Check name not taken
    const existingName = await query('SELECT id FROM users WHERE LOWER(name) = ?', [name.toLowerCase()]);
    if (existingName.length) return res.status(409).json({ error: 'Username already taken' });

    const id = genId();
    const hash = hashPassword(password);
    await query('INSERT INTO users (id, name, email, password_hash, role, email_verified) VALUES (?, ?, ?, ?, ?, 0)',
      [id, name, email.toLowerCase(), hash, 'user']);

    // Create verification token
    const token = genToken();
    const tokenId = 'ev_' + crypto.randomBytes(8).toString('hex');
    await query('INSERT INTO email_verification (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [tokenId, id, token, NOW() + DAY]);

    // Send verification email
    await sendEmail(email, '🔮 CyberPlayer — Verify Your Email', `
      <div style="background:#0a0a14;color:#00ff88;font-family:monospace;padding:30px;border:1px solid #00ff88;">
        <h2 style="color:#ffd700;">◈ WELCOME TO CYBERPLAYER, ${name.toUpperCase()}</h2>
        <p>Click below to verify your email and start your journey:</p>
        <a href="${SITE_URL}?verify=${token}" style="display:inline-block;padding:12px 24px;background:#ffd700;color:#000;text-decoration:none;font-weight:bold;letter-spacing:2px;margin:16px 0;">VERIFY EMAIL ▶</a>
        <p style="color:#555;font-size:12px;">This link expires in 24 hours.</p>
      </div>
    `);

    return res.json({ ok: true, message: 'Registration successful. Check your email to verify.' });
  }

  // ── LOGIN ──
  if (req.method === 'POST' && action === 'login') {
    const { name, password } = body;
    if (!name || !password) return res.status(400).json({ error: 'name and password required' });

    const rows = await query('SELECT * FROM users WHERE LOWER(name) = ?', [name.toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];

    try {
      if (!verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    const sessionId = 'ses_' + crypto.randomBytes(16).toString('hex');
    const token = genSessionToken();
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '0.0.0.0';
    const ua = req.headers['user-agent'] || '';
    await query('INSERT INTO sessions (id, user_id, token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, user.id, token, NOW() + WEEK, ip, ua]);

    return res.json({
      ok: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, email_verified: Number(user.email_verified) === 1 }
    });
  }

  // ── VERIFY EMAIL ──
  if (req.method === 'POST' && action === 'verify-email') {
    const { token } = body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    const rows = await query('SELECT * FROM email_verification WHERE token = ? AND expires_at > ?', [token, NOW()]);
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired token' });
    const v = rows[0];
    await query('UPDATE users SET email_verified = 1 WHERE id = ?', [v.user_id]);
    await query('DELETE FROM email_verification WHERE id = ?', [v.id]);
    return res.json({ ok: true, message: 'Email verified!' });
  }

  // ── FORGOT PASSWORD ──
  if (req.method === 'POST' && action === 'forgot-password') {
    const { email } = body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const rows = await query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    // Always return ok (don't reveal if email exists)
    if (!rows.length) return res.json({ ok: true, message: 'If that email exists, a reset link was sent.' });
    const user = rows[0];
    const token = genToken();
    const tokenId = 'pr_' + crypto.randomBytes(8).toString('hex');
    // Delete old reset tokens for this user
    await query('DELETE FROM password_reset WHERE user_id = ?', [user.id]);
    await query('INSERT INTO password_reset (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [tokenId, user.id, token, NOW() + HOUR]);

    await sendEmail(email, '🔮 CyberPlayer — Reset Password', `
      <div style="background:#0a0a14;color:#00ff88;font-family:monospace;padding:30px;border:1px solid #ff4444;">
        <h2 style="color:#ff4444;">◈ PASSWORD RESET</h2>
        <p>Click below to reset your CyberPlayer password:</p>
        <a href="${SITE_URL}?reset=${token}" style="display:inline-block;padding:12px 24px;background:#ff4444;color:#fff;text-decoration:none;font-weight:bold;letter-spacing:2px;margin:16px 0;">RESET PASSWORD ▶</a>
        <p style="color:#555;font-size:12px;">This link expires in 1 hour.</p>
      </div>
    `);
    return res.json({ ok: true, message: 'If that email exists, a reset link was sent.' });
  }

  // ── RESET PASSWORD ──
  if (req.method === 'POST' && action === 'reset-password') {
    const { token, password } = body;
    if (!token || !password) return res.status(400).json({ error: 'Token and new password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const rows = await query('SELECT * FROM password_reset WHERE token = ? AND expires_at > ?', [token, NOW()]);
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired token' });
    const pr = rows[0];
    const hash = hashPassword(password);
    await query('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash, NOW(), pr.user_id]);
    await query('DELETE FROM password_reset WHERE id = ?', [pr.id]);
    // Kill all sessions for this user
    await query('DELETE FROM sessions WHERE user_id = ?', [pr.user_id]);
    return res.json({ ok: true, message: 'Password reset! Please login again.' });
  }

  // ── ME (session check) ──
  if (req.method === 'GET' && action === 'me') {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Not logged in' });
    const token = auth.slice(7);
    const rows = await query(`SELECT u.id, u.name, u.email, u.role, u.email_verified FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?`, [token, NOW()]);
    if (!rows.length) return res.status(401).json({ error: 'Session expired' });
    const u = rows[0];
    return res.json({ ok: true, user: { id: u.id, name: u.name, email: u.email, role: u.role, email_verified: Number(u.email_verified) === 1 } });
  }

  // ── LOGOUT ──
  if (req.method === 'POST' && action === 'logout') {
    const auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      await query('DELETE FROM sessions WHERE token = ?', [auth.slice(7)]);
    }
    return res.json({ ok: true });
  }

  // ── CHANGE PASSWORD ──
  if (req.method === 'POST' && action === 'change-password') {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Not logged in' });
    const token = auth.slice(7);
    const sess = await query('SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?', [token, NOW()]);
    if (!sess.length) return res.status(401).json({ error: 'Session expired' });
    const { old_password, new_password } = body;
    if (!old_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const user = (await query('SELECT * FROM users WHERE id = ?', [sess[0].user_id]))[0];
    if (!user || !verifyPassword(old_password, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is wrong' });
    }
    const hash = hashPassword(new_password);
    await query('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash, NOW(), user.id]);
    return res.json({ ok: true });
  }

  res.status(405).end();

  } catch (err) {
    console.error('auth-user error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: String(err?.message || err) });
  }
}
