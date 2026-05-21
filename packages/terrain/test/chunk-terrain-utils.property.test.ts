// FR-2.1 property-based tests for computeChunkPriority — Test-P0 #1 companion.
//
// Covers two algebraic invariants of the priority function that the example-based
// tests in chunk-terrain-utils.test.ts only touch at fixed coordinates:
//
//   1. Zero-velocity reduction: ∀ chunk c, player p,
//        computeChunkPriority(c, p, {0, 0}) === chunkDistanceSquared(c, p)
//
//   2. Z-axis reflection symmetry under +x velocity: chunks mirrored across the
//      velocity axis must score identically. With v = {1, 0}, swapping z → -z
//      leaves dot(toChunk, vHat) unchanged, so priority is invariant.

import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import {
  chunkDistanceSquared,
  computeChunkPriority,
} from '@ts-minecraft/terrain'

const chunkCoordArb = fc.record({
  x: fc.integer({ min: -100, max: 100 }),
  z: fc.integer({ min: -100, max: 100 }),
})

describe('computeChunkPriority (property-based)', () => {
  it.effect(
    'zero velocity reduces priority to chunkDistanceSquared',
    () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(chunkCoordArb, chunkCoordArb, (chunk, player) => {
            const priority = computeChunkPriority(chunk, player, { vx: 0, vz: 0 })
            const distSquared = chunkDistanceSquared(chunk, player)
            return priority === distSquared
          }),
        )
      }),
  )

  it.effect(
    'z-reflection symmetry under +x velocity: priority(z) === priority(-z)',
    () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            // dx ∈ [-50, 50], |dz| ∈ [1, 50] so the reflection is non-trivial.
            fc.integer({ min: -50, max: 50 }),
            fc.integer({ min: 1, max: 50 }),
            (dx, absDz) => {
              const player = { x: 0, z: 0 }
              const velocity = { vx: 1, vz: 0 }
              const above = computeChunkPriority({ x: dx, z: absDz }, player, velocity)
              const below = computeChunkPriority({ x: dx, z: -absDz }, player, velocity)
              // Floating-point-safe equality: absolute tolerance 1e-9 covers
              // sqrt + division round-off in the priority formula.
              return Math.abs(above - below) < 1e-9
            },
          ),
        )
      }),
  )
})
