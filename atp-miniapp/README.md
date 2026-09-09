# ATP Steel — Telegram Mini App (Yêu cầu báo giá)

## Cấu trúc
- `index.html` — trang chủ Mini App (landing: logo, danh mục mác thép, tra mác tương đương, liên hệ)
- `quote.html` — phiếu yêu cầu báo giá (nhận `?grade=` để tự chọn sẵn mác thép khi bấm từ trang chủ)
- `logo.png` — **anh tự thêm file logo thật vào đây**, cùng cấp với `index.html`. Sau khi thêm, mở `index.html`, tìm dòng `<span class="logo-fallback">ATP</span>` trong `.logo-box` và thay bằng `<img src="logo.png" alt="ATP Steel">`
- `api/submit.js` — nhận dữ liệu form, forward vào nhóm sale, xác nhận cho khách
- `api/webhook.js` — xử lý `/start`, gửi nút mở Mini App
- `vercel.json` — cấu hình deploy

## Bước 1 — Lấy chat_id của nhóm sale
1. Tạo (hoặc dùng) nhóm Telegram nội bộ cho sale nhận yêu cầu báo giá.
2. Thêm bot vào nhóm đó.
3. Gửi thử một tin nhắn bất kỳ trong nhóm, sau đó mở trình duyệt:
   `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates`
4. Tìm `"chat":{"id": -100xxxxxxxxxx, ...}` — đó là `SALES_CHAT_ID` (số âm nếu là nhóm).

## Bước 2 — Deploy lên Vercel
```bash
npm i -g vercel
cd atp-miniapp
vercel
```
Khi được hỏi, chọn tạo project mới. Sau khi deploy xong sẽ có URL dạng
`https://atp-miniapp.vercel.app`.

Vào **Vercel Dashboard → Project → Settings → Environment Variables**, thêm:
| Key | Value |
|---|---|
| `BOT_TOKEN` | token bot lấy từ BotFather |
| `SALES_CHAT_ID` | chat_id nhóm sale (bước 1) |
| `WEBAPP_URL` | URL Vercel vừa deploy (chính là domain gốc, Mini App là `index.html`) |

Sau khi thêm biến môi trường, chạy `vercel --prod` lại một lần để áp dụng.

## Bước 3 — Trỏ webhook về bot
Gọi (thay `<BOT_TOKEN>` và domain của bạn):
```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://atp-miniapp.vercel.app/api/webhook
```

## Bước 4 — Cấu hình BotFather
Trong chat với **@BotFather**:
1. `/mybots` → chọn bot → **Bot Settings → Menu Button** → **Configure menu button**
   → nhập URL: `https://atp-miniapp.vercel.app`
   → đặt tên nút, ví dụ: `Yêu cầu báo giá`
2. (Tuỳ chọn) `/setdescription`, `/setabouttext`, `/setuserpic` để hoàn thiện hồ sơ bot.

Sau bước này, khách nhắn `/start` với bot sẽ nhận được nút mở Mini App ngay trong khung chat, hoặc có thể mở qua **Menu Button** ở góc trái khung nhập tin nhắn.

## Luồng hoạt động
1. Khách mở Mini App từ bot → điền phiếu yêu cầu báo giá.
2. Mini App gọi `POST /api/submit` kèm dữ liệu form + `initData` (chữ ký Telegram).
3. Server xác thực chữ ký, gửi tin nhắn định dạng sẵn vào nhóm sale, đồng thời nhắn xác nhận lại cho khách.
4. Mini App hiển thị màn hình "Đã gửi yêu cầu" và tự đóng sau ~2 giây.

## Ghi chú bảo mật
- `submit.js` xác thực `initData` bằng HMAC-SHA256 theo đúng chuẩn Telegram — dữ liệu giả mạo từ bên ngoài Mini App sẽ bị gắn cờ "chưa xác thực" trong tin nhắn gửi vào nhóm sale (không bị chặn cứng, để tiện debug khi mới triển khai; có thể đổi thành chặn hẳn bằng cách trả `403` khi `!valid`).
- Không commit `BOT_TOKEN` vào Git — luôn dùng biến môi trường.
- Nếu muốn mở rộng: lưu yêu cầu vào Google Sheet / Airtable trước khi gửi Telegram để có lịch sử tra cứu.
