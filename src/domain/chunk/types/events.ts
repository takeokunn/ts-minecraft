import { Data } from 'effect'
import { type BlockId } from '../aggregate/chunk'
import { type ChunkId } from '../value_object/chunk_id'
import { type ChunkPosition } from '../value_object/chunk_position'

/**
 * チャンク関連イベント（Event Sourcingパターン）
 */

export class ChunkCreatedEvent extends Data.TaggedClass('ChunkCreatedEvent')<{
  readonly chunkId: ChunkId
  readonly position: ChunkPosition
  readonly timestamp: number
}> {}

export class ChunkLoadedEvent extends Data.TaggedClass('ChunkLoadedEvent')<{
  readonly chunkId: ChunkId
  readonly position: ChunkPosition
  readonly timestamp: number
}> {}

export class ChunkUnloadedEvent extends Data.TaggedClass('ChunkUnloadedEvent')<{
  readonly chunkId: ChunkId
  readonly position: ChunkPosition
  readonly timestamp: number
}> {}

export class ChunkModifiedEvent extends Data.TaggedClass('ChunkModifiedEvent')<{
  readonly chunkId: ChunkId
  readonly position: ChunkPosition
  readonly modifiedBlocks: number
  readonly timestamp: number
}> {}

export class BlockChangedEvent extends Data.TaggedClass('BlockChangedEvent')<{
  readonly chunkId: ChunkId
  readonly x: number
  readonly y: number
  readonly z: number
  readonly oldBlockId: BlockId
  readonly newBlockId: BlockId
  readonly timestamp: number
}> {}

export class ChunkSavedEvent extends Data.TaggedClass('ChunkSavedEvent')<{
  readonly chunkId: ChunkId
  readonly position: ChunkPosition
  readonly dataSize: number
  readonly timestamp: number
}> {}

export class ChunkCorruptedEvent extends Data.TaggedClass('ChunkCorruptedEvent')<{
  readonly chunkId: ChunkId
  readonly position: ChunkPosition
  readonly error: string
  readonly timestamp: number
}> {}

/**
 * すべてのチャンクイベントの型Union
 */
export type ChunkEvent =
  | ChunkCreatedEvent
  | ChunkLoadedEvent
  | ChunkUnloadedEvent
  | ChunkModifiedEvent
  | BlockChangedEvent
  | ChunkSavedEvent
  | ChunkCorruptedEvent
