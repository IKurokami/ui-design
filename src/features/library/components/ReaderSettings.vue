<script setup lang="ts">
import { Minus, Plus, RotateCcw } from '@lucide/vue'
import { readingFonts, type ReadingSettings } from '../reading-settings'

const props = defineProps<{ settings: ReadingSettings }>()
const emit = defineEmits<{ change: [settings: Partial<ReadingSettings>]; reset: [] }>()
const fonts = [{ value: 'serif', label: 'Lora' }, { value: 'sans', label: 'Be Vietnam' }, { value: 'georgia', label: 'Georgia' }] as const
const widths = [{ value: 560, label: 'Hẹp' }, { value: 720, label: 'Vừa' }, { value: 880, label: 'Rộng' }] as const
const themes = [{ value: 'light', label: 'Sáng' }, { value: 'paper', label: 'Giấy' }, { value: 'dark', label: 'Tối' }] as const
function numberChange(field: 'fontSize' | 'lineHeight' | 'paragraphSpacing', event: Event) {
  emit('change', { [field]: Number((event.target as HTMLInputElement).value) })
}
function resize(delta: number) { emit('change', { fontSize: Math.min(30, Math.max(16, props.settings.fontSize + delta)) }) }
</script>

<template>
  <div class="reader-settings">
    <fieldset>
      <legend>Font chữ</legend>
      <div class="font-options">
        <button v-for="font in fonts" :key="font.value" type="button" :style="{ fontFamily: readingFonts[font.value] }"
          :aria-pressed="settings.font === font.value" @click="emit('change', { font: font.value })">{{ font.label }}</button>
      </div>
    </fieldset>
    <fieldset>
      <legend>Cỡ chữ <span>{{ settings.fontSize }} px</span></legend>
      <div class="size-control">
        <button type="button" aria-label="Giảm cỡ chữ" :disabled="settings.fontSize <= 16" @click="resize(-1)"><Minus :size="16" /></button>
        <input aria-label="Cỡ chữ" type="range" min="16" max="30" step="1" :value="settings.fontSize" @input="numberChange('fontSize', $event)">
        <button type="button" aria-label="Tăng cỡ chữ" :disabled="settings.fontSize >= 30" @click="resize(1)"><Plus :size="16" /></button>
      </div>
    </fieldset>
    <fieldset>
      <legend>Giãn dòng <span>{{ settings.lineHeight.toFixed(1) }}</span></legend>
      <input aria-label="Giãn dòng" type="range" min="1.4" max="2.4" step="0.1" :value="settings.lineHeight" @input="numberChange('lineHeight', $event)">
    </fieldset>
    <fieldset>
      <legend>Khoảng cách đoạn <span>{{ settings.paragraphSpacing.toFixed(1) }}</span></legend>
      <input aria-label="Khoảng cách đoạn" type="range" min="0.5" max="1.5" step="0.1" :value="settings.paragraphSpacing" @input="numberChange('paragraphSpacing', $event)">
    </fieldset>
    <fieldset>
      <legend>Chiều rộng trang</legend>
      <div class="options"><button v-for="width in widths" :key="width.value" type="button" :aria-pressed="settings.width === width.value"
        @click="emit('change', { width: width.value })">{{ width.label }}</button></div>
    </fieldset>
    <fieldset>
      <legend>Màu nền</legend>
      <div class="options theme-options"><button v-for="theme in themes" :key="theme.value" type="button" :aria-pressed="settings.theme === theme.value"
        @click="emit('change', { theme: theme.value })"><i :class="theme.value" aria-hidden="true" />{{ theme.label }}</button></div>
    </fieldset>
    <fieldset>
      <legend>Căn chữ</legend>
      <div class="options"><button type="button" :aria-pressed="settings.alignment === 'left'" @click="emit('change', { alignment: 'left' })">Căn trái</button>
        <button type="button" :aria-pressed="settings.alignment === 'justify'" @click="emit('change', { alignment: 'justify' })">Căn đều</button></div>
    </fieldset>
    <button type="button" class="reset-settings" @click="emit('reset')"><RotateCcw :size="14" />Khôi phục mặc định</button>
  </div>
</template>

<style scoped>
.reader-settings { display: flex; flex-direction: column; gap: 26px; }
fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
legend { width: 100%; margin-bottom: 12px; color: var(--reader-ink); font-size: 12px; font-weight: 600; }
legend span { float: right; font-weight: 400; color: var(--reader-muted); font-variant-numeric: tabular-nums; }
button { border: 0; box-shadow: none; padding: 10px 12px; color: var(--reader-muted); background: var(--reader-tint); border-radius: 10px; font: inherit; font-size: 12px; cursor: pointer; }
button:hover, button:focus-visible { color: var(--reader-accent); background: var(--reader-active); outline: none; text-decoration: underline; text-underline-offset: 4px; }
button[aria-pressed="true"] { background: var(--reader-active); color: var(--reader-accent); font-weight: 600; }
button:disabled { opacity: .35; cursor: default; }
.font-options { display: flex; flex-direction: column; gap: 6px; }
.font-options button { font-size: 17px; text-align: left; padding: 12px 14px; }
.options { display: flex; gap: 6px; }
.options button { flex: 1; }
.size-control { display: flex; align-items: center; gap: 10px; }
.size-control button { padding: 8px; display: grid; place-items: center; }
input[type="range"] { appearance: none; -webkit-appearance: none; display: block; width: 100%; min-width: 0; height: 24px; margin: 0; background: transparent; cursor: pointer; border: 0; box-shadow: none; accent-color: var(--reader-accent); }
input::-webkit-slider-runnable-track { height: 3px; border-radius: 3px; background: var(--reader-active); }
input::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 16px; height: 16px; margin-top: -6.5px; border: 0; border-radius: 50%; background: var(--reader-accent); box-shadow: none; }
input::-moz-range-track { height: 3px; border: 0; border-radius: 3px; background: var(--reader-active); }
input::-moz-range-thumb { width: 16px; height: 16px; border: 0; border-radius: 50%; background: var(--reader-accent); box-shadow: none; }
input:focus-visible { outline: none; background: var(--reader-tint); border-radius: 8px; }
.theme-options button { display: flex; gap: 6px; align-items: center; justify-content: center; }
i { width: 12px; height: 12px; border-radius: 50%; display: block; }
i.light { background: #fff; } i.paper { background: #e6dcc7; } i.dark { background: #27302b; }
.reset-settings { display: flex; align-items: center; gap: 8px; background: transparent; align-self: flex-start; padding-left: 0; }
</style>
