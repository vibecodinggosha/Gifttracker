const http = require('http');
const fs = require('fs');
const path = require('path');

// ===== CONFIG =====
const API_BASE = 'https://poso.see.tg/api';
const TGAUTH = '{"id":7905043240,"first_name":".","username":"kdsjaklals","auth_date":1775821124,"hash":"849f8db7d207d6abafb82c61536bb7c0cbe4f5373d9d58ebfa8111c6fd3f481a"}';
const APP_TOKEN = '7f79ebca-ebc5-48b6-b39b-f5b5fa05d6d5:4b8c3876718f8f0aae26028bb35c2ee36c746e950d05c0bd4c1fb8e42c13f234';
const BOT_TOKEN = '8313071168:AAF4OeWMR-O_tYS8qWrRUGl1-j2x0Cz4Ips';

const PORT = 3000;
const POLL_INTERVAL = 5000;

const GIFTS = {
  '5782984811920491178': 'B-day Candle',
  '6028426950047957932': 'Lunar Snake',
  '5983484377902875708': 'Ginger Cookie',
  '5983259145522906006': 'Winter Wreath',
  '5980789805615678057': 'Snow Mittens',
  '5933590374185435592': 'Jester Hat',
  '5913442287462908725': 'Spiced Wine',
  '5915502858152706668': 'Jelly Bunny',
  '5825801628657124140': 'Hex Pot',
  '5825480571261813595': 'Evil Eye',
  '5170594532177215681': 'Lol Pop',
  '5783075783622787539': 'Homemade Cake',
  '5167939598143193218': 'Sakura Flower'
};
const GIFT_IDS = new Set(Object.keys(GIFTS));

// ===== DATA =====
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadJSON(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } }
function saveJSON(f, d) { try { fs.writeFileSync(f, JSON.stringify(d)); } catch(e) {} }

let accounts = loadJSON(path.join(DATA_DIR, 'accounts.json'), []);
let seenIds = new Set(loadJSON(path.join(DATA_DIR, 'seen_ids.json'), []));
let transfers = loadJSON(path.join(DATA_DIR, 'transfers.json'), {});
let notifyUsers = loadJSON(path.join(DATA_DIR, 'notify_users.json'), []);

function saveAll() {
  saveJSON(path.join(DATA_DIR, 'accounts.json'), accounts);
  saveJSON(path.join(DATA_DIR, 'seen_ids.json'), [...seenIds]);
  saveJSON(path.join(DATA_DIR, 'transfers.json'), transfers);
  saveJSON(path.join(DATA_DIR, 'notify_users.json'), notifyUsers);
}

// ===== SEE.TG API =====
async function seeApi(endpoint, params = {}) {
  const url = new URL(API_BASE + '/' + endpoint);
  url.searchParams.set('tgauth', TGAUTH);
  url.searchParams.set('app_token', APP_TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ===== BOT =====
async function sendBot(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
  } catch (e) {}
}
async function notifyAll(text) { for (const id of notifyUsers) await sendBot(id, text); }

// Bot: only /start
let lastUpdateId = 0;
async function checkBot() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=0`);
    const data = await res.json();
    if (!data.ok) return;
    for (const upd of data.result || []) {
      lastUpdateId = upd.update_id;
      const msg = upd.message;
      if (msg?.text === '/start') {
        if (!notifyUsers.includes(msg.chat.id)) { notifyUsers.push(msg.chat.id); saveAll(); }
        await sendBot(msg.chat.id, '🎁 <b>Gift Tracker</b>\n\n🔔 Подписка на уведомления активна!\nУправление через Mini App.');
      }
    }
  } catch (e) {}
}

// ===== POLLING =====
let pollCount = 0;

async function poll() {
  pollCount++;
  const unames = accounts.map(a => a.username.toLowerCase());
  if (!unames.length) return;

  let n = 0;
  let totalChecked = 0;
  let foundOld = false;

  for (let page = 0; page < 50 && !foundOld; page++) {
    try {
      const data = await seeApi('history', { limit: '10', offset: String(page * 10) });
      const items = data.history || [];
      if (!items.length) break;
      totalChecked += items.length;

      let allSeen = true;
      for (const item of items) {
        const gift = item.gift || {};
        const gid = gift.id;
        const giftId = String(gift.gift_id || '');

        if (!gid) continue;

        if (seenIds.has(gid)) {
          continue;
        }

        allSeen = false;
        seenIds.add(gid);

        if (!GIFT_IDS.has(giftId)) continue;

        const owner = ((item.owner || {}).username || '').toLowerCase();
        const prev = (item.prev_owner || {}).username || '';

        if (unames.includes(owner)) {
          n++;
          if (!transfers[owner]) transfers[owner] = [];
          transfers[owner].unshift(item);
          if (transfers[owner].length > 200) transfers[owner] = transfers[owner].slice(0, 200);
          const gName = GIFTS[giftId] || gift.title || '?';
          console.log(`🔥 ${gName} #${gift.num||''} → @${owner} от @${prev||'?'}`);
          await notifyAll(`🔥 <b>Потенциальный Крафт???</b>\n\n🎁 <b>${gName} #${gift.num||''}</b>\n👤 Получил: @${(item.owner||{}).username||owner}\n📤 От: ${prev?'@'+prev:'?'}\n\n<b>Зайди в бота и проверь</b>`);
        }
      }

      if (allSeen) foundOld = true;

    } catch (e) { break; }
  }

  if (n > 0) saveAll();
  if (pollCount % 10 === 0) saveAll();
  if (pollCount % 60 === 0) console.log(`[${new Date().toLocaleTimeString()}] Poll #${pollCount} | Accs:${accounts.length} Seen:${seenIds.size} Checked:${totalChecked}`);
}

// ===== HTTP API =====
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const json = d => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(d)); };

  try {
    if (p === '/accounts' && req.method === 'GET') return json({ accounts });

    if (p === '/accounts' && req.method === 'POST') {
      const u = (url.searchParams.get('username') || '').replace(/^@/, '');
      if (!u) return json({ error: 'no username' });
      if (accounts.find(a => a.username.toLowerCase() === u.toLowerCase())) return json({ error: 'already_exists' });
      try {
        const d = await seeApi('owner', { username: u });
        const un = d.username || u, oid = d.id || '';
        if (oid && accounts.find(a => a.ownerId === oid)) return json({ error: 'already_exists_id' });
        accounts.push({ username: un, ownerId: oid, name: d.name || un });
        transfers[un.toLowerCase()] = [];
        saveAll();
        return json({ ok: true, username: un, name: d.name || un, ownerId: oid });
      } catch (e) {
        console.error(`[add @${u}] seeApi error: ${e.message}`);
        // If API returned 404 — user genuinely doesn't exist
        if (e.message === 'API 404') return json({ error: 'not_found' });
        // Auth expired or API down — add user anyway without see.tg validation
        accounts.push({ username: u, ownerId: '', name: u });
        transfers[u.toLowerCase()] = [];
        saveAll();
        return json({ ok: true, username: u, name: u, ownerId: '' });
      }
    }

    if (p === '/accounts' && req.method === 'DELETE') {
      const u = (url.searchParams.get('username') || '').replace(/^@/, '');
      accounts = accounts.filter(a => a.username.toLowerCase() !== u.toLowerCase());
      delete transfers[u.toLowerCase()];
      saveAll();
      return json({ ok: true });
    }

    if (p === '/transfers') {
      const u = url.searchParams.get('username');
      if (u) return json({ transfers: transfers[u.toLowerCase()] || [] });
      return json({ transfers });
    }

    if (p === '/status') return json({ accounts: accounts.length, gifts: GIFT_IDS.size, seen: seenIds.size, subs: notifyUsers.length, uptime: Math.floor(process.uptime()/60), polls: pollCount });

    if (p === '/api/proxy') {
      const apiPath = url.searchParams.get('path');
      if (!apiPath) return json({ error: 'no path' });
      const params = {};
      url.searchParams.forEach((v, k) => { if (k !== 'path') params[k] = v; });
      const d = await seeApi(apiPath, params);
      return json(d);
    }

    res.writeHead(404); res.end('Not found');
  } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('=============================');
  console.log('  🎁 Gift Tracker Server');
  console.log(`  Port: ${PORT}`);
  console.log('=============================');
  console.log(`Accounts: ${accounts.length}`);
  console.log(`Seen: ${seenIds.size} | Subs: ${notifyUsers.length}`);
  console.log('Polling every 5s...');
  console.log('Strategy: scan global history until caught up\n');
});

// Cap seenIds at 50K to prevent memory issues
setInterval(() => {
  if (seenIds.size > 50000) {
    const arr = [...seenIds];
    seenIds = new Set(arr.slice(-30000));
    saveAll();
    console.log('Trimmed seenIds to 30K');
  }
}, 60000);

setInterval(poll, POLL_INTERVAL);
setInterval(checkBot, 3000);
poll(); checkBot();
