export type AmbientColors = [string, string, string]

export interface AmbientParticle {
  id: number
  colors: AmbientColors
  origin: [number, number]
  radius: number
  speed: number
  seed: number
  bornAt: number
}

export interface AmbientSurface {
  setVisible(visible: boolean): void
  resize(): void
  render(): void
  dispose(): void
}

let particleId = 0

export function createAmbientParticle(colors: AmbientColors, origin: [number, number], bornAt = performance.now()): AmbientParticle {
  return {
    id: particleId++, colors: colors.map(brightenAmbientColor) as AmbientColors, origin: [...origin],
    radius: 0.18 + Math.random() * 0.055,
    speed: 0.035 + Math.random() * 0.02,
    seed: Math.random() * Math.PI * 2, bornAt,
  }
}

export function particlePosition(particle: AmbientParticle, now: number) {
  const age = Math.max(0, (now - particle.bornAt) / 1000)
  return {
    age,
    x: particle.origin[0] + (Math.sin(age * 0.48 + particle.seed) - Math.sin(particle.seed)) * 0.055,
    y: particle.origin[1] - age * particle.speed,
    radius: particle.radius * (0.75 + 0.25 * (1 - Math.exp(-age * 3))),
  }
}

export function pruneAmbientParticles(particles: AmbientParticle[], now: number) {
  for (let index = particles.length - 1; index >= 0; index--) {
    const position = particlePosition(particles[index]!, now)
    if (position.y + particles[index]!.radius * 2.1 < 0) particles.splice(index, 1)
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, '')
  const expanded = clean.length === 3 ? [...clean].map(char => char + char).join('') : clean
  const value = /^[\da-f]{6}$/i.test(expanded) ? parseInt(expanded, 16) : 0x799c91
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

/** Lift dark cover tones in linear light without replacing their hue. */
export function brightenAmbientColor(hex: string): string {
  const rgb = hexToRgb(hex)
  const linear = rgb.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  const luminance = linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722
  // Raise exposure first, preserving color ratios. Only add white if a saturated
  // channel reaches its limit before the light is bright enough (e.g. deep blue).
  const exposure = luminance > 0 && luminance < 0.18
    ? Math.min(0.18 / luminance, 1 / Math.max(...linear)) : 1
  const raisedLuminance = luminance * exposure
  const lift = Math.max(0, (0.18 - raisedLuminance) / (1 - raisedLuminance || 1))
  return '#' + linear.map(channel => {
    const raised = channel * exposure
    const value = raised + (1 - raised) * lift
    const encoded = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, encoded)) * 255).toString(16).padStart(2, '0')
  }).join('')
}

const vertexSource = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = vec2((aPosition.x + 1.0) * 0.5, (1.0 - aPosition.y) * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

const fragmentSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uAspect;
uniform float uAge;
uniform float uSeed;
float light(vec2 point, vec2 center, vec2 spread) {
  vec2 delta = (point - center) / spread;
  return exp(-dot(delta, delta) * 2.2);
}
void main() {
  vec2 local = (vUv - uCenter) * vec2(uAspect, 1.0) / uRadius;
  float t = uAge * 0.35 + uSeed;
  // Diffuse image-colored light: no solid body, outline or glossy highlight.
  vec2 flow = local + vec2(sin(local.y * 1.2 + t), cos(local.x * 1.1 - t)) * 0.07;
  float a = light(flow, vec2(-0.55 + sin(t) * 0.12, -0.30), vec2(0.92, 1.10));
  float b = light(flow, vec2(0.55, -0.22 + cos(t * 0.8) * 0.12), vec2(1.00, 0.90));
  float c = light(flow, vec2(sin(t * 0.7) * 0.14, 0.55), vec2(1.10, 0.92));
  float energy = a + b + c;
  // Mix the sampled hues in linear light to avoid dark seams between colors.
  vec3 linearColor = (pow(uColorA, vec3(2.2)) * a + pow(uColorB, vec3(2.2)) * b
    + pow(uColorC, vec3(2.2)) * c) / max(energy, 0.001);
  vec3 color = pow(max(linearColor, vec3(0.0)), vec3(1.0 / 2.2));
  // Fade only negligible tails before the scissor boundary; keep the center airy.
  float tails = 1.0 - smoothstep(1.65, 2.05, max(abs(local.x), abs(local.y)));
  float alpha = (1.0 - exp(-energy * 0.38)) * tails * (1.0 - exp(-uAge * 2.5));
  gl_FragColor = vec4(color * alpha, alpha);
}`

export function createAmbientSurface(canvas: HTMLCanvasElement, particles: AmbientParticle[] = []): AmbientSurface | undefined {
  let gl: WebGLRenderingContext | null
  try {
    gl = canvas.getContext('webgl', {
      alpha: true, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, preserveDrawingBuffer: false,
    })
  } catch { return }
  if (!gl) return
  const context = gl
  const shaders: WebGLShader[] = []
  const program = context.createProgram()
  const buffer = context.createBuffer()
  let disposed = false
  let frame: number | undefined

  function dispose() {
    if (disposed) return
    disposed = true
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    shaders.forEach(shader => context.deleteShader(shader))
    context.deleteProgram(program)
    context.deleteBuffer(buffer)
  }
  function compile(type: number, source: string) {
    const shader = context.createShader(type)
    if (!shader) return
    shaders.push(shader)
    context.shaderSource(shader, source)
    context.compileShader(shader)
    return context.getShaderParameter(shader, context.COMPILE_STATUS) ? shader : undefined
  }
  const vertex = compile(context.VERTEX_SHADER, vertexSource)
  const fragment = compile(context.FRAGMENT_SHADER, fragmentSource)
  if (!program || !buffer || !vertex || !fragment) { dispose(); return }
  context.attachShader(program, vertex)
  context.attachShader(program, fragment)
  context.linkProgram(program)
  if (!context.getProgramParameter(program, context.LINK_STATUS)) { dispose(); return }

  const position = context.getAttribLocation(program, 'aPosition')
  const colorLocations = ['uColorA', 'uColorB', 'uColorC'].map(name => context.getUniformLocation(program, name))
  const centerLocation = context.getUniformLocation(program, 'uCenter')
  const radiusLocation = context.getUniformLocation(program, 'uRadius')
  const ageLocation = context.getUniformLocation(program, 'uAge')
  const seedLocation = context.getUniformLocation(program, 'uSeed')
  const aspectLocation = context.getUniformLocation(program, 'uAspect')
  if (position < 0 || [...colorLocations, centerLocation, radiusLocation, ageLocation, seedLocation, aspectLocation].some(location => location === null)) {
    dispose()
    return
  }
  context.useProgram(program)
  context.bindBuffer(context.ARRAY_BUFFER, buffer)
  context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), context.STATIC_DRAW)
  context.enableVertexAttribArray(position)
  context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0)
  // Screen RGB blending merges overlapping light fields independently of draw order.
  // Alpha remains coverage; each particle keeps its own sampled palette and lifetime.
  context.enable(context.BLEND)
  context.blendFuncSeparate(context.ONE, context.ONE_MINUS_SRC_COLOR, context.ONE, context.ONE_MINUS_SRC_ALPHA)
  context.clearColor(0, 0, 0, 0)

  let visible = true
  let aspect = 1
  const paletteCache = new WeakMap<AmbientParticle, [number, number, number][]>()

  function update(timestamp: number) {
    frame = undefined
    if (disposed || !visible) return
    pruneAmbientParticles(particles, timestamp)
    context.disable(context.SCISSOR_TEST)
    context.clear(context.COLOR_BUFFER_BIT)
    if (particles.length === 0) return
    context.useProgram(program)
    context.uniform1f(aspectLocation, aspect)
    context.enable(context.SCISSOR_TEST)
    for (const particle of particles) {
      const state = particlePosition(particle, timestamp)
      const x = state.x * canvas.width, y = (1 - state.y) * canvas.height
      const extent = state.radius * canvas.height * 2.1
      const left = Math.max(0, Math.floor(x - extent)), bottom = Math.max(0, Math.floor(y - extent))
      const right = Math.min(canvas.width, Math.ceil(x + extent)), top = Math.min(canvas.height, Math.ceil(y + extent))
      if (right <= left || top <= bottom) continue
      context.scissor(left, bottom, right - left, top - bottom)
      context.uniform2f(centerLocation, state.x, state.y)
      context.uniform1f(radiusLocation, state.radius)
      context.uniform1f(ageLocation, state.age)
      context.uniform1f(seedLocation, particle.seed)
      let colors = paletteCache.get(particle)
      if (!colors) {
        colors = particle.colors.map(hexToRgb)
        paletteCache.set(particle, colors)
      }
      colors.forEach((color, index) => context.uniform3f(colorLocations[index]!, ...color))
      context.drawArrays(context.TRIANGLES, 0, 6)
    }
    context.disable(context.SCISSOR_TEST)
    frame = requestAnimationFrame(update)
  }
  function render() {
    if (!disposed && visible && frame === undefined) frame = requestAnimationFrame(update)
  }
  function resize() {
    if (disposed) return
    const width = canvas.clientWidth, height = canvas.clientHeight
    if (width <= 0 || height <= 0) return
    const ratio = Math.min(window.devicePixelRatio || 1, 1, 1440 / width, 900 / height)
    const drawWidth = Math.max(1, Math.round(width * ratio))
    const drawHeight = Math.max(1, Math.round(height * ratio))
    aspect = width / height
    if (canvas.width !== drawWidth || canvas.height !== drawHeight) {
      canvas.width = drawWidth
      canvas.height = drawHeight
    }
    context.viewport(0, 0, drawWidth, drawHeight)
    render()
  }
  resize()
  return {
    setVisible(value) {
      if (disposed || visible === value) return
      visible = value
      if (!visible && frame !== undefined) {
        cancelAnimationFrame(frame)
        frame = undefined
      } else if (visible) render()
    },
    resize, render, dispose,
  }
}
