export function coverRegion(width: number, height: number, imageWidth: number, imageHeight: number, mobile: boolean) {
  const scale = Math.max(width / imageWidth, height / imageHeight)
  const cropWidth = width / (imageWidth * scale)
  const cropHeight = height / (imageHeight * scale)
  return [(1 - cropWidth) * (mobile ? 0.7 : 0.6), (1 - cropHeight) * (mobile ? 0.4 : 0.45), cropWidth, cropHeight]
}

export interface PrismaticSurface {
  phase: number
  render(): void
  resize(): void
  dispose(): void
}

// One texture sample per pixel; displacement stays around existing glass highlights.
const fragmentSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uImage;
uniform vec4 uCrop;
uniform float uPhase;
uniform vec2 uSeed;
float hash(vec2 point) {
  vec3 p = fract(vec3(point.xyx) * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  vec2 blend = local * local * local * (local * (local * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
             mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), blend.x), blend.y);
}
float softBand(float distance, float width) {
  float falloff = distance / width;
  return exp(-falloff * falloff);
}
void main() {
  vec2 uv = uCrop.xy + vUv * uCrop.zw;
  float crest = (uv.x - 0.845) / 0.155;
  float seam = 0.226 + 0.132 * exp(-crest * crest);
  float band = softBand(uv.y - seam, 0.165);
  float edge = smoothstep(0.46, 0.58, uv.x);
  float seamMask = band * edge;
  vec2 rimDelta = (uv - vec2(0.74, 0.145)) / vec2(0.268, 0.55);
  float rimRadius = length(rimDelta);
  float rimMask = softBand(rimRadius - 1.0, 0.075);
  vec2 rearDelta = (uv - vec2(0.625, -0.04)) / vec2(0.255, 0.425);
  float rearRadius = length(rearDelta);
  float rearMask = softBand(rearRadius - 1.0, 0.065) * (1.0 - smoothstep(0.50, 0.55, uv.x));
  float reflectionMask = softBand(uv.y - (0.32 + uv.x * 0.48), 0.055)
                       * smoothstep(0.34, 0.48, uv.x);
  float shimmer = 1.0;
  if (max(max(seamMask, rimMask), max(rearMask, reflectionMask)) > 0.001) {
    // A circular time domain keeps the random field seamless at the loop boundary.
    vec2 drift = vec2(cos(uPhase), sin(uPhase));
    float turbulence = (noise(vec2(uv.x * 5.0, 0.0) + drift * 4.2 + uSeed) * 0.7
                     + noise(vec2(uv.x * 11.0, 2.0) + drift.yx * 7.0 + uSeed) * 0.3) * 2.0 - 1.0;
    float wave = 0.054 * sin(uPhase * 8.0 + uv.x * 7.0 + turbulence * 2.4)
               + 0.025 * sin(uPhase * 13.0 - uv.x * 14.0)
               + 0.034 * turbulence;
    vec2 offset = vec2(turbulence * 0.014, wave) * seamMask;
    // Independent phases move the front rim, rear rim and floor reflection.
    float rimWave = sin(uPhase * 5.0 + rimDelta.x * 3.0 + rimDelta.y * 4.0 + turbulence);
    float rearWave = sin(uPhase * 7.0 - rearDelta.y * 4.0 + turbulence * 1.7 + 1.6);
    float reflectionWave = sin(uPhase * 6.0 + uv.x * 9.0 + turbulence * 1.5 + 3.2);
    offset += rimDelta / max(rimRadius, 0.001) * vec2(0.011, 0.018) * rimMask * rimWave;
    offset += rearDelta / max(rearRadius, 0.001) * vec2(0.008, 0.014) * rearMask * rearWave;
    offset += vec2(turbulence * 0.016, reflectionWave * 0.021) * reflectionMask;
    shimmer += rimMask * rimWave * 0.13 + rearMask * rearWave * 0.11
             + reflectionMask * reflectionWave * 0.18;
    uv += offset;
  }
  vec4 color = texture2D(uImage, uv);
  gl_FragColor = vec4(color.rgb * shimmer, color.a);
}`

export function createPrismaticSurface(canvas: HTMLCanvasElement, image: HTMLImageElement): PrismaticSurface | undefined {
  if (typeof WebGLRenderingContext === 'undefined') return
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false })
  if (!gl) return
  const shaders: WebGLShader[] = []
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) return
    shaders.push(shader)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : undefined
  }
  const vertex = compile(gl.VERTEX_SHADER, `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = vec2((aPosition.x + 1.0) * 0.5, (1.0 - aPosition.y) * 0.5);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`)
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  const buffer = gl.createBuffer()
  const texture = gl.createTexture()
  const dispose = () => {
    shaders.forEach(shader => gl.deleteShader(shader))
    gl.deleteProgram(program); gl.deleteBuffer(buffer); gl.deleteTexture(texture)
  }
  if (!vertex || !fragment || !program || !buffer || !texture) { dispose(); return }
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { dispose(); return }
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'aPosition')
  gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
  gl.uniform1i(gl.getUniformLocation(program, 'uImage'), 0)
  gl.uniform2f(gl.getUniformLocation(program, 'uSeed'), Math.random() * 64, Math.random() * 64)
  const phase = gl.getUniformLocation(program, 'uPhase')
  const crop = gl.getUniformLocation(program, 'uCrop')
  const surface: PrismaticSurface = {
    phase: 0,
    render() {
      gl.uniform1f(phase, surface.phase)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    },
    resize() {
      const bounds = canvas.getBoundingClientRect()
      const width = Math.max(1, bounds.width), height = Math.max(1, bounds.height)
      // Bound fragment work on large/high-DPI screens instead of rendering at native DPR.
      const ratio = Math.min(window.devicePixelRatio || 1, 1.25, 1920 / width, 1200 / height)
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform4fv(crop, coverRegion(width, height, image.naturalWidth, image.naturalHeight, window.innerWidth <= 680))
      surface.render()
    },
    dispose,
  }
  surface.resize()
  return surface
}
