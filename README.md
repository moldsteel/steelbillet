# steelbillet
Báo giá &amp; phiếu Yêu cầu Gia công Phôi thép<br>
Rõ ràng rồi — vậy kiến trúc sẽ là: 1 Google Sheet làm "database", dùng chung cho cả lưu lịch sử yêu cầu và kiểm soát vòng quay (bật/tắt chiến dịch, danh sách phần thưởng, chống quay 2 lần). Việc bật/tắt và cấu hình phần thưởng anh chỉnh thẳng trong Sheet, không cần đụng code mỗi lần mở chiến dịch mới.

Em làm theo 6 phần, xong hết sẽ gửi 1 lượt:

Ran a command
Bước 1 — Tạo Google Sheet

Tạo 1 Google Sheet mới, đặt tên tuỳ ý (VD: "ATP MiniApp Database"), tạo đúng 3 tab sau:

Tab Config (điều khiển chiến dịch — anh chỉnh trực tiếp ở đây):

A1: WHEEL_ENABLED    B1: FALSE

A3: Label            B3: Weight    C3: CodePrefix
A4: Giảm 2%          B4: 40        C4: SALE2
A5: Giảm 5%          B5: 25        C5: SALE5
A6: Giảm 10%         B6: 10        C6: SALE10
A7: Miễn phí ship    B7: 15        C7: FREESHIP
A8: Chúc may mắn lần sau  B8: 10   C8: (để trống)

Weight là trọng số random (số càng lớn càng dễ trúng) — anh thêm/bớt/sửa dòng phần thưởng tuỳ ý, không cần đúng 5 dòng. Muốn mở chiến dịch → đổi B1 thành TRUE; muốn tắt → đổi lại FALSE.

Tab WheelEntries (lịch sử quay — Apps Script tự ghi, anh không cần nhập tay):

Timestamp | Phone | Name | Prize | Code | TelegramUser

Tab RequestHistory (lịch sử mọi yêu cầu báo giá — Apps Script tự ghi):

Timestamp | Type | Ticket | Name | Phone | Company | Address | Grades | TotalWeightKg | Services | Note | TelegramUser
Bước 2 — Gắn Apps Script vào Sheet

Trong Sheet vừa tạo: Extensions → Apps Script, xoá code mẫu, dán nguyên đoạn này:

Created a file, shared files

Sửa 2 dòng đầu file:

SHEET_ID: lấy từ URL Sheet (đoạn giữa /d/ và /edit)
SHARED_SECRET: tự đặt 1 chuỗi bất kỳ, ví dụ atp-9x7k2m-secret

Rồi Deploy → New deployment → chọn loại "Web app" → Execute as: Me → Who has access: Anyone → Deploy → copy Web app URL (dạng https://script.google.com/macros/s/xxx/exec) — URL này sẽ dùng ở bước 3.

Bước 3 — Backend Vercel mới: api/wheel.js
Ran 3 commands, created 2 files, edited a file · 2 notes
Bước 5 — Icon "Quay số" trên trang chủ (index.html)

Trong index.html, tìm khối .quick-actions (4 nút Hỏi giá/Gọi hotline/Zalo/Tra thông số), thêm 1 nút mới ẩn sẵn (chỉ hiện khi chiến dịch đang bật):

Ran 4 commands, edited a file, read a file · 2 notes

Trong api/submit.js — thêm đoạn trên vào đầu file (sau khai báo BOT_TOKEN/SALES_CHAT_ID), rồi tìm dòng await sendTelegramMessage(SALES_CHAT_ID, message); và thêm ngay bên dưới:

javascript
    await logToSheet('log_request', {
      ticket: body.ticket, name: body.name, phone: body.phone, company: body.company,
      address: body.address, grades: body.grades, totalWeightKg: body.totalWeightKg,
      services: body.services, note: body.note,
      telegramUser: body.user ? `@${body.user.username || ''} (${body.user.id})` : '',
    });

Trong api/submit-media.js — cùng đoạn code logToSheet ở đầu file, rồi tìm dòng await sendTelegramMedia(...) và thêm ngay bên dưới:

javascript
    await logToSheet('log_media', {
      ticket, phone,
      telegramUser: user ? `@${user.username || ''} (${user.id})` : '',
    });
Tổng kết — 3 biến môi trường mới cần thêm trên Vercel

Vào Settings → Environment Variables, thêm (giống hệt bước làm với BOT_TOKEN trước đây):

Key	Value	Type
SHEET_WEBAPP_URL	URL Web App lấy ở Bước 2	Config
SHEET_SECRET	Đúng chuỗi đã đặt trong SHARED_SECRET ở Code.gs	Secret

Nhớ Redeploy sau khi thêm.

Presented 4 files

Cách vận hành khi chạy chiến dịch thực tế:

Mở chiến dịch: đổi Config!B1 → TRUE, chỉnh danh sách phần thưởng nếu cần → icon "🎡 Quay số" tự hiện trên trang chủ (không cần deploy lại code)
Khách quay → mỗi SĐT chỉ được 1 lần, mã lưu vào tab WheelEntries
Kết thúc/tạm dừng chiến dịch: đổi B1 → FALSE → icon tự ẩn
Anh lọc WheelEntries theo SĐT thoả điều kiện, gửi mã cho khách qua Telegram như anh mô tả — phần đối chiếu mã lúc lên đơn vẫn là thao tác thủ công của anh/sale khi khách nhắn mã qua Telegram (mini app không tự động trừ kho hay áp dụng mã vào đơn — nếu sau này cần tự động hoá bước đó thì đó là một tính năng riêng, phức tạp hơn nhiều).

⚠️ Lưu ý bảo mật: Web App Apps Script để "Anyone" truy cập được nhưng luôn yêu cầu đúng secret mới trả dữ liệu — do đó dù URL bị lộ, người ngoài vẫn không đọc/ghi được gì nếu không có secret. Secret chỉ nằm ở biến môi trường Vercel (server), không bao giờ lộ ra code phía trình duyệt.
