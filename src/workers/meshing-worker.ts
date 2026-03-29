import { Option } from 'effect'
import { greedyMeshChunk } from '@/infrastructure/three/meshing/greedy-meshing'
import { CHUNK_SIZE } from '@/domain/chunk'
import type { Chunk } from '@/domain/chunk'

// Message shapes for the meshing worker protocol.
//
// Input: chunk.blocks ArrayBuffer is *transferred* (zero-copy); transparentBlockIds is a
// small plain array (typically [6] for WATER). wx/wz are world-space block coordinates.
//
// Output: all TypedArrays are *transferred* back to main thread (zero-copy).
// null water arrays signal that this chunk has no transparent faces.
interface MeshRequest {
  readonly id: number
  readonly blocks: ArrayBuffer
  readonly wx: number
  readonly wz: number
  readonly transparentBlockIds: readonly number[]
}

;(self as DedicatedWorkerGlobalScope).onmessage = (e: MessageEvent<MeshRequest>): void => {
  const { id, blocks, wx, wz, transparentBlockIds } = e.data

  // Reconstruct a minimal Chunk — greedyMeshChunk only reads chunk.blocks; coord
  // is required by the type but unused inside the meshing algorithm (offset carries
  // the world position).
  const chunk: Chunk = {
    coord: { x: Math.floor(wx / CHUNK_SIZE), z: Math.floor(wz / CHUNK_SIZE) },
    blocks: new Uint8Array(blocks),
    fluid: Option.none(),
  }

  const result = greedyMeshChunk(
    chunk,
    { wx, wz },
    new Set(transparentBlockIds)
  )

  // toMeshed() calls .slice() on each accumulator subarray, producing owned ArrayBuffers
  // per typed array. This allocation is in the worker thread, not the main thread —
  // the main thread only receives transferred (detached) buffers, with zero GC cost.
  const meshed = result.toMeshed()
  const hasWater = meshed.water.positions.length > 0

  const transferList: ArrayBuffer[] = [
    meshed.opaque.positions.buffer,
    meshed.opaque.normals.buffer,
    meshed.opaque.colors.buffer,
    meshed.opaque.uvs.buffer,
    meshed.opaque.indices.buffer,
  ]

  if (hasWater) {
    transferList.push(
      meshed.water.positions.buffer,
      meshed.water.normals.buffer,
      meshed.water.colors.buffer,
      meshed.water.uvs.buffer,
      meshed.water.indices.buffer,
    )
  }

  ;(self as DedicatedWorkerGlobalScope).postMessage(
    {
      id,
      opositions: meshed.opaque.positions,
      onormals: meshed.opaque.normals,
      ocolors: meshed.opaque.colors,
      ouvs: meshed.opaque.uvs,
      oindices: meshed.opaque.indices,
      wpositions: hasWater ? meshed.water.positions : null,
      wnormals: hasWater ? meshed.water.normals : null,
      wcolors: hasWater ? meshed.water.colors : null,
      wuvs: hasWater ? meshed.water.uvs : null,
      windices: hasWater ? meshed.water.indices : null,
    },
    transferList
  )
}
