import { PlacedBlock } from './messages'

export type MeshData = {
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  indices: Uint32Array
}

export const generateGreedyMesh = (
  _blocks: PlacedBlock[],
  _chunkX: number,
  _chunkZ: number,
): MeshData => {
  // TODO: Implement greedy meshing algorithm
  // For now, return empty arrays as placeholders
  return {
    positions: new Float32Array(0),
    normals: new Float32Array(0),
    uvs: new Float32Array(0),
    indices: new Uint32Array(0),
  }
}