/**
 * Domain-specific error types for Minecraft clone
 *
 * These errors follow Effect-TS Data.TaggedError patterns for discriminated
 * union type narrowing, structural equality, and Effect.catchTag compatibility.
 */
import { Data } from 'effect'

/**
 * Error type for texture loading failures
 */
export class TextureError extends Data.TaggedError('TextureError')<{
  readonly url: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = this.cause instanceof Error ? this.cause.message : this.cause ? String(this.cause) : ''
    return `Failed to load texture from ${this.url}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

/**
 * Error type for invalid block operations
 */
export class BlockError extends Data.TaggedError('BlockError')<{
  readonly blockType: string
  readonly reason: string
  readonly position?: readonly [number, number, number]
}> {
  override get message(): string {
    const positionStr = this.position
      ? ` at (${this.position[0]}, ${this.position[1]}, ${this.position[2]})`
      : ''
    return `Invalid block operation for type '${this.blockType}'${positionStr}: ${this.reason}`
  }
}

/**
 * Error type for mesh generation failures
 */
export class MeshError extends Data.TaggedError('MeshError')<{
  readonly reason: string
  readonly cause?: unknown
  readonly details?: string
}> {
  override get message(): string {
    const causeMessage = this.cause instanceof Error ? this.cause.message : this.cause ? String(this.cause) : ''
    const detailsStr = this.details ? ` (${this.details})` : ''
    return `Mesh generation failed: ${this.reason}${detailsStr}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

/**
 * Type guard for TextureError
 */
export const isTextureError = (error: unknown): error is TextureError =>
  typeof error === 'object' && error !== null && '_tag' in error && (error as { _tag: string })._tag === 'TextureError'

/**
 * Type guard for BlockError
 */
export const isBlockError = (error: unknown): error is BlockError =>
  typeof error === 'object' && error !== null && '_tag' in error && (error as { _tag: string })._tag === 'BlockError'

/**
 * Type guard for MeshError
 */
export const isMeshError = (error: unknown): error is MeshError =>
  typeof error === 'object' && error !== null && '_tag' in error && (error as { _tag: string })._tag === 'MeshError'

/**
 * Error type for player operations
 */
export class PlayerError extends Data.TaggedError('PlayerError')<{
  readonly playerId: string
  readonly reason: string
}> {
  override get message(): string {
    return `Player error for '${this.playerId}': ${this.reason}`
  }
}

/**
 * Error type for world operations
 */
export class WorldError extends Data.TaggedError('WorldError')<{
  readonly worldId: string
  readonly reason: string
  readonly position?: readonly [number, number, number]
}> {
  override get message(): string {
    const positionStr = this.position
      ? ` at (${this.position[0]}, ${this.position[1]}, ${this.position[2]})`
      : ''
    return `World error for '${this.worldId}'${positionStr}: ${this.reason}`
  }
}

/**
 * Error type for game loop operations
 */
export class GameLoopError extends Data.TaggedError('GameLoopError')<{
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = this.cause instanceof Error ? this.cause.message : this.cause ? String(this.cause) : ''
    return `Game loop error: ${this.reason}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

/**
 * Type guard for PlayerError
 */
export const isPlayerError = (error: unknown): error is PlayerError =>
  typeof error === 'object' && error !== null && '_tag' in error && (error as { _tag: string })._tag === 'PlayerError'

/**
 * Type guard for WorldError
 */
export const isWorldError = (error: unknown): error is WorldError =>
  typeof error === 'object' && error !== null && '_tag' in error && (error as { _tag: string })._tag === 'WorldError'

/**
 * Type guard for GameLoopError
 */
export const isGameLoopError = (error: unknown): error is GameLoopError =>
  typeof error === 'object' && error !== null && '_tag' in error && (error as { _tag: string })._tag === 'GameLoopError'

/**
 * Error type for storage operations
 */
export class StorageError extends Data.TaggedError('StorageError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = this.cause instanceof Error ? this.cause.message : this.cause ? String(this.cause) : ''
    return `Storage operation '${this.operation}' failed${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

/**
 * Type guard for StorageError
 */
export const isStorageError = (error: unknown): error is StorageError =>
  typeof error === 'object' && error !== null && '_tag' in error && (error as { _tag: string })._tag === 'StorageError'

/**
 * Error type for chunk operations
 */
export class ChunkError extends Data.TaggedError('ChunkError')<{
  readonly chunkCoord: { readonly x: number; readonly z: number }
  readonly reason: string
  readonly localPosition?: readonly [number, number, number]
}> {
  override get message(): string {
    const localPosStr = this.localPosition
      ? ` at local (${this.localPosition[0]}, ${this.localPosition[1]}, ${this.localPosition[2]})`
      : ''
    return `Chunk error at (${this.chunkCoord.x}, ${this.chunkCoord.z})${localPosStr}: ${this.reason}`
  }
}

/**
 * Type guard for ChunkError
 */
export const isChunkError = (error: unknown): error is ChunkError =>
  typeof error === 'object' && error !== null && '_tag' in error && (error as { _tag: string })._tag === 'ChunkError'

/**
 * Error type for physics operations
 */
export class PhysicsError extends Data.TaggedError('PhysicsError')<{
  readonly contextData: string
  readonly reason: string
}> {
  override get message(): string {
    return `Physics error for '${this.contextData}': ${this.reason}`
  }
}

/**
 * Type guard for PhysicsError
 */
export const isPhysicsError = (error: unknown): error is PhysicsError =>
  typeof error === 'object' && error !== null && '_tag' in error && (error as { _tag: string })._tag === 'PhysicsError'
