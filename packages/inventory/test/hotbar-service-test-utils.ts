import { Array as Arr, Effect, Layer, MutableHashMap, MutableHashSet, MutableRef } from 'effect'
import { BlockType } from '@ts-minecraft/core'
import { Block } from '@ts-minecraft/block'
import { BlockRegistry } from '@ts-minecraft/block'
import { PlayerInputService } from '@ts-minecraft/entity'
import { InventoryServiceLive } from '@ts-minecraft/inventory'
import { HotbarServiceLive } from '@ts-minecraft/inventory'
import type { SlotIndex } from '@ts-minecraft/core'

export const asSlotIndex = (n: number): SlotIndex => n as SlotIndex

export const createTestInputService = (config: {
  justPressedKeys?: ReadonlyArray<string>
  wheelDelta?: number
} = {}) => {
  const justPressedKeys = MutableHashSet.fromIterable(config.justPressedKeys ?? [])
  const pendingWheelDeltaRef = MutableRef.make(config.wheelDelta ?? 0)

  return Object.assign(
    PlayerInputService.of({
      _tag: '@minecraft/application/PlayerInputService' as const,
      isKeyPressed: (_key: string) => Effect.sync(() => false),
      consumeKeyPress: (key: string) =>
        Effect.sync(() => {
          if (MutableHashSet.has(justPressedKeys, key)) {
            MutableHashSet.remove(justPressedKeys, key)
            return true
          }
          return false
        }),
      consumeWheelDelta: () =>
        Effect.sync(() => {
          const delta = MutableRef.get(pendingWheelDeltaRef)
          MutableRef.set(pendingWheelDeltaRef, 0)
          return delta
        }),
      getMouseDelta: () => Effect.sync(() => ({ x: 0, y: 0 })),
      isPointerLocked: () => Effect.sync(() => false),
    }),
    {
      simulateKeyPress: (key: string) => {
        MutableHashSet.add(justPressedKeys, key)
      },
      setWheelDelta: (delta: number) => {
        MutableRef.set(pendingWheelDeltaRef, delta)
      },
    },
  )
}

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

export const defaultTestBlocks: ReadonlyArray<Block> = [
  makeBlock('AIR'),
  makeBlock('DIRT'),
  makeBlock('STONE'),
  makeBlock('WOOD'),
  makeBlock('GRASS'),
  makeBlock('SAND'),
  makeBlock('WATER'),
  makeBlock('LEAVES'),
  makeBlock('GLASS'),
]

export const createTestLayer = (
  inputService: ReturnType<typeof createTestInputService>,
  blockRegistry: ReturnType<typeof createTestBlockRegistry>
) => {
  const inputLayer = Layer.succeed(PlayerInputService, inputService)
  const blockRegistryLayer = Layer.succeed(BlockRegistry, blockRegistry)
  const inventoryLayer = InventoryServiceLive.pipe(
    Layer.provide(blockRegistryLayer)
  )

  return Layer.mergeAll(
    inventoryLayer,
    HotbarServiceLive.pipe(
      Layer.provide(inputLayer),
      Layer.provide(inventoryLayer)
    )
  )
}
