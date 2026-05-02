import type { BlockType } from '@ts-minecraft/kernel'

export type EntityDrop = {
  readonly blockType: BlockType
  readonly count: number
}
