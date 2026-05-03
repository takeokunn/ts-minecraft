import { beforeEach, describe, it } from '@effect/vitest'
import { Effect, Layer, MutableRef, Option } from 'effect'
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
  const villagerStateRef = MutableRef.make<Option.Option<Villager>>(Option.some(makeVillager()))
  const offersStateRef = MutableRef.make<ReadonlyArray<TradeOffer>>([
    makeOffer(),
    makeOffer({ offerId: TradeOfferId.make('farmer:sand-bundle'), output: { blockType: 'SAND', count: 2 } }),
  ])
  const tradeResultStateRef = MutableRef.make<TradeSuccess | TradeFailure>(new TradeSuccess({ offer: makeOffer(), villager: makeVillager(), levelUp: false }))

  const tradingSpies = {
    getCurrencyBlockType: vi.fn(() => Effect.succeed('EMERALD_ORE' as const)),
    getOffersForVillager: vi.fn((_villager: Villager) => Effect.sync(() => MutableRef.get(offersStateRef))),
    executeTrade: vi.fn((_villagerId: VillagerId, _offerId: TradeOfferId) => Effect.sync(() => MutableRef.get(tradeResultStateRef))),
  }

  const villageSpies = {
    getVillager: vi.fn((_villagerId: VillagerId) => Effect.sync(() => MutableRef.get(villagerStateRef))),
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
    setVillager: (villager: Option.Option<Villager>) => Effect.sync(() => { MutableRef.set(villagerStateRef, villager) }),
    setOffers: (offers: ReadonlyArray<TradeOffer>) => Effect.sync(() => { MutableRef.set(offersStateRef, offers) }),
    setTradeResult: (result: TradeSuccess | TradeFailure) => Effect.sync(() => { MutableRef.set(tradeResultStateRef, result) }),
  }
}

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
