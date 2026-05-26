export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    hasTursoUrl: !!process.env.TURSO_URL,
    tursoUrlPrefix: (process.env.TURSO_URL || '').substring(0, 20),
    hasTursoToken: !!process.env.TURSO_TOKEN,
    tursoTokenPrefix: (process.env.TURSO_TOKEN || '').substring(0, 10),
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasResendKey: !!process.env.RESEND_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    envKeys: Object.keys(process.env).filter(k => !k.startsWith('_') && !k.startsWith('PATH') && !k.startsWith('HOME')).sort()
  });
}
