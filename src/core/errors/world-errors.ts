import { Data } from 'effect'
import type { ChunkCoordinates, Position } from '@/domain/values/coordinates'
import type { BlockType } from '@/domain/values/block-type'
import type { Query } from '@/domain/query'
import type { ComponentName } from '@/core/components'
import { ParseError } from 'effect/ParseResult'

/**
 * World-related errors
 */

export class ChunkNotLoadedError extends Data.TaggedError('ChunkNotLoadedError')<{
  readonly coordinates: ChunkCoordinates
  readonly timestamp: Date
}> {
  constructor(coordinates: ChunkCoordinates) {
    super({ coordinates, timestamp: new Date() })
  }
}

export class InvalidPositionError extends Data.TaggedError('InvalidPositionError')<{
  readonly position: Position
  readonly reason: string
  readonly timestamp: Date
}> {
  constructor(position: Position, reason: string) {
    super({ position, reason, timestamp: new Date() })
  }
}

export class BlockNotFoundError extends Data.TaggedError('BlockNotFoundError')<{
  readonly position: Position
  readonly timestamp: Date
}> {
  constructor(position: Position) {
    super({ position, timestamp: new Date() })
  }
}

export class InvalidBlockTypeError extends Data.TaggedError('InvalidBlockTypeError')<{
  readonly blockType: BlockType
  readonly reason: string
  readonly timestamp: Date
}> {
  constructor(blockType: BlockType, reason: string) {
    super({ blockType, reason, timestamp: new Date() })
  }
}

export class WorldStateError extends Data.TaggedError('WorldStateError')<{
  readonly operation: string
  readonly reason: string
  readonly timestamp: Date
}> {
  constructor(operation: string, reason: string) {
    super({ operation, reason, timestamp: new Date() })
  }
}

export class ArchetypeNotFoundError extends Data.TaggedError('ArchetypeNotFoundError')<{
  readonly archetypeKey: string
  readonly timestamp: Date
}> {
  constructor(archetypeKey: string) {
    super({ archetypeKey, timestamp: new Date() })
  }
}

export class QuerySingleResultNotFoundError extends Data.TaggedError('QuerySingleResultNotFoundError')<{
  readonly query: Query<ReadonlyArray<ComponentName>>
  readonly timestamp: Date
}> {
  constructor(query: Query<ReadonlyArray<ComponentName>>) {
    super({ query, timestamp: new Date() })
  }
}

export class ComponentDecodeError extends Data.TaggedError('ComponentDecodeError')<{
  readonly entityId: string
  readonly componentName: ComponentName
  readonly error: ParseError
  readonly timestamp: Date
}> {
  constructor(entityId: string, componentName: ComponentName, error: ParseError) {
    super({ entityId, componentName, error, timestamp: new Date() })
  }
}