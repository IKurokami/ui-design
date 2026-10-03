<script setup lang="ts">
import { inject } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowUpRight } from '@lucide/vue'
import PrismaticBackdrop from '../components/PrismaticBackdrop.vue'
import { infoDialogKey } from '../../../components/ui/info-dialog'
const openInfo = inject(infoDialogKey)
</script>
<template>
  <div class="landing-page">
    <PrismaticBackdrop />
    <header class="landing-header landing-width">
      <span class="landing-brand-space" aria-hidden="true" />
      <RouterLink to="/login" class="landing-login">Đăng nhập <ArrowUpRight :size="16" :stroke-width="1.4" /></RouterLink>
    </header>
    <main class="landing-main landing-width" aria-labelledby="landing-title">
      <div class="landing-copy">
        <p class="landing-eyebrow">Không gian đọc tiểu thuyết</p>
        <h1 id="landing-title">Một trang sách.<br /><em>Ngàn thế giới.</em></h1>
        <p class="landing-description">Để một câu chuyện đưa bạn đi xa.</p>
        <RouterLink to="/register" class="landing-start">Tạo tài khoản <ArrowUpRight :size="17" :stroke-width="1.5" /></RouterLink>
      </div>
    </main>
    <footer class="landing-footer landing-width"><p>© 2026 Mộc</p><div><button type="button" @click="openInfo?.('terms')">Điều khoản</button><button type="button" @click="openInfo?.('privacy')">Quyền riêng tư</button></div></footer>
  </div>
</template>
<style scoped>
.landing-page { position:relative; isolation:isolate; display:flex; flex-direction:column; min-height:100svh; overflow:hidden; color:#f0eee6; background:#090c09; }
.landing-width { width:min(1280px,100%); padding-inline:56px; margin-inline:auto; }
.landing-header { display:flex; justify-content:space-between; align-items:center; height:104px; flex-shrink:0; }
.landing-brand-space { width:94px; height:36px; }
.landing-login { display:flex; align-items:center; gap:12px; color:#dfdfd4; text-decoration:none; font-size:11px; padding:10px 0; }
.landing-login:hover { color:#fff; }
.landing-main { display:flex; align-items:center; flex:1; padding-block:64px 88px; }
.landing-copy { padding-bottom:14px; }
.landing-eyebrow { font-size:9px; font-weight:500; color:#a7ac9e; letter-spacing:2px; text-transform:uppercase; margin-bottom:30px; }
.landing-copy h1 { font-family:var(--serif); font-size:clamp(58px,6.6vw,98px); font-weight:400; letter-spacing:-2.6px; line-height:1.15; }
.landing-copy h1 em { font-weight:400; color:#dbd1b9; }
.landing-description { color:#adb2a3; font-size:12px; line-height:1.9; margin-top:29px; }
.landing-start { display:inline-flex; align-items:center; justify-content:space-between; gap:41px; margin-top:32px; padding:16px 20px; border-radius:5px; background:#e8e5da; color:#273025; font-size:11px; font-weight:550; text-decoration:none; }
.landing-start:hover { background:#f4f0e4; }
.landing-footer { display:flex; align-items:center; justify-content:space-between; gap:24px; padding-top:20px; padding-bottom:30px; color:#828b78; font-size:9px; flex-shrink:0; }
.landing-footer>div { display:flex; gap:25px; }
.landing-footer button { padding:5px 0; background:none; border:0; color:inherit; font-size:9px; cursor:pointer; }
.landing-footer button:hover { color:#c5caba; }
@media(max-width:1100px) { .landing-width { padding-inline:36px; } .landing-copy h1 { font-size:clamp(56px,7.5vw,82px); } }
@media(max-width:680px) {
  .landing-width { padding-inline:24px; } .landing-header { height:86px; } .landing-login { font-size:10px; gap:8px; }
  .landing-main { padding-block:75px; } .landing-eyebrow { font-size:8px; letter-spacing:1.5px; margin-bottom:24px; }
  .landing-copy h1 { font-size:clamp(43px,10.8vw,67px); letter-spacing:-1.5px; line-height:1.2; }
  .landing-description { font-size:11px; margin-top:24px; } .landing-start { margin-top:27px; padding:15px 18px; font-size:10px; gap:32px; }
  .landing-footer { font-size:8px; padding-bottom:25px; gap:15px; } .landing-footer>div { gap:18px; } .landing-footer button { font-size:8px; }
}
</style>
