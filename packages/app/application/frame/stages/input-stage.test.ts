import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, MutableHashSet, Option, Ref } from 'effect'
import { KeyMappings } from '@ts-minecraft/player'
import {
  TRADE_OPEN_KEY,
  TRADE_NEXT_KEY,
  TRADE_PREV_KEY,
  TRADE_EXECUTE_KEY,
} from '@ts-minecraft/app/frame-handler.config'
import {
  DEFAULT_SETTINGS,
  arrangeFrameHarness,
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  makeTradingPresentation,
  runFrame,
} from '@test/frame-handler-test-kit'

// ---------------------------------------------------------------------------
// Escape key: overlay toggle logic
// ---------------------------------------------------------------------------

describe('Escape key handling', () => {
  it.effect('closes inventory and sets gamePausedRef to false when Escape is pressed while inventory is open', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(KeyMappings.ESCAPE)
    const { deps, services, inventoryState } = yield* arrangeFrameHarness({ paused: true, inventoryOpen: true, pressedKeys })

    yield* runFrame(deps, services)

    // Inventory must now be closed
    expect(inventoryState.open).toBe(false)
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

  // FR-1.4: ESC during play opens the pause menu (not the settings overlay).
  // Settings is now reachable via the pause menu's "Settings" button.
  it.effect('opens the pause menu (NOT settings) when Escape is pressed while nothing is open', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(KeyMappings.ESCAPE)
    const { deps, services, settingsState } = yield* arrangeFrameHarness({ pressedKeys })
    const openIfClosedSpy = vi.fn(() => Effect.void)
    ;(services.pauseMenu as unknown as { openIfClosed: unknown }).openIfClosed = openIfClosedSpy

    yield* runFrame(deps, services)

    // Pause menu must have been opened
    expect(openIfClosedSpy).toHaveBeenCalledOnce()
    // Settings overlay must NOT have been opened by ESC alone
    expect(settingsState.open).toBe(false)
    // gamePausedRef is unchanged here — pauseMenu owns its own pause state
    // (via the watchdog/attach mechanism), so the inputStage doesn't toggle it.
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(false)
  }))

  it.effect('does not change overlay states when Escape is not pressed', () => Effect.gen(function* () {
    const { deps, services, inventoryState, settingsState } = yield* arrangeFrameHarness()

    yield* runFrame(deps, services)

    expect(inventoryState.open).toBe(false)
    expect(settingsState.open).toBe(false)
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(false)
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

    yield* runFrame(deps, services)

    // Inventory must now be open
    expect(invState.open).toBe(true)
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

    yield* runFrame(deps, services)

    // Inventory must now be closed
    expect(invState.open).toBe(false)
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
})

describe('inventory crafting runtime wiring', () => {
  it.effect('routes inventory overlay navigation keys to crafting controls when inventory is open', () => Effect.gen(function* () {
    const deps = yield* makeDeps(true)
    const pressedKeys = MutableHashSet.make('ArrowDown', 'ArrowUp', 'Enter')
    const inventoryState = { open: true }
    const inventoryRenderer = makeInventoryRenderer(inventoryState)
    const cycleSpy = vi.fn(() => Effect.void)
    const craftSpy = vi.fn(() => Effect.succeed(true))
    ;(inventoryRenderer as unknown as { cycleRecipes: unknown }).cycleRecipes = cycleSpy
    ;(inventoryRenderer as unknown as { craftSelectedRecipe: unknown }).craftSelectedRecipe = craftSpy

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
  it.effect('updates TimeService when dayLengthSeconds has changed', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const setDayLengthSpy = vi.fn(() => Effect.void)
    // getDayLength returns a different value than DEFAULT_SETTINGS — forces the branch
    const differentDayLength = DEFAULT_SETTINGS.dayLengthSeconds + 100

    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // Override timeService so getDayLength returns a value ≠ input dayLengthSeconds
    ;(services.timeService as unknown as { getDayLength: unknown }).getDayLength =
      () => Effect.succeed(differentDayLength)
    ;(services.timeService as unknown as { setDayLength: unknown }).setDayLength = setDayLengthSpy

    // runFrame uses DEFAULT_SETTINGS.dayLengthSeconds as the frame input;
    // differentDayLength ≠ DEFAULT_SETTINGS.dayLengthSeconds → update must fire
    yield* runFrame(deps, services)

    expect(setDayLengthSpy).toHaveBeenCalledWith(DEFAULT_SETTINGS.dayLengthSeconds)
  }))

  it.effect('skips TimeService update when dayLengthSeconds has not changed', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const setDayLengthSpy = vi.fn(() => Effect.void)

    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // getDayLength already returns DEFAULT_SETTINGS.dayLengthSeconds (same as frame input)
    ;(services.timeService as unknown as { setDayLength: unknown }).setDayLength = setDayLengthSpy

    yield* runFrame(deps, services)

    expect(setDayLengthSpy).not.toHaveBeenCalled()
  }))
})

// ---------------------------------------------------------------------------
// T key (TRADE_OPEN_KEY): trade open/close
// ---------------------------------------------------------------------------

describe('T key (trade open/close)', () => {
  it.effect('opens trade and sets gamePausedRef to true when T is pressed and a villager is nearby', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(TRADE_OPEN_KEY)
    const tradingState = { open: false }
    const openSpy = vi.fn((_villagerId: string) => Effect.sync(() => {
      tradingState.open = true
      return true
    }))

    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
      tradingPresentation: makeTradingPresentation(tradingState),
    })
    // Override open spy to track call + override villageService to return a villager
    ;(services.tradingPresentation as unknown as { open: unknown }).open = openSpy
    ;(services.villageService as unknown as { findNearestVillager: unknown }).findNearestVillager =
      () => Effect.succeed(Option.some({ villagerId: 'villager-1', position: { x: 0, y: 64, z: 0 } }))

    yield* runFrame(deps, services)

    expect(openSpy).toHaveBeenCalledOnce()
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(true)
  }))

  it.effect('closes trade and sets gamePausedRef to false when T is pressed while trade is already open', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(TRADE_OPEN_KEY)
    const tradingState = { open: true }
    const closeSpy = vi.fn(() => Effect.sync(() => { tradingState.open = false }))

    const deps = yield* makeDeps(true /* paused because trade is open */)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
      tradingPresentation: makeTradingPresentation(tradingState),
    })
    ;(services.tradingPresentation as unknown as { close: unknown }).close = closeSpy

    yield* runFrame(deps, services)

    expect(closeSpy).toHaveBeenCalledOnce()
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(false)
  }))

  it.effect('does not open trade when T is pressed but no villager is nearby', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(TRADE_OPEN_KEY)
    const openSpy = vi.fn(() => Effect.succeed(true))

    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
      tradingPresentation: makeTradingPresentation({ open: false }),
    })
    // Default villageService already returns Option.none() — no override needed
    ;(services.tradingPresentation as unknown as { open: unknown }).open = openSpy

    yield* runFrame(deps, services)

    expect(openSpy).not.toHaveBeenCalled()
  }))
})

// ---------------------------------------------------------------------------
// Trade navigation keys when trade overlay is open
// ---------------------------------------------------------------------------

describe('trade navigation keys (trade open)', () => {
  it.effect('routes TRADE_PREV_KEY and TRADE_NEXT_KEY to cycleSelection when trade is open', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(TRADE_PREV_KEY, TRADE_NEXT_KEY)
    const tradingState = { open: true }
    const cycleSpy = vi.fn(() => Effect.void)

    const deps = yield* makeDeps(true /* paused because trade is open */)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
      tradingPresentation: makeTradingPresentation(tradingState),
    })
    ;(services.tradingPresentation as unknown as { cycleSelection: unknown }).cycleSelection = cycleSpy

    yield* runFrame(deps, services)

    expect(cycleSpy).toHaveBeenCalledWith(-1)
    expect(cycleSpy).toHaveBeenCalledWith(1)
  }))

  it.effect('executes selected trade when TRADE_EXECUTE_KEY is pressed and trade is open', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(TRADE_EXECUTE_KEY)
    const tradingState = { open: true }
    const executeSpy = vi.fn(() => Effect.succeed(true))

    const deps = yield* makeDeps(true /* paused because trade is open */)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
      tradingPresentation: makeTradingPresentation(tradingState),
    })
    ;(services.tradingPresentation as unknown as { executeSelectedTrade: unknown }).executeSelectedTrade = executeSpy

    yield* runFrame(deps, services)

    expect(executeSpy).toHaveBeenCalledOnce()
  }))
})
