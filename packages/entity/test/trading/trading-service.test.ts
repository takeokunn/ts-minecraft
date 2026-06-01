import { describe, it } from '@effect/vitest'
import { it as plainIt, expect } from 'vitest'
import { Array as Arr, Effect, Either, Layer, Match, Option } from 'effect'
import { InventoryService, InventoryServiceLive, InventoryError } from '@ts-minecraft/inventory'
import { BlockRegistryLive } from '@ts-minecraft/block'
import { TradingService, TradingServiceLive, TRADE_CURRENCY_BLOCK, TradeFailure, TradeSuccess, TradeOfferId, VillagerProfession } from '@ts-minecraft/entity'
import { VillageService, VillageServiceLive } from '@ts-minecraft/entity'
import type { InventoryItem } from '@ts-minecraft/core'
import { makeTestTradeOffer } from './test-utils'

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
  it.effect('getCurrencyBlockType returns the configured currency block', () =>
    Effect.gen(function* () {
      const tradingService = yield* TradingService
      const blockType = yield* tradingService.getCurrencyBlockType()
      expect(blockType).toBe(TRADE_CURRENCY_BLOCK)
    }).pipe(Effect.provide(TradingTestLayer))
  )

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

      const canRemoveOutput = yield* Effect.either(inventoryService.removeBlock(
        offer.output.itemType,
        offer.output.count,
      ))

      expect(firstTrade instanceof TradeSuccess).toBe(true)
      expect(secondTrade instanceof TradeSuccess).toBe(true)
      expect(Option.match(villagerAfter, {
        onNone: () => 1,
        onSome: (villager) => villager.level,
      })).toBeGreaterThanOrEqual(2)
      expect(Either.isRight(canRemoveOutput)).toBe(true)
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
      const remainingCurrencyResult = yield* Effect.either(inventoryService.removeBlock(TRADE_CURRENCY_BLOCK, expensiveOffer.input.count - 1))
      const outputRemovedResult = yield* Effect.either(inventoryService.removeBlock(expensiveOffer.output.itemType, expensiveOffer.output.count))

      expect(tradeResult instanceof TradeFailure).toBe(true)
      expect(Match.value(tradeResult).pipe(
        Match.tag('TradeFailure', (r) => r.reason),
        Match.tag('TradeSuccess', () => '' as const),
        Match.exhaustive,
      )).toBe('insufficient_input')
      expect(Either.isRight(remainingCurrencyResult)).toBe(true)
      expect(Either.isLeft(outputRemovedResult)).toBe(true)
    }).pipe(Effect.provide(TradingTestLayer))
  )

  // ---------------------------------------------------------------------------
  // Failure paths: removeBlock returns false (line 77-78) and addBlock returns
  // false (lines 81-84 — rollback path).
  // These require a custom InventoryService mock because the real service would
  // succeed on an inventory that has sufficient blocks.
  //
  // The mock layer and shared mutable state are declared OUTSIDE the Effect.gen
  // so that the same closure is captured by both the Layer and the assertions.
  // ---------------------------------------------------------------------------

  it.effect('returns insufficient_input when removeBlock returns false despite countBlockInInventory being sufficient', () => {
    // Mock inventory: getAllSlots reports 10 GRAVEL (plenty), but removeBlock always
    // returns false — exercises the second insufficient_input guard at line 77-78.
    const mockInv = InventoryService.of({
      _tag: '@minecraft/application/InventoryService' as const,
      getAllSlots: () => Effect.succeed([
        Option.some({ itemType: TRADE_CURRENCY_BLOCK as InventoryItem, count: 10 }),
      ]),
      removeBlock: (_itemType: InventoryItem, _count: number) => Effect.fail(new InventoryError({ operation: 'removeBlock', cause: 'simulated failure' })),
      addBlock: (_itemType: InventoryItem, _count: number) => Effect.void,
      getSlot: (_index: unknown) => Effect.succeed(Option.none()),
      setSlot: (_index: unknown, _stack: unknown) => Effect.void,
      damageSlot: (_index: unknown, _amount?: number) => Effect.void,
      moveStack: (_from: unknown, _to: unknown) => Effect.void,
      getHotbarSlots: () => Effect.succeed([]),
      serialize: () => Effect.succeed({ slots: [] }),
      clear: () => Effect.void,
      deserialize: (_data: unknown) => Effect.void,
    })

    const MockInvLayer = Layer.succeed(InventoryService, mockInv)

    const TestLayer = Layer.mergeAll(
      VillageServiceLive,
      MockInvLayer,
      TradingServiceLive.pipe(
        Layer.provide(VillageServiceLive),
        Layer.provide(MockInvLayer),
      ),
    )

    return Effect.gen(function* () {
      const villageService = yield* VillageService
      const tradingService = yield* TradingService

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

      const result = yield* tradingService.executeTrade(farmer.villagerId, offer.offerId)

      expect(result instanceof TradeFailure).toBe(true)
      expect(Match.value(result).pipe(
        Match.tag('TradeFailure', (r) => r.reason),
        Match.tag('TradeSuccess', () => '' as const),
        Match.exhaustive,
      )).toBe('insufficient_input')
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('returns offer_not_found when a level-1 villager attempts a level-2 offer (offer gated by findOfferForVillager)', () =>
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
      const farmer = Option.getOrThrow(farmerOpt)
      // farmer starts at level 1; farmer:sand-bundle requires level 2.
      // findOfferForVillager gates on levelRequired <= level, so the offer is not
      // found and the trade fails with 'offer_not_found' before reaching line 66.
      const sandOfferId = TradeOfferId.make('farmer:sand-bundle')
      const result = yield* tradingService.executeTrade(farmer.villagerId, sandOfferId)
      expect(result instanceof TradeFailure).toBe(true)
      expect(Match.value(result).pipe(
        Match.tag('TradeFailure', (r) => r.reason),
        Match.tag('TradeSuccess', () => '' as const),
        Match.exhaustive,
      )).toBe('offer_not_found')
    }).pipe(Effect.provide(TradingTestLayer))
  )

  it.effect('returns inventory_full and restores input blocks when addBlock(output) returns false', () => {
    // Track addBlock calls to verify the rollback (input re-added after output fails).
    const addBlockCalls: Array<{ itemType: InventoryItem; count: number }> = []

    const mockInv = InventoryService.of({
      _tag: '@minecraft/application/InventoryService' as const,
      getAllSlots: () => Effect.succeed([
        Option.some({ itemType: TRADE_CURRENCY_BLOCK as InventoryItem, count: 10 }),
      ]),
      // removeBlock succeeds (input is consumed).
      removeBlock: (_itemType: InventoryItem, _count: number) => Effect.void,
      // addBlock always fails with InventoryError (no room for output), but the ROLLBACK
      // addBlock call (restoring input.itemType) must still be observed.
      addBlock: (itemType: InventoryItem, count: number) => Effect.suspend(() => {
        addBlockCalls.push({ itemType, count })
        return Effect.fail(new InventoryError({ operation: 'addBlock', cause: 'inventory full' }))
      }),
      getSlot: (_index: unknown) => Effect.succeed(Option.none()),
      setSlot: (_index: unknown, _stack: unknown) => Effect.void,
      damageSlot: (_index: unknown, _amount?: number) => Effect.void,
      moveStack: (_from: unknown, _to: unknown) => Effect.void,
      getHotbarSlots: () => Effect.succeed([]),
      serialize: () => Effect.succeed({ slots: [] }),
      clear: () => Effect.void,
      deserialize: (_data: unknown) => Effect.void,
    })

    const MockInvLayer = Layer.succeed(InventoryService, mockInv)

    const TestLayer = Layer.mergeAll(
      VillageServiceLive,
      TradingServiceLive.pipe(
        Layer.provide(VillageServiceLive),
        Layer.provide(MockInvLayer),
      ),
    )

    return Effect.gen(function* () {
      const villageService = yield* VillageService
      const tradingService = yield* TradingService

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

      const result = yield* tradingService.executeTrade(farmer.villagerId, offer.offerId)

      // Trade must fail with inventory_full.
      expect(result instanceof TradeFailure).toBe(true)
      expect(Match.value(result).pipe(
        Match.tag('TradeFailure', (r) => r.reason),
        Match.tag('TradeSuccess', () => '' as const),
        Match.exhaustive,
      )).toBe('inventory_full')

      // The rollback addBlock(input.itemType) must have fired to restore what was removed.
      const rollbackCall = Arr.findFirst(addBlockCalls, (c) => c.itemType === offer.input.itemType)
      expect(Option.isSome(rollbackCall)).toBe(true)
      expect(Option.getOrThrow(rollbackCall).count).toBe(offer.input.count)
    }).pipe(Effect.provide(TestLayer))
  })

  describe('makeTestTradeOffer — builder shape validation', () => {
    plainIt('default offer has all required TradeOffer fields', () => {
      const offer = makeTestTradeOffer()
      expect(typeof offer.offerId).toBe('string')
      expect(offer.offerId.length).toBeGreaterThan(0)
      expect(offer.levelRequired).toBeGreaterThanOrEqual(1)
      expect(offer.input.count).toBeGreaterThan(0)
      expect(offer.output.count).toBeGreaterThan(0)
      expect(offer.experienceReward).toBeGreaterThanOrEqual(0)
    })

    plainIt('override profession produces a librarian offer', () => {
      const offer = makeTestTradeOffer({ profession: VillagerProfession.Librarian })
      expect(offer.profession).toBe(VillagerProfession.Librarian)
    })

    plainIt('override levelRequired is reflected in the result', () => {
      const offer = makeTestTradeOffer({ levelRequired: 3 })
      expect(offer.levelRequired).toBe(3)
    })
  })
})
