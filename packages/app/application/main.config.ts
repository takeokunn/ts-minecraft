// ─── World initialization ────────────────────────────────────────────────────

export const MAX_SEED_VALUE = 0xFFFFFFFF

// ─── Lighting colors (hex) ───────────────────────────────────────────────────

export const SUN_COLOR         = 0xffffff
export const AMBIENT_COLOR     = 0x404040
export const SKY_COLOR_NIGHT   = 0x232a45  // moonlit blue (lightened again on '夜が暗すぎる' — night horizon/fog reads as dim blue, not black)
export const SKY_COLOR_DAY     = 0x87ceeb  // sky blue

// ─── Bloom pass parameters ───────────────────────────────────────────────────

// Threshold prevents terrain from glowing — only sky/lava-bright surfaces bloom.
// Strength and radius tuned for Minecraft's art style.
export const BLOOM_STRENGTH  = 0.25
export const BLOOM_RADIUS    = 0.6
export const BLOOM_THRESHOLD = 0.8

// ─── Depth-of-field (Bokeh) pass parameters ──────────────────────────────────

export const BOKEH_FOCUS    = 10.0
export const BOKEH_APERTURE = 0.002
export const BOKEH_MAXBLUR  = 0.02

// ─── GTAO blend ─────────────────────────────────────────────────────────────

export const GTAO_BLEND_INTENSITY = 0.8
