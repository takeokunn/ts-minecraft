import { Effect, Option } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, BlockIndexError } from './chunk-coords'

// Index = y + (z * CHUNK_HEIGHT) + (x * CHUNK_HEIGHT * CHUNK_SIZE). Returns none() for out-of-bounds coords.
export const blockIndex = (x: number, y: number, z: number): Option.Option<number> => {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
    return Option.none()
  }
  return Option.some(y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE)
}

// Performance boundary: no Option allocation — caller must ensure 0 ≤ x < CHUNK_SIZE, 0 ≤ y < CHUNK_HEIGHT, 0 ≤ z < CHUNK_SIZE
export const blockIndexUnsafe = (x: number, y: number, z: number): number =>
  y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE

// Effect version for user-facing APIs — fails with BlockIndexError for out-of-bounds coords.
export const toBlockIndex = (x: number, y: number, z: number): Effect.Effect<number, BlockIndexError> =>
  Option.match(blockIndex(x, y, z), {
    onNone: () => Effect.fail(new BlockIndexError({ x, y, z })),
    onSome: (idx) => Effect.succeed(idx),
  })
