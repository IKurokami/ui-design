<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { BookOpen } from '@lucide/vue'
import NavigationStack from '../components/navigation/NavigationStack.vue'
import ReadingHero from '../components/ReadingHero.vue'
import InfoDialog from '../components/ui/InfoDialog.vue'
import { infoDialogKey } from '../components/ui/info-dialog'
import { usePageMotion } from '../animations/composables/usePageMotion'
import { useRouteDirection } from '../animations/composables/useRouteDirection'
import { providePageScrollRestoration } from '../animations/composables/usePageScrollRestoration'
import PasswordResetDialog from '../features/auth/components/PasswordResetDialog.vue'
import { passwordResetDialogKey } from '../features/auth/components/password-reset-dialog'
const router = useRouter()
const route = useRoute()
providePageScrollRestoration()
const isAuth = computed(() => route.meta.layout === 'auth' || route.path === '/login' || route.path === '/register')
const isHome = computed(() => route.path === '/')
const isDashboard = computed(() => route.meta.layout === 'dashboard' || route.path === '/library')
const brand = ref<HTMLElement>()
const brandLayout = computed(() => isDashboard.value ? 'library' : isHome.value ? 'home' : 'auth')
const pages = usePageMotion(brand, computed(() => !isHome.value), useRouteDirection(), brandLayout)
const infoDialog = ref<InstanceType<typeof InfoDialog>>()
const passwordReset = ref<InstanceType<typeof PasswordResetDialog>>()
const pageContent = ref<HTMLElement>()
provide(infoDialogKey, page => infoDialog.value?.open(page))
provide(passwordResetDialogKey, source => passwordReset.value?.open(source))
</script>
<template>
  <div class="page-stage" :class="{ 'page-stage-home': isHome, 'page-stage-dashboard': isDashboard }">
  <div ref="pageContent" class="page-content">
  <a ref="brand" href="/" class="app-brand brand" :class="{ 'app-brand-home': isHome, 'app-brand-library': isDashboard }" aria-label="Mộc — Trang chủ" @click.prevent="router.push('/')">
    <span class="brand-icon"><BookOpen :size="27" :stroke-width="1.5" /></span><span class="brand-name">mộc<span>.</span></span>
  </a>
  <div class="page-viewport">
  <RouterView v-slot="{ Component }">
    <Transition :css="false" @enter="pages.enter" @leave="pages.leave" @enter-cancelled="pages.cancel" @leave-cancelled="pages.cancel">
      <div :key="isAuth ? 'auth' : route.path" class="page-screen" :class="{ 'page-screen-home': isHome }" :data-page="isAuth ? 'auth' : isHome ? 'home' : String(route.name ?? route.path)">
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
  </div>
  <InfoDialog ref="infoDialog" />
  <PasswordResetDialog ref="passwordReset" :background="pageContent" />
  </div>
</template>
