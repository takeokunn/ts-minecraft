import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, MutableHashSet, Option } from 'effect'
import {
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  runFrame,
} from '@test/frame-handler-test-kit'

describe('step 7 — redstone dispatch', () => {
  it.effect('placeWire key (KeyR) calls redstoneService.setComponent with Wire type', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.fromIterable(['KeyR'])
    const inputService = makeInputService(pressedKeys)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 1, y: 64, z: 2 }))
    )
    ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const setComponentSpy = vi.fn(() => Effect.succeed({ type: 'wire', position: { x: 1, y: 64, z: 2 }, state: { active: false, buttonTicksRemaining: 0, pistonExtended: false } }))
    ;(services.redstoneService as unknown as { setComponent: unknown }).setComponent = setComponentSpy

    yield* runFrame(deps, services)

    expect(setComponentSpy).toHaveBeenCalledWith({ x: 1, y: 64, z: 2 }, 'wire')
  }))

  it.effect('toggleLever key (KeyY) calls redstoneService.toggleLever', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.fromIterable(['KeyY'])
    const inputService = makeInputService(pressedKeys)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 3, y: 64, z: 5 }))
    )
    ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const toggleLeverSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.redstoneService as unknown as { toggleLever: unknown }).toggleLever = toggleLeverSpy

    yield* runFrame(deps, services)

    expect(toggleLeverSpy).toHaveBeenCalledWith({ x: 3, y: 64, z: 5 })
  }))

  it.effect('pressButton key (KeyU) calls redstoneService.pressButton', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.fromIterable(['KeyU'])
    const inputService = makeInputService(pressedKeys)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 2, y: 65, z: 3 }))
    )
    ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const pressButtonSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.redstoneService as unknown as { pressButton: unknown }).pressButton = pressButtonSpy

    yield* runFrame(deps, services)

    expect(pressButtonSpy).toHaveBeenCalledWith({ x: 2, y: 65, z: 3 })
  }))

  it.effect('toggleTorch key (KeyI) calls redstoneService.toggleTorch', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.fromIterable(['KeyI'])
    const inputService = makeInputService(pressedKeys)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 5, y: 63, z: 1 }))
    )
    ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const toggleTorchSpy = vi.fn(() => Effect.succeed(Option.none()))
    ;(services.redstoneService as unknown as { toggleTorch: unknown }).toggleTorch = toggleTorchSpy

    yield* runFrame(deps, services)

    expect(toggleTorchSpy).toHaveBeenCalledWith({ x: 5, y: 63, z: 1 })
  }))

  it.effect('placeLever key (KeyL) calls redstoneService.setComponent with Lever type', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.fromIterable(['KeyL'])
    const inputService = makeInputService(pressedKeys)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 4, y: 64, z: 7 }))
    )
    ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const setComponentSpy = vi.fn(() => Effect.succeed({ type: 'lever', position: { x: 4, y: 64, z: 7 }, state: { active: false, buttonTicksRemaining: 0, pistonExtended: false } }))
    ;(services.redstoneService as unknown as { setComponent: unknown }).setComponent = setComponentSpy

    yield* runFrame(deps, services)

    expect(setComponentSpy).toHaveBeenCalledWith({ x: 4, y: 64, z: 7 }, 'lever')
  }))

  it.effect('placeButton key (KeyB) calls redstoneService.setComponent with Button type', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.fromIterable(['KeyB'])
    const inputService = makeInputService(pressedKeys)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 0, y: 62, z: 0 }))
    )
    ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const setComponentSpy = vi.fn(() => Effect.succeed({ type: 'button', position: { x: 0, y: 62, z: 0 }, state: { active: false, buttonTicksRemaining: 0, pistonExtended: false } }))
    ;(services.redstoneService as unknown as { setComponent: unknown }).setComponent = setComponentSpy

    yield* runFrame(deps, services)

    expect(setComponentSpy).toHaveBeenCalledWith({ x: 0, y: 62, z: 0 }, 'button')
  }))

  it.effect('placeTorch key (KeyO) calls redstoneService.setComponent with Torch type', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.fromIterable(['KeyO'])
    const inputService = makeInputService(pressedKeys)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 6, y: 65, z: 3 }))
    )
    ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const setComponentSpy = vi.fn(() => Effect.succeed({ type: 'torch', position: { x: 6, y: 65, z: 3 }, state: { active: true, buttonTicksRemaining: 0, pistonExtended: false } }))
    ;(services.redstoneService as unknown as { setComponent: unknown }).setComponent = setComponentSpy

    yield* runFrame(deps, services)

    expect(setComponentSpy).toHaveBeenCalledWith({ x: 6, y: 65, z: 3 }, 'torch')
  }))

  it.effect('placePiston key (KeyP) calls redstoneService.setComponent with Piston type', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.fromIterable(['KeyP'])
    const inputService = makeInputService(pressedKeys)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.some({ x: 2, y: 63, z: 8 }))
    )
    ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const setComponentSpy = vi.fn(() => Effect.succeed({ type: 'piston', position: { x: 2, y: 63, z: 8 }, state: { active: false, buttonTicksRemaining: 0, pistonExtended: false } }))
    ;(services.redstoneService as unknown as { setComponent: unknown }).setComponent = setComponentSpy

    yield* runFrame(deps, services)

    expect(setComponentSpy).toHaveBeenCalledWith({ x: 2, y: 63, z: 8 }, 'piston')
  }))

  it.effect('no redstone action when target block is absent (orElse fallback)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.fromIterable(['KeyR'])
    const inputService = makeInputService(pressedKeys)
    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
      Effect.succeed(Option.none())
    )
    const setComponentSpy = vi.fn(() => Effect.void)
    ;(services.redstoneService as unknown as { setComponent: unknown }).setComponent = setComponentSpy

    yield* runFrame(deps, services)

    expect(setComponentSpy).not.toHaveBeenCalled()
  }))
})
