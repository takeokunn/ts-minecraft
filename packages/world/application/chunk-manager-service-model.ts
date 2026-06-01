export type ChunkLoadOptions = {
  readonly eager?: boolean
}

export const MAX_CHUNK_LOADS_PER_CALL = 4
export const CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE = 3
