import type { BlockType, Position } from '@ts-minecraft/core'

export type StagedResourceBlock = {
  readonly pos: { readonly x: number; readonly y: number; readonly z: number }
  readonly blockType: BlockType
}

export type StagedZombiePosition = Position | null
