# Library ambient light

Nền nội dung Library giữ màu trắng. Mỗi lần pointer đi vào một card hoặc card nhận focus bàn phím, trang tạo một particle mới từ mép dưới viewport, theo vị trí ngang của card; vị trí dọc của card và scroll không ảnh hưởng điểm sinh. Focus do click vào card đang hover không tạo trùng. Rời card hoặc lọc mất card không xóa các particle đã sinh.

`ambient-palette.ts` lấy màu từ pixel của ba ảnh bìa sau khi ảnh decode xong. Ảnh dùng `crossorigin="anonymous"`; kết quả được cache theo phần tử card. Khi không thể đọc ảnh (lỗi tải hoặc CORS), trang dùng bảng màu dự phòng của bộ sưu tập. Khi sinh particle, các tone tối được nâng luminance lên tối thiểu 0.18 trong không gian linear light, giữ hướng màu gốc. Mỗi particle giữ bảng màu này đến hết vòng đời, nên hover card khác không thay đổi màu của particle cũ.

`ambient-surface.ts` vẽ từng vùng ambient bằng WebGL: ba trường ánh sáng Gaussian rộng lấy màu từ ảnh bìa, hòa màu trong không gian linear light, có độ trong suốt giảm dần ra ngoài và chuyển động chậm. Không dùng thân dung nham đặc, đường viền hoặc highlight bóng. Shader xuất màu premultiplied; RGB dùng screen blending (`ONE / ONE_MINUS_SRC_COLOR`), alpha dùng `ONE / ONE_MINUS_SRC_ALPHA`. Các vùng giao nhau hòa sáng, không phụ thuộc thứ tự vẽ; dữ liệu màu và vòng đời vẫn riêng. CSS fallback dùng screen blending trong một group isolate. Scissor giới hạn fragment work trong vùng của từng nguồn sáng; drawing buffer được giới hạn kích thước. Không có giới hạn số vùng khiến nguồn sáng đang hiển thị bị xóa sớm. Chỉ loại bỏ khi toàn bộ vùng sáng đã trôi qua cạnh trên.

`AmbientBackdrop` giữ dữ liệu particle độc lập với tài nguyên GPU để phục hồi sau context loss. Khi WebGL không khả dụng, CSS vẽ các khối đa sắc theo cùng dữ liệu và dọn khi chúng ra ngoài màn hình. Khi tab ẩn, renderer ngừng vẽ; khi không còn particle, vòng RAF ngừng hoàn toàn. Unmount giải phóng GPU và timer.

Canvas nằm bên trong `library-main-wrapper`, phía sau content và được clip theo khung content để không chiếu sang sidebar. Canvas kéo dài qua khoảng margin dưới đến mép dưới màn hình; điểm sinh luôn ở đáy canvas, không nằm trong vùng cuộn của danh sách.

Trang có một nền trắng chung; card item, phần tên/thống kê, badge, header và sidebar đều trong suốt. Riêng ô tìm kiếm, nhóm đổi kiểu hiển thị, nút danh mục và nút lọc tác phẩm có nền muted với alpha 7%, tăng nhẹ khi hover/active, cùng `backdrop-filter: blur(12px)`. Alpha chỉ áp dụng cho nền để chữ và icon giữ nguyên độ rõ.

`library-theme.css` dùng `color-mix()` để suy ra màu chữ phụ và `contrast-color()` trong `@supports` để chọn màu chữ theo nền trắng chung. Trình duyệt cũ dùng màu dự phòng. CSS không đọc pixel của canvas WebGL để tính tương phản với từng khối đang chuyển động. Các chế độ tăng tương phản và forced colors có quy tắc riêng.

Router đợi `checkAuth()` hoàn tất trước khi chọn trang lúc tải lại. Store chia sẻ cùng promise cho các lời gọi đồng thời, và bỏ qua response cũ nếu đã có login/logout mới. Không lưu trạng thái đăng nhập giả trong localStorage; backend xác nhận phiên bằng cookie qua `/api/auth/me`.

Kiểm thử liên quan: `ambient-surface.test.ts`, `ambient-palette.test.ts`, `library-ambient.test.ts`, `auth-router.test.ts`, `auth-store.test.ts`.
