# Trang chủ Mộc

Trang `/` là landing page tối giản dành cho khách: ảnh khối kính tối, tiêu đề, đăng nhập, tạo tài khoản và liên kết pháp lý. Ảnh giữ yên; WebGL làm biến dạng cục bộ các vùng sáng trong ảnh, với phase liên tục do GSAP điều khiển. Vùng tối phía dưới là gradient tĩnh; đã xóa các mảng lava và tween cũ. Shader chỉ lấy một mẫu texture mỗi pixel, giới hạn độ phân giải, không dùng bộ lọc SVG hay blur động. Không có tìm kiếm, danh sách truyện hoặc dữ liệu giả trên landing.

Nội dung auth được ẩn ngay khi về `/`, sau đó hoàn tất leave ở nextTick để Vue gắn placeholder của out-in trước khi cập nhật trang mới. Tránh gọi done đồng bộ gây lỗi parentNode và màn hình đen. Trang mới hiện bằng fade và trượt nhẹ; logo dùng cùng một node với GSAP Flip ở cả hai chiều. Flip và ScrambleText giữa đăng nhập/đăng ký vẫn được giữ.

## Ảnh nền

Vạch sáng có vùng biến dạng rộng (0.165 chiều cao ảnh), với các nhịp sóng 3.75 giây và khoảng 2.31 giây. Viền khối kính phía trước, viền phía sau và dải phản chiếu phía dưới có độ uốn và độ sáng thay đổi theo các pha riêng. Noise nội suy mềm thay đổi cả độ cong ngang/dọc, seed ngẫu nhiên khi vào trang; miền thời gian tròn giữ chu kỳ tổng 30 giây nối liền. Tốc độ giảm 20% so với bản 24 giây.

- Tệp được dùng: `public/home-orb.webp` (1672 × 941, 34 KB).
- Tạo bằng công cụ imagegen tích hợp, từ ảnh tham chiếu khối kính do người dùng cung cấp.
- Không dùng CLI/API imagegen. Ảnh được tối ưu định dạng WebP, giữ nguyên bố cục.

Prompt cuối cùng:

> Use case: stylized-concept. Asset type: cinematic wide dark background image for literary novel discovery website. Input image 1 is a visual style reference: black translucent glass sphere, thin silver edge, softly glowing horizontal prismatic seam. Create an original wide 16:9 panoramic abstract composition inspired by its materials and mood, NOT a screenshot or UI. An oversized charcoal-black translucent glass orb occupying the upper right two-thirds, cropped at top and right, thin softly luminous silver contours and a subtle warm champagne / ice-blue refracted light seam floating through its center. Small overlapping dark glass curvature in background. Smooth fluid organic reflections like liquid mercury, calm premium editorial atmosphere, deep charcoal nearly black background. Left half mostly uninterrupted dark negative space for cream typography. Upper and middle portions contain the visible orb and reflections, bottom quarter smoothly fades to absolute near-black. Gentle visual contrast, no blazing bright lights, no stars, no mountains, no forest. No text, no logos, no watermark, no interface, no button, no border framing.
