import { beforeEach, describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect } from 'vitest'
import { TradingPresentationService } from '@ts-minecraft/app/presentation/trading'
import { TradeSuccess, VillagerId } from '@ts-minecraft/entities'
import { createTradingTestLayer, installBrowserDocument, makeOffer, makeVillager } from './trading-test-utils'

describe('TradingPresentationService', () => {
  beforeEach(() => {
    installBrowserDocument()
  })

  it.effect('renders "no available offers" message when villager has no offers', () => {
    const { TestLayer, createdElements, setOffers } = createTradingTestLayer()

    return Effect.gen(function* () {
      yield* setOffers([])
      const presentation = yield* TradingPresentationService
      const opened = yield* presentation.open(VillagerId.make('villager-1'))
      expect(opened).toBe(true)

      const list = createdElements.find((el) => el.style.cssText.includes('display:flex'))!
      expect(list.children).toHaveLength(1)
      expect(list.children[0]!.textContent).toContain('No available offers')
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('cycleSelection with empty offers list does not change state (normalizeSelection length=0)', () => {
    const { TestLayer, setOffers } = createTradingTestLayer()

    return Effect.gen(function* () {
      yield* setOffers([])
      const presentation = yield* TradingPresentationService
      yield* presentation.open(VillagerId.make('villager-1'))
      yield* presentation.cycleSelection(1)
      expect(yield* presentation.isOpen()).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('executeSelectedTrade shows level-up message on TradeSuccess with levelUp=true', () => {
    const { TestLayer, createdElements, setTradeResult } = createTradingTestLayer()

    return Effect.gen(function* () {
      yield* setTradeResult(
        new TradeSuccess({
          offer: makeOffer(),
          villager: makeVillager(),
          levelUp: true,
        }),
      )
      const presentation = yield* TradingPresentationService
      yield* presentation.open(VillagerId.make('villager-1'))
      const executed = yield* presentation.executeSelectedTrade()

      expect(executed).toBe(true)
      const status = createdElements.find((el) => el.style.cssText.includes('font-size:12px;color:#b0b0b0'))!
      expect(status.textContent).toContain('reached level')
      expect(status.textContent).toContain('Farmer')
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('cycleSelection backwards wraps around to last index (negative modulo branch)', () => {
    const { TestLayer } = createTradingTestLayer()

    return Effect.gen(function* () {
      const presentation = yield* TradingPresentationService
      yield* presentation.open(VillagerId.make('villager-1'))
      yield* presentation.cycleSelection(-1)
      expect(yield* presentation.isOpen()).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('cycleSelection when UI is not open is a no-op (onNone path)', () => {
    const { TestLayer } = createTradingTestLayer()
    return Effect.gen(function* () {
      const presentation = yield* TradingPresentationService
      yield* presentation.cycleSelection(1)
      expect(yield* presentation.isOpen()).toBe(false)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('refresh when UI is not open renders empty UI (onNone path)', () => {
    const { TestLayer } = createTradingTestLayer()
    return Effect.gen(function* () {
      const presentation = yield* TradingPresentationService
      yield* presentation.refresh()
      expect(yield* presentation.isOpen()).toBe(false)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('executeSelectedTrade when UI is not open returns false (onNone path)', () => {
    const { TestLayer } = createTradingTestLayer()
    return Effect.gen(function* () {
      const presentation = yield* TradingPresentationService
      const result = yield* presentation.executeSelectedTrade()
      expect(result).toBe(false)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('service initializes without DOM (document undefined) — all elements are Option.none', () => {
    const { TestLayer } = createTradingTestLayer()

    Reflect.deleteProperty(globalThis as object, 'document')

    return Effect.gen(function* () {
      const presentation = yield* TradingPresentationService
      const opened = yield* presentation.open(VillagerId.make('villager-1'))
      expect(opened).toBe(true)
      yield* presentation.close()
      expect(yield* presentation.isOpen()).toBe(false)
    }).pipe(
      Effect.provide(TestLayer),
      Effect.ensuring(Effect.sync(() => {
        Reflect.set(globalThis as object, 'document', { body: {}, head: {} })
      })),
    )
  })
})
