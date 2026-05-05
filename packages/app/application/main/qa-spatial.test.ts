import { describe, expect, it } from 'vitest'
import { Effect, Option } from 'effect'
import * as THREE from 'three'
import {
  getChunkAccessForWorldPosition,
  getNormalizedLookDirection,
  projectBlockAhead,
  scanNearbyBlock,
} from '@ts-minecraft/app/main/qa-spatial'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/kernel'

describe('qa-spatial', () => {
  it('derives normalized look direction and projected positions', () => {
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(10.8, 64.2, 20.9)
    camera.lookAt(10.8, 64.2, 10.9)
    camera.updateMatrixWorld(true)

    const direction = getNormalizedLookDirection(camera)
    const block = projectBlockAhead(camera, 4)

    expect(direction.length()).toBeCloseTo(1)
    expect(block).toEqual({ x: 10, y: 64, z: 16 })
  })

  it('computes chunk/local access for negative and positive positions', () => {
    expect(getChunkAccessForWorldPosition({ x: 33, y: 10, z: -1 })).toEqual({
      chunkCoord: { x: Math.floor(33 / CHUNK_SIZE), z: Math.floor(-1 / CHUNK_SIZE) },
      lx: 1,
      lz: CHUNK_SIZE - 1,
    })
  })

  it('scans nearby chunks for a target block and skips out-of-height positions', async () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    const localX = 1
    const localZ = 2
    const localY = 64
    const idx = localY + localZ * CHUNK_HEIGHT + localX * CHUNK_HEIGHT * CHUNK_SIZE
    blocks[idx] = 7

    const found = await Effect.runPromise(scanNearbyBlock(
      { x: 0, y: 64, z: 0 },
      3,
      7,
      (coord) => Effect.succeed(coord.x === 0 && coord.z === 0 ? Option.some({ blocks }) : Option.none()),
    ))

    const notFound = await Effect.runPromise(scanNearbyBlock(
      { x: 0, y: -100, z: 0 },
      1,
      7,
      () => Effect.succeed(Option.none()),
    ))

    expect(found).toBe(true)
    expect(notFound).toBe(false)
  })
})
