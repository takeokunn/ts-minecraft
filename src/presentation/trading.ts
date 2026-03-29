import { Array as Arr, Effect, Match, Option, Ref } from 'effect'
import { DomOperationsService } from '@/presentation/hud/crosshair'
import { TradingService } from '@/trading/trading-service'
import { VillageService } from '@/village/village-service'
import type { TradeOffer, TradeResult } from '@/trading/trading-model'
import type { VillagerId } from '@/village/village-model'

type TradingUiState = {
  readonly villagerId: VillagerId
  readonly offers: ReadonlyArray<TradeOffer>
  readonly selectedIndex: number
}

const normalizeSelection = (length: number, index: number): number => {
  if (length <= 0) {
    return 0
  }

  const wrapped = index % length
  return wrapped < 0 ? wrapped + length : wrapped
}

const tradeResultText = (result: TradeResult): string =>
  Match.value(result).pipe(
    Match.tag('TradeSuccess', (r) =>
      r.levelUp
        ? `Trade complete. ${r.villager.profession} reached level ${r.villager.level}.`
        : 'Trade complete.',
    ),
    Match.tag('TradeFailure', (r) => `Trade failed: ${r.reason.replaceAll('_', ' ')}`),
    Match.exhaustive,
  )

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

        const root = dom.createElement('div') as HTMLDivElement
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

        const title = dom.createElement('div') as HTMLDivElement
        title.style.cssText = 'font-size:16px;font-weight:bold;margin-bottom:8px'
        title.textContent = 'Trading'

        const currency = dom.createElement('div') as HTMLDivElement
        currency.style.cssText = 'font-size:12px;color:#ddd;margin-bottom:8px'

        const list = dom.createElement('div') as HTMLDivElement
        list.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:8px;max-height:180px;overflow:auto'

        const status = dom.createElement('div') as HTMLDivElement
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
            Option.map(currencyEl, (el) => {
              el.textContent = `Currency: ${currencyType}`
            })

            Option.map(titleEl, (el) => {
              Option.match(uiStateOption, {
                onNone: () => {
                  el.textContent = 'Trading'
                },
                onSome: (state) => {
                  el.textContent = `Trading with ${state.villagerId}`
                },
              })
            })

            Option.map(listEl, (container) => {
              container.innerHTML = ''
              Option.match(uiStateOption, {
                onNone: () => {
                  const empty = dom.createElement('div')
                  empty.textContent = 'No villager selected.'
                  empty.style.cssText = 'color:#aaa;font-size:12px'
                  dom.appendChildTo(container, empty)
                },
                onSome: (state) => {
                  if (Arr.isEmptyReadonlyArray(state.offers)) {
                    const none = dom.createElement('div')
                    none.textContent = 'No available offers for current villager level.'
                    none.style.cssText = 'color:#aaa;font-size:12px'
                    dom.appendChildTo(container, none)
                    return
                  }

                  Arr.forEach(state.offers, (offer, index) => {
                    const row = dom.createElement('div')
                    const selected = index === state.selectedIndex
                    row.style.cssText = [
                      'padding:6px 8px',
                      'border-radius:4px',
                      selected ? 'background:#2f4f2f' : 'background:#1f1f1f',
                      selected ? 'border:1px solid #8fbc8f' : 'border:1px solid #3d3d3d',
                    ].join(';')

                    row.textContent = `${offer.input.count} ${offer.input.blockType} → ${offer.output.count} ${offer.output.blockType} (Lv${offer.levelRequired})`
                    dom.appendChildTo(container, row)
                  })
                },
              })
            })
          })
        })

      const refreshForVillager = (villagerId: VillagerId): Effect.Effect<boolean, never> =>
        Effect.gen(function* () {
          const villagerOption = yield* villageService.getVillager(villagerId)
          return yield* Option.match(villagerOption, {
            onNone: () =>
              Effect.gen(function* () {
                yield* Ref.set(uiStateRef, Option.none())
                yield* renderUi()
                return false
              }),
            onSome: (villager) =>
              Effect.gen(function* () {
                const [offers, current] = yield* Effect.all(
                  [tradingService.getOffersForVillager(villager), Ref.get(uiStateRef)],
                  { concurrency: 'unbounded' },
                )
                const selectedIndex = Option.match(current, {
                  onNone: () => 0,
                  onSome: (state) => normalizeSelection(offers.length, state.selectedIndex),
                })
                yield* Ref.set(uiStateRef, Option.some({ villagerId, offers, selectedIndex }))
                yield* renderUi()
                return true
              }),
          })
        })

        return Effect.acquireRelease(
          Effect.void,
          () =>
            Effect.sync(() => {
              Option.map(overlayEl, (el) => {
                el.remove()
              })
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
              Option.map(overlayEl, (el) => {
                el.style.display = 'block'
              })
            })
            return true
          }),

        close: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            yield* Ref.set(isVisibleRef, false)
            yield* Effect.sync(() => {
              Option.map(overlayEl, (el) => {
                el.style.display = 'none'
              })
            })
          }),

        isOpen: (): Effect.Effect<boolean, never> => Ref.get(isVisibleRef),

        cycleSelection: (delta: number): Effect.Effect<void, never> =>
          Ref.update(uiStateRef, (uiStateOption) =>
            Option.match(uiStateOption, {
              onNone: () => uiStateOption,
              onSome: (state) =>
                Option.some({
                  ...state,
                  selectedIndex: normalizeSelection(state.offers.length, state.selectedIndex + delta),
                }),
            }),
          ).pipe(Effect.zipRight(renderUi())),

        refresh: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const uiStateOption = yield* Ref.get(uiStateRef)
            yield* Option.match(uiStateOption, {
              onNone: () => renderUi(),
              onSome: (state) => refreshForVillager(state.villagerId).pipe(Effect.asVoid),
            })
          }),

        executeSelectedTrade: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const uiStateOption = yield* Ref.get(uiStateRef)
            return yield* Option.match(
              Option.flatMap(uiStateOption, (state) =>
                Option.map(Arr.get(state.offers, state.selectedIndex), (offer) => ({ state, offer }))
              ),
              {
                onNone: () => Effect.succeed(false),
                onSome: ({ state, offer }) =>
                  Effect.gen(function* () {
                    const result = yield* tradingService.executeTrade(state.villagerId, offer.offerId)
                    yield* Effect.sync(() => {
                      Option.map(statusEl, (el) => { el.textContent = tradeResultText(result) })
                    })
                    if (result._tag === 'TradeFailure') return false
                    yield* refreshForVillager(state.villagerId)
                    return true
                  }),
              },
            )
          }),
        }))
      })
        )
      )
    ),
  }
) {}

export const TradingPresentationLive = TradingPresentationService.Default
