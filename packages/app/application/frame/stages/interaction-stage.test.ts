import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import * as THREE from 'three'
import {
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  runFrame,
} from '@test/frame-handler-test-kit'

// ---------------------------------------------------------------------------
// Step 7: Block interaction
// ---------------------------------------------------------------------------

describe('step 7 — block interaction', () => {
  it.effect('damages an entity under the crosshair before falling back to block breaking', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.entityManager as unknown as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }])
    )
    const applyDamageSpy = vi.fn(() => Effect.succeed(Option.some([{ blockType: 'DIRT', count: 2 }])))
    const addBlockSpy = vi.fn(() => Effect.succeed(true))
    const breakSpy = vi.fn(() => Effect.void)
    ;(services.entityManager as unknown as { applyDamage: unknown }).applyDamage = applyDamageSpy
    ;(services.inventoryService as unknown as { addBlock: unknown }).addBlock = addBlockSpy
    ;(services.blockService as unknown as { breakBlock: unknown }).breakBlock = breakSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledWith('entity-1', 4)
    expect(addBlockSpy).toHaveBeenCalledWith('DIRT', 2)
    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('calls blockService.breakBlock on left-click when a target block is available', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    // Override consumeMouseClick to return true for button 0
    ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // Provide a target block
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 0, y: 64, z: 0 }))
    )
    ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const breakSpy = vi.fn(() => Effect.void)
    ;(services.blockService as unknown as { breakBlock: unknown }).breakBlock = breakSpy

    yield* runFrame(deps, services)

    expect(breakSpy).toHaveBeenCalledOnce()
    expect(breakSpy).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 })
  }))

  it.effect('does NOT call blockService.breakBlock when no target block', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // No target block (Option.none)
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const breakSpy = vi.fn(() => Effect.void)
    ;(services.blockService as unknown as { breakBlock: unknown }).breakBlock = breakSpy

    yield* runFrame(deps, services)

    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('calls blockService.placeBlock on right-click when a target hit and hotbar block are available', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.some({ blockX: 0, blockY: 64, blockZ: 0, normal: { x: 0, y: 1, z: 0 } }))
    )
    ;(services.hotbarService as unknown as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('GRASS'))
    )
    ;(services.hotbarService as unknown as { getSelectedSlot: unknown }).getSelectedSlot = vi.fn(() =>
      Effect.succeed(2)
    )
    const placeSpy = vi.fn(() => Effect.void)
    ;(services.blockService as unknown as { placeBlock: unknown }).placeBlock = placeSpy

    yield* runFrame(deps, services)

    expect(placeSpy).toHaveBeenCalledOnce()
    // Adjacent position = block + normal = (0+0, 64+1, 0+0) = (0, 65, 0)
    expect(placeSpy).toHaveBeenCalledWith({ x: 0, y: 65, z: 0 }, 'GRASS', 29)
  }))

  it.effect('plays placement audio only after a successful placeBlock call', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const inputService = makeInputService()
    ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 2)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.some({ blockX: 0, blockY: 64, blockZ: 0, normal: { x: 0, y: 1, z: 0 } }))
    )
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.hotbarService as unknown as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.some('GRASS'))
    )
    ;(services.hotbarService as unknown as { getSelectedSlot: unknown }).getSelectedSlot = vi.fn(() =>
      Effect.succeed(0)
    )
    const placeSpy = vi.fn(() => Effect.fail(new Error('no item')))
    const playEffectSpy = vi.fn(() => Effect.void)
    ;(services.blockService as unknown as { placeBlock: unknown }).placeBlock = placeSpy
    ;(services.soundManager as unknown as { playEffect: unknown }).playEffect = playEffectSpy

    yield* runFrame(deps, services)

    expect(placeSpy).toHaveBeenCalledOnce()
    expect(playEffectSpy).not.toHaveBeenCalledWith('blockPlace', expect.anything())
  }))

  it.effect('suppresses block interaction when game is paused', () => Effect.gen(function* () {
    const deps = yield* makeDeps(true /* paused */)
    const inputService = makeInputService()
    ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 0, y: 64, z: 0 }))
    )
    const breakSpy = vi.fn(() => Effect.void)
    ;(services.blockService as unknown as { breakBlock: unknown }).breakBlock = breakSpy

    yield* runFrame(deps, services)

    expect(breakSpy).not.toHaveBeenCalled()
  }))
})
