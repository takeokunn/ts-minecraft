---
title: "05 Villager Trading"
description: "05 Villager Tradingに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ["typescript", "minecraft", "specification"]
prerequisites: ["basic-typescript"]
estimated_reading_time: "25分"
---


# Villager Trading System - 村人取引システム

## 概要

Villager Trading Systemは、Minecraftの村人との複雑な経済的相互作用を実現するシステムです。動的価格システム、職業別取引アイテム、評判システム、経済バランス調整を実装します。Effect-TSの関数型プログラミングとSTMを活用し、一貫性のある経済メカニクスを提供します。

## システム設計原理

### Trading Core Types

取引システムの基本型定義です。

```typescript
import { Effect, Layer, Context, STM, Ref, Schema, pipe } from "effect"
import { Brand } from "effect"

// Domain Types
export type TradePrice = Brand.Brand<number, "TradePrice">
export const TradePrice = pipe(
  Schema.Number,
  Schema.int(),
  Schema.positive(),
  Schema.brand("TradePrice")
)

export type Reputation = Brand.Brand<number, "Reputation"> // -100 to 100
export const Reputation = pipe(
  Schema.Number,
  Schema.int(),
  Schema.between(-100, 100),
  Schema.brand("Reputation")
)

export type TradeLevel = Brand.Brand<number, "TradeLevel"> // 1-5
export const TradeLevel = pipe(
  Schema.Number,
  Schema.int(),
  Schema.between(1, 5),
  Schema.brand("TradeLevel")
)

export type VillagerExperience = Brand.Brand<number, "VillagerExperience">
export const VillagerExperience = pipe(
  Schema.Number,
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand("VillagerExperience")
)

// Villager Professions
export const VillagerProfession = Schema.Literal(
  "armorer",      // 防具鍛冶
  "butcher",      // 肉屋
  "cartographer", // 地図製作者
  "cleric",       // 聖職者
  "farmer",       // 農民
  "fisherman",    // 漁師
  "fletcher",     // 矢師
  "leatherworker", // 革職人
  "librarian",    // 司書
  "mason",        // 石工
  "shepherd",     // 羊飼い
  "toolsmith",    // 道具鍛冶
  "weaponsmith",  // 武器鍛冶
  "nitwit"        // 無職
)

export type VillagerProfession = Schema.Schema.Type<typeof VillagerProfession>

// Trade Offer Structure
export const TradeOffer = Schema.Struct({
  id: Schema.String,
  inputItems: Schema.Array(Schema.Struct({
    itemType: Schema.String,
    count: Schema.Number.pipe(Schema.int(), Schema.positive()),
    enchantments: Schema.optional(Schema.Array(Schema.String)),
    durability: Schema.optional(Schema.Number)
  })),
  outputItem: Schema.Struct({
    itemType: Schema.String,
    count: Schema.Number.pipe(Schema.int(), Schema.positive()),
    enchantments: Schema.optional(Schema.Array(Schema.String)),
    durability: Schema.optional(Schema.Number)
  }),
  basePrice: TradePrice,
  currentPrice: TradePrice,
  maxUses: Schema.Number.pipe(Schema.int(), Schema.positive()),
  currentUses: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  reputationBonus: Schema.Number,
  demandModifier: Schema.Number, // 需要による価格修正
  supplyModifier: Schema.Number, // 供給による価格修正
  experienceReward: VillagerExperience,
  tradeLevel: TradeLevel,
  isLocked: Schema.Boolean,
  cooldownUntil: Schema.optional(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  lastTraded: Schema.optional(Schema.DateTimeUtc)
})

export type TradeOffer = Schema.Schema.Type<typeof TradeOffer>

// Villager State
export const VillagerState = Schema.Struct({
  villagerId: Schema.String,
  profession: VillagerProfession,
  level: TradeLevel,
  experience: VillagerExperience,
  workstation: Schema.optional(Schema.Struct({
    position: BlockPosition,
    type: Schema.String
  })),
  activeOffers: Schema.Array(Schema.String), // Trade offer IDs
  lockedOffers: Schema.Array(Schema.String),
  reputation: Schema.Map(Schema.String, Reputation), // Player ID -> Reputation
  villageId: Schema.optional(Schema.String),
  workSchedule: Schema.Struct({
    workStartTime: Schema.Number, // Game time
    workEndTime: Schema.Number,
    lunchTime: Schema.Number,
    isWorking: Schema.Boolean,
    lastWorkTime: Schema.optional(Schema.DateTimeUtc)
  }),
  personalityTraits: Schema.Struct({
    generosity: Schema.Number.pipe(Schema.between(0, 1)),
    stubbornness: Schema.Number.pipe(Schema.between(0, 1)),
    curiosity: Schema.Number.pipe(Schema.between(0, 1)),
    sociability: Schema.Number.pipe(Schema.between(0, 1))
  }),
  tradingHistory: Schema.Array(Schema.Struct({
    playerId: Schema.String,
    tradeOfferId: Schema.String,
    timestamp: Schema.DateTimeUtc,
    itemsTraded: Schema.Array(Schema.String),
    priceModifier: Schema.Number
  })),
  lastRestockTime: Schema.optional(Schema.DateTimeUtc),
  gossipData: Schema.Map(Schema.String, Schema.Struct({ // About other players
    playerId: Schema.String,
    gossipType: Schema.Literal("major_positive", "minor_positive", "major_negative", "minor_negative", "trading"),
    value: Schema.Number,
    timestamp: Schema.DateTimeUtc,
    decay: Schema.Number
  }))
})

export type VillagerState = Schema.Schema.Type<typeof VillagerState>

// Economic Context
export const EconomicContext = Schema.Struct({
  villageId: Schema.String,
  totalVillagers: Schema.Number,
  averagePlayerReputation: Reputation,
  recentTrades: Schema.Array(Schema.Struct({
    itemType: Schema.String,
    volume: Schema.Number,
    averagePrice: TradePrice,
    timestamp: Schema.DateTimeUtc
  })),
  marketTrends: Schema.Map(Schema.String, Schema.Struct({ // Item type -> trend
    demand: Schema.Number.pipe(Schema.between(0, 2)),
    supply: Schema.Number.pipe(Schema.between(0, 2)),
    priceDirection: Schema.Literal("rising", "stable", "falling"),
    volatility: Schema.Number.pipe(Schema.between(0, 1))
  })),
  seasonalModifiers: Schema.Map(Schema.String, Schema.Number), // Item type -> modifier
  specialEvents: Schema.Array(Schema.Struct({
    eventType: Schema.String,
    effect: Schema.String,
    multiplier: Schema.Number,
    expiresAt: Schema.DateTimeUtc
  }))
})

export type EconomicContext = Schema.Schema.Type<typeof EconomicContext>
```

### Trading Engine

取引エンジンの実装です。

```typescript
// Trading Engine
interface TradingEngineInterface {
  readonly initializeVillagerTrades: (
    villager: VillagerState,
    economicContext: EconomicContext
  ) => Effect.Effect<ReadonlyArray<TradeOffer>, TradingError>
  readonly executeTrade: (
    playerId: string,
    villagerId: string,
    tradeOfferId: string,
    playerItems: ReadonlyArray<ItemStack>
  ) => Effect.Effect<TradeResult, TradingError>
  readonly updateTradeOffers: (
    villagerId: string,
    economicContext: EconomicContext
  ) => Effect.Effect<ReadonlyArray<TradeOffer>, TradingError>
  readonly calculateTradePrice: (
    offer: TradeOffer,
    villager: VillagerState,
    playerId: string,
    economicContext: EconomicContext
  ) => Effect.Effect<TradePrice, never>
  readonly restockTrades: (
    villagerId: string
  ) => Effect.Effect<void, TradingError>
  readonly levelUpVillager: (
    villagerId: string,
    experience: VillagerExperience
  ) => Effect.Effect<VillagerState, TradingError>
  readonly getAvailableTrades: (
    villagerId: string,
    playerId: string
  ) => Effect.Effect<ReadonlyArray<TradeOffer>, never>
}

const TradingEngine = Context.GenericTag<TradingEngineInterface>("@app/TradingEngine")

export const TradingEngineLive = Layer.effect(
  TradingEngine,
  Effect.gen(function* () {
    const villagerStates = yield* Ref.make<Map<string, VillagerState>>(new Map())
    const tradeOffers = yield* Ref.make<Map<string, TradeOffer>>(new Map())
    const economicContexts = yield* Ref.make<Map<string, EconomicContext>>(new Map())

    const initializeVillagerTrades = (
      villager: VillagerState,
      economicContext: EconomicContext
    ) => Effect.gen(function* () {
      const tradeTemplates = getTradeTemplatesForProfession(villager.profession, villager.level)
      const offers: TradeOffer[] = []

      for (const template of tradeTemplates) {
        const basePrice = calculateBasePrice(template, economicContext)
        const offer: TradeOffer = {
          id: crypto.randomUUID(),
          inputItems: template.inputs,
          outputItem: template.output,
          basePrice,
          currentPrice: basePrice,
          maxUses: template.maxUses,
          currentUses: 0,
          reputationBonus: 0,
          demandModifier: 1.0,
          supplyModifier: 1.0,
          experienceReward: template.experience,
          tradeLevel: villager.level,
          isLocked: false,
          createdAt: new Date(),
          cooldownUntil: undefined,
          lastTraded: undefined
        }

        offers.push(offer)
        yield* Ref.update(tradeOffers, map => map.set(offer.id, offer))
      }

      // Update villager's active offers
      yield* Ref.update(villagerStates, map => {
        const updatedVillager = {
          ...villager,
          activeOffers: offers.map(o => o.id)
        }
        map.set(villager.villagerId, updatedVillager)
        return map
      })

      return offers
    })

    const executeTrade = (
      playerId: string,
      villagerId: string,
      tradeOfferId: string,
      playerItems: ReadonlyArray<ItemStack>
    ) => STM.gen(function* () {
      const villagerStateMap = yield* STM.fromRef(villagerStates)
      const offerMap = yield* STM.fromRef(tradeOffers)

      const villager = villagerStateMap.get(villagerId)
      const offer = offerMap.get(tradeOfferId)

      if (!villager) {
        return yield* STM.fail(new TradingError(`Villager not found: ${villagerId}`))
      }

      if (!offer) {
        return yield* STM.fail(new TradingError(`Trade offer not found: ${tradeOfferId}`))
      }

      // 早期リターン: 取引条件の検証
      if (offer.isLocked) {
        return yield* STM.fail(new TradingError("Trade is locked"))
      }

      if (offer.currentUses >= offer.maxUses) {
        return yield* STM.fail(new TradingError("Trade is sold out"))
      }

      if (offer.cooldownUntil && new Date() < offer.cooldownUntil) {
        return yield* STM.fail(new TradingError("Trade is on cooldown"))
      }

      // 早期リターン: プレイヤーのアイテム検証
      const hasRequiredItems = yield* STM.succeed(
        verifyPlayerHasItems(playerItems, offer.inputItems)
      )

      if (!hasRequiredItems) {
        return yield* STM.fail(new TradingError("Player doesn't have required items"))
      }

      // Calculate final price with all modifiers
      const economicContext = yield* STM.succeed(
        getCurrentEconomicContext(villager.villageId || "default")
      )
      const finalPrice = yield* STM.succeed(
        calculateFinalTradePrice(offer, villager, playerId, economicContext)
      )

      // Execute the trade
      const updatedOffer: TradeOffer = {
        ...offer,
        currentUses: offer.currentUses + 1,
        lastTraded: new Date(),
        currentPrice: finalPrice
      }

      const updatedVillager: VillagerState = {
        ...villager,
        experience: (villager.experience + offer.experienceReward) as VillagerExperience,
        tradingHistory: [
          ...villager.tradingHistory,
          {
            playerId,
            tradeOfferId,
            timestamp: new Date(),
            itemsTraded: offer.inputItems.map(item => item.itemType),
            priceModifier: finalPrice / offer.basePrice
          }
        ]
      }

      // Update reputation
      const currentReputation = updatedVillager.reputation.get(playerId) || 0 as Reputation
      const reputationChange = calculateReputationChange(offer, economicContext)
      const newReputation = Math.min(100, Math.max(-100,
        currentReputation + reputationChange
      )) as Reputation

      updatedVillager.reputation.set(playerId, newReputation)

      // Update maps
      yield* STM.setRef(villagerStates, villagerStateMap.set(villagerId, updatedVillager))
      yield* STM.setRef(tradeOffers, offerMap.set(tradeOfferId, updatedOffer))

      // Check for level up
      const shouldLevelUp = shouldVillagerLevelUp(updatedVillager)
      if (shouldLevelUp) {
        yield* STM.succeed(Effect.runSync(levelUpVillager(villagerId, updatedVillager.experience)))
      }

      return {
        success: true,
        outputItem: offer.outputItem,
        finalPrice,
        reputationChange,
        newReputation,
        villagerLeveledUp: shouldLevelUp,
        transaction: {
          id: crypto.randomUUID(),
          playerId,
          villagerId,
          tradeOfferId,
          timestamp: new Date(),
          itemsGiven: offer.inputItems,
          itemReceived: offer.outputItem,
          price: finalPrice
        }
      }
    })

    const calculateTradePrice = (
      offer: TradeOffer,
      villager: VillagerState,
      playerId: string,
      economicContext: EconomicContext
    ) => Effect.gen(function* () {
      let price = offer.basePrice

      // Reputation modifier
      const reputation = villager.reputation.get(playerId) || 0 as Reputation
      const reputationModifier = calculateReputationModifier(reputation)
      price = Math.round(price * reputationModifier) as TradePrice

      // Demand/Supply modifier
      const marketData = economicContext.marketTrends.get(offer.outputItem.itemType)
      if (marketData) {
        const demandModifier = Math.min(2.0, Math.max(0.5, marketData.demand))
        const supplyModifier = Math.min(2.0, Math.max(0.5, 2.0 - marketData.supply))
        price = Math.round(price * demandModifier * supplyModifier) as TradePrice
      }

      // Personality modifier
      const personalityModifier = calculatePersonalityModifier(
        villager.personalityTraits,
        villager.tradingHistory,
        playerId
      )
      price = Math.round(price * personalityModifier) as TradePrice

      // Time-based modifiers
      const timeModifier = calculateTimeBasedModifier(new Date())
      price = Math.round(price * timeModifier) as TradePrice

      // Special event modifiers
      const eventModifier = calculateEventModifiers(economicContext.specialEvents)
      price = Math.round(price * eventModifier) as TradePrice

      return Math.max(1, price) as TradePrice
    })

    const updateTradeOffers = (
      villagerId: string,
      economicContext: EconomicContext
    ) => Effect.gen(function* () {
      const villagerStateMap = yield* Ref.get(villagerStates)
      const offerMap = yield* Ref.get(tradeOffers)

      const villager = villagerStateMap.get(villagerId)
      if (!villager) {
        return []
      }

      const updatedOffers: TradeOffer[] = []

      for (const offerId of villager.activeOffers) {
        const offer = offerMap.get(offerId)
        if (!offer) continue

        // Update demand/supply modifiers based on market trends
        const marketData = economicContext.marketTrends.get(offer.outputItem.itemType)
        if (marketData) {
          const updatedOffer: TradeOffer = {
            ...offer,
            demandModifier: marketData.demand,
            supplyModifier: marketData.supply
          }

          updatedOffers.push(updatedOffer)
          yield* Ref.update(tradeOffers, map => map.set(offerId, updatedOffer))
        } else {
          updatedOffers.push(offer)
        }
      }

      return updatedOffers
    })

    const restockTrades = (villagerId: string) => Effect.gen(function* () {
      const villagerStateMap = yield* Ref.get(villagerStates)
      const villager = villagerStateMap.get(villagerId)

      // 早期リターン: 村人が存在しない場合
      if (!villager) {
        return yield* Effect.fail(new TradingError(`Villager not found: ${villagerId}`))
      }

      // 早期リターン: 作業台がない場合
      const hasWorkstation = villager.workstation !== undefined
      if (!hasWorkstation) {
        return yield* Effect.fail(new TradingError("Villager needs workstation to restock"))
      }

      // Restock all offers
      yield* Ref.update(tradeOffers, map => {
        for (const offerId of villager.activeOffers) {
          const offer = map.get(offerId)
          if (offer) {
            const restockedOffer: TradeOffer = {
              ...offer,
              currentUses: 0,
              isLocked: false,
              cooldownUntil: undefined
            }
            map.set(offerId, restockedOffer)
          }
        }
        return map
      })

      // Update villager's last restock time
      yield* Ref.update(villagerStates, map => {
        const updatedVillager: VillagerState = {
          ...villager,
          lastRestockTime: new Date()
        }
        map.set(villagerId, updatedVillager)
        return map
      })

      yield* Effect.log(`Villager ${villagerId} restocked trades`)
    })

    const levelUpVillager = (
      villagerId: string,
      experience: VillagerExperience
    ) => Effect.gen(function* () {
      const villagerStateMap = yield* Ref.get(villagerStates)
      const villager = villagerStateMap.get(villagerId)

      // 早期リターン: 村人が存在しない場合
      if (!villager) {
        return yield* Effect.fail(new TradingError(`Villager not found: ${villagerId}`))
      }

      const currentLevel = villager.level
      const newLevel = calculateLevelFromExperience(experience)

      // 早期リターン: レベルアップしない場合
      if (newLevel <= currentLevel) {
        return villager
      }
        const updatedVillager: VillagerState = {
          ...villager,
          level: newLevel,
          experience
        }

        yield* Ref.update(villagerStates, map => map.set(villagerId, updatedVillager))

        // Unlock new trade offers for the new level
        const economicContext = getCurrentEconomicContext(villager.villageId || "default")
        const newOffers = yield* initializeVillagerTrades(updatedVillager, economicContext)

      yield* Effect.log(`Villager ${villagerId} leveled up to level ${newLevel}`)
      return updatedVillager
    })

    const getAvailableTrades = (villagerId: string, playerId: string) => Effect.gen(function* () {
      const villagerStateMap = yield* Ref.get(villagerStates)
      const offerMap = yield* Ref.get(tradeOffers)

      const villager = villagerStateMap.get(villagerId)
      // 早期リターン: 村人が存在しない場合
      if (!villager) {
        return []
      }

      const availableOffers: TradeOffer[] = []
      const currentTime = new Date()

      for (const offerId of villager.activeOffers) {
        const offer = offerMap.get(offerId)
        if (!offer) continue

        // Check if offer is available
        const isAvailable = !offer.isLocked &&
          offer.currentUses < offer.maxUses &&
          (!offer.cooldownUntil || currentTime >= offer.cooldownUntil)

        if (isAvailable) {
          // Calculate current price for this player
          const economicContext = getCurrentEconomicContext(villager.villageId || "default")
          const currentPrice = yield* calculateTradePrice(offer, villager, playerId, economicContext)

          const offerWithPrice: TradeOffer = {
            ...offer,
            currentPrice
          }

          availableOffers.push(offerWithPrice)
        }
      }

      return availableOffers
    })

    return {
      initializeVillagerTrades,
      executeTrade: (playerId, villagerId, tradeOfferId, playerItems) =>
        STM.commit(executeTrade(playerId, villagerId, tradeOfferId, playerItems)),
      updateTradeOffers,
      calculateTradePrice,
      restockTrades,
      levelUpVillager,
      getAvailableTrades
    } as const
  })
)
```

### Reputation System

評判システムの実装です。

```typescript
// Reputation System
interface ReputationSystemInterface {
  readonly updatePlayerReputation: (
    playerId: string,
    villagerId: string,
    action: ReputationAction,
    magnitude: number
  ) => Effect.Effect<void, never>
  readonly getPlayerReputation: (
    playerId: string,
    villagerId?: string
  ) => Effect.Effect<Reputation, never>
  readonly getVillageReputation: (
    playerId: string,
    villageId: string
  ) => Effect.Effect<Reputation, never>
  readonly spreadGossip: (
    sourceVillagerId: string,
    targetPlayerId: string,
    gossipType: GossipType,
    value: number
  ) => Effect.Effect<void, never>
  readonly decayReputations: (
    deltaTime: number
  ) => Effect.Effect<void, never>
  readonly calculateReputationEffects: (
    playerId: string,
    villagerId: string
  ) => Effect.Effect<ReputationEffects, never>
}

const ReputationSystem = Context.GenericTag<ReputationSystemInterface>("@app/ReputationSystem")

export const ReputationSystemLive = Layer.effect(
  ReputationSystem,
  Effect.gen(function* () {
    const playerReputations = yield* Ref.make<Map<string, Map<string, ReputationData>>>(new Map())

    const updatePlayerReputation = (
      playerId: string,
      villagerId: string,
      action: ReputationAction,
      magnitude: number
    ) => Effect.gen(function* () {
      const reputationChange = calculateReputationChange(action, magnitude)

      yield* Ref.update(playerReputations, map => {
        const playerMap = map.get(playerId) || new Map()
        const currentData = playerMap.get(villagerId) || {
          reputation: 0 as Reputation,
          interactions: [],
          lastUpdate: new Date(),
          decayRate: 0.1
        }

        const newReputation = Math.min(100, Math.max(-100,
          currentData.reputation + reputationChange
        )) as Reputation

        const updatedData: ReputationData = {
          reputation: newReputation,
          interactions: [
            ...currentData.interactions.slice(-50), // Keep last 50 interactions
            {
              action,
              magnitude,
              timestamp: new Date(),
              reputationChange
            }
          ],
          lastUpdate: new Date(),
          decayRate: currentData.decayRate
        }

        playerMap.set(villagerId, updatedData)
        map.set(playerId, playerMap)
        return map
      })

      // Spread gossip to nearby villagers
      yield* spreadGossip(villagerId, playerId, getGossipTypeFromAction(action), magnitude)
    })

    const spreadGossip = (
      sourceVillagerId: string,
      targetPlayerId: string,
      gossipType: GossipType,
      value: number
    ) => Effect.gen(function* () {
      const world = yield* WorldSystem
      const sourceVillager = yield* world.getEntityById(sourceVillagerId)

      // 早期リターン: ソース村人が存在しないまたは村人ではない場合
      if (!sourceVillager || sourceVillager.type !== "villager") {
        return
      }

      // Find nearby villagers
      const nearbyVillagers = yield* world.getVillagersInRadius(
        sourceVillager.position,
        20 // 20 block radius
      )

      for (const villager of nearbyVillagers) {
        if (villager.id === sourceVillagerId) continue

        // Calculate gossip strength based on distance and relationship
        const distance = calculateDistance(sourceVillager.position, villager.position)
        const gossipStrength = Math.max(0.1, 1 - (distance / 20))

        // Apply gossip effect
        const gossipValue = value * gossipStrength * getGossipModifier(gossipType)

        yield* updatePlayerReputation(
          targetPlayerId,
          villager.id,
          "gossip_received" as ReputationAction,
          gossipValue
        )

        yield* Effect.log(`Gossip spread from ${sourceVillagerId} to ${villager.id} about ${targetPlayerId}`)
      }
    })

    const getPlayerReputation = (
      playerId: string,
      villagerId?: string
    ) => Effect.gen(function* () {
      const reputationMap = yield* Ref.get(playerReputations)
      const playerMap = reputationMap.get(playerId)

      if (!playerMap) {
        return 0 as Reputation
      }

      if (villagerId) {
        const data = playerMap.get(villagerId)
        return data?.reputation || 0 as Reputation
      }

      // Return average reputation across all villagers
      const reputations = Array.from(playerMap.values()).map(data => data.reputation)
      const average = reputations.reduce((sum, rep) => sum + rep, 0) / reputations.length

      return Math.round(average) as Reputation
    })

    const getVillageReputation = (
      playerId: string,
      villageId: string
    ) => Effect.gen(function* () {
      const world = yield* WorldSystem
      const villageVillagers = yield* world.getVillagersByVillage(villageId)

      const reputationMap = yield* Ref.get(playerReputations)
      const playerMap = reputationMap.get(playerId)

      if (!playerMap || villageVillagers.length === 0) {
        return 0 as Reputation
      }

      let totalReputation = 0
      let count = 0

      for (const villager of villageVillagers) {
        const data = playerMap.get(villager.id)
        if (data) {
          totalReputation += data.reputation
          count++
        }
      }

      return count > 0 ? Math.round(totalReputation / count) as Reputation : 0 as Reputation
    })

    const decayReputations = (deltaTime: number) => Effect.gen(function* () {
      yield* Ref.update(playerReputations, map => {
        for (const [playerId, playerMap] of map) {
          for (const [villagerId, data] of playerMap) {
            // Apply reputation decay towards neutral (0)
            const decayAmount = data.decayRate * (deltaTime / 1000) // per second
            let newReputation = data.reputation

            if (newReputation > 0) {
              newReputation = Math.max(0, newReputation - decayAmount)
            } else if (newReputation < 0) {
              newReputation = Math.min(0, newReputation + decayAmount)
            }

            if (newReputation !== data.reputation) {
              playerMap.set(villagerId, {
                ...data,
                reputation: Math.round(newReputation) as Reputation,
                lastUpdate: new Date()
              })
            }
          }
        }
        return map
      })
    })

    const calculateReputationEffects = (
      playerId: string,
      villagerId: string
    ) => Effect.gen(function* () {
      const reputation = yield* getPlayerReputation(playerId, villagerId)

      const effects: ReputationEffects = {
        priceModifier: calculateReputationPriceModifier(reputation),
        tradeAvailability: calculateTradeAvailability(reputation),
        specialOffers: reputation > 80 ? ["hero_of_village"] : [],
        discounts: calculateDiscounts(reputation),
        protectionLevel: calculateProtectionLevel(reputation),
        giftChance: reputation > 60 ? Math.min(0.1, (reputation - 60) / 400) : 0
      }

      return effects
    })

    return {
      updatePlayerReputation,
      getPlayerReputation,
      getVillageReputation,
      spreadGossip,
      decayReputations,
      calculateReputationEffects
    } as const
  })
)
```

### Economic Simulation

経済シミュレーションシステムです。

```typescript
// Economic Simulation
interface EconomicSimulationInterface {
  readonly updateMarketTrends: (
    villageId: string,
    deltaTime: number
  ) => Effect.Effect<EconomicContext, never>
  readonly simulateSupplyDemand: (
    itemType: string,
    tradeVolume: number,
    playerActions: ReadonlyArray<PlayerAction>
  ) => Effect.Effect<MarketData, never>
  readonly applySeasonalEffects: (
    season: Season,
    economicContext: EconomicContext
  ) => Effect.Effect<EconomicContext, never>
  readonly triggerMarketEvent: (
    eventType: MarketEventType,
    affectedItems: ReadonlyArray<string>,
    duration: number
  ) => Effect.Effect<void, never>
  readonly predictPriceChanges: (
    itemType: string,
    timeHorizon: number
  ) => Effect.Effect<PricePredicton, never>
  readonly optimizeVillageEconomy: (
    villageId: string
  ) => Effect.Effect<EconomicOptimizationResult, never>
}

const EconomicSimulation = Context.GenericTag<EconomicSimulationInterface>("@app/EconomicSimulation")

export const EconomicSimulationLive = Layer.effect(
  EconomicSimulation,
  Effect.gen(function* () {
    const marketData = yield* Ref.make<Map<string, MarketData>>(new Map())
    const priceHistory = yield* Ref.make<Map<string, ReadonlyArray<PricePoint>>>(new Map())

    const updateMarketTrends = (
      villageId: string,
      deltaTime: number
    ) => Effect.gen(function* () {
      const economicContext = getCurrentEconomicContext(villageId)
      const updatedTrends = new Map(economicContext.marketTrends)

      for (const [itemType, trend] of updatedTrends) {
        // Simulate natural market fluctuations
        const demandChange = (Math.random() - 0.5) * 0.1 * (deltaTime / 1000)
        const supplyChange = (Math.random() - 0.5) * 0.1 * (deltaTime / 1000)

        const newDemand = Math.max(0.1, Math.min(2.0, trend.demand + demandChange))
        const newSupply = Math.max(0.1, Math.min(2.0, trend.supply + supplyChange))

        // Determine price direction
        const priceDirection = newDemand > newSupply * 1.1 ? "rising" :
                             newSupply > newDemand * 1.1 ? "falling" : "stable"

        // Calculate volatility
        const volatility = Math.abs(demandChange) + Math.abs(supplyChange)

        updatedTrends.set(itemType, {
          demand: newDemand,
          supply: newSupply,
          priceDirection,
          volatility: Math.min(1, Math.max(0, trend.volatility * 0.9 + volatility * 0.1))
        })
      }

      const updatedContext: EconomicContext = {
        ...economicContext,
        marketTrends: updatedTrends
      }

      // Update global economic contexts
      yield* updateEconomicContext(villageId, updatedContext)

      return updatedContext
    })

    const simulateSupplyDemand = (
      itemType: string,
      tradeVolume: number,
      playerActions: ReadonlyArray<PlayerAction>
    ) => Effect.gen(function* () {
      const currentData = yield* Effect.map(
        Ref.get(marketData),
        map => map.get(itemType) || createDefaultMarketData(itemType)
      )

      // Calculate demand based on trade volume and player actions
      let demandModifier = 1.0
      let supplyModifier = 1.0

      // High trade volume indicates high demand
      if (tradeVolume > currentData.averageVolume * 1.5) {
        demandModifier += 0.2
      } else if (tradeVolume < currentData.averageVolume * 0.5) {
        demandModifier -= 0.1
      }

      // Player actions affect supply/demand
      const relevantActions = playerActions.filter(action =>
        isActionRelevantToItem(action, itemType)
      )

      for (const action of relevantActions) {
        const actionEffect = Match.value(action.type).pipe(
          Match.when("mine", () => ({ supply: 0.05, demand: 0 })),
          Match.when("harvest", () => ({ supply: 0.05, demand: 0 })),
          Match.when("craft", () => ({ supply: 0.05, demand: 0 })),
          Match.when("use", () => ({ supply: 0, demand: 0.05 })),
          Match.when("consume", () => ({ supply: 0, demand: 0.05 })),
          Match.orElse(() => ({ supply: 0, demand: 0 }))
        )

        supplyModifier += actionEffect.supply
        demandModifier += actionEffect.demand
      }

      const updatedData: MarketData = {
        ...currentData,
        demand: Math.max(0.1, Math.min(2.0, currentData.demand * demandModifier)),
        supply: Math.max(0.1, Math.min(2.0, currentData.supply * supplyModifier)),
        averageVolume: currentData.averageVolume * 0.9 + tradeVolume * 0.1
      }

      yield* Ref.update(marketData, map => map.set(itemType, updatedData))

      return updatedData
    })

    const applySeasonalEffects = (
      season: Season,
      economicContext: EconomicContext
    ) => Effect.gen(function* () {
      const seasonalModifiers = Match.value(season).pipe(
        Match.when("spring", () => new Map([
          ["seeds", 0.8],
          ["saplings", 0.8],
          ["flowers", 1.2]
        ])),
        Match.when("summer", () => new Map([
          ["crops", 1.3],
          ["ice", 0.5],
          ["cooling_items", 1.4]
        ])),
        Match.when("autumn", () => new Map([
          ["crops", 0.7],
          ["pumpkins", 0.6],
          ["apples", 0.6]
        ])),
        Match.when("winter", () => new Map([
          ["warming_items", 1.5],
          ["coal", 1.3],
          ["wood", 1.2],
          ["food", 1.1]
        ])),
        Match.exhaustive
      )

      return {
        ...economicContext,
        seasonalModifiers
      }
    })

    const triggerMarketEvent = (
      eventType: MarketEventType,
      affectedItems: ReadonlyArray<string>,
      duration: number
    ) => Effect.gen(function* () {
      const eventEffect = getMarketEventEffect(eventType)
      const expirationTime = new Date(Date.now() + duration * 1000)

      const event: MarketEvent = {
        eventType,
        effect: eventEffect.description,
        multiplier: eventEffect.multiplier,
        expiresAt: expirationTime
      }

      // Apply to all economic contexts
      yield* Effect.forEach(
        affectedItems,
        itemType => applyMarketEventToItem(itemType, event),
        { concurrency: "unbounded" }
      )

      yield* Effect.log(`Market event triggered: ${eventType} affecting ${affectedItems.join(", ")}`)
    })

    const predictPriceChanges = (
      itemType: string,
      timeHorizon: number
    ) => Effect.gen(function* () {
      const history = yield* Effect.map(
        Ref.get(priceHistory),
        map => map.get(itemType) || []
      )

      if (history.length < 10) {
        return {
          itemType,
          currentTrend: "stable" as const,
          confidence: 0.1,
          predictedChange: 0,
          timeHorizon,
          factors: ["insufficient_data"]
        }
      }

      // Simple trend analysis
      const recentPrices = history.slice(-10)
      const avgRecentPrice = recentPrices.reduce((sum, p) => sum + p.price, 0) / recentPrices.length
      const olderPrices = history.slice(-20, -10)
      const avgOlderPrice = olderPrices.length > 0 ?
        olderPrices.reduce((sum, p) => sum + p.price, 0) / olderPrices.length :
        avgRecentPrice

      const priceChangeRate = (avgRecentPrice - avgOlderPrice) / avgOlderPrice
      const currentTrend = priceChangeRate > 0.05 ? "rising" :
                          priceChangeRate < -0.05 ? "falling" : "stable"

      // Predict future price based on trend
      const predictedChange = priceChangeRate * (timeHorizon / 3600) // per hour
      const confidence = Math.min(0.9, history.length / 50) // More data = higher confidence

      return {
        itemType,
        currentTrend,
        confidence,
        predictedChange,
        timeHorizon,
        factors: analyzePriceFactors(itemType, history, recentPrices)
      }
    })

    const optimizeVillageEconomy = (villageId: string) => Effect.gen(function* () {
      const economicContext = getCurrentEconomicContext(villageId)
      const recommendations: EconomicRecommendation[] = []

      // Analyze market imbalances
      for (const [itemType, trend] of economicContext.marketTrends) {
        if (trend.demand > trend.supply * 1.5) {
          recommendations.push({
            type: "increase_supply",
            itemType,
            priority: "high",
            expectedImprovement: 0.3,
            description: `Increase supply of ${itemType} to meet high demand`
          })
        } else if (trend.supply > trend.demand * 1.5) {
          recommendations.push({
            type: "reduce_supply",
            itemType,
            priority: "medium",
            expectedImprovement: 0.2,
            description: `Reduce supply of ${itemType} due to low demand`
          })
        }
      }

      // Analyze trade patterns
      const recentTrades = economicContext.recentTrades
      const tradeFrequency = new Map<string, number>()

      for (const trade of recentTrades) {
        const count = tradeFrequency.get(trade.itemType) || 0
        tradeFrequency.set(trade.itemType, count + trade.volume)
      }

      // Recommend popular items
      const popularItems = Array.from(tradeFrequency.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)

      for (const [itemType, volume] of popularItems) {
        recommendations.push({
          type: "promote_trade",
          itemType,
          priority: "medium",
          expectedImprovement: 0.25,
          description: `Promote trading of popular item: ${itemType}`
        })
      }

      return {
        villageId,
        currentEfficiency: calculateEconomicEfficiency(economicContext),
        recommendations,
        projectedImprovement: calculateProjectedImprovement(recommendations),
        analysisDate: new Date()
      }
    })

    return {
      updateMarketTrends,
      simulateSupplyDemand,
      applySeasonalEffects,
      triggerMarketEvent,
      predictPriceChanges,
      optimizeVillageEconomy
    } as const
  })
)
```

## Layer構成

```typescript
// Villager Trading System Layer
export const VillagerTradingLayer = Layer.mergeAll(
  TradingEngineLive,
  ReputationSystemLive,
  EconomicSimulationLive
).pipe(
  Layer.provide(WorldSystemLayer),
  Layer.provide(EventBusLayer),
  Layer.provide(TimeSystemLayer)
)
```

## 使用例

```typescript
// Villager Trading System の使用例
const exampleVillagerTrading = Effect.gen(function* () {
  const tradingEngine = yield* TradingEngine
  const reputationSystem = yield* ReputationSystem
  const economicSim = yield* EconomicSimulation

  // 村人の作成と取引初期化
  const farmerVillager: VillagerState = {
    villagerId: "villager_001",
    profession: "farmer",
    level: 1 as TradeLevel,
    experience: 0 as VillagerExperience,
    workstation: {
      position: { x: 100, y: 64, z: 100 },
      type: "composter"
    },
    activeOffers: [],
    lockedOffers: [],
    reputation: new Map(),
    villageId: "village_001",
    workSchedule: {
      workStartTime: 2000, // 朝8時頃
      workEndTime: 12000,  // 夕方6時頃
      lunchTime: 7000,     // 昼12時頃
      isWorking: true,
      lastWorkTime: new Date()
    },
    personalityTraits: {
      generosity: 0.7,
      stubbornness: 0.3,
      curiosity: 0.6,
      sociability: 0.8
    },
    tradingHistory: [],
    lastRestockTime: new Date(),
    gossipData: new Map()
  }

  // 経済コンテキストの作成
  const economicContext: EconomicContext = {
    villageId: "village_001",
    totalVillagers: 5,
    averagePlayerReputation: 0 as Reputation,
    recentTrades: [],
    marketTrends: new Map([
      ["wheat", { demand: 1.2, supply: 0.8, priceDirection: "rising", volatility: 0.2 }],
      ["bread", { demand: 0.9, supply: 1.1, priceDirection: "falling", volatility: 0.1 }],
      ["emerald", { demand: 1.0, supply: 1.0, priceDirection: "stable", volatility: 0.05 }]
    ]),
    seasonalModifiers: new Map([
      ["crops", 0.8], // 春なので作物が安い
      ["seeds", 0.9]
    ]),
    specialEvents: []
  }

  // 村人の取引を初期化
  const initialOffers = yield* tradingEngine.initializeVillagerTrades(
    farmerVillager,
    economicContext
  )

  yield* Effect.log(`Initialized ${initialOffers.length} trade offers for farmer`)
  initialOffers.forEach((offer, i) => {
    yield* Effect.log(`  Offer ${i}: ${offer.outputItem.itemType} for ${offer.basePrice} emeralds`)
  })

  // プレイヤーとの取引シミュレーション
  const playerId = "player_001"
  const availableTrades = yield* tradingEngine.getAvailableTrades(farmerVillager.villagerId, playerId)

  if (availableTrades.length > 0) {
    const firstTrade = availableTrades[0]
    yield* Effect.log(`Available trade: ${firstTrade.outputItem.itemType} for ${firstTrade.currentPrice}`)

    // プレイヤーのアイテムを模擬
    const playerItems: ItemStack[] = [
      {
        itemType: firstTrade.inputItems[0].itemType,
        count: firstTrade.inputItems[0].count,
        enchantments: [],
        durability: 100
      }
    ]

    // 取引を実行
    const tradeResult = yield* tradingEngine.executeTrade(
      playerId,
      farmerVillager.villagerId,
      firstTrade.id,
      playerItems
    )

    yield* Effect.log(`Trade successful! Received: ${tradeResult.outputItem.itemType}`)
    yield* Effect.log(`Final price: ${tradeResult.finalPrice}`)
    yield* Effect.log(`Reputation change: ${tradeResult.reputationChange}`)

    // 評判の確認
    const reputation = yield* reputationSystem.getPlayerReputation(playerId, farmerVillager.villagerId)
    yield* Effect.log(`Current reputation with villager: ${reputation}`)
  }

  // 市場の動向更新
  yield* economicSim.updateMarketTrends("village_001", 60000) // 1分経過
  yield* Effect.log("Updated market trends")

  // 価格予測
  const wheatPrediction = yield* economicSim.predictPriceChanges("wheat", 3600) // 1時間後
  yield* Effect.log(`Wheat price prediction: ${wheatPrediction.currentTrend}, confidence: ${wheatPrediction.confidence}`)

  // 村人のレベルアップシミュレーション
  const updatedVillager = yield* tradingEngine.levelUpVillager(
    farmerVillager.villagerId,
    250 as VillagerExperience // 十分な経験値
  )

  yield* Effect.log(`Villager level: ${updatedVillager.level}`)

  // 季節効果の適用
  const seasonalContext = yield* economicSim.applySeasonalEffects("summer", economicContext)
  yield* Effect.log("Applied seasonal effects for summer")

  // 市場イベントの発生
  yield* economicSim.triggerMarketEvent(
    "harvest_festival" as MarketEventType,
    ["crops", "food"],
    7200 // 2時間持続
  )

  yield* Effect.log("Triggered harvest festival market event")

  return tradeResult
})

// 村全体の経済最適化
const optimizeVillageEconomy = Effect.gen(function* () {
  const economicSim = yield* EconomicSimulation

  const optimization = yield* economicSim.optimizeVillageEconomy("village_001")

  yield* Effect.log(`Village economic efficiency: ${optimization.currentEfficiency}`)
  yield* Effect.log(`Recommendations:`)

  optimization.recommendations.forEach((rec, i) => {
    yield* Effect.log(`  ${i + 1}. [${rec.priority}] ${rec.description}`)
  })

  yield* Effect.log(`Projected improvement: ${optimization.projectedImprovement}`)
})
```

## パフォーマンス最適化

### 取引価格キャッシュ

```typescript
// 価格計算のキャッシュ
export const createPriceCache = Effect.gen(function* () {
  const cache = yield* Ref.make<Map<string, CachedPrice>>(new Map())

  return {
    getCachedPrice: (villagerId: string, playerId: string, offerId: string) =>
      Effect.gen(function* () {
        const cacheMap = yield* Ref.get(cache)
        const key = `${villagerId}_${playerId}_${offerId}`
        const cached = cacheMap.get(key)

        if (cached && Date.now() - cached.timestamp < 30000) { // 30秒キャッシュ
          return cached.price
        }

        return null
      }),

    setCachedPrice: (
      villagerId: string,
      playerId: string,
      offerId: string,
      price: TradePrice
    ) => Ref.update(cache, map =>
      map.set(`${villagerId}_${playerId}_${offerId}`, {
        price,
        timestamp: Date.now()
      })
    ),

    clearExpiredEntries: () => Effect.gen(function* () {
      const now = Date.now()
      yield* Ref.update(cache, map => {
        for (const [key, cached] of map) {
          if (now - cached.timestamp > 30000) {
            map.delete(key)
          }
        }
        return map
      })
    })
  }
})
```

### バッチ処理

```typescript
// 村人の一括更新
export const batchUpdateVillagers = (
  villagerIds: ReadonlyArray<string>,
  updateFunction: (villagerId: string) => Effect.Effect<void, never>
) => Effect.gen(function* () {
  const batches = chunkArray(villagerIds, 10) // 10人ずつ処理

  for (const batch of batches) {
    yield* Effect.forEach(
      batch,
      updateFunction,
      { concurrency: 4 }
    )

    // バッチ間で少し待機
    yield* Effect.sleep(10)
  }
})
```

## テスト戦略

```typescript
describe("Villager Trading System", () => {
  const TestTradingLayer = Layer.mergeAll(
    VillagerTradingLayer,
    TestWorldLayer,
    TestTimeSystemLayer
  )

  it("should initialize villager trades correctly", () =>
    Effect.gen(function* () {
      const tradingEngine = yield* TradingEngine

      const testVillager = createTestVillager("farmer", 2 as TradeLevel)
      const testEconomicContext = createTestEconomicContext()

      const offers = yield* tradingEngine.initializeVillagerTrades(
        testVillager,
        testEconomicContext
      )

      expect(offers.length).toBeGreaterThan(0)
      expect(offers[0].tradeLevel).toBe(2)
      expect(offers[0].basePrice).toBeGreaterThan(0)
    }).pipe(
      Effect.provide(TestTradingLayer),
      Effect.runPromise
    ))

  it("should execute trades correctly", () =>
    Effect.gen(function* () {
      const tradingEngine = yield* TradingEngine

      const testVillager = createTestVillager("farmer", 1 as TradeLevel)
      const testEconomicContext = createTestEconomicContext()

      const offers = yield* tradingEngine.initializeVillagerTrades(
        testVillager,
        testEconomicContext
      )

      const playerItems: ItemStack[] = [{
        itemType: "wheat",
        count: 20,
        enchantments: [],
        durability: 100
      }]

      const result = yield* tradingEngine.executeTrade(
        "player_001",
        testVillager.villagerId,
        offers[0].id,
        playerItems
      )

      expect(result.success).toBe(true)
      expect(result.outputItem).toBeDefined()
      expect(result.finalPrice).toBeGreaterThan(0)
    }).pipe(
      Effect.provide(TestTradingLayer),
      Effect.runPromise
    ))

  it("should manage reputation correctly", () =>
    Effect.gen(function* () {
      const reputationSystem = yield* ReputationSystem

      yield* reputationSystem.updatePlayerReputation(
        "player_001",
        "villager_001",
        "successful_trade",
        1
      )

      const reputation = yield* reputationSystem.getPlayerReputation("player_001", "villager_001")
      expect(reputation).toBeGreaterThan(0)

      const effects = yield* reputationSystem.calculateReputationEffects(
        "player_001",
        "villager_001"
      )
      expect(effects.priceModifier).toBeLessThan(1) // 良い評判で割引
    }).pipe(
      Effect.provide(TestTradingLayer),
      Effect.runPromise
    ))

  it("should simulate market dynamics", () =>
    Effect.gen(function* () {
      const economicSim = yield* EconomicSimulation

      const initialContext = createTestEconomicContext()
      const updatedContext = yield* economicSim.updateMarketTrends("test_village", 60000)

      expect(updatedContext.marketTrends.size).toBeGreaterThan(0)

      const prediction = yield* economicSim.predictPriceChanges("wheat", 3600)
      expect(prediction.confidence).toBeGreaterThan(0)
    }).pipe(
      Effect.provide(TestTradingLayer),
      Effect.runPromise
    ))
})
```

このVillager Trading Systemは、Minecraftの世界に複雑で魅力的な経済システムを提供します。Effect-TSの関数型プログラミングパターンを活用することで、一貫性のある取引メカニクスと動的な経済シミュレーションを実現し、プレイヤーに深いゲームプレイ体験を提供します。