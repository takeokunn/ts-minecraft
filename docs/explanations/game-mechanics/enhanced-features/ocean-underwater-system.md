---
title: '11 Ocean Underwater System'
description: '11 Ocean Underwater Systemに関する詳細な説明とガイド。'
category: 'specification'
difficulty: 'intermediate'
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: '15分'
---

# Ocean & Underwater System（海洋・水中システム）設計書

## 1. 概要

Ocean & Underwater Systemは、Minecraftの海洋環境と水中探索体験を実現するシステムです。多様な海洋バイオーム、複雑な水中物理、豊富な海洋生物、そして海洋探索の楽しさを提供します。

### 主要機能

- 海洋バイオーム生成（深海・暖海・冷海・珊瑚礁）
- 水中探索メカニズム（呼吸・視界・移動制限）
- 海洋構造物（海底遺跡・沈没船・海底神殿）
- 海洋生物エコシステム（魚群・イカ・ガーディアン）
- 流体物理シミュレーション（海流・潮汐・水圧）
- 水中建築とアイテム特性
- 潜水装備とエンチャント
- 海洋探索報酬システム

### 技術仕様

- Effect-TS 3.17+ パターン適用
- Schema-based型安全性保証
- 関数型プログラミング設計
- 高性能流体シミュレーション
- リアルタイム海洋レンダリング

## 2. アーキテクチャ設計

### 2.1 Domain Layer

#### 海洋データ構造

```typescript
// 海洋バイオーム定義
const OceanBiomeType = Schema.Literal('deep_ocean', 'warm_ocean', 'cold_ocean', 'coral_reef', 'frozen_ocean')
type OceanBiomeType = Schema.Schema.Type<typeof OceanBiomeType>

const OceanBiome = Schema.Struct({
  id: Schema.String.pipe(Schema.brand('BiomeId')),
  type: OceanBiomeType,
  temperature: Schema.Number,
  depth: Schema.Number,
  visibility: Schema.Number,
  currentStrength: Schema.Number,
  marineLife: Schema.Array(Schema.String),
  structures: Schema.Array(Schema.String),
  properties: Schema.Record(Schema.String, Schema.Unknown),
})

// 水中物理状態
const UnderwaterPhysics = Schema.Struct({
  waterLevel: Schema.Number,
  pressure: Schema.Number,
  buoyancy: Schema.Number,
  resistance: Schema.Number,
  currentForce: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  temperature: Schema.Number,
})

// 海洋構造物
const OceanStructureType = Schema.Literal('shipwreck', 'ocean_ruin', 'monument', 'coral_formation', 'underwater_cave')

const OceanStructure = Schema.Struct({
  id: Schema.String.pipe(Schema.brand('StructureId')),
  type: OceanStructureType,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  size: Schema.Struct({
    width: Schema.Number,
    height: Schema.Number,
    depth: Schema.Number,
  }),
  loot: Schema.Array(Schema.String),
  spawners: Schema.Array(Schema.String),
  condition: Schema.Number, // 0-1: 破損度
})
```

#### 海洋生物システム

```typescript
// 海洋生物基底
const MarineLifeType = Schema.Literal('fish', 'squid', 'guardian', 'dolphin', 'turtle', 'pufferfish')

const MarineLife = Schema.Struct({
  id: Schema.String.pipe(Schema.brand('MarineLifeId')),
  type: MarineLifeType,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  behavior: Schema.Literal('schooling', 'solitary', 'territorial', 'migratory'),
  swimSpeed: Schema.Number,
  preferredDepth: Schema.Struct({
    min: Schema.Number,
    max: Schema.Number,
  }),
  hostility: Schema.Literal('passive', 'neutral', 'hostile'),
  properties: Schema.Record(Schema.String, Schema.Unknown),
})

// 魚群システム
const FishSchool = Schema.Struct({
  id: Schema.String.pipe(Schema.brand('SchoolId')),
  species: Schema.String,
  centerPosition: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  members: Schema.Array(Schema.String), // MarineLifeId[]
  formation: Schema.Literal('sphere', 'cylinder', 'stream'),
  movementPattern: Schema.Literal('circular', 'linear', 'random'),
  cohesionStrength: Schema.Number,
})
```

### 2.2 Application Layer

#### 海洋生成サービス

```typescript
interface OceanGenerationServiceInterface {
  readonly generateOceanBiome: (config: OceanGenerationConfig) => Effect.Effect<OceanBiome, OceanGenerationError>
  readonly placeFractures: (biome: OceanBiome) => Effect.Effect<OceanStructure[], StructurePlacementError>
  readonly populateMarineLife: (biome: OceanBiome) => Effect.Effect<MarineLife[], MarineLifeSpawnError>
  readonly calculateWaterFlow: (region: Region) => Effect.Effect<FlowField, FlowCalculationError>
}

const OceanGenerationService = Context.GenericTag<OceanGenerationServiceInterface>('@app/OceanGenerationService')

// 海洋生成の実装
const makeOceanGenerationServiceLive = Effect.gen(function* () {
  const noiseGenerator = yield* NoiseGenerator
  const biomeConfig = yield* BiomeConfigService

  return OceanGenerationService.of({
    generateOceanBiome: (config) =>
      Effect.gen(function* () {
        // 早期リターン: 設定検証
        if (config.seaLevel <= 0) {
          return yield* Effect.fail(createOceanGenerationError('Invalid sea level'))
        }

        // 地形生成
        const heightMap = yield* generateOceanFloor(config, noiseGenerator)
        const biomeType = yield* determineBiomeType(config, heightMap)
        const structures = yield* generateOceanStructures(biomeType, heightMap)

        return createOceanBiome(biomeType, heightMap, structures, config)
      }),

    placeStructures: (biome) =>
      Effect.gen(function* () {
        const placementRules = yield* getStructurePlacementRules(biome.type)

        const structures = yield* Effect.forEach(placementRules, (rule) =>
          Match.value(rule.type).pipe(
            Match.tag('shipwreck', () => generateShipwreck(rule, biome)),
            Match.tag('ocean_ruin', () => generateOceanRuin(rule, biome)),
            Match.tag('monument', () => generateMonument(rule, biome)),
            Match.exhaustive
          )
        )

        return structures.flat()
      }),

    populateMarineLife: (biome) =>
      Effect.gen(function* () {
        const spawnRules = yield* getMarineLifeSpawnRules(biome.type)

        return yield* Effect.forEach(spawnRules, (rule) => spawnMarineLifeByRule(rule, biome))
      }),

    calculateWaterFlow: (region) =>
      Effect.gen(function* () {
        const heightField = yield* getHeightField(region)
        const pressureField = calculatePressureField(heightField)
        const velocityField = calculateVelocityField(pressureField)

        return createFlowField(velocityField, pressureField)
      }),
  })
})
```

#### 水中探索サービス

```typescript
interface UnderwaterExplorationServiceInterface {
  readonly updateBreathing: (playerId: string) => Effect.Effect<void, BreathingError>
  readonly calculateVisibility: (position: Position, depth: number) => Effect.Effect<number, VisibilityError>
  readonly applyWaterResistance: (entity: Entity, movement: Movement) => Effect.Effect<Movement, PhysicsError>
  readonly checkDrowning: (playerId: string) => Effect.Effect<HealthEffect, HealthError>
}

const UnderwaterExplorationService = Context.GenericTag<UnderwaterExplorationServiceInterface>(
  '@app/UnderwaterExplorationService'
)

const makeUnderwaterExplorationServiceLive = Effect.gen(function* () {
  const playerService = yield* PlayerService
  const healthService = yield* HealthService
  const physicsService = yield* PhysicsService

  return UnderwaterExplorationService.of({
    updateBreathing: (playerId) =>
      Effect.gen(function* () {
        const player = yield* playerService.getPlayer(playerId)
        const position = player.position

        // 水中判定
        if (yield* isUnderwater(position)) {
          const equipment = yield* playerService.getEquipment(playerId)
          const hasRespiration = yield* hasRespirationEnchantment(equipment)

          return yield* Match.value(hasRespiration).pipe(
            Match.when(true, () => maintainBreath(playerId)),
            Match.when(false, () => decreaseBreath(playerId)),
            Match.exhaustive
          )
        }

        // 水面復活
        return yield* restoreBreath(playerId)
      }),

    calculateVisibility: (position, depth) =>
      Effect.gen(function* () {
        const baseVisibility = yield* getBaseVisibility(position)
        const depthPenalty = calculateDepthPenalty(depth)
        const weather = yield* getWeatherConditions(position)

        return Math.max(0, baseVisibility - depthPenalty - weather.penalty)
      }),

    applyWaterResistance: (entity, movement) =>
      Effect.gen(function* () {
        const underwater = yield* isUnderwater(entity.position)

        return yield* Match.value(underwater).pipe(
          Match.when(true, () => applyUnderwaterResistance(movement)),
          Match.when(false, () => Effect.succeed(movement)),
          Match.exhaustive
        )
      }),

    checkDrowning: (playerId) =>
      Effect.gen(function* () {
        const player = yield* playerService.getPlayer(playerId)
        const breath = player.breath

        // 早期リターン: 息がある場合
        if (breath > 0) {
          return yield* Effect.succeed(createHealthEffect('none'))
        }

        // 溺死ダメージ処理
        const damage = calculateDrowningDamage(player)
        return yield* createHealthEffect('damage', damage)
      }),
  })
})
```

### 2.3 Infrastructure Layer

#### 流体物理エンジン

```typescript
interface FluidPhysicsEngineInterface {
  readonly simulateWaterFlow: (region: Region) => Effect.Effect<FlowField, SimulationError>
  readonly calculateBuoyancy: (entity: Entity) => Effect.Effect<number, PhysicsError>
  readonly updateTides: (time: number) => Effect.Effect<TideState, TideError>
  readonly processCurrents: (entities: Entity[]) => Effect.Effect<Entity[], CurrentError>
}

const FluidPhysicsEngine = Context.GenericTag<FluidPhysicsEngineInterface>('@app/FluidPhysicsEngine')

const makeFluidPhysicsEngineLive = Effect.gen(function* () {
  const webWorker = yield* WebWorkerService

  return FluidPhysicsEngine.of({
    simulateWaterFlow: (region) =>
      Effect.gen(function* () {
        // WebWorkerで高性能計算
        const flowData = yield* webWorker.execute('calculateFlow', {
          heightMap: region.heightMap,
          obstacles: region.obstacles,
          deltaTime: region.deltaTime,
        })

        return yield* parseFlowField(flowData)
      }),

    calculateBuoyancy: (entity) =>
      Effect.gen(function* () {
        const volume = calculateEntityVolume(entity)
        const density = getEntityDensity(entity.type)
        const waterDensity = 1000 // kg/m³

        return (waterDensity - density) * volume * 9.81 // 浮力 = (ρ₁ - ρ₂) * V * g
      }),

    updateTides: (time) =>
      Effect.gen(function* () {
        // 潮汐計算（簡化した調和解析）
        const primaryTide = Math.sin(time * 0.0001) * 2 // 主潮汐
        const secondaryTide = Math.sin(time * 0.00015) * 0.5 // 副潮汐

        return createTideState(primaryTide + secondaryTide)
      }),

    processCurrents: (entities) =>
      Effect.gen(function* () {
        const currentField = yield* getCurrentField()

        return yield* Effect.forEach(entities, (entity) => applyCurrentForce(entity, currentField))
      }),
  })
})
```

#### 海洋レンダリングエンジン

```typescript
interface OceanRenderingEngineInterface {
  readonly renderWaterSurface: (camera: Camera) => Effect.Effect<void, RenderingError>
  readonly renderUnderwater: (player: Player, visibility: number) => Effect.Effect<void, RenderingError>
  readonly updateCaustics: (lightPosition: Position) => Effect.Effect<void, RenderingError>
  readonly renderMarineLife: (entities: MarineLife[]) => Effect.Effect<void, RenderingError>
}

const OceanRenderingEngine = Context.GenericTag<OceanRenderingEngineInterface>('@app/OceanRenderingEngine')

const makeOceanRenderingEngineLive = Effect.gen(function* () {
  const gl = yield* WebGLContext
  const shaderService = yield* ShaderService

  return OceanRenderingEngine.of({
    renderWaterSurface: (camera) =>
      Effect.gen(function* () {
        const waterShader = yield* shaderService.getShader('water_surface')

        yield* waterShader.bind()
        yield* waterShader.setUniform('u_cameraPosition', camera.position)
        yield* waterShader.setUniform('u_time', performance.now())
        yield* waterShader.setUniform('u_waveHeight', 0.5)

        yield* renderWaterMesh()
      }),

    renderUnderwater: (player, visibility) =>
      Effect.gen(function* () {
        const underwaterShader = yield* shaderService.getShader('underwater')

        yield* underwaterShader.bind()
        yield* underwaterShader.setUniform('u_playerPosition', player.position)
        yield* underwaterShader.setUniform('u_visibility', visibility)
        yield* underwaterShader.setUniform('u_depth', player.position.y)

        yield* applyUnderwaterFog()
        yield* renderUnderwaterParticles()
      }),

    updateCaustics: (lightPosition) =>
      Effect.gen(function* () {
        const causticsTexture = yield* generateCausticsTexture(lightPosition)
        yield* bindCausticsTexture(causticsTexture)
      }),

    renderMarineLife: (entities) =>
      Effect.gen(function* () {
        const marineShader = yield* shaderService.getShader('marine_life')

        yield* marineShader.bind()

        return yield* Effect.forEach(entities, (entity) => renderMarineEntity(entity, marineShader))
      }),
  })
})
```

## 3. バイオーム・構造物システム

### 3.1 海洋バイオーム生成

#### バイオーム特性定義

```typescript
// バイオーム固有設定
const DeepOceanConfig = Schema.Struct({
  averageDepth: Schema.Number.pipe(Schema.default(() => 30)),
  structureDensity: Schema.Number.pipe(Schema.default(() => 0.1)),
  marineLifeDensity: Schema.Number.pipe(Schema.default(() => 0.3)),
  visibility: Schema.Number.pipe(Schema.default(() => 8)),
  monumentChance: Schema.Number.pipe(Schema.default(() => 0.05)),
})

const WarmOceanConfig = Schema.Struct({
  averageDepth: Schema.Number.pipe(Schema.default(() => 15)),
  coralCoverage: Schema.Number.pipe(Schema.default(() => 0.6)),
  marineLifeDensity: Schema.Number.pipe(Schema.default(() => 0.8)),
  visibility: Schema.Number.pipe(Schema.default(() => 12)),
  tropicalFishVariety: Schema.Number.pipe(Schema.default(() => 8)),
})

// バイオーム生成ロジック
const generateOceanBiome = (
  biomeType: OceanBiomeType,
  region: Region,
  config: OceanBiomeConfig
): Effect.Effect<OceanBiome, BiomeGenerationError> =>
  Match.value(biomeType).pipe(
    Match.tag('deep_ocean', () => generateDeepOcean(region, config.deepOcean)),
    Match.tag('warm_ocean', () => generateWarmOcean(region, config.warmOcean)),
    Match.tag('cold_ocean', () => generateColdOcean(region, config.coldOcean)),
    Match.tag('coral_reef', () => generateCoralReef(region, config.coralReef)),
    Match.tag('frozen_ocean', () => generateFrozenOcean(region, config.frozenOcean)),
    Match.exhaustive
  )
```

#### 構造物配置アルゴリズム

```typescript
// 構造物配置ルール
const placeOceanStructures = (
  biome: OceanBiome,
  rules: StructurePlacementRules
): Effect.Effect<OceanStructure[], StructurePlacementError> =>
  Effect.gen(function* () {
    const validPositions = yield* findValidStructurePositions(biome, rules)

    const structures = yield* Effect.forEach(validPositions, (position) =>
      Effect.gen(function* () {
        const structureType = yield* selectStructureType(position, biome, rules)
        const structure = yield* generateStructureAtPosition(structureType, position, biome)

        return structure
      })
    )

    return structures
  })

// 海底神殿生成
const generateMonument = (
  position: Position,
  biome: OceanBiome
): Effect.Effect<OceanStructure, StructureGenerationError> =>
  Effect.gen(function* () {
    // 早期リターン: 深度チェック
    if (biome.depth < 20) {
      return yield* Effect.fail(createStructureError('Insufficient depth for monument'))
    }

    const rooms = yield* generateMonumentRooms()
    const guardians = yield* spawnGuardians(rooms)
    const treasureRoom = yield* generateTreasureRoom()

    return createMonumentStructure(position, rooms, guardians, treasureRoom)
  })

// 沈没船生成
const generateShipwreck = (
  position: Position,
  condition: number
): Effect.Effect<OceanStructure, StructureGenerationError> =>
  Effect.gen(function* () {
    const shipType = yield* selectShipType()
    const loot = yield* generateShipwreckLoot(condition)
    const damage = yield* calculateShipDamage(condition)

    return createShipwreckStructure(position, shipType, loot, damage)
  })
```

### 3.2 海洋探索メカニズム

#### 水中ナビゲーション

```typescript
// 水中移動制限
const calculateUnderwaterMovement = (player: Player, input: MovementInput, physics: UnderwaterPhysics): Movement => {
  const baseSpeed = input.speed

  // 水中抵抗計算
  const resistance = physics.resistance * (1 - getAquaAffinityLevel(player) * 0.2)
  const modifiedSpeed = baseSpeed * (1 - resistance)

  // 浮力影響
  const verticalModifier = physics.buoyancy > 0 ? 1.2 : 0.8

  return {
    horizontal: modifiedSpeed,
    vertical: modifiedSpeed * verticalModifier,
  }
}

// 水中視界計算
const calculateUnderwaterVisibility = (depth: number, weather: WeatherCondition, equipment: Equipment): number => {
  const baseVisibility = 16
  const depthPenalty = Math.min(depth * 0.5, 12)
  const weatherPenalty = getWeatherVisibilityPenalty(weather)
  const equipmentBonus = getNightVisionBonus(equipment)

  return Math.max(2, baseVisibility - depthPenalty - weatherPenalty + equipmentBonus)
}
```

## 4. 水中生存・探索メカニズム

### 4.1 呼吸システム

```typescript
// 呼吸管理
const BreathingSystem = Schema.Struct({
  maxBreath: Schema.Number.pipe(Schema.default(() => 300)), // 15秒 * 20tick
  currentBreath: Schema.Number,
  breathDecreaseRate: Schema.Number.pipe(Schema.default(() => 1)),
  drowningDamage: Schema.Number.pipe(Schema.default(() => 2)),
  respirationLevel: Schema.Number.pipe(Schema.default(() => 0)),
})

const updatePlayerBreathing = (
  playerId: string,
  isUnderwater: boolean,
  equipment: Equipment
): Effect.Effect<void, BreathingError> =>
  Effect.gen(function* () {
    const breathingSystem = yield* getPlayerBreathing(playerId)
    const respirationLevel = getRespirationLevel(equipment)

    return yield* Match.value({ isUnderwater, currentBreath: breathingSystem.currentBreath }).pipe(
      Match.when(
        ({ isUnderwater }) => !isUnderwater,
        () => restoreBreath(playerId)
      ),
      Match.when(
        ({ isUnderwater, currentBreath }) => isUnderwater && currentBreath > 0,
        () => decreaseBreath(playerId, respirationLevel)
      ),
      Match.when(
        ({ isUnderwater, currentBreath }) => isUnderwater && currentBreath <= 0,
        () => applyDrowningDamage(playerId)
      ),
      Match.exhaustive
    )
  })

// 水中呼吸エンチャント効果
const calculateRespirationEffect = (level: number): { decreaseRate: number; maxBreath: number } => ({
  decreaseRate: Math.max(0.1, 1 - level * 0.2),
  maxBreath: 300 + level * 150, // レベル毎に7.5秒延長
})
```

### 4.2 水中装備システム

```typescript
// 潜水装備
const DivingEquipment = Schema.Struct({
  helmet: Schema.optional(
    Schema.Struct({
      type: Schema.Literal('turtle_shell', 'respiration_helmet'),
      respirationLevel: Schema.Number,
      durability: Schema.Number,
    })
  ),
  boots: Schema.optional(
    Schema.Struct({
      type: Schema.Literal('depth_strider_boots'),
      depthStriderLevel: Schema.Number,
      durability: Schema.Number,
    })
  ),
  tools: Schema.Array(
    Schema.Struct({
      type: Schema.String,
      aquaAffinityLevel: Schema.Number,
      efficiency: Schema.Number,
    })
  ),
})

// 水中作業効率計算
const calculateUnderwaterWorkSpeed = (tool: Tool, block: Block, isUnderwater: boolean): number => {
  const baseSpeed = getToolSpeed(tool, block)

  if (!isUnderwater) return baseSpeed

  const aquaAffinityLevel = getAquaAffinityLevel(tool)
  const underwaterPenalty = 0.2 // 80%減速
  const aquaAffinityBonus = aquaAffinityLevel * 0.2

  return baseSpeed * (1 - underwaterPenalty + aquaAffinityBonus)
}
```

## 5. 海洋生物・エコシステム

### 5.1 海洋生物AI

```typescript
// 魚群行動AI
interface SchoolingBehaviorInterface {
  readonly updateSchool: (school: FishSchool) => Effect.Effect<FishSchool, SchoolError>
  readonly addMember: (schoolId: string, fishId: string) => Effect.Effect<void, SchoolError>
  readonly removeMember: (schoolId: string, fishId: string) => Effect.Effect<void, SchoolError>
  readonly calculateCohesion: (school: FishSchool) => Effect.Effect<Vector3, BehaviorError>
}

const SchoolingBehavior = Context.GenericTag<SchoolingBehaviorInterface>("@app/SchoolingBehavior")

const makeSchoolingBehaviorLive = Effect.gen(function* () => {
  return SchoolingBehavior.of({
    updateSchool: (school) => Effect.gen(function* () {
      const members = yield* Effect.forEach(school.members, getMemberPosition)
      const cohesionForce = calculateCohesionForce(members)
      const separationForce = calculateSeparationForce(members)
      const alignmentForce = calculateAlignmentForce(members)

      const newCenter = applyBoidForces(school.centerPosition, [
        cohesionForce,
        separationForce,
        alignmentForce
      ])

      return { ...school, centerPosition: newCenter }
    }),

    calculateCohesion: (school) => Effect.gen(function* () {
      const positions = yield* Effect.forEach(school.members, getMemberPosition)
      const average = calculateAveragePosition(positions)

      return vectorSubtract(average, school.centerPosition)
    })
  })
})

// 個別生物AI
const updateMarineLifeAI = (
  entity: MarineLife,
  environment: OceanEnvironment
): Effect.Effect<MarineLife, AIError> =>
  Match.value(entity.type).pipe(
    Match.tag("fish", () => updateFishBehavior(entity, environment)),
    Match.tag("squid", () => updateSquidBehavior(entity, environment)),
    Match.tag("guardian", () => updateGuardianBehavior(entity, environment)),
    Match.tag("dolphin", () => updateDolphinBehavior(entity, environment)),
    Match.exhaustive
  )
```

### 5.2 海洋生物スポーン

```typescript
// 生物スポーンルール
const MarineLifeSpawnRules = Schema.Struct({
  biomeType: OceanBiomeType,
  species: Schema.String,
  spawnRate: Schema.Number,
  maxPopulation: Schema.Number,
  depthRange: Schema.Struct({
    min: Schema.Number,
    max: Schema.Number,
  }),
  temperatureRange: Schema.Struct({
    min: Schema.Number,
    max: Schema.Number,
  }),
  schooling: Schema.Boolean,
  hostileToPlayer: Schema.Boolean,
})

const spawnMarineLife = (biome: OceanBiome, rules: MarineLifeSpawnRules): Effect.Effect<MarineLife[], SpawnError> =>
  Effect.gen(function* () {
    const currentPopulation = yield* getCurrentPopulation(biome.id, rules.species)

    // 早期リターン: 個体数上限チェック
    if (currentPopulation >= rules.maxPopulation) {
      return []
    }

    const spawnPositions = yield* findValidSpawnPositions(biome, rules)
    const newEntities = yield* Effect.forEach(spawnPositions, (position) =>
      createMarineLifeEntity(rules.species, position, biome)
    )

    // 魚群形成
    if (rules.schooling && newEntities.length > 3) {
      yield* createFishSchool(newEntities)
    }

    return newEntities
  })
```

## 6. パフォーマンス最適化

### 6.1 海洋レンダリング最適化

```typescript
// LOD（Level of Detail）システム
const OceanLOD = Schema.Struct({
  distance: Schema.Number,
  meshResolution: Schema.Number,
  animationQuality: Schema.Literal('high', 'medium', 'low'),
  particleCount: Schema.Number,
  causticsEnabled: Schema.Boolean,
})

const calculateOceanLOD = (distance: number): OceanLOD => {
  if (distance < 50) {
    return {
      distance,
      meshResolution: 1.0,
      animationQuality: 'high',
      particleCount: 1000,
      causticsEnabled: true,
    }
  } else if (distance < 150) {
    return {
      distance,
      meshResolution: 0.5,
      animationQuality: 'medium',
      particleCount: 300,
      causticsEnabled: true,
    }
  } else {
    return {
      distance,
      meshResolution: 0.2,
      animationQuality: 'low',
      particleCount: 50,
      causticsEnabled: false,
    }
  }
}

// 流体シミュレーション最適化
const OptimizedFluidSimulation = Effect.gen(function* () {
  const webWorker = yield* WebWorkerService

  // バックグラウンドで流体計算
  const simulateFluidChunk = (chunk: FluidChunk): Effect.Effect<FluidChunk, SimulationError> =>
    webWorker
      .execute('simulateFluid', {
        velocityField: chunk.velocityField,
        pressureField: chunk.pressureField,
        deltaTime: 0.016,
        viscosity: 0.001,
      })
      .pipe(
        Effect.map((result) => updateFluidChunk(chunk, result)),
        retryWithBackoff(3)
      )

  return {
    simulateFluidChunk,
  }
})
```

### 6.2 海洋生物最適化

```typescript
// 海洋生物カリング
const cullMarineLife = (entities: MarineLife[], camera: Camera, frustum: Frustum): MarineLife[] => {
  return entities.filter((entity) => {
    // 距離カリング
    const distance = calculateDistance(entity.position, camera.position)
    if (distance > MAX_MARINE_LIFE_RENDER_DISTANCE) return false

    // フラスタムカリング
    if (!isInFrustum(entity.position, frustum)) return false

    // 水中でない場合の海洋生物カリング
    if (!isPositionUnderwater(camera.position) && entity.position.y < camera.position.y - 20) {
      return false
    }

    return true
  })
}

// インスタンスレンダリング
const renderMarineLifeInstanced = (entities: MarineLife[], renderer: Renderer): Effect.Effect<void, RenderingError> =>
  Effect.gen(function* () {
    // 種類別にグループ化
    const groupedEntities = groupBy(entities, (entity) => entity.type)

    yield* Effect.forEach(Object.entries(groupedEntities), ([type, group]) =>
      Effect.gen(function* () {
        const instanceData = group.map(createInstanceData)
        yield* renderer.renderInstanced(type, instanceData)
      })
    )
  })
```

## 7. テスト戦略

### 7.1 海洋生成テスト

```typescript
// Property-Based Testing for Ocean Generation
import * as fc from '@effect/vitest'

const oceanGenerationArbitrary = fc.record({
  seed: Schema.Number.pipe(Schema.int()),
  seaLevel: fc.integer({ min: 50, max: 100 }),
  biomeType: fc.constantFrom('deep_ocean', 'warm_ocean', 'cold_ocean', 'coral_reef'),
  size: fc.record({
    width: fc.integer({ min: 100, max: 1000 }),
    height: fc.integer({ min: 100, max: 1000 }),
  }),
})

const testOceanGeneration = Effect.gen(function* () {
  yield* Effect.sync(() => {
    it.prop(
      it.prop(oceanGenerationArbitrary, (config) => {
        const result = Effect.runSync(generateOceanBiome(config))

        // プロパティ検証
        return (
          result.seaLevel === config.seaLevel &&
          result.type === config.biomeType &&
          result.structures.length >= 0 &&
          result.marineLife.length >= 0
        )
      })
    )
  })
})

// 流体物理テスト
const testFluidPhysics = Effect.gen(function* () {
  const mockRegion = createMockRegion()
  const flowField = yield* simulateWaterFlow(mockRegion)

  // 物理法則検証
  yield* Effect.sync(() => {
    // 質量保存則
    expect(verifyMassConservation(flowField)).toBe(true)

    // エネルギー保存則
    expect(verifyEnergyConservation(flowField)).toBe(true)

    // 境界条件
    expect(verifyBoundaryConditions(flowField, mockRegion)).toBe(true)
  })
})
```

### 7.2 海洋生物AIテスト

```typescript
// 魚群行動テスト
const testSchoolingBehavior = Effect.gen(function* () {
  const school = createTestSchool()
  const updatedSchool = yield* updateSchool(school)

  // 群れの凝集性テスト
  const cohesion = calculateSchoolCohesion(updatedSchool)
  expect(cohesion).toBeLessThan(MAX_SCHOOL_DISPERSION)

  // 個体間距離テスト
  const members = yield* Effect.forEach(updatedSchool.members, getMemberPosition)
  const minDistance = findMinimumDistance(members)
  expect(minDistance).toBeGreaterThan(MIN_SEPARATION_DISTANCE)
})

// 生物スポーンテスト
const testMarineLifeSpawning = Effect.gen(function* () {
  const biome = createTestOceanBiome()
  const spawnRules = createTestSpawnRules()

  const entities = yield* spawnMarineLife(biome, spawnRules)

  // スポーン位置検証
  entities.forEach((entity) => {
    expect(isValidSpawnPosition(entity.position, biome)).toBe(true)
    expect(entity.position.y).toBeLessThan(biome.seaLevel)
  })

  // 個体数制限検証
  expect(entities.length).toBeLessThanOrEqual(spawnRules.maxPopulation)
})
```

### 7.3 統合テスト

```typescript
// 水中探索統合テスト
const testUnderwaterExploration = Effect.gen(function* () {
  const testLayer = Layer.mergeAll(MockOceanGenerationService, MockFluidPhysicsEngine, MockUnderwaterExplorationService)

  yield* Effect.provide(
    Effect.gen(function* () {
      // プレイヤー水中移動
      const player = createTestPlayer()
      yield* movePlayerUnderwater(player.id, { x: 0, y: -10, z: 0 })

      // 呼吸システム確認
      const breathingState = yield* getPlayerBreathing(player.id)
      expect(breathingState.currentBreath).toBeLessThan(breathingState.maxBreath)

      // 視界制限確認
      const visibility = yield* calculateVisibility(player.position, 10)
      expect(visibility).toBeLessThan(16)

      // 水中物理確認
      const physics = yield* getUnderwaterPhysics(player.position)
      expect(physics.resistance).toBeGreaterThan(0)
    }),
    testLayer
  )
})
```

---

この設計書は、TypeScript MinecraftプロジェクトにおけるOcean & Underwater Systemの包括的な実装指針を提供します。Effect-TS 3.17+の最新パターンを活用し、型安全性とパフォーマンスを両立させた海洋システムの実現を目指します。
