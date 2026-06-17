import { Schema } from 'effect'

// Replaces individual post-processing toggles; each level maps to a fixed combination of pass enable states via resolvePreset().
export const GraphicsQuality = Schema.Literal('low', 'medium', 'high', 'ultra')
export type GraphicsQuality = Schema.Schema.Type<typeof GraphicsQuality>

export const GameDifficulty = Schema.Literal('peaceful', 'easy', 'normal', 'hard')
export type GameDifficulty = Schema.Schema.Type<typeof GameDifficulty>

export const ResolvedGraphicsSchema = Schema.Struct({
  shadowsEnabled: Schema.Boolean,
  ssaoEnabled: Schema.Boolean,
  bloomEnabled: Schema.Boolean,
  smaaEnabled: Schema.Boolean,
  skyEnabled: Schema.Boolean,
  dofEnabled: Schema.Boolean,
  godRaysEnabled: Schema.Boolean,
  godRaysSamples: Schema.Number.pipe(Schema.int(), Schema.between(0, 40)),
  bloomStrength: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  refractionThrottleFrames: Schema.Number.pipe(Schema.int(), Schema.between(0, 5)),
  // FR-4.4: skip refraction pre-pass when conservative water screen-pixel ratio
  // (sum of clipped AABB rect areas / NDC viewport area) is below this value.
  // 0 disables the gate; low/medium use 0.05 (aggressive skip), high/ultra 0.005 (conservative).
  refractionMinScreenRatio: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  pixelRatioCap: Schema.Number.pipe(Schema.finite(), Schema.between(0.5, 2)),
  // Shadow quality (the "影Mod" lever). shadowMapSize = the directional light's depth-map
  // resolution per axis (higher = crisper shadow edges, more VRAM: 2048²×4B ≈ 16MB, 4096² ≈ 64MB);
  // shadowRadius = PCF soft-shadow blur kernel (higher = softer penumbra). Scaled by preset so
  // high/ultra get a shader-pack-like soft directional shadow while low (shadows off) stays lean.
  shadowMapSize: Schema.Number.pipe(Schema.int(), Schema.between(512, 4096)),
  shadowRadius: Schema.Number.pipe(Schema.finite(), Schema.between(0, 16)),
  // EffectComposer intermediate RT pixel type. 1009 = THREE.UnsignedByteType (8-bit unorm,
  // halves VRAM bandwidth on low/medium where no HDR pass exists). 1016 = THREE.HalfFloatType
  // (16-bit float, required when bloom/god-rays produce values >1.0). Numeric literals avoid
  // pulling THREE into @ts-minecraft/game; settings-service-schema test guards renumbering.
  composerRtType: Schema.Literal(1009, 1016),
  // FR-4.3: when true, CompositePass merges Bloom + GodRays + Bokeh into a single
  // full-screen shader (~25 MB/frame bandwidth savings vs. three separate passes).
  // false on low/medium (no HDR effects to composite); true on high/ultra.
  useCompositePass: Schema.Boolean,
})
export type ResolvedGraphics = Schema.Schema.Type<typeof ResolvedGraphicsSchema>

export const SettingsSchema = Schema.Struct({
  renderDistance: Schema.Number.pipe(Schema.finite(), Schema.between(2, 16)),
  mouseSensitivity: Schema.Number.pipe(Schema.finite(), Schema.between(0.1, 3.0)),
  dayLengthSeconds: Schema.Number.pipe(Schema.finite(), Schema.between(120, 1200)),
  difficulty: GameDifficulty,
  graphicsQuality: GraphicsQuality,
  adaptivePerformanceMode: Schema.Boolean,
  // NOTE: audioEnabled defaults to false intentionally — do NOT change this to true.
  // Audio is disabled by default because it causes noise during development and testing.
  // Users can enable it via the settings UI.
  audioEnabled: Schema.Boolean,
  masterVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  sfxVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  musicVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
})
export type Settings = Schema.Schema.Type<typeof SettingsSchema>
