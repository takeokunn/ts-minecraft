import type { BlockType, InventoryItem, Position, SlotIndex } from '@ts-minecraft/core'
import type { ChunkCoord } from '@ts-minecraft/core'
import type { Chunk } from '../domain/chunk'
import type { PlacedBlock } from '../domain/placed-block'

export type PlaceBlockRequest = {
  readonly operation: string
  readonly position: Position
  readonly itemType: InventoryItem
  readonly preferredInventorySlot?: SlotIndex
}

export type PlaceBlockTarget = {
  readonly operation: string
  readonly position: Position
  readonly chunkCoord: ChunkCoord
  readonly chunk: Chunk
  readonly lx: number
  readonly y: number
  readonly lz: number
}

export type PlaceBlockPlan = {
  readonly target: PlaceBlockTarget
  readonly blockType: BlockType
  readonly placedBlocks: ReadonlyArray<PlacedBlock>
}
