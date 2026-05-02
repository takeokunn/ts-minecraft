import { Array as Arr, Effect, Option } from 'effect'
import { InventoryService } from '@ts-minecraft/inventory-system'
import type { BlockType } from '@ts-minecraft/domain'
import { VillageService } from '@ts-minecraft/village-system'
import type { Villager, VillagerId } from '@ts-minecraft/village-system'
import { TradeOfferId, TradeSuccess, TradeFailure, type TradeFailureReason, type TradeOffer, type TradeResult } from './trading-model'
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
  slots: ReadonlyArray<Option.Option<{ readonly blockType: BlockType; readonly count: number }>>,
  blockType: BlockType,
): number =>
  Arr.reduce(slots, 0, (total, slot) =>
    total + Option.match(slot, {
      onNone: () => 0,
      onSome: (stack) => stack.blockType === blockType ? stack.count : 0,
    })
  )

export class TradingService extends Effect.Service<TradingService>()(
  '@minecraft/trading/TradingService',
  {
    effect: Effect.all([InventoryService, VillageService], { concurrency: 'unbounded' }).pipe(
      Effect.map(([inventoryService, villageService]) => ({
        getCurrencyBlockType: (): Effect.Effect<BlockType, never> =>
          Effect.succeed(TRADE_CURRENCY_BLOCK),

        getOffersForVillager: (villager: Villager): Effect.Effect<ReadonlyArray<TradeOffer>, never> =>
          Effect.succeed(offersForVillager(villager)),

        executeTrade: (
          villagerId: VillagerId,
          offerId: TradeOfferId,
        ): Effect.Effect<TradeResult, never> => {
          const require = <A>(opt: Option.Option<A>, reason: TradeFailureReason): Effect.Effect<A, TradeFailureReason> =>
            Option.match(opt, {
              onNone: () => Effect.fail(reason),
              onSome: Effect.succeed,
            })

          return Effect.gen(function* () {
            const villager = yield* require(
              yield* villageService.getVillager(villagerId),
              'villager_not_found',
            )

            const offer = yield* require(findOfferForVillager(villager, offerId), 'offer_not_found')

            if (villager.level < offer.levelRequired) {
              return yield* Effect.fail<TradeFailureReason>('villager_level_too_low')
            }

            const inventorySlots = yield* inventoryService.getAllSlots()
            const availableInput = countBlockInInventory(inventorySlots, offer.input.blockType)
            if (availableInput < offer.input.count) {
              return yield* Effect.fail<TradeFailureReason>('insufficient_input')
            }

            const inputRemoved = yield* inventoryService.removeBlock(offer.input.blockType, offer.input.count)
            if (!inputRemoved) {
              return yield* Effect.fail<TradeFailureReason>('insufficient_input')
            }

            const outputAdded = yield* inventoryService.addBlock(offer.output.blockType, offer.output.count)
            if (!outputAdded) {
              yield* inventoryService.addBlock(offer.input.blockType, offer.input.count)
              return yield* Effect.fail<TradeFailureReason>('inventory_full')
            }

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
      }))
    ),
  },
) {}

export const TradingServiceLive = TradingService.Default
