import { describe, it } from '@effect/vitest'
import { Effect, HashMap, MutableHashSet, MutableRef, Option } from 'effect'
import { expect, vi } from 'vitest'
import { makeDeps } from '../../../test/frame-handler-test-kit/orchestration/deps'
import { runFrame } from '../../../test/frame-handler-test-kit/orchestration/harness'
import { makeInputService } from '../../../test/frame-handler-test-kit/presentation/input'
import {
  makeInventoryRenderer,
  makeSettingsOverlay,
} from '../../../test/frame-handler-test-kit/presentation/overlay'
import { makeServices } from '../../../test/frame-handler-test-kit/services'
import * as THREE from 'three'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import { getParticleUvOffset } from '@ts-minecraft/rendering'
import { handleBowFire } from '@ts-minecraft/app/frame/stages/interaction-bow-handler'
import { EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'
import { interactionStage } from '@ts-minecraft/app/frame/stages/interaction-stage'
import { DEBUG_FEATURE_FLAG_DEFAULTS } from '@ts-minecraft/app/application/debug-feature-flags.config'
import { REDSTONE_PLACE_WIRE_KEY } from '@ts-minecraft/app/frame-handler.config'
import { createAttackSwingState } from '@ts-minecraft/presentation'

// ---------------------------------------------------------------------------
// Step 7: Block interaction
// ---------------------------------------------------------------------------

describe('step 7 — block interaction', () => {
  const makeChunkWithBlock = (x: number, y: number, z: number, blockType: BlockType) => {
    const blocks = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] = blockTypeToIndex(blockType)
    return { blocks }
  }

  const makeChunkWithBlocks = (
    entries: ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number; readonly blockType: BlockType }>,
  ) => {
    const blocks = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
    for (const { x, y, z, blockType } of entries) {
      const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
      const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
      blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] = blockTypeToIndex(blockType)
    }
    return { blocks }
  }

  const makeInteractionStageRefs = (): Parameters<typeof interactionStage>[2] => ({
    dirtyChunksRef: MutableRef.make(HashMap.empty()) as Parameters<typeof interactionStage>[2]['dirtyChunksRef'],
    totalTimeSecsRef: MutableRef.make(0),
    lastPlayerAttackTimeRef: MutableRef.make(-1000),
    attackSwingStateRef: MutableRef.make(createAttackSwingState()),
    breakProgressRef: MutableRef.make<{ blockKey: string; ticks: number; totalTicks: number } | null>(null),
    bowChargeStartRef: MutableRef.make<number | null>(null),
    isShieldBlockingRef: MutableRef.make(false),
  })

  it.effect('skips interaction input while the game is paused', () => Effect.gen(function* () {
    const deps = yield* makeDeps(true)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const updateSpy = vi.fn(() => Effect.void)
    ;(services.hotbarService as { update: unknown }).update = updateSpy

    yield* interactionStage(deps, services, makeInteractionStageRefs(), { debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS })

    expect(updateSpy).not.toHaveBeenCalled()
  }))

  it.effect('routes redstone key input through the stage flag bundle', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService(MutableHashSet.fromIterable([REDSTONE_PLACE_WIRE_KEY]))
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 1, y: 64, z: 2 }))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const setComponentSpy = vi.fn(() =>
      Effect.succeed({ type: 'wire', position: { x: 1, y: 64, z: 2 }, state: { powered: false, power: 0 } })
    )
    const tickSpy = vi.fn(() => Effect.succeed({ tick: 1, poweredPositions: [] }))
    ;(services.redstoneService as { setComponent: unknown }).setComponent = setComponentSpy
    ;(services.redstoneService as { tick: unknown }).tick = tickSpy

    yield* interactionStage(deps, services, makeInteractionStageRefs(), { debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS })

    expect(setComponentSpy).toHaveBeenCalledWith({ x: 1, y: 64, z: 2 }, 'wire')
    expect(tickSpy).toHaveBeenCalled()
  }))

  it.effect('starts bow charge from right mouse hold with a selected bow', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { isMouseDown: unknown }).isMouseDown = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('BOW'))
    )
    const refs = makeInteractionStageRefs()
    MutableRef.set(refs.totalTimeSecsRef, 12.5)

    yield* interactionStage(deps, services, refs, { debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS })

    expect(MutableRef.get(refs.bowChargeStartRef)).toBe(12.5)
  }))

  it.effect('consumes an existing bow charge on right mouse release', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const getEntitiesSpy = vi.fn(() => Effect.succeed([]))
    ;(services.entityManager as { getEntities: unknown }).getEntities = getEntitiesSpy
    const refs = makeInteractionStageRefs()
    MutableRef.set(refs.bowChargeStartRef, 4)
    MutableRef.set(refs.totalTimeSecsRef, 4.1)

    yield* interactionStage(deps, services, refs, { debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS })

    expect(getEntitiesSpy).toHaveBeenCalledOnce()
    expect(MutableRef.get(refs.bowChargeStartRef)).toBeNull()
  }))

  it.effect('right-click sheep shearing skips feed and food handlers', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('SHEARS'))
    )
    ;(services.hotbarService as { getSelectedSlot: unknown }).getSelectedSlot = vi.fn(() => Effect.succeed(0))
    const sheep = { entityId: 'sheep-1', position: { x: 0, y: -0.9, z: -1 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 8, type: EntityType.Sheep }
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() => Effect.succeed([sheep]))
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(sheep)))
    ;(services.entityManager as { shearEntity: unknown }).shearEntity = vi.fn(() => Effect.succeed(Option.some(2)))
    const getHungerSpy = vi.fn(() => Effect.succeed({ foodLevel: 10, saturation: 0, exhaustion: 0 }))
    ;(services.hungerService as { getHunger: unknown }).getHunger = getHungerSpy

    yield* interactionStage(deps, services, makeInteractionStageRefs(), { debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS })

    expect(getHungerSpy).not.toHaveBeenCalled()
  }))

  it.effect('right-click animal feeding skips food consumption', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('WHEAT'))
    )
    const cow = { entityId: 'cow-1', position: { x: 0, y: -0.9, z: -1 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 10, type: EntityType.Cow }
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() => Effect.succeed([cow]))
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(cow)))
    ;(services.entityManager as { feedEntity: unknown }).feedEntity = vi.fn(() => Effect.succeed(true))
    const getHungerSpy = vi.fn(() => Effect.succeed({ foodLevel: 10, saturation: 0, exhaustion: 0 }))
    ;(services.hungerService as { getHunger: unknown }).getHunger = getHungerSpy

    yield* interactionStage(deps, services, makeInteractionStageRefs(), { debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS })

    expect(getHungerSpy).not.toHaveBeenCalled()
  }))

  it.effect('damages an entity under the crosshair before falling back to block breaking', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const entity = { entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([entity])
    )
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(entity)))
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.some([{ blockType: 'DIRT', count: 2 }])))
    const spawnDroppedItemSpy = vi.fn(() => Effect.void)
    const breakSpy = vi.fn(() => Effect.void)
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy
    ;(services.droppedItemService as { spawn: unknown }).spawn = spawnDroppedItemSpy
    ;(services.blockService as { breakBlock: unknown }).breakBlock = breakSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledWith('entity-1', 4)
    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({
      itemType: 'DIRT',
      count: 2,
      position: { x: 0, y: 64.5, z: -2 },
      velocity: { x: 0, y: 0.14, z: 0 },
    }))
    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('calls blockService.breakBlock when left mouse button is held and a target block is available', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    // Hold-to-break: block breaking now uses isMouseDown (level) not consumeMouseClick (edge).
    // Blocks with hardness=0 (e.g. AIR from an empty-blocks mock) break instantly on the first frame.
    ;(inputService as { isMouseDown: unknown }).isMouseDown = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // Provide a target block
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 0, y: 64, z: 0 }))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const breakSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { breakBlock: unknown }).breakBlock = breakSpy

    yield* runFrame(deps, services)

    expect(breakSpy).toHaveBeenCalledOnce()
    expect(breakSpy).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 }, false, { dropItems: false })
  }))

  it.effect('creative mode breaks a hard block immediately without a harvest tool', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { isMouseDown: unknown }).isMouseDown = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.gameMode as { isCreative: unknown }).isCreative = vi.fn(() => Effect.succeed(true))
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 0, y: 64, z: 0 }))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(makeChunkWithBlock(0, 64, 0, 'DIAMOND_ORE') as never)
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const breakSpy = vi.fn(() => Effect.void)
    const addXPSpy = vi.fn(() =>
      Effect.succeed({ totalXP: 0, level: 0, xpIntoLevel: 0, xpRequiredForNext: 7 })
    )
    const addBlockSpy = vi.fn(() => Effect.void)
    const damageSlotSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { breakBlock: unknown }).breakBlock = breakSpy
    ;(services.xpService as { addXP: unknown }).addXP = addXPSpy
    ;(services.inventoryService as { addBlock: unknown }).addBlock = addBlockSpy
    ;(services.inventoryService as { damageSlot: unknown }).damageSlot = damageSlotSpy

    yield* runFrame(deps, services)

    expect(breakSpy).toHaveBeenCalledOnce()
    expect(breakSpy).toHaveBeenCalledWith(
      { x: 0, y: 64, z: 0 },
      false,
      { requireHarvest: false, dropItems: false },
    )
    expect(addXPSpy).not.toHaveBeenCalled()
    expect(addBlockSpy).not.toHaveBeenCalled()
    expect(damageSlotSpy).not.toHaveBeenCalled()
  }))

  it.effect('survival mode does not break a hard block without a harvest tool', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { isMouseDown: unknown }).isMouseDown = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.gameMode as { isCreative: unknown }).isCreative = vi.fn(() => Effect.succeed(false))
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 0, y: 64, z: 0 }))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(makeChunkWithBlock(0, 64, 0, 'DIAMOND_ORE') as never)
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const breakSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { breakBlock: unknown }).breakBlock = breakSpy

    yield* runFrame(deps, services)

    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('underwater mining applies the vanilla slowdown without AQUA_AFFINITY', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 64, 0)
    const inputService = makeInputService()
    ;(inputService as { isMouseDown: unknown }).isMouseDown = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const chunk = makeChunkWithBlocks([
      { x: 0, y: 64, z: 0, blockType: 'WATER' },
      { x: 1, y: 64, z: 0, blockType: 'STONE' },
    ])
    ;(services.gameMode as { isCreative: unknown }).isCreative = vi.fn(() => Effect.succeed(false))
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 1, y: 64, z: 0 }))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(chunk as never)
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('DIAMOND_PICKAXE'))
    )
    ;(services.hotbarService as { getSelectedSlot: unknown }).getSelectedSlot = vi.fn(() =>
      Effect.succeed(0)
    )
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({ itemType: 'DIAMOND_PICKAXE', count: 1 }))
    )
    const breakSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { breakBlock: unknown }).breakBlock = breakSpy

    for (let i = 0; i < 11; i++) {
      yield* runFrame(deps, services)
    }

    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('mining tolerates missing neighboring chunks during water checks', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 64, 0)
    const inputService = makeInputService()
    ;(inputService as { isMouseDown: unknown }).isMouseDown = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const chunk = makeChunkWithBlock(1, 64, 0, 'STONE')
    ;(services.gameMode as { isCreative: unknown }).isCreative = vi.fn(() => Effect.succeed(false))
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 1, y: 64, z: 0 }))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(({ x, z }: { x: number; z: number }) =>
      x === 0 && z === 0 ? Effect.succeed(chunk as never) : Effect.fail(new Error('chunk unavailable'))
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const breakSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { breakBlock: unknown }).breakBlock = breakSpy

    yield* interactionStage(deps, services, makeInteractionStageRefs(), { debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS })

    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('breaking tall grass can spawn wheat seeds', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { isMouseDown: unknown }).isMouseDown = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 0, y: 64, z: 0 }))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(makeChunkWithBlock(0, 64, 0, 'TALL_GRASS') as never)
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.hotbarService as { getSelectedSlot: unknown }).getSelectedSlot = vi.fn(() =>
      Effect.succeed(0)
    )
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const breakSpy = vi.fn(() => Effect.void)
    const addBlockSpy = vi.fn(() => Effect.void)
    const spawnDroppedItemSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { breakBlock: unknown }).breakBlock = breakSpy
    ;(services.inventoryService as { addBlock: unknown }).addBlock = addBlockSpy
    ;(services.droppedItemService as { spawn: unknown }).spawn = spawnDroppedItemSpy
    yield* Effect.acquireUseRelease(
      Effect.sync(() => vi.spyOn(Math, 'random').mockReturnValue(0)),
      () => runFrame(deps, services),
      (randomSpy) => Effect.sync(() => randomSpy.mockRestore()),
    )

    expect(breakSpy).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 }, false, { dropItems: false })
    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'WHEAT_SEEDS', count: 1 }))
    expect(addBlockSpy).not.toHaveBeenCalled()
  }))

  it.effect('breaking fern with shears harvests the plant instead of rolling seeds', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { isMouseDown: unknown }).isMouseDown = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 0, y: 64, z: 0 }))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(makeChunkWithBlock(0, 64, 0, 'FERN') as never)
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('SHEARS'))
    )
    ;(services.hotbarService as { getSelectedSlot: unknown }).getSelectedSlot = vi.fn(() =>
      Effect.succeed(0)
    )
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({ itemType: 'SHEARS', count: 1 }))
    )
    const breakSpy = vi.fn(() => Effect.void)
    const addBlockSpy = vi.fn(() => Effect.void)
    const spawnDroppedItemSpy = vi.fn(() => Effect.void)
    const damageSlotSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { breakBlock: unknown }).breakBlock = breakSpy
    ;(services.inventoryService as { addBlock: unknown }).addBlock = addBlockSpy
    ;(services.droppedItemService as { spawn: unknown }).spawn = spawnDroppedItemSpy
    ;(services.inventoryService as { damageSlot: unknown }).damageSlot = damageSlotSpy
    yield* Effect.acquireUseRelease(
      Effect.sync(() => vi.spyOn(Math, 'random').mockReturnValue(0)),
      () => runFrame(deps, services),
      (randomSpy) => Effect.sync(() => randomSpy.mockRestore()),
    )

    expect(breakSpy).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 }, true, { dropItems: false })
    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'FERN', count: 1 }))
    expect(spawnDroppedItemSpy).not.toHaveBeenCalledWith(expect.objectContaining({ itemType: 'WHEAT_SEEDS' }))
    expect(addBlockSpy).not.toHaveBeenCalledWith('WHEAT_SEEDS', 1)
    expect(damageSlotSpy).toHaveBeenCalledWith(27, 1)
  }))

  it.effect('does NOT call blockService.breakBlock when no target block', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // No target block (Option.none)
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const breakSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { breakBlock: unknown }).breakBlock = breakSpy

    yield* runFrame(deps, services)

    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('copies the targeted block into the selected hotbar slot on creative middle-click', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 1)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.gameMode as { isCreative: unknown }).isCreative = vi.fn(() => Effect.succeed(true))
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 0, y: 64, z: 0 }))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(makeChunkWithBlock(0, 64, 0, 'STONE') as never)
    )
    ;(services.hotbarService as { getSelectedSlot: unknown }).getSelectedSlot = vi.fn(() =>
      Effect.succeed(3)
    )
    const setSlotSpy = vi.fn(() => Effect.void)
    ;(services.inventoryService as { setSlot: unknown }).setSlot = setSlotSpy

    yield* runFrame(deps, services)

    expect(setSlotSpy).toHaveBeenCalledOnce()
    const [slot, stackOpt] = setSlotSpy.mock.calls[0]!
    expect(slot).toBe(30)
    expect(Option.getOrThrow(stackOpt)).toMatchObject({ itemType: 'STONE', count: 64 })
  }))

  it.effect('creative middle-click with no target leaves the hotbar unchanged', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 1)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.gameMode as { isCreative: unknown }).isCreative = vi.fn(() => Effect.succeed(true))
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const getChunkSpy = vi.fn(() => Effect.succeed(makeChunkWithBlock(0, 64, 0, 'STONE') as never))
    const setSlotSpy = vi.fn(() => Effect.void)
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = getChunkSpy
    ;(services.inventoryService as { setSlot: unknown }).setSlot = setSlotSpy

    yield* interactionStage(deps, services, makeInteractionStageRefs(), { debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS })

    expect(getChunkSpy).not.toHaveBeenCalled()
    expect(setSlotSpy).not.toHaveBeenCalled()
  }))

  it.effect('creative middle-click with a missing target chunk leaves the hotbar unchanged', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 1)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.gameMode as { isCreative: unknown }).isCreative = vi.fn(() => Effect.succeed(true))
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 0, y: 64, z: 0 }))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.fail(new Error('chunk unavailable'))
    )
    const setSlotSpy = vi.fn(() => Effect.void)
    ;(services.inventoryService as { setSlot: unknown }).setSlot = setSlotSpy

    yield* interactionStage(deps, services, makeInteractionStageRefs(), { debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS })

    expect(setSlotSpy).not.toHaveBeenCalled()
  }))

  it.effect('creative middle-click treats AIR as no pickable block', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 1)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.gameMode as { isCreative: unknown }).isCreative = vi.fn(() => Effect.succeed(true))
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 0, y: 64, z: 0 }))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(makeChunkWithBlock(0, 64, 0, 'AIR') as never)
    )
    const setSlotSpy = vi.fn(() => Effect.void)
    ;(services.inventoryService as { setSlot: unknown }).setSlot = setSlotSpy

    yield* interactionStage(deps, services, makeInteractionStageRefs(), { debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS })

    expect(setSlotSpy).not.toHaveBeenCalled()
  }))

  it.effect('creative middle-click treats an out-of-range target cell as AIR', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 1)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.gameMode as { isCreative: unknown }).isCreative = vi.fn(() => Effect.succeed(true))
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 0, y: CHUNK_HEIGHT * CHUNK_SIZE * CHUNK_SIZE, z: 0 }))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(makeChunkWithBlock(0, 64, 0, 'STONE') as never)
    )
    const setSlotSpy = vi.fn(() => Effect.void)
    ;(services.inventoryService as { setSlot: unknown }).setSlot = setSlotSpy

    yield* interactionStage(deps, services, makeInteractionStageRefs(), { debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS })

    expect(setSlotSpy).not.toHaveBeenCalled()
  }))

  it.effect('does not pick a block outside creative mode', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 1)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.gameMode as { isCreative: unknown }).isCreative = vi.fn(() => Effect.succeed(false))
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 0, y: 64, z: 0 }))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const getChunkSpy = vi.fn(() => Effect.succeed(makeChunkWithBlock(0, 64, 0, 'STONE') as never))
    const setSlotSpy = vi.fn(() => Effect.void)
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = getChunkSpy
    ;(services.inventoryService as { setSlot: unknown }).setSlot = setSlotSpy

    yield* runFrame(deps, services)

    expect(setSlotSpy).not.toHaveBeenCalled()
  }))

  it.effect('calls blockService.placeBlock on right-click when a target hit and hotbar block are available', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.some({ blockX: 0, blockY: 64, blockZ: 0, normal: { x: 0, y: 1, z: 0 } }))
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('GRASS'))
    )
    ;(services.hotbarService as { getSelectedSlot: unknown }).getSelectedSlot = vi.fn(() =>
      Effect.succeed(2)
    )
    const placeSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { placeBlock: unknown }).placeBlock = placeSpy

    yield* runFrame(deps, services)

    expect(placeSpy).toHaveBeenCalledOnce()
    // Adjacent position = block + normal = (0+0, 64+1, 0+0) = (0, 65, 0)
    expect(placeSpy).toHaveBeenCalledWith({ x: 0, y: 65, z: 0 }, 'GRASS', 29)
  }))

  it.effect('right-click with no target hit does nothing (handleRightClick outer onNone)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const placeSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { placeBlock: unknown }).placeBlock = placeSpy

    yield* runFrame(deps, services)

    expect(placeSpy).not.toHaveBeenCalled()
  }))

  it.effect('right-click with target hit but no selected block does nothing (handleRightClick inner onNone)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.some({ blockX: 0, blockY: 64, blockZ: 0, normal: { x: 0, y: 1, z: 0 } }))
    )
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.hotbarService as { getSelectedSlot: unknown }).getSelectedSlot = vi.fn(() =>
      Effect.succeed(0)
    )
    const placeSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { placeBlock: unknown }).placeBlock = placeSpy

    yield* runFrame(deps, services)

    expect(placeSpy).not.toHaveBeenCalled()
  }))

  it.effect('plays placement audio only after a successful placeBlock call', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.some({ blockX: 0, blockY: 64, blockZ: 0, normal: { x: 0, y: 1, z: 0 } }))
    )
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('GRASS'))
    )
    ;(services.hotbarService as { getSelectedSlot: unknown }).getSelectedSlot = vi.fn(() =>
      Effect.succeed(0)
    )
    const placeSpy = vi.fn(() => Effect.fail(new Error('no item')))
    const playEffectSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { placeBlock: unknown }).placeBlock = placeSpy
    ;(services.soundManager as { playEffect: unknown }).playEffect = playEffectSpy

    yield* runFrame(deps, services)

    expect(placeSpy).toHaveBeenCalledOnce()
    expect(playEffectSpy).not.toHaveBeenCalledWith('blockPlace', expect.anything())
  }))

  it.effect('suppresses block interaction when game is paused', () => Effect.gen(function* () {
    const deps = yield* makeDeps(true /* paused */)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 0, y: 64, z: 0 }))
    )
    const breakSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { breakBlock: unknown }).breakBlock = breakSpy

    yield* runFrame(deps, services)

    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('applies WOODEN_SWORD_ATTACK_DAMAGE (8) when selected item is WOODEN_SWORD', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }])
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('WOODEN_SWORD'))
    )
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledWith('entity-1', 8)
  }))

  it.effect('applies STONE_SWORD_ATTACK_DAMAGE (9) when selected item is STONE_SWORD', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }])
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('STONE_SWORD'))
    )
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledWith('entity-1', 9)
  }))

  it.effect('applies IRON_SWORD_ATTACK_DAMAGE (12) when selected item is IRON_SWORD', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }])
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('IRON_SWORD'))
    )
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledWith('entity-1', 12)
  }))

  it.effect('applies DIAMOND_SWORD_ATTACK_DAMAGE (16) when selected item is DIAMOND_SWORD', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }])
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('DIAMOND_SWORD'))
    )
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledWith('entity-1', 16)
  }))

  it.effect('applies PLAYER_ATTACK_DAMAGE (4) when selected item is non-sword', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }])
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('STONE'))
    )
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledWith('entity-1', 4)
  }))

  it.effect('applies a 1.5× critical hit (6) when attacking while airborne', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }])
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('STONE'))
    )
    // Airborne → critical hit.
    ;(services.gameState as { isPlayerGrounded: unknown }).isPlayerGrounded = vi.fn(() => Effect.succeed(false))
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledWith('entity-1', 6) // 4 × 1.5
  }))

  it.effect('knocks the attacked entity away from the player', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const entity = { entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() => Effect.succeed([entity]))
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(entity)))
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() => Effect.succeed(Option.none()))
    const knockbackSpy = vi.fn(() => Effect.void)
    ;(services.entityManager as { applyKnockback: unknown }).applyKnockback = knockbackSpy

    yield* runFrame(deps, services)

    // direction = entity(0,-2) − camera(0,0) = (0,-2) → normalized (0,-1) × 5 horizontal, +4.2 up
    expect(knockbackSpy).toHaveBeenCalledWith('entity-1', { x: 0, y: 4.2, z: -5 })
  }))

  it.effect('adds sprint attack bonus knockback while sprinting forward', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService(MutableHashSet.fromIterable([
      KeyMappings.MOVE_FORWARD,
      KeyMappings.SPRINT,
    ]))
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const entity = { entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() => Effect.succeed([entity]))
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(entity)))
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() => Effect.succeed(Option.none()))
    const knockbackSpy = vi.fn(() => Effect.void)
    ;(services.entityManager as { applyKnockback: unknown }).applyKnockback = knockbackSpy

    yield* runFrame(deps, services)

    expect(knockbackSpy).toHaveBeenCalledWith('entity-1', { x: 0, y: 4.2, z: -7.5 })
  }))

  it.effect('plays the entityHit sound when an attack lands on a mob', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const entity = { entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() => Effect.succeed([entity]))
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(entity)))
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() => Effect.succeed(Option.none()))
    const playEffectSpy = vi.fn(() => Effect.void)
    ;(services.soundManager as { playEffect: unknown }).playEffect = playEffectSpy

    yield* runFrame(deps, services)

    expect(playEffectSpy).toHaveBeenCalledWith('entityHit', { position: entity.position })
  }))

  it.effect('spawns a hit-burst particle (count 6) at the entity center on a grounded landed attack', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const entity = { entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() => Effect.succeed([entity]))
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(entity)))
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() => Effect.succeed(Option.none()))
    const spawnBurstSpy = vi.fn(() => Effect.void)
    ;(services.particleSystem as { spawnBurst: unknown }).spawnBurst = spawnBurstSpy

    yield* runFrame(deps, services)

    // UV asserted BY VALUE from getParticleUvOffset(37) (REDSTONE_BLOCK), never a tile literal.
    const uv = getParticleUvOffset(37)
    // Entity center Y = position.y (64) + ENTITY_CENTER_Y_OFFSET (0.9) = 64.9. Grounded → count 6.
    expect(spawnBurstSpy).toHaveBeenCalledOnce()
    expect(spawnBurstSpy).toHaveBeenCalledWith(0, 64.9, -2, uv.u, uv.v, 6)
  }))

  it.effect('spawns a denser hit-burst (count 12) on a critical (airborne) landed attack', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const entity = { entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() => Effect.succeed([entity]))
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(entity)))
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() => Effect.succeed(Option.none()))
    // Airborne → deterministic crit → denser burst.
    ;(services.gameState as { isPlayerGrounded: unknown }).isPlayerGrounded = vi.fn(() => Effect.succeed(false))
    const spawnBurstSpy = vi.fn(() => Effect.void)
    ;(services.particleSystem as { spawnBurst: unknown }).spawnBurst = spawnBurstSpy

    yield* runFrame(deps, services)

    const uv = getParticleUvOffset(37)
    expect(spawnBurstSpy).toHaveBeenCalledOnce()
    expect(spawnBurstSpy).toHaveBeenCalledWith(0, 64.9, -2, uv.u, uv.v, 12)
  }))

  it.effect('damages the held weapon durability after landing a hit with a durable item', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }])
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('IRON_SWORD'))
    )
    ;(services.hotbarService as { getSelectedSlot: unknown }).getSelectedSlot = vi.fn(() => Effect.succeed(3))
    const damageSlotSpy = vi.fn(() => Effect.void)
    ;(services.inventoryService as { damageSlot: unknown }).damageSlot = damageSlotSpy

    yield* runFrame(deps, services)

    // HOTBAR_START (27) + selectedSlot (3) = 30
    expect(damageSlotSpy).toHaveBeenCalledWith(30, 1)
  }))

  it.effect('does NOT damage durability when the held item is not a durable tool', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }])
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('STONE'))
    )
    const damageSlotSpy = vi.fn(() => Effect.void)
    ;(services.inventoryService as { damageSlot: unknown }).damageSlot = damageSlotSpy

    yield* runFrame(deps, services)

    expect(damageSlotSpy).not.toHaveBeenCalled()
  }))

  it.effect('does NOT damage durability for a bare-hand attack (no selected item)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }])
    )
    // Bare hand: no item is selected.
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const damageSlotSpy = vi.fn(() => Effect.void)
    ;(services.inventoryService as { damageSlot: unknown }).damageSlot = damageSlotSpy

    yield* runFrame(deps, services)

    expect(damageSlotSpy).not.toHaveBeenCalled()
  }))

  it.effect('right-click holding food eats it: restores hunger, consumes one, skips placement', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // No block target — eating must work regardless (e.g. looking at the sky).
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('APPLE'))
    )
    ;(services.hungerService as { getHunger: unknown }).getHunger = vi.fn(() =>
      Effect.succeed({ foodLevel: 10, saturation: 0, exhaustion: 0 })
    )
    const eatSpy = vi.fn(() => Effect.void)
    ;(services.hungerService as { eat: unknown }).eat = eatSpy
    const removeSpy = vi.fn(() => Effect.succeed(true))
    ;(services.inventoryService as { removeBlock: unknown }).removeBlock = removeSpy
    const placeSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { placeBlock: unknown }).placeBlock = placeSpy

    yield* runFrame(deps, services)

    expect(eatSpy).toHaveBeenCalledWith(4, 0.3) // APPLE: foodLevel 4, saturationModifier 0.3
    expect(removeSpy).toHaveBeenCalled()
    expect(placeSpy).not.toHaveBeenCalled()
  }))

  it.effect('does NOT eat when the food bar is already full', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('APPLE'))
    )
    ;(services.hungerService as { getHunger: unknown }).getHunger = vi.fn(() =>
      Effect.succeed({ foodLevel: 20, saturation: 5, exhaustion: 0 })
    )
    const eatSpy = vi.fn(() => Effect.void)
    ;(services.hungerService as { eat: unknown }).eat = eatSpy

    yield* runFrame(deps, services)

    expect(eatSpy).not.toHaveBeenCalled()
  }))

  it.effect('right-click holding a placeable block does not trigger eating', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('GRASS'))
    )
    ;(services.hungerService as { getHunger: unknown }).getHunger = vi.fn(() =>
      Effect.succeed({ foodLevel: 10, saturation: 0, exhaustion: 0 })
    )
    const eatSpy = vi.fn(() => Effect.void)
    ;(services.hungerService as { eat: unknown }).eat = eatSpy

    yield* runFrame(deps, services)

    expect(eatSpy).not.toHaveBeenCalled()
  }))

  it.effect('KeyG unequips the first occupied armor slot back into the inventory', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    // Inject a KeyG press via the input service's pressed-key set.
    const inputService = makeInputService(MutableHashSet.fromIterable(['KeyG']))
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // HELMET occupied; the other slots are empty.
    const unequipSlotSpy = vi.fn((slot: string) =>
      Effect.succeed(slot === 'HELMET' ? Option.some({ itemType: 'IRON_HELMET', count: 1 }) : Option.none()),
    )
    ;(services.equipmentService as { unequipSlot: unknown }).unequipSlot = unequipSlotSpy
    const addBlockSpy = vi.fn(() => Effect.succeed(true))
    ;(services.inventoryService as { addBlock: unknown }).addBlock = addBlockSpy

    yield* runFrame(deps, services)

    expect(unequipSlotSpy).toHaveBeenCalledWith('HELMET')
    expect(addBlockSpy).toHaveBeenCalledWith('IRON_HELMET', 1)
  }))

  it.effect('KeyG with no armor equipped does not add anything to the inventory', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService(MutableHashSet.fromIterable(['KeyG']))
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // All four slots empty.
    const unequipSlotSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.equipmentService as { unequipSlot: unknown }).unequipSlot = unequipSlotSpy
    const addBlockSpy = vi.fn(() => Effect.succeed(true))
    ;(services.inventoryService as { addBlock: unknown }).addBlock = addBlockSpy

    yield* runFrame(deps, services)

    expect(addBlockSpy).not.toHaveBeenCalled()
    // The loop must drain ALL four slots before giving up (none was occupied).
    expect(unequipSlotSpy).toHaveBeenCalledTimes(4)
    expect(unequipSlotSpy).toHaveBeenCalledWith('HELMET')
    expect(unequipSlotSpy).toHaveBeenCalledWith('CHESTPLATE')
    expect(unequipSlotSpy).toHaveBeenCalledWith('LEGGINGS')
    expect(unequipSlotSpy).toHaveBeenCalledWith('BOOTS')
  }))

  it.effect('KeyG re-equips the armor when the inventory is full (rollback, not destroyed)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService(MutableHashSet.fromIterable(['KeyG']))
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // HELMET occupied; the slot is cleared by unequip before addBlock is attempted.
    const unequipSlotSpy = vi.fn((slot: string) =>
      Effect.succeed(slot === 'HELMET' ? Option.some({ itemType: 'IRON_HELMET', count: 1 }) : Option.none()),
    )
    ;(services.equipmentService as { unequipSlot: unknown }).unequipSlot = unequipSlotSpy
    // Inventory is full → addBlock fails.
    const addBlockSpy = vi.fn(() => Effect.fail(new Error('inventory full')))
    ;(services.inventoryService as { addBlock: unknown }).addBlock = addBlockSpy
    const equipSpy = vi.fn(() => Effect.succeed(true))
    ;(services.equipmentService as { equip: unknown }).equip = equipSpy

    // The frame must complete (no defect) and the helmet must be re-equipped.
    yield* runFrame(deps, services)

    expect(addBlockSpy).toHaveBeenCalledWith('IRON_HELMET', 1)
    // Rollback: the removed piece is re-equipped so it is NOT destroyed.
    expect(equipSpy).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'IRON_HELMET' }))
  }))

  it.effect('KeyG unequips the first OCCUPIED slot (CHESTPLATE) when HELMET is empty', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService(MutableHashSet.fromIterable(['KeyG']))
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // HELMET empty, CHESTPLATE occupied → loop stops at the chestplate.
    const unequipSlotSpy = vi.fn((slot: string) =>
      Effect.succeed(slot === 'CHESTPLATE' ? Option.some({ itemType: 'IRON_CHESTPLATE', count: 1 }) : Option.none()),
    )
    ;(services.equipmentService as { unequipSlot: unknown }).unequipSlot = unequipSlotSpy
    const addBlockSpy = vi.fn(() => Effect.succeed(true))
    ;(services.inventoryService as { addBlock: unknown }).addBlock = addBlockSpy

    yield* runFrame(deps, services)

    expect(unequipSlotSpy).toHaveBeenCalledWith('HELMET')
    expect(unequipSlotSpy).toHaveBeenCalledWith('CHESTPLATE')
    // The loop returns at the chestplate, so the later slots are never probed.
    expect(unequipSlotSpy).not.toHaveBeenCalledWith('LEGGINGS')
    expect(unequipSlotSpy).not.toHaveBeenCalledWith('BOOTS')
    expect(addBlockSpy).toHaveBeenCalledOnce()
    expect(addBlockSpy).toHaveBeenCalledWith('IRON_CHESTPLATE', 1)
  }))

  it.effect('right-click with an armor item equips it into the equipment slot', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('IRON_HELMET'))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const equipSpy = vi.fn(() => Effect.succeed(true))
    ;(services.equipmentService as { equip: unknown }).equip = equipSpy
    const removeSpy = vi.fn(() => Effect.succeed(true))
    ;(services.inventoryService as { removeBlock: unknown }).removeBlock = removeSpy
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({ itemType: 'IRON_HELMET', count: 1 }))
    )

    yield* runFrame(deps, services)

    expect(removeSpy).toHaveBeenCalledOnce()
    expect(equipSpy).toHaveBeenCalledOnce()
  }))

  it.effect('right-click with armor over a worn piece swaps it, returning the old armor to the inventory', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('IRON_HELMET'))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    // A DIAMOND_HELMET is already worn → swapping must return it to the inventory, not destroy it.
    ;(services.equipmentService as { getEquippedItem: unknown }).getEquippedItem = vi.fn(() =>
      Effect.succeed(Option.some({ itemType: 'DIAMOND_HELMET', count: 1 }))
    )
    ;(services.equipmentService as { equip: unknown }).equip = vi.fn(() => Effect.succeed(true))
    ;(services.inventoryService as { removeBlock: unknown }).removeBlock = vi.fn(() => Effect.succeed(true))
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({ itemType: 'IRON_HELMET', count: 1 }))
    )
    const addBlockSpy = vi.fn(() => Effect.succeed(undefined))
    ;(services.inventoryService as { addBlock: unknown }).addBlock = addBlockSpy

    yield* runFrame(deps, services)

    expect(addBlockSpy).toHaveBeenCalledWith('DIAMOND_HELMET', 1)
  }))

  it.effect('right-click with armor item returns false when equip fails (catchAll path)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('IRON_HELMET'))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    // removeBlock fails → catchAll returns false, equip Effect never executes
    let equipExecuted = false
    ;(services.inventoryService as { removeBlock: unknown }).removeBlock = vi.fn(() =>
      Effect.fail(new Error('inventory full'))
    )
    ;(services.equipmentService as { equip: unknown }).equip = vi.fn(() =>
      Effect.sync(() => { equipExecuted = true; return true as unknown })
    )

    yield* runFrame(deps, services)

    // The equip Effect was NOT executed (removeBlock failed, andThen short-circuited)
    expect(equipExecuted).toBe(false)
  }))

  it.effect('right-click with FISHING_ROD when not fishing casts the rod', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('FISHING_ROD'))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const castSpy = vi.fn(() => Effect.void)
    ;(services.fishingService as { cast: unknown }).cast = castSpy

    yield* runFrame(deps, services)

    expect(castSpy).toHaveBeenCalledOnce()
  }))

  it.effect('right-click with FISHING_ROD when already fishing cancels the rod', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('FISHING_ROD'))
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.fishingService as { isFishing: unknown }).isFishing = vi.fn(() =>
      Effect.succeed(true)
    )
    const cancelSpy = vi.fn(() => Effect.void)
    ;(services.fishingService as { cancel: unknown }).cancel = cancelSpy

    yield* runFrame(deps, services)

    expect(cancelSpy).toHaveBeenCalledOnce()
  }))

  it.effect('does NOT spawn a hit-burst particle when particles.spawn is disabled (damage + knockback still run)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // Disable the particle-spawn debug flag (mirror entity-update-stage tests).
    yield* services.debugFeatureFlags.setEnabled('particles.spawn', false)
    const entity = { entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() => Effect.succeed([entity]))
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(entity)))
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() => Effect.succeed(Option.none()))
    const spawnBurstSpy = vi.fn(() => Effect.void)
    ;(services.particleSystem as { spawnBurst: unknown }).spawnBurst = spawnBurstSpy
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy
    const knockbackSpy = vi.fn(() => Effect.void)
    ;(services.entityManager as { applyKnockback: unknown }).applyKnockback = knockbackSpy

    yield* runFrame(deps, services)

    // No particle burst, but the gameplay effects (damage + knockback) still ran.
    expect(spawnBurstSpy).not.toHaveBeenCalled()
    expect(applyDamageSpy).toHaveBeenCalledWith('entity-1', 4)
    expect(knockbackSpy).toHaveBeenCalledWith('entity-1', { x: 0, y: 4.2, z: -5 })
  }))

  it.effect('right-click with FLINT_AND_STEEL and no target hit exercises the handleFlintAndSteel branch', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('FLINT_AND_STEEL')),
    )
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none()),
    )
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none()),
    )
    // No portal frame around ignitionPos → handleFlintAndSteel returns false → handleRightClick runs (no-op)
    yield* runFrame(deps, services)
  }))

  // ── R36: SMITE / BANE_OF_ARTHROPODS enchantments ──────────────────────────────
  it.effect('SMITE V on IRON_SWORD adds 12.5 bonus damage when hitting Zombie', () => Effect.gen(function* () {
    // IRON_SWORD base=12, SMITE V=12.5 bonus, charge=1 (first hit), grounded → no crit.
    // computeChargedDamage(computeAttackDamage(12+12.5, false), 1) = computeChargedDamage(24.5, 1)
    // = 24.5 × (0.2 + 0.8 × 1²) = 24.5
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }])
    )
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() =>
      Effect.succeed(Option.some({ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }))
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('IRON_SWORD'))
    )
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({ itemType: 'IRON_SWORD', count: 1, enchantments: [{ type: 'SMITE', level: 5 }] }))
    )
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy
    yield* runFrame(deps, services)
    // IRON_SWORD(12) + SMITE V(12.5) = 24.5, charge 1 → 24.5
    expect(applyDamageSpy).toHaveBeenCalledTimes(1)
    expect(applyDamageSpy.mock.calls[0]?.[0]).toBe('entity-1')
    expect(applyDamageSpy.mock.calls[0]?.[1]).toBeCloseTo(24.5)
  }))

  it.effect('SMITE does NOT apply bonus when hitting Spider (non-undead)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Spider' }])
    )
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() =>
      Effect.succeed(Option.some({ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Spider' }))
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('IRON_SWORD'))
    )
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({ itemType: 'IRON_SWORD', count: 1, enchantments: [{ type: 'SMITE', level: 5 }] }))
    )
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy
    yield* runFrame(deps, services)
    // Spider is not undead → SMITE ignored → IRON_SWORD base 12 only
    expect(applyDamageSpy.mock.calls[0]?.[1]).toBeCloseTo(12)
  }))

  it.effect('BANE_OF_ARTHROPODS V applies bonus when hitting Spider', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Spider' }])
    )
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() =>
      Effect.succeed(Option.some({ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Spider' }))
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('IRON_SWORD'))
    )
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({ itemType: 'IRON_SWORD', count: 1, enchantments: [{ type: 'BANE_OF_ARTHROPODS', level: 5 }] }))
    )
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy
    yield* runFrame(deps, services)
    // IRON_SWORD(12) + BANE_OF_ARTHROPODS V(12.5) = 24.5
    expect(applyDamageSpy.mock.calls[0]?.[1]).toBeCloseTo(24.5)
  }))

  it.effect('FIRE_ASPECT II on a sword ignites a surviving target for 8 seconds', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }])
    )
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() =>
      Effect.succeed(Option.some({ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }))
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('IRON_SWORD'))
    )
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({ itemType: 'IRON_SWORD', count: 1, enchantments: [{ type: 'FIRE_ASPECT', level: 2 }] }))
    )
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.none()))
    const igniteSpy = vi.fn(() => Effect.succeed(true))
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy
    ;(services.entityManager as { igniteEntity: unknown }).igniteEntity = igniteSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledTimes(1)
    expect(igniteSpy).toHaveBeenCalledWith('entity-1', 8)
  }))

  it.effect('FIRE_ASPECT does not ignite a target killed by the initial hit', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 1, type: 'Zombie' }])
    )
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() =>
      Effect.succeed(Option.some({ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 1, type: 'Zombie' }))
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('IRON_SWORD'))
    )
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({ itemType: 'IRON_SWORD', count: 1, enchantments: [{ type: 'FIRE_ASPECT', level: 1 }] }))
    )
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.some([])))
    const igniteSpy = vi.fn(() => Effect.succeed(true))
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy
    ;(services.entityManager as { igniteEntity: unknown }).igniteEntity = igniteSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledTimes(1)
    expect(igniteSpy).not.toHaveBeenCalled()
  }))

  it.effect('baby mobs killed by melee attacks suppress drops and XP', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const babyZombie = {
      entityId: 'entity-1',
      position: { x: 0, y: 64, z: -2 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: {} as THREE.Quaternion,
      health: 1,
      type: 'Zombie',
      isBaby: true,
    }
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() => Effect.succeed([babyZombie]))
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(babyZombie)))
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = vi.fn(() =>
      Effect.succeed(Option.some([{ blockType: 'ROTTEN_FLESH', count: 1 }]))
    )
    const spawnDroppedItemSpy = vi.fn(() => Effect.void)
    const spawnXpOrbSpy = vi.fn(() => Effect.void)
    const addXPSpy = vi.fn(() =>
      Effect.succeed({ totalXP: 0, level: 0, xpIntoLevel: 0, xpRequiredForNext: 7 })
    )
    ;(services.droppedItemService as { spawn: unknown }).spawn = spawnDroppedItemSpy
    ;(services.droppedXpOrbService as { spawn: unknown }).spawn = spawnXpOrbSpy
    ;(services.xpService as { addXP: unknown }).addXP = addXPSpy

    yield* runFrame(deps, services)

    expect(spawnDroppedItemSpy).not.toHaveBeenCalled()
    expect(spawnXpOrbSpy).not.toHaveBeenCalled()
    expect(addXPSpy).not.toHaveBeenCalled()
  }))

  it.effect('melee Looting spawns bonus dropped items', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const zombie = {
      entityId: 'entity-1',
      position: { x: 0, y: 64, z: -2 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: {} as THREE.Quaternion,
      health: 1,
      type: 'Zombie',
    }
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() => Effect.succeed([zombie]))
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(zombie)))
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('IRON_SWORD'))
    )
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({ itemType: 'IRON_SWORD', count: 1, enchantments: [{ type: 'LOOTING', level: 2 }] }))
    )
    ;(services.inventoryService as { damageSlot: unknown }).damageSlot = vi.fn(() => Effect.void)
    const spawnDroppedItemSpy = vi.fn(() => Effect.void)
    const spawnXpOrbSpy = vi.fn(() => Effect.void)
    const addXPSpy = vi.fn(() =>
      Effect.succeed({ totalXP: 0, level: 0, xpIntoLevel: 0, xpRequiredForNext: 7 })
    )
    ;(services.droppedItemService as { spawn: unknown }).spawn = spawnDroppedItemSpy
    ;(services.droppedXpOrbService as { spawn: unknown }).spawn = spawnXpOrbSpy
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = vi.fn(() =>
      Effect.succeed(Option.some([{ blockType: 'ROTTEN_FLESH', count: 1 }]))
    )
    ;(services.xpService as { addXP: unknown }).addXP = addXPSpy

    yield* runFrame(deps, services)

    expect(spawnDroppedItemSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
      itemType: 'ROTTEN_FLESH',
      count: 1,
      position: { x: 0, y: 64.5, z: -2 },
      velocity: { x: 0, y: 0.14, z: 0 },
    }))
    expect(spawnDroppedItemSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
      itemType: 'ROTTEN_FLESH',
      count: 2,
      position: { x: 0, y: 64.5, z: -2 },
      velocity: { x: 0, y: 0.14, z: 0 },
    }))
    expect(spawnXpOrbSpy).toHaveBeenCalledWith(expect.objectContaining({
      amount: 5,
      position: { x: 0, y: 64.5, z: -2 },
    }))
    expect(addXPSpy).not.toHaveBeenCalled()
  }))

  it.effect('melee Knockback enchantment scales impulse and Unbreaking can skip weapon durability', () => Effect.gen(function* () {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const zombie = {
      entityId: 'entity-1',
      position: { x: 0, y: 64, z: -2 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: {} as THREE.Quaternion,
      health: 20,
      type: 'Zombie',
    }
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() => Effect.succeed([zombie]))
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(zombie)))
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('IRON_SWORD'))
    )
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({
        itemType: 'IRON_SWORD',
        count: 1,
        enchantments: [{ type: 'KNOCKBACK', level: 2 }, { type: 'UNBREAKING', level: 3 }],
      }))
    )
    const applyKnockbackSpy = vi.fn(() => Effect.void)
    const damageSlotSpy = vi.fn(() => Effect.void)
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.entityManager as { applyKnockback: unknown }).applyKnockback = applyKnockbackSpy
    ;(services.inventoryService as { damageSlot: unknown }).damageSlot = damageSlotSpy

    yield* runFrame(deps, services)
    randomSpy.mockRestore()

    expect(applyKnockbackSpy.mock.calls[0]?.[1].z).toBeLessThan(-5)
    expect(damageSlotSpy).not.toHaveBeenCalled()
  }))
})

// ---------------------------------------------------------------------------
// R38: Bow kills spawn mob XP orbs (direct handleBowFire unit test)
// ---------------------------------------------------------------------------

describe('step R38 — bow kill spawns XP orb', () => {
  it.effect('droppedXpOrbService.spawn is called with Zombie xp reward after a lethal bow shot', () => Effect.gen(function* () {
    // Call handleBowFire directly with a fully-charged shot (secsHeld=1.0 ≥ BOW_MIN_CHARGE_SECS=0.2).
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 64, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })

    // Arrow in inventory; BOW slot item (no enchantments).
    ;(services.inventoryService as { removeBlock: unknown }).removeBlock = vi.fn(() => Effect.succeed(true))
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({ itemType: 'BOW', count: 1, enchantments: [] }))
    )
    ;(services.inventoryService as { damageSlot: unknown }).damageSlot = vi.fn(() => Effect.void)

    // Zombie entity directly in front of camera (same y as camera, no vertical offset issues).
    // Using camera y=64 and entity y=63.1 → entityCenter y = 63.1+0.9 = 64 = camera y.
    const entity = { entityId: 'entity-1', position: { x: 0, y: 63.1, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 1, type: 'Zombie' }
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(entity)))
    const applyDamageSpy = vi.fn(() =>
      Effect.succeed(Option.some([{ blockType: 'ROTTEN_FLESH', count: 1 }]))
    )
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy

    const addXPSpy = vi.fn(() => Effect.succeed({ totalXP: 0, level: 0, xpIntoLevel: 0, xpRequiredForNext: 7 }))
    const spawnDroppedItemSpy = vi.fn(() => Effect.void)
    const spawnXpOrbSpy = vi.fn(() => Effect.void)
    ;(services.xpService as { addXP: unknown }).addXP = addXPSpy
    ;(services.droppedItemService as { spawn: unknown }).spawn = spawnDroppedItemSpy
    ;(services.droppedXpOrbService as { spawn: unknown }).spawn = spawnXpOrbSpy

    yield* handleBowFire(
      deps,
      services,
      [entity],
      { chargeStartSecs: 0, nowSecs: 1.0 },  // secsHeld = 1.0 ≥ 0.2
    )

    expect(applyDamageSpy).toHaveBeenCalled()
    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({
      itemType: 'ROTTEN_FLESH',
      count: 1,
      position: { x: 0, y: 63.6, z: -2 },
      velocity: { x: 0, y: 0.14, z: 0 },
    }))
    // Zombie xpReward is 5 (from getMobDefinition).
    expect(spawnXpOrbSpy).toHaveBeenCalledWith(expect.objectContaining({
      amount: 5,
      position: { x: 0, y: 63.6, z: -2 },
    }))
    expect(addXPSpy).not.toHaveBeenCalled()
  }))

  it.effect('short bow charge returns before touching the hotbar', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const selectedSlotSpy = vi.fn(() => Effect.succeed(0))
    ;(services.hotbarService as { getSelectedSlot: unknown }).getSelectedSlot = selectedSlotSpy

    yield* handleBowFire(deps, services, [], { chargeStartSecs: 0, nowSecs: 0.1 })

    expect(selectedSlotSpy).not.toHaveBeenCalled()
  }))

  it.effect('bow shot returns when a non-Infinity bow cannot consume an arrow', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({ itemType: 'BOW', count: 1, enchantments: [] }))
    )
    ;(services.inventoryService as { removeBlock: unknown }).removeBlock = vi.fn(() =>
      Effect.fail(new Error('no arrows'))
    )
    const damageSlotSpy = vi.fn(() => Effect.void)
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.inventoryService as { damageSlot: unknown }).damageSlot = damageSlotSpy
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* handleBowFire(deps, services, [], { chargeStartSecs: 0, nowSecs: 1.0 })

    expect(damageSlotSpy).not.toHaveBeenCalled()
    expect(applyDamageSpy).not.toHaveBeenCalled()
  }))

  it.effect('Punch applies scaled knockback when the arrow hit is not lethal', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 64, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({
        itemType: 'BOW',
        count: 1,
        enchantments: [{ type: 'INFINITY', level: 1 }, { type: 'PUNCH', level: 2 }],
      }))
    )
    ;(services.inventoryService as { damageSlot: unknown }).damageSlot = vi.fn(() => Effect.void)
    const entity = { entityId: 'entity-1', position: { x: 0, y: 63.1, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(entity)))
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = vi.fn(() => Effect.succeed(Option.none()))
    const applyKnockbackSpy = vi.fn(() => Effect.void)
    ;(services.entityManager as { applyKnockback: unknown }).applyKnockback = applyKnockbackSpy

    yield* handleBowFire(deps, services, [entity], { chargeStartSecs: 0, nowSecs: 1.0 })

    expect(applyKnockbackSpy).toHaveBeenCalledWith('entity-1', expect.objectContaining({
      x: 0,
      y: expect.any(Number),
      z: expect.any(Number),
    }))
    expect(applyKnockbackSpy.mock.calls[0]?.[1].z).toBeLessThan(-5)
  }))

  it.effect('Looting spawns bonus dropped items', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 64, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({
        itemType: 'BOW',
        count: 1,
        enchantments: [{ type: 'INFINITY', level: 1 }, { type: 'POWER', level: 1 }, { type: 'LOOTING', level: 2 }],
      }))
    )
    ;(services.inventoryService as { damageSlot: unknown }).damageSlot = vi.fn(() => Effect.void)
    const spawnDroppedItemSpy = vi.fn(() => Effect.void)
    ;(services.droppedItemService as { spawn: unknown }).spawn = spawnDroppedItemSpy
    const entity = { entityId: 'entity-1', position: { x: 0, y: 63.1, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 1, type: 'Zombie' }
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(entity)))
    const applyDamageSpy = vi.fn(() =>
      Effect.succeed(Option.some([{ blockType: 'ROTTEN_FLESH', count: 1 }]))
    )
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy
    ;(services.xpService as { addXP: unknown }).addXP = vi.fn(() =>
      Effect.succeed({ totalXP: 0, level: 0, xpIntoLevel: 0, xpRequiredForNext: 7 })
    )

    yield* handleBowFire(deps, services, [entity], { chargeStartSecs: 0, nowSecs: 1.0 })

    expect(applyDamageSpy.mock.calls[0]?.[1]).toBeGreaterThan(3)
    expect(spawnDroppedItemSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
      itemType: 'ROTTEN_FLESH',
      count: 1,
      position: { x: 0, y: 63.6, z: -2 },
      velocity: { x: 0, y: 0.14, z: 0 },
    }))
    expect(spawnDroppedItemSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
      itemType: 'ROTTEN_FLESH',
      count: 2,
      position: { x: 0, y: 63.6, z: -2 },
      velocity: { x: 0, y: 0.14, z: 0 },
    }))
  }))

  it.effect('Unbreaking can skip bow durability when the roll succeeds', () => Effect.gen(function* () {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.inventoryService as { getSlot: unknown }).getSlot = vi.fn(() =>
      Effect.succeed(Option.some({
        itemType: 'BOW',
        count: 1,
        enchantments: [{ type: 'INFINITY', level: 1 }, { type: 'UNBREAKING', level: 3 }],
      }))
    )
    const damageSlotSpy = vi.fn(() => Effect.void)
    ;(services.inventoryService as { damageSlot: unknown }).damageSlot = damageSlotSpy

    yield* handleBowFire(deps, services, [], { chargeStartSecs: 0, nowSecs: 1.0 })
    randomSpy.mockRestore()

    expect(damageSlotSpy).not.toHaveBeenCalled()
  }))

  it.effect('eating GOLDEN_APPLE also heals 4 HP (R53)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetHit: unknown }).getTargetHit = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('GOLDEN_APPLE'))
    )
    ;(services.hungerService as { getHunger: unknown }).getHunger = vi.fn(() =>
      Effect.succeed({ foodLevel: 10, saturation: 0, exhaustion: 0 })
    )
    ;(services.hungerService as { eat: unknown }).eat = vi.fn(() => Effect.void)
    ;(services.inventoryService as { removeBlock: unknown }).removeBlock = vi.fn(() => Effect.succeed(true))
    const healSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { heal: unknown }).heal = healSpy

    yield* runFrame(deps, services)

    expect(healSpy).toHaveBeenCalledWith(4)
  }))
})
