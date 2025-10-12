// Re-export from shared kernel
export { ChunkIdError, ChunkIdSchema, type ChunkId } from '../../../shared/entities/chunk_id'

// Domain-specific operations (kept for backward compatibility)
export * from './operations'

// Legacy types (ChunkIdVersion, ChunkUUID)
export * from './types'
