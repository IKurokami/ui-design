<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Mail, X } from '@lucide/vue'
import AppButton from '../../../components/ui/AppButton.vue'
import { usePasswordResetStore } from '../../../stores/password-reset.store'
import { useDialogMotion } from '../../../animations/composables/useDialogMotion'
import { useAutoMotion } from '../../../animations/composables/useAutoMotion'

const props = defineProps<{ background?: HTMLElement }>()
const flow = usePasswordResetStore()
const dialog = ref<HTMLDialogElement>()
const panel = ref<HTMLElement>()
const backdrop = ref<HTMLElement>()
const content = ref<HTMLElement>()
const body = ref<HTMLElement>()
const motion = useDialogMotion(dialog, panel, backdrop, { background: () => props.background, content: () => body.value })
const contentMotion = useAutoMotion(content, () => flow.step, {
  duration: 0.32, stagger: 0, deep: false,
  reduced: () => !dialog.value?.open || motion.phase.value !== 'open' || motion.reduced(),
})
const title = computed(() => flow.step === 'sent' ? 'Kiểm tra hộp thư' : 'Quên mật khẩu')
function open(source?: HTMLElement) { contentMotion.finish(); motion.open(source) }
function close() { contentMotion.finish(); motion.close() }
function onBackdropClick(event: MouseEvent) {
  motion.onBackdropClick(event)
  if (motion.phase.value === 'closing') contentMotion.finish()
}
function onNativeClose() { contentMotion.finish(); motion.onNativeClose() }
async function submit() {
  await flow.submit()
  await nextTick()
  if (!dialog.value?.open || motion.phase.value === 'closing') return
  if (flow.emailError) panel.value?.querySelector<HTMLElement>('#reset-email')?.focus()
  else if (flow.step === 'sent') panel.value?.querySelector<HTMLElement>('#reset-title')?.focus({ preventScroll: true })
}
async function editEmail() {
  flow.editEmail()
  await nextTick()
  if (dialog.value?.open && motion.phase.value !== 'closing') panel.value?.querySelector<HTMLElement>('#reset-email')?.focus({ preventScroll: true })
}
defineExpose({ open, close })
</script>
<template>
  <dialog ref="dialog" class="reset-dialog-shell" aria-labelledby="reset-title" :aria-describedby="flow.step === 'sent' ? 'reset-sent-description' : 'reset-description'" :data-step="flow.step" :data-state="motion.phase.value" :aria-busy="flow.loading" @cancel.prevent="close" @close="onNativeClose" @pointerdown="motion.onPointerDown" @click="onBackdropClick">
    <div ref="backdrop" class="reset-backdrop" aria-hidden="true" />
    <section ref="panel" class="reset-dialog">
      <div ref="body" class="reset-body">
      <div class="reset-header">
        <ol class="reset-progress" aria-label="Các bước khôi phục">
          <li :class="{ 'is-current': flow.step === 'email', 'is-complete': flow.step === 'sent' }" :aria-current="flow.step === 'email' ? 'step' : undefined"><span><Check v-if="flow.step === 'sent'" :size="12" /><template v-else>1</template></span>Email của bạn</li>
          <li :class="{ 'is-current': flow.step === 'sent' }" :aria-current="flow.step === 'sent' ? 'step' : undefined"><span>2</span>Kiểm tra email</li>
        </ol>
        <button type="button" class="reset-close" aria-label="Đóng cửa sổ khôi phục" @click="close"><X :size="18" /></button>
      </div>
      <div ref="content" class="reset-content" data-motion-scope="password-reset">
        <h2 id="reset-title" tabindex="-1" data-dialog-focus data-motion-key="title">{{ title }}</h2>
        <div v-show="flow.step === 'email'" class="reset-step" data-motion-key="email-step" :aria-hidden="flow.step !== 'email'">
          <p id="reset-description" class="reset-description">Nhập email của tài khoản để nhận liên kết đặt lại mật khẩu.</p>
          <form class="auth-form reset-form" novalidate @submit.prevent="submit">
            <div class="reset-input-group">
              <label for="reset-email" class="reset-input-label">Địa chỉ email</label>
              <div class="reset-input-row">
                <div class="reset-control" :class="{ 'is-invalid': !!flow.emailError }">
                  <Mail :size="18" aria-hidden="true" />
                  <input
                    id="reset-email"
                    :value="flow.email"
                    type="email"
                    autocomplete="email"
                    placeholder="ban@example.com"
                    :disabled="flow.loading"
                    :aria-invalid="!!flow.emailError"
                    :aria-describedby="flow.emailError ? 'reset-email-error' : undefined"
                    @input="e => flow.updateEmail((e.target as HTMLInputElement).value)"
                  />
                </div>
                <button
                  type="submit"
                  class="reset-arrow-submit"
                  :disabled="flow.loading"
                  :aria-busy="flow.loading"
                  aria-label="Gửi liên kết"
                  title="Gửi liên kết"
                >
                  <LoaderCircle v-if="flow.loading" class="reset-spinner" :size="18" aria-hidden="true" />
                  <ArrowRight v-else :size="18" aria-hidden="true" />
                </button>
              </div>
              <p v-if="flow.emailError" id="reset-email-error" class="reset-field-error" role="alert">{{ flow.emailError }}</p>
            </div>
            <p v-if="flow.message" class="form-message" role="alert">{{ flow.message }}</p>
          </form>
        </div>
        <div v-show="flow.step === 'sent'" class="reset-step" data-motion-key="sent-step" :aria-hidden="flow.step !== 'sent'">
          <p id="reset-sent-description" class="reset-description">Nếu email này đã đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu.</p>
          <div class="reset-email-card"><span><Mail :size="20" :stroke-width="1.5" /></span><div><p>Gửi đến</p><strong>{{ flow.submittedEmail }}</strong></div></div>
          <p class="reset-mail-hint">Kiểm tra cả thư rác nếu chưa thấy email.</p>
          <p v-if="flow.sendCount > 1 && !flow.message" class="reset-feedback" role="status"><Check :size="14" /> Yêu cầu đã được gửi lại.</p>
          <p v-if="flow.message" class="form-message" role="alert">{{ flow.message }}</p>
          <div class="reset-sent-actions">
            <AppButton class="reset-action" :loading="flow.loading" :arrow="false" @click="flow.resend">{{ flow.loading ? 'Đang gửi lại…' : 'Gửi lại' }}</AppButton>
            <button type="button" class="text-link reset-edit" :disabled="flow.loading" @click="editEmail">Sửa email</button>
          </div>
        </div>
      </div>
      <footer class="reset-footer">
        <button type="button" class="reset-back" @click="close"><ArrowLeft :size="15" /> Về đăng nhập</button>
      </footer>
      </div>
    </section>
  </dialog>
</template>
<style scoped>
.reset-dialog-shell { position:fixed; inset:0; width:100%; height:100dvh; max-width:none; max-height:none; margin:0; padding:20px; border:0; background:transparent; color:var(--ink); overflow:hidden; }
.reset-dialog-shell[open] { display:grid; place-items:center; }
.reset-dialog-shell::backdrop { background:transparent; }
.reset-backdrop { position:absolute; inset:0; background:#1d2a2280; backdrop-filter:blur(5px); }
.reset-dialog { position:relative; width:min(100%,480px); max-height:calc(100dvh - 40px); overflow:auto; overscroll-behavior:contain; padding:32px; border:1px solid #ffffffa6; border-radius:24px; background:var(--paper); box-shadow:0 28px 90px #13231a33,0 4px 18px #13231a0d; }
.reset-header { display:flex; align-items:center; gap:12px; margin-bottom:24px; padding-bottom:20px; border-bottom:1px solid #e1e5d9; }
.reset-close { flex-shrink:0; width:30px; height:30px; display:grid; place-items:center; border:0; border-radius:50%; background:#e9ede2; color:var(--muted); cursor:pointer; }
.reset-close:hover { background:#dfe6d7; color:var(--green); }
.reset-progress { flex:1; min-width:0; display:flex; align-items:center; gap:18px; padding:0; margin:0; list-style:none; }
.reset-progress li { display:flex; align-items:center; gap:6px; font-size:10px; color:#909787; white-space:nowrap; }
.reset-progress li>span { flex-shrink:0; display:grid; place-items:center; width:20px; height:20px; border-radius:50%; border:1px solid #d9dfd1; font-size:9px; }
.reset-progress .is-current { color:var(--green); font-weight:600; }
.reset-progress .is-current>span { background:var(--green); border-color:var(--green); color:var(--paper); }
.reset-progress .is-complete>span { background:#e2e9d9; border-color:#e2e9d9; color:var(--green); }
.reset-content h2 { margin:0 0 12px; font-family:var(--serif); font-size:32px; font-weight:400; line-height:1.3; letter-spacing:-0.6px; }
.reset-content h2:focus { outline:none; }
.reset-form { margin-top:24px; gap:18px; }
.reset-input-group { display:grid; gap:9px; width:100%; }
.reset-input-label { font-size:12px; font-weight:550; color:var(--ink); }
.reset-input-row { display:flex; align-items:center; gap:10px; width:100%; }
.reset-control { flex:1; min-width:0; min-height:51px; display:flex; align-items:center; gap:12px; padding:0 15px; background:#e9ede2; border-radius:9px; color:var(--muted-light); transition:background .2s; }
.reset-control:focus-within { background:#dfe7d6; }
.reset-control input { min-width:0; width:100%; height:49px; border:0; outline:0; background:transparent; color:var(--ink); font-size:13px; }
.reset-control input::placeholder { color:var(--placeholder); }
.reset-control:has(input:disabled) { opacity:.65; background:var(--paper); }
.reset-control.is-invalid { background:#f1e4dc; }
.reset-arrow-submit { flex-shrink:0; width:51px; height:51px; display:grid; place-items:center; border:0; border-radius:9px; background:var(--green); color:var(--paper); cursor:pointer; transition:background .2s, transform .2s, box-shadow .2s; box-shadow:0 2px 6px #13231a14; }
.reset-arrow-submit:hover:not(:disabled) { background:var(--green-dark); }
.reset-arrow-submit:active:not(:disabled) { transform:translateY(1px); }
.reset-arrow-submit:disabled { opacity:.6; cursor:wait; }
.reset-spinner { animation:turn 1s linear infinite; }
@keyframes turn { to { transform:rotate(360deg); } }
.reset-field-error { margin:0; color:var(--danger); font-size:11px; line-height:1.6; }
.reset-submit { justify-content:space-between; }
.reset-submit[aria-busy="true"] { justify-content:center; }
.reset-email-card { display:flex; align-items:center; gap:12px; margin:20px 0 15px; padding:16px; border:1px solid #dfe5d5; border-radius:12px; background:#edf0e7; }
.reset-email-card>span { color:var(--green); flex-shrink:0; }
.reset-email-card>div { min-width:0; }
.reset-email-card p { margin-bottom:5px; color:#7b8770; font-size:9px; }
.reset-email-card strong { display:block; font-size:12px; line-height:1.6; font-weight:550; overflow-wrap:anywhere; }
.reset-mail-hint { margin-bottom:18px; font-size:11px; line-height:1.9; color:#7c8573; }
.reset-feedback { display:flex; gap:7px; align-items:center; margin:0 0 14px; font-size:11px; color:var(--green); }
.reset-sent-actions { display:grid; justify-items:center; gap:16px; margin-top:20px; }
.reset-edit { font-size:11px; }
.reset-footer { display:grid; gap:17px; justify-items:center; margin-top:27px; padding-top:23px; border-top:1px solid #e1e5d9; }
.reset-back { display:inline-flex; align-items:center; gap:7px; padding:0; border:0; background:none; color:var(--green); font-size:11px; cursor:pointer; }
@media(max-width:520px) { .reset-dialog-shell { padding:16px; } .reset-dialog { padding:26px 23px; max-height:calc(100dvh - 32px); border-radius:20px; } .reset-content h2 { font-size:29px; } .reset-progress { gap:12px; } }
</style>
