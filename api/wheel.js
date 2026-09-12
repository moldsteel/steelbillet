// /api/wheel.js — Vercel serverless function
// Proxy giữa Mini App và Google Apps Script Web App. Giấu SHEET_SECRET khỏi
// client (client không bao giờ thấy secret, chỉ gọi domain của chính mình).

const SHEET_WEBAPP_URL = process.env.SHEET_WEBAPP_URL; // URL Web App từ bước deploy Apps Script
const SHEET_SECRET = process.env.SHEET_SECRET;          // phải khớp SHARED_SECRET trong Code.gs

module.exports = async (req, res) => {
  if (!SHEET_WEBAPP_URL || !SHEET_SECRET) {
    return res.status(500).json({ error: 'server not configured' });
  }

  try {
    if (req.method === 'GET') {
      const url = `${SHEET_WEBAPP_URL}?action=config&secret=${encodeURIComponent(SHEET_SECRET)}`;
      const r = await fetch(url);
      const json = await r.json();
      // Không trả codePrefix ra ngoài — client chỉ cần label để vẽ bánh xe.
      if (json.prizes) {
        json.prizes = json.prizes.map(p => ({ label: p.label, weight: p.weight }));
      }
      return res.status(200).json(json);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const phone = (body.phone || '').trim();
      if (!phone) return res.status(400).json({ error: 'missing phone' });

      const r = await fetch(SHEET_WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: SHEET_SECRET,
          action: 'spin',
          phone,
          name: body.name || '',
          telegramUser: body.telegramUser || '',
        }),
      });
      const json = await r.json();
      return res.status(200).json(json);
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'internal error' });
  }
};
