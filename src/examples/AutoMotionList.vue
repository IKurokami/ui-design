<script setup lang="ts">
import { ref } from 'vue'
import { useAutoMotion } from '../animations/composables/useAutoMotion'

const list = ref<HTMLElement>()
const books = ref([
  { id: 'forest', title: 'Qua những tán rừng' },
  { id: 'river', title: 'Bên dòng sông nhỏ' },
  { id: 'summer', title: 'Một mùa hạ' },
])
let nextId = 1
useAutoMotion(list, () => books.value)
function add() { books.value.push({ id: `new-${nextId++}`, title: 'Câu chuyện mới' }) }
</script>
<template>
  <section>
    <div class="example-actions">
      <button type="button" @click="books.reverse()">Đảo thứ tự</button>
      <button type="button" @click="add">Thêm sách</button>
    </div>
    <ul ref="list" data-motion-scope="books" class="example-books">
      <li v-for="book in books" :key="book.id" :data-motion-key="book.id">
        <h2>{{ book.title }}</h2>
        <button type="button" :aria-label="`Xóa ${book.title}`" @click="books = books.filter(item => item.id !== book.id)">Xóa</button>
      </li>
    </ul>
  </section>
</template>
<style scoped>
.example-actions { display:flex; gap:12px; margin-bottom:16px; }
.example-books { display:grid; gap:12px; list-style:none; padding:0; margin:0; }
.example-books li { display:flex; align-items:center; justify-content:space-between; gap:24px; padding:20px; border-radius:12px; background:var(--hero); }
.example-books h2 { font-size:18px; font-weight:500; }
</style>
