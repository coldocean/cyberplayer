import { query, cors } from './_db.js';
import crypto from 'crypto';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Secret key to prevent random people from running this
  const { key } = req.query;
  if (key !== 'demonseed666') return res.status(403).json({ error: 'forbidden' });

  const results = [];

  try {
    // Create users table
    await query(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )`);
    results.push('users table created');

    // Create sessions table
    await query(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    results.push('sessions table created');

    // Create email_verification table
    await query(`CREATE TABLE IF NOT EXISTS email_verification (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    results.push('email_verification table created');

    // Create password_reset table
    await query(`CREATE TABLE IF NOT EXISTS password_reset (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    results.push('password_reset table created');

    // Create coins table (for guest coins tracking)
    await query(`CREATE TABLE IF NOT EXISTS guest_coins (
      ip TEXT PRIMARY KEY,
      coins INTEGER NOT NULL DEFAULT 100,
      last_daily INTEGER DEFAULT 0,
      updated_at INTEGER DEFAULT (unixepoch())
    )`);
    results.push('guest_coins table created');

    // Create votes table
    await query(`CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      vote INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    )`);
    results.push('votes table created');

    // Create vote_decisions table
    await query(`CREATE TABLE IF NOT EXISTS vote_decisions (
      track_id TEXT PRIMARY KEY,
      decision TEXT NOT NULL,
      decided_by TEXT NOT NULL,
      decided_at INTEGER DEFAULT (unixepoch())
    )`);
    results.push('vote_decisions table created');

    // Create hell_messages table
    await query(`CREATE TABLE IF NOT EXISTS hell_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      text TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    )`);
    results.push('hell_messages table created');

    // Create bans table
    await query(`CREATE TABLE IF NOT EXISTS bans (
      id TEXT PRIMARY KEY,
      ip TEXT NOT NULL,
      reason TEXT,
      banned_by TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      expires_at INTEGER
    )`);
    results.push('bans table created');

    // Seed superadmin: deemah
    const existing1 = await query('SELECT id FROM users WHERE LOWER(name) = ?', ['deemah']);
    if (!existing1.length) {
      const id1 = 'usr_deemah_superadmin';
      const hash1 = hashPassword('noT1333Deemahseeq');
      await query('INSERT INTO users (id, name, email, password_hash, role, email_verified) VALUES (?, ?, ?, ?, ?, 1)',
        [id1, 'deemah', 'deemah@digitalslayer.com', hash1, 'superadmin']);
      results.push('superadmin deemah created');
    } else {
      // Update password and role
      const hash1 = hashPassword('noT1333Deemahseeq');
      await query('UPDATE users SET password_hash = ?, role = ? WHERE LOWER(name) = ?', [hash1, 'superadmin', 'deemah']);
      results.push('superadmin deemah updated');
    }

    // Seed admin: robbmobb
    const existing2 = await query('SELECT id FROM users WHERE LOWER(name) = ?', ['robbmobb']);
    if (!existing2.length) {
      const id2 = 'usr_robbmobb_admin';
      const hash2 = hashPassword('yesm81337carlitto');
      await query('INSERT INTO users (id, name, email, password_hash, role, email_verified) VALUES (?, ?, ?, ?, ?, 1)',
        [id2, 'robbmobb', 'robbmobb@digitalslayer.com', hash2, 'admin']);
      results.push('admin robbmobb created');
    } else {
      const hash2 = hashPassword('yesm81337carlitto');
      await query('UPDATE users SET password_hash = ?, role = ? WHERE LOWER(name) = ?', [hash2, 'admin', 'robbmobb']);
      results.push('admin robbmobb updated');
    }

    return res.json({ ok: true, results });
  } catch (err) {
    return res.status(500).json({ error: err.message, results });
  }
}
