export interface ReadingSettings {
  font: 'serif' | 'sans' | 'georgia'
  fontSize: number
  lineHeight: number
  width: 560 | 720 | 880
  paragraphSpacing: number
  theme: 'light' | 'paper' | 'dark'
  alignment: 'left' | 'justify'
}

export const readingDefaults: ReadingSettings = {
  font: 'serif', fontSize: 20, lineHeight: 1.8, width: 720,
  paragraphSpacing: 1, theme: 'light', alignment: 'left',
}
export const readingFonts = {
  serif: "'Lora', serif",
  sans: "'Be Vietnam Pro', sans-serif",
  georgia: 'Georgia, serif',
}
const key = 'moc:reading-settings'

export function normalizeReadingSettings(value: unknown): ReadingSettings {
  const result = { ...readingDefaults }
  if (!value || typeof value !== 'object') return result
  const v = value as Record<string, unknown>
  if (v.font === 'serif' || v.font === 'sans' || v.font === 'georgia') result.font = v.font
  if (v.theme === 'light' || v.theme === 'paper' || v.theme === 'dark') result.theme = v.theme
  if (v.alignment === 'left' || v.alignment === 'justify') result.alignment = v.alignment
  if (v.width === 560 || v.width === 720 || v.width === 880) result.width = v.width
  const ranges = { fontSize: [16, 30], lineHeight: [1.4, 2.4], paragraphSpacing: [0.5, 1.5] } as const
  for (const field of ['fontSize', 'lineHeight', 'paragraphSpacing'] as const) {
    const n = v[field]
    const [min, max] = ranges[field]
    if (typeof n === 'number' && Number.isFinite(n)) result[field] = Math.min(max, Math.max(min, n))
  }
  return result
}

export function loadReadingSettings(): ReadingSettings {
  try { return normalizeReadingSettings(JSON.parse(localStorage.getItem(key) ?? 'null')) }
  catch { return { ...readingDefaults } }
}
export function saveReadingSettings(settings: ReadingSettings) {
  try { localStorage.setItem(key, JSON.stringify(settings)) } catch { /* Storage may be unavailable. */ }
}
