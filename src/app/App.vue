<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { BookOpen } from '@lucide/vue'
import NavigationStack from '../components/navigation/NavigationStack.vue'
import ReadingHero from '../components/ReadingHero.vue'
import InfoDialog from '../components/ui/InfoDialog.vue'
import { infoDialogKey } from '../components/ui/info-dialog'
import { usePageMotion } from '../animations/composables/usePageMotion'
const router = useRouter()
const route = useRoute()
const isAuth = computed(() => route.path === '/login' || route.path === '/register')
const brand = ref<HTMLElement>()
const pages = usePageMotion(brand, isAuth)
const infoDialog = ref<InstanceType<typeof InfoDialog>>()
provide(infoDialogKey, page => infoDialog.value?.open(page))
</script>
<template>
  <div class="page-stage" :class="{ 'page-stage-home': !isAuth }">
  <a ref="brand" href="/" class="app-brand brand" :class="{ 'app-brand-home': !isAuth }" aria-label="Mộc — Trang chủ" @click.prevent="router.push('/')">
    <BookOpen :size="27" :stroke-width="1.5" /><span class="brand-name">mộc<span>.</span></span>
  </a>
  <div class="page-viewport">
  <RouterView v-slot="{ Component }">
    <Transition :css="false" @enter="pages.enter" @leave="pages.leave" @enter-cancelled="pages.cancel" @leave-cancelled="pages.cancel">
      <div :key="isAuth ? 'auth' : 'home'" class="page-screen" :class="{ 'page-screen-home': !isAuth }" :data-page="isAuth ? 'auth' : 'home'">
      <div v-if="isAuth" class="app-shell">
        <a href="#auth-content" class="skip-link">Đến biểu mẫu tài khoản</a>
        <header class="site-header"><span class="auth-brand-space" aria-hidden="true" /></header>
        <main id="auth-content" class="auth-layout"><ReadingHero /><NavigationStack /></main>
        <footer class="site-footer"><p>© 2026 Mộc</p><div class="footer-links"><button @click="infoDialog?.open('terms')">Điều khoản</button><button @click="infoDialog?.open('privacy')">Quyền riêng tư</button></div></footer>
      </div>
      <component :is="Component" v-else />
      </div>
    </Transition>
  </RouterView>
  </div>
  <InfoDialog ref="infoDialog" />
  </div>
</template>
