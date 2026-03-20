/**
 * Domain-specific error types for Minecraft clone
 *
 * These errors follow Effect-TS Data.TaggedError patterns for discriminated
 * union type narrowing, structural equality, and Effect.catchTag compatibility.
 *
 * Error handling should use Effect.catchTag('ErrorTag', ...) or pattern matching
 * via the _tag property — NOT runtime type guard functions.
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
 * Error type for settings operations
 */
export class SettingsError extends Data.TaggedError('SettingsError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = this.cause instanceof Error ? this.cause.message : this.cause ? String(this.cause) : ''
    return `Settings ${this.operation} failed${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

/**
 * Error type for application startup failures
 */
export class StartupError extends Data.TaggedError('StartupError')<{
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = this.cause instanceof Error ? this.cause.message : this.cause ? String(this.cause) : ''
    return `${this.reason}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

/**
 * Error type for camera creation failures
 */
export class CameraError extends Data.TaggedError('CameraError')<{
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = this.cause instanceof Error ? this.cause.message : this.cause ? String(this.cause) : ''
    return `Camera creation failed${causeMessage ? `: ${causeMessage}` : ''}`
  }
}
