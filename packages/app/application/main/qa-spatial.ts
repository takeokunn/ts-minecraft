import { Array as Arr, Effect, Option } from 'effect'
import * as THREE from 'three'
import type { Position } from '@ts-minecraft/core'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'

export const getNormalizedLookDirection = (camera: THREE.PerspectiveCamera): THREE.Vector3 => {
  const direction = new THREE.Vector3()
  camera.getWorldDirection(direction)
  direction.normalize()
  return direction
}

export const projectBlockAhead = (camera: THREE.PerspectiveCamera, distance: number): Position => {
  const direction = getNormalizedLookDirection(camera)
  return {
    x: Math.floor(camera.position.x + direction.x * distance),
    y: Math.floor(camera.position.y),
    z: Math.floor(camera.position.z + direction.z * distance),
  }
}

export const getChunkAccessForWorldPosition = (position: Position) => {
  const chunkCoord = {
    x: Math.floor(position.x / CHUNK_SIZE),
    z: Math.floor(position.z / CHUNK_SIZE),
  }

  return {
    chunkCoord,
    lx: ((position.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    lz: ((position.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
  }
}

// Y offsets for nearby-block scan: floor below, at floor level, one above, two above
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

  return Effect.iterate(
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
        const { chunkCoord, lx, lz } = getChunkAccessForWorldPosition(worldPos)
        return getChunk(chunkCoord).pipe(
          Effect.map((chunkOpt) => {
            const chunk = Option.getOrNull(chunkOpt)
            if (chunk === null) return { found: false, i: s.i + 1 }
            const idx = worldPos.y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
            return { found: chunk.blocks[idx] === targetBlockIndex, i: s.i + 1 }
          })
        )
      },
    }
  ).pipe(Effect.map((s) => s.found))
}

