# Dialog quên mật khẩu

`App.vue` mount một `PasswordResetDialog` bên ngoài page transition. Nút trong LoginForm mở dialog qua `passwordResetDialogKey`. Không dùng `v-if` để mount/unmount dialog khi mở/đóng.

`usePasswordResetStore` giữ dữ liệu trong bộ nhớ của ứng dụng. Visibility và trạng thái request là hai luồng độc lập:

| Hành động | Bước và dữ liệu |
| --- | --- |
| Mở / đóng / Escape / bấm ngoài | Giữ email, lỗi, bước và request hiện tại |
| Gửi email hợp lệ | Khóa gửi trùng; vẫn ở bước `email` khi đang chờ |
| API xác nhận yêu cầu | Chuyển `sent`, giữ email thực tế đã gửi trong `submittedEmail` |
| API trả lỗi | Giữ bước trước request và hiển thị lỗi |
| Gửi lại | Gửi tới `submittedEmail`; lỗi không quay về bước đầu |
| Sửa email | Hành động chủ động quay về `email`, giữ địa chỉ để sửa |
| Rời Auth rồi quay lại | Dialog và store tiếp tục cùng tiến trình |
| Reload / ứng dụng bị hủy | Bộ nhớ được khởi tạo lại; không lưu email vào storage |

Request vẫn tiếp tục khi đóng hoặc unmount phần giao diện dialog. Chỉ hủy khi scope Pinia của ứng dụng bị dispose. Address gửi đi được chụp trước request; response không đọc lại giá trị draft đang thay đổi. Các nút gửi/sửa khóa khi đang gửi, nút đóng vẫn dùng được.

`useDialogMotion` quản lý `closed → opening → open → closing`. Trigger truyền phần tử nút thật bằng `openPasswordReset($event.currentTarget as HTMLElement)`, qua provider đến `open(source)`. Cách này hoạt động cả khi click không đưa focus vào nút. Engine chụp `getBoundingClientRect()` của nút trước khi zoom nền, gọi `showModal()`, đo panel ở kích thước cuối rồi tính `x/y` và `scaleX/scaleY` để panel bắt đầu đúng tại hình chữ nhật của nút. Panel mở rộng về vị trí giữa màn hình trong 0,42 giây; backdrop fade cùng lúc.

`App.vue` đưa toàn bộ trang và brand vào `.page-content`, truyền phần tử này qua prop `background`. Lớp này zoom về 96% cùng timeline opening và giữ mức zoom khi dialog mở; `.page-screen` bên trong vẫn có animation chuyển trang riêng. Dialog là sibling của lớp nền để không bị zoom theo. Tâm zoom nằm giữa viewport hiện tại, kể cả khi trang đã scroll. Khi đóng, nền trở về 100% và panel thu về nút trong 0,3 giây, sau đó mới gọi native `dialog.close()`. Engine đo lại nút ở trạng thái nền 100% trước exit để không thu về vị trí đã bị zoom lệch. Nếu không có trigger hiển thị, panel mở rộng/thu nhỏ tại tâm thay vì dịch từ một vị trí tùy ý.

Nội dung nằm trong `.reset-body`, truyền qua option `content`: fade vào sau 0,12 giây để tránh nhìn thấy chữ bị ép theo kích thước nút ở đầu opening, và fade ra sớm khi đóng. Wrapper không mount/unmount dữ liệu form. Mở lại trong lúc exit hoặc đóng giữa opening sẽ hủy timeline cũ và tiếp tục từ frame hiện tại. Timeline được build ở trạng thái paused trước khi play, và được kill sau khi hoàn tất. Style nền được khôi phục khi đóng, native close hoặc unmount, giữ inline style có sẵn. Mặc định luôn animate như navigation của project; caller có thể truyền option `reduced` riêng.

Dialog dùng native `showModal()` cho top layer và focus trap. Backdrop là phần tử DOM riêng để animate độc lập. Bấm padding hoặc kéo từ trong ra ngoài không đóng; pointer phải bắt đầu và kết thúc bên ngoài panel. Close event cũ không làm đóng một dialog đã mở lại. Đóng xong trả focus về trigger; mở lại khôi phục focus và scroll khi phần tử vẫn phù hợp.

Chuyển `email ↔ sent` dùng `useAutoMotion`; hai panel dùng `v-show` để giữ nguyên DOM của input. Khi dialog đang ẩn/mở/đóng, content cập nhật trực tiếp; khi đã mở thì animate chuyển bước. Đóng dialog hoàn tất animation nội dung đang chạy. Ghost của engine được đặt trong native dialog top layer để không bị backdrop che.

Dialog gọi `requestPasswordReset(email, signal)` để gửi email. Trang `/auth/reset-password?token=...` gọi `validatePasswordReset(token, signal)` qua `POST /api/auth/password-reset/validate` trước khi hiển thị form. Token đã dùng, hết hạn hoặc sai chỉ hiển thị thông báo và đường quay lại đăng nhập. Lỗi mạng cho phép thử kiểm tra lại. Mở lại link luôn kiểm tra với backend, không dựa vào storage của trình duyệt.

Form gọi `confirmPasswordReset(token, newPassword, signal)` qua `POST /api/auth/password-reset/confirm`. Sau thành công, form được thay bằng thông báo rồi chuyển về đăng nhập. Backend kiểm tra lại token trong lúc xác nhận để chặn trường hợp token đã được dùng ở tab khác hoặc đã hết hạn sau khi mở form. Đổi mật khẩu và tiêu thụ token được thực hiện trong cùng transaction. `tests/reset-password-token.test.ts` kiểm tra các trạng thái này, lỗi mạng và hủy kết quả cũ khi đổi token.

`tests/password-reset.test.ts` kiểm tra hình học nút → panel, zoom nền và vị trí thu về, đảo chiều giữa frame, cleanup nền, outside/Escape, draft/lỗi/focus/scroll, đóng khi pending, chống gửi trùng, lỗi nhận khi ẩn, resend/edit, remount và Home/Auth routing. `tests/auto-motion.test.ts` kiểm tra ghost trong native modal.
