import { describe, it } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { expect } from 'vitest'
import * as THREE from 'three'
import { blockTypeToIndex } from '@ts-minecraft/core'
import { BlockHighlightService } from '@ts-minecraft/presentation/highlight/block-highlight'
import { RaycastingService } from '@ts-minecraft/rendering'
import { createMockRaycastingService, createMockScene, createMockCamera } from './block-highlight-test-utils'

const WATER = blockTypeToIndex('WATER')
const STONE = blockTypeToIndex('STONE')

const TestLayer = BlockHighlightService.Default.pipe(
  Layer.provide(Layer.succeed(RaycastingService, createMockRaycastingService())),
)

// Camera submerged at (0.5, 64.5, 0.5) — its own cell is (0,64,0) — facing -z.
const makeSubmergedCamera = () => {
  const camera = createMockCamera()
  camera.position.set(0.5, 64.5, 0.5)
  camera.updateMatrixWorld()
  return camera
}

describe('BlockHighlightService — submerged camera (voxel path)', () => {
  it.effect('never targets the cell the camera is inside (full-screen box regression)', () => {
    // Everything around the camera is water: pre-fix, the DDA hit the origin
    // cell at t=0 and the 1-block outline swallowed the whole screen.
    const blockIdAt = (_x: number, _y: number, _z: number): number | null => WATER

    return Effect.gen(function* () {
      const highlight = yield* BlockHighlightService
      const { scene, getChildren } = createMockScene()
      yield* highlight.initialize(scene)
      yield* highlight.update(makeSubmergedCamera(), scene, blockIdAt)

      const target = Option.getOrNull(yield* highlight.getTargetBlock())
      expect(target).not.toBeNull()
      expect(target).not.toEqual({ x: 0, y: 64, z: 0 })
      // Fluid target: outline hidden (vanilla draws no outline on fluids)...
      const mesh = getChildren()[0] as THREE.LineSegments
      expect(mesh.visible).toBe(false)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('keeps fluid blocks targetable for buckets while hiding the outline', () => {
    const blockIdAt = (x: number, y: number, z: number): number | null =>
      x === 0 && y === 64 && z === -1 ? WATER : null

    return Effect.gen(function* () {
      const highlight = yield* BlockHighlightService
      const { scene, getChildren } = createMockScene()
      yield* highlight.initialize(scene)
      yield* highlight.update(makeSubmergedCamera(), scene, blockIdAt)

      expect(Option.getOrNull(yield* highlight.getTargetBlock())).toEqual({ x: 0, y: 64, z: -1 })
      expect((getChildren()[0] as THREE.LineSegments).visible).toBe(false)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('still outlines solid blocks seen through water', () => {
    const blockIdAt = (x: number, y: number, z: number): number | null => {
      if (x !== 0 || y !== 64) return null
      return z === -2 ? STONE : null
    }

    return Effect.gen(function* () {
      const highlight = yield* BlockHighlightService
      const { scene, getChildren } = createMockScene()
      yield* highlight.initialize(scene)
      yield* highlight.update(makeSubmergedCamera(), scene, blockIdAt)

      expect(Option.getOrNull(yield* highlight.getTargetBlock())).toEqual({ x: 0, y: 64, z: -2 })
      const mesh = getChildren()[0] as THREE.LineSegments
      expect(mesh.visible).toBe(true)
      expect(mesh.position.z).toBe(-1.5)
    }).pipe(Effect.provide(TestLayer))
  })
})
