import { Array as Arr, Effect, Option } from 'effect'
import { InventoryService } from '@/application/inventory/inventory-service'
import type { BlockType } from '@/domain/block'
import { VillageService } from '@/village/village-service'
import { VillagerProfession, type Villager, type VillagerId } from '@/village/village-model'
import { TradeOfferId, TradeSuccess, TradeFailure, type TradeFailureReason, type TradeOffer, type TradeResult } from '@/trading/trading-model'

export const TRADE_CURRENCY_BLOCK: BlockType = 'GRAVEL'

const TRADE_OFFERS: ReadonlyArray<TradeOffer> = [
  {
    offerId: TradeOfferId.make('farmer:grass-bundle'),
    profession: VillagerProfession.Farmer,
    levelRequired: 1,
    input: { blockType: TRADE_CURRENCY_BLOCK, count: 1 },
    output: { blockType: 'GRASS', count: 4 },
    experienceReward: 3,
  },
  {
    offerId: TradeOfferId.make('farmer:sand-bundle'),
    profession: VillagerProfession.Farmer,
    levelRequired: 2,
    input: { blockType: TRADE_CURRENCY_BLOCK, count: 2 },
    output: { blockType: 'SAND', count: 6 },
    experienceReward: 4,
  },
  {
    offerId: TradeOfferId.make('librarian:wood-bundle'),
    profession: VillagerProfession.Librarian,
    levelRequired: 1,
    input: { blockType: TRADE_CURRENCY_BLOCK, count: 1 },
    output: { blockType: 'WOOD', count: 3 },
    experienceReward: 3,
  },
  {
    offerId: TradeOfferId.make('librarian:glass-bundle'),
    profession: VillagerProfession.Librarian,
    levelRequired: 2,
    input: { blockType: TRADE_CURRENCY_BLOCK, count: 2 },
    output: { blockType: 'GLASS', count: 3 },
    experienceReward: 4,
  },
  {
    offerId: TradeOfferId.make('blacksmith:stone-bundle'),
    profession: VillagerProfession.Blacksmith,
    levelRequired: 1,
    input: { blockType: TRADE_CURRENCY_BLOCK, count: 1 },
    output: { blockType: 'STONE', count: 4 },
    experienceReward: 3,
  },
  {
    offerId: TradeOfferId.make('blacksmith:cobblestone-bundle'),
    profession: VillagerProfession.Blacksmith,
    levelRequired: 2,
    input: { blockType: TRADE_CURRENCY_BLOCK, count: 2 },
    output: { blockType: 'COBBLESTONE', count: 5 },
    experienceReward: 4,
  },
]

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
