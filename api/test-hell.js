import { query, cors } from './_db.js';

export default async function handler(req, res) {
  cors(res);
  try {
    const msgs = await query('SELECT id, text, color, author, created_at, pinned FROM hell_messages ORDER BY created_at DESC LIMIT 5');
    return res.json({ ok: true, count: msgs.length, msgs });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
