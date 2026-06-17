import { describe, it, expect } from 'vitest'
import { Effect, Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import {
  END_GATEWAY_TELEPORT_RANGE,
  findEndGatewayTarget,
  generateGatewayPortal,
  shouldActivateGateway,
} from '@ts-minecraft/world'
import type { ChunkFactory } from '../domain/terrain/generator-types'
import { makeChunkBlockBuffer } from './chunk-buffer-test-utils'

const blockAt = (blocks: Uint8Array, lx: number, y: number, lz: number): number =>
  blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE]!

const chunkFactory: ChunkFactory = {
  createChunk: (coord) => Effect.succeed({
    coord,
    blocks: makeChunkBlockBuffer(),
    fluid: Option.some(makeChunkBlockBuffer()),
  }),
}

describe('end gateway portal domain', () => {
  it('uses an eight-block activation range constant', () => {
    expect(END_GATEWAY_TELEPORT_RANGE).toBe(8)
  })

  it('computes deterministic outer-island teleport targets near radius 1000', () => {
    const gateway = { x: 0, y: 64, z: 0 }
    const target = findEndGatewayTarget(gateway)
    const again = findEndGatewayTarget(gateway)
    const radius = Math.hypot(target.x, target.z)

    expect(again).toEqual(target)
    expect(radius).toBeGreaterThanOrEqual(952)
    expect(radius).toBeLessThanOrEqual(1048)
    expect(target.y).toBe(75)
  })

  it('varies targets by gateway position', () => {
    expect(findEndGatewayTarget({ x: 0, y: 64, z: 0 })).not.toEqual(
      findEndGatewayTarget({ x: 8, y: 64, z: -3 }),
    )
  })

  it('activates only when entity is within one block of gateway', () => {
    const gateway = { x: 10, y: 70, z: -5 }
    expect(shouldActivateGateway({ x: 11, y: 69.2, z: -4.1 }, gateway)).toBe(true)
    expect(shouldActivateGateway({ x: 12.01, y: 70, z: -5 }, gateway)).toBe(false)
  })

  it('generates an END_GATEWAY block and purple beam effect in the target chunk', () => {
    const portal = Effect.runSync(generateGatewayPortal(chunkFactory, { x: -1, y: 80, z: 17 }))

    expect(portal.chunk.coord).toEqual({ x: -1, z: 1 })
    expect(blockAt(portal.chunk.blocks, 15, 80, 1)).toBe(blockTypeToIndex('END_GATEWAY'))
    expect(portal.block).toEqual({ pos: { x: -1, y: 80, z: 17 }, blockType: 'END_GATEWAY' })
    expect(portal.effects).toEqual([{ type: 'END_GATEWAY_PURPLE_BEAM', position: { x: -1, y: 80, z: 17 } }])
  })
})
