/**
 * Interpolation Service - 補間演算ドメインサービス
 */

import { Effect, Context, Schema } from 'effect'
import type { GenerationError } from '../../types/errors/generation-errors.js'

export interface InterpolationService {
  readonly linearInterpolate: (a: number, b: number, t: number) => Effect.Effect<number, GenerationError>
  readonly bilinearInterpolate: (values: ReadonlyArray<ReadonlyArray<number>>, x: number, y: number) => Effect.Effect<number, GenerationError>
}

export const InterpolationService = Context.GenericTag<InterpolationService>(
  '@minecraft/domain/world/Interpolation'
)

export const makeInterpolationService = (): InterpolationService => ({
  linearInterpolate: (a, b, t) => Effect.succeed(a + t * (b - a)),
  bilinearInterpolate: (values, x, y) => {
    const x0 = Math.floor(x)
    const x1 = Math.min(x0 + 1, values[0].length - 1)
    const y0 = Math.floor(y)
    const y1 = Math.min(y0 + 1, values.length - 1)

    const v00 = values[y0][x0]
    const v10 = values[y0][x1]
    const v01 = values[y1][x0]
    const v11 = values[y1][x1]

    const fx = x - x0
    const fy = y - y0

    const i1 = v00 + fx * (v10 - v00)
    const i2 = v01 + fx * (v11 - v01)
    const result = i1 + fy * (i2 - i1)

    return Effect.succeed(result)
  },
})
