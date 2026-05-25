import { query, cors } from './_db.js';

const NOW = () => Math.floor(Date.now() / 1000);

// Verify session token → return {id, name, role} or null
async function getUser(req) {
  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth) return null;
  try {
    const rows = await query(
      'SELECT u.id, u.name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?',
      [auth, NOW()]
    );
    return rows.length ? rows[0] : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Ensure tables exist
    await query(`CREATE TABLE IF NOT EXISTS hell_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      color TEXT DEFAULT '#ff4444',
      author TEXT DEFAULT 'SATAN',
      created_at TEXT DEFAULT (datetime('now')),
      pinned INTEGER DEFAULT 0
    )`).catch(()=>{});

    await query(`CREATE TABLE IF NOT EXISTS hell_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      confirmed INTEGER DEFAULT 0,
      confirm_token TEXT,
      confirm_expires TEXT,
      added_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`).catch(()=>{});

    const action = req.query.action || 'list';

    // GET — list messages
    if (req.method === 'GET' && action === 'list') {
      const msgs = await query('SELECT id, text, color, author, created_at, pinned FROM hell_messages ORDER BY pinned DESC, created_at DESC LIMIT 200');
      return res.json({ ok: true, messages: msgs });
    }

    // Helper: check if user is superadmin or hell admin
    async function requireAdmin() {
      const user = await getUser(req);
      if (!user) return { error: 'Auth required', status: 401 };
      const isSuperAdmin = user.role === 'superadmin' || user.name?.toLowerCase() === 'deemah';
      if (isSuperAdmin) return { user, isSuperAdmin: true };
      // Check hell_admins table
      const admins = await query('SELECT * FROM hell_admins WHERE email = ? AND confirmed = 1', [user.name]);
      if (admins.length) return { user, isSuperAdmin: false };
      return { error: 'Not admin', status: 403 };
    }

    // POST — add message
    if (req.method === 'POST' && action === 'add') {
      const check = await requireAdmin();
      if (check.error) return res.status(check.status).json({ error: check.error });
      const { user } = check;

      const { text, color, author } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!text) return res.status(400).json({ error: 'Text required' });

      await query('INSERT INTO hell_messages (text, color, author) VALUES (?, ?, ?)', [
        text, color || '#ff4444', author || user.name
      ]);
      return res.json({ ok: true });
    }

    // POST — edit message
    if (req.method === 'POST' && action === 'edit') {
      const check = await requireAdmin();
      if (check.error) return res.status(check.status).json({ error: check.error });

      const { id, text, color, author } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!id || !text) return res.status(400).json({ error: 'ID and text required' });
      await query('UPDATE hell_messages SET text = ?, color = ?, author = ? WHERE id = ?', [
        text, color || '#ff4444', author || 'SATAN', id
      ]);
      return res.json({ ok: true });
    }

    // POST — delete message
    if (req.method === 'POST' && action === 'delete') {
      const check = await requireAdmin();
      if (check.error) return res.status(check.status).json({ error: check.error });

      const { id } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!id) return res.status(400).json({ error: 'ID required' });
      await query('DELETE FROM hell_messages WHERE id = ?', [id]);
      return res.json({ ok: true });
    }

    // POST — add admin (superadmin only)
    if (req.method === 'POST' && action === 'add-admin') {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'Auth required' });
      if (user.role !== 'superadmin' && user.name?.toLowerCase() !== 'deemah') return res.status(403).json({ error: 'Superadmin only' });

      const { email } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!email) return res.status(400).json({ error: 'Email required' });

      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      await query('DELETE FROM hell_admins WHERE email = ?', [email]);
      await query('INSERT INTO hell_admins (email, confirm_token, confirm_expires, added_by) VALUES (?, ?, ?, ?)', [
        email, token, expires, user.name
      ]);
      return res.json({ ok: true, token, expires, email });
    }

    // GET — confirm admin
    if (req.method === 'GET' && action === 'confirm') {
      const token = req.query.token;
      if (!token) return res.status(400).json({ error: 'Token required' });

      const admins = await query('SELECT * FROM hell_admins WHERE confirm_token = ?', [token]);
      if (!admins.length) return res.status(404).json({ error: 'Invalid token' });

      const admin = admins[0];
      if (new Date(admin.confirm_expires) < new Date()) {
        await query('DELETE FROM hell_admins WHERE id = ?', [admin.id]);
        return res.status(410).json({ error: 'Token expired — admin rights revoked' });
      }

      await query('UPDATE hell_admins SET confirmed = 1, confirm_token = NULL WHERE id = ?', [admin.id]);
      return res.json({ ok: true, email: admin.email, message: 'Admin confirmed — welcome to HELL' });
    }

    // GET — list admins (superadmin only)
    if (req.method === 'GET' && action === 'admins') {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'Auth required' });
      if (user.role !== 'superadmin' && user.name?.toLowerCase() !== 'deemah') return res.status(403).json({ error: 'Superadmin only' });

      const admins = await query('SELECT id, email, confirmed, created_at, added_by FROM hell_admins ORDER BY created_at DESC');
      return res.json({ ok: true, admins });
    }

    // POST — remove admin (superadmin only)
    if (req.method === 'POST' && action === 'remove-admin') {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'Auth required' });
      if (user.role !== 'superadmin' && user.name?.toLowerCase() !== 'deemah') return res.status(403).json({ error: 'Superadmin only' });

      const { email } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await query('DELETE FROM hell_admins WHERE email = ?', [email]);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error('hell-messages error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
