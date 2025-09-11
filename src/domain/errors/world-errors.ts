import { defineError } from './generator'
import { WorldError } from './base-errors'
import type { ChunkCoordinates, Position } from '@/domain/value-objects/coordinates'
import type { BlockType } from '@/domain/value-objects/block-type.vo'
import type { LegacyQuery, OptimizedQuery } from '@/domain/queries'
import type { ComponentName } from '@/domain/entities/components'
import * as ParseResult from 'effect/ParseResult'

/**
 * Chunk not loaded in memory
 * Recovery: Load chunk or use cached data
 */
export const ChunkNotLoadedError = defineError<{
  readonly coordinates: ChunkCoordinates
  readonly requestedOperation: string
  readonly loadingState?: 'pending' | 'failed' | 'not-requested'
}>('ChunkNotLoadedError', WorldError, 'retry', 'medium')

/**
 * Invalid world position (out of bounds, etc.)
 * Recovery: Clamp to valid bounds or use fallback position
 */
export const InvalidPositionError = defineError<{
  readonly position: Position
  readonly reason: string
  readonly validBounds?: { min: Position; max: Position }
}>('InvalidPositionError', WorldError, 'fallback', 'low')

/**
 * Block not found at specified position
 * Recovery: Return air block or generate default block
 */
export const BlockNotFoundError = defineError<{
  readonly position: Position
  readonly expectedBlockType?: BlockType
  readonly chunkState?: string
}>('BlockNotFoundError', WorldError, 'fallback', 'low')

/**
 * Invalid block type specified
 * Recovery: Use default block type or prompt for correction
 */
export const InvalidBlockTypeError = defineError<{
  readonly blockType: BlockType
  readonly reason: string
  readonly validBlockTypes?: BlockType[]
  readonly operation: string
}>('InvalidBlockTypeError', WorldError, 'fallback', 'medium')

/**
 * World state inconsistency or corruption
 * Recovery: Reload world state or reset to last known good state
 */
export const WorldStateError = defineError<{
  readonly operation: string
  readonly reason: string
  readonly affectedRegion?: { from: Position; to: Position }
  readonly stateVersion?: number
}>('WorldStateError', WorldError, 'retry', 'high')

/**
 * Entity archetype not found in world
 * Recovery: Use default archetype or create new archetype
 */
export const ArchetypeNotFoundError = defineError<{
  readonly archetypeKey: string
  readonly requestedComponents: string[]
  readonly availableArchetypes?: string[]
}>('ArchetypeNotFoundError', WorldError, 'fallback', 'medium')

/**
 * Query expected single result but found none or multiple
 * Recovery: Return first result or use fallback entity
 */
export const QuerySingleResultNotFoundError = defineError<{
  readonly query: LegacyQuery<ReadonlyArray<ComponentName>> | OptimizedQuery<ReadonlyArray<ComponentName>>
  readonly resultCount: number
  readonly expectedCount: 1
}>('QuerySingleResultNotFoundError', WorldError, 'fallback', 'medium')

/**
 * Component data decoding failed
 * Recovery: Use default component data or skip component
 */
export const ComponentDecodeError = defineError<{
  readonly entityId: string
  readonly componentName: ComponentName
  readonly parseError: ParseResult.ParseError
  readonly rawData?: unknown
}>('ComponentDecodeError', WorldError, 'fallback', 'medium')

/**
 * Chunk generation failed
 * Recovery: Retry generation with different seed or use empty chunk
 */
export const ChunkGenerationError = defineError<{
  readonly coordinates: ChunkCoordinates
  readonly generatorName: string
  readonly reason: string
  readonly seed?: number
}>('ChunkGenerationError', WorldError, 'retry', 'high')

/**
 * World save operation failed
 * Recovery: Retry save or cache changes for later save
 */
export const WorldSaveError = defineError<{
  readonly savePath: string
  readonly reason: string
  readonly affectedChunks: ChunkCoordinates[]
  readonly dataSize?: number
}>('WorldSaveError', WorldError, 'retry', 'high')

/**
 * World load operation failed
 * Recovery: Load from backup or create new world
 */
export const WorldLoadError = defineError<{
  readonly loadPath: string
  readonly reason: string
  readonly corruptedSections?: string[]
  readonly backupAvailable?: boolean
}>('WorldLoadError', WorldError, 'fallback', 'high')

/**
 * Block placement validation failed
 * Recovery: Use nearest valid position or cancel placement
 */
export const BlockPlacementError = defineError<{
  readonly position: Position
  readonly blockType: BlockType
  readonly reason: string
  readonly conflictingBlocks?: Position[]
}>('BlockPlacementError', WorldError, 'fallback', 'low')

/**
 * World tick processing failed
 * Recovery: Skip failed systems or rollback tick
 */
export const WorldTickError = defineError<{
  readonly tickNumber: number
  readonly failedSystems: string[]
  readonly reason: string
  readonly duration?: number
}>('WorldTickError', WorldError, 'retry', 'medium')