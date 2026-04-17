var EC2 = 'http://16.171.238.233:3000';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var p = req.query.path || '';

    if (p === '_accounts') {
      var r = await fetch(EC2 + '/accounts');
      return res.status(r.status).send(await r.text());
    }

    if (p === '_accounts_add') {
      var u = req.query.username || '';
      var r2 = await fetch(EC2 + '/accounts?username=' + encodeURIComponent(u), { method: 'POST' });
      return res.status(r2.status).send(await r2.text());
    }

    if (p === '_accounts_delete') {
      var u2 = req.query.username || '';
      var r3 = await fetch(EC2 + '/accounts?username=' + encodeURIComponent(u2), { method: 'DELETE' });
      return res.status(r3.status).send(await r3.text());
    }

    if (p === '_transfers') {
      var u3 = req.query.username || '';
      var tUrl = u3 ? EC2 + '/transfers?username=' + encodeURIComponent(u3) : EC2 + '/transfers';
      var r4 = await fetch(tUrl);
      return res.status(r4.status).send(await r4.text());
    }

    if (p === '_status') {
      var r5 = await fetch(EC2 + '/status');
      return res.status(r5.status).send(await r5.text());
    }

    if (!p) return res.status(400).json({ error: 'Missing path' });

    var params = new URLSearchParams(req.query);
    var r6 = await fetch(EC2 + '/api/proxy?' + params.toString());
    var data = await r6.text();
    res.status(r6.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(data);

  } catch (error) {
    res.status(502).json({ error: 'Server unavailable: ' + error.message });
  }
};
