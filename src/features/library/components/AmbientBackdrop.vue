<script setup lang="ts">
import { ref, shallowRef, triggerRef, onMounted, onBeforeUnmount } from 'vue'
import {
  createAmbientSurface, createAmbientParticle, particlePosition, pruneAmbientParticles,
  type AmbientColors, type AmbientParticle, type AmbientSurface,
} from '../ambient-surface'

const canvasRef = ref<HTMLCanvasElement>()
const particles = shallowRef<AmbientParticle[]>([])
const ready = ref(false)
let surface: AmbientSurface | undefined
let resizeObserver: ResizeObserver | undefined
let fallbackTimer: ReturnType<typeof setTimeout> | undefined
const fallbackStyles = new Map<number, Record<string, string>>()

function cleanupFallback() {
  if (fallbackTimer) clearTimeout(fallbackTimer)
  fallbackTimer = undefined
  pruneAmbientParticles(particles.value, performance.now())
  for (const id of fallbackStyles.keys()) {
    if (!particles.value.some(particle => particle.id === id)) fallbackStyles.delete(id)
  }
  triggerRef(particles)
  if (!ready.value && particles.value.length) fallbackTimer = setTimeout(cleanupFallback, 1000)
}

function initSurface() {
  if (!canvasRef.value) return
  surface?.dispose()
  pruneAmbientParticles(particles.value, performance.now())
  surface = createAmbientSurface(canvasRef.value, particles.value)
  ready.value = !!surface
  fallbackStyles.clear()
  cleanupFallback()
  updateVisibility()
}

function spawn(colors: AmbientColors, clientOrigin?: { x: number }) {
  const bounds = canvasRef.value?.getBoundingClientRect()
  // Every light rises from the viewport bottom, regardless of the card's scroll position.
  const origin: [number, number] = [clientOrigin && bounds?.width
    ? Math.max(0, Math.min(1, (clientOrigin.x - bounds.left) / bounds.width)) : 0.5, 1]
  particles.value.push(createAmbientParticle(colors, origin))
  triggerRef(particles)
  surface?.render()
  if (!ready.value && !fallbackTimer) cleanupFallback()
}
defineExpose({ spawn })

function fallbackStyle(particle: AmbientParticle) {
  const cached = fallbackStyles.get(particle.id)
  if (cached) return cached
  const state = particlePosition(particle, performance.now())
  const height = canvasRef.value?.clientHeight || window.innerHeight
  const travel = Math.max(0, state.y + particle.radius * 2.1)
  const style = {
    left: String(state.x * 100) + '%',
    top: String(state.y * 100) + '%',
    '--lava-size': String(particle.radius * height * 4.2) + 'px',
    '--lava-rise': String(travel * height) + 'px',
    '--lava-drift': String(Math.cos(particle.seed) * 65) + 'px',
    '--lava-duration': String(Math.max(0.1, travel / particle.speed)) + 's',
    '--lava-a': particle.colors[0],
    '--lava-b': particle.colors[1],
    '--lava-c': particle.colors[2],
  }
  fallbackStyles.set(particle.id, style)
  return style
}

function resize() { surface?.resize() }
function updateVisibility() { surface?.setVisible(!document.hidden) }
function onContextLost(event: Event) {
  event.preventDefault()
  surface?.dispose()
  surface = undefined
  ready.value = false
  fallbackStyles.clear()
  cleanupFallback()
}

onMounted(() => {
  initSurface()
  if (typeof ResizeObserver !== 'undefined' && canvasRef.value) {
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvasRef.value)
  }
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', updateVisibility)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  document.removeEventListener('visibilitychange', updateVisibility)
  resizeObserver?.disconnect()
  if (fallbackTimer) clearTimeout(fallbackTimer)
  surface?.dispose()
  surface = undefined
  particles.value.length = 0
  fallbackStyles.clear()
})
</script>

<template>
  <div class="ambient-backdrop-container" aria-hidden="true">
    <div v-if="!ready" class="lava-fallback">
      <span v-for="particle in particles" :key="particle.id" class="lava-particle" :style="fallbackStyle(particle)" />
    </div>
    <canvas ref="canvasRef" class="ambient-canvas"
      @webglcontextlost="onContextLost" @webglcontextrestored="initSurface" />
  </div>
</template>

<style scoped>
.ambient-backdrop-container {
  position: absolute;
  inset: 0;
  /* Extend to the screen bottom; the content viewport clips the outer margin. */
  bottom: calc(-1 * var(--ambient-bottom-offset, 0px));
  pointer-events: none;
  z-index: -1;
  overflow: hidden;
  background: transparent;
}
.ambient-canvas { display: block; width: 100%; height: 100%; }
.lava-fallback { position: absolute; inset: 0; isolation: isolate; }
.lava-particle {
  position: absolute;
  width: var(--lava-size);
  height: var(--lava-size);
  background: radial-gradient(ellipse at 37% 43%, var(--lava-a), transparent 48%),
    radial-gradient(ellipse at 63% 45%, var(--lava-b), transparent 48%),
    radial-gradient(ellipse at 50% 63%, var(--lava-c), transparent 50%);
  filter: blur(24px);
  mix-blend-mode: screen;
  animation: lava-rise var(--lava-duration) linear both;
}
@keyframes lava-rise {
  0% { opacity: 0; transform: translate(-50%, -50%); }
  4% { opacity: 0.38; }
  100% { opacity: 0.38; transform: translate(calc(-50% + var(--lava-drift)), calc(-50% - var(--lava-rise))); }
}
</style>
