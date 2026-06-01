import { beforeEach, describe, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { expect } from 'vitest'
import { TradingPresentationService } from '@ts-minecraft/presentation/trading'
import { TradeFailure, VillagerId } from '@ts-minecraft/entity'
import { createTradingTestLayer, installBrowserDocument, makeOffer } from './trading-test-utils'

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
