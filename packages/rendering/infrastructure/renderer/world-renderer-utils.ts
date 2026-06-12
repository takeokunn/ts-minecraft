import * as THREE from 'three'
import { ChunkCoord, ChunkCacheKey } from '@ts-minecraft/core'

export const nowMs = (): number =>
  /* c8 ignore next */
  typeof performance !== 'undefined' ? performance.now() : Date.now()

export const chunkKey = (coord: ChunkCoord): ChunkCacheKey => ChunkCacheKey.make(coord)

// Only dispose geometry; materials are deliberately NOT disposed here because
// they are shared singletons (chunk-mesh-materials.ts) across hundreds of chunk
// meshes. Disposing a shared material would corrupt every other mesh referencing
// it. Future refactors: do NOT add material.dispose() here without verifying the
// material is exclusively owned by this mesh.
export const disposeMesh = (mesh: THREE.Mesh): void => {
  mesh.geometry.dispose()
}
