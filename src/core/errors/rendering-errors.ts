import { Data } from 'effect'

/**
 * Rendering-related errors
 */

export class RenderingError extends Data.TaggedError('RenderingError')<{
  readonly operation: string
  readonly details: string
  readonly timestamp: Date
}> {
  constructor(operation: string, details: string) {
    super({ operation, details, timestamp: new Date() })
  }
}

export class TextureNotFoundError extends Data.TaggedError('TextureNotFoundError')<{
  readonly textureName: string
  readonly timestamp: Date
}> {
  constructor(textureName: string) {
    super({ textureName, timestamp: new Date() })
  }
}

export class MaterialNotFoundError extends Data.TaggedError('MaterialNotFoundError')<{
  readonly materialName: string
  readonly timestamp: Date
}> {
  constructor(materialName: string) {
    super({ materialName, timestamp: new Date() })
  }
}