# Animation tự động cho page và list

Engine nằm trong `src/animations/auto/`. Nó tự tìm phần tử, ghép identity, lập kế hoạch và animate. Page không phải tự viết selector, tính tọa độ, ghép cặp hay tạo timeline cho từng trường.

“Tự động” vẫn cần identity đúng. Trình duyệt không biết hai card ở hai trang có phải cùng một cuốn sách. Khi HTML có identity ổn định, engine suy ra nó; khi chưa có, khai báo `data-motion-key` bằng ID dữ liệu. Không dùng nội dung chữ, index hay vị trí DOM để suy đoán.

## Dùng nhanh: page thông thường

Đặt một scope quanh phần cần animation:

```vue
<template>
  <main data-motion-scope="account">
    <h1>Thông tin tài khoản</h1>
    <input name="email" />
    <a href="/settings">Cài đặt</a>
  </main>
</template>
```

Trong scope, engine tự tìm heading, ảnh, link, input/select/textarea có `name`, nút `type="submit"` và phần tử có `data-motion-role`. Hai page có scope `account` và `input name="email"` sẽ được ghép dù thứ tự HTML thay đổi. Một `h1` không có ID được ghép theo vai trò `heading:h1` khi vai trò đó duy nhất trong scope.

Nếu hai page dùng ID HTML khác nhau hoặc cần identity theo nghiệp vụ, chỉ định một key:

```vue
<!-- Login -->
<AppInput data-motion-key="account-email" id="login-email" ... />
<!-- Register -->
<AppInput data-motion-key="account-email" id="register-email" ... />
```

Engine tự tạo `data-flip-id` nội bộ và khôi phục nó sau animation. Không cần tự đặt `data-flip-id` hay liệt kê cặp Login → Register. Component nhận attribute cần có một root element hoặc tự forward attribute về root; component nhiều root cần đặt marker trên một wrapper DOM.

## Dùng nhanh: list thêm, xóa, sắp xếp

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useAutoMotion } from '@/animations/composables/useAutoMotion'

const list = ref<HTMLElement>()
const books = ref([
  { id: 'forest', title: 'Qua những tán rừng' },
  { id: 'river', title: 'Bên dòng sông nhỏ' },
])

useAutoMotion(list, () => books.value)
</script>

<template>
  <button @click="books.reverse()">Đảo thứ tự</button>
  <ul ref="list" data-motion-scope="books">
    <li v-for="book in books" :key="book.id" :data-motion-key="book.id">
      {{ book.title }}
      <button @click="books = books.filter(item => item.id !== book.id)">Xóa</button>
    </li>
  </ul>
</template>
```

Các import `@/...` trong ví dụ chỉ là ký hiệu rút gọn đường dẫn; project hiện dùng import tương đối. Bản component chạy được nằm ở [`src/examples/AutoMotionList.vue`](../src/examples/AutoMotionList.vue).

Event handler chỉ cập nhật dữ liệu. `useAutoMotion` tự thực hiện:

1. Watch với `flush: 'pre'`: chụp DOM cũ trước khi Vue patch.
2. Chờ `nextTick()`: đo DOM mới ở vị trí cuối.
3. Ghép item theo scope + ID; item còn lại chạy FLIP, item mới xuất hiện, item bị xóa chạy exit bằng bản sao thị giác.
4. Khôi phục style, xóa bản sao và identity nội bộ sau khi hoàn tất.

Vue `:key` giúp Vue giữ đúng DOM node. `data-motion-key` giúp engine biết identity. Cần cả hai; Vue không đưa `:key` ra HTML. Không dùng `:key="index"` hoặc `data-motion-key` ngẫu nhiên mỗi lần render.

Mặc định watch `deep: true` nên `push`, `splice`, `reverse` và thay array đều hoạt động. Nếu list lớn hoặc không cần animate thay đổi nội dung từng item, giới hạn source:

```ts
useAutoMotion(list, () => books.value.map(book => book.id), { deep: false })
```

## Card trong list → trang chi tiết

Dùng cùng scope và cùng ID dữ liệu ở hai page:

```vue
<!-- BooksPage.vue: chỉ card được chọn có mặt ở trang chi tiết -->
<main data-motion-scope="books">
  <article v-for="book in books" :key="book.id" :data-motion-key="book.id">
    <RouterLink :to="`/books/${book.id}`">{{ book.title }}</RouterLink>
  </article>
</main>

<!-- BookDetailPage.vue -->
<main data-motion-scope="books">
  <article :data-motion-key="book.id">
    <h1>{{ book.title }}</h1>
    <p>{{ book.description }}</p>
  </article>
</main>
```

`App.vue` đã kết nối engine cho các page qua `usePageMotion`. Page root được key theo `route.path`; Login/Register cùng nhóm Auth để giữ NavigationStack. Thêm route/component thông thường vào `src/app/router/index.ts` là đủ; không cần thêm tên page hay selector vào engine. `useRouteDirection` suy ra push/pop từ vị trí browser history; link về `/` dùng pop.

Route thông thường render qua `RouterView`. Route có `meta.layout: 'auth'` vào shell tài khoản và NavigationStack (root là `/login`). Nhờ metadata này có thể thêm màn hình tài khoản mà không sửa điều kiện đường dẫn trong App. Khi rời layout Auth, stack dừng xử lý route của layout khác.

Page vẫn chạy hiệu ứng trượt/zoom. Cặp phần tử chung chạy trên overlay độc lập: đo điểm cuối trước khi transform page, ẩn tạm hai phần tử thật, di chuyển và crossfade bản sao giữa hai rectangle rồi trả quyền hiển thị về DOM thật. Cách này tránh nhân đôi chuyển động do parent cũng đang trượt/zoom. Phần tử không ghép được tiếp tục đi theo cả page.

Overlay cần snapshot có `ghosts: true`; `usePageMotion` tự xử lý. Phần tử có input/select/textarea, canvas hoặc video bên trong không chạy shared overlay; chúng tiếp tục đi cùng page. Đây là giới hạn có chủ đích để giữ nội dung trực tiếp và trạng thái control. Auth dùng FLIP trên DOM thật cho các trường biểu mẫu khi đổi Login/Register.

Ảnh/dữ liệu đích phải sẵn sàng lúc đo DOM mới để morph chính xác. Nếu tải bất đồng bộ sau khi trang đã vào, dùng `useAutoMotion` với source dữ liệu đó để animate lần cập nhật tiếp theo. Page transition không chờ network vô thời hạn.

## Hợp đồng identity

Thứ tự ưu tiên:

| Nguồn | Identity suy ra | Khi dùng |
| --- | --- | --- |
| `data-motion-key` | Giá trị khai báo | ID item hoặc nối HTML có ID khác nhau |
| `id` | ID HTML | Heading/control có cùng ID giữa hai trạng thái |
| `data-motion-role` | `role:<giá trị>` | Vai trò semantic tự đặt |
| `name` | `name:<tag>:<name>` | Trường form cùng nghiệp vụ |
| `a[href]` | `link:<href>` | Link tới cùng URL |
| `img[src]` | `image:<src>` | Cùng ảnh |
| `h1/h2/h3` | `heading:<tag>` | Heading duy nhất của từng cấp |
| `button[type="submit"]` | `button:submit` | Nút gửi duy nhất |

Automatic discovery chỉ chạy bên trong `data-motion-scope`. Một `div id="..."` không tự được chọn chỉ vì có ID: đánh dấu `data-motion` hoặc `data-motion-key` nếu muốn animate nó. Marker khai báo rõ cũng hoạt động ngoài scope. Root của vùng capture là container, không phải một item được animate.

Các scope lồng nhau tạo namespace theo chuỗi scope tính từ capture root. Key được encode dạng array JSON, tránh va chạm khi ID chứa `:` hoặc `/`. Ví dụ hai scope `favorites` và `recent` có thể chứa cùng `book.id` mà không bị ghép nhầm. Muốn morph qua hai page, scope chain phải giống nhau.

Nếu có nhiều `h2` không ID trong cùng scope, identity `heading:h2` bị trùng. Engine **không** ghép theo thứ tự: các phần tử đó dùng enter/leave và trả diagnostic `duplicate-key`. List cần ID ổn định hoặc scope riêng cho từng item.

Các attribute bổ sung:

| Attribute | Chức năng |
| --- | --- |
| `data-motion` | Chọn phần tử; suy identity từ HTML, nếu không có thì chỉ enter/leave |
| `data-motion-key="..."` | Chọn phần tử và đặt identity rõ ràng |
| `data-motion-scope="..."` | Bật quét semantic và tạo namespace |
| `data-motion-role="..."` | Vai trò để suy identity trong scope |
| `data-motion-ignore` | Bỏ qua cả subtree |
| `data-motion-text="label"` | Opt in morph chữ/placeholder khi phần tử cha được ghép |
| `data-motion-nested` | Cho phần con có identity chạy riêng dù cha đã có marker; dùng cùng `nested: true` |
| `data-motion-clip` | Giữ giới hạn scroll/clip của vùng này cả khi `unclip: true` |
| `data-motion-overlay-target` | Trong list, chuyển phần tử bằng ghost độc lập với vùng scroll |

Marker trên card sở hữu toàn bộ subtree: không animate lại title/ảnh bên trong card. Muốn animate các phần con riêng, đặt marker lên từng phần con và để card không được chọn. Engine bỏ qua subtree `hidden`, `display:none`, `visibility:hidden`, `aria-hidden="true"`, `inert` và overlay của chính nó. Capture root có thể `inert` khi controller đang khóa tương tác; các item bên trong vẫn đo được.

## Pipeline và API thấp hơn

```text
captureMotion(oldRoot)
  → discoverMotion → assign internal IDs → Flip state + optional visual copies
  → cập nhật dữ liệu / DOM / route
  → matchMotion(snapshot, newRoot)
  → shared / entering / leaving + diagnostics
  → animateMotion → cleanup
```

`NavigationStack` tự gọi pipeline trước/sau render. Nó chọn morph page nếu tìm được cặp chung; nếu không có thì dùng push/pop cả màn hình. Bộ máy không chứa selector hay tên field của Auth.

Transition giữa các page dùng `useRouteDirection`: mở page mới chạy push; quay lại page còn trong chuỗi đang mở chạy pop, kể cả link gọi `router.push()` hoặc `router.replace()`. Chuỗi được rút gọn khi quay lại để mở một page đã đóng sau đó vẫn chạy push. Back/Forward nhận hướng từ [`RouterHistory.listen`](https://router.vuejs.org/api/interfaces/routerhistory#listen), ưu tiên hướng duyệt history thay vì suy từ đường dẫn. Mỗi vị trí browser history giữ bản sao chuỗi tương ứng để đồng bộ sau Back/Forward; navigation thất bại không cập nhật chuỗi. Các route Auth dùng chung một page ngoài, tiếp tục giữ quy tắc Auth nằm trên Home/Library.

Khi tự quản lý DOM, gọi API trực tiếp:

```ts
import { nextTick } from 'vue'
import { AnimationManager } from '@/animations/core/animation-manager'
import { captureMotion, animateMotion } from '@/animations/auto/motion'

const manager = new AnimationManager()
manager.finish() // hoàn tất animation cũ trước khi chụp tọa độ
const snapshot = captureMotion(root, { ghosts: true })
try {
  // Cập nhật dữ liệu ở đây.
  await nextTick()
  await animateMotion(manager, snapshot, root, { mode: 'list' })
} finally {
  snapshot.release() // cũng cần gọi nếu không bắt đầu được animation
}
// Khi owner unmount: manager.dispose().
```

`snapshot.release()` khôi phục identity nội bộ; engine tự gọi khi animation kết thúc. Có thể gọi lại mà không ảnh hưởng DOM. Không tái sử dụng cùng snapshot cho nhiều animation.

`animateMotion` nhận:

| Option | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `mode` | `page` | `page`: FLIP children giữa hai screen; `list`: cập nhật trong cùng vùng; `overlay`: shared elements độc lập với page transform |
| `direction` | `push` | Hướng xuất hiện/biến mất |
| `duration`, `ease` | Giá trị trong `animation-manager.ts` | Điều chỉnh chuyển động |
| `stagger` | `0.035` giây | Khoảng cách xuất hiện giữa item mới |
| `reduced` | `false` | Bỏ animation; giải phóng snapshot ngay |
| `onPlan` | Không có | Xem các cặp đã ghép và diagnostics trước khi animate |
| `collapseTo` | Không có | Key đích hoặc map key/prefix → key đích để thu phần tử biến mất; key chưa khai báo chọn đích gần nhất trong map |
| `foldGroup`, `foldStagger` | Không có, `0` | Thu lần lượt nhóm key; giới hạn tổng độ trễ để hoàn tất trước layout |
| `unclip`, `nested` | `false` | Cho phép đi qua container và bù transform của cha; `data-motion-clip` vẫn giữ giới hạn |
| `scale` | `true` | `false`: FLIP và shared overlay đổi width/height thật, enter/leave dùng reveal/fade thay vì scale |

`useAutoMotion` luôn dùng `list`; thêm `deep` (mặc định `true`), `onError`, và `reduced` dạng boolean hoặc getter. Khi không truyền `reduced`, nó đọc `prefers-reduced-motion` ở mỗi cập nhật. `finish()` hoàn tất animation hiện tại. Khi resize, cập nhật mới hoặc unmount, composable hoàn tất/dọn animation và snapshot. Các thay đổi trong cùng render batch giữ snapshot đầu tiên và chỉ animate DOM mới nhất.

Thời gian text morph hiện dùng nhịp riêng trong `text-flip.ts`, nên một transition opt in text có thể dài hơn `duration` bạn truyền. `duration` không phải deadline tổng của timeline khi còn stagger hoặc text morph.

## Logo khi chuyển trang

`App.vue` giữ một logo xuyên suốt Home, Auth và Library, bên ngoài các page đang trượt. Class theo layout đặt logo ở header hoặc vị trí trong sidebar; sidebar chỉ giữ một khoảng trống, không tạo logo thứ hai. `usePageMotion` theo dõi layout logo riêng với hướng trượt page, nên Auth ↔ Library vẫn chạy FLIP dù cả hai là trang bên trong. Snapshot gồm khung logo, icon, chữ và dấu chấm; `nested: true` bù transform của cha để các phần không nhảy kích thước khi đổi layout. Màu chạy trong cùng FLIP và cùng duration/ease với page.

Khi đổi hướng giữa chừng, pause timeline trước khi kill để `Flip.getState()` không ép timeline cũ tới điểm cuối. Logo giữ hành vi luôn animate của navigation stack hiện có, kể cả khi system báo `prefers-reduced-motion`. Auth nằm trên Home/Library: rời Auth sẽ kéo Auth ra và để lộ trang nền, cả với `router.push` và `router.replace`; quay vào Auth sẽ đẩy Auth vào trên trang nền. Việc ghép phần tử, ghost overlay và cleanup vẫn thuộc engine `captureMotion`/`animateMotion` hiện có.

## Lifecycle, giới hạn và kiểm tra

Header Library kết hợp GSAP Flip cho vị trí/kích thước của search, thể loại, sort, từng nút chế độ xem và nút mở/đóng; timeline GSAP riêng animate nền trắng bằng scaleY/opacity. Chụp `Flip.getState` trước khi Vue đổi layout hoặc Teleport, rồi `Flip.from` chạy trên các control thật trong 0.6 giây với `scale: false`, `nested: true`, `absolute: true`. Icon và nhãn được đo cùng nút cha; phần giữ chỗ vô hình bảo toàn các ô flex/grid ở bố cục đích trong lúc control chuyển sang absolute. Sau 0.6 giây, khôi phục style và bỏ phần giữ chỗ trong cùng một bước; nhãn nút bắt đầu fade ở giây 0.62 trong 0.2 giây, khi vị trí và nền trắng đã ổn định. Nhãn giữ DOM và không xuống dòng khi nút đổi chiều rộng. Trạng thái gồm `inline`, `compact`, `overlay`: cuộn xuống dù chỉ 1px sẽ thu gọn; cuộn về đầu, focus và click control không tự mở lại. Mở khi đã cuộn dùng portal ngoài container, định vị absolute theo toàn chiều rộng content. Nền trắng có góc thẳng và chỉ hiện ở overlay; các trạng thái khác trong suốt. Portal giữ nguyên đến khi đóng xong, vị trí trong luồng giữ 64px. Header luôn chạy animation theo yêu cầu thiết kế; không bỏ animation theo system reduced motion. Timeline bị hủy khi đảo chiều, resize hoặc unmount; phần giữ chỗ, inline style và Flip identity được dọn sau animation.

- Snapshot và animation chỉ thuộc một root/controller, không có cache key toàn cục hoặc trạng thái form trong storage.
- Exit của list dùng bản sao thị giác vì Vue đã bỏ node khỏi DOM. Bản sao `inert`, `aria-hidden`, không nhận pointer; xóa ID/handler và giá trị control. Không gắn lại control cũ vào form thật.
- Cleanup khôi phục inline style vốn có, identity và text layer, kể cả setup lỗi, hoàn tất sớm hoặc unmount. Animation plan rỗng và reduced motion vẫn resolve Promise.
- CSS animation/transition không nên đồng thời điều khiển transform của target; `.is-motion-flipping` tắt CSS transition trong FLIP. Không chạy thêm `TransitionGroup` hoặc View Transition API trên cùng item.
- Ghost không tái tạo WebGL, video đang phát hay pseudo-element hoàn hảo. Với nội dung trực tiếp như vậy, ưu tiên FLIP DOM thật hoặc chuyển động cả page.
- Vue gọi unmount của component trước khi parent hoàn tất leave transition. Với tài nguyên render còn hiển thị như background WebGL, dùng `disposeAfterRemoval(element, dispose)` trong `onBeforeUnmount` để giữ render đến khi DOM thực sự bị gỡ. Helper theo dõi việc gỡ bằng MutationObserver, tự disconnect rồi dispose một lần; không dùng timeout theo duration. `PrismaticBackdrop` áp dụng cơ chế này và kill clock thay vì revert phase về 0.
- Virtualized list chỉ có thể animate những node đang được render. Scope nên giới hạn vào vùng thực sự cần animation; ghost capture có chi phí sao chép computed style theo số descendants.

Debug việc ghép bằng `matchMotion(snapshot, root)` hoặc `onPlan: plan => console.log(plan)`. Nếu không thấy cặp chung, kiểm tra scope chain, key duy nhất, eligibility và thời điểm capture có trước DOM update hay không. Nếu chuyển động đi sai vị trí, kiểm tra parent có transform/scroll/layout đổi giữa lúc đo và animate; hoàn tất animation trước khi đổi viewport.

Chạy `pnpm test` và `pnpm build`. `tests/auto-motion.test.ts` kiểm tra discovery không marker, scope, ID trùng, reorder/add/remove, ghost cleanup, overlay, style/ID restoration, reduced/empty plans, lỗi setup và component list thực tế. Các test Home/Auth vẫn xác minh hiệu ứng trượt/zoom và đổi hướng giữa animation.

FLIP sử dụng API của [GSAP Flip](https://gsap.com/docs/v3/Plugins/Flip/); đây là lớp execution. Quy tắc chọn phần tử, identity, lifecycle và tích hợp Vue thuộc engine của project.
