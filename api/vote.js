import { query, cors } from './_db.js';

const NOW = () => Math.floor(Date.now() / 1000);

async function getUser(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const rows = await query('SELECT u.id, u.name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?', [auth.slice(7), NOW()]);
  return rows[0] || null;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {

  const { action } = req.query;

  // ── LIST tracks with votes ──
  if (req.method === 'GET' && action === 'list') {
    const user = await getUser(req);
    const tracks = await query(`
      SELECT t.*, 
        COALESCE((SELECT SUM(v.vote) FROM votes v WHERE v.track_id = t.id), 0) as vote_score,
        (SELECT COUNT(*) FROM votes v WHERE v.track_id = t.id AND v.vote = 1) as upvotes,
        (SELECT COUNT(*) FROM votes v WHERE v.track_id = t.id AND v.vote = -1) as downvotes
      FROM uploaded_tracks t 
      ORDER BY t.created_at DESC
    `);

    // If user logged in, get their votes
    let userVotes = {};
    if (user) {
      const uv = await query('SELECT track_id, vote FROM votes WHERE user_id = ?', [user.id]);
      for (const v of uv) userVotes[v.track_id] = Number(v.vote);
    }

    return res.json({
      tracks: tracks.map(t => ({
        id: Number(t.id),
        title: t.title,
        filename: t.filename,
        duration: t.duration ? Number(t.duration) : null,
        uploaded_by: t.uploaded_by,
        status: t.status,
        vote_score: Number(t.vote_score || 0),
        upvotes: Number(t.upvotes || 0),
        downvotes: Number(t.downvotes || 0),
        my_vote: userVotes[t.id] || 0,
        created_at: Number(t.created_at)
      }))
    });
  }

  // ── VOTE on a track ──
  if (req.method === 'POST' && action === 'cast') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Must be logged in to vote' });

    let body = {};
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch {}
    const { track_id, vote } = body; // vote: 1 (keep) or -1 (remove)
    if (!track_id || (vote !== 1 && vote !== -1)) return res.status(400).json({ error: 'track_id and vote (1 or -1) required' });

    // Upsert vote
    await query(`INSERT INTO votes (track_id, user_id, vote) VALUES (?, ?, ?)
      ON CONFLICT(track_id, user_id) DO UPDATE SET vote = ?, created_at = ?`,
      [track_id, user.id, vote, vote, NOW()]);

    // Recalculate score
    const score = await query('SELECT COALESCE(SUM(vote), 0) as score FROM votes WHERE track_id = ?', [track_id]);
    const newScore = Number(score[0]?.score || 0);
    await query('UPDATE uploaded_tracks SET vote_score = ? WHERE id = ?', [newScore, track_id]);

    return res.json({ ok: true, vote_score: newScore });
  }

  // ── ADMIN: approve/reject track ──
  if (req.method === 'POST' && action === 'admin-decide') {
    const user = await getUser(req);
    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    let body = {};
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch {}
    const { track_id, decision } = body; // decision: 'approved' or 'rejected'

    if (!track_id || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'track_id and decision (approved/rejected) required' });
    }

    // Only superadmin can override any track; regular admins can only manage their own uploads
    if (user.role === 'admin') {
      const track = (await query('SELECT uploaded_by FROM uploaded_tracks WHERE id = ?', [track_id]))[0];
      if (track && track.uploaded_by !== user.id) {
        return res.status(403).json({ error: 'Admins can only manage their own uploads. Contact superadmin.' });
      }
    }

    await query('UPDATE uploaded_tracks SET status = ? WHERE id = ?', [decision, track_id]);
    return res.json({ ok: true, status: decision });
  }

  // ── SUPERADMIN: delete track ──
  if (req.method === 'POST' && action === 'delete') {
    const user = await getUser(req);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }

    let body = {};
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch {}
    const { track_id } = body;
    if (!track_id) return res.status(400).json({ error: 'track_id required' });

    await query('DELETE FROM votes WHERE track_id = ?', [track_id]);
    await query('DELETE FROM uploaded_tracks WHERE id = ?', [track_id]);
    return res.json({ ok: true });
  }

  res.status(405).end();

  } catch (err) {
    console.error('vote error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: String(err?.message || err) });
  }
}
