const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE = 'https://poso.see.tg/api';
const TGAUTH = '{"id":7905043240,"first_name":".","username":"kdsjaklals","auth_date":1775820871,"hash":"087a1dd3ab8af979f89d7fa3f0a8d9f3df90d429463c473568ff822644176139"}';
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

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadJSON(f, d) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; }
}
function saveJSON(f, d) {
  try { fs.writeFileSync(f, JSON.stringify(d)); } catch (e) { }
}

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

async function seeApi(endpoint, params) {
  if (!params) params = {};
  var url = new URL(API_BASE + '/' + endpoint);
  url.searchParams.set('tgauth', TGAUTH);
  url.searchParams.set('app_token', APP_TOKEN);
  var keys = Object.keys(params);
  for (var i = 0; i < keys.length; i++) {
    url.searchParams.set(keys[i], params[keys[i]]);
  }
  var res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}

async function sendBot(chatId, text) {
  try {
    await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' })
    });
  } catch (e) { }
}

async function notifyAll(text) {
  for (var i = 0; i < notifyUsers.length; i++) {
    await sendBot(notifyUsers[i], text);
  }
}

var lastUpdateId = 0;
async function checkBot() {
  try {
    var res = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/getUpdates?offset=' + (lastUpdateId + 1) + '&timeout=0');
    var data = await res.json();
    if (!data.ok) return;
    var results = data.result || [];
    for (var i = 0; i < results.length; i++) {
      lastUpdateId = results[i].update_id;
      var msg = results[i].message;
      if (msg && msg.text === '/start') {
        if (notifyUsers.indexOf(msg.chat.id) === -1) {
          notifyUsers.push(msg.chat.id);
          saveAll();
        }
        await sendBot(msg.chat.id, '🎁 <b>Gift Tracker</b>\n\n🔔 Подписка на уведомления активна!\nУправление через Mini App.');
      }
    }
  } catch (e) { }
}

var pollCount = 0;

async function poll() {
  pollCount++;
  var unames = accounts.map(function(a) { return a.username.toLowerCase(); });
  if (unames.length === 0) return;

  var n = 0;
  var totalChecked = 0;
  var foundOld = false;

  for (var page = 0; page < 50 && !foundOld; page++) {
    try {
      var data = await seeApi('history', { limit: '10', offset: String(page * 10) });
      var items = data.history || [];
      if (items.length === 0) break;
      totalChecked += items.length;

      var allSeen = true;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var gift = item.gift || {};
        var gid = gift.id;
        var giftId = String(gift.gift_id || '');

        if (!gid) continue;
        if (seenIds.has(gid)) continue;

        allSeen = false;
        seenIds.add(gid);

        if (!GIFT_IDS.has(giftId)) continue;

        var owner = ((item.owner || {}).username || '').toLowerCase();
        var prev = (item.prev_owner || {}).username || '';

        if (unames.indexOf(owner) !== -1) {
          n++;
          if (!transfers[owner]) transfers[owner] = [];
          transfers[owner].unshift(item);
          if (transfers[owner].length > 200) transfers[owner] = transfers[owner].slice(0, 200);
          var gName = GIFTS[giftId] || gift.title || '?';
          console.log('🔥 ' + gName + ' #' + (gift.num || '') + ' -> @' + owner + ' from @' + (prev || '?'));
          var msg = '🔥 <b>Потенциальный Крафт???</b>\n\n🎁 <b>' + gName + ' #' + (gift.num || '') + '</b>\n👤 Получил: @' + ((item.owner || {}).username || owner) + '\n📤 От: ' + (prev ? '@' + prev : '?') + '\n\n<b>Зайди в бота и проверь</b>';
          await notifyAll(msg);
        }
      }

      if (allSeen) foundOld = true;
    } catch (e) {
      console.log('Poll error: ' + e.message);
      break;
    }
  }

  if (n > 0) saveAll();
  if (pollCount % 10 === 0) saveAll();
  if (pollCount % 60 === 0) console.log('[' + new Date().toLocaleTimeString() + '] Poll #' + pollCount + ' | Accs:' + accounts.length + ' Seen:' + seenIds.size + ' Checked:' + totalChecked);
}

var server = http.createServer(async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  var url = new URL(req.url, 'http://localhost:' + PORT);
  var p = url.pathname;

  function json(d) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(d));
  }

  try {
    if (p === '/accounts' && req.method === 'GET') {
      return json({ accounts: accounts });
    }

    if (p === '/accounts' && req.method === 'POST') {
      var u = (url.searchParams.get('username') || '').replace(/^@/, '');
      if (!u || u.length < 2) return json({ error: 'no username' });
      for (var i = 0; i < accounts.length; i++) {
        if (accounts[i].username.toLowerCase() === u.toLowerCase()) return json({ error: 'already_exists' });
      }
      try {
        var d = await seeApi('owner', { username: u });
        var un = d.username || u;
        var oid = d.id || '';
        for (var j = 0; j < accounts.length; j++) {
          if (accounts[j].ownerId && accounts[j].ownerId === oid) return json({ error: 'already_exists_id' });
        }
        accounts.push({ username: un, ownerId: oid, name: d.name || un });
        transfers[un.toLowerCase()] = [];
        saveAll();
        return json({ ok: true, username: un, name: d.name || un, ownerId: oid });
      } catch (e) {
        return json({ error: 'not_found' });
      }
    }

    if (p === '/accounts' && req.method === 'DELETE') {
      var u2 = (url.searchParams.get('username') || '').replace(/^@/, '');
      accounts = accounts.filter(function(a) { return a.username.toLowerCase() !== u2.toLowerCase(); });
      delete transfers[u2.toLowerCase()];
      saveAll();
      return json({ ok: true });
    }

    if (p === '/transfers') {
      var tu = url.searchParams.get('username');
      if (tu) return json({ transfers: transfers[tu.toLowerCase()] || [] });
      return json({ transfers: transfers });
    }

    if (p === '/status') {
      return json({ accounts: accounts.length, gifts: GIFT_IDS.size, seen: seenIds.size, subs: notifyUsers.length, uptime: Math.floor(process.uptime() / 60), polls: pollCount });
    }

    if (p === '/api/proxy') {
      var apiPath = url.searchParams.get('path');
      if (!apiPath) return json({ error: 'no path' });
      var params = {};
      url.searchParams.forEach(function(v, k) { if (k !== 'path') params[k] = v; });
      var apiData = await seeApi(apiPath, params);
      return json(apiData);
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, '0.0.0.0', function() {
  console.log('=============================');
  console.log('  🎁 Gift Tracker Server');
  console.log('  Port: ' + PORT);
  console.log('=============================');
  console.log('Accounts: ' + accounts.length);
  console.log('Seen: ' + seenIds.size + ' | Subs: ' + notifyUsers.length);
  console.log('Polling every 5s...');
});

setInterval(function() {
  if (seenIds.size > 50000) {
    var arr = Array.from(seenIds);
    seenIds = new Set(arr.slice(-30000));
    saveAll();
    console.log('Trimmed seenIds to 30K');
  }
}, 60000);

setInterval(poll, POLL_INTERVAL);
setInterval(checkBot, 3000);
poll();
checkBot();
