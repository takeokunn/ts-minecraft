import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, MutableHashSet, Ref } from 'effect'
import { KeyMappings } from '@ts-minecraft/player'
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
    Object.assign(services.pauseMenu, { openIfClosed: openIfClosedSpy })

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
    Object.assign(services.timeService, {
      getDayLength: () => Effect.succeed(differentDayLength),
      setDayLength: setDayLengthSpy,
    })

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
    Object.assign(services.timeService, { setDayLength: setDayLengthSpy })

    yield* runFrame(deps, services)

    expect(setDayLengthSpy).not.toHaveBeenCalled()
  }))
})
