import { Array as Arr, Effect, Option, Ref } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { TradingService } from '@ts-minecraft/entity'
import { VillageService } from '@ts-minecraft/entity'
import type { VillagerId } from '@ts-minecraft/entity'
import { normalizeSelection, tradeResultText } from './trading.config'
import { EMPTY_TEXT_STYLES, EMPTY_VILLAGER_TEXT, EMPTY_OFFERS_TEXT, rowStyles } from './trading-styles'
import { buildTradingDom } from './trading-dom'
import type { TradingUiState, TradingElements } from './trading-types'

const renderOfferRows = (
  dom: DomOperationsService,
  container: HTMLDivElement,
  state: TradingUiState,
): void => {
  if (Arr.isEmptyReadonlyArray(state.offers)) {
    const none = dom.createElement('div')
    none.textContent = EMPTY_OFFERS_TEXT
    none.style.cssText = EMPTY_TEXT_STYLES
    dom.appendChildTo(container, none)
    return
  }

  Arr.forEach(state.offers, (offer, index) => {
    const row = dom.createElement('div')
    row.style.cssText = rowStyles(index === state.selectedIndex)
    row.textContent = `${offer.input.count} ${offer.input.itemType} → ${offer.output.count} ${offer.output.itemType} (Lv${offer.levelRequired})`
    dom.appendChildTo(container, row)
  })
}

const renderListContainer = (
  dom: DomOperationsService,
  elements: TradingElements,
  state: TradingUiState | null,
): void => {
  const container = Option.getOrNull(elements.list)
  if (container === null) return
  container.innerHTML = ''

  if (state === null) {
    const empty = dom.createElement('div')
    empty.textContent = EMPTY_VILLAGER_TEXT
    empty.style.cssText = EMPTY_TEXT_STYLES
    dom.appendChildTo(container, empty)
    return
  }

  renderOfferRows(dom, container, state)
}

export class TradingPresentationService extends Effect.Service<TradingPresentationService>()(
  '@minecraft/presentation/TradingPresentationService',
  {
    scoped: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      const tradingService = yield* TradingService
      const villageService = yield* VillageService
      const isVisibleRef = yield* Ref.make(false)
      const uiStateRef = yield* Ref.make<Option.Option<TradingUiState>>(Option.none())

      const elements = yield* Effect.sync(() => buildTradingDom(dom))

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => Option.getOrNull(elements.overlay)?.remove())
      )

      const renderUi = (): Effect.Effect<void> =>
        Effect.gen(function* () {
          const uiStateOption = yield* Ref.get(uiStateRef)
          const currencyType = yield* tradingService.getCurrencyBlockType()
          const state = Option.getOrNull(uiStateOption)

          yield* Effect.sync(() => {
            const currencyNode = Option.getOrNull(elements.currency)
            if (currencyNode !== null) currencyNode.textContent = `Currency: ${currencyType}`

            const titleNode = Option.getOrNull(elements.title)
            if (titleNode !== null) {
              titleNode.textContent = state === null ? 'Trading' : `Trading with ${state.villagerId}`
            }

            renderListContainer(dom, elements, state)
          })
        })

      const refreshForVillager = (villagerId: VillagerId): Effect.Effect<boolean> =>
        Effect.gen(function* () {
          const villager = Option.getOrNull(yield* villageService.getVillager(villagerId))
          if (villager === null) {
            yield* Ref.set(uiStateRef, Option.none())
            yield* renderUi()
            return false
          }

          const offers = yield* tradingService.getOffersForVillager(villager)
          const current = yield* Ref.get(uiStateRef)
          const currentVal = Option.getOrNull(current)
          const selectedIndex = currentVal === null
            ? 0
            : normalizeSelection(offers.length, currentVal.selectedIndex)

          yield* Ref.set(uiStateRef, Option.some({ villagerId, offers, selectedIndex }))
          yield* renderUi()
          return true
        })

      return {
        open: (villagerId: VillagerId): Effect.Effect<boolean> =>
          Effect.gen(function* () {
            const refreshed = yield* refreshForVillager(villagerId)
            if (!refreshed) return false

            yield* Ref.set(isVisibleRef, true)
            yield* Effect.sync(() => {
              const el = Option.getOrNull(elements.overlay)
              if (el !== null) el.style.display = 'block'
            })
            return true
          }),

        close: (): Effect.Effect<void> =>
          Effect.gen(function* () {
            yield* Ref.set(isVisibleRef, false)
            yield* Effect.sync(() => {
              const el = Option.getOrNull(elements.overlay)
              if (el !== null) el.style.display = 'none'
            })
          }),

        isOpen: (): Effect.Effect<boolean> => Ref.get(isVisibleRef),

        cycleSelection: (delta: number): Effect.Effect<void> =>
          Effect.gen(function* () {
            yield* Ref.update(uiStateRef, (uiStateOption) => {
              const state = Option.getOrNull(uiStateOption)
              if (state === null) return uiStateOption
              return Option.some({
                ...state,
                selectedIndex: normalizeSelection(state.offers.length, state.selectedIndex + delta),
              })
            })
            yield* renderUi()
          }),

        refresh: (): Effect.Effect<void> =>
          Effect.gen(function* () {
            const uiState = Option.getOrNull(yield* Ref.get(uiStateRef))
            if (uiState === null) {
              yield* renderUi()
            } else {
              yield* refreshForVillager(uiState.villagerId)
            }
          }),

        executeSelectedTrade: (): Effect.Effect<boolean> =>
          Effect.gen(function* () {
            const uiStateOption = yield* Ref.get(uiStateRef)
            const tradeContext = Option.getOrNull(
              Option.flatMap(uiStateOption, (state) =>
                Option.map(Arr.get(state.offers, state.selectedIndex), (offer) => ({ state, offer }))
              )
            )
            if (tradeContext === null) return false

            const { state, offer } = tradeContext
            const result = yield* tradingService.executeTrade(state.villagerId, offer.offerId)
            yield* Effect.sync(() => {
              const el = Option.getOrNull(elements.status)
              if (el !== null) el.textContent = tradeResultText(result)
            })

            if (result._tag === 'TradeFailure') return false
            yield* refreshForVillager(state.villagerId)
            return true
          }),
      }
    }),
  }
) {}

export const TradingPresentationLive = TradingPresentationService.Default
