<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import gsap from 'gsap'
import { createPrismaticSurface, type PrismaticSurface } from '../prismatic-surface'
import { disposeAfterRemoval } from '../../../animations/lifecycle/disposeAfterRemoval'
const root = ref<HTMLElement>()
const image = ref<HTMLImageElement>()
const canvas = ref<HTMLCanvasElement>()
const seamReady = ref(false)
let surface: PrismaticSurface | undefined
let context: gsap.Context | undefined
let observer: IntersectionObserver | undefined
let resizeObserver: ResizeObserver | undefined
let visible = true
const tweens: gsap.core.Tween[] = []
function updatePlayback() { tweens.forEach(tween => visible && !document.hidden ? tween.resume() : tween.pause()) }
function startSeam() {
  if (surface || !context || !canvas.value || !image.value?.naturalWidth) return
  surface = createPrismaticSurface(canvas.value, image.value)
  if (!surface) return
  const current = surface
  context.add(() => {
    tweens.push(gsap.to(current, {
      // Shared clock, with independent wave frequencies for each highlight region.
      phase: Math.PI * 2, duration: 30, repeat: -1, ease: 'none', onUpdate: () => current.render(),
    }))
  })
  seamReady.value = true
  updatePlayback()
}
function resize() { surface?.resize() }
function loseSeam(event: Event) {
  event.preventDefault()
  seamReady.value = false
  if (surface) {
    gsap.getTweensOf(surface).forEach(tween => {
      tween.kill()
      const index = tweens.indexOf(tween)
      if (index !== -1) tweens.splice(index, 1)
    })
    surface.dispose(); surface = undefined
  }
}
onMounted(() => {
  context = gsap.context(() => {}, root.value)
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; updatePlayback() })
    observer.observe(root.value!)
  }
  document.addEventListener('visibilitychange', updatePlayback)
  window.addEventListener('resize', resize)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(root.value!)
  }
  startSeam()
  updatePlayback()
})
function dispose() {
  observer?.disconnect(); resizeObserver?.disconnect()
  document.removeEventListener('visibilitychange', updatePlayback)
  window.removeEventListener('resize', resize)
  // This clock owns an object, not DOM styles. Kill it without rewinding phase.
  context?.kill(); surface?.dispose()
  tweens.length = 0
  surface = undefined
}
onBeforeUnmount(() => disposeAfterRemoval(root.value, dispose))
</script>
<template>
  <div ref="root" class="landing-background" aria-hidden="true">
    <div class="landing-orb-surface">
      <img ref="image" class="landing-orb" src="/home-orb.webp" alt="" width="1672" height="941" fetchpriority="high" @load="startSeam" />
      <canvas ref="canvas" class="landing-seam" :class="{ 'is-ready': seamReady }" @webglcontextlost="loseSeam" @webglcontextrestored="startSeam" />
    </div>
    <div class="landing-veil" />
  </div>
</template>
<style scoped>
.landing-background { position:absolute; inset:0; z-index:-1; pointer-events:none; overflow:hidden; }
.landing-orb-surface { position:absolute; inset:0; opacity:.8; }
.landing-orb { display:block; width:100%; height:100%; object-fit:cover; object-position:60% 45%; }
.landing-seam { position:absolute; inset:0; width:100%; height:100%; visibility:hidden; }
.landing-seam.is-ready { visibility:visible; }
.landing-veil { position:absolute; inset:0; background:linear-gradient(180deg,#090c0940,transparent 28%,#090c0940 64%,#090c09 100%),linear-gradient(90deg,#090c0970,transparent 70%); }
@media(max-width:680px) {
  .landing-orb-surface { opacity:.67; }
  .landing-orb { object-position:70% 40%; }
  .landing-veil { background:linear-gradient(180deg,#090c0940,#090c0920 30%,#090c0950 65%,#090c09),linear-gradient(90deg,#090c0960,transparent); }
}
</style>
