export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const API_BASE = 'https://poso.see.tg/api';

  const TGAUTH = process.env.TGAUTH;
  const APP_TOKEN = process.env.APP_TOKEN;
  const BOT_TOKEN = process.env.BOT_TOKEN;

  try {
    let { path, ...params } = req.query;

    // фикс массива
    if (Array.isArray(path)) {
      path = path.join('/');
    }

    if (!path) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }

    // 🔔 notify
    if (path === 'notify') {
      if (!BOT_TOKEN) {
        return res.status(500).json({ error: 'BOT_TOKEN not configured' });
      }

      const { chat_id, text } = params;

      if (!chat_id || !text) {
        return res.status(400).json({ error: 'Missing chat_id or text' });
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' })
      });

      return res.status(tgRes.status).send(await tgRes.text());
    }

    // 🌐 proxy
    const url = new URL(`${API_BASE}/${path.replace(/^\/+/, '')}`);

    if (TGAUTH) url.searchParams.set('tgauth', TGAUTH);
    if (APP_TOKEN) url.searchParams.set('app_token', APP_TOKEN);

    Object.entries(params).forEach(([k, v]) => {
      if (k !== 'path') url.searchParams.set(k, v);
    });

    const options = {
      method: req.method,
      headers: {
        'Accept': 'application/json'
      }
    };

    // безопасный body
    if (req.method === 'POST') {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(req.body || {});
    }

    // ✅ ВАЖНО: передаём options
    const response = await fetch(url.toString(), options);

    const text = await response.text();

    return res.status(response.status).send(text);

  } catch (err) {
    console.error('ERROR:', err);
    return res.status(500).json({
      error: err.message
    });
  }
}
