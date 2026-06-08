import { Effect } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex, type Position } from '@ts-minecraft/core'
import type { Chunk } from '../chunk'
import type { ChunkFactory } from './generator-types'
import { chunkBlockIndexUnchecked } from './math'

export const END_GATEWAY_TELEPORT_RANGE = 8

const OUTER_ISLAND_DISTANCE = 1_000
const END_GATEWAY_Y = 75

export type EndGatewayEffect = {
  readonly type: 'END_GATEWAY_PURPLE_BEAM'
  readonly position: Position
}

export type EndGatewayPortal = {
  readonly chunk: Chunk
  readonly block: { readonly pos: Position; readonly blockType: 'END_GATEWAY' }
  readonly effects: ReadonlyArray<EndGatewayEffect>
}

const hashPosition = (position: Position): number => {
  let hash = 2166136261
  hash = Math.imul(hash ^ Math.floor(position.x), 16777619)
  hash = Math.imul(hash ^ Math.floor(position.y), 16777619)
  hash = Math.imul(hash ^ Math.floor(position.z), 16777619)
  return hash >>> 0
}

const positiveModulo = (value: number, modulo: number): number => ((value % modulo) + modulo) % modulo

export const findEndGatewayTarget = (gatewayPosition: Position): Position => {
  const hash = hashPosition(gatewayPosition)
  const angle = (hash / 0xffffffff) * Math.PI * 2
  const radialJitter = (hashPosition({ ...gatewayPosition, y: gatewayPosition.y + 97 }) % 96) - 48
  const distance = OUTER_ISLAND_DISTANCE + radialJitter

  return {
    x: Math.round(Math.cos(angle) * distance),
    y: END_GATEWAY_Y,
    z: Math.round(Math.sin(angle) * distance),
  }
}

export const shouldActivateGateway = (entityPosition: Position, gatewayPosition: Position): boolean =>
  Math.abs(entityPosition.x - gatewayPosition.x) <= 1 &&
  Math.abs(entityPosition.y - gatewayPosition.y) <= 1 &&
  Math.abs(entityPosition.z - gatewayPosition.z) <= 1

export const generateGatewayPortal = (
  chunkService: ChunkFactory,
  position: Position,
): Effect.Effect<EndGatewayPortal, never> =>
  Effect.gen(function* () {
    const blockPos = {
      x: Math.floor(position.x),
      y: Math.max(0, Math.min(CHUNK_HEIGHT - 1, Math.floor(position.y))),
      z: Math.floor(position.z),
    }
    const coord = {
      x: Math.floor(blockPos.x / CHUNK_SIZE),
      z: Math.floor(blockPos.z / CHUNK_SIZE),
    }
    const chunk = yield* chunkService.createChunk(coord)
    const localX = positiveModulo(blockPos.x, CHUNK_SIZE)
    const localZ = positiveModulo(blockPos.z, CHUNK_SIZE)
    const blocks = new Uint8Array(chunk.blocks)
    blocks[chunkBlockIndexUnchecked(localX, blockPos.y, localZ)] = blockTypeToIndex('END_GATEWAY')

    return {
      chunk: { ...chunk, blocks },
      block: { pos: blockPos, blockType: 'END_GATEWAY' },
      effects: [{ type: 'END_GATEWAY_PURPLE_BEAM', position: blockPos }],
    }
  })
