// api-server/index.js
// Проксі до API-SPORTS + PandaScore + ЗБЕРЕЖЕННЯ СТАВОК У FIRESTORE

const express = require('express');
const cors    = require('cors');
const axios   = require('axios');

// 🔥 Firebase Admin SDK
const admin = require('firebase-admin');

let serviceAccount;

// 1) На хостингу (Render): беремо JSON ключ з ENV
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log('✅ Loaded Firebase service account from ENV');
  } catch (e) {
    console.error('❌ Cannot parse FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
    process.exit(1);
  }
// 2) Локально: читаємо ./service-account.json
} else {
  try {
    serviceAccount = require('./service-account.json');
    console.log('✅ Loaded Firebase service account from local file service-account.json');
  } catch (e) {
    console.error('❌ No FIREBASE_SERVICE_ACCOUNT_JSON and cannot load ./service-account.json');
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // якщо треба Realtime DB:
  // databaseURL: "https://the-p1dorasu-default-rtdb.europe-west1.firebasedatabase.app"
});

// Firestore (серверна адмін-доступ)
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json()); // щоб читати JSON з POST

// PORT з оточення (Render дає свій) або 3000 локально
const PORT = process.env.PORT || 3000;

// ---------------- API KEYS ----------------
// На Render вони беруться з Environment Variables
// Локально можеш або задати їх через ENV, або лишити fallback
const API_SPORTS_KEY   = process.env.API_SPORTS_KEY   || 'a17a08235c3affd1f43f31e35e184f9a';
const PANDASCORE_TOKEN = process.env.PANDASCORE_TOKEN || '4E8MUrCTQj-Oz2NwoLT8sbQ-mSxUK1vsLgawW7QCeBi7gja0lM4';

// ---------------- HELPERS ----------------
async function apiSportsGet(baseUrl, endpoint, params = {}) {
  const url = `${baseUrl}${endpoint}`;
  try {
    console.log('➡️  API-SPORTS:', url, params);
    const res = await axios.get(url, {
      headers: {
        'x-apisports-key': API_SPORTS_KEY
      },
      params,
      timeout: 10000
    });
    return res.data;
  } catch (err) {
    console.error(
      '❌ API-SPORTS ERROR',
      url,
      params,
      err.response?.status,
      err.response?.data || err.message
    );
    throw err;
  }
}

async function pandaGet(endpoint, params = {}) {
  const url = `https://api.pandascore.co${endpoint}`;
  try {
    console.log('➡️  PandaScore:', url, params);
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${PANDASCORE_TOKEN}`
      },
      params,
      timeout: 10000
    });
    return res.data;
  } catch (err) {
    console.error(
      '❌ PandaScore ERROR',
      url,
      params,
      err.response?.status,
      err.response?.data || err.message
    );
    throw err;
  }
}
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// ---------------- ROOT ----------------
app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'API proxy server is running',
    sports: [
      'football',
      'basketball',
      'volleyball',
      'hockey',
      'mma',
      'boxing',
      'formula1',
      'cs2'
    ]
  });
});

// ---------------- FOOTBALL ----------------
app.get('/api/football/upcoming', async (req, res) => {
  const days = 7;
  const today = new Date();
  const all = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);

    try {
      const data = await apiSportsGet(
        'https://v3.football.api-sports.io',
        '/fixtures',
        {
          date: dateStr,
          timezone: 'Europe/Kiev'
        }
      );

      if (Array.isArray(data.response)) {
        all.push(...data.response);
      }
    } catch (e) {
      console.error('⚠️ football date error', dateStr);
    }
  }

  console.log('✅ football upcoming total:', all.length);
  res.json({ response: all });
});

app.get('/api/football/live', async (req, res) => {
  try {
    const data = await apiSportsGet(
      'https://v3.football.api-sports.io',
      '/fixtures',
      {
        live: 'all',
        timezone: 'Europe/Kiev'
      }
    );

    const resp = Array.isArray(data.response) ? data.response : [];
    console.log('✅ football live:', resp.length);
    res.json({ response: resp });
  } catch (e) {
    console.error('❌ football live error');
    res.status(500).json({ error: 'football live error', response: [] });
  }
});

// матч по конкретному ID (для фінального результату)
app.get('/api/football/fixture', async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'fixture id is required', response: [] });
  }

  try {
    const data = await apiSportsGet(
      'https://v3.football.api-sports.io',
      '/fixtures',
      {
        id,
        timezone: 'Europe/Kiev'
      }
    );

    const resp = Array.isArray(data.response) ? data.response : [];
    console.log('✅ football fixture by id:', id, '=>', resp.length);
    res.json({ response: resp });
  } catch (e) {
    console.error('❌ football fixture error', id);
    res.status(500).json({ error: 'football fixture error', response: [] });
  }
});

// ---------------- BASKETBALL ----------------
app.get('/api/basketball/upcoming', async (req, res) => {
  const days = 5;
  const today = new Date();
  const all = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);

    try {
      const data = await apiSportsGet(
        'https://v1.basketball.api-sports.io',
        '/games',
        {
          date: dateStr,
          timezone: 'Europe/Kiev'
        }
      );

      if (Array.isArray(data.response)) {
        all.push(...data.response);
      }
    } catch (e) {
      console.error('⚠️ basketball date error', dateStr);
    }
  }

  console.log('✅ basketball upcoming total:', all.length);
  res.json({ response: all });
});

app.get('/api/basketball/live', async (req, res) => {
  try {
    const data = await apiSportsGet(
      'https://v1.basketball.api-sports.io',
      '/games',
      {
        date: new Date().toISOString().slice(0, 10),
        timezone: 'Europe/Kiev'
      }
    );
    const resp = (Array.isArray(data.response) ? data.response : []).filter(g => {
      const s = (g.status?.long || g.status?.short || '').toString().toLowerCase();
      return s.includes('live') || s.includes('in play');
    });
    console.log('✅ basketball live:', resp.length);
    res.json({ response: resp });
  } catch (e) {
    console.error('❌ basketball live error');
    res.status(500).json({ error: 'basketball live error', response: [] });
  }
});

// ---------------- VOLLEYBALL ----------------
app.get('/api/volleyball/upcoming', async (req, res) => {
  const days = 5;
  const today = new Date();
  const all = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);

    try {
      const data = await apiSportsGet(
        'https://v1.volleyball.api-sports.io',
        '/games',
        {
          date: dateStr,
          timezone: 'Europe/Kiev'
        }
      );

      if (Array.isArray(data.response)) {
        all.push(...data.response);
      }
    } catch (e) {
      console.error('⚠️ volleyball date error', dateStr);
    }
  }

  console.log('✅ volleyball upcoming total:', all.length);
  res.json({ response: all });
});

app.get('/api/volleyball/live', async (req, res) => {
  try {
    const data = await apiSportsGet(
      'https://v1.volleyball.api-sports.io',
      '/games',
      {
        date: new Date().toISOString().slice(0, 10),
        timezone: 'Europe/Kiev'
      }
    );
    const resp = (Array.isArray(data.response) ? data.response : []).filter(g => {
      const s = (g.status?.long || g.status?.short || '').toString().toLowerCase();
      return s.includes('live') || s.includes('in play');
    });
    console.log('✅ volleyball live:', resp.length);
    res.json({ response: resp });
  } catch (e) {
    console.error('❌ volleyball live error');
    res.status(500).json({ error: 'volleyball live error', response: [] });
  }
});

// ---------------- HOCKEY ----------------
app.get('/api/hockey/upcoming', async (req, res) => {
  const days = 5;
  const today = new Date();
  const all = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);

    try {
      const data = await apiSportsGet(
        'https://v1.hockey.api-sports.io',
        '/games',
        {
          date: dateStr,
          timezone: 'Europe/Kiev'
        }
      );

      if (Array.isArray(data.response)) {
        all.push(...data.response);
      }
    } catch (e) {
      console.error('⚠️ hockey date error', dateStr);
    }
  }

  console.log('✅ hockey upcoming total:', all.length);
  res.json({ response: all });
});

app.get('/api/hockey/live', async (req, res) => {
  try {
    const data = await apiSportsGet(
      'https://v1.hockey.api-sports.io',
      '/games',
      {
        date: new Date().toISOString().slice(0, 10),
        timezone: 'Europe/Kiev'
      }
    );
    const resp = (Array.isArray(data.response) ? data.response : []).filter(g => {
      const s = (g.status?.long || g.status?.short || '').toString().toLowerCase();
      return s.includes('live') || s.includes('in play');
    });
    console.log('✅ hockey live:', resp.length);
    res.json({ response: resp });
  } catch (e) {
    console.error('❌ hockey live error');
    res.status(500).json({ error: 'hockey live error', response: [] });
  }
});

// ---------------- MMA & BOXING ----------------
app.get('/api/mma/upcoming', async (req, res) => {
  try {
    const now = new Date();
    const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const from = now.toISOString().slice(0, 10);
    const to   = future.toISOString().slice(0, 10);

    const data = await apiSportsGet(
      'https://v1.mma.api-sports.io',
      '/fights',
      {
        from,
        to,
        timezone: 'Europe/Kiev'
      }
    );

    let all = [];
    if (Array.isArray(data.response)) {
      all = data.response;
    } else if (data.response && typeof data.response === 'object') {
      Object.values(data.response).forEach(v => {
        if (Array.isArray(v)) all.push(...v);
      });
    }

    const nowDate = new Date();
    const upcoming = all.filter(f => {
      const dateStr = f.date || f.datetime || f.scheduled_at || f.start_date;
      if (!dateStr) return true;
      const fightDate = new Date(dateStr);
      return !Number.isNaN(fightDate.getTime()) && fightDate >= nowDate;
    });

    console.log(`✅ MMA upcoming total:`, upcoming.length);
    res.json({ response: upcoming });
  } catch (e) {
    console.error('❌ MMA upcoming error');
    res.status(500).json({ error: 'MMA upcoming error', response: [] });
  }
});

app.get('/api/mma/live', async (req, res) => {
  try {
    const data = await apiSportsGet(
      'https://v1.mma.api-sports.io',
      '/fights',
      {
        live: 'all',
        timezone: 'Europe/Kiev'
      }
    );

    const respRaw = Array.isArray(data.response) ? data.response : [];
    const live = respRaw.filter(f => {
      const s = (f.status?.long || f.status?.short || f.status || '').toString().toLowerCase();
      return s.includes('live') || s.includes('in progress');
    });

    console.log('✅ MMA live:', live.length);
    res.json({ response: live.length ? live : respRaw });
  } catch (e) {
    console.error('❌ MMA live error');
    res.status(500).json({ error: 'MMA live error', response: [] });
  }
});

app.get('/api/boxing/upcoming', async (req, res) => {
  try {
    const now = new Date();
    const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const from = now.toISOString().slice(0, 10);
    const to   = future.toISOString().slice(0, 10);

    const data = await apiSportsGet(
      'https://v1.mma.api-sports.io',
      '/fights',
      {
        from,
        to,
        timezone: 'Europe/Kiev'
      }
    );

    let all = [];
    if (Array.isArray(data.response)) {
      all = data.response;
    } else if (data.response && typeof data.response === 'object') {
      Object.values(data.response).forEach(v => {
        if (Array.isArray(v)) all.push(...v);
      });
    }

    const nowDate = new Date();
    const upcoming = all.filter(f => {
      const dateStr = f.date || f.datetime || f.scheduled_at || f.start_date;
      if (!dateStr) return true;
      const fightDate = new Date(dateStr);
      return !Number.isNaN(fightDate.getTime()) && fightDate >= nowDate;
    });

    console.log(`✅ Boxing upcoming total:`, upcoming.length);
    res.json({ response: upcoming });
  } catch (e) {
    console.error('❌ Boxing upcoming error');
    res.status(500).json({ error: 'Boxing upcoming error', response: [] });
  }
});

app.get('/api/boxing/live', async (req, res) => {
  try {
    const data = await apiSportsGet(
      'https://v1.mma.api-sports.io',
      '/fights',
      {
        live: 'all',
        timezone: 'Europe/Kiev'
      }
    );

    const respRaw = Array.isArray(data.response) ? data.response : [];
    const live = respRaw.filter(f => {
      const s = (f.status?.long || f.status?.short || f.status || '').toString().toLowerCase();
      return s.includes('live') || s.includes('in progress');
    });

    console.log('✅ Boxing live:', live.length);
    res.json({ response: live.length ? live : respRaw });
  } catch (e) {
    console.error('❌ Boxing live error');
    res.status(500).json({ error: 'Boxing live error', response: [] });
  }
});

// ---------------- FORMULA 1 ----------------
app.get('/api/formula1/upcoming', async (req, res) => {
  try {
    const now = new Date();
    const future = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
    const from = now.toISOString().slice(0, 10);
    const to   = future.toISOString().slice(0, 10);

    let data = await apiSportsGet(
      'https://v1.formula-1.api-sports.io',
      '/races',
      {
        from,
        to,
        timezone: 'Europe/Kiev'
      }
    );

    let all = [];
    if (Array.isArray(data.response)) {
      all = data.response;
    }

    console.log('✅ Formula 1 races total (raw):', all.length);

    if (all.length === 0) {
      const currentYear = now.getFullYear();
      const seasons = [currentYear - 1, currentYear, currentYear + 1];

      for (const season of seasons) {
        try {
          const seasonData = await apiSportsGet(
            'https://v1.formula-1.api-sports.io',
            '/races',
            {
              season,
              timezone: 'Europe/Kiev'
            }
          );

          if (Array.isArray(seasonData.response)) {
            all.push(...seasonData.response);
          }
        } catch (e) {
          console.error('⚠️ Formula 1 season error', season);
        }
      }
    }

    const nowDate = new Date();
    const upcoming = all.filter(r => {
      const dateStr = r.date || r.datetime || r.dateTime || r.event_date;
      if (!dateStr) return false;
      const raceDate = new Date(dateStr);
      return !Number.isNaN(raceDate.getTime()) && raceDate >= nowDate;
    });

    console.log('✅ Formula 1 upcoming:', upcoming.length);
    const toSend = upcoming.length ? upcoming : all.slice(-10);
    res.json({ response: toSend });
  } catch (e) {
    console.error('❌ Formula 1 upcoming error');
    res.status(500).json({ error: 'Formula 1 upcoming error', response: [] });
  }
});

app.get('/api/formula1/live', async (req, res) => {
  try {
    const data = await apiSportsGet(
      'https://v1.formula-1.api-sports.io',
      '/races',
      {
        live: 'all',
        timezone: 'Europe/Kiev'
      }
    );

    const respRaw = Array.isArray(data.response) ? data.response : [];
    const live = respRaw.filter(r => {
      const s = (r.status?.long || r.status?.short || '').toString().toLowerCase();
      return s.includes('live') || s.includes('running');
    });

    console.log('✅ Formula 1 live:', live.length);
    res.json({ response: live.length ? live : respRaw });
  } catch (e) {
    console.error('❌ Formula 1 live error');
    res.status(500).json({ error: 'Formula 1 live error', response: [] });
  }
});

// ---------------- CS2 ----------------
app.get('/api/cs2/upcoming', async (req, res) => {
  try {
    const data = await pandaGet('/csgo/matches/upcoming', {
      per_page: 40,
      sort: 'begin_at'
    });

    console.log('✅ CS2 upcoming:', Array.isArray(data) ? data.length : 0);
    res.json({ response: Array.isArray(data) ? data : [] });
  } catch (e) {
    console.error('❌ CS2 upcoming error');
    res.status(500).json({ error: 'CS2 upcoming error', response: [] });
  }
});

app.get('/api/cs2/live', async (req, res) => {
  try {
    const data = await pandaGet('/csgo/matches/running', {
      per_page: 20,
      sort: 'begin_at'
    });

    console.log('✅ CS2 live:', Array.isArray(data) ? data.length : 0);
    res.json({ response: Array.isArray(data) ? data : [] });
  } catch (e) {
    console.error('❌ CS2 live error');
    res.status(500).json({ error: 'CS2 live error', response: [] });
  }
});

// ========= СТАВКИ =========

// POST /api/bets/place
// body: { userId, sport, eventId, market, selection, odds, stake, extraEventInfo? }
app.post('/api/bets/place', async (req, res) => {
  try {
    const {
      userId,
      sport,
      eventId,
      market,
      selection,
      odds,
      stake,
      extraEventInfo
    } = req.body;

    if (!userId || !sport || !eventId || !selection || !odds || !stake) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const stakeNum = Number(stake);
    const oddsNum  = Number(odds);

    if (Number.isNaN(stakeNum) || stakeNum <= 0) {
      return res.status(400).json({ error: 'Invalid stake' });
    }
    if (Number.isNaN(oddsNum) || oddsNum <= 1) {
      return res.status(400).json({ error: 'Invalid odds' });
    }

    const userRef = db.collection('users').doc(userId);
    const betsRef = db.collection('bets');

    // 💰 ТРАНЗАКЦІЯ: перевіряємо баланс → мінусуємо ставку → створюємо bet
    const result = await db.runTransaction(async (t) => {
      const userSnap = await t.get(userRef);

      if (!userSnap.exists) {
        throw new Error('User not found');
      }

      const userData = userSnap.data() || {};
      const balance  = Number(userData.balance ?? userData.coins ?? 0);

      if (balance < stakeNum) {
        throw new Error('Not enough balance');
      }

      const newBalance   = balance - stakeNum;
      const potentialWin = stakeNum * oddsNum;

      const betDocRef = betsRef.doc();

      // оновлюємо баланс
      t.update(userRef, {
        balance: newBalance,
        coins:   newBalance
      });

      // створюємо ставку
      t.set(betDocRef, {
        userId,
        sport,
        eventId,
        market:       market || 'winner',
        selection,                    // 'home', 'away', 'draw' тощо
        odds:         oddsNum,
        stake:        stakeNum,
        potentialWin: potentialWin,
        status:       'pending',      // поки матч не закінчений
        createdAt:    admin.firestore.FieldValue.serverTimestamp(),
        extraEventInfo: extraEventInfo || null
      });

      return { betId: betDocRef.id, newBalance, potentialWin };
    });

    console.log('✅ Bet placed:', result);

    res.json({
      ok: true,
      betId: result.betId,
      newBalance: result.newBalance,
      potentialWin: result.potentialWin
    });
  } catch (err) {
    console.error('❌ place bet error:', err.message);

    if (err.message === 'User not found' || err.message === 'Not enough balance') {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: 'place bet server error' });
  }
});

// GET /api/bets/my?userId=XXXX&status=pending|won|lost (status необов'язковий)
app.get('/api/bets/my', async (req, res) => {
  try {
    const { userId, status } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    let q = db.collection('bets')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(100);

    if (status) {
      q = q.where('status', '==', status);
    }

    const snap = await q.get();

    const bets = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    res.json({ ok: true, bets });
  } catch (err) {
    console.error('❌ get user bets error:', err.message);
    res.status(500).json({ error: 'get user bets server error', bets: [] });
  }
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => {
  console.log(`✅ API proxy server запущено на http://localhost:${PORT}`);
  console.log('📡 Доступні спортивні API:');
  console.log('   - Football, Basketball, Volleyball, Hockey');
  console.log('   - MMA/UFC/Boxing, Formula 1, CS2');
});
