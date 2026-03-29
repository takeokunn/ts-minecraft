import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import { InventoryService, InventoryServiceLive } from '@/application/inventory/inventory-service'
import { BlockRegistryLive } from '@/domain'
import { TradingService, TradingServiceLive, TRADE_CURRENCY_BLOCK } from '@/trading/trading-service'
import { TradeSuccess } from '@/trading/trading-model'
import { VillageService, VillageServiceLive } from '@/village/village-service'

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
      expect(offerIds.every((offerId) => offerId.startsWith('farmer:'))).toBe(true)
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
})
