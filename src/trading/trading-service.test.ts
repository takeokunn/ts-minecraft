import { describe, expect, it } from 'vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import { InventoryService, InventoryServiceLive } from '@/application/inventory/inventory-service'
import { BlockRegistryLive } from '@/domain'
import { TradingService, TradingServiceLive, TRADE_CURRENCY_BLOCK } from '@/trading/trading-service'
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
  it('returns profession/level-appropriate offers for villagers', async () => {
    const program = Effect.gen(function* () {
      const villageService = yield* VillageService
      const tradingService = yield* TradingService

      yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })
      const villagers = yield* villageService.getVillagers()
      const farmerOpt = Arr.findFirst(villagers, (v) => v.profession === 'Farmer')
      if (Option.isNone(farmerOpt)) {
        return [] as ReadonlyArray<string>
      }
      const offers = yield* tradingService.getOffersForVillager(Option.getOrThrow(farmerOpt))
      return Arr.map(offers, (offer) => offer.offerId)
    }).pipe(Effect.provide(TradingTestLayer))

    const offerIds = await Effect.runPromise(program)

    expect(offerIds.length).toBeGreaterThan(0)
    expect(offerIds.every((offerId) => offerId.startsWith('farmer:'))).toBe(true)
  })

  it('executes trades, grants villager experience, and levels up deterministically', async () => {
    const program = Effect.gen(function* () {
      const villageService = yield* VillageService
      const tradingService = yield* TradingService
      const inventoryService = yield* InventoryService

      yield* villageService.ensureVillageNear({ x: 0, y: 64, z: 0 })
      const villagers = yield* villageService.getVillagers()
      const farmerOpt = Arr.findFirst(villagers, (v) => v.profession === 'Farmer')
      if (Option.isNone(farmerOpt)) {
        return { firstSuccess: false, secondSuccess: false, levelAfterSecondTrade: 1, canRemoveOutput: false }
      }
      const farmer = Option.getOrThrow(farmerOpt)
      const offers = yield* tradingService.getOffersForVillager(farmer)
      const offerOpt = Arr.get(offers, 0)
      if (Option.isNone(offerOpt)) {
        return { firstSuccess: false, secondSuccess: false, levelAfterSecondTrade: 1, canRemoveOutput: false }
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

      return {
        firstSuccess: firstTrade._tag === 'TradeSuccess',
        secondSuccess: secondTrade._tag === 'TradeSuccess',
        levelAfterSecondTrade: Option.match(villagerAfter, {
          onNone: () => 1,
          onSome: (villager) => villager.level,
        }),
        canRemoveOutput,
      }
    }).pipe(Effect.provide(TradingTestLayer))

    const result = await Effect.runPromise(program)

    expect(result.firstSuccess).toBe(true)
    expect(result.secondSuccess).toBe(true)
    expect(result.levelAfterSecondTrade).toBeGreaterThanOrEqual(2)
    expect(result.canRemoveOutput).toBe(true)
  })
})
