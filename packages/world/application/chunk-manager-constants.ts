import type { ChunkError } from '../domain/errors'
import type { StorageError } from '../domain/errors'

export const RENDER_DISTANCE = 8 // raised from 4 (R115) — better view distance while still playable
export const UNLOAD_DISTANCE = 6
export const MAX_CACHED_CHUNKS = 400

export type ChunkManagerError = ChunkError | StorageError
