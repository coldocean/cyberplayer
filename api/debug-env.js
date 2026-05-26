export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const raw = process.env.TURSO_URL;
  const rawToken = process.env.TURSO_TOKEN;
  res.json({
    tursoUrlType: typeof raw,
    tursoUrlLen: raw ? raw.length : 0,
    tursoUrlFirst30: raw ? raw.substring(0, 30) : 'UNDEFINED',
    tursoTokenLen: rawToken ? rawToken.length : 0,
    tursoTokenFirst10: rawToken ? rawToken.substring(0, 10) : 'UNDEFINED',
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('TURSO') || k.includes('DATABASE') || k.includes('SITE') || k.includes('RESEND')),
    timestamp: Date.now()
  });
}
