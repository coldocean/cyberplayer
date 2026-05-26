// Shared Turso HTTP helper
// Read env vars lazily inside query() — Vercel encrypted env may not be available at module init time
function getTursoUrl() {
  return process.env.TURSO_URL?.replace('libsql://', 'https://');
}
function getTursoToken() {
  return process.env.TURSO_TOKEN;
}

export async function query(sql, args = []) {
  const tursoUrl = getTursoUrl();
  const tursoToken = getTursoToken();
  const stmt = args.length ? { sql, args: args.map(v => v === null ? { type: 'null' } : typeof v === 'number' ? { type: 'integer', value: String(v) } : { type: 'text', value: String(v) }) } : { sql };
  const res = await fetch(`${tursoUrl}/v2/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tursoToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt }, { type: 'close' }] })
  });
  const data = await res.json();
  if (data.results?.[0]?.type === 'error') throw new Error(data.results[0].error.message);
  const result = data.results?.[0]?.response?.result;
  if (!result) return [];
  return result.rows.map(row =>
    Object.fromEntries(result.cols.map((c, i) => [c.name, row[i]?.value ?? null]))
  );
}

export function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    '0.0.0.0';
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
