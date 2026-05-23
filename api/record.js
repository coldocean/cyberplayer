import { query, cors } from './_db.js';
import crypto from 'crypto';

const NOW = () => Math.floor(Date.now() / 1000);

// S3 config for Cloudflare R2
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const S3_BUCKET = process.env.S3_BUCKET;

async function getUser(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const rows = await query('SELECT u.id, u.name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?', [auth.slice(7), NOW()]);
  return rows[0] || null;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Must be logged in to record' });

  const { action } = req.query;
  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch {}

  // ── START recording — just create a DB entry ──
  if (req.method === 'POST' && action === 'start') {
    const { source_type, source_name } = body; // source_type: 'radio'|'playlist', source_name: station/track name
    if (!source_type || !source_name) return res.status(400).json({ error: 'source_type and source_name required' });

    // Check if user already has an active recording
    const active = await query('SELECT id FROM recordings WHERE user_id = ? AND status = ?', [user.id, 'recording']);
    if (active.length) return res.status(409).json({ error: 'Already recording. Stop current recording first.', recording_id: active[0].id });

    const id = crypto.randomBytes(8).toString('hex');
    await query('INSERT INTO recordings (id, user_id, source_type, source_name, status) VALUES (?, ?, ?, ?, ?)',
      [id, user.id, source_type, source_name, 'recording']);

    return res.json({ ok: true, recording_id: id });
  }

  // ── UPLOAD recorded chunk (client sends audio blob) ──
  if (req.method === 'POST' && action === 'upload') {
    const formData = await req.formData ? await req.formData() : null;
    
    // For Vercel serverless, handle multipart
    if (!formData) {
      // Fallback: body contains base64 audio
      const { recording_id, audio_base64, duration } = body;
      if (!recording_id || !audio_base64) return res.status(400).json({ error: 'recording_id and audio_base64 required' });

      const rec = (await query('SELECT * FROM recordings WHERE id = ? AND user_id = ?', [recording_id, user.id]))[0];
      if (!rec) return res.status(404).json({ error: 'Recording not found' });

      const key = `recordings/${user.id}/${recording_id}.webm`;
      const audioBuffer = Buffer.from(audio_base64, 'base64');

      // Upload to S3/R2
      if (S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY && S3_BUCKET) {
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const s3 = new S3Client({
          region: 'auto',
          endpoint: S3_ENDPOINT,
          credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY }
        });
        await s3.send(new PutObjectCommand({
          Bucket: S3_BUCKET, Key: key, Body: audioBuffer, ContentType: 'audio/webm'
        }));
      }

      await query('UPDATE recordings SET storage_key = ?, duration = ?, status = ? WHERE id = ?',
        [key, duration || 0, 'completed', recording_id]);

      // Also create an uploaded_track entry for voting
      await query('INSERT INTO uploaded_tracks (title, filename, storage_key, duration, uploaded_by, status) VALUES (?, ?, ?, ?, ?, ?)',
        [`Recording: ${rec.source_name}`, `${recording_id}.webm`, key, duration || 0, user.id, 'voting']);

      return res.json({ ok: true, storage_key: key });
    }
  }

  // ── STOP recording ──
  if (req.method === 'POST' && action === 'stop') {
    const { recording_id } = body;
    if (!recording_id) return res.status(400).json({ error: 'recording_id required' });
    await query('UPDATE recordings SET status = ? WHERE id = ? AND user_id = ?', ['stopped', recording_id, user.id]);
    return res.json({ ok: true });
  }

  // ── LIST my recordings ──
  if (req.method === 'GET' && action === 'list') {
    const recordings = await query('SELECT * FROM recordings WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [user.id]);
    return res.json({ recordings });
  }

  res.status(405).end();
}
