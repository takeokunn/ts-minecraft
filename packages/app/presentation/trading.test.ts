import { beforeEach, describe, it } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { expect, vi } from 'vitest'
import { DomOperationsService } from '@ts-minecraft/app/presentation/hud/crosshair'
import { TradingPresentationService, TradingPresentationLive } from '@ts-minecraft/app/presentation/trading'
import { TradingService, TradeFailure, TradeOfferId, TradeSuccess, type TradeOffer } from '@ts-minecraft/entities'
import { VillageService } from '@ts-minecraft/entities'
import { VillageId, VillageStructureId, VillagerActivity, VillagerId, VillagerProfession, type Villager } from '@ts-minecraft/entities'

type MockElement = {
  id: string
  textContent: string
  innerHTML: string
  style: { cssText: string; display?: string }
  children: MockElement[]
  parentNode: MockElement | 'body' | null
  appendChild(child: MockElement): MockElement
  remove(): void
}

const makeVillager = (): Villager => ({
  villagerId: VillagerId.make('villager-1'),
  villageId: VillageId.make('village-1'),
  profession: VillagerProfession.Farmer,
  homeStructureId: VillageStructureId.make('house-1'),
  workplaceStructureId: VillageStructureId.make('farm-1'),
  level: 1,
  experience: 0,
  position: { x: 0, y: 64, z: 0 },
  activity: VillagerActivity.Idle,
})

const makeOffer = (overrides?: Partial<TradeOffer>): TradeOffer => ({
  offerId: TradeOfferId.make('farmer:grass-bundle'),
  profession: VillagerProfession.Farmer,
  levelRequired: 1,
  input: { blockType: 'EMERALD_ORE', count: 1 },
  output: { blockType: 'GRASS', count: 4 },
  experienceReward: 1,
  ...overrides,
})

const createMockDomLayer = () => {
  const appendChild = vi.fn()
  const appendChildTo = vi.fn((parent: MockElement, child: MockElement) => {
    parent.appendChild(child)
  })
  const removeChild = vi.fn((element: MockElement) => {
    element.parentNode = null
  })
  const setInnerHTML = vi.fn((element: MockElement, html: string) => {
    element.innerHTML = html
  })
  const createdElements: MockElement[] = []

  const createElement = vi.fn((_tag: string) => {
    const element = {
      id: '',
      textContent: '',
      innerHTML: '',
      style: { cssText: '', display: '' },
      children: [],
      parentNode: null,
      appendChild(child: MockElement) {
        child.parentNode = element
        element.children.push(child)
        return child
      },
      remove() {
        element.parentNode = null
      },
    } as unknown as MockElement
    let html = ''
    Object.defineProperty(element, 'innerHTML', {
      get: () => html,
      set: (value: string) => {
        html = value
        element.children = []
      },
      configurable: true,
      enumerable: true,
    })
    createdElements.push(element)
    return element
  })

  const MockDomLayer = Layer.succeed(DomOperationsService, {
    createElement,
    appendChild: (element: MockElement) => {
      appendChild(element)
      element.parentNode = 'body'
    },
    appendChildTo,
    removeChild,
    getParentNode: (element: MockElement) => Option.fromNullable(element.parentNode === 'body' ? null : element.parentNode),
    setInnerHTML,
    querySelector: () => Option.none(),
  } as unknown as DomOperationsService)

  return { MockDomLayer, createElement, appendChild, appendChildTo, removeChild, setInnerHTML, createdElements }
}

const installBrowserDocument = (): void => {
  Reflect.set(globalThis as object, 'document', { body: {}, head: {} })
}

const createTradingTestLayer = () => {
  let villagerState: Option.Option<Villager> = Option.some(makeVillager())
  let offersState: ReadonlyArray<TradeOffer> = [
    makeOffer(),
    makeOffer({ offerId: TradeOfferId.make('farmer:sand-bundle'), output: { blockType: 'SAND', count: 2 } }),
  ]
  let tradeResultState: TradeSuccess | TradeFailure = new TradeSuccess({ offer: makeOffer(), villager: makeVillager(), levelUp: false })

  const tradingSpies = {
    getCurrencyBlockType: vi.fn(() => Effect.succeed('EMERALD_ORE' as const)),
    getOffersForVillager: vi.fn((_villager: Villager) => Effect.succeed(offersState)),
    executeTrade: vi.fn((_villagerId: VillagerId, _offerId: TradeOfferId) => Effect.succeed(tradeResultState)),
  }

  const villageSpies = {
    getVillager: vi.fn((_villagerId: VillagerId) => Effect.succeed(villagerState)),
  }

  const { MockDomLayer, createdElements, appendChild, removeChild } = createMockDomLayer()

  const TradingLayer = Layer.succeed(TradingService, tradingSpies as unknown as TradingService)
  const VillageLayer = Layer.succeed(VillageService, villageSpies as unknown as VillageService)
  const TestLayer = TradingPresentationLive.pipe(Layer.provide(MockDomLayer), Layer.provide(TradingLayer), Layer.provide(VillageLayer))

  return {
    TestLayer,
    createdElements,
    appendChild,
    removeChild,
    tradingSpies,
    villageSpies,
    setVillager: (villager: Option.Option<Villager>) => Effect.sync(() => { villagerState = villager }),
    setOffers: (offers: ReadonlyArray<TradeOffer>) => Effect.sync(() => { offersState = offers }),
    setTradeResult: (result: TradeSuccess | TradeFailure) => Effect.sync(() => { tradeResultState = result }),
  }
}

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
      yield* setOffers([makeOffer({ output: { blockType: 'GLASS', count: 1 } })])
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
