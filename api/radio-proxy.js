import { cors } from './_db.js';

export const config = {
  api: {
    responseLimit: false,
    bodyParser: false,
  },
  maxDuration: 300,
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'No URL' });

  try {
    // Always proxy/pipe the stream — no redirects (browser can't follow 302 for Audio elements cross-origin)
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CyberpunkPlayer/1.0)',
        'Icy-MetaData': '1',
      },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
    }

    const ct = upstream.headers.get('content-type') || 'audio/mpeg';
    const body = upstream.body;
    if (!body) return res.status(502).json({ error: 'No body from upstream' });

    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('X-Radio-Proxied', '1');
    res.status(200);

    // Pipe the stream
    const reader = body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.write(Buffer.from(value))) {
          await new Promise(r => res.once('drain', r));
        }
      }
      res.end();
    };
    await pump();
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({ error: e.message });
    }
  }
}
