/**
 * Domain-specific error types for Minecraft clone
 *
 * These errors follow Effect-TS error patterns with `_tag` readonly property
 * for discriminated union type narrowing and error handling.
 */

/**
 * Error type for texture loading failures
 */
export class TextureError extends Error {
  readonly _tag = 'TextureError'

  /**
   * The URL that failed to load
   */
  readonly url: string

  /**
   * The underlying cause of error (if available)
   */
  readonly cause?: unknown

  constructor(url: string, cause?: unknown) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause)
    super(`Failed to load texture from ${url}${cause ? `: ${causeMessage}` : ''}`)
    this.name = 'TextureError'
    this.url = url
    this.cause = cause

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, TextureError.prototype)
  }
}

/**
 * Error type for invalid block operations
 */
export class BlockError extends Error {
  readonly _tag = 'BlockError'

  /**
   * The type of block that caused error
   */
  readonly blockType: string

  /**
   * The specific reason for error
   */
  readonly reason: string

  /**
   * Optional coordinates where error occurred
   */
  readonly position: readonly [number, number, number] | undefined

  constructor(blockType: string, reason: string, position?: readonly [number, number, number]) {
    const positionStr = position ? ` at (${position[0]}, ${position[1]}, ${position[2]})` : ''
    const message = `Invalid block operation for type '${blockType}'${positionStr}: ${reason}`
    super(message)
    this.name = 'BlockError'
    this.blockType = blockType
    this.reason = reason
    this.position = position

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, BlockError.prototype)
  }
}

/**
 * Error type for mesh generation failures
 */
export class MeshError extends Error {
  readonly _tag = 'MeshError'

  /**
   * The underlying cause of error (if available)
   */
  readonly cause?: unknown

  /**
   * Optional details about mesh generation failure
   */
  readonly details: string | undefined

  constructor(message: string, cause?: unknown, details?: string) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause)
    const detailsStr = details ? ` (${details})` : ''
    const fullMessage = `Mesh generation failed: ${message}${detailsStr}${cause ? `: ${causeMessage}` : ''}`
    super(fullMessage)
    this.name = 'MeshError'
    this.cause = cause
    this.details = details

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, MeshError.prototype)
  }
}

/**
 * Type guard for TextureError
 */
export const isTextureError = (error: unknown): error is TextureError =>
  error instanceof TextureError || (error instanceof Error && (error as TextureError)._tag === 'TextureError')

/**
 * Type guard for BlockError
 */
export const isBlockError = (error: unknown): error is BlockError =>
  error instanceof BlockError || (error instanceof Error && (error as BlockError)._tag === 'BlockError')

/**
 * Type guard for MeshError
 */
export const isMeshError = (error: unknown): error is MeshError =>
  error instanceof MeshError || (error instanceof Error && (error as MeshError)._tag === 'MeshError')
