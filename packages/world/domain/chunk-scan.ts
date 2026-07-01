import { Array as Arr, Effect, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'

export const NEARBY_BLOCK_DY_OFFSETS = [-1, 0, 1, 2] as const

export const scanNearbyBlock = <TChunk extends { readonly blocks: Uint8Array }>(
  playerPos: Position,
  searchRadius: number,
  targetBlockIndex: number,
  getChunk: (coord: { readonly x: number; readonly z: number }) => Effect.Effect<Option.Option<TChunk>, never>,
): Effect.Effect<boolean, never> => {
  const dxRange = Arr.makeBy(searchRadius * 2 + 1, (i) => i - searchRadius)
  const dyRange = NEARBY_BLOCK_DY_OFFSETS
  const dzRange = Arr.makeBy(searchRadius * 2 + 1, (i) => i - searchRadius)

  const searchCoords = Arr.flatMap(dxRange, (dx) =>
    Arr.flatMap(dyRange, (dy) =>
      Arr.map(dzRange, (dz) => ({ dx, dy, dz }))
    )
  )

  return Effect.gen(function* () {
    const s = yield* Effect.iterate(
      { found: false, i: 0 },
      {
        while: (s) => !s.found && s.i < searchCoords.length,
        body: (s) => {
          const { dx, dy, dz } = searchCoords[s.i]!
          const worldPos = {
            x: Math.floor(playerPos.x + dx),
            y: Math.floor(playerPos.y + dy),
            z: Math.floor(playerPos.z + dz),
          }
          if (worldPos.y < 0 || worldPos.y >= CHUNK_HEIGHT) {
            return Effect.succeed({ found: false, i: s.i + 1 })
          }
          const bx = Math.floor(worldPos.x)
          const bz = Math.floor(worldPos.z)
          const chunkCoord = {
            x: Math.floor(bx / CHUNK_SIZE),
            z: Math.floor(bz / CHUNK_SIZE),
          }
          const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          return Effect.gen(function* () {
            const chunkOpt = yield* getChunk(chunkCoord)
            const chunk = Option.getOrNull(chunkOpt)
            if (chunk === null) return { found: false, i: s.i + 1 }
            const idx = worldPos.y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
            return { found: chunk.blocks[idx] === targetBlockIndex, i: s.i + 1 }
          })
        },
      },
    )
    return s.found
  })
}
