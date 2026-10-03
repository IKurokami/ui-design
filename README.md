# Mộc — frontend ứng dụng đọc tiểu thuyết

Vue 3 · TypeScript · Vite · Vue Router · Pinia · GSAP · VueUse · Lucide · CSS Modules.

## Chạy bằng pnpm

Yêu cầu Node.js 22.12+ hoặc 24 và pnpm 12.

```sh
pnpm install
pnpm dev
pnpm build
pnpm test
```

Mở http://127.0.0.1:5173. Các URL: `/login`, `/register`.

## Navigation Stack

`NavigationStack.vue` giữ các màn hình theo entry ID trong DOM. Vue Router quản lý URL và history; mỗi history entry chứa chuỗi màn hình cùng các ID ổn định. Đăng nhập/đăng ký dùng GSAP Flip để morph các phần tử chung giữa hai layout; pop chỉ unmount màn hình phía trên sau khi animation hoàn tất. Các màn hình khác dùng push/pop trượt ngang. Màn hình dưới có `inert` và `aria-hidden`. Focus quay về phần tử trước đó sau pop.

Điều hướng nội bộ được khóa trong lúc chuyển động. Back/Forward từ trình duyệt có thể ngắt animation; timeline được hoàn tất và stack xử lý trạng thái lịch sử mới nhất. Mở trực tiếp `/register` tạo một login root phía dưới; nút quay lại dùng replace khi không có history login tương ứng. Refresh giữ entry ID và scroll, nhưng xóa dữ liệu form nhạy cảm.

Để thêm màn hình: thêm route/component trong `src/app/router/index.ts`, sau đó gọi `useStackNavigation().push(path)`. Không dùng `RouterView` thay thế trang cũ hay `mode="out-in"`.

## Animation và scroll

- AnimationManager quản lý timeline và lifecycle; duration/easing/depth đặt tại một nơi.
- GSAP Flip chụp vị trí trước khi Vue cập nhật stack, ghép tiêu đề/email/mật khẩu/nút gửi qua data-flip-id và animate bằng transform. Các trường riêng xuất hiện theo nhịp cùng timeline. Flip chỉ điều khiển các phần tử con, không chạy đồng thời slide trên parent. Tương tác nhỏ sử dụng CSS.
- Mặc định tuân theo prefers-reduced-motion. Nút hiệu ứng ở header cho phép người dùng bật hoặc giảm chuyển động riêng trong Mộc; lựa chọn không nhạy cảm được lưu bằng moc:motion:v1. Reduced motion bỏ chuyển động Flip/push/pop; đổi thiết lập giảm chuyển động hoặc resize trong lúc chuyển sẽ hoàn tất timeline ngay. Không kích hoạt View Transition API song song; GSAP đã xử lý chuyển màn hình và hoạt động trên các trình duyệt không hỗ trợ API đó.
- ScrollRestorationManager quản lý entry ID + region ID. Session storage chỉ chứa tọa độ, giới hạn 100 vùng và hết hạn sau 24 giờ; pop dọn dữ liệu màn hình bị loại bỏ.
- `useScrollRestoration(entryId, region, elementRef)` hỗ trợ vùng cuộn riêng và `restore()` sau khi dữ liệu bất đồng bộ hoàn tất.
- LenisManager là module opt-in cho các vùng đọc dài sau này. Auth dùng cuộn native. Lenis dùng một instance mỗi vùng, ticker GSAP và cleanup. ScrollTrigger và Observer chưa được kích hoạt vì chưa cần.

## Kết nối backend

Chưa có tài liệu API nên chưa định nghĩa endpoint, request DTO hoặc response DTO. Các kiểu `LoginValues`, `RegisterValues`, `AuthSession` là hợp đồng nội bộ của frontend, không phải schema backend.

Cài adapter bằng `configureAuthAdapter(adapter)` trước khi mount ứng dụng. Adapter thực tế chuyển đổi các giá trị frontend thành DTO của API, sử dụng transport `createApiClient(baseUrl)` nếu phù hợp, rồi chuẩn hóa response thành AuthSession. Adapter cũng quyết định session/remember-me theo chính sách backend, truyền AbortSignal và chuẩn hóa lỗi an toàn bằng ApiError.

Không có adapter: submit hợp lệ hiển thị thông báo chưa kết nối; không gửi request và không giả lập thành công. Pinia chỉ giữ session trong bộ nhớ; mật khẩu không được ghi vào web storage.

Các trang thông tin điều khoản/quyền riêng tư chỉ mô tả bản giao diện hiện tại; cần nội dung chính thức trước khi triển khai dịch vụ thật.

## Kiểm tra

`pnpm test` kiểm tra validation, lỗi chưa có backend, identity/history của stack, bảo toàn DOM và form khi pop, Back/Forward, chống push lặp, truy cập trực tiếp register scroll theo từng vùng, GSAP Flip thực tế, cleanup khi ngắt/unmount và reduced motion.

Build gồm kiểm tra TypeScript trước khi tạo production bundle. Khi deploy, server cần SPA fallback về index.html để mở trực tiếp URL. Font Google có fallback serif/system nếu mất mạng.




