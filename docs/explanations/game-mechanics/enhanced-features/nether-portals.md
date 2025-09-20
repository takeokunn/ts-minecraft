---
title: '08 Nether Portals'
description: '08 Nether Portalsに関する詳細な説明とガイド。'
category: 'specification'
difficulty: 'intermediate'
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: '30分'
---

# Nether Portals System - ネザーポータル・異次元システム

## 概要

Nether Portals Systemは、Minecraftの象徴的な機能である異次元間移動システムを実装します。オーバーワールドとネザー、そして拡張可能な多次元アーキテクチャによる追加次元との間でのプレイヤー移動を可能にし、ポータル構造の認識、座標変換、ディメンション管理、テレポーテーション処理を効率的に行います。Effect-TSの並行処理機能とSchema.Structを活用し、高性能かつ拡張可能な異次元システムを提供します。

## システム設計原理

### Portal Structure Recognition Engine

ポータルの構造認識と検証を行うエンジンです。

```typescript
import { Effect, Layer, Context, Stream, Ref, Schema, Match, pipe, Queue } from 'effect'
import { Brand } from 'effect'

// Domain Types
export type DimensionId = Brand.Brand<string, 'DimensionId'>
export const DimensionId = pipe(Schema.String, Schema.brand('DimensionId'))

export type PortalId = Brand.Brand<string, 'PortalId'>
export const PortalId = pipe(Schema.String, Schema.brand('PortalId'))

export type CoordinateScale = Brand.Brand<number, 'CoordinateScale'>
export const CoordinateScale = pipe(Schema.Number, Schema.positive(), Schema.brand('CoordinateScale'))

// Portal Structure Definition
export const PortalFrame = Schema.Struct({
  corners: Schema.Tuple(
    BlockPosition,
    BlockPosition, // 左下、右下
    BlockPosition,
    BlockPosition // 左上、右上
  ),
  width: pipe(Schema.Number, Schema.int(), Schema.between(2, 23)), // 内部空間
  height: pipe(Schema.Number, Schema.int(), Schema.between(3, 23)),
  orientation: Schema.Literal('north', 'south', 'east', 'west'),
  isValid: Schema.Boolean,
  portalBlocks: Schema.Array(BlockPosition), // 内部のポータルブロック
})

export type PortalFrame = Schema.Schema.Type<typeof PortalFrame>

// Portal Instance
export const Portal = Schema.Struct({
  id: PortalId,
  frame: PortalFrame,
  dimension: DimensionId,
  isActive: Schema.Boolean,
  linkedPortal: Schema.optional(PortalId),
  creationTime: Schema.Number,
  lastUsed: Schema.Number,
  usageCount: Schema.Number,
  metadata: Schema.Record(Schema.String, Schema.Unknown),
})

export type Portal = Schema.Schema.Type<typeof Portal>

// Portal Recognition Interface
interface PortalRecognitionEngineInterface {
  readonly scanForPortalFrames: (
    region: ChunkRegion,
    dimension: DimensionId
  ) => Effect.Effect<ReadonlyArray<PortalFrame>, PortalScanError>

  readonly validatePortalFrame: (frame: PortalFrame, world: World) => Effect.Effect<boolean, PortalValidationError>

  readonly createPortalFromFrame: (
    frame: PortalFrame,
    dimension: DimensionId
  ) => Effect.Effect<Portal, PortalCreationError>

  readonly detectPortalDestruction: (portal: Portal, world: World) => Effect.Effect<boolean, PortalValidationError>

  readonly findPortalFrameAt: (
    position: BlockPosition,
    world: World
  ) => Effect.Effect<PortalFrame | undefined, PortalScanError>
}

const PortalRecognitionEngine = Context.GenericTag<PortalRecognitionEngineInterface>('@app/PortalRecognitionEngine')

export const PortalRecognitionEngineLive = Layer.effect(
  PortalRecognitionEngine,
  Effect.gen(function* () {
    const frameCache = yield* Ref.make<Map<string, PortalFrame>>(new Map())

    const scanForPortalFrames = (region: ChunkRegion, dimension: DimensionId) =>
      Effect.gen(function* () {
        const worldService = yield* WorldService
        const world = yield* worldService.getDimension(dimension)

        const potentialFrames: PortalFrame[] = []

        // スキャン範囲を効率的に探索
        for (let x = region.minX; x <= region.maxX; x++) {
          for (let z = region.minZ; z <= region.maxZ; z++) {
            for (let y = 1; y <= 256; y++) {
              const position = { x, y, z } as BlockPosition
              const block = yield* getBlockAt(world, position)

              if (isObsidian(block)) {
                const frame = yield* attemptFrameRecognition(position, world)
                if (frame && frame.isValid) {
                  potentialFrames.push(frame)
                  // 認識済みの領域をスキップして効率化
                  y += frame.height
                }
              }
            }
          }
        }

        return potentialFrames
      })

    const attemptFrameRecognition = (obsidianPos: BlockPosition, world: World) =>
      Effect.gen(function* () {
        // 4つの方向からポータルフレームを検索
        const directions = ['north', 'south', 'east', 'west'] as const

        for (const direction of directions) {
          const frame = yield* scanFrameInDirection(obsidianPos, direction, world)
          if (frame) {
            return frame
          }
        }

        return undefined
      })

    const scanFrameInDirection = (
      startPos: BlockPosition,
      direction: typeof PortalFrame.Type.orientation,
      world: World
    ) =>
      Effect.gen(function* () {
        // 方向に応じた座標変換
        const [dx, dz] = getDirectionVector(direction)
        const [perpDx, perpDz] = getPerpendicularVector(direction)

        let width = 0
        let height = 0

        // 幅の測定
        let currentPos = startPos
        while (width < 23) {
          // 最大サイズ制限
          const block = yield* getBlockAt(world, currentPos)
          if (!isObsidian(block)) break

          width++
          currentPos = {
            x: currentPos.x + dx,
            y: currentPos.y,
            z: currentPos.z + dz,
          }
        }

        // 高さの測定
        currentPos = startPos
        while (height < 23) {
          const block = yield* getBlockAt(world, currentPos)
          if (!isObsidian(block)) break

          height++
          currentPos = {
            x: currentPos.x,
            y: currentPos.y + 1,
            z: currentPos.z,
          }
        }

        // 最小サイズチェック
        if (width < 4 || height < 5) {
          // フレーム込みサイズ
          return undefined
        }

        // フレームの完全性を検証
        const frame = createPortalFrame(startPos, width, height, direction)
        const isValid = yield* validateCompleteFrame(frame, world)

        return isValid ? frame : undefined
      })

    const validateCompleteFrame = (frame: PortalFrame, world: World) =>
      Effect.gen(function* () {
        const [topLeft, topRight, bottomLeft, bottomRight] = frame.corners

        // 四隅の検証
        const cornerBlocks = yield* Effect.all([
          getBlockAt(world, topLeft),
          getBlockAt(world, topRight),
          getBlockAt(world, bottomLeft),
          getBlockAt(world, bottomRight),
        ])

        const allObsidian = cornerBlocks.every(isObsidian)
        if (!allObsidian) return false

        // フレームの辺の検証
        const isValidFrame = yield* validateFrameEdges(frame, world)
        if (!isValidFrame) return false

        // 内部空間の検証
        const hasValidInterior = yield* validateFrameInterior(frame, world)

        return hasValidInterior
      })

    const validateFrameEdges = (frame: PortalFrame, world: World) =>
      Effect.gen(function* () {
        const [topLeft, topRight, bottomLeft, bottomRight] = frame.corners

        // 上辺の検証
        for (let i = 0; i <= frame.width + 1; i++) {
          const pos = {
            x: topLeft.x + (i * (topRight.x - topLeft.x)) / (frame.width + 1),
            y: topLeft.y,
            z: topLeft.z + (i * (topRight.z - topLeft.z)) / (frame.width + 1),
          }
          const block = yield* getBlockAt(world, pos)
          if (!isObsidian(block)) return false
        }

        // 下辺、左辺、右辺も同様に検証
        // ... (省略: 同様のパターン)

        return true
      })

    const validateFrameInterior = (frame: PortalFrame, world: World) =>
      Effect.gen(function* () {
        const [topLeft, topRight, bottomLeft, bottomRight] = frame.corners

        // 内部空間が空気またはポータルブロックであることを確認
        for (let x = 1; x < frame.width + 1; x++) {
          for (let y = 1; y < frame.height + 1; y++) {
            const pos = calculateInteriorPosition(frame, x, y)
            const block = yield* getBlockAt(world, pos)

            if (!isAir(block) && !isPortalBlock(block)) {
              return false
            }
          }
        }

        return true
      })

    const createPortalFromFrame = (frame: PortalFrame, dimension: DimensionId) =>
      Effect.gen(function* () {
        const portalId = yield* Effect.sync(() => crypto.randomUUID() as PortalId)

        const portal: Portal = {
          id: portalId,
          frame,
          dimension,
          isActive: false,
          creationTime: Date.now(),
          lastUsed: 0,
          usageCount: 0,
          metadata: {},
        }

        return portal
      })

    const detectPortalDestruction = (portal: Portal, world: World) =>
      Effect.gen(function* () {
        // フレームの整合性をチェック
        const isStillValid = yield* validateCompleteFrame(portal.frame, world)
        return !isStillValid
      })

    return {
      scanForPortalFrames,
      validatePortalFrame: (frame, world) => validateCompleteFrame(frame, world),
      createPortalFromFrame,
      detectPortalDestruction,
      findPortalFrameAt: (position, world) => findPortalFrameAtPosition(position, world),
    } as const
  })
)
```

### Dimension Management System

異次元の管理とメタデータを処理するシステムです。

```typescript
// Dimension Definition
export const Dimension = Schema.Struct({
  id: DimensionId,
  name: Schema.String,
  type: Schema.Literal('overworld', 'nether', 'end', 'custom'),
  coordinateScale: CoordinateScale,
  environment: Schema.Struct({
    hasSkylight: Schema.Boolean,
    hasWeather: Schema.Boolean,
    hasDay: Schema.Boolean,
    hasNight: Schema.Boolean,
    ambientLightLevel: pipe(Schema.Number, Schema.between(0, 15)),
  }),
  worldBounds: Schema.Struct({
    minY: Schema.Number,
    maxY: Schema.Number,
    buildLimit: Schema.Number,
  }),
  biomesAllowed: Schema.Array(Schema.String),
  specialProperties: Schema.Record(Schema.String, Schema.Unknown),
})

export type Dimension = Schema.Schema.Type<typeof Dimension>

// Dimension Manager Interface
interface DimensionManagerInterface {
  readonly registerDimension: (dimension: Dimension) => Effect.Effect<void, DimensionRegistrationError>

  readonly getDimension: (dimensionId: DimensionId) => Effect.Effect<Dimension, DimensionNotFoundError>

  readonly getAllDimensions: () => Effect.Effect<ReadonlyArray<Dimension>, never>

  readonly calculateCoordinateTransform: (
    from: DimensionId,
    to: DimensionId,
    position: BlockPosition
  ) => Effect.Effect<BlockPosition, CoordinateTransformError>

  readonly isValidDestination: (from: DimensionId, to: DimensionId) => Effect.Effect<boolean, never>

  readonly getDefaultSpawnPosition: (dimensionId: DimensionId) => Effect.Effect<BlockPosition, SpawnLocationError>
}

const DimensionManager = Context.GenericTag<DimensionManagerInterface>('@app/DimensionManager')

export const DimensionManagerLive = Layer.effect(
  DimensionManager,
  Effect.gen(function* () {
    const dimensions = yield* Ref.make<Map<DimensionId, Dimension>>(new Map())

    // デフォルト次元の初期化
    const overworldDimension: Dimension = {
      id: 'minecraft:overworld' as DimensionId,
      name: 'Overworld',
      type: 'overworld',
      coordinateScale: 1 as CoordinateScale,
      environment: {
        hasSkylight: true,
        hasWeather: true,
        hasDay: true,
        hasNight: true,
        ambientLightLevel: 0,
      },
      worldBounds: {
        minY: -64,
        maxY: 320,
        buildLimit: 256,
      },
      biomesAllowed: ['plains', 'forest', 'desert', 'mountain', 'ocean'],
      specialProperties: {},
    }

    const netherDimension: Dimension = {
      id: 'minecraft:the_nether' as DimensionId,
      name: 'The Nether',
      type: 'nether',
      coordinateScale: 8 as CoordinateScale, // 1:8スケール
      environment: {
        hasSkylight: false,
        hasWeather: false,
        hasDay: false,
        hasNight: false,
        ambientLightLevel: 7, // 暗い環境光
      },
      worldBounds: {
        minY: 0,
        maxY: 128,
        buildLimit: 128,
      },
      biomesAllowed: ['nether_wastes', 'soul_sand_valley', 'crimson_forest', 'warped_forest'],
      specialProperties: {
        bedExplosive: true,
        waterEvaporates: true,
        compassSpins: true,
        clockSpins: true,
      },
    }

    // デフォルト次元を登録
    yield* Ref.update(dimensions, (dims) =>
      dims.set(overworldDimension.id, overworldDimension).set(netherDimension.id, netherDimension)
    )

    const registerDimension = (dimension: Dimension) =>
      Effect.gen(function* () {
        // 早期リターン: 次元IDの重複チェック
        const existingDims = yield* Ref.get(dimensions)
        if (existingDims.has(dimension.id)) {
          return yield* Effect.fail(new DimensionAlreadyExistsError(dimension.id))
        }

        // 次元の妥当性検証
        const isValid = yield* validateDimension(dimension)
        if (!isValid) {
          return yield* Effect.fail(new InvalidDimensionError(dimension.id))
        }

        yield* Ref.update(dimensions, (dims) => dims.set(dimension.id, dimension))
      })

    const calculateCoordinateTransform = (from: DimensionId, to: DimensionId, position: BlockPosition) =>
      Effect.gen(function* () {
        if (from === to) {
          return position // 同次元の場合は変換不要
        }

        const fromDim = yield* getDimension(from)
        const toDim = yield* getDimension(to)

        // オーバーワールド ↔ ネザー の座標変換
        return yield* Match.value({ from: fromDim.type, to: toDim.type }).pipe(
          Match.when({ from: 'overworld', to: 'nether' }, () =>
            Effect.succeed({
              x: Math.floor(position.x / 8),
              y: Math.min(Math.max(position.y, 1), 126), // ネザーの安全高度
              z: Math.floor(position.z / 8),
            } as BlockPosition)
          ),
          Match.when({ from: 'nether', to: 'overworld' }, () =>
            Effect.succeed({
              x: position.x * 8,
              y: position.y,
              z: position.z * 8,
            } as BlockPosition)
          ),
          Match.when(
            { from: 'overworld', to: 'end' },
            () => Effect.succeed({ x: 0, y: 64, z: 0 } as BlockPosition) // エンドスポーン
          ),
          Match.when(
            { from: 'end', to: 'overworld' },
            () => Effect.succeed({ x: 0, y: 64, z: 0 } as BlockPosition) // オーバーワールドスポーン
          ),
          Match.orElse(() => Effect.fail(new UnsupportedCoordinateTransformError(from, to)))
        )
      })

    const getDimension = (dimensionId: DimensionId) =>
      Effect.gen(function* () {
        const dims = yield* Ref.get(dimensions)
        const dimension = dims.get(dimensionId)

        if (!dimension) {
          return yield* Effect.fail(new DimensionNotFoundError(dimensionId))
        }

        return dimension
      })

    return {
      registerDimension,
      getDimension,
      getAllDimensions: () => Ref.get(dimensions).pipe(Effect.map((dims) => Array.from(dims.values()))),
      calculateCoordinateTransform,
      isValidDestination: (from, to) =>
        Effect.gen(function* () {
          try {
            yield* getDimension(from)
            yield* getDimension(to)
            return true
          } catch {
            return false
          }
        }),
      getDefaultSpawnPosition: (dimensionId) => getDefaultSpawnPositionImpl(dimensionId),
    } as const
  })
)
```

### Portal Linking System

ポータル間のリンクと最適経路探索を管理するシステムです。

```typescript
// Portal Link Definition
export const PortalLink = Schema.Struct({
  id: Schema.String,
  sourcePortal: PortalId,
  targetPortal: PortalId,
  distance: Schema.Number,
  linkStrength: pipe(Schema.Number, Schema.between(0, 1)),
  lastCalculated: Schema.Number,
  isActive: Schema.Boolean,
})

export type PortalLink = Schema.Schema.Type<typeof PortalLink>

// Portal Network Interface
interface PortalNetworkInterface {
  readonly registerPortal: (portal: Portal) => Effect.Effect<void, PortalRegistrationError>

  readonly unregisterPortal: (portalId: PortalId) => Effect.Effect<void, PortalRegistrationError>

  readonly findNearestPortal: (
    position: BlockPosition,
    dimension: DimensionId,
    excludePortal?: PortalId
  ) => Effect.Effect<Portal | undefined, PortalSearchError>

  readonly createPortalLink: (sourceId: PortalId, targetId: PortalId) => Effect.Effect<PortalLink, PortalLinkError>

  readonly updatePortalLinks: (portalId: PortalId) => Effect.Effect<void, PortalLinkError>

  readonly getPortalNetwork: (dimension: DimensionId) => Effect.Effect<ReadonlyArray<Portal>, PortalNetworkError>

  readonly optimizePortalNetwork: (dimension: DimensionId) => Effect.Effect<void, PortalOptimizationError>
}

const PortalNetwork = Context.GenericTag<PortalNetworkInterface>('@app/PortalNetwork')

export const PortalNetworkLive = Layer.effect(
  PortalNetwork,
  Effect.gen(function* () {
    const portals = yield* Ref.make<Map<PortalId, Portal>>(new Map())
    const portalLinks = yield* Ref.make<Map<string, PortalLink>>(new Map())
    const dimensionPortals = yield* Ref.make<Map<DimensionId, Set<PortalId>>>(new Map())

    const registerPortal = (portal: Portal) =>
      Effect.gen(function* () {
        // ポータルをメインレジストリに登録
        yield* Ref.update(portals, (portalsMap) => portalsMap.set(portal.id, portal))

        // 次元別インデックスに登録
        yield* Ref.update(dimensionPortals, (dimMap) => {
          const existingPortals = dimMap.get(portal.dimension) ?? new Set()
          existingPortals.add(portal.id)
          return dimMap.set(portal.dimension, existingPortals)
        })

        // 近くのポータルとのリンクを作成
        yield* updatePortalLinks(portal.id)
      })

    const findNearestPortal = (position: BlockPosition, dimension: DimensionId, excludePortal?: PortalId) =>
      Effect.gen(function* () {
        const dimPortalIds = yield* Ref.get(dimensionPortals).pipe(
          Effect.map((dimMap) => dimMap.get(dimension) ?? new Set())
        )

        if (dimPortalIds.size === 0) {
          return undefined
        }

        let nearestPortal: Portal | undefined = undefined
        let nearestDistance = Infinity

        const allPortals = yield* Ref.get(portals)

        for (const portalId of dimPortalIds) {
          if (excludePortal && portalId === excludePortal) continue

          const portal = allPortals.get(portalId)
          if (!portal || !portal.isActive) continue

          const distance = calculatePortalDistance(position, portal.frame)

          if (distance < nearestDistance) {
            nearestDistance = distance
            nearestPortal = portal
          }
        }

        return nearestPortal
      })

    const createPortalLink = (sourceId: PortalId, targetId: PortalId) =>
      Effect.gen(function* () {
        const allPortals = yield* Ref.get(portals)
        const sourcePortal = allPortals.get(sourceId)
        const targetPortal = allPortals.get(targetId)

        if (!sourcePortal || !targetPortal) {
          return yield* Effect.fail(new PortalNotFoundError(sourceId, targetId))
        }

        const distance = calculatePortalDistance(getPortalCenter(sourcePortal.frame), targetPortal.frame)

        // リンク強度の計算（距離が近いほど強い）
        const linkStrength = Math.max(0, 1 - distance / 1000) // 1000ブロック以上で強度0

        const linkId = `${sourceId}-${targetId}`
        const link: PortalLink = {
          id: linkId,
          sourcePortal: sourceId,
          targetPortal: targetId,
          distance,
          linkStrength,
          lastCalculated: Date.now(),
          isActive: true,
        }

        yield* Ref.update(portalLinks, (links) => links.set(linkId, link))

        return link
      })

    const updatePortalLinks = (portalId: PortalId) =>
      Effect.gen(function* () {
        const allPortals = yield* Ref.get(portals)
        const portal = allPortals.get(portalId)

        if (!portal) {
          return yield* Effect.fail(new PortalNotFoundError(portalId))
        }

        // 対応する次元のポータルを検索
        const targetDimension = yield* getTargetDimension(portal.dimension)
        const targetPortals = yield* getPortalNetwork(targetDimension)

        // 最適なリンク先を決定
        const bestTarget = yield* findOptimalLinkTarget(portal, targetPortals)

        if (bestTarget) {
          const link = yield* createPortalLink(portal.id, bestTarget.id)

          // 双方向リンクを作成
          const reverseLink = yield* createPortalLink(bestTarget.id, portal.id)

          // ポータルの linkedPortal フィールドを更新
          const updatedPortal = { ...portal, linkedPortal: bestTarget.id }
          const updatedBestTarget = { ...bestTarget, linkedPortal: portal.id }

          yield* Ref.update(portals, (portalsMap) =>
            portalsMap.set(portal.id, updatedPortal).set(bestTarget.id, updatedBestTarget)
          )
        }
      })

    const findOptimalLinkTarget = (sourcePortal: Portal, targetPortals: ReadonlyArray<Portal>) =>
      Effect.gen(function* () {
        if (targetPortals.length === 0) {
          return undefined
        }

        const dimensionManager = yield* DimensionManager
        const sourceCenter = getPortalCenter(sourcePortal.frame)

        // ソースポータルの座標を対象次元の座標系に変換
        const targetDimension = yield* getTargetDimension(sourcePortal.dimension)
        const transformedPosition = yield* dimensionManager.calculateCoordinateTransform(
          sourcePortal.dimension,
          targetDimension,
          sourceCenter
        )

        // 最も近いポータルを検索（128ブロック範囲内）
        let bestPortal: Portal | undefined = undefined
        let bestDistance = 128 // 最大検索距離

        for (const targetPortal of targetPortals) {
          const targetCenter = getPortalCenter(targetPortal.frame)
          const distance = calculateDistance3D(transformedPosition, targetCenter)

          if (distance < bestDistance) {
            bestDistance = distance
            bestPortal = targetPortal
          }
        }

        return bestPortal
      })

    const optimizePortalNetwork = (dimension: DimensionId) =>
      Effect.gen(function* () {
        const networkPortals = yield* getPortalNetwork(dimension)

        // ポータル間距離の最適化
        const optimizationTasks = networkPortals.map((portal) => updatePortalLinks(portal.id))

        yield* Effect.all(optimizationTasks, { concurrency: 4 })

        // 未使用リンクのクリーンアップ
        yield* cleanupUnusedLinks()
      })

    const cleanupUnusedLinks = () =>
      Effect.gen(function* () {
        const currentTime = Date.now()
        const maxAge = 24 * 60 * 60 * 1000 // 24時間

        yield* Ref.update(portalLinks, (links) => {
          const activeLinks = new Map<string, PortalLink>()

          for (const [linkId, link] of links) {
            if (link.isActive && currentTime - link.lastCalculated < maxAge) {
              activeLinks.set(linkId, link)
            }
          }

          return activeLinks
        })
      })

    return {
      registerPortal,
      unregisterPortal: (portalId) => unregisterPortalImpl(portalId, portals, dimensionPortals, portalLinks),
      findNearestPortal,
      createPortalLink,
      updatePortalLinks,
      getPortalNetwork: (dimension) => getPortalNetworkImpl(dimension, dimensionPortals, portals),
      optimizePortalNetwork,
    } as const
  })
)
```

### Teleportation Engine

プレイヤーとエンティティのテレポーテーション処理エンジンです。

```typescript
// Teleportation Event
export const TeleportationEvent = Schema.Struct({
  id: Schema.String,
  entityId: Schema.String,
  fromPosition: BlockPosition,
  toPosition: BlockPosition,
  fromDimension: DimensionId,
  toDimension: DimensionId,
  portalUsed: PortalId,
  timestamp: Schema.Number,
  status: Schema.Literal('pending', 'in_progress', 'completed', 'failed'),
  metadata: Schema.Record(Schema.String, Schema.Unknown),
})

export type TeleportationEvent = Schema.Schema.Type<typeof TeleportationEvent>

// Teleportation Engine Interface
interface TeleportationEngineInterface {
  readonly teleportEntity: (
    entityId: string,
    portal: Portal,
    targetDimension: DimensionId
  ) => Effect.Effect<TeleportationEvent, TeleportationError>

  readonly calculateTeleportDestination: (
    portal: Portal,
    entity: Entity
  ) => Effect.Effect<BlockPosition, DestinationCalculationError>

  readonly validateTeleportSafety: (
    position: BlockPosition,
    dimension: DimensionId
  ) => Effect.Effect<boolean, SafetyValidationError>

  readonly createPortalIfNeeded: (
    position: BlockPosition,
    dimension: DimensionId
  ) => Effect.Effect<Portal | undefined, PortalCreationError>

  readonly handleDimensionTransition: (
    entity: Entity,
    fromDim: DimensionId,
    toDim: DimensionId
  ) => Effect.Effect<Entity, DimensionTransitionError>
}

const TeleportationEngine = Context.GenericTag<TeleportationEngineInterface>('@app/TeleportationEngine')

export const TeleportationEngineLive = Layer.effect(
  TeleportationEngine,
  Effect.gen(function* () {
    const teleportQueue = yield* Queue.unbounded<TeleportationEvent>()
    const activeTeleports = yield* Ref.make<Map<string, TeleportationEvent>>(new Map())

    const teleportEntity = (entityId: string, portal: Portal, targetDimension: DimensionId) =>
      Effect.gen(function* () {
        const entityService = yield* EntityService
        const entity = yield* entityService.getEntity(entityId)

        // 早期リターン: エンティティの存在確認
        if (!entity) {
          return yield* Effect.fail(new EntityNotFoundError(entityId))
        }

        // 早期リターン: ポータルのアクティブ状態確認
        if (!portal.isActive) {
          return yield* Effect.fail(new PortalInactiveError(portal.id))
        }

        // テレポート先の計算
        const destinationPosition = yield* calculateTeleportDestination(portal, entity)

        // 安全性の検証
        const isSafe = yield* validateTeleportSafety(destinationPosition, targetDimension)
        if (!isSafe) {
          return yield* Effect.fail(new UnsafeDestinationError(destinationPosition, targetDimension))
        }

        // テレポートイベントの作成
        const teleportEvent: TeleportationEvent = {
          id: crypto.randomUUID(),
          entityId,
          fromPosition: entity.position,
          toPosition: destinationPosition,
          fromDimension: entity.dimension as DimensionId,
          toDimension: targetDimension,
          portalUsed: portal.id,
          timestamp: Date.now(),
          status: 'pending',
          metadata: {
            portalUsageCount: portal.usageCount + 1,
          },
        }

        // テレポートの実行
        yield* executeTeleportation(teleportEvent)

        return teleportEvent
      })

    const executeTeleportation = (event: TeleportationEvent) =>
      Effect.gen(function* () {
        // テレポート状態を進行中に更新
        const inProgressEvent = { ...event, status: 'in_progress' as const }
        yield* Ref.update(activeTeleports, (teleports) => teleports.set(event.id, inProgressEvent))

        try {
          const entityService = yield* EntityService
          const entity = yield* entityService.getEntity(event.entityId)

          if (!entity) {
            throw new EntityNotFoundError(event.entityId)
          }

          // 次元間移行の処理
          const transitionedEntity = yield* handleDimensionTransition(entity, event.fromDimension, event.toDimension)

          // エンティティの位置更新
          const updatedEntity = {
            ...transitionedEntity,
            position: event.toPosition,
            dimension: event.toDimension,
            velocity: { x: 0, y: 0, z: 0 }, // テレポート時は速度をリセット
          }

          yield* entityService.updateEntity(event.entityId, updatedEntity)

          // テレポート完了
          const completedEvent = { ...inProgressEvent, status: 'completed' as const }
          yield* Ref.update(activeTeleports, (teleports) => teleports.set(event.id, completedEvent))

          // ポータル使用統計更新
          yield* updatePortalUsageStats(event.portalUsed)

          // イベントの発行
          yield* publishTeleportationEvent(completedEvent)
        } catch (error) {
          // テレポート失敗
          const failedEvent = {
            ...inProgressEvent,
            status: 'failed' as const,
            metadata: {
              ...inProgressEvent.metadata,
              error: error instanceof Error ? error.message : String(error),
            },
          }

          yield* Ref.update(activeTeleports, (teleports) => teleports.set(event.id, failedEvent))

          yield* Effect.fail(new TeleportationExecutionError(event.id, error))
        }
      })

    const calculateTeleportDestination = (portal: Portal, entity: Entity) =>
      Effect.gen(function* () {
        const portalNetwork = yield* PortalNetwork
        const dimensionManager = yield* DimensionManager

        // リンクされたポータルがある場合
        if (portal.linkedPortal) {
          const linkedPortal = yield* portalNetwork.getPortal(portal.linkedPortal)
          if (linkedPortal) {
            return calculateSafeSpawnNearPortal(linkedPortal.frame)
          }
        }

        // リンクポータルがない場合は新規作成地点を計算
        const targetDimension = yield* getTargetDimension(portal.dimension)
        const transformedPosition = yield* dimensionManager.calculateCoordinateTransform(
          portal.dimension,
          targetDimension,
          getPortalCenter(portal.frame)
        )

        return transformedPosition
      })

    const validateTeleportSafety = (position: BlockPosition, dimension: DimensionId) =>
      Effect.gen(function* () {
        const worldService = yield* WorldService
        const world = yield* worldService.getDimension(dimension)

        // 着地点の確認
        const landingBlock = yield* getBlockAt(world, position)
        const aboveBlock = yield* getBlockAt(world, {
          x: position.x,
          y: position.y + 1,
          z: position.z,
        })
        const belowBlock = yield* getBlockAt(world, {
          x: position.x,
          y: position.y - 1,
          z: position.z,
        })

        // 安全性チェック
        const isSolid = !isAir(landingBlock) && !isFluid(landingBlock)
        const hasSpace = isAir(aboveBlock)
        const hasSupport = !isAir(belowBlock)

        // 危険なブロックのチェック
        const isDangerous = isLava(landingBlock) || isLava(aboveBlock) || isLava(belowBlock)

        return isSolid && hasSpace && hasSupport && !isDangerous
      })

    const createPortalIfNeeded = (position: BlockPosition, dimension: DimensionId) =>
      Effect.gen(function* () {
        const portalRecognition = yield* PortalRecognitionEngine
        const worldService = yield* WorldService

        // 周辺にポータルが存在するかチェック
        const world = yield* worldService.getDimension(dimension)
        const existingFrame = yield* portalRecognition.findPortalFrameAt(position, world)

        if (existingFrame) {
          return yield* portalRecognition.createPortalFromFrame(existingFrame, dimension)
        }

        // 新規ポータルの作成
        const safePosition = yield* findSafePortalLocation(position, dimension)
        const newFrame = yield* generatePortalFrame(safePosition, dimension)

        // 実際にワールドにポータルを建設
        yield* buildPortalInWorld(newFrame, world)

        const newPortal = yield* portalRecognition.createPortalFromFrame(newFrame, dimension)

        // ポータルネットワークに登録
        const portalNetwork = yield* PortalNetwork
        yield* portalNetwork.registerPortal(newPortal)

        return newPortal
      })

    const handleDimensionTransition = (entity: Entity, fromDim: DimensionId, toDim: DimensionId) =>
      Effect.gen(function* () {
        const dimensionManager = yield* DimensionManager
        const fromDimension = yield* dimensionManager.getDimension(fromDim)
        const toDimension = yield* dimensionManager.getDimension(toDim)

        let transitionedEntity = entity

        // プレイヤーの場合の特別処理
        if (entity.type === 'player') {
          transitionedEntity = yield* handlePlayerDimensionTransition(entity, fromDimension, toDimension)
        }

        // エンティティタイプ別の処理
        transitionedEntity = yield* Match.value(entity.type).pipe(
          Match.when(
            'item',
            () => Effect.succeed({ ...transitionedEntity, pickupDelay: 40 }) // アイテムは40tick拾えない
          ),
          Match.when('mob', () => applyDimensionSpecificMobEffects(transitionedEntity, toDimension)),
          Match.orElse(() => Effect.succeed(transitionedEntity))
        )

        return transitionedEntity
      })

    return {
      teleportEntity,
      calculateTeleportDestination,
      validateTeleportSafety,
      createPortalIfNeeded,
      handleDimensionTransition,
    } as const
  })
)
```

### Nether World Generation Integration

ネザー世界生成との統合システムです。

```typescript
// Nether Generation Configuration
export const NetherGenerationConfig = Schema.Struct({
  biomes: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      weight: Schema.Number,
      temperature: Schema.Number,
      structures: Schema.Array(Schema.String),
    })
  ),
  structures: Schema.Array(
    Schema.Struct({
      type: Schema.String,
      rarity: Schema.Number,
      minDistance: Schema.Number,
      maxDistance: Schema.Number,
    })
  ),
  oreDistribution: Schema.Map(
    Schema.String,
    Schema.Struct({
      minY: Schema.Number,
      maxY: Schema.Number,
      veinSize: Schema.Number,
      frequency: Schema.Number,
    })
  ),
  ambientEffects: Schema.Struct({
    particleTypes: Schema.Array(Schema.String),
    soundEffects: Schema.Array(Schema.String),
    fogDensity: Schema.Number,
    fogColor: Schema.String,
  }),
})

export type NetherGenerationConfig = Schema.Schema.Type<typeof NetherGenerationConfig>

// Nether World Generator Interface
interface NetherWorldGeneratorInterface {
  readonly generateNetherChunk: (
    chunkX: number,
    chunkZ: number,
    seed: number
  ) => Effect.Effect<Chunk, ChunkGenerationError>

  readonly generatePortalSafeArea: (position: BlockPosition, radius: number) => Effect.Effect<void, AreaGenerationError>

  readonly placeFortressStructures: (chunk: Chunk, seed: number) => Effect.Effect<Chunk, StructureGenerationError>

  readonly generateNetherBiome: (
    chunkX: number,
    chunkZ: number,
    biomeType: string,
    seed: number
  ) => Effect.Effect<BiomeData, BiomeGenerationError>
}

const NetherWorldGenerator = Context.GenericTag<NetherWorldGeneratorInterface>('@app/NetherWorldGenerator')

export const NetherWorldGeneratorLive = Layer.effect(
  NetherWorldGenerator,
  Effect.gen(function* () {
    const config = yield* Ref.make<NetherGenerationConfig>(defaultNetherConfig)

    const generateNetherChunk = (chunkX: number, chunkZ: number, seed: number) =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService

        // ノイズベースの地形生成
        const heightMap = yield* generateNetherHeightMap(chunkX, chunkZ, seed)
        const biomeData = yield* generateChunkBiomeData(chunkX, chunkZ, seed)

        // 基本地形の生成
        let chunk = yield* chunkService.createEmptyChunk(chunkX, chunkZ, 'minecraft:the_nether' as DimensionId)

        // レイヤー別の地形生成
        chunk = yield* generateBedrockLayer(chunk)
        chunk = yield* generateNetherrackLayer(chunk, heightMap)
        chunk = yield* generateLavaLakes(chunk, seed)
        chunk = yield* generateSoulSandValleys(chunk, biomeData, seed)

        // 鉱石の配置
        chunk = yield* placenetherOres(chunk, seed)

        // 構造物の配置
        chunk = yield* placeFortressStructures(chunk, seed)

        // バイオーム固有の装飾
        chunk = yield* applyBiomeDecorations(chunk, biomeData, seed)

        return chunk
      })

    const generatePortalSafeArea = (position: BlockPosition, radius: number) =>
      Effect.gen(function* () {
        const worldService = yield* WorldService
        const netherWorld = yield* worldService.getDimension('minecraft:the_nether' as DimensionId)

        // 周辺エリアのクリア
        for (let x = -radius; x <= radius; x++) {
          for (let z = -radius; z <= radius; z++) {
            for (let y = -2; y <= 4; y++) {
              // ポータル高さ + 余裕
              const clearPos = {
                x: position.x + x,
                y: position.y + y,
                z: position.z + z,
              }

              // 溶岩や危険なブロックをネザーラックに置換
              const block = yield* getBlockAt(netherWorld, clearPos)
              if (isLava(block) || isDangerous(block)) {
                yield* setBlockAt(netherWorld, clearPos, createNetherrackBlock())
              }
            }
          }
        }

        // 安全な足場の確保
        const platformY = position.y - 1
        for (let x = -2; x <= 2; x++) {
          for (let z = -2; z <= 2; z++) {
            const platformPos = {
              x: position.x + x,
              y: platformY,
              z: position.z + z,
            }
            yield* setBlockAt(netherWorld, platformPos, createObsidianBlock())
          }
        }
      })

    const placeFortressStructures = (chunk: Chunk, seed: number) =>
      Effect.gen(function* () {
        const structureGenerator = yield* StructureGenerator
        const random = createSeededRandom(seed + chunk.x * 31 + chunk.z * 7)

        // 要塞生成の確率判定
        if (random.next() > 0.002) {
          // 0.2%の確率
          return chunk
        }

        // 要塞の配置可能性チェック
        const fortressPosition = findSuitableFortressLocation(chunk)
        if (!fortressPosition) {
          return chunk
        }

        // 要塞構造の生成
        const fortressStructure = yield* structureGenerator.generateFortress(fortressPosition, random)

        // チャンクに構造を適用
        return yield* applyStructureToChunk(chunk, fortressStructure)
      })

    const generateNetherBiome = (chunkX: number, chunkZ: number, biomeType: string, seed: number) =>
      Effect.gen(function* () {
        const biomeConfig = yield* getBiomeConfiguration(biomeType)

        return yield* Match.value(biomeType).pipe(
          Match.when('nether_wastes', () => generateNetherWastes(chunkX, chunkZ, seed, biomeConfig)),
          Match.when('soul_sand_valley', () => generateSoulSandValley(chunkX, chunkZ, seed, biomeConfig)),
          Match.when('crimson_forest', () => generateCrimsonForest(chunkX, chunkZ, seed, biomeConfig)),
          Match.when('warped_forest', () => generateWarpedForest(chunkX, chunkZ, seed, biomeConfig)),
          Match.when('basalt_deltas', () => generateBasaltDeltas(chunkX, chunkZ, seed, biomeConfig)),
          Match.orElse(
            () => generateNetherWastes(chunkX, chunkZ, seed, biomeConfig) // デフォルト
          )
        )
      })

    return {
      generateNetherChunk,
      generatePortalSafeArea,
      placeFortressStructures,
      generateNetherBiome,
    } as const
  })
)
```

### Performance Optimization System

大規模ポータルネットワークの最適化システムです。

```typescript
// Portal Performance Monitor
interface PortalPerformanceMonitorInterface {
  readonly monitorPortalUsage: (portalId: PortalId) => Effect.Effect<PortalUsageMetrics, MonitoringError>

  readonly optimizePortalCache: () => Effect.Effect<void, OptimizationError>

  readonly balancePortalLoad: (region: ChunkRegion) => Effect.Effect<void, LoadBalancingError>

  readonly predictPortalUsage: (
    portalId: PortalId,
    timeWindow: number
  ) => Effect.Effect<UsagePrediction, PredictionError>
}

const PortalPerformanceMonitor = Context.GenericTag<PortalPerformanceMonitorInterface>('@app/PortalPerformanceMonitor')

// Portal Usage Metrics
export const PortalUsageMetrics = Schema.Struct({
  portalId: PortalId,
  usageCount: Schema.Number,
  averageUsageInterval: Schema.Number,
  peakUsageTime: Schema.Number,
  totalTeleportTime: Schema.Number,
  failureRate: Schema.Number,
  lastOptimized: Schema.Number,
})

export type PortalUsageMetrics = Schema.Schema.Type<typeof PortalUsageMetrics>

export const PortalPerformanceMonitorLive = Layer.effect(
  PortalPerformanceMonitor,
  Effect.gen(function* () {
    const usageMetrics = yield* Ref.make<Map<PortalId, PortalUsageMetrics>>(new Map())
    const portalCache = yield* Ref.make<Map<string, any>>(new Map())

    const monitorPortalUsage = (portalId: PortalId) =>
      Effect.gen(function* () {
        const metrics = yield* Ref.get(usageMetrics)
        const existingMetrics = metrics.get(portalId)

        if (!existingMetrics) {
          const newMetrics: PortalUsageMetrics = {
            portalId,
            usageCount: 0,
            averageUsageInterval: 0,
            peakUsageTime: 0,
            totalTeleportTime: 0,
            failureRate: 0,
            lastOptimized: Date.now(),
          }

          yield* Ref.update(usageMetrics, (map) => map.set(portalId, newMetrics))
          return newMetrics
        }

        return existingMetrics
      })

    const optimizePortalCache = () =>
      Effect.gen(function* () {
        const currentTime = Date.now()
        const maxCacheAge = 5 * 60 * 1000 // 5分

        yield* Ref.update(portalCache, (cache) => {
          const optimizedCache = new Map<string, any>()

          for (const [key, value] of cache) {
            if (value.timestamp && currentTime - value.timestamp < maxCacheAge) {
              optimizedCache.set(key, value)
            }
          }

          return optimizedCache
        })
      })

    const balancePortalLoad = (region: ChunkRegion) =>
      Effect.gen(function* () {
        const portalNetwork = yield* PortalNetwork
        const regionPortals = yield* getPortalsInRegion(region)

        // 使用頻度の分析
        const usageAnalysis = yield* analyzePortalUsage(regionPortals)

        // 負荷分散の実行
        for (const analysis of usageAnalysis) {
          if (analysis.load > 0.8) {
            // 80%以上の負荷
            yield* redistributePortalLoad(analysis.portalId, regionPortals)
          }
        }
      })

    const predictPortalUsage = (portalId: PortalId, timeWindow: number) =>
      Effect.gen(function* () {
        const metrics = yield* monitorPortalUsage(portalId)
        const historicalData = yield* getPortalUsageHistory(portalId, timeWindow)

        // 簡単な線形予測
        const trend = calculateUsageTrend(historicalData)
        const prediction = {
          portalId,
          predictedUsage: Math.max(0, metrics.averageUsageInterval * trend),
          confidence: calculatePredictionConfidence(historicalData),
          timeWindow,
        }

        return prediction
      })

    return {
      monitorPortalUsage,
      optimizePortalCache,
      balancePortalLoad,
      predictPortalUsage,
    } as const
  })
)

// Spatial Indexing for Portal Search
export const createPortalSpatialIndex = () =>
  Effect.gen(function* () {
    const spatialIndex = yield* Ref.make<Map<string, Set<PortalId>>>(new Map())

    const addPortalToIndex = (portal: Portal) =>
      Effect.gen(function* () {
        const gridKey = calculateSpatialGridKey(getPortalCenter(portal.frame))

        yield* Ref.update(spatialIndex, (index) => {
          const existingPortals = index.get(gridKey) ?? new Set()
          existingPortals.add(portal.id)
          return index.set(gridKey, existingPortals)
        })
      })

    const findNearbyPortals = (center: BlockPosition, radius: number) =>
      Effect.gen(function* () {
        const gridKeys = calculateNearbyGridKeys(center, radius)
        const nearbyPortals = new Set<PortalId>()

        const index = yield* Ref.get(spatialIndex)

        for (const gridKey of gridKeys) {
          const portalsInGrid = index.get(gridKey)
          if (portalsInGrid) {
            for (const portalId of portalsInGrid) {
              nearbyPortals.add(portalId)
            }
          }
        }

        return Array.from(nearbyPortals)
      })

    return { addPortalToIndex, findNearbyPortals }
  })

// Batch Portal Operations
export const createPortalBatchProcessor = () =>
  Effect.gen(function* () {
    const batchQueue = yield* Queue.bounded<PortalOperation>(1000)
    const isProcessing = yield* Ref.make(false)

    const processingFiber = yield* Effect.fork(
      Effect.forever(
        Effect.gen(function* () {
          const shouldProcess = yield* Ref.get(isProcessing)
          if (!shouldProcess) {
            yield* Effect.sleep(100)
            return
          }

          const operations = yield* Queue.takeUpTo(batchQueue, 50) // バッチサイズ

          if (operations.length > 0) {
            yield* processBatchOperations(operations)
          }

          yield* Effect.sleep(16) // ~60fps
        })
      )
    )

    const addOperation = (operation: PortalOperation) => Queue.offer(batchQueue, operation)

    const startProcessing = () => Ref.set(isProcessing, true)
    const stopProcessing = () => Ref.set(isProcessing, false)

    return {
      addOperation,
      startProcessing,
      stopProcessing,
      processingFiber,
    }
  })
```

## Layer構成

```typescript
// Nether Portals System Layer
export const NetherPortalsSystemLayer = Layer.mergeAll(
  PortalRecognitionEngineLive,
  DimensionManagerLive,
  PortalNetworkLive,
  TeleportationEngineLive,
  NetherWorldGeneratorLive,
  PortalPerformanceMonitorLive
).pipe(
  Layer.provide(WorldSystemLayer),
  Layer.provide(ChunkSystemLayer),
  Layer.provide(EntitySystemLayer),
  Layer.provide(EventBusLayer),
  Layer.provide(StructureGeneratorLayer)
)

// 開発・デバッグ用レイヤー
export const NetherPortalsDebugLayer = Layer.mergeAll(
  NetherPortalsSystemLayer,
  Layer.effect(Context.GenericTag<PortalDebuggerInterface>('@app/PortalDebugger'), createPortalDebugger)
)

// プロダクション用最適化レイヤー
export const NetherPortalsProductionLayer = Layer.mergeAll(
  NetherPortalsSystemLayer,
  Layer.effect(Context.GenericTag<PortalCacheInterface>('@app/PortalCache'), createProductionPortalCache)
).pipe(Layer.provide(PerformanceMonitoringLayer))
```

## 使用例

```typescript
// Nether Portalsの基本的な使用例
const examplePortalUsage = Effect.gen(function* () {
  const portalEngine = yield* PortalRecognitionEngine
  const teleportEngine = yield* TeleportationEngine
  const portalNetwork = yield* PortalNetwork

  // プレイヤーがポータルフレームを構築
  const worldService = yield* WorldService
  const overworld = yield* worldService.getDimension('minecraft:overworld' as DimensionId)

  // ポータルフレームの検索
  const region = createChunkRegion(0, 0, 2, 2) // 2x2チャンク領域
  const foundFrames = yield* portalEngine.scanForPortalFrames(region, 'minecraft:overworld' as DimensionId)

  if (foundFrames.length > 0) {
    // 最初のフレームからポータルを作成
    const frame = foundFrames[0]
    const portal = yield* portalEngine.createPortalFromFrame(frame, 'minecraft:overworld' as DimensionId)

    // ポータルネットワークに登録
    yield* portalNetwork.registerPortal(portal)

    // ポータルを点火（アクティブ化）
    const activePortal = { ...portal, isActive: true }

    // プレイヤーのテレポート
    const playerId = 'player123'
    const teleportResult = yield* teleportEngine.teleportEntity(
      playerId,
      activePortal,
      'minecraft:the_nether' as DimensionId
    )

    yield* Effect.log(`Player teleported: ${teleportResult.status}`)
  }
})

// カスタムディメンションの登録例
const registerCustomDimension = Effect.gen(function* () {
  const dimensionManager = yield* DimensionManager

  const customDimension: Dimension = {
    id: 'modded:dream_dimension' as DimensionId,
    name: 'Dream Dimension',
    type: 'custom',
    coordinateScale: 4 as CoordinateScale, // 1:4スケール
    environment: {
      hasSkylight: true,
      hasWeather: false,
      hasDay: false,
      hasNight: false,
      ambientLightLevel: 10,
    },
    worldBounds: {
      minY: 0,
      maxY: 384,
      buildLimit: 320,
    },
    biomesAllowed: ['dream_plains', 'nightmare_forest'],
    specialProperties: {
      gravity: 0.5,
      jumpHeight: 2.0,
      timeFlow: 0.25,
    },
  }

  yield* dimensionManager.registerDimension(customDimension)
  yield* Effect.log('Custom dimension registered successfully')
})
```

## パフォーマンス最適化

### 1. ポータル検索の最適化

```typescript
// 効率的なポータル検索
export const optimizedPortalSearch = (region: ChunkRegion, dimension: DimensionId) =>
  Effect.gen(function* () {
    const spatialIndex = yield* createPortalSpatialIndex()

    // 段階的スキャン - 低解像度から開始
    const coarseResults = yield* scanAtResolution(region, dimension, 4) // 4x4ブロックグリッド
    const refinedResults = yield* scanAtResolution(coarseResults, dimension, 1) // 精密スキャン

    return refinedResults
  })

// 並列チャンク処理
export const parallelChunkScanning = (chunks: ReadonlyArray<ChunkCoordinate>) =>
  Effect.gen(function* () {
    const results = yield* Effect.forEach(
      chunks,
      (coord) => scanChunkForPortals(coord),
      { concurrency: Math.min(chunks.length, 8) } // 最大8並列
    )

    return results.flat()
  })
```

### 2. メモリ最適化

```typescript
// ポータルデータのプール化
export const createPortalPool = (poolSize: number) =>
  Effect.gen(function* () {
    const pool = yield* Queue.bounded<Portal>(poolSize)

    // プール初期化
    yield* Effect.forEach(Array.from({ length: poolSize }), () => Queue.offer(pool, createDefaultPortal()))

    return {
      acquire: Queue.take(pool),
      release: (portal: Portal) => Queue.offer(pool, resetPortal(portal)),
    }
  })

// 適応的キャッシュサイズ調整
export const adaptivePortalCache = Effect.gen(function* () {
  const performanceMonitor = yield* PortalPerformanceMonitor
  const cacheSize = yield* Ref.make(1000)

  return {
    adjustCacheSize: Effect.gen(function* () {
      const metrics = yield* performanceMonitor.getSystemMetrics()

      if (metrics.memoryUsage > 0.8) {
        yield* Ref.update(cacheSize, (size) => Math.max(size * 0.8, 100))
      } else if (metrics.memoryUsage < 0.5) {
        yield* Ref.update(cacheSize, (size) => Math.min(size * 1.2, 5000))
      }
    }),
  }
})
```

## テスト戦略

```typescript
describe('Nether Portals System', () => {
  const TestPortalLayer = Layer.mergeAll(NetherPortalsSystemLayer, TestWorldLayer, TestEntityLayer)

  it('should recognize valid portal frames', () =>
    Effect.gen(function* () {
      const engine = yield* PortalRecognitionEngine

      const validFrame = createTestPortalFrame(4, 5) // 4x5の有効なフレーム
      const world = yield* createTestWorld()

      const isValid = yield* engine.validatePortalFrame(validFrame, world)
      expect(isValid).toBe(true)
    }).pipe(Effect.provide(TestPortalLayer), Effect.runPromise))

  it('should calculate correct coordinate transformations', () =>
    Effect.gen(function* () {
      const dimensionManager = yield* DimensionManager

      const overworldPos = { x: 800, y: 64, z: 800 } as BlockPosition
      const netherPos = yield* dimensionManager.calculateCoordinateTransform(
        'minecraft:overworld' as DimensionId,
        'minecraft:the_nether' as DimensionId,
        overworldPos
      )

      expect(netherPos.x).toBe(100) // 800 / 8
      expect(netherPos.z).toBe(100) // 800 / 8
    }).pipe(Effect.provide(TestPortalLayer), Effect.runPromise))

  it('should handle portal linking correctly', () =>
    Effect.gen(function* () {
      const portalNetwork = yield* PortalNetwork

      const overworldPortal = createTestPortal('minecraft:overworld' as DimensionId)
      const netherPortal = createTestPortal('minecraft:the_nether' as DimensionId)

      yield* portalNetwork.registerPortal(overworldPortal)
      yield* portalNetwork.registerPortal(netherPortal)

      const link = yield* portalNetwork.createPortalLink(overworldPortal.id, netherPortal.id)

      expect(link.sourcePortal).toBe(overworldPortal.id)
      expect(link.targetPortal).toBe(netherPortal.id)
    }).pipe(Effect.provide(TestPortalLayer), Effect.runPromise))
})
```

## 拡張性とカスタムディメンション

### Custom Dimension API

```typescript
// カスタムディメンション作成のためのBuilder
export const CustomDimensionBuilder = {
  create: (id: string, name: string) => ({
    id: id as DimensionId,
    name,
    type: 'custom' as const,
    coordinateScale: 1 as CoordinateScale,
    environment: {
      hasSkylight: true,
      hasWeather: true,
      hasDay: true,
      hasNight: true,
      ambientLightLevel: 0,
    },
    worldBounds: {
      minY: -64,
      maxY: 320,
      buildLimit: 256,
    },
    biomesAllowed: [],
    specialProperties: {},
  }),

  withCoordinateScale: (scale: number) => (dimension: Dimension) => ({
    ...dimension,
    coordinateScale: scale as CoordinateScale,
  }),

  withEnvironment: (env: Partial<typeof Dimension.Type.environment>) => (dimension: Dimension) => ({
    ...dimension,
    environment: { ...dimension.environment, ...env },
  }),

  withSpecialProperty: (key: string, value: unknown) => (dimension: Dimension) => ({
    ...dimension,
    specialProperties: { ...dimension.specialProperties, [key]: value },
  }),
}

// 使用例: Sky Dimension
const createSkyDimension = pipe(
  CustomDimensionBuilder.create('modded:sky_dimension', 'Sky Dimension'),
  CustomDimensionBuilder.withCoordinateScale(2),
  CustomDimensionBuilder.withEnvironment({
    ambientLightLevel: 15,
    hasWeather: false,
  }),
  CustomDimensionBuilder.withSpecialProperty('gravity', 0.3),
  CustomDimensionBuilder.withSpecialProperty('cloudLevel', 64)
)
```

### Portal Behavior Customization

```typescript
// カスタムポータル動作の定義
export const CustomPortalBehaviors = {
  // 一方向ポータル
  oneWay: {
    allowEntry: true,
    allowExit: false,
    requiredItems: [],
    cooldown: 0,
  },

  // アイテム制限ポータル
  restrictedAccess: {
    allowEntry: true,
    allowExit: true,
    requiredItems: ['minecraft:ender_pearl'],
    cooldown: 5000, // 5秒
  },

  // ランダムテレポートポータル
  randomDestination: {
    allowEntry: true,
    allowExit: true,
    randomizeDestination: true,
    destinationRadius: 1000,
    cooldown: 1000,
  },
}

// ポータル動作のカスタマイズ
export const applyCustomPortalBehavior = (
  portal: Portal,
  behavior: (typeof CustomPortalBehaviors)[keyof typeof CustomPortalBehaviors]
) => ({
  ...portal,
  metadata: {
    ...portal.metadata,
    customBehavior: behavior,
  },
})
```

このNether Portals Systemは、Minecraftの異次元移動システムを高性能かつ拡張可能な形で実装します。Effect-TSの並行処理とSTMを活用し、複雑なポータル管理、座標変換、次元管理を効率的に処理します。プレイヤーには滑らかな異次元体験を提供し、MOD開発者には豊富なカスタマイズ機能を提供します。
