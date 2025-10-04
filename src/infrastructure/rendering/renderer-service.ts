import { Schema } from '@effect/schema'
import { Context, Effect, Option } from 'effect'

// ブランド型定義 -------------------------------------------------------------

const RgbColorSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0x000000, 0xffffff),
  Schema.brand('RendererRgbColor'),
  Schema.annotations({
    title: 'RendererRgbColor',
    description: '24bit RGB color value represented as 0xRRGGBB',
  })
)
export type RgbColor = Schema.Schema.Type<typeof RgbColorSchema>

const AlphaSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1),
  Schema.brand('RendererAlpha'),
  Schema.annotations({
    title: 'RendererAlpha',
    description: 'Alpha value between 0 and 1 inclusive',
  })
)
export type Alpha = Schema.Schema.Type<typeof AlphaSchema>

const PixelRatioSchema = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand('RendererPixelRatio'),
  Schema.annotations({
    title: 'RendererPixelRatio',
    description: 'Device pixel ratio for rendering',
  })
)
export type PixelRatio = Schema.Schema.Type<typeof PixelRatioSchema>

const TargetIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('RendererTargetId'),
  Schema.annotations({
    title: 'RendererTargetId',
    description: 'Logical identifier for the render target (canvas, surface, etc.)',
  })
)
export type RendererTargetId = Schema.Schema.Type<typeof TargetIdSchema>

const DimensionSchema = Schema.Struct({
  width: Schema.Number.pipe(Schema.nonNegative()),
  height: Schema.Number.pipe(Schema.nonNegative()),
}).pipe(
  Schema.brand('RendererViewport'),
  Schema.annotations({
    title: 'RendererViewport',
    description: 'Logical viewport size in CSS pixels',
  })
)
export type Viewport = Schema.Schema.Type<typeof DimensionSchema>

export const decodeRgbColor = Schema.decodeUnknown(RgbColorSchema)
export const decodeAlpha = Schema.decodeUnknown(AlphaSchema)
export const decodePixelRatio = Schema.decodeUnknown(PixelRatioSchema)
export const decodeTargetId = Schema.decodeUnknown(TargetIdSchema)
export const decodeViewport = Schema.decodeUnknown(DimensionSchema)

export const parseRgbColor = Schema.decodeUnknownSync(RgbColorSchema)
export const parseAlpha = Schema.decodeUnknownSync(AlphaSchema)
export const parsePixelRatio = Schema.decodeUnknownSync(PixelRatioSchema)
export const parseTargetId = Schema.decodeUnknownSync(TargetIdSchema)
export const parseViewport = Schema.decodeUnknownSync(DimensionSchema)

// スナップショット -----------------------------------------------------------

export interface RendererSnapshot {
  readonly target: Option.Option<RendererTargetId>
  readonly clearColor: RgbColor
  readonly alpha: Alpha
  readonly pixelRatio: PixelRatio
  readonly viewport: Viewport
  readonly frames: number
  readonly lastUpdatedAt: number
}

// サービスインターフェース ---------------------------------------------------

export interface RendererService {
  readonly bindTarget: (id: RendererTargetId) => Effect.Effect<void>
  readonly setViewport: (viewport: Viewport) => Effect.Effect<void>
  readonly setPixelRatio: (ratio: PixelRatio) => Effect.Effect<void>
  readonly setClearColor: (color: RgbColor, alpha: Alpha) => Effect.Effect<void>
  readonly frameRendered: Effect.Effect<void>
  readonly snapshot: Effect.Effect<RendererSnapshot>
  readonly reset: Effect.Effect<void>
}

export const RendererService = Context.GenericTag<RendererService>('@minecraft/infrastructure/RendererService')

// 初期値 ---------------------------------------------------------------

export const defaultClearColor = parseRgbColor(0x000000)
export const defaultAlpha = parseAlpha(1)
export const defaultPixelRatio = parsePixelRatio(1)
export const defaultViewport = parseViewport({ width: 0, height: 0 })
