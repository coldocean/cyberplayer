/**
 * /api/identify-song — proxies audio to local shazamio Python microservice
 * Powered by: https://github.com/shazamio/ShazamIO (free, no API key, 6k+ stars)
 * Microservice runs on port 7331 (shazam_service.py)
 */
import { cors } from './_db.js';
import http from 'http';

const SHAZAM_PORT = parseInt(process.env.SHAZAM_PORT || '7331');

function proxyToShazam(audioBuffer, contentType) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: SHAZAM_PORT,
      path: '/identify',
      method: 'POST',
      headers: {
        'Content-Type': contentType || 'audio/webm',
        'Content-Length': audioBuffer.length
      }
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(new Error('Invalid JSON from shazam service')); }
      });
    });
    req.on('error', reject);
    req.write(audioBuffer);
    req.end();
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Collect raw body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const audioBuffer = Buffer.concat(chunks);

    if (!audioBuffer.length) {
      return res.status(400).json({ found: false, error: 'No audio data' });
    }

    const ct = req.headers['content-type'] || 'audio/webm';
    const result = await proxyToShazam(audioBuffer, ct);
    res.json(result);
  } catch (e) {
    // If shazam service is down, return graceful error
    res.status(503).json({ found: false, error: 'Shazam service unavailable: ' + e.message });
  }
}
