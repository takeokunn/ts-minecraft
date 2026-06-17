export type QaChunkCoord = {
  readonly x: number
  readonly z: number
}

export type QaChunkMeshSnapshot = {
  readonly chunkCoord: QaChunkCoord
  readonly type: string
  readonly visible: boolean
  readonly vertexCount: number
  readonly indexCount: number
  readonly hasUv: boolean
  readonly hasTileIndex: boolean
  readonly tileIndexCount: number
  readonly materialType: string
  readonly textureLoaded: boolean
}

export type QaRenderingSnapshot = {
  readonly sceneChildren: number
  readonly chunkMeshCount: number
  readonly visibleChunkMeshCount: number
  readonly camera: { readonly x: number; readonly y: number; readonly z: number; readonly near: number; readonly far: number }
  readonly chunks: ReadonlyArray<QaChunkMeshSnapshot>
}
