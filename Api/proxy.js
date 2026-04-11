module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_BASE = 'https://poso.see.tg/api';
  
  // Auth credentials
  const TGAUTH = process.env.TGAUTH || '{"id":7905043240,"first_name":".","username":"kdsjaklals","auth_date":1775821124,"hash":"849f8db7d207d6abafb82c61536bb7c0cbe4f5373d9d58ebfa8111c6fd3f481a"}';
  const APP_TOKEN = process.env.APP_TOKEN || '7f79ebca-ebc5-48b6-b39b-f5b5fa05d6d5:4b8c3876718f8f0aae26028bb35c2ee36c746e950d05c0bd4c1fb8e42c13f234';
  const BOT_TOKEN = process.env.BOT_TOKEN || '';

  try {
    const { path, ...params } = req.query;
    if (!path) return res.status(400).json({ error: 'Missing path parameter' });

    // Special path: send bot notification
    if (path === 'notify') {
      if (!BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN not configured' });
      const { chat_id, text } = params;
      if (!chat_id || !text) return res.status(400).json({ error: 'Missing chat_id or text' });
      
      const botUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      const botRes = await fetch(botUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat_id,
          text: text,
          parse_mode: 'HTML'
        })
      });
      const botData = await botRes.text();
      res.status(botRes.status);
      res.setHeader('Content-Type', 'application/json');
      return res.send(botData);
    }

    // Normal see.tg API proxy
    const url = new URL(API_BASE + '/' + path.replace(/^\//, ''));
    url.searchParams.set('tgauth', TGAUTH);
    url.searchParams.set('app_token', APP_TOKEN);
    
    Object.entries(params).forEach(([k, v]) => {
      if (k !== 'path') url.searchParams.set(k, v);
    });

    const opts = {
      method: req.method,
      headers: { 'Accept': 'application/json' }
    };
    
    if (req.method === 'POST' && req.body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(req.body);
    }

    const response = await fetch(url.toString(), opts);
    const data = await response.text();

    res.status(response.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
