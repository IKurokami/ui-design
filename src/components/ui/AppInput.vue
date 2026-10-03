<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff, Mail, LockKeyhole, UserRound } from '@lucide/vue'
const model = defineModel<string>({ required: true })
withDefaults(defineProps<{ id: string; label: string; placeholder?: string; type?: 'text' | 'email' | 'password'; autocomplete?: string; error?: string; disabled?: boolean; icon?: 'mail' | 'lock' | 'user' }>(), { type: 'text' })
defineEmits<{ blur: []; input: [] }>()
const visible = ref(false)
</script>
<template>
  <div :class="$style.field">
    <label :for="id" data-flip-text="label">{{ label }}</label>
    <div :class="[$style.control, error && $style.invalid]">
      <Mail v-if="icon === 'mail'" :size="18" aria-hidden="true" />
      <LockKeyhole v-else-if="icon === 'lock'" :size="18" aria-hidden="true" />
      <UserRound v-else-if="icon === 'user'" :size="18" aria-hidden="true" />
      <input data-flip-text="placeholder" :id="id" v-model="model" :name="id" :type="type === 'password' && visible ? 'text' : type" :placeholder="placeholder" :autocomplete="autocomplete" :disabled="disabled" :aria-invalid="!!error" :aria-describedby="error ? `${id}-error` : undefined" @blur="$emit('blur')" @input="$emit('input')" />
      <button v-if="type === 'password'" type="button" :disabled="disabled" :class="$style.reveal" :aria-label="visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'" :aria-pressed="visible" @click="visible = !visible">
        <EyeOff v-if="visible" :size="18" /><Eye v-else :size="18" />
      </button>
    </div>
    <p v-if="error" :id="`${id}-error`" :class="$style.error" role="alert">{{ error }}</p>
  </div>
</template>
<style module>
.field { display:grid; gap:9px; }
.field label { font-size:12px; font-weight:550; color:var(--ink); }
.control { min-height:51px; display:flex; align-items:center; gap:12px; padding:0 15px; background:#e9ede2; border:0; border-radius:9px; color:var(--muted-light); transition:background .2s; }
.control:focus-within { background:#dfe7d6; }
.control input { min-width:0; width:100%; height:49px; border:0; outline:0; background:transparent; color:var(--ink); font-size:13px; }
.control input::placeholder { color:var(--placeholder); }
.control:has(input:disabled) { opacity:.65; background:var(--paper); }
.reveal { display:grid; place-items:center; margin-right:-7px; width:34px; height:34px; padding:0; border:0; border-radius:5px; color:var(--muted-light); background:transparent; cursor:pointer; }
.reveal:hover { color:var(--green); background:var(--sage-light); }
.invalid { background:#f1e4dc; }
.error { margin:0; color:var(--danger); font-size:11px; line-height:1.6; }
</style>



