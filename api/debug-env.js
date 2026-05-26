export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const tursoUrl = process.env.TURSO_URL;
  const tursoToken = process.env.TURSO_TOKEN;
  const url = tursoUrl ? tursoUrl.replace('libsql://', 'https://') : undefined;
  
  // Try a simple fetch to Turso
  let fetchResult = 'not attempted';
  if (url && tursoToken) {
    try {
      const r = await fetch(`${url}/v2/pipeline`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tursoToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql: 'SELECT 1 as test' } }, { type: 'close' }] })
      });
      fetchResult = { status: r.status, body: await r.text() };
    } catch (e) {
      fetchResult = { error: e.message };
    }
  }

  return res.json({
    tursoUrlExists: !!tursoUrl,
    tursoUrlPrefix: tursoUrl ? tursoUrl.substring(0, 20) + '...' : null,
    tursoTokenExists: !!tursoToken,
    tursoTokenLen: tursoToken ? tursoToken.length : 0,
    computedUrl: url,
    fetchResult,
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('TURSO') || k.includes('VERCEL') || k.includes('NODE'))
  });
}
