# Editor ebook

## Vì sao tách khỏi StoryEditor

`StoryEditor` đang là luồng đăng truyện và soạn chương theo dạng văn bản. Ebook là một lớp trình bày khác: cùng một đoạn nội dung có thể được đặt lại trên nhiều trang, có bìa, ảnh minh họa, màu nền, kiểu chữ, thứ tự trang và trạng thái ẩn/khóa. Vì vậy editor ebook lưu một tài liệu thiết kế riêng, không sửa HTML của chương khi người dùng đang dàn trang.

## Luồng dàn trang

1. Chọn một truyện trong tủ sách hoặc bắt đầu với canvas trống.
2. Hệ thống tạo bìa và các trang nội dung từ các chương hiện có.
3. Chọn **Văn bản** để tạo một ô chữ độc lập. Mỗi ô có vị trí, kích thước, font, màu, căn lề và lớp riêng.
4. Kéo ô chữ hoặc ảnh trên canvas. Vị trí tự hít vào lưới, mép trang, tâm trang và mép các ô khác; các ô có thể chồng lên nhau.
5. Dùng nút ở góc ô để đổi kích thước, nhân bản, khóa, đổi lớp hoặc xóa.
6. Chọn **Trang** để thêm, nhân bản, sắp xếp, ẩn, khóa hoặc xóa trang rồi lưu bản thiết kế.

## Xem trước dạng sách

Nút **Xem trước** mở một lớp xem trước ngay trong editor. Canvas edit và preview dùng chung `EbookPageCanvas`, chung khổ `1410 × 2250`, tọa độ thiết kế và cách dựng chữ/ảnh; preview chỉ tăng kích thước hiển thị để đọc dễ hơn. Ban đầu chỉ có bìa ở giữa; click bìa sẽ mở sách và đưa bìa sang trái. Sau đó mỗi tờ có mặt trước và mặt sau riêng, xoay quanh mép trái theo thứ tự lớp giống một flipbook CSS. Người dùng có thể click nửa trái/phải của sách, dùng nút điều hướng hoặc phím `←`/`→` để lật; `Esc` đóng preview. Các layer hiện tại được render trực tiếp trên từng mặt trang, không tạo một bản nội dung khác.

## Mô hình dữ liệu

```text
Story / Chapter (nội dung gốc)
        │ đọc khi khởi tạo
        ▼
EbookDesign {
  version, title, subtitle, author,
  fontFamily, pageBackground, accent,
  pages: [{ id, kind, title, content, coverUrl,
            background, accent, locked, hidden, chapterId,
            elements: [{ id, kind, html, src, x, y,
                         width, height, zIndex, style... }] }]
}
```

Frontend có local fallback để không mất bản nháp khi API tạm thời không sẵn sàng. Backend có bảng `ebooks` và các endpoint `/api/ebooks`, dùng `revision` để từ chối việc ghi đè khi hai cửa sổ cùng sửa một thiết kế.

## Cách cuộn và khổ xuất bản

Khi chỉnh sửa, chỉ vùng canvas bên ngoài (`ebook-stage-scroll`) được cuộn để đi qua danh sách các trang. Một trang ebook là một khung cố định nên không có scrollbar riêng; nội dung phải được dàn vừa khung hoặc tách sang trang kế tiếp. Khi in/xuất bản, mỗi `.ebook-page` trở thành một trang độc lập, vì vậy scrollbar của editor không đi vào bản sách.

Bản đầu dùng canvas dọc cố định 1410 × 2250 px. Đây là fixed-layout: người thiết kế kiểm soát vị trí, kích thước và thứ tự lớp trên từng trang. Khi cần xuất EPUB reflowable, cần thêm bước phân trang theo độ dài, kiểm tra ảnh vượt khung, mục lục và liên kết nội bộ; không dùng lại dữ liệu vị trí của fixed-layout cho reflowable.
