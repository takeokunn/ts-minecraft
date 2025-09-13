# Material System - マテリアル・素材システム

## 概要

Material Systemは、TypeScript Minecraft cloneの物理的特性とゲームプレイの基盤を担うシステムです。ブロック・アイテム・エンティティの物理的性質、相互作用、レンダリング、音響効果を定義し、リアルで没入感のあるゲーム体験を提供します。

本システムは以下の機能を提供します：
- **マテリアル定義**: 700+種類の物理的特性定義
- **パフォーマンス最適化**: 構造体配列と効率的なキャッシング
- **物理シミュレーション**: リアルタイムな相互作用計算
- **音響システム**: 材質に応じた音響効果
- **視覚効果**: パーティクル・破壊エフェクトの管理
- **テクスチャ管理**: 効率的なテクスチャマッピング
- **バイオーム統合**: 環境に応じた材質変化

## Material Type定義

### Material Schema

```typescript
import { Effect, Layer, Context, Schema, pipe, Match } from "effect"
import { Brand, Option, ReadonlyArray } from "effect"

// IMPORTANT: Context7で最新のEffect-TSパターンを確認

// マテリアルID（ブランド型）
export const MaterialId = Schema.String.pipe(
  Schema.pattern(/^[a-z]+:[a-z_]+$/),
  Schema.brand("MaterialId")
)
export type MaterialId = Schema.Schema.Type<typeof MaterialId>

// 物理的特性
export const PhysicalProperties = Schema.Struct({
  density: pipe(Schema.Number, Schema.positive()), // kg/m³
  hardness: pipe(Schema.Number, Schema.between(0, 10)), // モース硬度スケール
  elasticity: pipe(Schema.Number, Schema.between(0, 1)), // 弾性係数
  friction: pipe(Schema.Number, Schema.between(0, 2)), // 摩擦係数
  viscosity: pipe(Schema.Number, Schema.nonNegative()), // 粘度（流体用）
  conductivity: Schema.Struct({
    thermal: pipe(Schema.Number, Schema.nonNegative()), // 熱伝導率
    electrical: pipe(Schema.Number, Schema.nonNegative()) // 電気伝導率
  }),
  magnetism: pipe(Schema.Number, Schema.between(-1, 1)), // 磁性（-1=反磁性、0=非磁性、1=強磁性）
  radioactivity: pipe(Schema.Number, Schema.nonNegative()) // 放射線レベル
})

// 視覚的特性
export const VisualProperties = Schema.Struct({
  color: Schema.Struct({
    primary: Schema.String.pipe(Schema.pattern(/^#[0-9a-fA-F]{6}$/)),
    secondary: Schema.Optional(Schema.String.pipe(Schema.pattern(/^#[0-9a-fA-F]{6}$/))),
    emissive: Schema.Optional(Schema.String.pipe(Schema.pattern(/^#[0-9a-fA-F]{6}$/)))
  }),
  opacity: pipe(Schema.Number, Schema.between(0, 1)),
  reflectivity: pipe(Schema.Number, Schema.between(0, 1)),
  roughness: pipe(Schema.Number, Schema.between(0, 1)),
  metallic: pipe(Schema.Number, Schema.between(0, 1)),
  luminance: pipe(Schema.Number, Schema.int(), Schema.between(0, 15)),
  transparency: Schema.Literal("opaque", "cutout", "translucent", "transparent"),
  renderLayer: Schema.Literal("solid", "cutout_mipped", "cutout", "translucent"),
  cullFace: Schema.Boolean, // 面のカリング有効
  backfaceCulling: Schema.Boolean,
  ambientOcclusion: Schema.Boolean
})

// 音響特性
export const AcousticProperties = Schema.Struct({
  soundType: Schema.Literal(
    "stone", "wood", "gravel", "grass", "metal", "glass", "wool",
    "sand", "snow", "liquid", "fire", "organic", "crystal", "ceramic"
  ),
  footstepSounds: Schema.Array(Schema.String),
  breakSounds: Schema.Array(Schema.String),
  placeSounds: Schema.Array(Schema.String),
  hitSounds: Schema.Array(Schema.String),
  ambientSounds: Schema.Optional(Schema.Array(Schema.String)),
  volume: pipe(Schema.Number, Schema.between(0, 1)),
  pitch: pipe(Schema.Number, Schema.between(0.5, 2.0)),
  reverb: Schema.Optional(Schema.Number),
  echo: Schema.Optional(Schema.Number),
  dampening: pipe(Schema.Number, Schema.between(0, 1)) // 音の吸収率
})

// 環境的特性
export const EnvironmentalProperties = Schema.Struct({
  temperature: Schema.Struct({
    melting: Schema.Optional(Schema.Number), // 融点（℃）
    boiling: Schema.Optional(Schema.Number), // 沸点（℃）
    combustion: Schema.Optional(Schema.Number), // 発火点（℃）
    ambient: pipe(Schema.Number, Schema.between(-273, 5000)) // 通常温度
  }),
  weatherResistance: Schema.Struct({
    rain: pipe(Schema.Number, Schema.between(0, 1)),
    snow: pipe(Schema.Number, Schema.between(0, 1)),
    wind: pipe(Schema.Number, Schema.between(0, 1)),
    uv: pipe(Schema.Number, Schema.between(0, 1)) // 紫外線耐性
  }),
  biomeAdaptation: Schema.Record(
    Schema.String, // バイオームID
    Schema.Struct({
      colorVariation: Schema.Optional(Schema.String),
      textureVariation: Schema.Optional(Schema.String),
      propertyModifiers: Schema.Optional(Schema.Record(Schema.String, Schema.Number))
    })
  ),
  ageingEffects: Schema.Optional(Schema.Struct({
    weathering: Schema.Boolean,
    patina: Schema.Boolean,
    decay: Schema.Boolean,
    growth: Schema.Boolean // 苔、錆など
  }))
})

// インタラクション特性
export const InteractionProperties = Schema.Struct({
  toolEffectiveness: Schema.Record(
    Schema.Literal("hand", "pickaxe", "axe", "shovel", "hoe", "shears", "sword"),
    Schema.Struct({
      efficiency: pipe(Schema.Number, Schema.between(0, 10)),
      durabilityDamage: pipe(Schema.Number, Schema.between(0, 5))
    })
  ),
  enchantmentAffinity: Schema.Record(
    Schema.String, // エンチャント名
    pipe(Schema.Number, Schema.between(0, 2)) // 効果倍率
  ),
  chemicalReactions: Schema.Array(Schema.Struct({
    reactant: MaterialId,
    catalyst: Schema.Optional(MaterialId),
    products: Schema.Array(Schema.Struct({
      material: MaterialId,
      probability: pipe(Schema.Number, Schema.between(0, 1))
    })),
    conditions: Schema.Optional(Schema.Struct({
      temperature: Schema.Optional(Schema.Struct({
        min: Schema.Number,
        max: Schema.Number
      })),
      pressure: Schema.Optional(Schema.Number),
      time: Schema.Optional(Schema.Number)
    }))
  })),
  explosionResistance: pipe(Schema.Number, Schema.nonNegative()),
  fireSpread: Schema.Struct({
    igniteChance: pipe(Schema.Number, Schema.between(0, 1)),
    burnTime: Schema.Optional(pipe(Schema.Number, Schema.positive())),
    spreadChance: pipe(Schema.Number, Schema.between(0, 1))
  })
})

// メインマテリアル定義
export const MaterialDefinition = Schema.Struct({
  id: MaterialId,
  name: Schema.String,
  description: Schema.Optional(Schema.String),
  category: Schema.Literal(
    "stone", "metal", "organic", "liquid", "gas", "composite",
    "magical", "synthetic", "crystal", "ceramic", "glass"
  ),
  state: Schema.Literal("solid", "liquid", "gas", "plasma"),
  physical: PhysicalProperties,
  visual: VisualProperties,
  acoustic: AcousticProperties,
  environmental: EnvironmentalProperties,
  interaction: InteractionProperties,
  tags: Schema.Array(Schema.String), // "flammable", "transparent", "conductive"
  rarity: Schema.Literal("common", "uncommon", "rare", "epic", "legendary"),
  version: pipe(Schema.Number, Schema.int(), Schema.positive()),
  created: Schema.DateTimeUtc,
  lastModified: Schema.DateTimeUtc
})

export type MaterialDefinition = Schema.Schema.Type<typeof MaterialDefinition>
```

## Material Registry

### High-Performance Material Registry

```typescript
// MaterialRegistryインターフェース
interface MaterialRegistryInterface {
  readonly register: (material: MaterialDefinition) => Effect.Effect<void, RegistrationError>
  readonly get: (id: MaterialId) => Effect.Effect<MaterialDefinition, MaterialNotFoundError>
  readonly getByCategory: (category: string) => Effect.Effect<ReadonlyArray<MaterialDefinition>, never>
  readonly getByTags: (tags: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<MaterialDefinition>, never>
  readonly findSimilar: (material: MaterialDefinition, threshold: number) => Effect.Effect<ReadonlyArray<MaterialDefinition>, never>
  readonly updateMaterial: (id: MaterialId, updates: Partial<MaterialDefinition>) => Effect.Effect<void, UpdateError>
  readonly preloadForRegion: (region: WorldRegion) => Effect.Effect<void, never>
  readonly getStats: () => Effect.Effect<RegistryStats, never>
}

// Context Tag（最新パターン）
export const MaterialRegistry = Context.GenericTag<MaterialRegistryInterface>("@app/MaterialRegistry")

// 高性能実装（Structure of Arrays パターン）
const makeMaterialRegistry = Effect.gen(function* () {
  // SoA（構造体配列）による最適化
  const materialIds = yield* Ref.make(new Array<MaterialId>())
  const physicalProps = yield* Ref.make(new Array<PhysicalProperties>())
  const visualProps = yield* Ref.make(new Array<VisualProperties>())
  const acousticProps = yield* Ref.make(new Array<AcousticProperties>())
  const environmentalProps = yield* Ref.make(new Array<EnvironmentalProperties>())
  const interactionProps = yield* Ref.make(new Array<InteractionProperties>())

  // インデックス マッピング
  const idToIndex = yield* Ref.make(new Map<MaterialId, number>())
  const categoryIndex = yield* Ref.make(new Map<string, Set<number>>())
  const tagIndex = yield* Ref.make(new Map<string, Set<number>>())

  // キャッシュシステム
  const materialCache = yield* Ref.make(new Map<MaterialId, MaterialDefinition>())
  const similarityCache = yield* Ref.make(new Map<string, ReadonlyArray<MaterialDefinition>>())

  // パフォーマンス統計
  const stats = yield* Ref.make({
    totalMaterials: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastCleanup: Date.now(),
    memoryUsage: 0,
    indexSize: 0
  })

  const register = (material: MaterialDefinition) =>
    Effect.gen(function* () {
      const currentIds = yield* Ref.get(materialIds)

      // 重複チェック
      const existingIndex = yield* Ref.get(idToIndex)
      if (existingIndex.has(material.id)) {
        return yield* Effect.fail(new RegistrationError(`Material already exists: ${material.id}`))
      }

      const newIndex = currentIds.length

      // 構造体配列に追加
      yield* Ref.update(materialIds, ids => [...ids, material.id])
      yield* Ref.update(physicalProps, props => [...props, material.physical])
      yield* Ref.update(visualProps, props => [...props, material.visual])
      yield* Ref.update(acousticProps, props => [...props, material.acoustic])
      yield* Ref.update(environmentalProps, props => [...props, material.environmental])
      yield* Ref.update(interactionProps, props => [...props, material.interaction])

      // インデックス更新
      yield* Ref.update(idToIndex, index => new Map(index).set(material.id, newIndex))

      // カテゴリインデックス更新
      yield* Ref.update(categoryIndex, index => {
        const newIndex = new Map(index)
        const categorySet = newIndex.get(material.category) || new Set()
        categorySet.add(newIndex)
        newIndex.set(material.category, categorySet)
        return newIndex
      })

      // タグインデックス更新
      for (const tag of material.tags) {
        yield* Ref.update(tagIndex, index => {
          const newTagIndex = new Map(index)
          const tagSet = newTagIndex.get(tag) || new Set()
          tagSet.add(newIndex)
          newTagIndex.set(tag, tagSet)
          return newTagIndex
        })
      }

      // キャッシュに追加
      yield* Ref.update(materialCache, cache => new Map(cache).set(material.id, material))

      // 統計更新
      yield* Ref.update(stats, s => ({ ...s, totalMaterials: s.totalMaterials + 1 }))
    })

  const get = (id: MaterialId) =>
    Effect.gen(function* () {
      // キャッシュチェック
      const cache = yield* Ref.get(materialCache)
      const cached = cache.get(id)

      if (cached) {
        yield* Ref.update(stats, s => ({ ...s, cacheHits: s.cacheHits + 1 }))
        return cached
      }

      yield* Ref.update(stats, s => ({ ...s, cacheMisses: s.cacheMisses + 1 }))

      // インデックスから取得
      const indexMap = yield* Ref.get(idToIndex)
      const index = indexMap.get(id)

      if (index === undefined) {
        return yield* Effect.fail(new MaterialNotFoundError(id))
      }

      // 構造体配列から再構築
      const material = yield* reconstructMaterial(index)

      // キャッシュに保存
      yield* Ref.update(materialCache, cache => new Map(cache).set(id, material))

      return material
    })

  const getByCategory = (category: string) =>
    Effect.gen(function* () {
      const categoryIdx = yield* Ref.get(categoryIndex)
      const indices = categoryIdx.get(category) || new Set()

      const materials: MaterialDefinition[] = []
      for (const index of indices) {
        const material = yield* reconstructMaterial(index)
        materials.push(material)
      }

      return materials
    })

  const getByTags = (tags: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      const tagIdx = yield* Ref.get(tagIndex)

      // 共通のインデックスを見つける
      let commonIndices: Set<number> | null = null

      for (const tag of tags) {
        const tagIndices = tagIdx.get(tag) || new Set()

        if (commonIndices === null) {
          commonIndices = new Set(tagIndices)
        } else {
          commonIndices = new Set([...commonIndices].filter(x => tagIndices.has(x)))
        }
      }

      if (!commonIndices) return []

      const materials: MaterialDefinition[] = []
      for (const index of commonIndices) {
        const material = yield* reconstructMaterial(index)
        materials.push(material)
      }

      return materials
    })

  const findSimilar = (material: MaterialDefinition, threshold: number) =>
    Effect.gen(function* () {
      const cacheKey = `${material.id}:${threshold}`
      const cache = yield* Ref.get(similarityCache)

      if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!
      }

      const allIds = yield* Ref.get(materialIds)
      const similar: MaterialDefinition[] = []

      for (let i = 0; i < allIds.length; i++) {
        if (allIds[i] === material.id) continue

        const candidate = yield* reconstructMaterial(i)
        const similarity = yield* calculateSimilarity(material, candidate)

        if (similarity >= threshold) {
          similar.push(candidate)
        }
      }

      // 類似度でソート
      similar.sort((a, b) => {
        const simA = calculateSimilaritySync(material, a)
        const simB = calculateSimilaritySync(material, b)
        return simB - simA
      })

      // キャッシュに保存
      yield* Ref.update(similarityCache, cache => new Map(cache).set(cacheKey, similar))

      return similar
    })

  const updateMaterial = (id: MaterialId, updates: Partial<MaterialDefinition>) =>
    Effect.gen(function* () {
      const indexMap = yield* Ref.get(idToIndex)
      const index = indexMap.get(id)

      if (index === undefined) {
        return yield* Effect.fail(new UpdateError(`Material not found: ${id}`))
      }

      // 部分更新の適用
      if (updates.physical) {
        yield* Ref.update(physicalProps, props => {
          const newProps = [...props]
          newProps[index] = updates.physical!
          return newProps
        })
      }

      if (updates.visual) {
        yield* Ref.update(visualProps, props => {
          const newProps = [...props]
          newProps[index] = updates.visual!
          return newProps
        })
      }

      // キャッシュを無効化
      yield* Ref.update(materialCache, cache => {
        const newCache = new Map(cache)
        newCache.delete(id)
        return newCache
      })

      // 類似性キャッシュをクリア
      yield* Ref.set(similarityCache, new Map())
    })

  const preloadForRegion = (region: WorldRegion) =>
    Effect.gen(function* () {
      // 地域に関連するマテリアルを事前ロード
      const regionMaterials = yield* getRegionMaterials(region)

      yield* Effect.all(
        regionMaterials.map(materialId => get(materialId)),
        { concurrency: 8 }
      )
    })

  const getStats = () =>
    Effect.gen(function* () {
      const currentStats = yield* Ref.get(stats)
      const cacheSize = yield* Ref.get(materialCache).pipe(
        Effect.map(cache => cache.size)
      )

      return {
        ...currentStats,
        cacheSize,
        hitRate: currentStats.cacheHits / (currentStats.cacheHits + currentStats.cacheMisses)
      } as RegistryStats
    })

  // 構造体配列から MaterialDefinition を再構築
  const reconstructMaterial = (index: number) =>
    Effect.gen(function* () {
      const ids = yield* Ref.get(materialIds)
      const physical = yield* Ref.get(physicalProps)
      const visual = yield* Ref.get(visualProps)
      const acoustic = yield* Ref.get(acousticProps)
      const environmental = yield* Ref.get(environmentalProps)
      const interaction = yield* Ref.get(interactionProps)

      return {
        id: ids[index],
        physical: physical[index],
        visual: visual[index],
        acoustic: acoustic[index],
        environmental: environmental[index],
        interaction: interaction[index],
        // その他の静的プロパティ
        name: `Material_${ids[index]}`,
        category: "stone",
        state: "solid",
        tags: [],
        rarity: "common",
        version: 1,
        created: new Date(),
        lastModified: new Date()
      } as MaterialDefinition
    })

  const calculateSimilarity = (a: MaterialDefinition, b: MaterialDefinition) =>
    Effect.gen(function* () {
      let score = 0
      let weights = 0

      // 物理的特性の類似度 (重み: 0.3)
      const physicalSim = calculatePhysicalSimilarity(a.physical, b.physical)
      score += physicalSim * 0.3
      weights += 0.3

      // 視覚的特性の類似度 (重み: 0.2)
      const visualSim = calculateVisualSimilarity(a.visual, b.visual)
      score += visualSim * 0.2
      weights += 0.2

      // 音響特性の類似度 (重み: 0.1)
      const acousticSim = calculateAcousticSimilarity(a.acoustic, b.acoustic)
      score += acousticSim * 0.1
      weights += 0.1

      // カテゴリマッチ (重み: 0.2)
      const categoryMatch = a.category === b.category ? 1 : 0
      score += categoryMatch * 0.2
      weights += 0.2

      // タグ類似度 (重み: 0.2)
      const tagSim = calculateTagSimilarity(a.tags, b.tags)
      score += tagSim * 0.2
      weights += 0.2

      return weights > 0 ? score / weights : 0
    })

  const calculateSimilaritySync = (a: MaterialDefinition, b: MaterialDefinition): number => {
    // 同期版の類似度計算（キャッシュソート用）
    let score = 0
    score += calculatePhysicalSimilarity(a.physical, b.physical) * 0.3
    score += calculateVisualSimilarity(a.visual, b.visual) * 0.2
    score += calculateAcousticSimilarity(a.acoustic, b.acoustic) * 0.1
    score += (a.category === b.category ? 1 : 0) * 0.2
    score += calculateTagSimilarity(a.tags, b.tags) * 0.2
    return score
  }

  const getRegionMaterials = (region: WorldRegion) =>
    Effect.gen(function* () {
      // 地域に基づくマテリアル予測
      const biome = region.biome
      const commonMaterials: MaterialId[] = []

      switch (biome) {
        case "plains":
          commonMaterials.push(
            "minecraft:grass" as MaterialId,
            "minecraft:dirt" as MaterialId,
            "minecraft:stone" as MaterialId
          )
          break
        case "desert":
          commonMaterials.push(
            "minecraft:sand" as MaterialId,
            "minecraft:sandstone" as MaterialId,
            "minecraft:cactus" as MaterialId
          )
          break
        case "forest":
          commonMaterials.push(
            "minecraft:wood" as MaterialId,
            "minecraft:leaves" as MaterialId,
            "minecraft:moss" as MaterialId
          )
          break
      }

      return commonMaterials
    })

  return MaterialRegistry.of({
    register,
    get,
    getByCategory,
    getByTags,
    findSimilar,
    updateMaterial,
    preloadForRegion,
    getStats
  })
})

// Live Layer
export const MaterialRegistryLive = Layer.effect(
  MaterialRegistry,
  makeMaterialRegistry
)
```

## Material Physics System

### Advanced Physics Integration

```typescript
// MaterialPhysicsServiceインターフェース
interface MaterialPhysicsServiceInterface {
  readonly calculateCollision: (
    materialA: MaterialId,
    materialB: MaterialId,
    velocity: Vector3D,
    normal: Vector3D
  ) => Effect.Effect<CollisionResult, PhysicsError>

  readonly simulateFluidFlow: (
    material: MaterialId,
    positions: ReadonlyArray<Vector3D>,
    deltaTime: number
  ) => Effect.Effect<FluidState, FluidError>

  readonly processTemperatureExchange: (
    materials: ReadonlyArray<{ material: MaterialId; position: Vector3D; temperature: number }>,
    deltaTime: number
  ) => Effect.Effect<ReadonlyArray<number>, ThermalError>

  readonly calculateFriction: (
    materialA: MaterialId,
    materialB: MaterialId,
    normalForce: number,
    velocity: Vector3D
  ) => Effect.Effect<Vector3D, never>

  readonly simulateChemicalReaction: (
    reactants: ReadonlyArray<MaterialReactant>,
    conditions: ReactionConditions
  ) => Effect.Effect<ReactionResult, ChemicalError>

  readonly updateMaterialState: (
    material: MaterialId,
    position: Vector3D,
    conditions: EnvironmentalConditions,
    deltaTime: number
  ) => Effect.Effect<MaterialStateUpdate, never>
}

// Context Tag（最新パターン）
export const MaterialPhysicsService = Context.GenericTag<MaterialPhysicsServiceInterface>("@app/MaterialPhysicsService")

// 高性能物理システム実装
const makeMaterialPhysicsService = Effect.gen(function* () {
  const materialRegistry = yield* MaterialRegistry

  // 物理演算キャッシュ
  const collisionCache = yield* Ref.make(new Map<string, CollisionResult>())
  const frictionCache = yield* Ref.make(new Map<string, Vector3D>())
  const thermalCache = yield* Ref.make(new Map<string, number>())

  // 並列処理プール
  const physicsWorkerPool = yield* Effect.sync(() => createWorkerPool(4))

  const calculateCollision = (
    materialA: MaterialId,
    materialB: MaterialId,
    velocity: Vector3D,
    normal: Vector3D
  ) =>
    Effect.gen(function* () {
      const cacheKey = `${materialA}:${materialB}:${velocity.x},${velocity.y},${velocity.z}:${normal.x},${normal.y},${normal.z}`
      const cache = yield* Ref.get(collisionCache)

      if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!
      }

      const matA = yield* materialRegistry.get(materialA)
      const matB = yield* materialRegistry.get(materialB)

      // 衝突計算
      const restitution = Math.sqrt(matA.physical.elasticity * matB.physical.elasticity)
      const massRatio = matA.physical.density / (matA.physical.density + matB.physical.density)

      // 反射ベクトル計算
      const velocityMagnitude = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)
      const normalizedVelocity = {
        x: velocity.x / velocityMagnitude,
        y: velocity.y / velocityMagnitude,
        z: velocity.z / velocityMagnitude
      }

      const dotProduct = normalizedVelocity.x * normal.x + normalizedVelocity.y * normal.y + normalizedVelocity.z * normal.z

      const reflectedVelocity = {
        x: normalizedVelocity.x - 2 * dotProduct * normal.x,
        y: normalizedVelocity.y - 2 * dotProduct * normal.y,
        z: normalizedVelocity.z - 2 * dotProduct * normal.z
      }

      const finalVelocity = {
        x: reflectedVelocity.x * velocityMagnitude * restitution,
        y: reflectedVelocity.y * velocityMagnitude * restitution,
        z: reflectedVelocity.z * velocityMagnitude * restitution
      }

      // 音響効果計算
      const impactForce = velocityMagnitude * Math.max(matA.physical.density, matB.physical.density)
      const soundIntensity = Math.min(impactForce / 1000, 1.0)

      const result: CollisionResult = {
        finalVelocity,
        energyLoss: 1 - restitution,
        soundEffect: {
          type: matA.acoustic.soundType,
          volume: soundIntensity * matA.acoustic.volume,
          pitch: matA.acoustic.pitch + (Math.random() - 0.5) * 0.2
        },
        particleEffect: {
          count: Math.floor(impactForce / 100),
          material: materialA,
          duration: 1000 + impactForce * 10
        },
        damage: calculateImpactDamage(matA, matB, velocityMagnitude)
      }

      // キャッシュに保存
      yield* Ref.update(collisionCache, cache => new Map(cache).set(cacheKey, result))

      return result
    })

  const simulateFluidFlow = (
    material: MaterialId,
    positions: ReadonlyArray<Vector3D>,
    deltaTime: number
  ) =>
    Effect.gen(function* () {
      const fluidMaterial = yield* materialRegistry.get(material)

      if (fluidMaterial.state !== "liquid") {
        return yield* Effect.fail(new FluidError("Material is not a liquid"))
      }

      const viscosity = fluidMaterial.physical.viscosity
      const density = fluidMaterial.physical.density

      // Smoothed Particle Hydrodynamics (SPH) シミュレーション
      const particles = positions.map((pos, index) => ({
        id: index,
        position: pos,
        velocity: { x: 0, y: -9.81 * deltaTime, z: 0 }, // 重力
        density: density,
        pressure: 0
      }))

      // 密度と圧力の計算
      for (let i = 0; i < particles.length; i++) {
        let density = 0
        for (let j = 0; j < particles.length; j++) {
          const distance = calculateDistance3D(particles[i].position, particles[j].position)
          if (distance < 2.0) { // カーネル半径
            density += fluidMaterial.physical.density * sphKernel(distance, 2.0)
          }
        }
        particles[i].density = density
        particles[i].pressure = Math.max(0, (density - fluidMaterial.physical.density) * 0.1)
      }

      // 力の計算と速度更新
      for (let i = 0; i < particles.length; i++) {
        let pressureForce = { x: 0, y: 0, z: 0 }
        let viscosityForce = { x: 0, y: 0, z: 0 }

        for (let j = 0; j < particles.length; j++) {
          if (i === j) continue

          const distance = calculateDistance3D(particles[i].position, particles[j].position)
          if (distance < 2.0) {
            const gradient = sphGradient(particles[i].position, particles[j].position, distance, 2.0)

            // 圧力力
            const pressureMagnitude = -(particles[i].pressure + particles[j].pressure) / (2 * particles[j].density)
            pressureForce.x += pressureMagnitude * gradient.x
            pressureForce.y += pressureMagnitude * gradient.y
            pressureForce.z += pressureMagnitude * gradient.z

            // 粘性力
            const velocityDiff = {
              x: particles[j].velocity.x - particles[i].velocity.x,
              y: particles[j].velocity.y - particles[i].velocity.y,
              z: particles[j].velocity.z - particles[i].velocity.z
            }

            const viscosityMagnitude = viscosity * sphLaplacian(distance, 2.0) / particles[j].density
            viscosityForce.x += viscosityMagnitude * velocityDiff.x
            viscosityForce.y += viscosityMagnitude * velocityDiff.y
            viscosityForce.z += viscosityMagnitude * velocityDiff.z
          }
        }

        // 速度更新
        particles[i].velocity.x += (pressureForce.x + viscosityForce.x) * deltaTime
        particles[i].velocity.y += (pressureForce.y + viscosityForce.y) * deltaTime
        particles[i].velocity.z += (pressureForce.z + viscosityForce.z) * deltaTime

        // 位置更新
        particles[i].position.x += particles[i].velocity.x * deltaTime
        particles[i].position.y += particles[i].velocity.y * deltaTime
        particles[i].position.z += particles[i].velocity.z * deltaTime
      }

      return {
        particles: particles.map(p => ({
          position: p.position,
          velocity: p.velocity,
          density: p.density,
          pressure: p.pressure
        })),
        flowRate: calculateFlowRate(particles),
        turbulence: calculateTurbulence(particles),
        surface: calculateSurface(particles)
      } as FluidState
    })

  const processTemperatureExchange = (
    materials: ReadonlyArray<{ material: MaterialId; position: Vector3D; temperature: number }>,
    deltaTime: number
  ) =>
    Effect.gen(function* () {
      const newTemperatures: number[] = []

      for (let i = 0; i < materials.length; i++) {
        const current = materials[i]
        const currentMaterial = yield* materialRegistry.get(current.material)
        let totalHeatFlow = 0

        // 近隣の材質との熱交換計算
        for (let j = 0; j < materials.length; j++) {
          if (i === j) continue

          const neighbor = materials[j]
          const neighborMaterial = yield* materialRegistry.get(neighbor.material)
          const distance = calculateDistance3D(current.position, neighbor.position)

          if (distance < 2.0) { // 熱交換範囲
            const temperatureDiff = neighbor.temperature - current.temperature
            const conductivity = Math.sqrt(
              currentMaterial.physical.conductivity.thermal *
              neighborMaterial.physical.conductivity.thermal
            )

            // フーリエの法則による熱伝導
            const heatFlow = conductivity * temperatureDiff * (1 / distance) * deltaTime
            totalHeatFlow += heatFlow
          }
        }

        // 環境との熱交換（輻射・対流）
        const ambientTemp = currentMaterial.environmental.temperature.ambient
        const surfaceArea = 1.0 // 簡略化
        const emissivity = 0.9 // 材質に応じた放射率

        // ステファン・ボルツマン法則による放射
        const radiativeHeatLoss = emissivity * 5.67e-8 * surfaceArea *
          (Math.pow(current.temperature + 273.15, 4) - Math.pow(ambientTemp + 273.15, 4)) * deltaTime

        const newTemp = current.temperature + totalHeatFlow - radiativeHeatLoss / 1000

        // 相変化チェック
        const finalTemp = yield* checkPhaseTransition(currentMaterial, newTemp)
        newTemperatures.push(finalTemp)
      }

      return newTemperatures
    })

  const calculateFriction = (
    materialA: MaterialId,
    materialB: MaterialId,
    normalForce: number,
    velocity: Vector3D
  ) =>
    Effect.gen(function* () {
      const cacheKey = `${materialA}:${materialB}:${normalForce}`
      const cache = yield* Ref.get(frictionCache)

      const matA = yield* materialRegistry.get(materialA)
      const matB = yield* materialRegistry.get(materialB)

      // 摩擦係数計算（幾何平均）
      const frictionCoeff = Math.sqrt(matA.physical.friction * matB.physical.friction)
      const frictionForce = frictionCoeff * normalForce

      const velocityMagnitude = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)

      if (velocityMagnitude === 0) {
        return { x: 0, y: 0, z: 0 }
      }

      const frictionDirection = {
        x: -velocity.x / velocityMagnitude,
        y: -velocity.y / velocityMagnitude,
        z: -velocity.z / velocityMagnitude
      }

      const frictionVector = {
        x: frictionDirection.x * frictionForce,
        y: frictionDirection.y * frictionForce,
        z: frictionDirection.z * frictionForce
      }

      return frictionVector
    })

  const simulateChemicalReaction = (
    reactants: ReadonlyArray<MaterialReactant>,
    conditions: ReactionConditions
  ) =>
    Effect.gen(function* () {
      const products: MaterialProduct[] = []
      let energyReleased = 0
      let reactionRate = 0

      for (const reactant of reactants) {
        const material = yield* materialRegistry.get(reactant.materialId)
        const reactions = material.interaction.chemicalReactions

        for (const reaction of reactions) {
          // 反応条件チェック
          if (reaction.conditions) {
            const { temperature, pressure, time } = reaction.conditions

            if (temperature &&
                (conditions.temperature < temperature.min || conditions.temperature > temperature.max)) {
              continue
            }

            if (pressure && conditions.pressure < pressure) {
              continue
            }

            if (time && conditions.time < time) {
              continue
            }
          }

          // 触媒の存在チェック
          if (reaction.catalyst) {
            const hasCatalyst = reactants.some(r => r.materialId === reaction.catalyst)
            if (!hasCatalyst) continue
          }

          // 反応速度計算（アレニウス式）
          const activationEnergy = 50000 // J/mol (材質依存)
          const gasConstant = 8.314 // J/(mol·K)
          const rate = Math.exp(-activationEnergy / (gasConstant * (conditions.temperature + 273.15)))

          reactionRate = Math.max(reactionRate, rate)

          // 生成物計算
          for (const product of reaction.products) {
            const amount = reactant.amount * product.probability * rate
            products.push({
              materialId: product.material,
              amount,
              energy: amount * 1000 // 簡略化されたエネルギー
            })
            energyReleased += amount * 1000
          }
        }
      }

      return {
        products,
        energyReleased,
        reactionRate,
        byproducts: [],
        duration: 1000 / Math.max(reactionRate, 0.001)
      } as ReactionResult
    })

  const updateMaterialState = (
    material: MaterialId,
    position: Vector3D,
    conditions: EnvironmentalConditions,
    deltaTime: number
  ) =>
    Effect.gen(function* () {
      const materialDef = yield* materialRegistry.get(material)
      const updates: MaterialStateUpdate = {
        colorChange: null,
        textureChange: null,
        propertyChanges: {},
        newState: materialDef.state,
        durabilityLoss: 0
      }

      // 気象による変化
      if (conditions.weather) {
        const resistance = materialDef.environmental.weatherResistance

        switch (conditions.weather.type) {
          case "rain":
            if (resistance.rain < conditions.weather.intensity) {
              updates.durabilityLoss += (conditions.weather.intensity - resistance.rain) * deltaTime * 0.01

              // 金属の錆
              if (materialDef.category === "metal" && Math.random() < 0.001) {
                updates.colorChange = adjustColorForRust(materialDef.visual.color.primary)
              }
            }
            break

          case "uv":
            if (resistance.uv < conditions.weather.intensity) {
              updates.durabilityLoss += (conditions.weather.intensity - resistance.uv) * deltaTime * 0.005

              // 色褪せ
              if (Math.random() < 0.0001) {
                updates.colorChange = fadeColor(materialDef.visual.color.primary)
              }
            }
            break
        }
      }

      // 温度による相変化
      if (conditions.temperature !== materialDef.environmental.temperature.ambient) {
        const tempDiff = Math.abs(conditions.temperature - materialDef.environmental.temperature.ambient)

        if (materialDef.environmental.temperature.melting &&
            conditions.temperature > materialDef.environmental.temperature.melting) {
          updates.newState = "liquid"
          updates.propertyChanges["viscosity"] = materialDef.physical.viscosity * 0.1
        }

        if (materialDef.environmental.temperature.boiling &&
            conditions.temperature > materialDef.environmental.temperature.boiling) {
          updates.newState = "gas"
          updates.propertyChanges["density"] = materialDef.physical.density * 0.001
        }

        // 熱膨張
        const expansionRate = 0.00001 // 線膨張係数（簡略化）
        const expansionFactor = 1 + expansionRate * tempDiff
        updates.propertyChanges["density"] = materialDef.physical.density / (expansionFactor ** 3)
      }

      // バイオーム適応
      if (conditions.biome && materialDef.environmental.biomeAdaptation[conditions.biome]) {
        const adaptation = materialDef.environmental.biomeAdaptation[conditions.biome]

        if (adaptation.colorVariation) {
          updates.colorChange = adaptation.colorVariation
        }

        if (adaptation.textureVariation) {
          updates.textureChange = adaptation.textureVariation
        }

        if (adaptation.propertyModifiers) {
          Object.assign(updates.propertyChanges, adaptation.propertyModifiers)
        }
      }

      return updates
    })

  // ヘルパー関数
  const checkPhaseTransition = (material: MaterialDefinition, temperature: number) =>
    Effect.gen(function* () {
      const { melting, boiling } = material.environmental.temperature

      if (melting && temperature > melting) {
        if (boiling && temperature > boiling) {
          return Math.min(temperature, boiling + 50) // 沸点で安定
        }
        return Math.min(temperature, melting + 100) // 融点付近で安定
      }

      return temperature
    })

  const calculateImpactDamage = (
    matA: MaterialDefinition,
    matB: MaterialDefinition,
    velocity: number
  ): number => {
    const hardnessDiff = Math.abs(matA.physical.hardness - matB.physical.hardness)
    const impactEnergy = 0.5 * matA.physical.density * velocity * velocity
    return (impactEnergy * hardnessDiff) / 1000000 // 正規化
  }

  return MaterialPhysicsService.of({
    calculateCollision,
    simulateFluidFlow,
    processTemperatureExchange,
    calculateFriction,
    simulateChemicalReaction,
    updateMaterialState
  })
})

// Live Layer
export const MaterialPhysicsServiceLive = Layer.effect(
  MaterialPhysicsService,
  makeMaterialPhysicsService
).pipe(
  Layer.provide(MaterialRegistryLive)
)
```

## Material Rendering System

### Advanced Visual Processing

```typescript
// MaterialRenderingServiceインターフェース
interface MaterialRenderingServiceInterface {
  readonly generateShader: (material: MaterialDefinition) => Effect.Effect<ShaderProgram, ShaderError>
  readonly createTexture: (material: MaterialDefinition, resolution: number) => Effect.Effect<Texture, TextureError>
  readonly calculateLighting: (
    material: MaterialDefinition,
    lightSources: ReadonlyArray<LightSource>,
    viewDirection: Vector3D,
    normal: Vector3D
  ) => Effect.Effect<LightingResult, never>
  readonly generateNormalMap: (material: MaterialDefinition) => Effect.Effect<NormalMap, never>
  readonly createMaterialAtlas: (materials: ReadonlyArray<MaterialDefinition>) => Effect.Effect<TextureAtlas, AtlasError>
  readonly optimizeForLOD: (material: MaterialDefinition, distance: number) => Effect.Effect<LODMaterial, never>
  readonly batchRender: (materials: ReadonlyArray<RenderInstance>) => Effect.Effect<RenderResult, RenderError>
}

// Context Tag（最新パターン）
export const MaterialRenderingService = Context.GenericTag<MaterialRenderingServiceInterface>("@app/MaterialRenderingService")

// 高性能レンダリングシステム実装
const makeMaterialRenderingService = Effect.gen(function* () {
  const materialRegistry = yield* MaterialRegistry

  // シェーダーキャッシュ
  const shaderCache = yield* Ref.make(new Map<MaterialId, ShaderProgram>())
  const textureCache = yield* Ref.make(new Map<string, Texture>())
  const lightingCache = yield* Ref.make(new Map<string, LightingResult>())

  // レンダリング統計
  const renderStats = yield* Ref.make({
    shadersGenerated: 0,
    texturesCreated: 0,
    drawCalls: 0,
    triangles: 0,
    cacheHits: 0
  })

  const generateShader = (material: MaterialDefinition) =>
    Effect.gen(function* () {
      const cache = yield* Ref.get(shaderCache)

      if (cache.has(material.id)) {
        yield* Ref.update(renderStats, s => ({ ...s, cacheHits: s.cacheHits + 1 }))
        return cache.get(material.id)!
      }

      // 動的シェーダー生成
      let vertexShader = `
        #version 330 core
        layout (location = 0) in vec3 aPos;
        layout (location = 1) in vec3 aNormal;
        layout (location = 2) in vec2 aTexCoord;
        layout (location = 3) in vec3 aTangent;

        out vec3 FragPos;
        out vec3 Normal;
        out vec2 TexCoord;
        out mat3 TBN;

        uniform mat4 model;
        uniform mat4 view;
        uniform mat4 projection;
        uniform mat3 normalMatrix;

        void main() {
          FragPos = vec3(model * vec4(aPos, 1.0));
          Normal = normalMatrix * aNormal;
          TexCoord = aTexCoord;

          vec3 T = normalize(vec3(model * vec4(aTangent, 0.0)));
          vec3 N = normalize(Normal);
          vec3 B = cross(N, T);
          TBN = mat3(T, B, N);

          gl_Position = projection * view * vec4(FragPos, 1.0);
        }
      `

      let fragmentShader = `
        #version 330 core
        out vec4 FragColor;

        in vec3 FragPos;
        in vec3 Normal;
        in vec2 TexCoord;
        in mat3 TBN;

        // マテリアル特性
        uniform vec3 material_color;
        uniform float material_metallic;
        uniform float material_roughness;
        uniform float material_opacity;
        uniform float material_emission;

        // テクスチャ
        uniform sampler2D texture_diffuse;
        uniform sampler2D texture_normal;
        uniform sampler2D texture_roughness;
        uniform sampler2D texture_metallic;
        uniform sampler2D texture_emission;

        // ライティング
        uniform vec3 lightPos[8];
        uniform vec3 lightColor[8];
        uniform float lightIntensity[8];
        uniform int numLights;
        uniform vec3 viewPos;
        uniform vec3 ambientColor;

        // PBR関数
        vec3 calculatePBR(vec3 albedo, float metallic, float roughness, vec3 normal, vec3 viewDir, vec3 lightDir, vec3 lightColor) {
          vec3 halfwayDir = normalize(lightDir + viewDir);

          // フレネル反射
          vec3 F0 = mix(vec3(0.04), albedo, metallic);
          vec3 F = F0 + (1.0 - F0) * pow(1.0 - max(dot(halfwayDir, viewDir), 0.0), 5.0);

          // 法線分布関数 (GGX/Trowbridge-Reitz)
          float alpha = roughness * roughness;
          float alpha2 = alpha * alpha;
          float NdotH = max(dot(normal, halfwayDir), 0.0);
          float NdotH2 = NdotH * NdotH;
          float denom = (NdotH2 * (alpha2 - 1.0) + 1.0);
          float D = alpha2 / (3.14159265 * denom * denom);

          // 幾何減衰関数
          float NdotV = max(dot(normal, viewDir), 0.0);
          float NdotL = max(dot(normal, lightDir), 0.0);
          float k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
          float G1V = NdotV / (NdotV * (1.0 - k) + k);
          float G1L = NdotL / (NdotL * (1.0 - k) + k);
          float G = G1V * G1L;

          // BRDF
          vec3 numerator = D * G * F;
          float denominator = 4.0 * NdotV * NdotL + 0.001;
          vec3 specular = numerator / denominator;

          vec3 kS = F;
          vec3 kD = vec3(1.0) - kS;
          kD *= 1.0 - metallic;

          return (kD * albedo / 3.14159265 + specular) * lightColor * NdotL;
        }

        void main() {
          // マテリアル特性の取得
          vec4 albedoTex = texture(texture_diffuse, TexCoord);
          vec3 albedo = albedoTex.rgb * material_color;
          float alpha = albedoTex.a * material_opacity;

          // 法線マッピング
          vec3 normalMap = texture(texture_normal, TexCoord).rgb * 2.0 - 1.0;
          vec3 normal = normalize(TBN * normalMap);

          // マテリアル特性テクスチャ
          float metallic = texture(texture_metallic, TexCoord).r * material_metallic;
          float roughness = texture(texture_roughness, TexCoord).r * material_roughness;
          vec3 emission = texture(texture_emission, TexCoord).rgb * material_emission;

          vec3 viewDir = normalize(viewPos - FragPos);
          vec3 color = ambientColor * albedo * 0.03;

          // ライティング計算
          for(int i = 0; i < numLights && i < 8; i++) {
            vec3 lightDir = normalize(lightPos[i] - FragPos);
            float distance = length(lightPos[i] - FragPos);
            float attenuation = 1.0 / (1.0 + 0.09 * distance + 0.032 * distance * distance);
            vec3 radiance = lightColor[i] * lightIntensity[i] * attenuation;

            color += calculatePBR(albedo, metallic, roughness, normal, viewDir, lightDir, radiance);
          }

          // エミッション追加
          color += emission;
      `

      // 材質固有の効果を追加
      if (material.visual.transparency !== "opaque") {
        fragmentShader += `
          // 透明度処理
          if(alpha < 0.1) discard;
        `
      }

      if (material.category === "liquid") {
        fragmentShader += `
          // 液体の屈折効果
          vec2 distortedCoord = TexCoord + sin(FragPos.y * 10.0 + gl_FragCoord.x * 0.1) * 0.01;
          albedo = texture(texture_diffuse, distortedCoord).rgb * material_color;
        `
      }

      if (material.physical.conductivity.electrical > 0.5) {
        fragmentShader += `
          // 導電性材質のスパーク効果
          float sparkle = sin(gl_FragCoord.x * 0.5) * sin(gl_FragCoord.y * 0.3) * 0.1;
          color += vec3(sparkle * material_metallic);
        `
      }

      fragmentShader += `
          // HDRトーンマッピング
          color = color / (color + vec3(1.0));

          // ガンマ補正
          color = pow(color, vec3(1.0/2.2));

          FragColor = vec4(color, alpha);
        }
      `

      const shader: ShaderProgram = {
        id: `shader_${material.id}`,
        vertexSource: vertexShader,
        fragmentSource: fragmentShader,
        uniforms: extractUniforms(material),
        compiled: false
      }

      yield* Ref.update(shaderCache, cache => new Map(cache).set(material.id, shader))
      yield* Ref.update(renderStats, s => ({ ...s, shadersGenerated: s.shadersGenerated + 1 }))

      return shader
    })

  const createTexture = (material: MaterialDefinition, resolution: number) =>
    Effect.gen(function* () {
      const cacheKey = `${material.id}:${resolution}`
      const cache = yield* Ref.get(textureCache)

      if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!
      }

      // プロシージャルテクスチャ生成
      const texture = yield* generateProceduralTexture(material, resolution)

      yield* Ref.update(textureCache, cache => new Map(cache).set(cacheKey, texture))
      yield* Ref.update(renderStats, s => ({ ...s, texturesCreated: s.texturesCreated + 1 }))

      return texture
    })

  const calculateLighting = (
    material: MaterialDefinition,
    lightSources: ReadonlyArray<LightSource>,
    viewDirection: Vector3D,
    normal: Vector3D
  ) =>
    Effect.gen(function* () {
      const cacheKey = `${material.id}:${lightSources.length}:${viewDirection.x},${viewDirection.y},${viewDirection.z}`
      const cache = yield* Ref.get(lightingCache)

      if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!
      }

      let diffuse = { r: 0, g: 0, b: 0 }
      let specular = { r: 0, g: 0, b: 0 }

      const baseColor = hexToRgb(material.visual.color.primary)
      const metallic = material.visual.metallic
      const roughness = material.visual.roughness

      for (const light of lightSources) {
        const lightDir = normalizeVector3D(light.direction)

        // ランバート拡散反射
        const NdotL = Math.max(dot(normal, lightDir), 0)

        diffuse.r += baseColor.r * light.color.r * light.intensity * NdotL * (1 - metallic)
        diffuse.g += baseColor.g * light.color.g * light.intensity * NdotL * (1 - metallic)
        diffuse.b += baseColor.b * light.color.b * light.intensity * NdotL * (1 - metallic)

        // クック・トランス鏡面反射
        const halfVector = normalizeVector3D({
          x: (lightDir.x + viewDirection.x) / 2,
          y: (lightDir.y + viewDirection.y) / 2,
          z: (lightDir.z + viewDirection.z) / 2
        })

        const NdotH = Math.max(dot(normal, halfVector), 0)
        const VdotH = Math.max(dot(viewDirection, halfVector), 0)

        // フレネル反射係数
        const F0 = metallic * 0.04 + (1 - metallic) * 0.02
        const F = F0 + (1 - F0) * Math.pow(1 - VdotH, 5)

        // 法線分布関数 (GGX)
        const alpha = roughness * roughness
        const alpha2 = alpha * alpha
        const denom = NdotH * NdotH * (alpha2 - 1) + 1
        const D = alpha2 / (Math.PI * denom * denom)

        // 幾何減衰関数
        const NdotV = Math.max(dot(normal, viewDirection), 0)
        const k = (roughness + 1) * (roughness + 1) / 8
        const G1L = NdotL / (NdotL * (1 - k) + k)
        const G1V = NdotV / (NdotV * (1 - k) + k)
        const G = G1L * G1V

        // BRDF
        const brdf = (D * G * F) / (4 * NdotV * NdotL + 0.001)

        specular.r += light.color.r * light.intensity * brdf
        specular.g += light.color.g * light.intensity * brdf
        specular.b += light.color.b * light.intensity * brdf
      }

      // 環境光の追加
      const ambient = 0.03
      diffuse.r += baseColor.r * ambient
      diffuse.g += baseColor.g * ambient
      diffuse.b += baseColor.b * ambient

      // 発光の追加
      if (material.visual.color.emissive) {
        const emissive = hexToRgb(material.visual.color.emissive)
        diffuse.r += emissive.r * material.visual.luminance / 15
        diffuse.g += emissive.g * material.visual.luminance / 15
        diffuse.b += emissive.b * material.visual.luminance / 15
      }

      const result: LightingResult = {
        diffuse: {
          r: Math.min(diffuse.r, 1),
          g: Math.min(diffuse.g, 1),
          b: Math.min(diffuse.b, 1)
        },
        specular: {
          r: Math.min(specular.r, 1),
          g: Math.min(specular.g, 1),
          b: Math.min(specular.b, 1)
        },
        ambient: { r: ambient, g: ambient, b: ambient },
        shadow: calculateShadow(material, lightSources, normal)
      }

      yield* Ref.update(lightingCache, cache => new Map(cache).set(cacheKey, result))
      return result
    })

  const generateNormalMap = (material: MaterialDefinition) =>
    Effect.gen(function* () {
      const resolution = 256
      const normalData = new Uint8Array(resolution * resolution * 4)

      // マテリアル特性に基づく法線マップ生成
      for (let y = 0; y < resolution; y++) {
        for (let x = 0; x < resolution; x++) {
          const index = (y * resolution + x) * 4

          let normal = { x: 0, y: 0, z: 1 }

          // 材質カテゴリに応じたパターン生成
          switch (material.category) {
            case "stone":
              normal = generateStoneNormal(x / resolution, y / resolution, material.physical.roughness)
              break
            case "metal":
              normal = generateMetalNormal(x / resolution, y / resolution, material.physical.hardness)
              break
            case "organic":
              normal = generateOrganicNormal(x / resolution, y / resolution, material.physical.density)
              break
            case "liquid":
              normal = generateLiquidNormal(x / resolution, y / resolution, material.physical.viscosity)
              break
          }

          // 法線を[0,1]範囲に正規化
          normalData[index] = Math.floor((normal.x + 1) * 127.5)     // R
          normalData[index + 1] = Math.floor((normal.y + 1) * 127.5) // G
          normalData[index + 2] = Math.floor((normal.z + 1) * 127.5) // B
          normalData[index + 3] = 255                                 // A
        }
      }

      return {
        width: resolution,
        height: resolution,
        data: normalData,
        format: "RGBA8"
      } as NormalMap
    })

  const createMaterialAtlas = (materials: ReadonlyArray<MaterialDefinition>) =>
    Effect.gen(function* () {
      const atlasSize = Math.ceil(Math.sqrt(materials.length)) * 256
      const atlasData = new Uint8Array(atlasSize * atlasSize * 4)

      const textureCoords: Record<MaterialId, TextureCoords> = {}

      let currentX = 0
      let currentY = 0
      const tileSize = 256

      for (let i = 0; i < materials.length; i++) {
        const material = materials[i]
        const texture = yield* createTexture(material, tileSize)

        // テクスチャをアトラスにコピー
        for (let y = 0; y < tileSize; y++) {
          for (let x = 0; x < tileSize; x++) {
            const srcIndex = (y * tileSize + x) * 4
            const dstIndex = ((currentY + y) * atlasSize + (currentX + x)) * 4

            atlasData[dstIndex] = texture.data[srcIndex]
            atlasData[dstIndex + 1] = texture.data[srcIndex + 1]
            atlasData[dstIndex + 2] = texture.data[srcIndex + 2]
            atlasData[dstIndex + 3] = texture.data[srcIndex + 3]
          }
        }

        // UV座標を記録
        textureCoords[material.id] = {
          u: currentX / atlasSize,
          v: currentY / atlasSize,
          width: tileSize / atlasSize,
          height: tileSize / atlasSize
        }

        currentX += tileSize
        if (currentX >= atlasSize) {
          currentX = 0
          currentY += tileSize
        }
      }

      return {
        width: atlasSize,
        height: atlasSize,
        data: atlasData,
        textureCoords,
        format: "RGBA8"
      } as TextureAtlas
    })

  const optimizeForLOD = (material: MaterialDefinition, distance: number) =>
    Effect.gen(function* () {
      // 距離に基づくLOD計算
      const lodLevel = Math.min(Math.floor(distance / 50), 3)

      const lodMaterial: LODMaterial = {
        ...material,
        visual: {
          ...material.visual,
          // 距離に応じてテクスチャ解像度を下げる
          textureResolution: Math.max(64, 512 >> lodLevel),
          // 詳細効果を無効化
          ambientOcclusion: lodLevel < 2 ? material.visual.ambientOcclusion : false,
          // シンプルなシェーダーに切り替え
          shaderComplexity: Math.max(1, 4 - lodLevel)
        },
        // 物理演算の簡略化
        physical: {
          ...material.physical,
          // 遠距離では詳細な物理計算を省略
          detailedPhysics: lodLevel < 2
        },
        lodLevel
      }

      return lodMaterial
    })

  const batchRender = (materials: ReadonlyArray<RenderInstance>) =>
    Effect.gen(function* () {
      // マテリアル別にグループ化
      const materialGroups = new Map<MaterialId, RenderInstance[]>()

      for (const instance of materials) {
        const group = materialGroups.get(instance.materialId) || []
        group.push(instance)
        materialGroups.set(instance.materialId, group)
      }

      let totalDrawCalls = 0
      let totalTriangles = 0

      // バッチレンダリング実行
      for (const [materialId, instances] of materialGroups) {
        const material = yield* materialRegistry.get(materialId)
        const shader = yield* generateShader(material)

        // インスタンス配列の作成
        const instanceData = createInstanceBuffer(instances)

        // GPU描画コマンド
        const drawCall = {
          shader: shader.id,
          instances: instances.length,
          triangles: instances.length * 12, // キューブの場合
          instanceBuffer: instanceData
        }

        totalDrawCalls++
        totalTriangles += drawCall.triangles
      }

      yield* Ref.update(renderStats, s => ({
        ...s,
        drawCalls: s.drawCalls + totalDrawCalls,
        triangles: s.triangles + totalTriangles
      }))

      return {
        drawCalls: totalDrawCalls,
        triangles: totalTriangles,
        materialGroups: materialGroups.size,
        renderTime: performance.now()
      } as RenderResult
    })

  return MaterialRenderingService.of({
    generateShader,
    createTexture,
    calculateLighting,
    generateNormalMap,
    createMaterialAtlas,
    optimizeForLOD,
    batchRender
  })
})

// Live Layer
export const MaterialRenderingServiceLive = Layer.effect(
  MaterialRenderingService,
  makeMaterialRenderingService
).pipe(
  Layer.provide(MaterialRegistryLive)
)
```

## Sound System Integration

### Advanced Audio Processing

```typescript
// MaterialSoundServiceインターフェース
interface MaterialSoundServiceInterface {
  readonly playMaterialSound: (
    materialId: MaterialId,
    soundType: MaterialSoundType,
    position: Vector3D,
    intensity: number
  ) => Effect.Effect<SoundInstance, AudioError>

  readonly calculateAcoustics: (
    materialId: MaterialId,
    room: Room,
    sourcePosition: Vector3D,
    listenerPosition: Vector3D
  ) => Effect.Effect<AcousticProperties, never>

  readonly generateAmbientSounds: (
    materials: ReadonlyArray<{ materialId: MaterialId; position: Vector3D; temperature: number }>,
    weather: WeatherConditions
  ) => Effect.Effect<ReadonlyArray<AmbientSound>, never>

  readonly processReverberation: (
    sound: SoundInstance,
    environment: AcousticEnvironment
  ) => Effect.Effect<ReverbParameters, never>

  readonly simulateEcho: (
    materialId: MaterialId,
    soundPath: ReadonlyArray<Vector3D>
  ) => Effect.Effect<EchoEffect, never>
}

// Context Tag（最新パターン）
export const MaterialSoundService = Context.GenericTag<MaterialSoundServiceInterface>("@app/MaterialSoundService")

// 高度な音響処理実装
const makeMaterialSoundService = Effect.gen(function* () {
  const materialRegistry = yield* MaterialRegistry
  const audioEngine = yield* AudioEngine

  // 音響キャッシュ
  const acousticCache = yield* Ref.make(new Map<string, AcousticProperties>())
  const reverbCache = yield* Ref.make(new Map<string, ReverbParameters>())

  const playMaterialSound = (
    materialId: MaterialId,
    soundType: MaterialSoundType,
    position: Vector3D,
    intensity: number
  ) =>
    Effect.gen(function* () {
      const material = yield* materialRegistry.get(materialId)
      const acoustic = material.acoustic

      // 音響ファイルの選択
      let soundFiles: ReadonlyArray<string>
      switch (soundType) {
        case "footstep":
          soundFiles = acoustic.footstepSounds
          break
        case "break":
          soundFiles = acoustic.breakSounds
          break
        case "place":
          soundFiles = acoustic.placeSounds
          break
        case "hit":
          soundFiles = acoustic.hitSounds
          break
        case "ambient":
          soundFiles = acoustic.ambientSounds || []
          break
        default:
          soundFiles = acoustic.footstepSounds
      }

      if (soundFiles.length === 0) {
        return yield* Effect.fail(new AudioError("No sound files available for material"))
      }

      // ランダムに音響ファイルを選択
      const selectedSound = soundFiles[Math.floor(Math.random() * soundFiles.length)]

      // 音響特性の計算
      const volume = acoustic.volume * intensity
      const pitch = acoustic.pitch + (Math.random() - 0.5) * 0.1 // わずかなピッチ変動

      // 材質特性に基づく音響調整
      const densityFactor = material.physical.density / 1000 // kg/m³を基準化
      const hardnessFactor = material.physical.hardness / 10

      const adjustedVolume = volume * Math.sqrt(densityFactor)
      const adjustedPitch = pitch * (1 + hardnessFactor * 0.1)

      // 音響再生
      const soundInstance = yield* audioEngine.playSound({
        file: selectedSound,
        position,
        volume: Math.min(adjustedVolume, 1),
        pitch: Math.max(0.5, Math.min(adjustedPitch, 2.0)),
        reverb: acoustic.reverb || 0,
        echo: acoustic.echo || 0,
        dampening: acoustic.dampening
      })

      return soundInstance
    })

  const calculateAcoustics = (
    materialId: MaterialId,
    room: Room,
    sourcePosition: Vector3D,
    listenerPosition: Vector3D
  ) =>
    Effect.gen(function* () {
      const cacheKey = `${materialId}:${room.id}:${sourcePosition.x},${sourcePosition.y},${sourcePosition.z}`
      const cache = yield* Ref.get(acousticCache)

      if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!
      }

      const material = yield* materialRegistry.get(materialId)

      // 音響伝播の計算
      const distance = calculateDistance3D(sourcePosition, listenerPosition)
      const directPath = calculateDirectPath(sourcePosition, listenerPosition, room)

      // 反射の計算
      const reflections = yield* calculateReflections(material, room, sourcePosition, listenerPosition)

      // 残響時間の計算 (RT60)
      const rt60 = calculateRT60(room, material)

      // 音響減衰
      let attenuation = 1 / (1 + distance * distance * 0.01)

      // 空気による吸収
      const airAbsorption = calculateAirAbsorption(distance, room.humidity, room.temperature)
      attenuation *= airAbsorption

      // 材質による吸収
      const materialAbsorption = material.acoustic.dampening
      attenuation *= (1 - materialAbsorption)

      const acoustics: AcousticProperties = {
        attenuation,
        reverberation: rt60,
        reflections,
        directPath: directPath.length,
        totalDelay: directPath.length / 343, // 音速 343 m/s
        frequency_response: calculateFrequencyResponse(material, distance)
      }

      yield* Ref.update(acousticCache, cache => new Map(cache).set(cacheKey, acoustics))
      return acoustics
    })

  const generateAmbientSounds = (
    materials: ReadonlyArray<{ materialId: MaterialId; position: Vector3D; temperature: number }>,
    weather: WeatherConditions
  ) =>
    Effect.gen(function* () {
      const ambientSounds: AmbientSound[] = []

      for (const { materialId, position, temperature } of materials) {
        const material = yield* materialRegistry.get(materialId)

        // 温度による音響変化
        if (material.environmental.temperature.ambient !== temperature) {
          const tempDiff = Math.abs(temperature - material.environmental.temperature.ambient)

          // 熱膨張による音響効果
          if (tempDiff > 20) {
            ambientSounds.push({
              type: "thermal_expansion",
              position,
              volume: Math.min(tempDiff / 100, 0.3),
              frequency: 100 + tempDiff,
              duration: 2000 + Math.random() * 3000
            })
          }
        }

        // 金属の冷却音
        if (material.category === "metal" && temperature > material.environmental.temperature.ambient + 50) {
          ambientSounds.push({
            type: "cooling",
            position,
            volume: 0.2,
            frequency: 400 + Math.random() * 200,
            duration: 5000 + Math.random() * 5000
          })
        }

        // 液体の流動音
        if (material.state === "liquid" && material.physical.viscosity < 0.01) {
          ambientSounds.push({
            type: "flow",
            position,
            volume: 0.1,
            frequency: 200 + material.physical.viscosity * 1000,
            duration: -1 // 継続音
          })
        }

        // 気象による音響効果
        if (weather.rain && material.acoustic.soundType === "metal") {
          // 雨滴の音
          ambientSounds.push({
            type: "rain_drops",
            position,
            volume: weather.rain.intensity * 0.3,
            frequency: 800 + Math.random() * 400,
            duration: 200 + Math.random() * 300
          })
        }

        if (weather.wind && material.physical.density < 500) {
          // 風による振動音
          ambientSounds.push({
            type: "wind_vibration",
            position,
            volume: weather.wind.speed * 0.05,
            frequency: 50 + weather.wind.speed * 2,
            duration: 1000 + Math.random() * 2000
          })
        }
      }

      return ambientSounds
    })

  const processReverberation = (sound: SoundInstance, environment: AcousticEnvironment) =>
    Effect.gen(function* () {
      const cacheKey = `${sound.id}:${environment.id}`
      const cache = yield* Ref.get(reverbCache)

      if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!
      }

      // 残響パラメータの計算
      const roomSize = environment.volume
      const surfaceArea = environment.surfaceArea
      const averageAbsorption = environment.materials.reduce((sum, mat) =>
        sum + mat.acoustic.dampening, 0) / environment.materials.length

      // Sabineの公式による残響時間
      const rt60 = (0.161 * roomSize) / (surfaceArea * averageAbsorption)

      // 早期反射の計算
      const earlyReflections = calculateEarlyReflections(sound.position, environment)

      // 残響の周波数特性
      const frequencyResponse = environment.materials.map(mat => ({
        frequency: mat.acoustic.soundType === "metal" ? 2000 :
                   mat.acoustic.soundType === "wood" ? 1000 : 500,
        absorption: mat.acoustic.dampening
      }))

      const reverbParams: ReverbParameters = {
        rt60,
        earlyReflections,
        lateReverberation: rt60 * 0.8,
        density: Math.min(environment.complexity, 1),
        diffusion: averageAbsorption,
        frequencyResponse,
        predelay: calculatePredelay(sound.position, environment)
      }

      yield* Ref.update(reverbCache, cache => new Map(cache).set(cacheKey, reverbParams))
      return reverbParams
    })

  const simulateEcho = (materialId: MaterialId, soundPath: ReadonlyArray<Vector3D>) =>
    Effect.gen(function* () {
      const material = yield* materialRegistry.get(materialId)

      let totalDelay = 0
      let echoIntensity = 1.0
      const echoPoints: EchoPoint[] = []

      for (let i = 0; i < soundPath.length - 1; i++) {
        const segment = calculateDistance3D(soundPath[i], soundPath[i + 1])
        const segmentDelay = segment / 343 // 音速での伝播時間

        totalDelay += segmentDelay

        // 材質による反射減衰
        const reflectivity = 1 - material.acoustic.dampening
        echoIntensity *= Math.pow(reflectivity, i + 1)

        if (echoIntensity > 0.1) { // 聞こえるレベル以上
          echoPoints.push({
            position: soundPath[i + 1],
            delay: totalDelay * 1000, // ms
            intensity: echoIntensity,
            frequency_shift: calculateDopplerShift(soundPath[i], soundPath[i + 1])
          })
        }
      }

      return {
        totalDelay: totalDelay * 1000,
        echoPoints,
        finalIntensity: echoIntensity,
        path: soundPath
      } as EchoEffect
    })

  // ヘルパー関数
  const calculateRT60 = (room: Room, material: MaterialDefinition): number => {
    const volume = room.width * room.height * room.depth
    const surfaceArea = 2 * (room.width * room.height + room.width * room.depth + room.height * room.depth)
    const absorption = material.acoustic.dampening

    return (0.161 * volume) / (surfaceArea * absorption + 0.001)
  }

  const calculateAirAbsorption = (distance: number, humidity: number, temperature: number): number => {
    // 空気による高周波減衰 (簡略化)
    const absorptionCoeff = 0.1 + humidity * 0.05 + Math.abs(temperature - 20) * 0.001
    return Math.exp(-absorptionCoeff * distance / 100)
  }

  const calculateFrequencyResponse = (material: MaterialDefinition, distance: number) => {
    const response: FrequencyResponse[] = []

    // 材質特性に基づく周波数応答
    const baseFreqs = [100, 250, 500, 1000, 2000, 4000, 8000, 16000]

    for (const freq of baseFreqs) {
      let attenuation = 1.0

      // 材質による周波数依存の減衰
      if (material.category === "metal") {
        attenuation = freq < 2000 ? 1.0 : 0.8 // 高周波減衰
      } else if (material.category === "organic") {
        attenuation = freq < 1000 ? 0.9 : 0.6 // 広帯域減衰
      }

      // 距離による高周波減衰
      const distanceAttenuation = Math.exp(-freq * distance / 100000)

      response.push({
        frequency: freq,
        attenuation: attenuation * distanceAttenuation
      })
    }

    return response
  }

  const calculateDopplerShift = (start: Vector3D, end: Vector3D): number => {
    // ドップラー効果の簡略計算
    const velocity = calculateDistance3D(start, end) / 0.05 // 50msでの移動と仮定
    const soundSpeed = 343 // m/s

    return 1 + velocity / soundSpeed // 周波数シフト比
  }

  return MaterialSoundService.of({
    playMaterialSound,
    calculateAcoustics,
    generateAmbientSounds,
    processReverberation,
    simulateEcho
  })
})

// Live Layer
export const MaterialSoundServiceLive = Layer.effect(
  MaterialSoundService,
  makeMaterialSoundService
).pipe(
  Layer.provide(MaterialRegistryLive),
  Layer.provide(AudioEngineLive)
)
```

## Performance Optimization

### Advanced Caching and Memory Management

```typescript
// MaterialPerformanceServiceインターフェース
interface MaterialPerformanceServiceInterface {
  readonly optimizeMemoryUsage: () => Effect.Effect<MemoryStats, never>
  readonly preloadMaterials: (region: WorldRegion) => Effect.Effect<void, never>
  readonly compactMaterialData: () => Effect.Effect<CompressionStats, never>
  readonly profileMaterialUsage: (duration: number) => Effect.Effect<UsageProfile, never>
  readonly enableAdaptiveLOD: (enabled: boolean) => Effect.Effect<void, never>
  readonly batchMaterialOperations: (operations: ReadonlyArray<MaterialOperation>) => Effect.Effect<ReadonlyArray<OperationResult>, never>
}

// Context Tag（最新パターン）
export const MaterialPerformanceService = Context.GenericTag<MaterialPerformanceServiceInterface>("@app/MaterialPerformanceService")

// 高性能最適化システム実装
const makeMaterialPerformanceService = Effect.gen(function* () {
  const materialRegistry = yield* MaterialRegistry

  // パフォーマンス統計
  const performanceStats = yield* Ref.make({
    totalMaterials: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    loadTime: 0,
    compressionRatio: 0,
    adaptiveLODEnabled: true
  })

  // メモリプール
  const materialPool = yield* Effect.sync(() => createMemoryPool(1024 * 1024 * 10)) // 10MB
  const texturePool = yield* Effect.sync(() => createMemoryPool(1024 * 1024 * 50))  // 50MB
  const shaderPool = yield* Effect.sync(() => createMemoryPool(1024 * 1024 * 5))    // 5MB

  const optimizeMemoryUsage = () =>
    Effect.gen(function* () {
      const startTime = performance.now()

      // メモリプールの最適化
      yield* compactMemoryPool(materialPool)
      yield* compactMemoryPool(texturePool)
      yield* compactMemoryPool(shaderPool)

      // 未使用キャッシュの削除
      yield* cleanupUnusedCache()

      // ガベージコレクションの実行
      yield* forceGarbageCollection()

      const endTime = performance.now()

      const stats: MemoryStats = {
        totalAllocated: yield* calculateTotalMemory(),
        materialData: yield* calculateMaterialMemory(),
        textureData: yield* calculateTextureMemory(),
        shaderData: yield* calculateShaderMemory(),
        cacheData: yield* calculateCacheMemory(),
        fragmentation: yield* calculateFragmentation(),
        optimizationTime: endTime - startTime
      }

      yield* Ref.update(performanceStats, s => ({
        ...s,
        memoryUsage: stats.totalAllocated,
        loadTime: stats.optimizationTime
      }))

      return stats
    })

  const preloadMaterials = (region: WorldRegion) =>
    Effect.gen(function* () {
      // 地域の材質を予測
      const predictedMaterials = yield* predictRegionMaterials(region)

      // 並列プリロード（バッチサイズ制限）
      yield* Effect.all(
        predictedMaterials.map(materialId =>
          Effect.gen(function* () {
            const material = yield* materialRegistry.get(materialId)

            // シェーダーとテクスチャを事前生成
            yield* preloadMaterialAssets(material)
          })
        ),
        { concurrency: 4 } // CPU負荷制限
      )

      // プリロード統計更新
      yield* updatePreloadStats(predictedMaterials.length)
    })

  const compactMaterialData = () =>
    Effect.gen(function* () {
      const startTime = performance.now()
      const originalSize = yield* calculateTotalMemory()

      // Structure of Arrays (SoA) の最適化
      yield* optimizeStructureOfArrays()

      // データ圧縮
      yield* compressStaticData()

      // インデックス最適化
      yield* optimizeIndices()

      const endTime = performance.now()
      const finalSize = yield* calculateTotalMemory()

      const stats: CompressionStats = {
        originalSize,
        compressedSize: finalSize,
        compressionRatio: originalSize / finalSize,
        timeSpent: endTime - startTime,
        memoryFreed: originalSize - finalSize
      }

      yield* Ref.update(performanceStats, s => ({
        ...s,
        compressionRatio: stats.compressionRatio
      }))

      return stats
    })

  const profileMaterialUsage = (duration: number) =>
    Effect.gen(function* () {
      const profiler = yield* startProfiling()

      yield* Effect.sleep(Duration.millis(duration))

      const profile = yield* stopProfiling(profiler)

      return {
        mostUsedMaterials: profile.materialFrequency,
        performanceHotspots: profile.hotspots,
        memoryPressure: profile.memoryPressure,
        cacheEfficiency: profile.cacheStats,
        renderingBottlenecks: profile.renderStats
      } as UsageProfile
    })

  const enableAdaptiveLOD = (enabled: boolean) =>
    Effect.gen(function* () {
      yield* Ref.update(performanceStats, s => ({
        ...s,
        adaptiveLODEnabled: enabled
      }))

      if (enabled) {
        yield* startLODMonitoring()
      } else {
        yield* stopLODMonitoring()
      }
    })

  const batchMaterialOperations = (operations: ReadonlyArray<MaterialOperation>) =>
    Effect.gen(function* () {
      // 操作タイプ別にグループ化
      const grouped = groupOperationsByType(operations)

      const results: OperationResult[] = []

      // 各タイプを並列実行
      const groupResults = yield* Effect.all([
        processBatch(grouped.register || [], "register"),
        processBatch(grouped.update || [], "update"),
        processBatch(grouped.delete || [], "delete"),
        processBatch(grouped.query || [], "query")
      ])

      return groupResults.flat()
    })

  // ヘルパー関数
  const predictRegionMaterials = (region: WorldRegion) =>
    Effect.gen(function* () {
      const materials: MaterialId[] = []

      // バイオーム基準の予測
      const biomeMap: Record<string, MaterialId[]> = {
        "plains": ["minecraft:grass" as MaterialId, "minecraft:dirt" as MaterialId, "minecraft:stone" as MaterialId],
        "desert": ["minecraft:sand" as MaterialId, "minecraft:sandstone" as MaterialId, "minecraft:cactus" as MaterialId],
        "forest": ["minecraft:wood" as MaterialId, "minecraft:leaves" as MaterialId, "minecraft:bark" as MaterialId],
        "mountain": ["minecraft:stone" as MaterialId, "minecraft:granite" as MaterialId, "minecraft:snow" as MaterialId],
        "ocean": ["minecraft:water" as MaterialId, "minecraft:sand" as MaterialId, "minecraft:coral" as MaterialId]
      }

      const biomeMaterials = biomeMap[region.biome] || []
      materials.push(...biomeMaterials)

      // 高度による調整
      if (region.elevation > 100) {
        materials.push("minecraft:stone" as MaterialId, "minecraft:snow" as MaterialId)
      }

      if (region.elevation < -50) {
        materials.push("minecraft:water" as MaterialId, "minecraft:lava" as MaterialId)
      }

      return materials
    })

  const preloadMaterialAssets = (material: MaterialDefinition) =>
    Effect.gen(function* () {
      // 非同期でアセットを準備
      const tasks = [
        generateMaterialShader(material),
        generateMaterialTextures(material),
        calculateMaterialPhysics(material),
        prepareMaterialAudio(material)
      ]

      yield* Effect.all(tasks, { concurrency: 2 })
    })

  const optimizeStructureOfArrays = () =>
    Effect.gen(function* () {
      // 構造体配列の再配置による最適化
      yield* reorderArraysByUsage()
      yield* eliminateUnusedFields()
      yield* packDataStructures()
    })

  const groupOperationsByType = (operations: ReadonlyArray<MaterialOperation>) => {
    return operations.reduce((groups, op) => {
      const type = op.type
      if (!groups[type]) groups[type] = []
      groups[type].push(op)
      return groups
    }, {} as Record<string, MaterialOperation[]>)
  }

  const processBatch = (operations: ReadonlyArray<MaterialOperation>, type: string) =>
    Effect.gen(function* () {
      const results: OperationResult[] = []

      // バッチサイズ制限
      const batchSize = 100

      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize)

        const batchResults = yield* Effect.all(
          batch.map(op => processOperation(op)),
          { concurrency: 10 }
        )

        results.push(...batchResults)
      }

      return results
    })

  return MaterialPerformanceService.of({
    optimizeMemoryUsage,
    preloadMaterials,
    compactMaterialData,
    profileMaterialUsage,
    enableAdaptiveLOD,
    batchMaterialOperations
  })
})

// Live Layer
export const MaterialPerformanceServiceLive = Layer.effect(
  MaterialPerformanceService,
  makeMaterialPerformanceService
).pipe(
  Layer.provide(MaterialRegistryLive)
)
```

## Complete Material System Layer

```typescript
// 完全なMaterial System統合レイヤー
export const MaterialSystemLayer = Layer.mergeAll(
  MaterialRegistryLive,
  MaterialPhysicsServiceLive,
  MaterialRenderingServiceLive,
  MaterialSoundServiceLive,
  MaterialPerformanceServiceLive
).pipe(
  Layer.provide(ItemRegistryLive),
  Layer.provide(AudioEngineLive),
  Layer.provide(PhysicsEngineLive),
  Layer.provide(RenderingEngineLive)
)

// Material System Service - 統合インターフェース
export class MaterialSystemService extends Context.Tag("MaterialSystemService")<
  MaterialSystemService,
  {
    readonly initializeMaterialSystem: () => Effect.Effect<void, MaterialSystemError>
    readonly processWorldTick: (deltaTime: number) => Effect.Effect<void, never>
    readonly handleMaterialInteraction: (interaction: MaterialInteraction) => Effect.Effect<InteractionResult, MaterialError>
    readonly getMaterialSystemState: () => Effect.Effect<MaterialSystemState, never>
    readonly optimizeForRegion: (region: WorldRegion) => Effect.Effect<void, never>
  }
>() {}

export const MaterialSystemServiceLive = Layer.effect(
  MaterialSystemService,
  Effect.gen(function* () {
    const registry = yield* MaterialRegistry
    const physics = yield* MaterialPhysicsService
    const rendering = yield* MaterialRenderingService
    const sound = yield* MaterialSoundService
    const performance = yield* MaterialPerformanceService

    const initializeMaterialSystem = () =>
      Effect.gen(function* () {
        // デフォルト材質の登録
        yield* registerVanillaMaterials()

        // パフォーマンス最適化の初期化
        yield* performance.optimizeMemoryUsage()
        yield* performance.enableAdaptiveLOD(true)

        console.log("Material System initialized with 700+ materials")
      })

    const processWorldTick = (deltaTime: number) =>
      Effect.gen(function* () {
        // 材質の動的更新（温度変化、化学反応など）
        yield* updateDynamicMaterials(deltaTime)

        // 音響環境の更新
        yield* updateAmbientSounds(deltaTime)

        // メモリ使用量の監視
        yield* monitorMemoryUsage()
      })

    const handleMaterialInteraction = (interaction: MaterialInteraction) =>
      Effect.gen(function* () {
        switch (interaction.type) {
          case "collision":
            return yield* physics.calculateCollision(
              interaction.materialA,
              interaction.materialB,
              interaction.velocity,
              interaction.normal
            )

          case "temperature_change":
            return yield* physics.updateMaterialState(
              interaction.materialId,
              interaction.position,
              { temperature: interaction.temperature },
              interaction.deltaTime
            )

          case "sound_trigger":
            return yield* sound.playMaterialSound(
              interaction.materialId,
              interaction.soundType,
              interaction.position,
              interaction.intensity
            )

          default:
            return { success: false, message: "Unknown interaction type" }
        }
      })

    const getMaterialSystemState = () =>
      Effect.gen(function* () {
        const stats = yield* registry.getStats()
        const memoryStats = yield* performance.optimizeMemoryUsage()

        return {
          totalMaterials: stats.totalMaterials,
          memoryUsage: memoryStats.totalAllocated,
          cacheHitRate: stats.hitRate,
          performanceLevel: calculatePerformanceLevel(memoryStats),
          activeRegions: 0 // 実装は省略
        } as MaterialSystemState
      })

    const optimizeForRegion = (region: WorldRegion) =>
      Effect.gen(function* () {
        yield* performance.preloadMaterials(region)
        yield* registry.preloadForRegion(region)
      })

    return MaterialSystemService.of({
      initializeMaterialSystem,
      processWorldTick,
      handleMaterialInteraction,
      getMaterialSystemState,
      optimizeForRegion
    })
  })
).pipe(
  Layer.provide(MaterialSystemLayer)
)
```

## まとめ

Material Systemは、TypeScript Minecraft cloneの物理的リアリティと没入感を提供する包括的なシステムです。700+種類の材質特性、高度な物理シミュレーション、リアルタイム音響処理、最適化されたレンダリングを統合し、プレイヤーに深いインタラクション体験を提供します。

### 主要な特徴

1. **包括的材質定義**: 物理・視覚・音響・環境特性の完全統合
2. **高性能最適化**: 構造体配列とキャッシング戦略による効率化
3. **リアルタイム物理**: SPH流体、熱伝導、化学反応シミュレーション
4. **PBRレンダリング**: 物理ベースの高品質視覚効果
5. **立体音響**: 材質特性に基づく3D音響処理
6. **適応的LOD**: 距離と性能に応じた動的品質調整
7. **メモリ管理**: プロファイリングと最適化による効率的なリソース使用

このシステムにより、Minecraftの豊富な材質世界がリアルで応答性の高いインタラクション体験として実現されます。

`★ Insight ─────────────────────────────────────`
- 構造体配列（SoA）パターンによりメモリ効率を大幅改善し、キャッシュ効率を最適化
- PBR（物理ベースレンダリング）とSPH（Smoothed Particle Hydrodynamics）により現実的な視覚・物理シミュレーションを実現
- 適応的LODと予測プリローディングでパフォーマンスとメモリ使用量を動的バランス調整
`─────────────────────────────────────────────────`