/**
 * @fileoverview Three.js Color - Effect-TS Wrapper
 * ColorのImmutableラッパー実装
 */

import { ErrorCauseSchema } from '@shared/schema/error'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Effect, Schema } from 'effect'
import * as THREE from 'three'

/**
 * Color Schema (RGB: 0.0-1.0)
 */
export const ColorSchema = Schema.Struct({
  r: Schema.Number.pipe(Schema.between(0, 1)),
  g: Schema.Number.pipe(Schema.between(0, 1)),
  b: Schema.Number.pipe(Schema.between(0, 1)),
}).pipe(
  Schema.brand('Color'),
  Schema.annotations({
    title: 'Color',
    description: 'RGB色（0.0-1.0、Immutable）',
  })
)

export type Color = Schema.Schema.Type<typeof ColorSchema>

/**
 * Color生成（RGB値から）
 */
export const makeColor = (r: number, g: number, b: number): Effect.Effect<Color, Schema.ParseError> =>
  Schema.decodeUnknown(ColorSchema)({ r, g, b })

/**
 * Hex文字列からColor生成
 */
export const ColorParseErrorSchema = Schema.TaggedError('ColorParseError', {
  hex: Schema.String,
  cause: ErrorCauseSchema,
})
export type ColorParseError = Schema.Schema.Type<typeof ColorParseErrorSchema>
export const ColorParseError = makeErrorFactory(ColorParseErrorSchema)

export const fromHex = (hex: string): Effect.Effect<Color, ColorParseError> =>
  Effect.gen(function* () {
    const threeColor = new THREE.Color(hex)
    return yield* Schema.decodeUnknown(ColorSchema)({
      r: threeColor.r,
      g: threeColor.g,
      b: threeColor.b,
    }).pipe(Effect.mapError((error) => ColorParseError.make({ hex, cause: error })))
  })

/**
 * Three.js Color相互変換
 */
export const toThreeColor = (c: Color): THREE.Color => new THREE.Color(c.r, c.g, c.b)

export const fromThreeColor = (c: THREE.Color): Effect.Effect<Color, never> =>
  Effect.succeed(ColorSchema.make({ r: c.r, g: c.g, b: c.b }))

/**
 * 定数Color
 */
export const white: Color = ColorSchema.make({ r: 1, g: 1, b: 1 })
export const black: Color = ColorSchema.make({ r: 0, g: 0, b: 0 })
export const red: Color = ColorSchema.make({ r: 1, g: 0, b: 0 })
export const green: Color = ColorSchema.make({ r: 0, g: 1, b: 0 })
export const blue: Color = ColorSchema.make({ r: 0, g: 0, b: 1 })
