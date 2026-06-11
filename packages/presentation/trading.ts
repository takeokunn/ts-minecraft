import { Array as Arr, Effect, Option, Ref } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { TradingService, type TradeOffer } from '@ts-minecraft/entity'
import { VillageService } from '@ts-minecraft/entity'
import type { VillagerId } from '@ts-minecraft/entity'
import { normalizeSelection, tradeResultText } from './trading.config'

type TradingUiState = {
  readonly villagerId: VillagerId
  readonly offers: ReadonlyArray<TradeOffer>
  readonly selectedIndex: number
}

export class TradingPresentationService extends Effect.Service<TradingPresentationService>()(
  '@minecraft/presentation/TradingPresentationService',
  {
    scoped: Effect.all([
      DomOperationsService,
      TradingService,
      VillageService,
      Ref.make(false),
      Ref.make<Option.Option<TradingUiState>>(Option.none()),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.flatMap(([dom, tradingService, villageService, isVisibleRef, uiStateRef]) =>
        Effect.sync(() => {
        if (typeof document === 'undefined') {
          return {
            overlayEl: Option.none<HTMLDivElement>(),
            titleEl: Option.none<HTMLDivElement>(),
            currencyEl: Option.none<HTMLDivElement>(),
            listEl: Option.none<HTMLDivElement>(),
            statusEl: Option.none<HTMLDivElement>(),
          }
        }

        const root = dom.createElement('div')
        root.id = 'trading-overlay'
        root.style.cssText = [
          'position:fixed',
          'top:50%',
          'left:50%',
          'transform:translate(-50%,-50%)',
          'background:rgba(10,10,10,0.92)',
          'color:#fff',
          'padding:16px',
          'border-radius:8px',
          'min-width:360px',
          'max-width:480px',
          'font-family:monospace',
          'z-index:1002',
          'display:none',
          'border:1px solid #4d4d4d',
        ].join(';')

        const title = dom.createElement('div')
        title.style.cssText = 'font-size:16px;font-weight:bold;margin-bottom:8px'
        title.textContent = 'Trading'

        const currency = dom.createElement('div')
        currency.style.cssText = 'font-size:12px;color:#ddd;margin-bottom:8px'

        const list = dom.createElement('div')
        list.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:8px;max-height:180px;overflow:auto'

        const status = dom.createElement('div')
        status.style.cssText = 'font-size:12px;color:#b0b0b0'
        status.textContent = 'T: open/close, ↑↓: select, Enter: trade, Esc: close'

        dom.appendChildTo(root, title)
        dom.appendChildTo(root, currency)
        dom.appendChildTo(root, list)
        dom.appendChildTo(root, status)
        dom.appendChild(root)

        return {
          overlayEl: Option.some(root),
          titleEl: Option.some(title),
          currencyEl: Option.some(currency),
          listEl: Option.some(list),
          statusEl: Option.some(status),
        }
        }).pipe(
          Effect.flatMap(({ overlayEl, titleEl, currencyEl, listEl, statusEl }) => {
        const renderUi = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const [uiStateOption, currencyType] = yield* Effect.all(
            [Ref.get(uiStateRef), tradingService.getCurrencyBlockType()],
            { concurrency: 'unbounded' },
          )

          yield* Effect.sync(() => {
            const uiState = Option.getOrNull(uiStateOption)
            const currencyNode = Option.getOrNull(currencyEl)
            if (currencyNode !== null) currencyNode.textContent = `Currency: ${currencyType}`

            const titleNode = Option.getOrNull(titleEl)
            if (titleNode !== null) {
              titleNode.textContent = uiState === null
                ? 'Trading'
                : `Trading with ${uiState.villagerId}`
            }

            const container = Option.getOrNull(listEl)
            if (container !== null) {
              container.innerHTML = ''
              if (uiState === null) {
                const empty = dom.createElement('div')
                empty.textContent = 'No villager selected.'
                empty.style.cssText = 'color:#aaa;font-size:12px'
                dom.appendChildTo(container, empty)
              } else {
                const state = uiState
                if (Arr.isEmptyReadonlyArray(state.offers)) {
                  const none = dom.createElement('div')
                  none.textContent = 'No available offers for current villager level.'
                  none.style.cssText = 'color:#aaa;font-size:12px'
                  dom.appendChildTo(container, none)
                } else {
                  Arr.forEach(state.offers, (offer, index) => {
                    const row = dom.createElement('div')
                    const selected = index === state.selectedIndex
                    row.style.cssText = [
                      'padding:6px 8px',
                      'border-radius:4px',
                      selected ? 'background:#2f4f2f' : 'background:#1f1f1f',
                      selected ? 'border:1px solid #8fbc8f' : 'border:1px solid #3d3d3d',
                    ].join(';')
                    row.textContent = `${offer.input.count} ${offer.input.itemType} → ${offer.output.count} ${offer.output.itemType} (Lv${offer.levelRequired})`
                    dom.appendChildTo(container, row)
                  })
                }
              }
            }
          })
        })

      const refreshForVillager = (villagerId: VillagerId): Effect.Effect<boolean, never> =>
        Effect.gen(function* () {
          const villager = Option.getOrNull(yield* villageService.getVillager(villagerId))
          if (villager === null) {
            yield* Ref.set(uiStateRef, Option.none())
            yield* renderUi()
            return false
          }
          const [offers, current] = yield* Effect.all(
            [tradingService.getOffersForVillager(villager), Ref.get(uiStateRef)],
            { concurrency: 'unbounded' },
          )
          const currentVal = Option.getOrNull(current)
          const selectedIndex = currentVal === null ? 0 : normalizeSelection(offers.length, currentVal.selectedIndex)
          yield* Ref.set(uiStateRef, Option.some({ villagerId, offers, selectedIndex }))
          yield* renderUi()
          return true
        })

        return Effect.acquireRelease(
          Effect.void,
          () =>
            Effect.sync(() => {
              Option.getOrNull(overlayEl)?.remove()
            }),
        ).pipe(Effect.as({
        open: (villagerId: VillagerId): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const refreshed = yield* refreshForVillager(villagerId)
            if (!refreshed) {
              return false
            }

            yield* Ref.set(isVisibleRef, true)
            yield* Effect.sync(() => {
              const el = Option.getOrNull(overlayEl)
              if (el !== null) el.style.display = 'block'
            })
            return true
          }),

        close: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            yield* Ref.set(isVisibleRef, false)
            yield* Effect.sync(() => {
              const el = Option.getOrNull(overlayEl)
              if (el !== null) el.style.display = 'none'
            })
          }),

        isOpen: (): Effect.Effect<boolean, never> => Ref.get(isVisibleRef),

        cycleSelection: (delta: number): Effect.Effect<void, never> =>
          Ref.update(uiStateRef, (uiStateOption) => {
            const state = Option.getOrNull(uiStateOption)
            if (state === null) return uiStateOption
            return Option.some({ ...state, selectedIndex: normalizeSelection(state.offers.length, state.selectedIndex + delta) })
          }).pipe(Effect.zipRight(renderUi())),

        refresh: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const uiState = Option.getOrNull(yield* Ref.get(uiStateRef))
            if (uiState === null) {
              yield* renderUi()
            } else {
              yield* refreshForVillager(uiState.villagerId)
            }
          }),

        executeSelectedTrade: (): Effect.Effect<boolean, never> =>
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
              const el = Option.getOrNull(statusEl)
              if (el !== null) el.textContent = tradeResultText(result)
            })
            if (result._tag === 'TradeFailure') return false
            yield* refreshForVillager(state.villagerId)
            return true
          }),
        }))
      })
        )
      )
    ),
  }
) {}

export const TradingPresentationLive = TradingPresentationService.Default
