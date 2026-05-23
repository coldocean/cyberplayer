import { query, getIp, cors } from './_db.js';

// Cyberpunk symbols: [id, label, weight, payout_multiplier]
const SYMBOLS = [
  { id: 'seven',   label: '7',  weight: 1,  pay: 10 },
  { id: 'diamond', label: '◆',  weight: 3,  pay: 7  },
  { id: 'skull',   label: '☠',  weight: 5,  pay: 5  },
  { id: 'bolt',    label: '⚡',  weight: 8,  pay: 4  },
  { id: 'red',     label: '●',  weight: 12, pay: 3  },
  { id: 'gold',    label: '◉',  weight: 15, pay: 2  },
  { id: 'card',    label: '▣',  weight: 20, pay: 1  },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((s, x) => s + x.weight, 0);

function spinReel() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const s of SYMBOLS) { r -= s.weight; if (r <= 0) return s; }
  return SYMBOLS[SYMBOLS.length - 1];
}

function spinReels() {
  return Array.from({ length: 3 }, () => Array.from({ length: 3 }, spinReel));
}

function calcWin(reels, betRate) {
  const mid = [reels[0][1], reels[1][1], reels[2][1]];
  const top = [reels[0][0], reels[1][0], reels[2][0]];
  const bot = [reels[0][2], reels[1][2], reels[2][2]];

  let coinsWon = 0;

  for (const line of [mid, top, bot]) {
    if (line[0].id === line[1].id && line[1].id === line[2].id) {
      coinsWon += Math.round(line[0].pay * betRate);
    } else if (line[0].id === line[1].id || line[1].id === line[2].id) {
      if (line === mid) coinsWon += 1;
    }
  }

  return coinsWon;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const ip = getIp(req);
  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch {}

  const isAdmin = body.is_admin === true;
  const betRate = Math.min(Math.max(Number(body.bet_rate || 1), 1), 5);

  // Guests must pay betRate coins to spin
  if (!isAdmin) {
    await query(`INSERT INTO coins (ip, count, last_daily) VALUES (?, 0, 0) ON CONFLICT(ip) DO NOTHING`, [ip]);
    const row = (await query('SELECT count FROM coins WHERE ip = ?', [ip]))[0];
    const balance = Number(row?.count || 0);
    if (balance < betRate) {
      return res.json({ error: 'insufficient', coins: balance, bet_cost: betRate });
    }
    // Deduct bet cost
    await query('UPDATE coins SET count = count - ? WHERE ip = ?', [betRate, ip]);
  }

  // Spin
  const reels = spinReels();
  const coinsWon = calcWin(reels, betRate);

  // Credit winnings to guest
  if (!isAdmin && coinsWon > 0) {
    await query('UPDATE coins SET count = count + ? WHERE ip = ?', [coinsWon, ip]);
  }

  const row = isAdmin ? null : (await query('SELECT count FROM coins WHERE ip = ?', [ip]))[0];
  const newTotal = isAdmin ? null : Number(row?.count || 0);

  return res.json({
    reels: reels.map(reel => reel.map(s => ({ id: s.id, label: s.label }))),
    coins_won: coinsWon,
    bet_cost: betRate,
    new_total: newTotal,
    is_admin: isAdmin
  });
}
