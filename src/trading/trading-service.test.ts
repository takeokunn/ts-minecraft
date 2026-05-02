import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer, Match, Option } from 'effect'
import { InventoryService, InventoryServiceLive } from '@ts-minecraft/inventory-system'
import { BlockRegistryLive } from '@ts-minecraft/domain'
import { TradingService, TradingServiceLive, TRADE_CURRENCY_BLOCK, TradeFailure, TradeSuccess } from '@ts-minecraft/trading-system'
import { VillageService, VillageServiceLive } from '@ts-minecraft/village-system'

const InventoryLayer = InventoryServiceLive.pipe(
  Layer.provide(BlockRegistryLive),
)

const TradingTestLayer = Layer.mergeAll(
  VillageServiceLive,
  InventoryLayer,
  TradingServiceLive.pipe(
    Layer.provide(VillageServiceLive),
    Layer.provide(InventoryLayer),
  ),
)

describe('trading/trading-service', () => {
  it.effect('returns profession/level-appropriate offers for villagers', () =>
    Effect.gen(function* () {
      const villageService = yield* VillageService
      const tradingService = yield* TradingService

      yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })
      const villagers = yield* villageService.getVillagers()
      const farmerOpt = Arr.findFirst(villagers, (v) => v.profession === 'Farmer')
      if (Option.isNone(farmerOpt)) {
        expect.fail('No Farmer villager found')
        return
      }
      const offers = yield* tradingService.getOffersForVillager(Option.getOrThrow(farmerOpt))
      const offerIds = Arr.map(offers, (offer) => offer.offerId)

      expect(offerIds.length).toBeGreaterThan(0)
      expect(Arr.every(offerIds, (offerId) => offerId.startsWith('farmer:'))).toBe(true)
    }).pipe(Effect.provide(TradingTestLayer))
  )

  it.effect('executes trades, grants villager experience, and levels up deterministically', () =>
    Effect.gen(function* () {
      const villageService = yield* VillageService
      const tradingService = yield* TradingService
      const inventoryService = yield* InventoryService

      yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })
      const villagers = yield* villageService.getVillagers()
      const farmerOpt = Arr.findFirst(villagers, (v) => v.profession === 'Farmer')
      if (Option.isNone(farmerOpt)) {
        expect.fail('No Farmer villager found')
        return
      }
      const farmer = Option.getOrThrow(farmerOpt)
      const offers = yield* tradingService.getOffersForVillager(farmer)
      const offerOpt = Arr.get(offers, 0)
      if (Option.isNone(offerOpt)) {
        expect.fail('No trade offer found')
        return
      }
      const offer = Option.getOrThrow(offerOpt)

      yield* inventoryService.addBlock(TRADE_CURRENCY_BLOCK, 2)

      const firstTrade = yield* tradingService.executeTrade(farmer.villagerId, offer.offerId)
      const secondTrade = yield* tradingService.executeTrade(farmer.villagerId, offer.offerId)
      const villagerAfter = yield* villageService.getVillager(farmer.villagerId)

      const canRemoveOutput = yield* inventoryService.removeBlock(
        offer.output.blockType,
        offer.output.count,
      )

      expect(firstTrade instanceof TradeSuccess).toBe(true)
      expect(secondTrade instanceof TradeSuccess).toBe(true)
      expect(Option.match(villagerAfter, {
        onNone: () => 1,
        onSome: (villager) => villager.level,
      })).toBeGreaterThanOrEqual(2)
      expect(canRemoveOutput).toBe(true)
    }).pipe(Effect.provide(TradingTestLayer))
  )

  it.effect('does not consume partial trade input when inventory is insufficient', () =>
    Effect.gen(function* () {
      const villageService = yield* VillageService
      const tradingService = yield* TradingService
      const inventoryService = yield* InventoryService

      yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })
      const villagers = yield* villageService.getVillagers()
      const farmerOpt = Arr.findFirst(villagers, (v) => v.profession === 'Farmer')
      if (Option.isNone(farmerOpt)) {
        expect.fail('No Farmer villager found')
        return
      }
      const farmer = Option.getOrThrow(farmerOpt)
      const updatedFarmerOpt = yield* villageService.addVillagerExperience(farmer.villagerId, 6)
      if (Option.isNone(updatedFarmerOpt)) {
        expect.fail('Farmer villager could not be leveled up for the regression test')
        return
      }
      const updatedFarmer = Option.getOrThrow(updatedFarmerOpt)

      const offers = yield* tradingService.getOffersForVillager(updatedFarmer)
      const expensiveOfferOpt = Arr.findFirst(offers, (offer) => offer.input.count > 1)
      if (Option.isNone(expensiveOfferOpt)) {
        expect.fail('No expensive trade offer found')
        return
      }
      const expensiveOffer = Option.getOrThrow(expensiveOfferOpt)

      yield* inventoryService.addBlock(TRADE_CURRENCY_BLOCK, expensiveOffer.input.count - 1)

      const tradeResult = yield* tradingService.executeTrade(updatedFarmer.villagerId, expensiveOffer.offerId)
      const remainingCurrency = yield* inventoryService.removeBlock(TRADE_CURRENCY_BLOCK, expensiveOffer.input.count - 1)
      const outputRemoved = yield* inventoryService.removeBlock(expensiveOffer.output.blockType, expensiveOffer.output.count)

      expect(tradeResult instanceof TradeFailure).toBe(true)
      expect(Match.value(tradeResult).pipe(
        Match.tag('TradeFailure', (r) => r.reason),
        Match.tag('TradeSuccess', () => '' as const),
        Match.exhaustive,
      )).toBe('insufficient_input')
      expect(remainingCurrency).toBe(true)
      expect(outputRemoved).toBe(false)
    }).pipe(Effect.provide(TradingTestLayer))
  )
})
