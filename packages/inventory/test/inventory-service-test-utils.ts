import { Array as Arr, Effect, Layer, MutableHashMap, MutableRef } from 'effect'
import type { BlockType } from '@ts-minecraft/core'
import type { Block } from '@ts-minecraft/block'
import { BlockRegistry } from '@ts-minecraft/block'
import { InventoryServiceLive } from '@ts-minecraft/inventory'

export const asSlotIndex = (n: number): import('@ts-minecraft/core').SlotIndex => n as import('@ts-minecraft/core').SlotIndex

export const makeBlock = (type: BlockType): Block => ({
  id: `block:${type.toLowerCase()}` as Block['id'],
  type,
  properties: {
    hardness: 50,
    transparency: false,
    solid: true,
    emissive: false,
    friction: 0.6,
  },
  faces: {
    top: true,
    bottom: true,
    north: true,
    south: true,
    east: true,
    west: true,
  },
})

export const createTestBlockRegistry = (blocks: ReadonlyArray<Block> = []) => {
  const blockMapRef = MutableRef.make(MutableHashMap.empty<BlockType, Block>())
  Arr.forEach(blocks, (block) => {
    MutableHashMap.set(MutableRef.get(blockMapRef), block.type, block)
  })

  return BlockRegistry.of({
    _tag: '@minecraft/domain/BlockRegistry' as const,
    register: (block: Block) =>
      Effect.sync(() => {
        MutableHashMap.set(MutableRef.get(blockMapRef), block.type, block)
      }),
    get: (blockType: BlockType) =>
      Effect.sync(() => MutableHashMap.get(MutableRef.get(blockMapRef), blockType)),
    getAll: () => Effect.sync(() => Arr.fromIterable(MutableHashMap.values(MutableRef.get(blockMapRef)))),
    dispose: () =>
      Effect.sync(() => {
        MutableRef.set(blockMapRef, MutableHashMap.empty<BlockType, Block>())
      }),
  })
}

export const createTestLayer = (blockRegistry: ReturnType<typeof createTestBlockRegistry>) =>
  InventoryServiceLive.pipe(
    Layer.provide(Layer.succeed(BlockRegistry, blockRegistry))
  )

export const fullHotbarBlocks: ReadonlyArray<Block> = [
  makeBlock('AIR'),
  makeBlock('DIRT'),
  makeBlock('STONE'),
  makeBlock('WOOD'),
  makeBlock('GRASS'),
  makeBlock('SAND'),
  makeBlock('WATER'),
  makeBlock('LEAVES'),
  makeBlock('GLASS'),
  makeBlock('SNOW'),
  makeBlock('GRAVEL'),
  makeBlock('COBBLESTONE'),
]

export const limitedHotbarBlocks: ReadonlyArray<Block> = [
  makeBlock('AIR'),
  makeBlock('DIRT'),
  makeBlock('STONE'),
]

export const airOnlyBlocks: ReadonlyArray<Block> = [makeBlock('AIR')]
