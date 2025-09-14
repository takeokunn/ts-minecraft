---
title: "19 Food Agriculture System"
description: "19 Food Agriculture Systemに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: "5分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# Food & Agriculture System（食料・農業システム）

## 概要

Food & Agriculture Systemは、プレイヤーの生存に不可欠な食料の生産、調理、消費を管理するシステムです。Health & Hunger Systemと密接に連携し、サバイバル体験に深みを与えます。

## システム設計

### 1. 農業 (Agriculture)

#### 1.1 作物 (Crops)
- **種類**: 小麦、ニンジン、ジャガイモ、ビートルート、スイカ、カボチャなど
- **成長段階**: 種から収穫可能になるまで複数の成長ステージを持つ (通常8段階)
- **成長条件**:
    - **光源**: 十分な光レベルが必要 (通常9以上)
    - **水**: 耕した土が湿っている必要がある (通常4ブロック以内)
    - **空間**: 作物の上にブロックがないこと

```typescript
import { Context, Effect, Schema, Stream, Random, Match, Brand, pipe } from "effect";

// Branded types for type safety
export type CropId = string & Brand.Brand<"CropId">;
export type GrowthRate = number & Brand.Brand<"GrowthRate">;
export type Nutrition = number & Brand.Brand<"Nutrition">;
export type Fertility = number & Brand.Brand<"Fertility">;
export type LightLevel = number & Brand.Brand<"LightLevel">;

export const CropId = Schema.String.pipe(Schema.brand("CropId"));
export const GrowthRate = Schema.Number.pipe(
  Schema.between(0, 1),
  Schema.brand("GrowthRate")
);
export const Nutrition = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.brand("Nutrition")
);
export const Fertility = Schema.Number.pipe(
  Schema.between(0, 100),
  Schema.brand("Fertility")
);
export const LightLevel = Schema.Number.pipe(
  Schema.between(0, 15),
  Schema.brand("LightLevel")
);

// Growth stages with TaggedUnion
export const GrowthStage = Schema.TaggedUnion("_tag", [
  Schema.Struct({
    _tag: Schema.Literal("seed"),
    plantedAt: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("sprout"),
    plantedAt: Schema.Number,
    sproutedAt: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("growing"),
    plantedAt: Schema.Number,
    sproutedAt: Schema.Number,
    stage: Schema.Number.pipe(Schema.between(0, 6))
  }),
  Schema.Struct({
    _tag: Schema.Literal("mature"),
    plantedAt: Schema.Number,
    maturedAt: Schema.Number,
    yieldCount: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("withered"),
    plantedAt: Schema.Number,
    witheredAt: Schema.Number,
    reason: Schema.String
  })
]);

export type GrowthStage = Schema.Schema.Type<typeof GrowthStage>;

// Crop definition with comprehensive schema
export const Crop = Schema.Struct({
  id: CropId,
  type: Schema.Literal("wheat", "carrot", "potato", "beetroot", "melon", "pumpkin"),
  growthStage: GrowthStage,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  soilQuality: Fertility,
  waterLevel: Schema.Number.pipe(Schema.between(0, 100)),
  lastUpdate: Schema.Number
});

export type Crop = Schema.Schema.Type<typeof Crop>;

// Environmental conditions
export const EnvironmentalCondition = Schema.TaggedUnion("_tag", [
  Schema.Struct({
    _tag: Schema.Literal("optimal"),
    lightLevel: LightLevel,
    waterLevel: Schema.Number,
    temperature: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("drought"),
    lightLevel: LightLevel,
    waterLevel: Schema.Number,
    durationHours: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("flood"),
    lightLevel: LightLevel,
    waterLevel: Schema.Number,
    severity: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("cold"),
    lightLevel: LightLevel,
    temperature: Schema.Number,
    frostRisk: Schema.Boolean
  })
]);

export type EnvironmentalCondition = Schema.Schema.Type<typeof EnvironmentalCondition>;

// Growth simulation with Stream and Effect
export const simulateGrowth = (
  crop: Crop,
  conditions: Stream.Stream<EnvironmentalCondition>
): Effect.Effect<Stream.Stream<Crop>, never, Random.Random> =>
  Effect.gen(function* () {
    const random = yield* Random.Random;

    return pipe(
      conditions,
      Stream.scan(crop, (currentCrop, condition) =>
        pipe(
          calculateGrowthEffect(currentCrop, condition, random),
          Effect.runSync
        )
      )
    );
  });

// Pattern matching for growth calculations
const calculateGrowthEffect = (
  crop: Crop,
  condition: EnvironmentalCondition,
  random: Random.Random
): Effect.Effect<Crop, never> =>
  Effect.gen(function* () {
    const growthRate = yield* pipe(
      Match.value(condition),
      Match.when({ _tag: "optimal" }, (optimal) =>
        Effect.succeed(calculateOptimalGrowthRate(optimal, crop))
      ),
      Match.when({ _tag: "drought" }, (drought) =>
        Effect.succeed(calculateDroughtGrowthRate(drought, crop))
      ),
      Match.when({ _tag: "flood" }, (flood) =>
        Effect.succeed(calculateFloodGrowthRate(flood, crop))
      ),
      Match.when({ _tag: "cold" }, (cold) =>
        Effect.succeed(calculateColdGrowthRate(cold, crop))
      ),
      Match.exhaustive
    );

    const shouldGrow = yield* Random.nextBoolean.pipe(
      Random.filterOrElse((b) => b, () => Random.nextDouble),
      Random.map((chance) => chance < growthRate)
    );

    return shouldGrow ? yield* advanceGrowthStage(crop, random) : crop;
  });

// Growth stage advancement with pattern matching
const advanceGrowthStage = (
  crop: Crop,
  random: Random.Random
): Effect.Effect<Crop, never> =>
  Effect.gen(function* () {
    const currentTime = Date.now();

    return pipe(
      Match.value(crop.growthStage),
      Match.when({ _tag: "seed" }, (stage) =>
        Effect.succeed({
          ...crop,
          growthStage: {
            _tag: "sprout" as const,
            plantedAt: stage.plantedAt,
            sproutedAt: currentTime
          }
        })
      ),
      Match.when({ _tag: "sprout" }, (stage) =>
        Effect.succeed({
          ...crop,
          growthStage: {
            _tag: "growing" as const,
            plantedAt: stage.plantedAt,
            sproutedAt: stage.sproutedAt,
            stage: 0
          }
        })
      ),
      Match.when({ _tag: "growing" }, (stage) => {
        const nextStage = stage.stage + 1;
        return nextStage >= 7
          ? Effect.succeed({
              ...crop,
              growthStage: {
                _tag: "mature" as const,
                plantedAt: stage.plantedAt,
                maturedAt: currentTime,
                yieldCount: yield* Random.nextIntBetween(1, 4)
              }
            })
          : Effect.succeed({
              ...crop,
              growthStage: {
                ...stage,
                stage: nextStage
              }
            });
      }),
      Match.when({ _tag: "mature" }, () => Effect.succeed(crop)),
      Match.when({ _tag: "withered" }, () => Effect.succeed(crop)),
      Match.exhaustive
    );
  });

// Helper functions for growth rate calculations (早期リターン適用)
const calculateOptimalGrowthRate = (
  condition: Extract<EnvironmentalCondition, { _tag: "optimal" }>,
  crop: Crop
): GrowthRate => {
  if (condition.lightLevel < 9) return 0.05 as GrowthRate;
  if (condition.waterLevel < 50) return 0.08 as GrowthRate;

  const fertilityBonus = crop.soilQuality / 100;
  const baseRate = 0.15;

  return Math.min(1, baseRate + fertilityBonus) as GrowthRate;
};

const calculateDroughtGrowthRate = (
  condition: Extract<EnvironmentalCondition, { _tag: "drought" }>,
  crop: Crop
): GrowthRate => {
  if (condition.durationHours > 48) return 0 as GrowthRate;
  if (condition.waterLevel < 20) return 0.02 as GrowthRate;

  const droughtPenalty = condition.durationHours / 100;
  return Math.max(0, 0.05 - droughtPenalty) as GrowthRate;
};

const calculateFloodGrowthRate = (
  condition: Extract<EnvironmentalCondition, { _tag: "flood" }>,
  crop: Crop
): GrowthRate => {
  if (condition.severity > 80) return 0 as GrowthRate;
  if (condition.waterLevel > 90) return 0.01 as GrowthRate;

  return 0.03 as GrowthRate;
};

const calculateColdGrowthRate = (
  condition: Extract<EnvironmentalCondition, { _tag: "cold" }>,
  crop: Crop
): GrowthRate => {
  if (condition.frostRisk) return 0 as GrowthRate;
  if (condition.temperature < 0) return 0.01 as GrowthRate;

  const tempPenalty = Math.max(0, (10 - condition.temperature) / 20);
  return Math.max(0, 0.08 - tempPenalty) as GrowthRate;
};
```

#### 1.2 耕地 (Farmland)
- **状態**: 乾燥または湿潤
- **水源**: 4ブロック以内に水源があれば湿潤状態を維持
- **変化**: プレイヤーがジャンプすると土に戻る

### 2. 畜産 (Animal Husbandry)

#### 2.1 動物 (Animals)
- **種類**: 牛、豚、羊、鶏など
- **繁殖**: 特定のアイテムを与えることで繁殖モードに入る
- **成長**: 子供は時間経過で大人になる
- **ドロップ**: 倒すと肉や革などをドロップ

```typescript
// Branded types for animals
export type AnimalId = string & Brand.Brand<"AnimalId">;
export type Age = number & Brand.Brand<"Age">;
export type BreedingCooldown = number & Brand.Brand<"BreedingCooldown">;

export const AnimalId = Schema.String.pipe(Schema.brand("AnimalId"));
export const Age = Schema.Number.pipe(
  Schema.min(0),
  Schema.brand("Age")
);
export const BreedingCooldown = Schema.Number.pipe(
  Schema.between(0, 6000), // 5分のクールダウン (ticks)
  Schema.brand("BreedingCooldown")
);

// Animal life stages with TaggedUnion
export const AnimalStage = Schema.TaggedUnion("_tag", [
  Schema.Struct({
    _tag: Schema.Literal("baby"),
    bornAt: Schema.Number,
    growthProgress: Schema.Number.pipe(Schema.between(0, 1))
  }),
  Schema.Struct({
    _tag: Schema.Literal("adult"),
    maturedAt: Schema.Number,
    lastBred: Schema.optional(Schema.Number)
  }),
  Schema.Struct({
    _tag: Schema.Literal("elderly"),
    maturedAt: Schema.Number,
    agedAt: Schema.Number,
    reproductionRate: Schema.Number.pipe(Schema.between(0, 1))
  })
]);

export type AnimalStage = Schema.Schema.Type<typeof AnimalStage>;

// Breeding status with pattern matching
export const BreedingStatus = Schema.TaggedUnion("_tag", [
  Schema.Struct({
    _tag: Schema.Literal("ready"),
    lastFed: Schema.Number,
    nutrition: Nutrition
  }),
  Schema.Struct({
    _tag: Schema.Literal("in_love"),
    triggeredAt: Schema.Number,
    remainingTicks: Schema.Number,
    partner: Schema.optional(AnimalId)
  }),
  Schema.Struct({
    _tag: Schema.Literal("cooldown"),
    bredAt: Schema.Number,
    cooldownRemaining: BreedingCooldown
  }),
  Schema.Struct({
    _tag: Schema.Literal("unavailable"),
    reason: Schema.Literal("too_young", "too_old", "sick", "stressed")
  })
]);

export type BreedingStatus = Schema.Schema.Type<typeof BreedingStatus>;

// Animal schema with comprehensive breeding system
export const Animal = Schema.Struct({
  id: AnimalId,
  type: Schema.Literal("cow", "pig", "sheep", "chicken", "rabbit", "horse"),
  stage: AnimalStage,
  breedingStatus: BreedingStatus,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  health: Schema.Number.pipe(Schema.between(0, 20)),
  lastUpdate: Schema.Number
});

export type Animal = Schema.Schema.Type<typeof Animal>;

// Food preferences for breeding
export const AnimalFood = Schema.TaggedUnion("_tag", [
  Schema.Struct({
    _tag: Schema.Literal("wheat"),
    nutritionValue: Nutrition,
    breedingBonus: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("carrot"),
    nutritionValue: Nutrition,
    breedingBonus: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("seeds"),
    nutritionValue: Nutrition,
    breedingBonus: Schema.Number
  })
]);

export type AnimalFood = Schema.Schema.Type<typeof AnimalFood>;

// Breeding operations with Effect
export const feedAnimal = (
  animal: Animal,
  food: AnimalFood
): Effect.Effect<Animal, string, Random.Random> =>
  Effect.gen(function* () {
    // 動物が食べ物を受け付けるかチェック
    const canEat = yield* checkFoodCompatibility(animal, food);
    if (!canEat) {
      return yield* Effect.fail("Animal cannot eat this food");
    }

    // 栄養状態を更新
    const nutritionBoost = calculateNutritionBoost(food);
    const updatedAnimal = updateBreedingStatus(animal, nutritionBoost);

    return updatedAnimal;
  });

export const attemptBreeding = (
  animal1: Animal,
  animal2: Animal
): Effect.Effect<
  { success: true; offspring: Animal } | { success: false; reason: string },
  never,
  Random.Random
> =>
  Effect.gen(function* () {
    // 繁殖可能性をチェック
    const canBreed = yield* checkBreedingCompatibility(animal1, animal2);
    if (!canBreed.success) {
      return { success: false, reason: canBreed.reason };
    }

    // 繁殖成功率を計算
    const breedingChance = calculateBreedingChance(animal1, animal2);
    const shouldBreed = yield* Random.nextDouble.pipe(
      Random.map((chance) => chance < breedingChance)
    );

    if (!shouldBreed) {
      return { success: false, reason: "Breeding attempt failed" };
    }

    // 子供を生成
    const offspring = yield* createOffspring(animal1, animal2);
    return { success: true, offspring };
  });

// Pattern matching for breeding compatibility
const checkBreedingCompatibility = (
  animal1: Animal,
  animal2: Animal
): Effect.Effect<
  { success: true } | { success: false; reason: string },
  never
> =>
  Effect.gen(function* () {
    // 同じ種族かチェック
    if (animal1.type !== animal2.type) {
      return { success: false, reason: "Different species cannot breed" };
    }

    // 年齢と繁殖状態をパターンマッチング
    const compatibility1 = yield* pipe(
      Match.value(animal1.breedingStatus),
      Match.when({ _tag: "ready" }, () => Effect.succeed(true)),
      Match.when({ _tag: "in_love" }, () => Effect.succeed(true)),
      Match.when({ _tag: "cooldown" }, () => Effect.succeed(false)),
      Match.when({ _tag: "unavailable" }, () => Effect.succeed(false)),
      Match.exhaustive
    );

    const compatibility2 = yield* pipe(
      Match.value(animal2.breedingStatus),
      Match.when({ _tag: "ready" }, () => Effect.succeed(true)),
      Match.when({ _tag: "in_love" }, () => Effect.succeed(true)),
      Match.when({ _tag: "cooldown" }, () => Effect.succeed(false)),
      Match.when({ _tag: "unavailable" }, () => Effect.succeed(false)),
      Match.exhaustive
    );

    if (!compatibility1 || !compatibility2) {
      return { success: false, reason: "One or both animals not ready for breeding" };
    }

    return { success: true };
  });

// Create offspring with genetic variation
const createOffspring = (
  parent1: Animal,
  parent2: Animal
): Effect.Effect<Animal, never, Random.Random> =>
  Effect.gen(function* () {
    const offspringId = yield* Random.nextString(8).pipe(
      Random.map((id) => `${parent1.type}_${id}` as AnimalId)
    );

    const currentTime = Date.now();

    return {
      id: offspringId,
      type: parent1.type,
      stage: {
        _tag: "baby" as const,
        bornAt: currentTime,
        growthProgress: 0
      },
      breedingStatus: {
        _tag: "unavailable" as const,
        reason: "too_young" as const
      },
      position: {
        x: parent1.position.x + (yield* Random.nextIntBetween(-2, 2)),
        y: parent1.position.y,
        z: parent1.position.z + (yield* Random.nextIntBetween(-2, 2))
      },
      health: yield* Random.nextIntBetween(18, 20),
      lastUpdate: currentTime
    };
  });

// Animal growth simulation with Stream
export const simulateAnimalGrowth = (
  animal: Animal
): Effect.Effect<Stream.Stream<Animal>, never, Random.Random> =>
  Effect.gen(function* () {
    const currentTime = Date.now();

    return pipe(
      Stream.iterate(animal, (currentAnimal) =>
        pipe(
          advanceAnimalGrowth(currentAnimal, currentTime),
          Effect.runSync
        )
      ),
      Stream.take(100) // 成長サイクル制限
    );
  });

// Growth stage advancement for animals
const advanceAnimalGrowth = (
  animal: Animal,
  currentTime: number
): Effect.Effect<Animal, never, Random.Random> =>
  Effect.gen(function* () {
    return pipe(
      Match.value(animal.stage),
      Match.when({ _tag: "baby" }, (stage) => {
        const growthTime = currentTime - stage.bornAt;
        const newProgress = Math.min(1, stage.growthProgress + 0.01);

        // 20分で成体になる (実際のMinecraftの規則)
        if (growthTime > 1200000 || newProgress >= 1) {
          return Effect.succeed({
            ...animal,
            stage: {
              _tag: "adult" as const,
              maturedAt: currentTime,
              lastBred: undefined
            },
            breedingStatus: {
              _tag: "ready" as const,
              lastFed: 0,
              nutrition: 10 as Nutrition
            }
          });
        }

        return Effect.succeed({
          ...animal,
          stage: {
            ...stage,
            growthProgress: newProgress
          }
        });
      }),
      Match.when({ _tag: "adult" }, () => {
        // 成体は老化プロセスを開始する可能性
        const ageingShouldStart = yield* Random.nextDouble.pipe(
          Random.map((chance) => chance < 0.001) // 0.1%の確率で老化開始
        );

        return ageingShouldStart
          ? Effect.succeed({
              ...animal,
              stage: {
                _tag: "elderly" as const,
                maturedAt: animal.stage.maturedAt,
                agedAt: currentTime,
                reproductionRate: 0.8
              }
            })
          : Effect.succeed(animal);
      }),
      Match.when({ _tag: "elderly" }, () => Effect.succeed(animal)),
      Match.exhaustive
    );
  });

// Helper functions for breeding calculations
const checkFoodCompatibility = (
  animal: Animal,
  food: AnimalFood
): Effect.Effect<boolean, never> => {
  const compatibilityMap: Record<Animal["type"], AnimalFood["_tag"][]> = {
    cow: ["wheat"],
    pig: ["carrot", "wheat"],
    sheep: ["wheat"],
    chicken: ["seeds", "wheat"],
    rabbit: ["carrot"],
    horse: ["wheat", "carrot"]
  };

  return Effect.succeed(
    compatibilityMap[animal.type]?.includes(food._tag) ?? false
  );
};

const calculateNutritionBoost = (food: AnimalFood): Nutrition =>
  food.nutritionValue + (food.breedingBonus as Nutrition);

const updateBreedingStatus = (
  animal: Animal,
  nutritionBoost: Nutrition
): Animal => {
  const currentTime = Date.now();

  return pipe(
    Match.value(animal.breedingStatus),
    Match.when({ _tag: "ready" }, (status) => ({
      ...animal,
      breedingStatus: {
        _tag: "in_love" as const,
        triggeredAt: currentTime,
        remainingTicks: 600, // 30秒
        partner: undefined
      }
    })),
    Match.orElse(() => animal)
  );
};

const calculateBreedingChance = (
  animal1: Animal,
  animal2: Animal
): number => {
  // 基本成功率
  let baseChance = 0.8;

  // 年齢による補正
  const age1Modifier = pipe(
    Match.value(animal1.stage),
    Match.when({ _tag: "baby" }, () => 0),
    Match.when({ _tag: "adult" }, () => 1),
    Match.when({ _tag: "elderly" }, (stage) => stage.reproductionRate),
    Match.exhaustive
  );

  const age2Modifier = pipe(
    Match.value(animal2.stage),
    Match.when({ _tag: "baby" }, () => 0),
    Match.when({ _tag: "adult" }, () => 1),
    Match.when({ _tag: "elderly" }, (stage) => stage.reproductionRate),
    Match.exhaustive
  );

  return baseChance * age1Modifier * age2Modifier;
};
```

### 3. 食料 (Food)

#### 3.1 調理 (Cooking)
- **かまど**: 生肉やジャガイモを焼く
- **燻製器**: 肉類を高速で焼く
- **溶鉱炉**: 鉱石専用 (調理不可)

#### 3.2 食料アイテム
- **回復量**: 飢餓ゲージの回復ポイント
- **飽和度**: 隠し飢餓ゲージの回復量
- **特殊効果**: 金リンゴなどのバフ効果

```typescript
// Branded types for food system
export type FoodId = string & Brand.Brand<"FoodId">;
export type HungerRestore = number & Brand.Brand<"HungerRestore">;
export type SaturationModifier = number & Brand.Brand<"SaturationModifier">;
export type CookingTime = number & Brand.Brand<"CookingTime">;

export const FoodId = Schema.String.pipe(Schema.brand("FoodId"));
export const HungerRestore = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.brand("HungerRestore")
);
export const SaturationModifier = Schema.Number.pipe(
  Schema.between(0, 2),
  Schema.brand("SaturationModifier")
);
export const CookingTime = Schema.Number.pipe(
  Schema.between(0, 600), // 最大30秒
  Schema.brand("CookingTime")
);

// Food states with TaggedUnion
export const FoodState = Schema.TaggedUnion("_tag", [
  Schema.Struct({
    _tag: Schema.Literal("raw"),
    freshness: Schema.Number.pipe(Schema.between(0, 1)),
    harvestedAt: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("cooked"),
    cookedAt: Schema.Number,
    cookingMethod: Schema.Literal("furnace", "smoker", "campfire"),
    doneness: Schema.Number.pipe(Schema.between(0, 1))
  }),
  Schema.Struct({
    _tag: Schema.Literal("spoiled"),
    spoiledAt: Schema.Number,
    cause: Schema.Literal("time", "temperature", "contamination")
  }),
  Schema.Struct({
    _tag: Schema.Literal("processed"),
    processedAt: Schema.Number,
    method: Schema.Literal("crafted", "brewed", "fermented"),
    quality: Schema.Number.pipe(Schema.between(0, 1))
  })
]);

export type FoodState = Schema.Schema.Type<typeof FoodState>;

// Potion effects for food
export const PotionEffect = Schema.Struct({
  type: Schema.Literal("regeneration", "absorption", "resistance", "fire_resistance", "night_vision"),
  amplifier: Schema.Number.pipe(Schema.between(0, 255)),
  duration: Schema.Number.pipe(Schema.between(0, 32767)),
  ambient: Schema.Boolean,
  showParticles: Schema.Boolean
});

export type PotionEffect = Schema.Schema.Type<typeof PotionEffect>;

// Comprehensive food item schema
export const FoodItem = Schema.Struct({
  id: FoodId,
  name: Schema.String,
  type: Schema.Literal("meat", "vegetable", "fruit", "grain", "dairy", "special"),
  state: FoodState,
  nutrition: Schema.Struct({
    hungerRestore: HungerRestore,
    saturationModifier: SaturationModifier,
    vitamins: Schema.Record(Schema.String, Schema.Number),
    calories: Schema.Number
  }),
  effects: Schema.optional(Schema.Array(PotionEffect)),
  stackSize: Schema.Number.pipe(Schema.between(1, 64)),
  cookingTime: Schema.optional(CookingTime)
});

export type FoodItem = Schema.Schema.Type<typeof FoodItem>;

// Cooking operations with Effect
export const cookFood = (
  rawFood: FoodItem,
  cookingMethod: FoodState extends { _tag: "cooked" } ? FoodState["cookingMethod"] : never
): Effect.Effect<FoodItem, string, Random.Random> =>
  Effect.gen(function* () {
    // 生の食材かチェック
    if (rawFood.state._tag !== "raw") {
      return yield* Effect.fail("Food is not in raw state");
    }

    // 調理可能かチェック
    if (!rawFood.cookingTime) {
      return yield* Effect.fail("This food cannot be cooked");
    }

    // 調理による栄養値変化を計算
    const nutritionBonus = calculateCookingBonus(rawFood, cookingMethod);
    const cookedNutrition = applyNutritionBonus(rawFood.nutrition, nutritionBonus);

    // 調理の完成度をランダムに決定
    const doneness = yield* Random.nextDouble;

    const cookedFood: FoodItem = {
      ...rawFood,
      state: {
        _tag: "cooked",
        cookedAt: Date.now(),
        cookingMethod,
        doneness
      },
      nutrition: cookedNutrition
    };

    return cookedFood;
  });

// Soil quality system with branded types
export type SoilPh = number & Brand.Brand<"SoilPh">;
export type OrganicMatter = number & Brand.Brand<"OrganicMatter">;
export type WaterRetention = number & Brand.Brand<"WaterRetention">;

export const SoilPh = Schema.Number.pipe(
  Schema.between(0, 14),
  Schema.brand("SoilPh")
);
export const OrganicMatter = Schema.Number.pipe(
  Schema.between(0, 100),
  Schema.brand("OrganicMatter")
);
export const WaterRetention = Schema.Number.pipe(
  Schema.between(0, 100),
  Schema.brand("WaterRetention")
);

// Soil composition with comprehensive analysis
export const SoilQuality = Schema.Struct({
  fertility: Fertility,
  ph: SoilPh,
  organicMatter: OrganicMatter,
  waterRetention: WaterRetention,
  nutrients: Schema.Struct({
    nitrogen: Schema.Number.pipe(Schema.between(0, 100)),
    phosphorus: Schema.Number.pipe(Schema.between(0, 100)),
    potassium: Schema.Number.pipe(Schema.between(0, 100))
  }),
  microorganisms: Schema.Number.pipe(Schema.between(0, 100)),
  lastTested: Schema.Number
});

export type SoilQuality = Schema.Schema.Type<typeof SoilQuality>;

// Weather effects with pattern matching
export const WeatherEffect = Schema.TaggedUnion("_tag", [
  Schema.Struct({
    _tag: Schema.Literal("sunny"),
    intensity: Schema.Number.pipe(Schema.between(0, 1)),
    temperature: Schema.Number,
    uvIndex: Schema.Number.pipe(Schema.between(0, 11))
  }),
  Schema.Struct({
    _tag: Schema.Literal("rainy"),
    intensity: Schema.Number.pipe(Schema.between(0, 1)),
    duration: Schema.Number,
    soilMoisture: Schema.Number.pipe(Schema.between(0, 100))
  }),
  Schema.Struct({
    _tag: Schema.Literal("stormy"),
    windSpeed: Schema.Number,
    lightningRisk: Schema.Boolean,
    floodRisk: Schema.Boolean,
    cropDamage: Schema.Number.pipe(Schema.between(0, 1))
  }),
  Schema.Struct({
    _tag: Schema.Literal("drought"),
    severity: Schema.Number.pipe(Schema.between(0, 1)),
    daysWithoutRain: Schema.Number,
    soilCracking: Schema.Boolean
  })
]);

export type WeatherEffect = Schema.Schema.Type<typeof WeatherEffect>;

// Irrigation system with branded types
export type WaterPressure = number & Brand.Brand<"WaterPressure">;
export type FlowRate = number & Brand.Brand<"FlowRate">;

export const WaterPressure = Schema.Number.pipe(
  Schema.between(0, 100),
  Schema.brand("WaterPressure")
);
export const FlowRate = Schema.Number.pipe(
  Schema.between(0, 1000),
  Schema.brand("FlowRate")
);

export const IrrigationSystem = Schema.TaggedUnion("_tag", [
  Schema.Struct({
    _tag: Schema.Literal("sprinkler"),
    coverage: Schema.Number.pipe(Schema.between(1, 100)),
    waterPressure: WaterPressure,
    efficiency: Schema.Number.pipe(Schema.between(0, 1))
  }),
  Schema.Struct({
    _tag: Schema.Literal("drip"),
    flowRate: FlowRate,
    precision: Schema.Number.pipe(Schema.between(0, 1)),
    waterSaved: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("flood"),
    waterLevel: Schema.Number,
    drainageTime: Schema.Number,
    coverage: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("manual"),
    frequency: Schema.Number,
    amount: Schema.Number,
    laborIntensive: Schema.Boolean
  })
]);

export type IrrigationSystem = Schema.Schema.Type<typeof IrrigationSystem>;

// Crop rotation benefits system
export const CropRotation = Schema.Struct({
  previousCrop: Schema.optional(Schema.String),
  currentCrop: Schema.String,
  nextPlannedCrop: Schema.optional(Schema.String),
  rotationCycle: Schema.Number.pipe(Schema.between(2, 7)),
  seasonsSinceRotation: Schema.Number,
  benefitsActive: Schema.Boolean,
  soilRecovery: Schema.Number.pipe(Schema.between(0, 1))
});

export type CropRotation = Schema.Schema.Type<typeof CropRotation>;

// Seasonal growing cycles
export const Season = Schema.TaggedUnion("_tag", [
  Schema.Struct({
    _tag: Schema.Literal("spring"),
    temperature: Schema.Number,
    rainfall: Schema.Number,
    growthBonus: Schema.Number.pipe(Schema.between(0, 2))
  }),
  Schema.Struct({
    _tag: Schema.Literal("summer"),
    temperature: Schema.Number,
    rainfall: Schema.Number,
    heatStress: Schema.Boolean,
    droughtRisk: Schema.Boolean
  }),
  Schema.Struct({
    _tag: Schema.Literal("autumn"),
    temperature: Schema.Number,
    harvestBonus: Schema.Number.pipe(Schema.between(0, 2)),
    storageTime: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("winter"),
    temperature: Schema.Number,
    frostDays: Schema.Number,
    growthPenalty: Schema.Number.pipe(Schema.between(0, 1))
  })
]);

export type Season = Schema.Schema.Type<typeof Season>;

// Advanced farming operations with Effect
export const calculateSoilFertility = (
  soilQuality: SoilQuality,
  weather: WeatherEffect,
  irrigation: Schema.Schema.Type<typeof IrrigationSystem>
): Effect.Effect<Fertility, never> =>
  Effect.gen(function* () {
    let baseFertility = soilQuality.fertility;

    // 土壌品質による補正
    const phBonus = calculatePhBonus(soilQuality.ph);
    const organicBonus = soilQuality.organicMatter / 100;
    const nutrientBonus = (soilQuality.nutrients.nitrogen +
                          soilQuality.nutrients.phosphorus +
                          soilQuality.nutrients.potassium) / 300;

    // 天候による補正
    const weatherModifier = yield* pipe(
      Match.value(weather),
      Match.when({ _tag: "sunny" }, (sunny) =>
        Effect.succeed(1 + (sunny.intensity * 0.2))
      ),
      Match.when({ _tag: "rainy" }, (rainy) =>
        Effect.succeed(1 + (rainy.soilMoisture / 100 * 0.3))
      ),
      Match.when({ _tag: "stormy" }, (stormy) =>
        Effect.succeed(Math.max(0, 1 - stormy.cropDamage))
      ),
      Match.when({ _tag: "drought" }, (drought) =>
        Effect.succeed(Math.max(0.1, 1 - drought.severity))
      ),
      Match.exhaustive
    );

    // 灌漑システムによる補正
    const irrigationBonus = yield* pipe(
      Match.value(irrigation),
      Match.when({ _tag: "sprinkler" }, (sprinkler) =>
        Effect.succeed(sprinkler.efficiency * 0.4)
      ),
      Match.when({ _tag: "drip" }, (drip) =>
        Effect.succeed(drip.precision * 0.5)
      ),
      Match.when({ _tag: "flood" }, () => Effect.succeed(0.2)),
      Match.when({ _tag: "manual" }, (manual) =>
        Effect.succeed(manual.laborIntensive ? 0.3 : 0.1)
      ),
      Match.exhaustive
    );

    const finalFertility = Math.min(100,
      baseFertility * (1 + phBonus + organicBonus + nutrientBonus) *
      weatherModifier * (1 + irrigationBonus)
    );

    return finalFertility as Fertility;
  });

export const applyCropRotation = (
  crop: Crop,
  rotation: CropRotation,
  season: Season
): Effect.Effect<Crop, never> =>
  Effect.gen(function* () {
    if (!rotation.benefitsActive) return crop;

    // 輪作による土壌回復効果
    const recoveryBonus = rotation.soilRecovery * 20;
    const improvedSoilQuality = Math.min(100,
      crop.soilQuality + recoveryBonus
    ) as Fertility;

    // 季節による成長補正
    const seasonalBonus = yield* pipe(
      Match.value(season),
      Match.when({ _tag: "spring" }, (spring) =>
        Effect.succeed(spring.growthBonus)
      ),
      Match.when({ _tag: "summer" }, (summer) =>
        Effect.succeed(summer.heatStress ? 0.8 : 1.2)
      ),
      Match.when({ _tag: "autumn" }, (autumn) =>
        Effect.succeed(1 + autumn.harvestBonus * 0.5)
      ),
      Match.when({ _tag: "winter" }, (winter) =>
        Effect.succeed(Math.max(0.1, 1 - winter.growthPenalty))
      ),
      Match.exhaustive
    );

    return {
      ...crop,
      soilQuality: improvedSoilQuality,
      waterLevel: Math.min(100, crop.waterLevel * seasonalBonus)
    };
  });

// Harvest yield calculations with random variations
export const calculateHarvestYield = (
  crop: Crop,
  weather: WeatherEffect,
  soilQuality: SoilQuality
): Effect.Effect<number, never, Random.Random> =>
  Effect.gen(function* () {
    if (crop.growthStage._tag !== "mature") return 0;

    let baseYield = crop.growthStage.yieldCount;

    // 土壌品質による補正
    const soilBonus = soilQuality.fertility / 100;
    const organicBonus = soilQuality.organicMatter / 200;

    // 天候による補正
    const weatherMultiplier = yield* pipe(
      Match.value(weather),
      Match.when({ _tag: "sunny" }, () => Effect.succeed(1.2)),
      Match.when({ _tag: "rainy" }, () => Effect.succeed(1.1)),
      Match.when({ _tag: "stormy" }, (stormy) =>
        Effect.succeed(Math.max(0.3, 1 - stormy.cropDamage))
      ),
      Match.when({ _tag: "drought" }, (drought) =>
        Effect.succeed(Math.max(0.2, 1 - drought.severity * 0.8))
      ),
      Match.exhaustive
    );

    // ランダム変動
    const randomVariation = yield* Random.nextDouble.pipe(
      Random.map((r) => 0.8 + r * 0.4) // 80%~120%の範囲
    );

    const finalYield = Math.floor(
      baseYield * (1 + soilBonus + organicBonus) *
      weatherMultiplier * randomVariation
    );

    return Math.max(1, finalYield);
  });

// Helper functions for calculations (早期リターン適用)
const calculatePhBonus = (ph: SoilPh): number => {
  if (ph < 5.5) return -0.3; // 酸性すぎる
  if (ph < 6.0) return -0.1;
  if (ph > 8.0) return -0.2; // アルカリ性すぎる
  if (ph > 7.5) return -0.05;

  return 0.1; // 最適な pH 範囲 (6.0-7.5)
};

const calculateCookingBonus = (
  food: FoodItem,
  method: FoodState extends { _tag: "cooked" } ? FoodState["cookingMethod"] : never
): { hungerBonus: number; saturationBonus: number } => {
  const methodBonuses = {
    furnace: { hungerBonus: 1, saturationBonus: 1 },
    smoker: { hungerBonus: 1.2, saturationBonus: 1.1 },
    campfire: { hungerBonus: 1.1, saturationBonus: 1.3 }
  };

  return methodBonuses[method] || { hungerBonus: 1, saturationBonus: 1 };
};

const applyNutritionBonus = (
  nutrition: FoodItem["nutrition"],
  bonus: { hungerBonus: number; saturationBonus: number }
): FoodItem["nutrition"] => ({
  ...nutrition,
  hungerRestore: Math.min(20,
    nutrition.hungerRestore * bonus.hungerBonus
  ) as HungerRestore,
  saturationModifier: Math.min(2,
    nutrition.saturationModifier * bonus.saturationBonus
  ) as SaturationModifier
});
```

## UI統合

- **インベントリ**: 食料アイテムのツールチップに回復量を表示
- **かまどUI**: 調理の進捗状況を表示
- **HUD**: 食料を食べた際の飢餓ゲージ回復をアニメーション表示

## パフォーマンス

- **ランダムティック**: 作物の成長判定はランダムティックで行い、全作物を毎フレームチェックするのを避ける
- **動物AI**: 遠くの動物のAIは簡略化する (LOD)

## テストケース

### Property-Based Testing パターン

```typescript
import { fc } from "fast-check";
import { Effect, Schema, TestServices } from "effect";
import { describe, it, expect } from "vitest";

// Property-Based Testing用のArbitrary生成
const cropIdArbitrary = fc.string({ minLength: 5, maxLength: 10 })
  .map(id => Schema.decodeUnknownSync(CropId)(`crop_${id}`));

const fertilityArbitrary = fc.integer({ min: 0, max: 100 })
  .map(f => Schema.decodeUnknownSync(Fertility)(f));

const growthRateArbitrary = fc.double({ min: 0, max: 1 })
  .map(gr => Schema.decodeUnknownSync(GrowthRate)(gr));

const cropArbitrary = fc.record({
  id: cropIdArbitrary,
  type: fc.constantFrom("wheat", "carrot", "potato", "beetroot", "melon", "pumpkin"),
  growthStage: fc.oneof(
    fc.record({
      _tag: fc.constant("seed"),
      plantedAt: fc.integer({ min: 0, max: Date.now() })
    }),
    fc.record({
      _tag: fc.constant("mature"),
      plantedAt: fc.integer({ min: 0, max: Date.now() }),
      maturedAt: fc.integer({ min: 0, max: Date.now() }),
      yieldCount: fc.integer({ min: 1, max: 8 })
    })
  ),
  position: fc.record({
    x: fc.integer({ min: -1000, max: 1000 }),
    y: fc.integer({ min: 0, max: 256 }),
    z: fc.integer({ min: -1000, max: 1000 })
  }),
  soilQuality: fertilityArbitrary,
  waterLevel: fc.integer({ min: 0, max: 100 }),
  lastUpdate: fc.integer({ min: 0, max: Date.now() })
});

const environmentalConditionArbitrary = fc.oneof(
  fc.record({
    _tag: fc.constant("optimal"),
    lightLevel: fc.integer({ min: 9, max: 15 }).map(l => l as LightLevel),
    waterLevel: fc.integer({ min: 50, max: 100 }),
    temperature: fc.integer({ min: 15, max: 30 })
  }),
  fc.record({
    _tag: fc.constant("drought"),
    lightLevel: fc.integer({ min: 9, max: 15 }).map(l => l as LightLevel),
    waterLevel: fc.integer({ min: 0, max: 30 }),
    durationHours: fc.integer({ min: 0, max: 72 })
  })
);

const soilQualityArbitrary = fc.record({
  fertility: fertilityArbitrary,
  ph: fc.double({ min: 4, max: 9 }).map(ph => ph as SoilPh),
  organicMatter: fc.integer({ min: 0, max: 100 }).map(om => om as OrganicMatter),
  waterRetention: fc.integer({ min: 0, max: 100 }).map(wr => wr as WaterRetention),
  nutrients: fc.record({
    nitrogen: fc.integer({ min: 0, max: 100 }),
    phosphorus: fc.integer({ min: 0, max: 100 }),
    potassium: fc.integer({ min: 0, max: 100 })
  }),
  microorganisms: fc.integer({ min: 0, max: 100 }),
  lastTested: fc.integer({ min: 0, max: Date.now() })
});

describe("Agriculture System Property-Based Tests", () => {
  it("作物の成長率は0と1の間に収まる", () => {
    fc.assert(fc.property(
      cropArbitrary,
      environmentalConditionArbitrary,
      (crop, condition) => {
        const program = pipe(
          calculateGrowthEffect(crop, condition, TestServices.TestRandom),
          Effect.provide(TestServices.TestRandom.deterministic)
        );

        const result = Effect.runSync(program);
        const growthRate = result.growthStage;

        // 成長段階が適切に進んでいることを検証
        expect(growthRate).toBeDefined();
        return true;
      }
    ));
  });

  it("土壌肥沃度の計算結果は常に有効な範囲内", () => {
    fc.assert(fc.property(
      soilQualityArbitrary,
      environmentalConditionArbitrary,
      fc.oneof(
        fc.record({
          _tag: fc.constant("sprinkler"),
          coverage: fc.integer({ min: 1, max: 100 }),
          waterPressure: fc.integer({ min: 0, max: 100 }).map(wp => wp as WaterPressure),
          efficiency: fc.double({ min: 0, max: 1 })
        }),
        fc.record({
          _tag: fc.constant("manual"),
          frequency: fc.integer({ min: 1, max: 10 }),
          amount: fc.integer({ min: 10, max: 100 }),
          laborIntensive: fc.boolean()
        })
      ),
      (soil, weather, irrigation) => {
        const program = pipe(
          calculateSoilFertility(soil, weather, irrigation),
          Effect.provide(TestServices.TestRandom.deterministic)
        );

        const fertility = Effect.runSync(program);

        expect(fertility).toBeGreaterThanOrEqual(0);
        expect(fertility).toBeLessThanOrEqual(100);
        return true;
      }
    ));
  });

  it("収穫量は常に正の整数", () => {
    fc.assert(fc.property(
      cropArbitrary.filter(crop => crop.growthStage._tag === "mature"),
      environmentalConditionArbitrary,
      soilQualityArbitrary,
      (crop, weather, soil) => {
        const program = pipe(
          calculateHarvestYield(crop, weather, soil),
          Effect.provide(TestServices.TestRandom.deterministic)
        );

        const yield_ = Effect.runSync(program);

        expect(yield_).toBeGreaterThan(0);
        expect(Number.isInteger(yield_)).toBe(true);
        return true;
      }
    ));
  });

  it("動物の繁殖は同じ種族間でのみ成功する", () => {
    const animalArbitrary = fc.record({
      id: fc.string().map(id => `animal_${id}` as AnimalId),
      type: fc.constantFrom("cow", "pig", "sheep", "chicken", "rabbit", "horse"),
      stage: fc.record({
        _tag: fc.constant("adult"),
        maturedAt: fc.integer({ min: 0, max: Date.now() }),
        lastBred: fc.option(fc.integer({ min: 0, max: Date.now() }))
      }),
      breedingStatus: fc.record({
        _tag: fc.constant("ready"),
        lastFed: fc.integer({ min: 0, max: Date.now() }),
        nutrition: fc.integer({ min: 5, max: 20 }).map(n => n as Nutrition)
      }),
      position: fc.record({
        x: fc.integer({ min: -100, max: 100 }),
        y: fc.integer({ min: 60, max: 70 }),
        z: fc.integer({ min: -100, max: 100 })
      }),
      health: fc.integer({ min: 15, max: 20 }),
      lastUpdate: fc.integer({ min: 0, max: Date.now() })
    });

    fc.assert(fc.property(
      animalArbitrary,
      animalArbitrary,
      (animal1, animal2) => {
        const program = pipe(
          attemptBreeding(animal1, animal2),
          Effect.provide(TestServices.TestRandom.deterministic)
        );

        const result = Effect.runSync(program);

        if (animal1.type === animal2.type) {
          // 同じ種族の場合、繁殖が成功する可能性がある
          expect(result.success).toBeDefined();
        } else {
          // 異なる種族の場合、必ず失敗する
          expect(result.success).toBe(false);
          expect(result.reason).toContain("Different species");
        }

        return true;
      }
    ));
  });

  it("調理によって食料の栄養価が向上する", () => {
    const rawFoodArbitrary = fc.record({
      id: fc.string().map(id => `food_${id}` as FoodId),
      name: fc.string({ minLength: 3, maxLength: 10 }),
      type: fc.constantFrom("meat", "vegetable"),
      state: fc.record({
        _tag: fc.constant("raw"),
        freshness: fc.double({ min: 0.5, max: 1 }),
        harvestedAt: fc.integer({ min: 0, max: Date.now() })
      }),
      nutrition: fc.record({
        hungerRestore: fc.integer({ min: 1, max: 6 }).map(hr => hr as HungerRestore),
        saturationModifier: fc.double({ min: 0.1, max: 0.8 }).map(sm => sm as SaturationModifier),
        vitamins: fc.dictionary(fc.string(), fc.integer({ min: 0, max: 100 })),
        calories: fc.integer({ min: 50, max: 300 })
      }),
      effects: fc.option(fc.array(fc.record({
        type: fc.constantFrom("regeneration", "absorption"),
        amplifier: fc.integer({ min: 0, max: 2 }),
        duration: fc.integer({ min: 100, max: 1200 }),
        ambient: fc.boolean(),
        showParticles: fc.boolean()
      }))),
      stackSize: fc.integer({ min: 1, max: 64 }),
      cookingTime: fc.option(fc.integer({ min: 100, max: 600 }).map(ct => ct as CookingTime))
    }).filter(food => food.cookingTime !== undefined);

    fc.assert(fc.property(
      rawFoodArbitrary,
      fc.constantFrom("furnace", "smoker", "campfire"),
      (rawFood, cookingMethod) => {
        const program = pipe(
          cookFood(rawFood, cookingMethod),
          Effect.provide(TestServices.TestRandom.deterministic)
        );

        const cookedFood = Effect.runSync(program);

        // 調理後の栄養価が生の状態以上になることを検証
        expect(cookedFood.nutrition.hungerRestore)
          .toBeGreaterThanOrEqual(rawFood.nutrition.hungerRestore);
        expect(cookedFood.state._tag).toBe("cooked");

        return true;
      }
    ));
  });

  it("作物の輪作により土壌品質が改善される", () => {
    const cropRotationArbitrary = fc.record({
      previousCrop: fc.option(fc.string()),
      currentCrop: fc.string(),
      nextPlannedCrop: fc.option(fc.string()),
      rotationCycle: fc.integer({ min: 2, max: 7 }),
      seasonsSinceRotation: fc.integer({ min: 0, max: 10 }),
      benefitsActive: fc.boolean(),
      soilRecovery: fc.double({ min: 0, max: 1 })
    });

    const seasonArbitrary = fc.oneof(
      fc.record({
        _tag: fc.constant("spring"),
        temperature: fc.integer({ min: 10, max: 20 }),
        rainfall: fc.integer({ min: 30, max: 80 }),
        growthBonus: fc.double({ min: 1, max: 2 })
      }),
      fc.record({
        _tag: fc.constant("summer"),
        temperature: fc.integer({ min: 20, max: 35 }),
        rainfall: fc.integer({ min: 10, max: 50 }),
        heatStress: fc.boolean(),
        droughtRisk: fc.boolean()
      })
    );

    fc.assert(fc.property(
      cropArbitrary,
      cropRotationArbitrary.filter(r => r.benefitsActive),
      seasonArbitrary,
      (crop, rotation, season) => {
        const originalSoilQuality = crop.soilQuality;

        const program = pipe(
          applyCropRotation(crop, rotation, season),
          Effect.provide(TestServices.TestRandom.deterministic)
        );

        const improvedCrop = Effect.runSync(program);

        // 輪作によって土壌品質が改善されることを検証
        expect(improvedCrop.soilQuality)
          .toBeGreaterThanOrEqual(originalSoilQuality);

        return true;
      }
    ));
  });
});

// Integration Tests
describe("Agriculture System Integration Tests", () => {
  it("完全な農業サイクル統合テスト", async () => {
    const program = Effect.gen(function* () {
      // 初期作物の作成
      const seedCrop = yield* Effect.succeed({
        id: "test_wheat" as CropId,
        type: "wheat" as const,
        growthStage: {
          _tag: "seed" as const,
          plantedAt: Date.now()
        },
        position: { x: 0, y: 64, z: 0 },
        soilQuality: 60 as Fertility,
        waterLevel: 80,
        lastUpdate: Date.now()
      });

      // 環境条件の設定
      const optimalCondition: EnvironmentalCondition = {
        _tag: "optimal",
        lightLevel: 15 as LightLevel,
        waterLevel: 90,
        temperature: 22
      };

      // 土壌品質の設定
      const soilQuality: SoilQuality = {
        fertility: 70 as Fertility,
        ph: 6.5 as SoilPh,
        organicMatter: 45 as OrganicMatter,
        waterRetention: 65 as WaterRetention,
        nutrients: { nitrogen: 80, phosphorus: 70, potassium: 75 },
        microorganisms: 60,
        lastTested: Date.now()
      };

      // 灌漑システム
      const irrigation: IrrigationSystem = {
        _tag: "drip",
        flowRate: 150 as FlowRate,
        precision: 0.9,
        waterSaved: 30
      };

      // 成長シミュレーション
      const grownCrop = yield* calculateGrowthEffect(
        seedCrop,
        optimalCondition,
        yield* Random.Random
      );

      // 土壌肥沃度の計算
      const improvedFertility = yield* calculateSoilFertility(
        soilQuality,
        optimalCondition,
        irrigation
      );

      // 結果検証
      expect(improvedFertility).toBeGreaterThan(soilQuality.fertility);
      expect(grownCrop).toBeDefined();

      return { grownCrop, improvedFertility };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestServices.TestRandom.deterministic))
    );

    expect(result.grownCrop).toBeDefined();
    expect(result.improvedFertility).toBeGreaterThan(0);
  });
});
```

### 従来のUnit Test用テストケース

- [ ] 作物が適切な条件下で成長すること
  - [ ] 光源レベル9以上で成長率が向上する
  - [ ] 水源4ブロック以内で湿潤状態を維持する
  - [ ] Bone Mealで成長が加速される

- [ ] 動物が特定の食料で繁殖すること
  - [ ] 牛が小麦で繁殖モードに入る
  - [ ] 豚がニンジンまたは小麦で繁殖する
  - [ ] 異なる種族間では繁殖できない

- [ ] かまどで生肉が焼けること
  - [ ] 燻製器で肉類の調理が高速化される
  - [ ] キャンプファイアで調理に風味ボーナス

- [ ] 食料を食べると飢餓ゲージが回復すること
  - [ ] 調理済み食品は生より高い栄養価を持つ
  - [ ] 飽和度が隠し飢餓ゲージに影響する

- [ ] 土壌品質システムが正常に機能すること
  - [ ] pH値が6.0-7.5で最適な成長環境
  - [ ] 有機物質含有量が成長率に影響する
  - [ ] NPK肥料バランスが収穫量に反映される

- [ ] 天候効果が作物成長に正しく影響すること
  - [ ] 晴天で光合成ボーナス
  - [ ] 雨天で土壌水分向上
  - [ ] 嵐で作物ダメージ発生
  - [ ] 干ばつで成長阻害

- [ ] 灌漑システムが効率的に動作すること
  - [ ] スプリンクラーの範囲内で均等散水
  - [ ] ドリップ灌漑で水使用量削減
  - [ ] 手動散水で労働集約度向上

- [ ] 作物輪作システムが土壌を改善すること
  - [ ] 連作障害を回避する
  - [ ] 土壌回復率が正しく計算される
  - [ ] 季節サイクルが成長に影響する
