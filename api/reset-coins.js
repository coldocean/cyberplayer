import { query, getIp, cors } from './_db.js';

// DELETE all coins data for the requesting IP — for dev/test use
// Called automatically on page load so guest can always be tested fresh
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = getIp(req);
  await query('DELETE FROM coins WHERE ip = ?', [ip]);
  return res.status(200).json({ ok: true, cleared: ip });
}
