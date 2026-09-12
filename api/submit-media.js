// /api/submit-media.js — Vercel serverless function (Node.js 18+ runtime required
// for global fetch/FormData/Blob).
// Nhận ảnh hoặc tài liệu từ nút "Hỏi giá nhanh" trên Mini App (dạng base64 JSON),
// forward vào nhóm sale dưới dạng photo/document qua Telegram Bot API.

const crypto = require('crypto');

const BOT_TOKEN = process.env.BOT_TOKEN;
const SALES_CHAT_ID = process.env.SALES_CHAT_ID;
const SHEET_WEBAPP_URL = process.env.SHEET_WEBAPP_URL;
const SHEET_SECRET = process.env.SHEET_SECRET;

async function logToSheet(action, payload) {
  if (!SHEET_WEBAPP_URL || !SHEET_SECRET) return; // chưa cấu hình -> bỏ qua, không làm hỏng luồng chính
  try {
    await fetch(SHEET_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: SHEET_SECRET, action, ...payload }),
    });
  } catch (err) {
    console.error('logToSheet error (bỏ qua, không chặn luồng chính):', err.message);
  }
}

function verifyInitData(initData, botToken) {
  if (!initData) return { valid: false };
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { valid: false };
  params.delete('hash');

  const dataCheckArr = [];
  for (const [key, value] of [...params.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    dataCheckArr.push(`${key}=${value}`);
  }
  const dataCheckString = dataCheckArr.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return { valid: computedHash === hash };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendTelegramMessage(chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  return res.json();
}

async function sendTelegramMedia(chatId, buffer, fileName, mimeType, caption) {
  const isImage = mimeType.startsWith('image/');
  const method = isImage ? 'sendPhoto' : 'sendDocument';
  const field = isImage ? 'photo' : 'document';

  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  form.append(field, new Blob([buffer], { type: mimeType }), fileName);

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    body: form,
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error('Telegram API: ' + (json.description || res.status));
  }
  return json;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const body = req.body;
    const { ticket, phone, fileBase64, fileName, mimeType, initData, user } = body;

    if (!phone || !fileBase64) {
      return res.status(400).json({ error: 'missing phone or file' });
    }
    if (!BOT_TOKEN || !SALES_CHAT_ID) {
      console.error('Thiếu BOT_TOKEN hoặc SALES_CHAT_ID trong biến môi trường');
      return res.status(500).json({ error: 'server not configured' });
    }

    const { valid } = verifyInitData(initData, BOT_TOKEN);
    const verifiedTag = valid ? '' : ' ⚠️ (chưa xác thực Telegram)';
    const userLine = user ? `Telegram: @${user.username || '—'} (id ${user.id})` : 'Telegram: —';

    const caption =
      `<b>📷 HỎI GIÁ NHANH (ảnh/tài liệu)${verifiedTag}</b>\n` +
      `Mã: <b>${escapeHtml(ticket)}</b>\n` +
      `📞 ${escapeHtml(phone)}\n` +
      `${userLine}`;

    const buffer = Buffer.from(fileBase64, 'base64');
    await sendTelegramMedia(SALES_CHAT_ID, buffer, fileName || 'anh-hoi-gia', mimeType || 'application/octet-stream', caption);

    await logToSheet('log_media', {
      ticket, phone,
      telegramUser: user ? `@${user.username || ''} (${user.id})` : '',
    });
    
    if (user && user.id) {
      await sendTelegramMessage(
        user.id,
        `Cảm ơn anh/chị! ATP Steel đã nhận ảnh/tài liệu hỏi giá (<b>${escapeHtml(ticket)}</b>). ` +
        `Nhân viên kinh doanh sẽ liên hệ qua số ${escapeHtml(phone)} sớm nhất.`
      );
    }

    return res.status(200).json({ ok: true, ticket });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'internal error' });
  }
};
