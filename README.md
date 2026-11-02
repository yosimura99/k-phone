# K.Phone

PWA nhỏ cho iPhone: chạm icon trên màn hình chính để mở máy Android đám mây ProxyDancu toàn màn hình.

Live: https://yosimura99.github.io/k-phone/

## Cài lên iPhone
Mở link trên bằng Safari → Chia sẻ → **Thêm vào MH chính**.

## Cấu hình
- URL trình xem mặc định: trang quản lý máy `https://app.proxydancu.com/user/cloud-phone/detail/6ae82ec17242518a576d16ef` (đăng nhập ProxyDancu, chạm vào hình máy để mở trình điều khiển; link chia sẻ /s/ bị lỗi màn đen phía ProxyDancu). Trang danh sách máy `https://app.proxydancu.com/user/cloud-phone` vẫn dùng được qua Cài đặt.
- Đổi bằng nút ⚙️ **Cài đặt** (lưu trong `localStorage`) hoặc mở `https://yosimura99.github.io/k-phone/?url=<URL>` (cũng được lưu lại). `?mode=auto|iframe|direct` cũng được hỗ trợ.
- Không lưu mật khẩu / thông tin đăng nhập trong mã nguồn hay localStorage.

## Nhúng iframe và phương án dự phòng
Kiểm tra bằng `curl -I` ngày 02/11/2026:
- Link chia sẻ `/api/v1/cloud-phone/s/...`: **không** có `X-Frame-Options` hay CSP `frame-ancestors` → nhúng được trong iframe (mặc định).
- Các trang khác của `app.proxydancu.com` (`/user/cloud-phone`, `/account/login`): `X-Frame-Options: SAMEORIGIN` → **bị chặn** nhúng.
- Rủi ro: sau khi nhập mật khẩu trong iframe, phiên đăng nhập có thể dựa vào cookie; Safari (ITP) chặn cookie bên thứ ba trong iframe khác domain, nên có thể phải nhập lại mật khẩu mỗi lần mở hoặc viewer không giữ phiên. Khi đó chọn chế độ **Mở trực tiếp** trong Cài đặt.

- Chế độ **Tự động** (mặc định): nếu URL khớp danh sách `KNOWN_BLOCKED` (trong `app.js`) hoặc iframe không tải xong sau 12 giây → hiện nút lớn **Mở máy**, bấm vào sẽ chuyển `window.location` sang URL máy trong chính cửa sổ standalone.
- Trang cross-origin bị chặn vẫn có thể bắn sự kiện `load` (trang lỗi của trình duyệt) và không thể đọc nội dung, nên việc phát hiện dựa trên danh sách host đã biết + timeout. Có nút **Thử nhúng lại** và chế độ **Luôn nhúng** nếu sau này trang cho phép nhúng (hoặc dùng URL trình xem khác).
- Tuỳ chọn **Tự mở máy khi không nhúng được** sẽ tự chuyển sang trang máy.
- Hạn chế: trên iOS, khi PWA điều hướng sang domain khác phạm vi (scope), Safari hiển thị trang trong khung trình duyệt nội bộ có thanh trên/“Xong”; thanh điều khiển K.Phone sẽ không còn hiện khi đang ở trang ProxyDancu.

## Thanh điều khiển
Quay lại / Home / Gần đây (hiện chỉ `postMessage({type:'kphone:key', key, keycode})` vào iframe — TODO khi có API của trình xem), Tải lại, Cài đặt, **Thoát** (giữ 1 giây, có vòng tiến trình; chạm nhanh chỉ hiện “Giữ 1 giây để thoát”). Web app không tự đóng được, nên Thoát chuyển tới `exit.html`: “Đã thoát. Vuốt lên để về màn hình chính”.

## Chống vuốt nhầm
`html/body` `position: fixed; overflow: hidden; overscroll-behavior: none; touch-action: none`, chặn `touchmove`/gesture/double-tap/long-press/chọn chữ ở lớp vỏ (không ảnh hưởng thao tác trong iframe), chừa `env(safe-area-inset-*) + 12px` ở trên và dưới.

## Offline
`sw.js` chỉ cache vỏ ứng dụng (network-first), không cache trang ProxyDancu.
