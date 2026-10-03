<script setup lang="ts">
import { ArrowRight, LoaderCircle } from '@lucide/vue'
withDefaults(defineProps<{ loading?: boolean; disabled?: boolean; type?: 'button' | 'submit'; arrow?: boolean }>(), { type: 'button', arrow: true })
</script>
<template>
  <button :type="type" :class="$style.button" :disabled="disabled || loading" :aria-busy="loading">
    <LoaderCircle v-if="loading" :class="$style.spinner" :size="18" aria-hidden="true" />
    <span data-flip-text="label"><slot /></span>
    <ArrowRight v-if="arrow && !loading" :size="18" aria-hidden="true" />
  </button>
</template>
<style module>
.button { width:100%; min-height:52px; display:flex; align-items:center; justify-content:center; gap:12px; border:0; border-radius:9px; background:var(--green); color:var(--paper); font-weight:550; font-size:14px; cursor:pointer; transition:background .2s, transform .2s; }
.button:hover:not(:disabled) { background:var(--green-dark); }
.button:active:not(:disabled) { transform:translateY(1px); }
.button:disabled { opacity:.6; cursor:wait; }
.spinner { animation:turn 1s linear infinite; }
@keyframes turn { to { transform:rotate(360deg); } }
</style>



