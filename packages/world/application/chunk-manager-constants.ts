import type { ChunkError } from '../domain/errors'
import type { StorageError } from '../domain/errors'

export const RENDER_DISTANCE = 4
export const UNLOAD_DISTANCE = 6
export const MAX_CACHED_CHUNKS = 400

export type ChunkManagerError = ChunkError | StorageError
