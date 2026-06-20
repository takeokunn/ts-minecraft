import { Effect, Layer, MutableRef, Option } from 'effect'
import { vi } from 'vitest'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { TradingPresentationService } from '@ts-minecraft/presentation/trading'
import { TradingService } from '@ts-minecraft/entity/application/trading/trading-service'
import { VillageService } from '@ts-minecraft/entity/application/village/village-service'
import { TradeFailure, TradeOfferId, TradeSuccess, type TradeOffer } from '@ts-minecraft/entity/domain/trading/trading-model'
import { VillageId, VillageStructureId, VillagerActivity, VillagerId, VillagerProfession, type Villager } from '@ts-minecraft/entity/domain/village/village-model'

export type MockElement = Pick<HTMLElement, 'id' | 'textContent'> & {
  id: string
  textContent: string
  innerHTML: string
  style: Pick<CSSStyleDeclaration, 'cssText' | 'display'>
  children: MockElement[]
  parentNode: MockElement | 'body' | null
  appendChild(child: MockElement): MockElement
  remove(): void
}

const toHTMLElement = <T extends HTMLElement>(element: MockElement): T => element as unknown as T

const fromHTMLElement = (element: HTMLElement): MockElement => element as unknown as MockElement

export const makeVillager = (): Villager => ({
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

export const makeOffer = (overrides?: Partial<TradeOffer>): TradeOffer => ({
  offerId: TradeOfferId.make('farmer:grass-bundle'),
  profession: VillagerProfession.Farmer,
  levelRequired: 1,
  input: { itemType: 'EMERALD_ORE', count: 1 },
  output: { itemType: 'GRASS', count: 4 },
  experienceReward: 1,
  ...overrides,
})

export const createMockDomLayer = () => {
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

  const createElement = vi.fn((<K extends keyof HTMLElementTagNameMap>(_tag: K): HTMLElementTagNameMap[K] => {
    const element: MockElement = {
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
    }
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
    return toHTMLElement<HTMLElementTagNameMap[K]>(element)
  }) as DomOperationsService['createElement'])

  const domOperations = DomOperationsService.of({
    _tag: '@minecraft/presentation/DomOperations' as const,
    createElement,
    appendChild: ((element: HTMLElement) => {
      const mockElement = fromHTMLElement(element)
      appendChild(mockElement)
      mockElement.parentNode = 'body'
    }) as DomOperationsService['appendChild'],
    appendChildTo: ((parent: HTMLElement, child: HTMLElement) => {
      appendChildTo(fromHTMLElement(parent), fromHTMLElement(child))
    }) as DomOperationsService['appendChildTo'],
    removeChild: ((element: HTMLElement) => {
      removeChild(fromHTMLElement(element))
    }) as DomOperationsService['removeChild'],
    getParentNode: ((element: HTMLElement) => {
      const parent = fromHTMLElement(element).parentNode
      return parent === 'body' || parent === null ? Option.none() : Option.some(toHTMLElement(parent))
    }) as DomOperationsService['getParentNode'],
    setInnerHTML: ((element: HTMLElement, html: string) => {
      setInnerHTML(fromHTMLElement(element), html)
    }) as DomOperationsService['setInnerHTML'],
    querySelector: (() => Option.none()) as DomOperationsService['querySelector'],
  })

  const MockDomLayer = Layer.succeed(DomOperationsService, domOperations)

  return { MockDomLayer, domOperations, createElement, appendChild, appendChildTo, removeChild, setInnerHTML, createdElements }
}

export const installBrowserDocument = (): void => {
  Reflect.set(globalThis as object, 'document', { body: {}, head: {} })
}

export const createTradingTestLayer = () => {
  const villagerStateRef = MutableRef.make<Option.Option<Villager>>(Option.some(makeVillager()))
  const offersStateRef = MutableRef.make<ReadonlyArray<TradeOffer>>([
    makeOffer(),
    makeOffer({ offerId: TradeOfferId.make('farmer:sand-bundle'), output: { itemType: 'SAND', count: 2 } }),
  ])
  const tradeResultStateRef = MutableRef.make<TradeSuccess | TradeFailure>(new TradeSuccess({ offer: makeOffer(), villager: makeVillager(), levelUp: false }))

  const tradingSpies = TradingService.of({
    _tag: '@minecraft/trading/TradingService' as const,
    getCurrencyBlockType: vi.fn(() => Effect.succeed('EMERALD_ORE' as const)),
    getOffersForVillager: vi.fn((_villager: Villager) => Effect.sync(() => MutableRef.get(offersStateRef))),
    executeTrade: vi.fn((_villagerId: VillagerId, _offerId: TradeOfferId) => Effect.sync(() => MutableRef.get(tradeResultStateRef))),
  })

  const villageSpies = VillageService.of({
    _tag: '@minecraft/village/VillageService' as const,
    ensureVillageNear: (_playerPosition) => Effect.succeed({
      villageId: VillageId.make('village-1'),
      center: { x: 0, y: 64, z: 0 },
      structures: [],
      villagers: [makeVillager()],
    }),
    getVillages: () => Effect.succeed([]),
    getVillagers: () => Effect.succeed([]),
    getVillager: vi.fn((_villagerId: VillagerId) => Effect.sync(() => MutableRef.get(villagerStateRef))),
    findNearestVillager: () => Effect.succeed(Option.none()),
    addVillagerExperience: () => Effect.succeed(Option.none()),
    update: () => Effect.void,
  })

  const { MockDomLayer, createdElements, appendChild, removeChild } = createMockDomLayer()

  const TradingLayer = Layer.succeed(TradingService, tradingSpies)
  const VillageLayer = Layer.succeed(VillageService, villageSpies)
  const TestLayer = TradingPresentationService.Default.pipe(Layer.provide(MockDomLayer), Layer.provide(TradingLayer), Layer.provide(VillageLayer))

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
