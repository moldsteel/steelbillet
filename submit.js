// /api/submit.js — Vercel serverless function (Node.js runtime)
// Nhận dữ liệu từ Mini App, xác thực chữ ký Telegram, forward vào nhóm sale
// và gửi tin nhắn xác nhận lại cho khách qua chatbot.

const crypto = require('crypto');

const BOT_TOKEN = process.env.BOT_TOKEN;
const SALES_CHAT_ID = process.env.SALES_CHAT_ID; // id nhóm/kênh nhận yêu cầu báo giá

// Xác thực initData theo tài liệu chính thức của Telegram:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
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

  return { valid: computedHash === hash, params };
}

async function sendTelegramMessage(chatId, text, options = {}) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...options,
    }),
  });
  return res.json();
}

function formatDims(dims) {
  const { h, w, l } = dims || {};
  if (!h && !w && !l) return '—';
  return `${h || '?'} × ${w || '?'} × ${l || '?'} mm`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const body = req.body;
    const { valid } = verifyInitData(body.initData, BOT_TOKEN);

    // Trong môi trường test cục bộ (ngoài Telegram) initData sẽ rỗng — cho phép
    // qua nhưng đánh dấu rõ trong tin nhắn để sale biết nguồn không xác thực.
    const verifiedTag = valid ? '' : ' ⚠️ (chưa xác thực Telegram)';

    const userLine = body.user
      ? `Telegram: @${body.user.username || '—'} (id ${body.user.id})`
      : 'Telegram: —';

    const svcLine = (body.services && body.services.length)
      ? body.services.join(', ')
      : '—';

    const message =
      `<b>📋 YÊU CẦU BÁO GIÁ MỚI${verifiedTag}</b>\n` +
      `Mã phiếu: <b>${body.ticket}</b>\n\n` +
      `👤 <b>${escapeHtml(body.name)}</b>\n` +
      `📞 ${escapeHtml(body.phone)}\n` +
      (body.company ? `🏢 ${escapeHtml(body.company)}\n` : '') +
      `${userLine}\n\n` +
      `🔩 Mác thép: <b>${escapeHtml(body.grade)}</b>\n` +
      `📐 Kích thước: ${formatDims(body.dims)}\n` +
      `📦 Số lượng: ${escapeHtml(body.qty || '—')} ${escapeHtml(body.unit || '')}\n` +
      `🛠 Gia công thêm: ${escapeHtml(svcLine)}\n` +
      (body.note ? `📝 Ghi chú: ${escapeHtml(body.note)}\n` : '');

    if (!BOT_TOKEN || !SALES_CHAT_ID) {
      console.error('Thiếu BOT_TOKEN hoặc SALES_CHAT_ID trong biến môi trường');
      return res.status(500).json({ error: 'server not configured' });
    }

    await sendTelegramMessage(SALES_CHAT_ID, message);

    // Gửi xác nhận lại cho khách nếu có user id (chỉ hoạt động nếu khách đã /start bot)
    if (body.user && body.user.id) {
      await sendTelegramMessage(
        body.user.id,
        `Cảm ơn ${escapeHtml(body.name)}! ATP Steel đã nhận yêu cầu báo giá <b>${body.ticket}</b> ` +
        `(${escapeHtml(body.grade)}). Nhân viên kinh doanh sẽ liên hệ anh/chị sớm nhất qua số ${escapeHtml(body.phone)}.`
      );
    }

    return res.status(200).json({ ok: true, ticket: body.ticket });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
