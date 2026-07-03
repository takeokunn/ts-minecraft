import type { BlockType, InventoryItem } from '@ts-minecraft/core'

export type CropDrop = readonly [InventoryItem, number]
export type CropDropRule = {
  readonly unripeDrops: ReadonlyArray<CropDrop>
  readonly ripeDrops: (randomValue: number) => ReadonlyArray<CropDrop>
}

export const CROP_DROP_RULES: ReadonlyMap<BlockType, CropDropRule> = new Map<BlockType, CropDropRule>([
  [
    'WHEAT_CROP',
    {
      unripeDrops: [['WHEAT_SEEDS', 1]],
      ripeDrops: (randomValue) => [
        ['WHEAT', 1],
        ['WHEAT_SEEDS', Math.floor(randomValue * 4) + 1],
      ],
    },
  ],
  [
    'POTATO_CROP',
    {
      unripeDrops: [['POTATO', 1]],
      ripeDrops: (randomValue) => [['POTATO', Math.floor(randomValue * 4) + 2]],
    },
  ],
  [
    'NETHER_WART_CROP',
    {
      unripeDrops: [['NETHER_WART', 1]],
      // Vanilla mature nether wart: 2-4 warts.
      ripeDrops: (randomValue) => [['NETHER_WART', Math.floor(randomValue * 3) + 2]],
    },
  ],
])
