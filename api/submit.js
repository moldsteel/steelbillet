// /api/submit.js — Vercel serverless function (Node.js runtime)
// Nhận dữ liệu từ quote.html (đa mác thép, mỗi mác nhiều kích thước Tấm/Tròn),
// xác thực chữ ký Telegram, forward vào nhóm sale và xác nhận lại cho khách.

const crypto = require('crypto');

const BOT_TOKEN = process.env.BOT_TOKEN;
const SALES_CHAT_ID = process.env.SALES_CHAT_ID;

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
  const json = await res.json();
  if (!json.ok) throw new Error('Telegram API: ' + (json.description || res.status));
  return json;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatItemLine(item) {
  const qty = escapeHtml(item.qty || '—');
  const unit = escapeHtml(item.unit || '');
  if (item.shape === 'tron') {
    const dia = item.dia || '?';
    const length = item.length || '?';
    return `Ø${escapeHtml(dia)} × ${escapeHtml(length)} mm — SL: ${qty} ${unit}`;
  }
  const h = item.h || '?', w = item.w || '?', l = item.l || '?';
  return `${escapeHtml(h)} × ${escapeHtml(w)} × ${escapeHtml(l)} mm — SL: ${qty} ${unit}`;
}

function formatGradesBlock(grades) {
  if (!Array.isArray(grades) || !grades.length) return '(không có dữ liệu mác thép)';
  return grades.map((g, i) => {
    const gradeName = escapeHtml(g.grade || '—');
    const items = Array.isArray(g.items) ? g.items : [];
    const itemLines = items.length
      ? items.map(it => `   • ${formatItemLine(it)}`).join('\n')
      : '   • (chưa nhập kích thước)';
    return `<b>${i + 1}. ${gradeName}</b>\n${itemLines}`;
  }).join('\n\n');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const body = req.body;
    const { valid } = verifyInitData(body.initData, BOT_TOKEN);
    const verifiedTag = valid ? '' : ' ⚠️ (chưa xác thực Telegram)';

    const userLine = body.user
      ? `Telegram: @${body.user.username || '—'} (id ${body.user.id})`
      : 'Telegram: —';

    const svcLine = (body.services && body.services.length)
      ? body.services.join(', ')
      : '—';

    const weightLine = (typeof body.totalWeightKg === 'number' && body.totalWeightKg > 0)
      ? `<b>${body.totalWeightKg.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg</b>`
      : '(chưa xác định)';

    const message =
      `<b>📋 YÊU CẦU BÁO GIÁ MỚI${verifiedTag}</b>\n` +
      `Mã phiếu: <b>${escapeHtml(body.ticket)}</b>\n\n` +
      `👤 <b>${escapeHtml(body.name)}</b>\n` +
      `📞 ${escapeHtml(body.phone)}\n` +
      (body.company ? `🏢 ${escapeHtml(body.company)}\n` : '') +
      (body.address ? `📍 ${escapeHtml(body.address)}\n` : '') +
      `${userLine}\n\n` +
      `🔩 <b>Mác thép & kích thước:</b>\n` +
      `${formatGradesBlock(body.grades)}\n\n` +
      `⚖️ Tổng khối lượng ước tính: ${weightLine}\n` +
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
        `Cảm ơn ${escapeHtml(body.name)}! An Thái Phú Steel đã nhận yêu cầu báo giá <b>${escapeHtml(body.ticket)}</b>. ` +
        `Nhân viên kinh doanh sẽ liên hệ anh/chị sớm nhất qua số ${escapeHtml(body.phone)}.`
      );
    }

    return res.status(200).json({ ok: true, ticket: body.ticket });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'internal error' });
  }
};
