export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = process.env.TURSO_URL || '';
  res.json({
    tursoUrl: url.substring(0, 80),
    tursoUrlFull: url,
    transformed: url.replace('libsql://', 'https://'),
    fetchTarget: url.replace('libsql://', 'https://') + '/v2/pipeline'
  });
}
