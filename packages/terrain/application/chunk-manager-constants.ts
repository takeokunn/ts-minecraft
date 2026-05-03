import type { ChunkError } from '../domain/errors'
import type { StorageError } from '@ts-minecraft/world-state'

export const RENDER_DISTANCE = 8
export const UNLOAD_DISTANCE = 10
export const MAX_CACHED_CHUNKS = 400

export type ChunkManagerError = ChunkError | StorageError
