import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Either, Schema } from 'effect'
import {
  RaycastingService,
  RaycastingServiceLive,
  RaycastHitSchema,
} from '@ts-minecraft/rendering'

const validHit = {
  point: { x: 1.5, y: 2.5, z: 3.5 },
  normal: { x: 0, y: 1, z: 0 },
  distance: 2.5,
  blockX: 1,
  blockY: 2,
  blockZ: 3,
}

describe('RaycastingService', () => {
  describe('RaycastHitSchema', () => {
    it('decodes a valid hit object', () => {
      const result = Schema.decodeUnknownEither(RaycastHitSchema)(validHit)
      expect(Either.isRight(result)).toBe(true)
    })

    it('decodes hit with zero distance', () => {
      const result = Schema.decodeUnknownEither(RaycastHitSchema)({ ...validHit, distance: 0 })
      expect(Either.isRight(result)).toBe(true)
    })

    it('rejects negative distance', () => {
      const result = Schema.decodeUnknownEither(RaycastHitSchema)({ ...validHit, distance: -1 })
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects Infinity distance', () => {
      const result = Schema.decodeUnknownEither(RaycastHitSchema)({ ...validHit, distance: Infinity })
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects NaN distance', () => {
      const result = Schema.decodeUnknownEither(RaycastHitSchema)({ ...validHit, distance: NaN })
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects non-integer blockX', () => {
      const result = Schema.decodeUnknownEither(RaycastHitSchema)({ ...validHit, blockX: 1.5 })
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects non-integer blockY', () => {
      const result = Schema.decodeUnknownEither(RaycastHitSchema)({ ...validHit, blockY: 2.7 })
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects non-integer blockZ', () => {
      const result = Schema.decodeUnknownEither(RaycastHitSchema)({ ...validHit, blockZ: -0.1 })
      expect(Either.isLeft(result)).toBe(true)
    })

    it('accepts negative integer block coordinates', () => {
      const result = Schema.decodeUnknownEither(RaycastHitSchema)({ ...validHit, blockX: -5, blockY: -1, blockZ: -10 })
      expect(Either.isRight(result)).toBe(true)
    })

    it('rejects missing point field', () => {
      const { point: _p, ...noPoint } = validHit
      const result = Schema.decodeUnknownEither(RaycastHitSchema)(noPoint)
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects missing normal field', () => {
      const { normal: _n, ...noNormal } = validHit
      const result = Schema.decodeUnknownEither(RaycastHitSchema)(noNormal)
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects missing distance field', () => {
      const { distance: _d, ...noDistance } = validHit
      const result = Schema.decodeUnknownEither(RaycastHitSchema)(noDistance)
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects null input', () => {
      const result = Schema.decodeUnknownEither(RaycastHitSchema)(null)
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects string input', () => {
      const result = Schema.decodeUnknownEither(RaycastHitSchema)('invalid')
      expect(Either.isLeft(result)).toBe(true)
    })

    it('round-trips through encode then decode', () => {
      const decoded = Schema.decodeUnknownEither(RaycastHitSchema)(validHit)
      expect(Either.isRight(decoded)).toBe(true)
      if (Either.isRight(decoded)) {
        const encoded = Schema.encodeEither(RaycastHitSchema)(decoded.right)
        expect(Either.isRight(encoded)).toBe(true)
      }
    })
  })

  describe('service interface', () => {
    it.effect('exposes raycastFromCamera method', () =>
      Effect.gen(function* () {
        const svc = yield* RaycastingService
        expect(typeof svc.raycastFromCamera).toBe('function')
      }).pipe(Effect.provide(RaycastingServiceLive))
    )

    it.effect('exposes worldToBlock method', () =>
      Effect.gen(function* () {
        const svc = yield* RaycastingService
        expect(typeof svc.worldToBlock).toBe('function')
      }).pipe(Effect.provide(RaycastingServiceLive))
    )

    it.effect('worldToBlock converts a fractional world position', () =>
      Effect.gen(function* () {
        const svc = yield* RaycastingService
        const block = yield* svc.worldToBlock({ x: 1.9, y: 2.1, z: -0.5 })
        expect(block.x).toBe(1)
        expect(block.y).toBe(2)
        expect(block.z).toBe(-1)
      }).pipe(Effect.provide(RaycastingServiceLive))
    )
  })
})
