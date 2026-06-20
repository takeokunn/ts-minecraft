import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect, MutableHashSet, Option, Ref } from 'effect'
import { createFrameHandlers } from '@ts-minecraft/app/frame-handler'
import { SlotIndex } from '@ts-minecraft/core'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import { GAMEPLAY_HUD_HIDDEN_CLASS } from '@ts-minecraft/presentation'
import { OPEN_MENU_KEY } from '@ts-minecraft/app/frame-handler.config'
import { DEFAULT_SETTINGS } from '../../../test/frame-handler-test-kit/shared'
import {
  arrangeFrameHarness,
  runFrame,
} from '../../../test/frame-handler-test-kit/orchestration/harness'
import { makeDeps } from '../../../test/frame-handler-test-kit/orchestration/deps'
import { makeInputService } from '../../../test/frame-handler-test-kit/presentation/input'
import {
  makeInventoryRenderer,
  makeSettingsOverlay,
  makeTradingPresentation,
} from '../../../test/frame-handler-test-kit/presentation/overlay'
import { makeServices } from '../../../test/frame-handler-test-kit/services'

const FRAME_DELTA = 0.016 as DeltaTimeSecs

const stubDocumentBodyClassList = (): Set<string> => {
  const classes = new Set<string>()
  vi.stubGlobal('document', {
    body: {
      classList: {
        add: (name: string) => { classes.add(name) },
        remove: (name: string) => { classes.delete(name) },
        contains: (name: string) => classes.has(name),
        toggle: (name: string, force?: boolean) => {
          const shouldAdd = force ?? !classes.has(name)
          if (shouldAdd) {
            classes.add(name)
          } else {
            classes.delete(name)
          }
          return shouldAdd
        },
      },
    },
  })
  return classes
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Escape key: overlay toggle logic
// ---------------------------------------------------------------------------

describe('Escape key handling', () => {
  it.effect('closes inventory and sets gamePausedRef to false when Escape is pressed while inventory is open', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(KeyMappings.ESCAPE)
    const { deps, services, inventoryState } = yield* arrangeFrameHarness({ paused: true, inventoryOpen: true, pressedKeys })
    const playEffectSpy = vi.fn(() => Effect.void)
    Object.assign(services.soundManager, { playEffect: playEffectSpy })

    yield* runFrame(deps, services)

    // Inventory must now be closed
    expect(inventoryState.open).toBe(false)
    expect(playEffectSpy).toHaveBeenCalledWith('inventoryClose')
    expect(playEffectSpy).not.toHaveBeenCalledWith('inventoryOpen')
    // gamePausedRef must be false
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(false)
  }))

  it.effect('closes settings and sets gamePausedRef to false when Escape is pressed while settings is open', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(KeyMappings.ESCAPE)
    const { deps, services, settingsState } = yield* arrangeFrameHarness({ paused: true, settingsOpen: true, pressedKeys })

    yield* runFrame(deps, services)

    // Settings must now be closed
    expect(settingsState.open).toBe(false)
    // gamePausedRef must be false
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(false)
  }))

  // Vanilla behavior: pressing Escape with nothing open opens the pause menu.
  it.effect('opens the pause menu when Escape is pressed with no modal open', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(KeyMappings.ESCAPE)
    const { deps, services, settingsState } = yield* arrangeFrameHarness({ pressedKeys })

    yield* runFrame(deps, services)

    expect(settingsState.open).toBe(false)
    expect(yield* services.pauseMenu.isOpen()).toBe(true)
    expect(yield* Ref.get(deps.gamePausedRef)).toBe(true)
  }))

  // OPEN_MENU_KEY (the decoupled menu key) opens the pause menu and pauses the game.
  it.effect('opens the pause menu and pauses when OPEN_MENU_KEY is pressed', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(OPEN_MENU_KEY)
    const { deps, services } = yield* arrangeFrameHarness({ pressedKeys })

    // gamePausedRef starts false (nothing open)
    expect(yield* Ref.get(deps.gamePausedRef)).toBe(false)

    yield* runFrame(deps, services)

    // Menu is now open → reconcile keeps the game paused
    expect(yield* services.pauseMenu.isOpen()).toBe(true)
    expect(yield* Ref.get(deps.gamePausedRef)).toBe(true)
  }))

  it.effect('OPEN_MENU_KEY does NOT open the pause menu while another overlay (inventory) is open', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(OPEN_MENU_KEY)
    const { deps, services } = yield* arrangeFrameHarness({ inventoryOpen: true, pressedKeys })
    const openIfClosedSpy = vi.fn(() => Effect.void)
    Object.assign(services.pauseMenu, { openIfClosed: openIfClosedSpy })

    yield* runFrame(deps, services)

    expect(openIfClosedSpy).not.toHaveBeenCalled()
  }))

  it.effect('does not change overlay states when Escape is not pressed', () => Effect.gen(function* () {
    const { deps, services, inventoryState, settingsState } = yield* arrangeFrameHarness()

    yield* runFrame(deps, services)

    expect(inventoryState.open).toBe(false)
    expect(settingsState.open).toBe(false)
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(false)
  }))

  // Line 57: empty no-op branch — pause menu has its own ESC handler
  it.effect('does nothing when Escape is pressed while pause menu is open', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(KeyMappings.ESCAPE)
    const settingsState = { open: false }
    const invState = { open: false }

    const deps = yield* makeDeps(true /* paused because pause menu is open */)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer(invState),
      settingsOverlay: makeSettingsOverlay(settingsState),
    })
    // Report pause menu as open; track openIfClosed to ensure it's not called
    const openIfClosedSpy = vi.fn(() => Effect.void)
    Object.assign(services.pauseMenu, {
      isOpen: () => Effect.succeed(true),
      openIfClosed: openIfClosedSpy,
    })

    yield* runFrame(deps, services)

    // Settings must NOT have been toggled
    expect(settingsState.open).toBe(false)
    // Inventory must NOT have been toggled
    expect(invState.open).toBe(false)
    // openIfClosed must NOT have been called
    expect(openIfClosedSpy).not.toHaveBeenCalled()
    // gamePausedRef stays true — pause menu owns its own pause state
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(true)
  }))
})

describe('F1 HUD visibility handling', () => {
  it.effect('toggles the gameplay HUD hidden class when F1 is pressed', () => Effect.gen(function* () {
    const classes = stubDocumentBodyClassList()
    const pressedKeys = MutableHashSet.make(KeyMappings.HUD_TOGGLE)
    const { deps, services } = yield* arrangeFrameHarness({ pressedKeys })

    yield* runFrame(deps, services)

    expect(classes.has(GAMEPLAY_HUD_HIDDEN_CLASS)).toBe(true)
  }))

  it.effect('does not change HUD visibility when F1 is not pressed', () => Effect.gen(function* () {
    const classes = stubDocumentBodyClassList()
    const { deps, services } = yield* arrangeFrameHarness()

    yield* runFrame(deps, services)

    expect(classes.has(GAMEPLAY_HUD_HIDDEN_CLASS)).toBe(false)
  }))
})

describe('Q item drop handling', () => {
  it.effect('removes one item from the selected hotbar slot and spawns a dropped item when Q is pressed during gameplay', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(KeyMappings.DROP_ITEM)
    const { deps, services } = yield* arrangeFrameHarness({ pressedKeys })
    const removeBlockSpy = vi.fn(() => Effect.void)
    const spawnSpy = vi.fn(() => Effect.succeed({
      id: 'drop-1',
      itemType: 'DIRT',
      count: 1,
      position: { x: 0, y: 64, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      ageTicks: 0,
      pickupDelayTicks: 10,
    }))

    Object.assign(services.hotbarService, {
      getSelectedBlockType: () => Effect.succeed(Option.some('DIRT')),
      getSelectedSlot: () => Effect.succeed(SlotIndex.make(2)),
    })
    Object.assign(services.inventoryService, {
      removeBlock: removeBlockSpy,
    })
    Object.assign(services.droppedItemService, {
      spawn: spawnSpy,
    })

    yield* runFrame(deps, services)

    expect(removeBlockSpy).toHaveBeenCalledTimes(1)
    const [[itemType, count, slot]] = removeBlockSpy.mock.calls
    expect(itemType).toBe('DIRT')
    expect(count).toBe(1)
    expect(SlotIndex.toNumber(slot)).toBe(HOTBAR_START + 2)
    expect(spawnSpy).toHaveBeenCalledWith({
      itemType: 'DIRT',
      count: 1,
      position: { x: 0, y: 64, z: 0 },
      pickupDelayTicks: 10,
    })
  }))

  it.effect('does not drop the selected item while a modal is open', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(KeyMappings.DROP_ITEM)
    const { deps, services } = yield* arrangeFrameHarness({ paused: true, inventoryOpen: true, pressedKeys })
    const removeBlockSpy = vi.fn(() => Effect.void)

    Object.assign(services.hotbarService, {
      getSelectedBlockType: () => Effect.succeed(Option.some('DIRT')),
      getSelectedSlot: () => Effect.succeed(SlotIndex.make(2)),
    })
    Object.assign(services.inventoryService, {
      removeBlock: removeBlockSpy,
    })

    yield* runFrame(deps, services)

    expect(removeBlockSpy).not.toHaveBeenCalled()
  }))

  it.effect('does nothing when the selected hotbar slot is empty', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(KeyMappings.DROP_ITEM)
    const { deps, services } = yield* arrangeFrameHarness({ pressedKeys })
    const removeBlockSpy = vi.fn(() => Effect.void)

    Object.assign(services.hotbarService, {
      getSelectedBlockType: () => Effect.succeed(Option.none()),
      getSelectedSlot: () => Effect.succeed(SlotIndex.make(2)),
    })
    Object.assign(services.inventoryService, {
      removeBlock: removeBlockSpy,
    })

    yield* runFrame(deps, services)

    expect(removeBlockSpy).not.toHaveBeenCalled()
  }))
})

// ---------------------------------------------------------------------------
// KeyE (inventory) key: overlay toggle logic
// ---------------------------------------------------------------------------

describe('inventory key (KeyE) handling', () => {
  it.effect('opens inventory and sets gamePausedRef to true when KeyE is pressed while inventory is closed', () => Effect.gen(function* () {
    const invState = { open: false }
    const setState = { open: false }
    const pressedKeys = MutableHashSet.make(KeyMappings.INVENTORY_OPEN)

    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer(invState),
      settingsOverlay: makeSettingsOverlay(setState),
    })
    const playEffectSpy = vi.fn(() => Effect.void)
    Object.assign(services.soundManager, { playEffect: playEffectSpy })

    yield* runFrame(deps, services)

    // Inventory must now be open
    expect(invState.open).toBe(true)
    expect(playEffectSpy).toHaveBeenCalledWith('inventoryOpen')
    expect(playEffectSpy).not.toHaveBeenCalledWith('inventoryClose')
    // gamePausedRef must be true
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(true)
  }))

  it.effect('closes inventory and sets gamePausedRef to false when KeyE is pressed while inventory is open', () => Effect.gen(function* () {
    const invState = { open: true }
    const setState = { open: false }
    const pressedKeys = MutableHashSet.make(KeyMappings.INVENTORY_OPEN)

    const deps = yield* makeDeps(true /* paused because inventory is open */)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer(invState),
      settingsOverlay: makeSettingsOverlay(setState),
    })
    const playEffectSpy = vi.fn(() => Effect.void)
    Object.assign(services.soundManager, { playEffect: playEffectSpy })

    yield* runFrame(deps, services)

    // Inventory must now be closed
    expect(invState.open).toBe(false)
    expect(playEffectSpy).toHaveBeenCalledWith('inventoryClose')
    expect(playEffectSpy).not.toHaveBeenCalledWith('inventoryOpen')
    // gamePausedRef must be false
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(false)
  }))

  it.effect('closes settings and opens inventory when KeyE is pressed while settings is open', () => Effect.gen(function* () {
    const invState = { open: false }
    const setState = { open: true }
    const pressedKeys = MutableHashSet.make(KeyMappings.INVENTORY_OPEN)

    const deps = yield* makeDeps(true /* paused because settings is open */)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer(invState),
      settingsOverlay: makeSettingsOverlay(setState),
    })

    yield* runFrame(deps, services)

    // Settings must be closed, inventory must be open
    expect(setState.open).toBe(false)
    expect(invState.open).toBe(true)
    // gamePausedRef must be true (inventory now open)
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(true)
  }))

  // Line 84: trade close branch — when KeyE is pressed while trade is already open
  it.effect('closes trade and opens inventory when KeyE is pressed while trade is open', () => Effect.gen(function* () {
    const invState = { open: false }
    const setState = { open: false }
    const tradingState = { open: true }
    const pressedKeys = MutableHashSet.make(KeyMappings.INVENTORY_OPEN)
    const closeSpy = vi.fn(() => Effect.sync(() => { tradingState.open = false }))

    const deps = yield* makeDeps(true /* paused because trade is open */)
    const tradingPresentation = makeTradingPresentation(tradingState)
    Object.assign(tradingPresentation, { close: closeSpy })

    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer(invState),
      settingsOverlay: makeSettingsOverlay(setState),
      tradingPresentation,
    })

    yield* runFrame(deps, services)

    // Trade must have been closed
    expect(closeSpy).toHaveBeenCalledOnce()
    // Inventory must now be open
    expect(invState.open).toBe(true)
    // gamePausedRef must be true (inventory now open)
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(true)
  }))
})

describe('inventory crafting runtime wiring', () => {
  it.effect('routes inventory overlay navigation keys to crafting controls when inventory is open', () => Effect.gen(function* () {
    const deps = yield* makeDeps(true)
    const pressedKeys = MutableHashSet.make('ArrowDown', 'ArrowUp', 'Enter')
    const inventoryState = { open: true }
    const inventoryRenderer = makeInventoryRenderer(inventoryState)
    const cycleSpy = vi.fn(() => Effect.void)
    const craftSpy = vi.fn(() => Effect.succeed(true))
    Object.assign(inventoryRenderer, {
      cycleRecipes: cycleSpy,
      craftSelectedRecipe: craftSpy,
    })

    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer,
      settingsOverlay: makeSettingsOverlay({ open: false }),
      tradingPresentation: makeTradingPresentation({ open: false }),
    })

    yield* runFrame(deps, services)

    expect(cycleSpy).toHaveBeenCalledWith(-1)
    expect(cycleSpy).toHaveBeenCalledWith(1)
    expect(craftSpy).toHaveBeenCalledOnce()
  }))
})

// ---------------------------------------------------------------------------
// Escape key: closes trade overlay (isTradeOpen branch)
// ---------------------------------------------------------------------------

describe('Escape key: trade overlay branch', () => {
  it.effect('closes trade and sets gamePausedRef to false when Escape is pressed while trade is open', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(KeyMappings.ESCAPE)
    const tradingState = { open: true }

    const deps = yield* makeDeps(true /* paused because trade is open */)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
      tradingPresentation: makeTradingPresentation(tradingState),
    })

    yield* runFrame(deps, services)

    expect(tradingState.open).toBe(false)
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(false)
  }))
})

// ---------------------------------------------------------------------------
// syncDayLength: write-through guard
// ---------------------------------------------------------------------------

describe('syncDayLength', () => {
  it.effect('writes the initial dayLengthSeconds from settings without polling TimeService', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const setDayLengthSpy = vi.fn(() => Effect.void)
    const getDayLengthSpy = vi.fn(() => Effect.succeed(DEFAULT_SETTINGS.dayLengthSeconds + 100))

    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    Object.assign(services.timeService, {
      getDayLength: getDayLengthSpy,
      setDayLength: setDayLengthSpy,
    })

    yield* runFrame(deps, services)

    expect(setDayLengthSpy).toHaveBeenCalledWith(DEFAULT_SETTINGS.dayLengthSeconds)
    expect(getDayLengthSpy).not.toHaveBeenCalled()
  }))

  it.effect('skips TimeService update while cached dayLengthSeconds is unchanged', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const setDayLengthSpy = vi.fn(() => Effect.void)
    const getDayLengthSpy = vi.fn(() => Effect.succeed(DEFAULT_SETTINGS.dayLengthSeconds))

    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    Object.assign(services.timeService, {
      getDayLength: getDayLengthSpy,
      setDayLength: setDayLengthSpy,
    })

    const { frameHandler } = yield* createFrameHandlers(deps, services)
    yield* frameHandler(FRAME_DELTA)
    yield* frameHandler(FRAME_DELTA)

    expect(setDayLengthSpy).toHaveBeenCalledTimes(1)
    expect(setDayLengthSpy).toHaveBeenCalledWith(DEFAULT_SETTINGS.dayLengthSeconds)
    expect(getDayLengthSpy).not.toHaveBeenCalled()
  }))

  it.effect('updates TimeService when dayLengthSeconds settings change', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const setDayLengthSpy = vi.fn(() => Effect.void)
    let settings = { ...DEFAULT_SETTINGS }

    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    Object.assign(services.settingsService, {
      getSettings: () => Effect.succeed(settings),
    })
    Object.assign(services.timeService, { setDayLength: setDayLengthSpy })

    const { frameHandler } = yield* createFrameHandlers(deps, services)
    yield* frameHandler(FRAME_DELTA)

    settings = { ...DEFAULT_SETTINGS, dayLengthSeconds: DEFAULT_SETTINGS.dayLengthSeconds + 60 }
    yield* frameHandler(FRAME_DELTA)

    expect(setDayLengthSpy).toHaveBeenCalledTimes(2)
    expect(setDayLengthSpy).toHaveBeenNthCalledWith(1, DEFAULT_SETTINGS.dayLengthSeconds)
    expect(setDayLengthSpy).toHaveBeenNthCalledWith(2, DEFAULT_SETTINGS.dayLengthSeconds + 60)
  }))
})
