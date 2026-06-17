import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, MutableHashSet, Option, Ref } from 'effect'
import {
  TRADE_OPEN_KEY,
  TRADE_NEXT_KEY,
  TRADE_PREV_KEY,
  TRADE_EXECUTE_KEY,
} from '@ts-minecraft/app/frame-handler.config'
import {
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  makeTradingPresentation,
  runFrame,
} from '../../../test/frame-handler-test-kit'

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
    Object.assign(services.tradingPresentation, { open: openSpy })
    Object.assign(services.villageService, {
      findNearestVillager: () => Effect.succeed(Option.some({ villagerId: 'villager-1', position: { x: 0, y: 64, z: 0 } })),
    })

    yield* runFrame(deps, services)

    expect(openSpy).toHaveBeenCalledOnce()
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(true)
  }))

  it.effect('closes trade and sets gamePausedRef to false when T is pressed while trade is already open', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(TRADE_OPEN_KEY)
    const tradingState = { open: true }
    const closeSpy = vi.fn(() => Effect.sync(() => { tradingState.open = false }))

    const deps = yield* makeDeps(true)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
      tradingPresentation: makeTradingPresentation(tradingState),
    })
    Object.assign(services.tradingPresentation, { close: closeSpy })

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
    Object.assign(services.tradingPresentation, { open: openSpy })

    yield* runFrame(deps, services)

    expect(openSpy).not.toHaveBeenCalled()
  }))

  it.effect('does not set gamePausedRef to true when T is pressed, villager is nearby, but open() returns false', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(TRADE_OPEN_KEY)
    const tradingState = { open: false }
    const openSpy = vi.fn((_villagerId: string) => Effect.succeed(false))

    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
      tradingPresentation: makeTradingPresentation(tradingState),
    })
    Object.assign(services.tradingPresentation, { open: openSpy })
    Object.assign(services.villageService, {
      findNearestVillager: () => Effect.succeed(Option.some({ villagerId: 'villager-1', position: { x: 0, y: 64, z: 0 } })),
    })

    yield* runFrame(deps, services)

    expect(openSpy).toHaveBeenCalledOnce()
    const paused = yield* Ref.get(deps.gamePausedRef)
    expect(paused).toBe(false)
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

    const deps = yield* makeDeps(true)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
      tradingPresentation: makeTradingPresentation(tradingState),
    })
    Object.assign(services.tradingPresentation, { cycleSelection: cycleSpy })

    yield* runFrame(deps, services)

    expect(cycleSpy).toHaveBeenCalledWith(-1)
    expect(cycleSpy).toHaveBeenCalledWith(1)
  }))

  it.effect('executes selected trade when TRADE_EXECUTE_KEY is pressed and trade is open', () => Effect.gen(function* () {
    const pressedKeys = MutableHashSet.make(TRADE_EXECUTE_KEY)
    const tradingState = { open: true }
    const executeSpy = vi.fn(() => Effect.succeed(true))

    const deps = yield* makeDeps(true)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
      tradingPresentation: makeTradingPresentation(tradingState),
    })
    Object.assign(services.tradingPresentation, { executeSelectedTrade: executeSpy })

    yield* runFrame(deps, services)

    expect(executeSpy).toHaveBeenCalledOnce()
  }))
})
