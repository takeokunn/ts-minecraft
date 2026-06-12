import type { ChunkError } from '../domain/errors'
import type { StorageError } from '../domain/errors'

export const RENDER_DISTANCE = 8 // raised from 4 (R115) — better view distance while still playable
export const UNLOAD_DISTANCE = 10 // RENDER_DISTANCE (8) + 2 = 10 (R115)
export const MAX_CACHED_CHUNKS = 400

export type ChunkManagerError = ChunkError | StorageError
