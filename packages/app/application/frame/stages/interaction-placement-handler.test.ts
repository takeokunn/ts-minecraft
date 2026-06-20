import { describe, it } from '@effect/vitest'
import { Effect, HashMap, MutableRef, Option } from 'effect'
import { expect, vi } from 'vitest'
import { CHUNK_SIZE, CHUNK_HEIGHT, SlotIndex, blockTypeToIndex } from '@ts-minecraft/core'
import type { BlockType, InventoryItem } from '@ts-minecraft/core'
import { buildPlayerXP } from '@ts-minecraft/entity/domain/player-xp-calc'
import { TNT_EXPLOSION_POWER } from '@ts-minecraft/entity/domain/explosion'
import { computeExplosionDamageAt } from '@ts-minecraft/entity/domain/explosion-resolution'
import { EXHAUSTION_DAMAGE } from '@ts-minecraft/entity/application/hunger-service.config'
import { createStack, enchantmentsOf, type ItemStack } from '@ts-minecraft/inventory/domain/item-stack'
import type { Chunk } from '@ts-minecraft/world'
import { handleBed, handleDoor, handleRightClick } from '@ts-minecraft/app/frame/stages/interaction-placement-handler'
import { handleBucket } from '@ts-minecraft/app/frame/stages/interaction-bucket-handler/bucket-handler'
import { handleFlintAndSteel } from '@ts-minecraft/app/frame/stages/interaction-flint-steel-handler'
import { selectedHotbarSlotIndex } from '@ts-minecraft/app/frame/stages/selected-hotbar-slot'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import type { FrameBedInteractionServices } from '@ts-minecraft/app/application/frame/frame-interaction-service-types/bed'
import type { FrameBucketInteractionServices } from '@ts-minecraft/app/application/frame/frame-interaction-service-types/bucket'
import type { FrameDoorInteractionServices } from '@ts-minecraft/app/application/frame/frame-interaction-service-types/door'
import type { FrameFlintAndSteelInteractionServices } from '@ts-minecraft/app/application/frame/frame-interaction-service-types/flint-and-steel'
import type { FrameRightClickInteractionServices } from '@ts-minecraft/app/application/frame/frame-interaction-service-types/right-click'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const makeEmptyChunk = (cx: number, cz: number): Chunk => ({
  coord: { x: cx, z: cz },
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
  fluid: Option.none(),
})

const setChunkBlock = (chunk: Chunk, lx: number, y: number, lz: number, type: BlockType): void => {
  chunk.blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] = blockTypeToIndex(type)
}

// Portal frame: 2-wide × 3-tall, x-axis aligned (fixed z=0).
// Interior (AIR): x∈{0,1}, y∈{64,65,66}, z=0
// Frame edges (OBSIDIAN, corners excluded per vanilla):
//   bottom: (0,63,0),(1,63,0) — chunk (0,0): lx=0,1 y=63 lz=0
//   top:    (0,67,0),(1,67,0) — chunk (0,0): lx=0,1 y=67 lz=0
//   right:  (2,64..66,0)       — chunk (0,0): lx=2   y=64-66 lz=0
//   left:   (−1,64..66,0)      — chunk (−1,0): lx=15 y=64-66 lz=0
const makePortalChunkMap = (): Map<string, Chunk> => {
  const c0 = makeEmptyChunk(0, 0)
  setChunkBlock(c0, 0, 63, 0, 'OBSIDIAN')
  setChunkBlock(c0, 1, 63, 0, 'OBSIDIAN')
  setChunkBlock(c0, 0, 67, 0, 'OBSIDIAN')
  setChunkBlock(c0, 1, 67, 0, 'OBSIDIAN')
  setChunkBlock(c0, 2, 64, 0, 'OBSIDIAN')
  setChunkBlock(c0, 2, 65, 0, 'OBSIDIAN')
  setChunkBlock(c0, 2, 66, 0, 'OBSIDIAN')

  const cNeg1 = makeEmptyChunk(-1, 0)
  // x=−1 → cx=floor(−1/16)=−1, lx=((−1%16)+16)%16=15
  setChunkBlock(cNeg1, 15, 64, 0, 'OBSIDIAN')
  setChunkBlock(cNeg1, 15, 65, 0, 'OBSIDIAN')
  setChunkBlock(cNeg1, 15, 66, 0, 'OBSIDIAN')

  return new Map([['0,0', c0], ['-1,0', cNeg1]])
}

// A TargetRayHit on the bottom OBSIDIAN block's top face → ignitionPos = (0,64,0) = interior AIR
const makePortalHit = (): TargetRayHit => ({
  blockX: 0,
  blockY: 63,
  blockZ: 0,
  distance: 3,
  normal: { x: 0, y: 1, z: 0 },
})

const makeServices = (opts: {
  forceSetBlockSpy?: ReturnType<typeof vi.fn>
  registerPortalSpy?: ReturnType<typeof vi.fn>
  damageSlotSpy?: ReturnType<typeof vi.fn>
  getSelectedSlotSpy?: ReturnType<typeof vi.fn>
  getChunkFn?: (coord: { x: number; z: number }) => Effect.Effect<Chunk, Error>
} = {}) => {
  const forceSetBlockSpy = opts.forceSetBlockSpy ?? vi.fn(() => Effect.void)
  const registerPortalSpy = opts.registerPortalSpy ?? vi.fn(() => Effect.void)
  const damageSlotSpy = opts.damageSlotSpy ?? vi.fn(() => Effect.void)
  const getSelectedSlotSpy = opts.getSelectedSlotSpy ?? vi.fn(() => Effect.succeed(SlotIndex.make(2)))
  return {
    blockService: { forceSetBlock: forceSetBlockSpy },
    chunkManagerService: {
      getChunk: opts.getChunkFn ?? ((_coord) => Effect.succeed(makeEmptyChunk(0, 0))),
    },
    gameState: {
      getPlayerPosition: vi.fn(() => Effect.succeed({ x: 0, y: 64, z: 0 })),
    },
    gameMode: {
      isSpectator: vi.fn(() => Effect.succeed(false)),
    },
    netherService: { registerPortal: registerPortalSpy },
    hotbarService: { getSelectedSlot: getSelectedSlotSpy },
    inventoryService: { damageSlot: damageSlotSpy },
    healthService: {
      getHealth: vi.fn(() => Effect.succeed({ current: 20, max: 20, invincibilityTicks: 0 })),
      applyDamage: vi.fn(() => Effect.void),
    },
    hungerService: {
      addExhaustion: vi.fn(() => Effect.void),
    },
    equipmentService: {
      getTotalArmorPoints: vi.fn(() => Effect.succeed(0)),
      getTotalProtectionReduction: vi.fn(() => Effect.succeed(0)),
      getTotalBlastProtectionReduction: vi.fn(() => Effect.succeed(0)),
    },
    soundManager: { playEffect: vi.fn(() => Effect.void) },
    _forceSetBlockSpy: forceSetBlockSpy,
    _registerPortalSpy: registerPortalSpy,
    _damageSlotSpy: damageSlotSpy,
    _getSelectedSlotSpy: getSelectedSlotSpy,
  } as FrameFlintAndSteelInteractionServices & {
    blockService: { forceSetBlock: ReturnType<typeof vi.fn> }
    chunkManagerService: { getChunk: (coord: { x: number; z: number }) => Effect.Effect<Chunk, Error> }
    gameState: { getPlayerPosition: ReturnType<typeof vi.fn> }
    gameMode: { isSpectator: ReturnType<typeof vi.fn> }
    netherService: { registerPortal: ReturnType<typeof vi.fn> }
    hotbarService: { getSelectedSlot: ReturnType<typeof vi.fn> }
    inventoryService: { damageSlot: ReturnType<typeof vi.fn> }
    healthService: { getHealth: ReturnType<typeof vi.fn>; applyDamage: ReturnType<typeof vi.fn> }
    hungerService: { addExhaustion: ReturnType<typeof vi.fn> }
    equipmentService: {
      getTotalArmorPoints: ReturnType<typeof vi.fn>
      getTotalProtectionReduction: ReturnType<typeof vi.fn>
      getTotalBlastProtectionReduction: ReturnType<typeof vi.fn>
    }
    soundManager: { playEffect: ReturnType<typeof vi.fn> }
    _forceSetBlockSpy: ReturnType<typeof vi.fn>
    _registerPortalSpy: ReturnType<typeof vi.fn>
    _damageSlotSpy: ReturnType<typeof vi.fn>
    _getSelectedSlotSpy: ReturnType<typeof vi.fn>
  }
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('interaction-placement-handler / handleFlintAndSteel', () => {
  it.effect('returns false immediately when targetHit is none', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const services = makeServices()
      const result = yield* handleFlintAndSteel(
        services,
        { dirtyChunksRef },
        { targetHit: Option.none() },
      )
      expect(result).toBe(false)
      expect(services._damageSlotSpy).not.toHaveBeenCalled()
    }),
  )

  it.effect('places FIRE in adjacent AIR when no valid OBSIDIAN frame surrounds ignition', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const services = makeServices({
        // All chunks are empty (AIR) — no portal frame
        getChunkFn: (coord) => Effect.succeed(makeEmptyChunk(coord.x, coord.z)),
      })
      const hit: TargetRayHit = { blockX: 10, blockY: 64, blockZ: 10, distance: 3, normal: { x: 0, y: 1, z: 0 } }
      const result = yield* handleFlintAndSteel(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(hit) },
      )
      expect(result).toBe(true)
      expect(services._forceSetBlockSpy).toHaveBeenCalledWith({ x: 10, y: 65, z: 10 }, 'FIRE')
      expect(services._damageSlotSpy).toHaveBeenCalledWith(selectedHotbarSlotIndex(SlotIndex.make(2)), 1)
      expect(services.soundManager.playEffect).toHaveBeenCalledWith('blockPlace', { position: { x: 10, y: 65, z: 10 } })
    }),
  )

  it.effect('returns false when FIRE ignition target is occupied', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const chunk = makeEmptyChunk(0, 0)
      setChunkBlock(chunk, 10, 64, 10, 'STONE')
      setChunkBlock(chunk, 10, 65, 10, 'STONE')
      const services = makeServices({
        getChunkFn: (coord) => Effect.succeed(coord.x === 0 && coord.z === 0 ? chunk : makeEmptyChunk(coord.x, coord.z)),
      })
      const hit: TargetRayHit = { blockX: 10, blockY: 64, blockZ: 10, distance: 3, normal: { x: 0, y: 1, z: 0 } }
      const result = yield* handleFlintAndSteel(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(hit) },
      )
      expect(result).toBe(false)
      expect(services._forceSetBlockSpy).not.toHaveBeenCalled()
      expect(services._damageSlotSpy).not.toHaveBeenCalled()
    }),
  )

  it.effect('ignites portal and returns true when a valid 2×3 OBSIDIAN frame is present', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const portalChunks = makePortalChunkMap()
      const forceSetBlockSpy = vi.fn(() => Effect.void)
      const registerPortalSpy = vi.fn(() => Effect.void)
      const services = makeServices({
        forceSetBlockSpy,
        registerPortalSpy,
        getChunkFn: (coord) => {
          const key = `${coord.x},${coord.z}`
          const chunk = portalChunks.get(key) ?? makeEmptyChunk(coord.x, coord.z)
          return Effect.succeed(chunk)
        },
      })

      const result = yield* handleFlintAndSteel(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(makePortalHit()) },
      )

      // 6 interior cells (2 wide × 3 tall) each receive NETHER_PORTAL
      expect(forceSetBlockSpy).toHaveBeenCalledTimes(6)
      expect(registerPortalSpy).toHaveBeenCalledOnce()
      expect(services._damageSlotSpy).toHaveBeenCalledWith(selectedHotbarSlotIndex(SlotIndex.make(2)), 1)
      expect(result).toBe(true)
    }),
  )

  it.effect('falls back to FIRE when a portal-neighborhood chunk is unreadable but ignition cell is readable', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const portalChunks = makePortalChunkMap()
      const forceSetBlockSpy = vi.fn(() => Effect.void)
      const registerPortalSpy = vi.fn(() => Effect.void)
      const services = makeServices({
        forceSetBlockSpy,
        registerPortalSpy,
        getChunkFn: (coord) => {
          if (coord.x === 1 && coord.z === 1) return Effect.fail(new Error('chunk unavailable'))
          return Effect.succeed(portalChunks.get(`${coord.x},${coord.z}`) ?? makeEmptyChunk(coord.x, coord.z))
        },
      })

      const result = yield* handleFlintAndSteel(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(makePortalHit()) },
      )

      expect(result).toBe(true)
      expect(forceSetBlockSpy).toHaveBeenCalledOnce()
      expect(forceSetBlockSpy).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 }, 'FIRE')
      expect(registerPortalSpy).not.toHaveBeenCalled()
      expect(services._damageSlotSpy).toHaveBeenCalledWith(selectedHotbarSlotIndex(SlotIndex.make(2)), 1)
    }),
  )

  it.effect('still returns true when forceSetBlock fails (errors are caught per-block)', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const portalChunks = makePortalChunkMap()
      const services = makeServices({
        // forceSetBlock always fails — errors are caught individually, should not abort portal
        forceSetBlockSpy: vi.fn(() => Effect.fail(new Error('chunk error'))),
        getChunkFn: (coord) => Effect.succeed(portalChunks.get(`${coord.x},${coord.z}`) ?? makeEmptyChunk(coord.x, coord.z)),
      })

      const result = yield* handleFlintAndSteel(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(makePortalHit()) },
      )
      expect(result).toBe(true)
      expect(services._damageSlotSpy).toHaveBeenCalledWith(selectedHotbarSlotIndex(SlotIndex.make(2)), 1)
    }),
  )
})

// ---------------------------------------------------------------------------
// R26: water/lava buckets
// ---------------------------------------------------------------------------

const makeBucketServices = (
  heldItem: InventoryItem,
  targetBlock: BlockType = 'AIR',
): { services: FrameBucketInteractionServices; spies: {
  removeBlock: ReturnType<typeof vi.fn>
  addBlock: ReturnType<typeof vi.fn>
  forceSetBlock: ReturnType<typeof vi.fn>
  seedWater: ReturnType<typeof vi.fn>
  seedLava: ReturnType<typeof vi.fn>
  removeWater: ReturnType<typeof vi.fn>
  removeLava: ReturnType<typeof vi.fn>
} } => {
  const removeBlock = vi.fn(() => Effect.void)
  const addBlock = vi.fn(() => Effect.void)
  const forceSetBlock = vi.fn(() => Effect.void)
  const seedWater = vi.fn(() => Effect.void)
  const seedLava = vi.fn(() => Effect.void)
  const removeWater = vi.fn(() => Effect.void)
  const removeLava = vi.fn(() => Effect.void)
  const notifyBlockChanged = vi.fn(() => Effect.void)
  // A chunk whose voxel (lx=0,y=63,lz=0) carries the target block — this is the
  // voxel `bucketHit` points AT, which the FILL branch reads to detect a source.
  const chunk = makeEmptyChunk(0, 0)
  setChunkBlock(chunk, 0, 63, 0, targetBlock)
  const services = {
    hotbarService: {
      getSelectedBlockType: () => Effect.succeed(Option.some(heldItem)),
      getSelectedSlot: () => Effect.succeed(0),
    },
    inventoryService: { removeBlock, addBlock },
    blockService: { forceSetBlock },
    chunkManagerService: { getChunk: () => Effect.succeed(chunk) },
    fluidService: { seedWater, seedLava, removeWater, removeLava, notifyBlockChanged },
    soundManager: { playEffect: vi.fn(() => Effect.void) },
  }
  return { services, spies: { removeBlock, addBlock, forceSetBlock, seedWater, seedLava, removeWater, removeLava } }
}

// hit on the top face of block (0,63,0) → adjacent air = (0,64,0); also the
// FILL target voxel the mock chunk is seeded at.
const bucketHit: TargetRayHit = { blockX: 0, blockY: 63, blockZ: 0, distance: 3, normal: { x: 0, y: 1, z: 0 } }

describe('interaction-placement-handler / handleBucket', () => {
  it.effect('returns false when there is no target hit', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const { services, spies } = makeBucketServices('BUCKET', 'WATER')
      const result = yield* handleBucket(services, { dirtyChunksRef }, { targetHit: Option.none() })
      expect(result).toBe(false)
      expect(spies.removeWater).not.toHaveBeenCalled()
      expect(spies.addBlock).not.toHaveBeenCalled()
    }),
  )

  it.effect('returns false for a non-bucket held item', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const { services } = makeBucketServices('STONE')
      const result = yield* handleBucket(services, { dirtyChunksRef }, { targetHit: Option.some(bucketHit) })
      expect(result).toBe(false)
    }),
  )

  it.effect('empties a WATER_BUCKET: seeds water at the adjacent cell and swaps to an empty BUCKET', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const { services, spies } = makeBucketServices('WATER_BUCKET')
      const result = yield* handleBucket(services, { dirtyChunksRef }, { targetHit: Option.some(bucketHit) })
      expect(result).toBe(true)
      expect(spies.seedWater).toHaveBeenCalledOnce()
      expect(spies.seedLava).not.toHaveBeenCalled()
      expect(spies.removeBlock).toHaveBeenCalledWith('WATER_BUCKET', 1, expect.anything())
      expect(spies.addBlock).toHaveBeenCalledWith('BUCKET', 1)
    }),
  )

  it.effect('fills an empty BUCKET from a WATER source: removes the water and swaps to WATER_BUCKET', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const { services, spies } = makeBucketServices('BUCKET', 'WATER')
      const result = yield* handleBucket(services, { dirtyChunksRef }, { targetHit: Option.some(bucketHit) })
      expect(result).toBe(true)
      expect(spies.removeWater).toHaveBeenCalledOnce()
      expect(spies.removeBlock).toHaveBeenCalledWith('BUCKET', 1, expect.anything())
      expect(spies.addBlock).toHaveBeenCalledWith('WATER_BUCKET', 1)
    }),
  )

  it.effect('fills a CAULDRON with a WATER_BUCKET without placing world water', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const { services, spies } = makeBucketServices('WATER_BUCKET', 'CAULDRON')
      const result = yield* handleBucket(services, { dirtyChunksRef }, { targetHit: Option.some(bucketHit) })
      expect(result).toBe(true)
      expect(spies.forceSetBlock).toHaveBeenCalledWith({ x: 0, y: 63, z: 0 }, 'WATER_CAULDRON')
      expect(spies.seedWater).not.toHaveBeenCalled()
      expect(spies.removeWater).not.toHaveBeenCalled()
      expect(spies.removeBlock).toHaveBeenCalledWith('WATER_BUCKET', 1, expect.anything())
      expect(spies.addBlock).toHaveBeenCalledWith('BUCKET', 1)
    }),
  )

  it.effect('fills an empty BUCKET from a WATER_CAULDRON without removing world water', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const { services, spies } = makeBucketServices('BUCKET', 'WATER_CAULDRON')
      const result = yield* handleBucket(services, { dirtyChunksRef }, { targetHit: Option.some(bucketHit) })
      expect(result).toBe(true)
      expect(spies.forceSetBlock).toHaveBeenCalledWith({ x: 0, y: 63, z: 0 }, 'CAULDRON')
      expect(spies.removeWater).not.toHaveBeenCalled()
      expect(spies.seedWater).not.toHaveBeenCalled()
      expect(spies.removeBlock).toHaveBeenCalledWith('BUCKET', 1, expect.anything())
      expect(spies.addBlock).toHaveBeenCalledWith('WATER_BUCKET', 1)
    }),
  )

  it.effect('does nothing when an empty BUCKET targets an empty CAULDRON', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const { services, spies } = makeBucketServices('BUCKET', 'CAULDRON')
      const result = yield* handleBucket(services, { dirtyChunksRef }, { targetHit: Option.some(bucketHit) })
      expect(result).toBe(false)
      expect(spies.forceSetBlock).not.toHaveBeenCalled()
      expect(spies.removeWater).not.toHaveBeenCalled()
      expect(spies.removeBlock).not.toHaveBeenCalled()
      expect(spies.addBlock).not.toHaveBeenCalled()
    }),
  )

  it.effect('fills an empty BUCKET from a LAVA source: removes the lava and swaps to LAVA_BUCKET', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const { services, spies } = makeBucketServices('BUCKET', 'LAVA')
      const result = yield* handleBucket(services, { dirtyChunksRef }, { targetHit: Option.some(bucketHit) })
      expect(result).toBe(true)
      expect(spies.removeLava).toHaveBeenCalledOnce()
      expect(spies.removeWater).not.toHaveBeenCalled()
      expect(spies.addBlock).toHaveBeenCalledWith('LAVA_BUCKET', 1)
    }),
  )

  it.effect('an empty BUCKET aimed at a non-fluid block does nothing (returns false)', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const { services, spies } = makeBucketServices('BUCKET', 'STONE')
      const result = yield* handleBucket(services, { dirtyChunksRef }, { targetHit: Option.some(bucketHit) })
      expect(result).toBe(false)
      expect(spies.removeWater).not.toHaveBeenCalled()
      expect(spies.addBlock).not.toHaveBeenCalled()
    }),
  )

  it.effect('empties a LAVA_BUCKET: seeds lava and swaps to an empty BUCKET', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const { services, spies } = makeBucketServices('LAVA_BUCKET')
      const result = yield* handleBucket(services, { dirtyChunksRef }, { targetHit: Option.some(bucketHit) })
      expect(result).toBe(true)
      expect(spies.seedLava).toHaveBeenCalledOnce()
      expect(spies.addBlock).toHaveBeenCalledWith('BUCKET', 1)
    }),
  )
})

// ---------------------------------------------------------------------------
// Door toggle via handleRightClick
// ---------------------------------------------------------------------------

const makeDoorRightClickServices = (
  targetBlock: 'DOOR' | 'DOOR_OPEN',
  opts: { readonly upperBlock?: 'DOOR' | 'DOOR_OPEN'; readonly lowerBlock?: 'DOOR' | 'DOOR_OPEN' } = {},
) => {
  const chunk = makeEmptyChunk(0, 0)
  setChunkBlock(chunk, 0, 64, 0, targetBlock)
  if (opts.upperBlock !== undefined) setChunkBlock(chunk, 0, 65, 0, opts.upperBlock)
  if (opts.lowerBlock !== undefined) setChunkBlock(chunk, 0, 63, 0, opts.lowerBlock)
  const forceSetBlock = vi.fn(() => Effect.void)
  const placeBlock = vi.fn(() => Effect.void)
  const playEffect = vi.fn(() => Effect.void)
  const services = {
    blockService: { forceSetBlock, placeBlock },
    chunkManagerService: { getChunk: () => Effect.succeed(chunk) },
    soundManager: { playEffect },
  } as FrameDoorInteractionServices
  return { services, spies: { forceSetBlock, placeBlock, playEffect } }
}

const doorHit: TargetRayHit = { blockX: 0, blockY: 64, blockZ: 0, distance: 2, normal: { x: 0, y: 1, z: 0 } }

describe('interaction-placement-handler / handleRightClick doors', () => {
  it.effect('toggles a closed DOOR open without placing a selected block', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeDoorRightClickServices('DOOR')

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(spies.forceSetBlock).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 }, 'DOOR_OPEN')
      expect(spies.placeBlock).not.toHaveBeenCalled()
      expect(spies.playEffect).toHaveBeenCalledWith('blockPlace', { position: { x: 0, y: 64, z: 0 } })
    }),
  )

  it.effect('toggles an open DOOR closed without placing a selected block', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeDoorRightClickServices('DOOR_OPEN')

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(spies.forceSetBlock).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 }, 'DOOR')
      expect(spies.placeBlock).not.toHaveBeenCalled()
      expect(spies.playEffect).toHaveBeenCalledWith('blockPlace', { position: { x: 0, y: 64, z: 0 } })
    }),
  )

  it.effect('toggles both halves of a closed vertical DOOR when the lower block is clicked', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeDoorRightClickServices('DOOR', { upperBlock: 'DOOR' })

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(spies.forceSetBlock).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 }, 'DOOR_OPEN')
      expect(spies.forceSetBlock).toHaveBeenCalledWith({ x: 0, y: 65, z: 0 }, 'DOOR_OPEN')
      expect(spies.forceSetBlock).toHaveBeenCalledTimes(2)
      expect(spies.placeBlock).not.toHaveBeenCalled()
    }),
  )

  it.effect('toggles both halves of an open vertical DOOR when the upper block is clicked', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeDoorRightClickServices('DOOR_OPEN', { lowerBlock: 'DOOR_OPEN' })

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(spies.forceSetBlock).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 }, 'DOOR')
      expect(spies.forceSetBlock).toHaveBeenCalledWith({ x: 0, y: 63, z: 0 }, 'DOOR')
      expect(spies.forceSetBlock).toHaveBeenCalledTimes(2)
      expect(spies.placeBlock).not.toHaveBeenCalled()
    }),
  )
})

describe('interaction-placement-handler / handleDoor', () => {
  it.effect('returns false when the target block is not a door', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const { services, spies } = makeDoorRightClickServices('DOOR')
      const result = yield* handleDoor(
        services,
        { dirtyChunksRef },
        { x: 0, y: 64, z: 0 },
        'STONE',
      )

      expect(result).toBe(false)
      expect(spies.forceSetBlock).not.toHaveBeenCalled()
    }),
  )
})

// ---------------------------------------------------------------------------
// Special block interactions and default placement via handleRightClick
// ---------------------------------------------------------------------------

const makeRightClickServices = (
  targetBlock: BlockType,
  opts: {
    readonly selectedItem?: InventoryItem | null
    readonly inventoryOpen?: boolean
    readonly xpLevel?: number
    readonly slotStack?: Option.Option<ReturnType<typeof createStack>>
    readonly removeBlock?: ReturnType<typeof vi.fn>
    readonly multiplayer?: Option.Option<{ readonly sendBlockPlace: ReturnType<typeof vi.fn> }>
  } = {},
) => {
  const chunk = makeEmptyChunk(0, 0)
  setChunkBlock(chunk, 0, 64, 0, targetBlock)
  const selectedItem = opts.selectedItem ?? null
  const setSelectedChest = vi.fn(() => Effect.void)
  const setSelectedFurnace = vi.fn(() => Effect.void)
  const toggle = vi.fn(() => Effect.void)
  const placeBlock = vi.fn(() => Effect.void)
  const setSlot = vi.fn(() => Effect.void)
  const removeBlock = opts.removeBlock ?? vi.fn(() => Effect.void)
  const spendLevels = vi.fn(() => Effect.void)
  const playEffect = vi.fn(() => Effect.void)

  const services = {
    blockService: {
      forceSetBlock: vi.fn(() => Effect.void),
      placeBlock,
    },
    chunkManagerService: {
      getChunk: () => Effect.succeed(chunk),
    },
    soundManager: { playEffect },
    hotbarService: {
      getSelectedBlockType: () => Effect.succeed(selectedItem === null ? Option.none() : Option.some(selectedItem)),
      getSelectedSlot: () => Effect.succeed(0),
    },
    redstoneService: {
      setComponent: vi.fn(() => Effect.void),
    },
    chestService: { setSelectedChest },
    furnaceService: { setSelectedFurnace },
    timeService: {
      isNight: () => Effect.succeed(true),
      setTimeOfDay: vi.fn(() => Effect.void),
    },
    netherService: {
      getDimension: () => Effect.succeed('overworld'),
    },
    inventoryService: {
      getSlot: vi.fn(() => Effect.succeed(opts.slotStack ?? Option.none())),
      removeBlock,
      setSlot,
    },
    inventoryRenderer: {
      isOpen: () => Effect.succeed(opts.inventoryOpen ?? false),
      toggle,
    },
    xpService: {
      getXP: () => Effect.succeed(buildPlayerXP(opts.xpLevel ?? 0)),
      spendLevels,
    },
    gameState: {
      getPlayerPosition: vi.fn(() => Effect.succeed({ x: 0, y: 64, z: 0 })),
    },
    gameMode: {
      isSpectator: vi.fn(() => Effect.succeed(false)),
    },
    healthService: {
      getHealth: vi.fn(() => Effect.succeed({ current: 20, max: 20, invincibilityTicks: 0 })),
      applyDamage: vi.fn(() => Effect.void),
    },
    hungerService: {
      addExhaustion: vi.fn(() => Effect.void),
    },
    equipmentService: {
      getTotalArmorPoints: vi.fn(() => Effect.succeed(0)),
      getTotalProtectionReduction: vi.fn(() => Effect.succeed(0)),
      getTotalBlastProtectionReduction: vi.fn(() => Effect.succeed(0)),
    },
    multiplayer: opts.multiplayer ?? Option.none(),
  } as FrameRightClickInteractionServices

  return {
    services,
    spies: { setSelectedChest, setSelectedFurnace, toggle, placeBlock, setSlot, removeBlock, spendLevels, playEffect },
  }
}

describe('interaction-placement-handler / handleRightClick special blocks', () => {
  it.effect('returns immediately when there is no right-click target', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeRightClickServices('AIR', { selectedItem: 'STONE' })

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.none(), respawnPositionRef },
      )

      expect(spies.placeBlock).not.toHaveBeenCalled()
    }),
  )

  it.effect('opens a furnace without placing a selected block', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeRightClickServices('FURNACE', { selectedItem: 'STONE' })

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(spies.setSelectedFurnace).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 })
      expect(spies.placeBlock).not.toHaveBeenCalled()
    }),
  )

  it.effect('opens a chest and toggles the inventory renderer when closed', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeRightClickServices('CHEST', { inventoryOpen: false, selectedItem: 'STONE' })

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(spies.setSelectedChest).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 })
      expect(spies.toggle).toHaveBeenCalledOnce()
      expect(spies.placeBlock).not.toHaveBeenCalled()
    }),
  )

  it.effect('dispatches bed interaction without placing a selected block', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeRightClickServices('BED', { selectedItem: 'STONE' })

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(MutableRef.get(respawnPositionRef)).toEqual({ x: 0, y: 65, z: 0 })
      expect(spies.playEffect).toHaveBeenCalledWith('blockPlace', { position: { x: 0, y: 64, z: 0 } })
      expect(spies.placeBlock).not.toHaveBeenCalled()
    }),
  )

  it.effect('enchants the selected inventory item through an enchanting table', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeRightClickServices('ENCHANTING_TABLE', {
        xpLevel: 10,
        slotStack: Option.some(createStack('IRON_SWORD')),
      })

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      const stored: ItemStack | null = Option.getOrNull(
        spies.setSlot.mock.calls[0]?.[1] ?? Option.none<ItemStack>(),
      )
      expect(stored).not.toBeNull()
      if (stored === null) {
        return
      }
      expect(enchantmentsOf(Option.some(stored)).length).toBeGreaterThan(0)
      expect(spies.spendLevels).toHaveBeenCalled()
      expect(spies.removeBlock).toHaveBeenCalledWith('LAPIS_LAZULI', spies.spendLevels.mock.calls[0]?.[0])
      expect(spies.playEffect).toHaveBeenCalledWith('enchant', { position: { x: 0, y: 64, z: 0 } })
    }),
  )

  it.effect('does not enchant when lapis lazuli cannot be consumed', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeRightClickServices('ENCHANTING_TABLE', {
        xpLevel: 10,
        slotStack: Option.some(createStack('IRON_SWORD')),
        removeBlock: vi.fn(() => Effect.fail(new Error('missing lapis'))),
      })

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(spies.removeBlock).toHaveBeenCalled()
      expect(spies.setSlot).not.toHaveBeenCalled()
      expect(spies.spendLevels).not.toHaveBeenCalled()
      expect(spies.playEffect).not.toHaveBeenCalledWith('enchant', { position: { x: 0, y: 64, z: 0 } })
    }),
  )

  it.effect('does not enchant when xp level is zero', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeRightClickServices('ENCHANTING_TABLE', {
        xpLevel: 0,
        slotStack: Option.some(createStack('IRON_SWORD')),
      })

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(spies.setSlot).not.toHaveBeenCalled()
      expect(spies.spendLevels).not.toHaveBeenCalled()
    }),
  )

  it.effect('does not enchant an empty selected slot', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeRightClickServices('ENCHANTING_TABLE', {
        xpLevel: 10,
        slotStack: Option.none(),
      })

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(spies.setSlot).not.toHaveBeenCalled()
      expect(spies.spendLevels).not.toHaveBeenCalled()
    }),
  )

  it.effect('does not enchant items without an available enchantment', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeRightClickServices('ENCHANTING_TABLE', {
        xpLevel: 10,
        slotStack: Option.some(createStack('APPLE')),
      })

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(spies.setSlot).not.toHaveBeenCalled()
      expect(spies.spendLevels).not.toHaveBeenCalled()
    }),
  )

  it.effect('does nothing when the selected right-click item is not a placeable block', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeRightClickServices('AIR', { selectedItem: 'APPLE' })

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(spies.placeBlock).not.toHaveBeenCalled()
    }),
  )

  it.effect('returns without a selected item', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeRightClickServices('AIR')

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(spies.placeBlock).not.toHaveBeenCalled()
    }),
  )

  it.effect('places a selected block without broadcasting when multiplayer is offline', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const { services, spies } = makeRightClickServices('AIR', { selectedItem: 'STONE', multiplayer: Option.none() })

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(spies.placeBlock).toHaveBeenCalledWith({ x: 0, y: 65, z: 0 }, 'STONE', expect.anything())
      expect(HashMap.size(MutableRef.get(dirtyChunksRef))).toBe(1)
    }),
  )

  it.effect('places a selected block and broadcasts placement when multiplayer is connected', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const sendBlockPlace = vi.fn(() => Effect.void)
      const { services, spies } = makeRightClickServices('AIR', {
        selectedItem: 'STONE',
        multiplayer: Option.some({ sendBlockPlace }),
      })

      yield* handleRightClick(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(doorHit), respawnPositionRef },
      )

      expect(spies.placeBlock).toHaveBeenCalledWith({ x: 0, y: 65, z: 0 }, 'STONE', expect.anything())
      expect(sendBlockPlace).toHaveBeenCalledWith({ x: 0, y: 65, z: 0 }, 'STONE')
      expect(HashMap.size(MutableRef.get(dirtyChunksRef))).toBe(1)
    }),
  )
})

// ---------------------------------------------------------------------------
// TNT explosion via handleFlintAndSteel
// ---------------------------------------------------------------------------

describe('interaction-placement-handler / handleFlintAndSteel (TNT)', () => {
  const makeTntServices = (opts: {
    readonly forceSetBlockSpy?: ReturnType<typeof vi.fn>
    readonly playerPosition?: { readonly x: number; readonly y: number; readonly z: number }
    readonly isSpectator?: boolean
    readonly health?: { readonly current: number; readonly max: number; readonly invincibilityTicks: number }
    readonly armorPoints?: number
    readonly protectionReduction?: number
    readonly blastProtectionReduction?: number
    readonly damageSlotSpy?: ReturnType<typeof vi.fn>
  } = {}): {
    services: FrameFlintAndSteelInteractionServices
    forceSetBlockSpy: ReturnType<typeof vi.fn>
    applyDamageSpy: ReturnType<typeof vi.fn>
    addExhaustionSpy: ReturnType<typeof vi.fn>
    playEffectSpy: ReturnType<typeof vi.fn>
    damageSlotSpy: ReturnType<typeof vi.fn>
  } => {
    const forceSetBlockSpy = opts.forceSetBlockSpy ?? vi.fn(() => Effect.void)
    const applyDamageSpy = vi.fn(() => Effect.void)
    const addExhaustionSpy = vi.fn(() => Effect.void)
    const playEffectSpy = vi.fn(() => Effect.void)
    const damageSlotSpy = opts.damageSlotSpy ?? vi.fn(() => Effect.void)
    // Chunk containing a TNT block at world position (0, 64, 0): lx=0, y=64, lz=0
    const chunk = makeEmptyChunk(0, 0)
    setChunkBlock(chunk, 0, 64, 0, 'TNT')
    return {
      services: {
        blockService: { forceSetBlock: forceSetBlockSpy },
        chunkManagerService: { getChunk: () => Effect.succeed(chunk) },
        netherService: { registerPortal: vi.fn(() => Effect.void) },
        soundManager: { playEffect: playEffectSpy },
        gameState: {
          getPlayerPosition: vi.fn(() => Effect.succeed(opts.playerPosition ?? { x: 0, y: 64, z: 0 })),
        },
        gameMode: {
          isSpectator: vi.fn(() => Effect.succeed(opts.isSpectator ?? false)),
        },
        healthService: {
          getHealth: vi.fn(() => Effect.succeed(opts.health ?? { current: 20, max: 20, invincibilityTicks: 0 })),
          applyDamage: applyDamageSpy,
        },
        hungerService: {
          addExhaustion: addExhaustionSpy,
        },
        equipmentService: {
          getTotalArmorPoints: vi.fn(() => Effect.succeed(opts.armorPoints ?? 0)),
          getTotalProtectionReduction: vi.fn(() => Effect.succeed(opts.protectionReduction ?? 0)),
          getTotalBlastProtectionReduction: vi.fn(() => Effect.succeed(opts.blastProtectionReduction ?? 0)),
        },
        hotbarService: {
          getSelectedSlot: vi.fn(() => Effect.succeed(SlotIndex.make(2))),
        },
        inventoryService: {
          damageSlot: damageSlotSpy,
        },
      } as FrameFlintAndSteelInteractionServices,
      forceSetBlockSpy,
      applyDamageSpy,
      addExhaustionSpy,
      playEffectSpy,
      damageSlotSpy,
    }
  }

  const tntHit: TargetRayHit = { blockX: 0, blockY: 64, blockZ: 0, distance: 2, normal: { x: 0, y: 1, z: 0 } }

  it.effect('explodes TNT: breaks all blocks in radius sphere and returns true', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const { services, forceSetBlockSpy, damageSlotSpy } = makeTntServices()
      const result = yield* handleFlintAndSteel(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(tntHit) },
      )
      expect(result).toBe(true)
      // TNT block removed (1 call) + explosion sphere positions (many calls)
      expect(forceSetBlockSpy.mock.calls.length).toBeGreaterThan(1)
      // First call removes the TNT itself
      expect(forceSetBlockSpy.mock.calls[0]?.[1]).toBe('AIR')
      expect(damageSlotSpy).toHaveBeenCalledWith(selectedHotbarSlotIndex(SlotIndex.make(2)), 1)
    }),
  )

  it.effect('returns true even when forceSetBlock fails during explosion', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const { services } = makeTntServices({ forceSetBlockSpy: vi.fn(() => Effect.fail(new Error('write error'))) })
      const result = yield* handleFlintAndSteel(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(tntHit) },
      )
      expect(result).toBe(true)
    }),
  )

  it.effect('damages a nearby player with TNT explosion damage and exhaustion', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const playerPosition = { x: 0, y: 64, z: 0 }
      const { services, applyDamageSpy, addExhaustionSpy, playEffectSpy } = makeTntServices({ playerPosition })
      const result = yield* handleFlintAndSteel(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(tntHit) },
      )
      const expectedDamage = computeExplosionDamageAt({ x: 0, y: 64, z: 0 }, TNT_EXPLOSION_POWER, playerPosition)

      expect(result).toBe(true)
      expect(applyDamageSpy).toHaveBeenCalledWith(expectedDamage)
      expect(addExhaustionSpy).toHaveBeenCalledWith(EXHAUSTION_DAMAGE)
      expect(playEffectSpy).toHaveBeenCalledWith('playerHurt', { position: playerPosition })
    }),
  )

  it.effect('mitigates TNT explosion damage with Blast Protection', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const playerPosition = { x: 0, y: 64, z: 0 }
      const { services, applyDamageSpy } = makeTntServices({ playerPosition, blastProtectionReduction: 0.32 })
      const result = yield* handleFlintAndSteel(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(tntHit) },
      )
      const rawDamage = computeExplosionDamageAt({ x: 0, y: 64, z: 0 }, TNT_EXPLOSION_POWER, playerPosition)

      expect(result).toBe(true)
      expect(applyDamageSpy.mock.calls[0]?.[0]).toBeCloseTo(rawDamage * 0.68)
    }),
  )

  it.effect('does not damage players outside the TNT explosion radius', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      const { services, applyDamageSpy, addExhaustionSpy } = makeTntServices({ playerPosition: { x: 9, y: 64, z: 0 } })
      const result = yield* handleFlintAndSteel(
        services,
        { dirtyChunksRef },
        { targetHit: Option.some(tntHit) },
      )

      expect(result).toBe(true)
      expect(applyDamageSpy).not.toHaveBeenCalled()
      expect(addExhaustionSpy).not.toHaveBeenCalled()
    }),
  )

  it.effect('skips TNT damage in spectator mode or during hurt invincibility', () =>
    Effect.gen(function* () {
      const spectatorRef = MutableRef.make(HashMap.empty<string, unknown>())
      const spectator = makeTntServices({ isSpectator: true })
      yield* handleFlintAndSteel(spectator.services, { dirtyChunksRef: spectatorRef }, {
        targetHit: Option.some(tntHit),
      })

      const invincibleRef = MutableRef.make(HashMap.empty<string, unknown>())
      const invincible = makeTntServices({ health: { current: 20, max: 20, invincibilityTicks: 10 } })
      yield* handleFlintAndSteel(invincible.services, { dirtyChunksRef: invincibleRef }, {
        targetHit: Option.some(tntHit),
      })

      expect(spectator.damageSlotSpy).toHaveBeenCalledWith(selectedHotbarSlotIndex(SlotIndex.make(2)), 1)
      expect(invincible.damageSlotSpy).toHaveBeenCalledWith(selectedHotbarSlotIndex(SlotIndex.make(2)), 1)
      expect(spectator.applyDamageSpy).not.toHaveBeenCalled()
      expect(invincible.applyDamageSpy).not.toHaveBeenCalled()
    }),
  )
})

// ---------------------------------------------------------------------------
// handleBed
// ---------------------------------------------------------------------------

const makeBedServices = (opts: {
  isNight?: boolean
  dimension?: string
  playerPosition?: { readonly x: number; readonly y: number; readonly z: number }
  health?: { readonly current: number; readonly max: number; readonly invincibilityTicks: number }
  armorPoints?: number
  protectionReduction?: number
  blastProtectionReduction?: number
}): FrameBedInteractionServices => ({
  blockService: {
    forceSetBlock: vi.fn(() => Effect.void),
  },
  timeService: {
    isNight: () => Effect.succeed(opts.isNight ?? true),
    setTimeOfDay: vi.fn(() => Effect.void),
  },
  netherService: {
    getDimension: () => Effect.succeed(opts.dimension ?? 'overworld'),
  },
  gameState: {
    getPlayerPosition: vi.fn(() => Effect.succeed(opts.playerPosition ?? { x: 5, y: 64, z: 5 })),
  },
  gameMode: {
    isSpectator: vi.fn(() => Effect.succeed(false)),
  },
  healthService: {
    getHealth: vi.fn(() => Effect.succeed(opts.health ?? { current: 20, max: 20, invincibilityTicks: 0 })),
    applyDamage: vi.fn(() => Effect.void),
  },
  hungerService: {
    addExhaustion: vi.fn(() => Effect.void),
  },
  equipmentService: {
    getTotalArmorPoints: vi.fn(() => Effect.succeed(opts.armorPoints ?? 0)),
    getTotalProtectionReduction: vi.fn(() => Effect.succeed(opts.protectionReduction ?? 0)),
    getTotalBlastProtectionReduction: vi.fn(() => Effect.succeed(opts.blastProtectionReduction ?? 0)),
  },
  soundManager: { playEffect: vi.fn(() => Effect.void) },
})

describe('interaction-placement-handler / handleBed', () => {
  const bedPos = { x: 5, y: 64, z: 5 }

  it.effect('skips to dawn and sets spawn when it is night in the overworld', () =>
    Effect.gen(function* () {
      const respawnRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const services = makeBedServices({ isNight: true, dimension: 'overworld' })
      const result = yield* handleBed(services, respawnRef, bedPos)
      expect(result).toBe(true)
      expect((services.timeService.setTimeOfDay as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(0.25)
      expect(MutableRef.get(respawnRef).y).toBe(bedPos.y + 1)
    }),
  )

  it.effect('returns false and does nothing during daytime', () =>
    Effect.gen(function* () {
      const respawnRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const services = makeBedServices({ isNight: false, dimension: 'overworld' })
      const result = yield* handleBed(services, respawnRef, bedPos)
      expect(result).toBe(false)
      expect((services.timeService.setTimeOfDay as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    }),
  )

  it.effect('explodes in the nether without calling setTimeOfDay', () =>
    Effect.gen(function* () {
      const respawnRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const playerPosition = { x: 5, y: 64, z: 5 }
      const services = makeBedServices({ isNight: true, dimension: 'nether', playerPosition })
      const result = yield* handleBed(services, respawnRef, bedPos)
      const expectedDamage = computeExplosionDamageAt(bedPos, TNT_EXPLOSION_POWER, playerPosition)
      expect(result).toBe(true)
      expect((services.timeService.setTimeOfDay as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
      expect(services.blockService.forceSetBlock.mock.calls.length).toBeGreaterThan(1)
      expect(services.healthService.applyDamage).toHaveBeenCalledWith(expectedDamage)
      expect(services.hungerService.addExhaustion).toHaveBeenCalledWith(EXHAUSTION_DAMAGE)
      expect(services.soundManager.playEffect).toHaveBeenCalledWith('blockBreak', { position: bedPos })
      expect(services.soundManager.playEffect).toHaveBeenCalledWith('playerHurt', { position: playerPosition })
    }),
  )
})
