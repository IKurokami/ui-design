<script setup lang="ts">
import { computed, ref } from 'vue'
import { X } from '@lucide/vue'
import type { InfoPage } from './info-dialog'
const dialog = ref<HTMLDialogElement>()
const page = ref<InfoPage>('terms')
const content = computed(() => ({
  terms: { title: 'Điều khoản sử dụng', paragraphs: ['Chức năng tài khoản sẽ khả dụng sau khi kết nối dịch vụ xác thực. Biểu mẫu hiện tại chưa tạo tài khoản.', 'Điều khoản chính thức sẽ được công bố trước khi mở dịch vụ.'] },
  privacy: { title: 'Quyền riêng tư', paragraphs: ['Dữ liệu biểu mẫu chỉ được giữ trong bộ nhớ. Mật khẩu không được lưu trong trình duyệt hoặc gửi đi khi chưa kết nối dịch vụ.', 'Mộc chỉ lưu mã điều hướng và vị trí cuộn để khôi phục màn hình.'] },
}[page.value]))
function open(value: InfoPage) { page.value = value; dialog.value?.showModal() }
defineExpose({ open })
</script>
<template>
  <dialog ref="dialog" class="info-dialog" aria-labelledby="info-title" @click="event => { if (event.target === dialog) dialog?.close() }">
    <button class="dialog-close" aria-label="Đóng" @click="dialog?.close()"><X :size="20" /></button>
    <h2 id="info-title">{{ content.title }}</h2>
    <p v-for="paragraph in content.paragraphs" :key="paragraph">{{ paragraph }}</p>
  </dialog>
</template>

