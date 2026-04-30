import { Effect, Option } from 'effect'
import * as THREE from 'three'
import type { Position } from '@/shared/kernel'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@/domain/chunk'

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

export const projectAimPointAhead = (camera: THREE.PerspectiveCamera, distance: number): Position => {
  const block = projectBlockAhead(camera, distance)
  return {
    x: block.x + 0.5,
    y: block.y + 0.5,
    z: block.z + 0.5,
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

export const scanNearbyBlock = <TChunk extends { readonly blocks: Uint8Array }>(
  playerPos: Position,
  searchRadius: number,
  targetBlockIndex: number,
  getChunk: (coord: { readonly x: number; readonly z: number }) => Effect.Effect<TChunk | null, never>,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -1; dy <= 2; dy++) {
        for (let dz = -searchRadius; dz <= searchRadius; dz++) {
          const worldPos = {
            x: Math.floor(playerPos.x + dx),
            y: Math.floor(playerPos.y + dy),
            z: Math.floor(playerPos.z + dz),
          }
          if (worldPos.y < 0 || worldPos.y >= CHUNK_HEIGHT) continue
          const { chunkCoord, lx, lz } = getChunkAccessForWorldPosition(worldPos)
          const chunk = yield* getChunk(chunkCoord)
          if (chunk === null) continue
          const idx = worldPos.y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
          if (chunk.blocks[idx] === targetBlockIndex) return true
        }
      }
    }
    return false
  })

export const getOptionalIndexedValue = <T>(items: ReadonlyArray<T>, index: number): Option.Option<T> =>
  index >= 0 && index < items.length ? Option.some(items[index] as T) : Option.none()
