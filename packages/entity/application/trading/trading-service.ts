import { Array as Arr, Effect, Option } from 'effect'
import { InventoryServicePort } from '../../domain/ports'
import type { InventoryItem } from '@ts-minecraft/core'
import { VillageService } from '../village'
import type { Villager, VillagerId } from '../../domain/village'
import {
  TradeOfferId,
  TradeSuccess,
  TradeFailure,
  type TradeFailureReason,
  type TradeOffer,
  type TradeResult,
} from '../../domain/trading'
import { TRADE_CURRENCY_BLOCK, TRADE_OFFERS } from './trading-service.config'

export { TRADE_CURRENCY_BLOCK } from './trading-service.config'

const offersForVillager = (villager: Villager): ReadonlyArray<TradeOffer> =>
  Arr.filter(
    TRADE_OFFERS,
    (offer) => offer.profession === villager.profession && offer.levelRequired <= villager.level,
  )

const findOfferForVillager = (villager: Villager, offerId: TradeOfferId): Option.Option<TradeOffer> =>
  Arr.findFirst(
    TRADE_OFFERS,
    (offer) =>
      offer.offerId === offerId &&
      offer.profession === villager.profession &&
      offer.levelRequired <= villager.level,
  )

const countBlockInInventory = (
  slots: ReadonlyArray<Option.Option<{ readonly itemType: InventoryItem; readonly count: number }>>,
  itemType: InventoryItem,
): number => {
  let total = 0
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!
    const stack = Option.getOrNull(slot)
    if (stack !== null && stack.itemType === itemType) {
      total += stack.count
    }
  }
  return total
}

export class TradingService extends Effect.Service<TradingService>()(
  '@minecraft/trading/TradingService',
  {
    effect: Effect.gen(function* () {
      const inventoryService = yield* InventoryServicePort
      const villageService = yield* VillageService
      return {
        getCurrencyBlockType: (): Effect.Effect<InventoryItem, never> =>
          Effect.succeed(TRADE_CURRENCY_BLOCK),

        getOffersForVillager: (villager: Villager): Effect.Effect<ReadonlyArray<TradeOffer>, never> =>
          Effect.succeed(offersForVillager(villager)),

        executeTrade: (
          villagerId: VillagerId,
          offerId: TradeOfferId,
        ): Effect.Effect<TradeResult, never> => {
          const require = <A>(opt: Option.Option<A>, reason: TradeFailureReason): Effect.Effect<A, TradeFailureReason> =>
            Option.match(opt, { onNone: () => Effect.fail(reason), onSome: (v) => Effect.succeed(v) })

          return Effect.gen(function* () {
            const villager = yield* require(
              yield* villageService.getVillager(villagerId),
              'villager_not_found',
            )

            const offer = yield* require(findOfferForVillager(villager, offerId), 'offer_not_found')

            const inventorySlots = yield* inventoryService.getAllSlots()
            const availableInput = countBlockInInventory(inventorySlots, offer.input.itemType)
            if (availableInput < offer.input.count) {
              return yield* Effect.fail<TradeFailureReason>('insufficient_input')
            }

            yield* inventoryService.removeBlock(offer.input.itemType, offer.input.count).pipe(
              Effect.catchTag('InventoryError', () => Effect.fail<TradeFailureReason>('insufficient_input'))
            )

            yield* inventoryService.addBlock(offer.output.itemType, offer.output.count).pipe(
              Effect.catchTag('InventoryError', () =>
                Effect.gen(function* () {
                  yield* inventoryService.addBlock(offer.input.itemType, offer.input.count).pipe(Effect.ignore)
                  yield* Effect.fail<TradeFailureReason>('inventory_full')
                })
              )
            )

            const updatedVillager = yield* require(
              yield* villageService.addVillagerExperience(villagerId, offer.experienceReward),
              'villager_not_found',
            )

            return new TradeSuccess({
              offer,
              villager: updatedVillager,
              levelUp: updatedVillager.level > villager.level,
            })
          }).pipe(
            Effect.catchAll((reason) => Effect.succeed<TradeResult>(new TradeFailure({ reason }))),
          )
        },
      }
    }),
  },
) {}
