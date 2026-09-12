// /api/webhook.js — Vercel serverless function (Node.js runtime)
// Nhận update từ Telegram (đặt làm webhook của bot).
// Xử lý /start bằng cách gửi nút mở Mini App.

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL; // ví dụ: https://atp-miniapp.vercel.app

async function callTelegram(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('ok');

  const update = req.body;
  const msg = update.message;

  if (msg && msg.text) {
    const chatId = msg.chat.id;

    if (msg.text.startsWith('/start')) {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text:
          'Xin chào! Đây là kênh yêu cầu báo giá thép khuôn mẫu & thép dụng cụ của ' +
          '<b>ATP Steel</b>.\n\nNhấn nút bên dưới để mở phiếu yêu cầu báo giá.',
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [[
            { text: '📋 Yêu cầu báo giá', web_app: { url: WEBAPP_URL } },
          ]],
          resize_keyboard: true,
        },
      });
    } else {
      // Tin nhắn văn bản thường — trả lời ngắn gọn, hướng khách vào Mini App
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: 'Cảm ơn anh/chị đã nhắn tin. Để gửi yêu cầu báo giá nhanh nhất, vui lòng nhấn nút "📋 Yêu cầu báo giá" bên dưới khung chat, hoặc gõ /start.',
      });
    }
  }

  return res.status(200).send('ok');
};
