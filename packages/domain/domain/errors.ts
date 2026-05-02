// Domain error types — all extend Data.TaggedError for Effect.catchTag compatibility.
import { Data } from 'effect'
import type { ChunkCoord } from './chunk'

const formatCause = (cause?: unknown): string =>
  cause instanceof Error ? cause.message : cause ? String(cause) : ''

export class TextureError extends Data.TaggedError('TextureError')<{
  readonly url: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    return `Failed to load texture from ${this.url}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

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

export class MeshError extends Data.TaggedError('MeshError')<{
  readonly reason: string
  readonly cause?: unknown
  readonly details?: string
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    const detailsStr = this.details ? ` (${this.details})` : ''
    return `Mesh generation failed: ${this.reason}${detailsStr}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

export class PlayerError extends Data.TaggedError('PlayerError')<{
  readonly playerId: string
  readonly reason: string
}> {
  override get message(): string {
    return `Player error for '${this.playerId}': ${this.reason}`
  }
}

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

export class GameLoopError extends Data.TaggedError('GameLoopError')<{
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    return `Game loop error: ${this.reason}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

export class StorageError extends Data.TaggedError('StorageError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    return `Storage operation '${this.operation}' failed${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

export class ChunkError extends Data.TaggedError('ChunkError')<{
  readonly chunkCoord: ChunkCoord
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

export class SettingsError extends Data.TaggedError('SettingsError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    return `Settings ${this.operation} failed${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

export class StartupError extends Data.TaggedError('StartupError')<{
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    return `${this.reason}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

export class InventoryError extends Data.TaggedError('InventoryError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return this.cause
      ? `Inventory error [${this.operation}]: ${String(this.cause)}`
      : `Inventory error [${this.operation}]`
  }
}

export class RecipeError extends Data.TaggedError('RecipeError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return this.cause
      ? `Recipe error [${this.operation}]: ${String(this.cause)}`
      : `Recipe error [${this.operation}]`
  }
}

export class CameraError extends Data.TaggedError('CameraError')<{
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = formatCause(this.cause)
    return `Camera creation failed${causeMessage ? `: ${causeMessage}` : ''}`
  }
}
