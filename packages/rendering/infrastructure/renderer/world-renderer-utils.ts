import * as THREE from 'three'
import { ChunkCoord, ChunkCacheKey } from '@ts-minecraft/kernel'

export const nowMs = (): number =>
  /* c8 ignore next */
  typeof performance !== 'undefined' ? performance.now() : Date.now()

export const chunkKey = (coord: ChunkCoord): ChunkCacheKey => ChunkCacheKey.make(coord)

// Only dispose geometry; materials may be shared across chunk meshes
export const disposeMesh = (mesh: THREE.Mesh): void => {
  mesh.geometry.dispose()
}
