import { Brand } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { CHUNK_HEIGHT } from '@ts-minecraft/core'

// Branded key derived from a block-snapped Position via numeric encoding.
// Only positionKey() may produce one, so HashMap<PositionKey, X> cannot be
// accidentally queried with an arbitrary number.
export type PositionKey = number & Brand.Brand<'PositionKey'>
export const PositionKey = Brand.nominal<PositionKey>()

// Mixed-radix integer key: key = (x + BIAS) * XZ_STRIDE + y * Y_STRIDE + (z + BIAS)
// BIAS (2^15) offsets signed XZ coords to keep all terms non-negative.
// Safe for world coords in ±32767; coordinates beyond this range produce key collisions.
export const BIAS = 32768
export const Y_STRIDE = 65536
export const XZ_STRIDE = CHUNK_HEIGHT * Y_STRIDE

export const toBlockPosition = (position: Position): Position => ({
  x: Math.floor(position.x),
  y: Math.floor(position.y),
  z: Math.floor(position.z),
})

export const positionKey = (position: Position): PositionKey => {
  const block = toBlockPosition(position)
  return PositionKey((block.x + BIAS) * XZ_STRIDE + block.y * Y_STRIDE + (block.z + BIAS))
}

export const positionFromKey = (key: PositionKey): Position => {
  const biasedX = Math.floor(key / XZ_STRIDE)
  const remainder = key - biasedX * XZ_STRIDE
  const y = Math.floor(remainder / Y_STRIDE)
  const biasedZ = remainder - y * Y_STRIDE
  return {
    x: biasedX - BIAS,
    y,
    z: biasedZ - BIAS,
  }
}
