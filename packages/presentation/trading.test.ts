import { beforeEach, describe, it } from '@effect/vitest'
import { it as itPlain } from 'vitest'
import { Effect, Option } from 'effect'
import { expect } from 'vitest'
import { TradingPresentationService } from '@ts-minecraft/presentation/trading'
import { TradeFailure, TradeSuccess } from '@ts-minecraft/entity'
import { VillagerId } from '@ts-minecraft/entity'
import { normalizeSelection, tradeResultText } from './trading.config'
import { createTradingTestLayer, installBrowserDocument, makeOffer, makeVillager } from './trading-test-utils'

describe('normalizeSelection', () => {
  itPlain('returns 0 when length is zero or negative', () => {
    expect(normalizeSelection(0, 5)).toBe(0)
    expect(normalizeSelection(-3, 2)).toBe(0)
  })

  itPlain('wraps a positive index within length', () => {
    expect(normalizeSelection(3, 0)).toBe(0)
    expect(normalizeSelection(3, 1)).toBe(1)
    expect(normalizeSelection(3, 2)).toBe(2)
    expect(normalizeSelection(3, 3)).toBe(0)
    expect(normalizeSelection(3, 4)).toBe(1)
  })

  itPlain('wraps a negative index to a positive result (JS modulo correction)', () => {
    // JS: -1 % 3 === -1; normalizeSelection adds length to get 2
    expect(normalizeSelection(3, -1)).toBe(2)
    expect(normalizeSelection(3, -4)).toBe(2)
    // -3 % 3 is -0 in JS (not +0); both are functionally zero but Object.is distinguishes them
    expect(Object.is(normalizeSelection(3, -3), -0) || normalizeSelection(3, -3) === 0).toBe(true)
  })
})

describe('tradeResultText', () => {
  itPlain('TradeSuccess without level-up returns "Trade complete."', () => {
    const result = new TradeSuccess({ offer: makeOffer(), villager: makeVillager(), levelUp: false })
    expect(tradeResultText(result)).toBe('Trade complete.')
  })

  itPlain('TradeSuccess with level-up includes profession and new level', () => {
    const villager = { ...makeVillager(), profession: 'Farmer', level: 2 }
    const result = new TradeSuccess({ offer: makeOffer(), villager, levelUp: true })
    expect(tradeResultText(result)).toBe('Trade complete. Farmer reached level 2.')
  })

  itPlain('TradeFailure replaces underscores with spaces in reason', () => {
    const result = new TradeFailure({ reason: 'inventory_full' })
    expect(tradeResultText(result)).toBe('Trade failed: inventory full')
  })

  itPlain('TradeFailure with multi-underscore reason replaces all occurrences', () => {
    const result = new TradeFailure({ reason: 'villager_level_too_low' })
    expect(tradeResultText(result)).toBe('Trade failed: villager level too low')
  })
})

describe('TradingPresentationService', () => {
  beforeEach(() => {
    installBrowserDocument()
  })

  it.effect('opens and renders villager offers', () => {
      const { TestLayer, createdElements, appendChild } = createTradingTestLayer()

    return Effect.gen(function* () {
      const presentation = yield* TradingPresentationService
      const opened = yield* presentation.open(VillagerId.make('villager-1'))
      const root = createdElements[0]!
      const title = createdElements[1]!
      const currency = createdElements[2]!
      const list = createdElements[3]!

      expect(opened).toBe(true)
      expect(appendChild).toHaveBeenCalledOnce()
      expect(title.textContent).toBe('Trading with villager-1')
      expect(currency.textContent).toBe('Currency: EMERALD_ORE')
      expect(list.children).toHaveLength(2)
      expect(root.style.display).toBe('block')
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('returns false when the villager does not exist', () => {
    const { TestLayer, setVillager } = createTradingTestLayer()

    return Effect.gen(function* () {
      yield* setVillager(Option.none())
      const presentation = yield* TradingPresentationService
      const opened = yield* presentation.open(VillagerId.make('villager-1'))

      expect(opened).toBe(false)
      expect(yield* presentation.isOpen()).toBe(false)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('closes and reports visibility state', () => {
      const { TestLayer, createdElements } = createTradingTestLayer()

    return Effect.gen(function* () {
      const presentation = yield* TradingPresentationService
      yield* presentation.open(VillagerId.make('villager-1'))
      expect(yield* presentation.isOpen()).toBe(true)

      yield* presentation.close()
      expect(yield* presentation.isOpen()).toBe(false)
      expect(createdElements[0]!.style.display).toBe('none')
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('cycles selection with wraparound and refreshes the highlighted row', () => {
    const { TestLayer, createdElements } = createTradingTestLayer()

    return Effect.gen(function* () {
      const presentation = yield* TradingPresentationService
      yield* presentation.open(VillagerId.make('villager-1'))
      yield* presentation.cycleSelection(1)

      const list = createdElements.find((element) => element.style.cssText.includes('display:flex'))!
      expect(list.children[1]!.style.cssText).toContain('background:#2f4f2f')

      yield* presentation.cycleSelection(1)
      expect(list.children[0]!.style.cssText).toContain('background:#2f4f2f')
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('refresh reflects updated offers', () => {
    const { TestLayer, createdElements, setOffers } = createTradingTestLayer()

    return Effect.gen(function* () {
      const presentation = yield* TradingPresentationService
      yield* presentation.open(VillagerId.make('villager-1'))
      yield* setOffers([makeOffer({ output: { itemType: 'GLASS', count: 1 } })])
      yield* presentation.refresh()

      const list = createdElements.find((element) => element.style.cssText.includes('display:flex'))!
      expect(list.children).toHaveLength(1)
      expect(list.children[0]!.textContent).toContain('GLASS')
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('executeSelectedTrade reports success and refreshes status text', () => {
    const { TestLayer, createdElements } = createTradingTestLayer()

    return Effect.gen(function* () {
      const presentation = yield* TradingPresentationService
      yield* presentation.open(VillagerId.make('villager-1'))
      const executed = yield* presentation.executeSelectedTrade()

      expect(executed).toBe(true)
      const status = createdElements.find((element) => element.style.cssText.includes('font-size:12px;color:#b0b0b0'))!
      expect(status.textContent).toBe('Trade complete.')
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('executeSelectedTrade reports failure text when trade fails', () => {
    const { TestLayer, createdElements, setTradeResult } = createTradingTestLayer()

    return Effect.gen(function* () {
      yield* setTradeResult(new TradeFailure({ reason: 'inventory_full' }))
      const presentation = yield* TradingPresentationService
      yield* presentation.open(VillagerId.make('villager-1'))
      const executed = yield* presentation.executeSelectedTrade()

      expect(executed).toBe(false)
      const status = createdElements.find((element) => element.style.cssText.includes('font-size:12px;color:#b0b0b0'))!
      expect(status.textContent).toBe('Trade failed: inventory full')
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('cleans up the overlay when the scope closes', () => {
      const { TestLayer, createdElements } = createTradingTestLayer()

    return Effect.scoped(Effect.gen(function* () {
      const presentation = yield* TradingPresentationService
      yield* presentation.open(VillagerId.make('villager-1'))
    })).pipe(Effect.provide(TestLayer), Effect.zipRight(Effect.sync(() => {
      expect(createdElements[0]!.parentNode).toBe(null)
    })))
  })
})
