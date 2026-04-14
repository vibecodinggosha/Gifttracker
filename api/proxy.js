const EC2 = 'http://16.171.238.233:3000';
 
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
 
  try {
    const p = req.query.path || '';
 
    // Route to EC2 for account/transfer management
    if (p === '_accounts') {
      const r = await fetch(EC2 + '/accounts');
      return res.status(r.status).send(await r.text());
    }
 
    if (p === '_accounts_add') {
      const u = req.query.username || '';
      const r = await fetch(EC2 + '/accounts?username=' + encodeURIComponent(u), { method: 'POST' });
      return res.status(r.status).send(await r.text());
    }
 
    if (p === '_accounts_delete') {
      const u = req.query.username || '';
      const r = await fetch(EC2 + '/accounts?username=' + encodeURIComponent(u), { method: 'DELETE' });
      return res.status(r.status).send(await r.text());
    }
 
    if (p === '_transfers') {
      const u = req.query.username || '';
      const url = u ? EC2 + '/transfers?username=' + encodeURIComponent(u) : EC2 + '/transfers';
      const r = await fetch(url);
      return res.status(r.status).send(await r.text());
    }
 
    if (p === '_status') {
      const r = await fetch(EC2 + '/status');
      return res.status(r.status).send(await r.text());
    }
 
    // Everything else → forward to EC2's see.tg proxy
    if (!p) return res.status(400).json({ error: 'Missing path' });
 
    const params = new URLSearchParams(req.query);
    const r = await fetch(EC2 + '/api/proxy?' + params.toString());
    const data = await r.text();
    res.status(r.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
 
  } catch (error) {
    res.status(502).json({ error: 'Server unavailable: ' + error.message });
  }
}
