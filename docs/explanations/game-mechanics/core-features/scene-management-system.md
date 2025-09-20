---
title: '11 Scene Management System'
description: '11 Scene Management Systemに関する詳細な説明とガイド。'
category: 'specification'
difficulty: 'intermediate'
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: '15分'
---

# Scene Management System（シーン管理システム）

## 概要

Scene Management Systemは、ゲームの異なる画面（スタート画面、メイン画面、ゲームオーバー画面など）を統合管理するシステムです。Effect-TS 3.17+の最新パターン（Schema.Struct、@app/ServiceNameネームスペース）とDDDの境界づけられたコンテキストを使用し、型安全なシーン遷移を実現します。

## アーキテクチャ原則

### 1. 純粋関数型設計

- **状態機械パターン**: シーン遷移を関数型状態機械として実装
- **イミュータブル状態**: シーン状態を不変データとして管理
- **Effect包含**: 全てのシーン操作をEffect型で表現

### 2. 最新Effect-TSパターン

- **Schema.Struct**: シーンデータ定義の統一
- **@app/SceneService**: Context.GenericTag時の統一ネームスペース
- **Match.value**: シーン種別による分岐処理
- **早期リターン**: 無効なシーン遷移の即座な拒否

### 3. レイヤー統合設計

- **Domain層**: シーン状態・遷移ルール管理
- **Application層**: シーン制御ワークフロー
- **Presentation層**: UI状態連携・画面表示制御
- **Infrastructure層**: ルートレベル状態永続化

## 必須シーン定義

### ブランド型定義

```typescript
// Scene Management用ブランド型
type SceneId = string & { readonly _brand: 'SceneId' }
type LoadPriority = number & { readonly _brand: 'LoadPriority' }
type ViewDistance = number & { readonly _brand: 'ViewDistance' }
type CullingRadius = number & { readonly _brand: 'CullingRadius' }
type RenderDepth = number & { readonly _brand: 'RenderDepth' }

// ブランド型コンストラクタ
const SceneId = (id: string): SceneId => id as SceneId
const LoadPriority = (priority: number): LoadPriority => priority as LoadPriority
const ViewDistance = (distance: number): ViewDistance => distance as ViewDistance
const CullingRadius = (radius: number): CullingRadius => radius as CullingRadius
const RenderDepth = (depth: number): RenderDepth => depth as RenderDepth
```

### 基本シーン種別とスキーマ

```typescript
// シーン種別の定義
export const SceneType = Schema.Literal(
  'StartScreen', // スタート画面
  'MainGame', // メイン画面（ゲームプレイ）
  'GameOver', // ゲームオーバー画面
  'Pause', // ポーズ画面
  'Settings', // 設定画面
  'Loading', // ロード画面
  'Credits' // クレジット画面
)
export type SceneType = Schema.Schema.Type<typeof SceneType>

// シーンノード（3Dシーングラフ用）
export const SceneNode = Schema.Struct({
  _tag: Schema.Literal('SceneNode'),
  id: Schema.String.pipe(Schema.brand('SceneId')),
  priority: Schema.Number.pipe(Schema.brand('LoadPriority')),
  visible: Schema.Boolean,
  cullingRadius: Schema.Number.pipe(Schema.brand('CullingRadius')),
  renderDepth: Schema.Number.pipe(Schema.brand('RenderDepth')),
  bounds: Schema.Struct({
    min: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    max: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
  }),
  children: Schema.Array(Schema.suspend(() => SceneNode)),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
}).annotations({
  identifier: 'SceneNode',
  description: '3Dシーングラフのノード定義',
})
export type SceneNode = Schema.Schema.Type<typeof SceneNode>

// シーンデータスキーマ
export const Scene = Schema.Struct({
  _tag: Schema.Literal('Scene'),
  type: SceneType,
  id: Schema.String.pipe(Schema.brand('SceneId')),
  isActive: Schema.Boolean,
  isLoading: Schema.Boolean,
  visible: Schema.Boolean,
  sceneGraph: Schema.optional(SceneNode),
  data: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now())),
}).annotations({
  identifier: 'Scene',
  description: 'ゲームシーンの完全な定義',
})
export type Scene = Schema.Schema.Type<typeof Scene>

// シーン遷移結果
export const SceneTransition = Schema.Struct({
  _tag: Schema.Literal('SceneTransition'),
  from: Scene,
  to: Scene,
  transitionType: Schema.Literal('push', 'replace', 'pop'),
  duration: Schema.optional(Schema.Number),
  priority: Schema.Number.pipe(Schema.brand('LoadPriority')),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
}).annotations({
  identifier: 'SceneTransition',
  description: 'シーン遷移の完全な定義',
})
export type SceneTransition = Schema.Schema.Type<typeof SceneTransition>
```

### シーン状態管理

```typescript
// シーンスタック（履歴管理）
export const SceneStack = Schema.Struct({
  _tag: Schema.Literal('SceneStack'),
  scenes: Schema.Array(Scene),
  currentIndex: Schema.Number.pipe(Schema.int(), Schema.min(0)),
  maxStackSize: Schema.Number.pipe(Schema.default(() => 10)),
}).annotations({
  identifier: 'SceneStack',
  description: 'シーン履歴スタック管理',
})
export type SceneStack = Schema.Schema.Type<typeof SceneStack>

// シーン管理状態
export const SceneManagerState = Schema.Struct({
  _tag: Schema.Literal('SceneManagerState'),
  stack: SceneStack,
  isTransitioning: Schema.Boolean,
  currentTransition: Schema.NullOr(SceneTransition),
  transitionQueue: Schema.Array(SceneTransition),
  globalData: Schema.Record(Schema.String, Schema.Unknown),
  cullingEnabled: Schema.Boolean,
  lodEnabled: Schema.Boolean,
}).annotations({
  identifier: 'SceneManagerState',
  description: 'シーンマネージャーの完全な状態',
})
export type SceneManagerState = Schema.Schema.Type<typeof SceneManagerState>
```

## エラー定義

```typescript
// シーン遷移エラー（Schema.TaggedErrorパターン）
export const SceneTransitionError = Schema.TaggedError("SceneTransitionError")({
  fromScene: Scene,
  toSceneType: SceneType,
  reason: Schema.String,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
}) {}

// シーン初期化エラー
export const SceneInitializationError = Schema.TaggedError("SceneInitializationError")({
  sceneId: Schema.String.pipe(Schema.brand("SceneId")),
  sceneType: SceneType,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

// シーンライフサイクルエラー
export const SceneLifecycleError = Schema.TaggedError("SceneLifecycleError")({
  sceneId: Schema.String.pipe(Schema.brand("SceneId")),
  lifecycle: Schema.Literal("enter", "update", "exit", "cleanup"),
  error: Schema.String
}) {}

// カリングシステムエラー
export const CullingError = Schema.TaggedError("CullingError")({
  nodeId: Schema.String.pipe(Schema.brand("SceneId")),
  cullingType: Schema.Literal("frustum", "occlusion", "distance"),
  reason: Schema.String
}) {}

// LODエラー
export const LODError = Schema.TaggedError("LODError")({
  nodeId: Schema.String.pipe(Schema.brand("SceneId")),
  distance: Schema.Number.pipe(Schema.brand("ViewDistance")),
  message: Schema.String
}) {}

// シーンリソース読み込みエラー
export const SceneResourceError = Schema.TaggedError("SceneResourceError")({
  sceneId: Schema.String.pipe(Schema.brand("SceneId")),
  resourceType: Schema.Literal("texture", "mesh", "shader", "audio"),
  path: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}
```

## サービス定義

### Scene Manager Service

```typescript
interface SceneManagerService {
  // 基本シーン操作
  readonly getCurrentScene: () => Effect.Effect<Option.Option<Scene>, never>
  readonly transitionTo: (sceneType: SceneType, data?: unknown) => Effect.Effect<void, SceneTransitionError>
  readonly pushScene: (sceneType: SceneType, data?: unknown) => Effect.Effect<void, SceneTransitionError>
  readonly popScene: () => Effect.Effect<Option.Option<Scene>, SceneTransitionError>
  readonly replaceScene: (sceneType: SceneType, data?: unknown) => Effect.Effect<void, SceneTransitionError>

  // Stream-based scene transitions
  readonly sceneTransitionStream: () => Stream.Stream<SceneTransition, SceneTransitionError>
  readonly subscribeToSceneChanges: () => Stream.Stream<Scene, never>

  // 状態管理
  readonly getSceneStack: () => Effect.Effect<SceneStack, never>
  readonly clearSceneStack: () => Effect.Effect<void, never>
  readonly isTransitioning: () => Effect.Effect<boolean, never>

  // ライフサイクル管理
  readonly initializeScene: (sceneType: SceneType, data?: unknown) => Effect.Effect<Scene, SceneInitializationError>
  readonly cleanupScene: (sceneId: SceneId) => Effect.Effect<void, SceneLifecycleError>

  // Scene Graph管理
  readonly updateSceneGraph: (sceneId: SceneId, graph: SceneNode) => Effect.Effect<void, SceneLifecycleError>
  readonly getSceneGraph: (sceneId: SceneId) => Effect.Effect<Option.Option<SceneNode>, never>

  // イベント処理
  readonly handleSceneInput: (sceneId: SceneId, input: InputEvent) => Effect.Effect<void, never>
  readonly updateScene: (sceneId: SceneId, deltaTime: number) => Effect.Effect<Scene, SceneLifecycleError>
}

export const SceneManagerService = Context.GenericTag<SceneManagerService>('@minecraft/SceneManagerService')
```

### Scene Graph Service（3Dシーングラフ管理）

```typescript
interface SceneGraphService {
  // シーングラフ構築
  readonly createNode: (id: SceneId, priority: LoadPriority) => Effect.Effect<SceneNode, never>
  readonly addChild: (parent: SceneId, child: SceneNode) => Effect.Effect<void, never>
  readonly removeChild: (parent: SceneId, childId: SceneId) => Effect.Effect<Option.Option<SceneNode>, never>

  // 階層管理
  readonly traverseDepthFirst: <A>(
    node: SceneNode,
    f: (node: SceneNode) => Effect.Effect<A, never>
  ) => Effect.Effect<ReadonlyArray<A>, never>
  readonly findNode: (
    rootNode: SceneNode,
    predicate: (node: SceneNode) => boolean
  ) => Effect.Effect<Option.Option<SceneNode>, never>

  // 可視性管理
  readonly updateVisibility: (nodeId: SceneId, visible: boolean) => Effect.Effect<void, never>
  readonly getVisibleNodes: (rootNode: SceneNode) => Effect.Effect<ReadonlyArray<SceneNode>, never>
}

export const SceneGraphService = Context.GenericTag<SceneGraphService>('@minecraft/SceneGraphService')
```

### Culling Service（カリングシステム）

```typescript
interface CullingService {
  // フラスタムカリング
  readonly performFrustumCulling: (
    nodes: ReadonlyArray<SceneNode>,
    camera: CameraState
  ) => Effect.Effect<ReadonlyArray<SceneNode>, CullingError>
  readonly checkFrustumIntersection: (node: SceneNode, frustum: Frustum) => Effect.Effect<boolean, never>

  // オクルージョンカリング
  readonly performOcclusionCulling: (
    nodes: ReadonlyArray<SceneNode>
  ) => Effect.Effect<ReadonlyArray<SceneNode>, CullingError>
  readonly isOccluded: (node: SceneNode, occluders: ReadonlyArray<SceneNode>) => Effect.Effect<boolean, never>

  // 距離ベースカリング
  readonly performDistanceCulling: (
    nodes: ReadonlyArray<SceneNode>,
    viewPosition: Vector3,
    maxDistance: ViewDistance
  ) => Effect.Effect<ReadonlyArray<SceneNode>, CullingError>

  // ストリーミング統合
  readonly cullingStream: () => Stream.Stream<ReadonlyArray<SceneNode>, CullingError>
}

export const CullingService = Context.GenericTag<CullingService>('@minecraft/CullingService')
```

### LOD Service（レベルオブディテール）

```typescript
interface LODService {
  // LOD計算
  readonly calculateLOD: (distance: ViewDistance) => Effect.Effect<LODLevel, never>
  readonly updateNodeLOD: (node: SceneNode, lodLevel: LODLevel) => Effect.Effect<SceneNode, LODError>

  // 距離ベース管理
  readonly updateLODByDistance: (
    nodes: ReadonlyArray<SceneNode>,
    viewPosition: Vector3
  ) => Effect.Effect<ReadonlyArray<SceneNode>, LODError>
  readonly getLODRanges: () => Effect.Effect<ReadonlyMap<LODLevel, { min: ViewDistance; max: ViewDistance }>, never>

  // ストリーミング統合
  readonly lodUpdateStream: () => Stream.Stream<ReadonlyArray<SceneNode>, LODError>
}

const LODLevel = Schema.Literal('NONE', 'LOW', 'MEDIUM', 'HIGH')
type LODLevel = Schema.Schema.Type<typeof LODLevel>

export const LODService = Context.GenericTag<LODService>('@minecraft/LODService')
```

### Scene Service（個別シーン管理）

```typescript
interface SceneService {
  // シーン固有操作
  readonly createScene: (type: SceneType, data?: unknown) => Effect.Effect<Scene, SceneInitializationError>
  readonly validateSceneData: (scene: Scene) => Effect.Effect<void, ValidationError>

  // 遷移ルール管理
  readonly canTransitionTo: (from: SceneType, to: SceneType) => Effect.Effect<boolean, never>
  readonly getTransitionRules: () => Effect.Effect<ReadonlyMap<SceneType, ReadonlyArray<SceneType>>, never>

  // シーンライフサイクル
  readonly onSceneEnter: (scene: Scene) => Effect.Effect<void, SceneLifecycleError>
  readonly onSceneExit: (scene: Scene) => Effect.Effect<void, SceneLifecycleError>
  readonly onSceneUpdate: (scene: Scene, deltaTime: number) => Effect.Effect<Scene, SceneLifecycleError>

  // リソース管理
  readonly preloadSceneResources: (sceneType: SceneType) => Effect.Effect<void, SceneResourceError>
  readonly unloadSceneResources: (sceneId: SceneId) => Effect.Effect<void, never>
}

export const SceneService = Context.GenericTag<SceneService>('@minecraft/SceneService')
```

## 実装パターン

### 1. Stream-based Scene Transitions（ストリームベース遷移制御）

```typescript
// 遷移ルール定義（Schema.Structベース）
const TransitionRules = Schema.Struct({
  _tag: Schema.Literal('TransitionRules'),
  rules: Schema.Record(SceneType, Schema.Array(SceneType)),
}).annotations({
  identifier: 'TransitionRules',
  description: 'シーン遷移ルールの定義',
})

const createTransitionRules = (): Effect.Effect<ReadonlyMap<SceneType, ReadonlyArray<SceneType>>, never> =>
  Effect.succeed(
    new Map([
      ['StartScreen', ['MainGame', 'Settings', 'Credits'] as const],
      ['MainGame', ['Pause', 'GameOver', 'Settings'] as const],
      ['Pause', ['MainGame', 'Settings', 'StartScreen'] as const],
      ['GameOver', ['StartScreen', 'MainGame'] as const],
      ['Settings', ['StartScreen', 'MainGame', 'Pause'] as const],
      ['Loading', ['StartScreen', 'MainGame'] as const],
      ['Credits', ['StartScreen'] as const],
    ])
  )

// Stream-based遷移バリデーション
const validateTransitionStream = (from: SceneType, to: SceneType): Stream.Stream<void, SceneTransitionError> =>
  Stream.fromEffect(
    Effect.gen(function* () {
      const rules = yield* createTransitionRules()
      const allowedTransitions = rules.get(from)

      // 早期リターン: ルールが存在しない場合
      if (!allowedTransitions) {
        return yield* Effect.fail(
          new SceneTransitionError({
            fromScene: {
              _tag: 'Scene' as const,
              type: from,
              id: SceneId(''),
              isActive: false,
              isLoading: false,
              visible: false,
              timestamp: Date.now(),
            },
            toSceneType: to,
            reason: `No transition rules defined for scene: ${from}`,
            timestamp: Date.now(),
          })
        )
      }

      // 早期リターン: 無効な遷移の場合
      if (!allowedTransitions.includes(to)) {
        return yield* Effect.fail(
          new SceneTransitionError({
            fromScene: {
              _tag: 'Scene' as const,
              type: from,
              id: SceneId(''),
              isActive: false,
              isLoading: false,
              visible: false,
              timestamp: Date.now(),
            },
            toSceneType: to,
            reason: `Invalid transition from ${from} to ${to}. Allowed: ${allowedTransitions.join(', ')}`,
            timestamp: Date.now(),
          })
        )
      }
    })
  )

// シーン遷移実行（Stream処理）
const executeTransitionStream = (
  currentState: SceneManagerState,
  toSceneType: SceneType,
  transitionType: 'push' | 'replace' | 'pop',
  priority: LoadPriority,
  data?: unknown
): Stream.Stream<SceneManagerState, SceneTransitionError> =>
  Stream.fromEffect(
    Effect.gen(function* () {
      const currentScene = yield* getCurrentSceneFromStack(currentState.stack)

      // 現在のシーンが存在する場合は遷移バリデーション実行
      if (Option.isSome(currentScene)) {
        yield* Stream.runDrain(validateTransitionStream(currentScene.value.type, toSceneType))
      }

      // 新しいシーン作成
      const newScene = yield* createSceneInstance(toSceneType, data)

      // 遷移タイプによる処理分岐（パターンマッチング）
      const newStack = yield* Match.value(transitionType).pipe(
        Match.when('push', () => pushToStack(currentState.stack, newScene)),
        Match.when('replace', () => replaceInStack(currentState.stack, newScene)),
        Match.when('pop', () => popFromStack(currentState.stack)),
        Match.exhaustive
      )

      return {
        ...currentState,
        stack: newStack,
        isTransitioning: true,
        currentTransition: {
          _tag: 'SceneTransition' as const,
          from: Option.getOrElse(currentScene, () => newScene),
          to: newScene,
          transitionType,
          priority,
          metadata: data ? { data } : undefined,
        },
        cullingEnabled: true,
        lodEnabled: true,
      }
    })
  )
```

### 2. Scene Graph with Cache and Resource Management

````typescript
// Scene Resource Cache
const createSceneResourceCache = (): Effect.Effect<Cache.Cache<SceneId, SceneResources, SceneResourceError>, never> =>
  Cache.make({
    capacity: 1000,
    timeToLive: Duration.minutes(10),
    lookup: (sceneId: SceneId) =>
      Effect.gen(function* () {
        const resourceLoader = yield* SceneResourceLoader
        const resources = yield* resourceLoader.loadResources(sceneId)
        return resources
      }).pipe(
        Effect.mapError((cause) => new SceneResourceError({
          sceneId,
          resourceType: "texture",
          path: "unknown",
          cause
        }))
      )
  })

// シーングラフ構築（Context Service統合）
const buildSceneGraph = (sceneType: SceneType, data?: unknown): Effect.Effect<SceneNode, SceneInitializationError> =>
  Effect.gen(function* () {
    const sceneGraphService = yield* SceneGraphService
    const sceneId = SceneId(`${sceneType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)

    // シーンタイプ別グラフ構築（パターンマッチング）
    const rootNode = yield* Match.value(sceneType).pipe(
      Match.when("StartScreen", () => buildStartScreenGraph(sceneId, data)),
      Match.when("MainGame", () => buildMainGameGraph(sceneId, data)),
      Match.when("GameOver", () => buildGameOverGraph(sceneId, data)),
      Match.when("Pause", () => buildPauseGraph(sceneId)),
      Match.when("Settings", () => buildSettingsGraph(sceneId)),
      Match.when("Loading", () => buildLoadingGraph(sceneId, data)),
      Match.when("Credits", () => buildCreditsGraph(sceneId)),
      Match.exhaustive
    )

    yield* Effect.log(`Scene graph built: ${sceneType} (${sceneId})`)
    return rootNode
  }).pipe(
    Effect.mapError((error) => new SceneInitializationError({
      sceneId: SceneId(""),
      sceneType,
      message: `Failed to build scene graph: ${sceneType}`,
      cause: error
    }))
  )

// シーン初期化（スコープ付きリソース管理）
const initializeSpecificScene = (
  sceneType: SceneType,
  data?: unknown
): Effect.Effect<Scene, SceneInitializationError> =>
  Effect.gen(function* () {
    const sceneId = SceneId(`${sceneType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)

    // リソースキャッシュ取得
    const resourceCache = yield* createSceneResourceCache()

    // シーングラフ構築
    const sceneGraph = yield* buildSceneGraph(sceneType, data)

    // シーンタイプ別初期化処理（早期リターンパターン）
    yield* Match.value(sceneType).pipe(
      Match.when("StartScreen", () => initializeStartScreen(data)),
      Match.when("MainGame", () => initializeMainGame(data)),
      Match.when("GameOver", () => initializeGameOverScreen(data)),
      Match.when("Pause", () => initializePauseScreen()),
      Match.when("Settings", () => initializeSettingsScreen()),
      Match.when("Loading", () => initializeLoadingScreen(data)),
      Match.when("Credits", () => initializeCreditsScreen()),
      Match.exhaustive
    )

    // リソース事前読み込み
    yield* resourceCache.get(sceneId).pipe(
      Effect.forkDaemon // バックグラウンドで実行
    )

    const scene: Scene = {
      _tag: "Scene" as const,
      type: sceneType,
      id: sceneId,
      isActive: false,
      isLoading: true,
      visible: true,
      sceneGraph: Option.some(sceneGraph),
      data: data ? { sceneData: data } : undefined,
      timestamp: Date.now()
    }

    yield* Effect.log(`Scene initialized: ${sceneType} (${sceneId})`)
    return scene
  }).pipe(
    Effect.mapError((error) => new SceneInitializationError({
      sceneId: SceneId(""),
      sceneType,
      message: `Failed to initialize scene: ${sceneType}`,
      cause: error
    }))
  )

### 3. Frustum Culling System（フラスタムカリングシステム）
```typescript
// フラスタム定義
const Frustum = Schema.Struct({
  _tag: Schema.Literal("Frustum"),
  planes: Schema.Array(Schema.Struct({
    normal: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    distance: Schema.Number
  }))
}).annotations({
  identifier: "Frustum",
  description: "カメラフラスタム定義"
})
type Frustum = Schema.Schema.Type<typeof Frustum>

// フラスタムカリング実装
const performFrustumCulling = (
  nodes: ReadonlyArray<SceneNode>,
  camera: CameraState
): Effect.Effect<ReadonlyArray<SceneNode>, CullingError> =>
  Effect.gen(function* () {
    const cullingService = yield* CullingService
    const frustum = yield* camera.getFrustum()

    // 可視ノードフィルタリング（Stream処理）
    const visibleNodes = yield* Stream.fromIterable(nodes).pipe(
      Stream.filterEffect((node) =>
        cullingService.checkFrustumIntersection(node, frustum).pipe(
          Effect.map((isVisible) => isVisible),
          Effect.catchAll((error) => {
            // 早期リターン: カリングエラーは非表示として扱う
            return Effect.succeed(false)
          })
        )
      ),
      Stream.runCollect,
      Effect.map(Chunk.toReadonlyArray)
    )

    yield* Effect.log(`Frustum culling: ${nodes.length} -> ${visibleNodes.length} nodes`)
    return visibleNodes
  }).pipe(
    Effect.mapError((cause) => new CullingError({
      nodeId: SceneId("unknown"),
      cullingType: "frustum",
      reason: `Frustum culling failed: ${cause}`
    }))
  )

// フラスタム交差判定（パターンマッチング）
const checkFrustumIntersection = (node: SceneNode, frustum: Frustum): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const bounds = node.bounds

    // AABB vs Frustum判定（早期リターン）
    for (const plane of frustum.planes) {
      const { normal, distance } = plane

      // 最も近い頂点を計算
      const closestVertex = {
        x: normal.x > 0 ? bounds.max.x : bounds.min.x,
        y: normal.y > 0 ? bounds.max.y : bounds.min.y,
        z: normal.z > 0 ? bounds.max.z : bounds.min.z
      }

      // 平面との距離計算
      const distanceToPlane =
        normal.x * closestVertex.x +
        normal.y * closestVertex.y +
        normal.z * closestVertex.z +
        distance

      // 早期リターン: フラスタム外の場合
      if (distanceToPlane < 0) {
        return false
      }
    }

    return true
  })
````

### 4. Level of Detail (LOD) System

```typescript
// LOD計算（距離ベース）
const calculateLODLevel = (distance: ViewDistance): Effect.Effect<LODLevel, never> =>
  Effect.succeed(
    Match.value(distance).pipe(
      Match.when(
        (d) => d < ViewDistance(16),
        () => 'HIGH' as const
      ),
      Match.when(
        (d) => d < ViewDistance(64),
        () => 'MEDIUM' as const
      ),
      Match.when(
        (d) => d < ViewDistance(256),
        () => 'LOW' as const
      ),
      Match.orElse(() => 'NONE' as const)
    )
  )

// LODシステム統合（Stream処理）
const updateSceneWithLOD = (sceneNode: SceneNode, viewPosition: Vector3): Stream.Stream<SceneNode, LODError> =>
  Stream.fromEffect(
    Effect.gen(function* () {
      const lodService = yield* LODService

      // ノード距離計算
      const nodeCenter = calculateNodeCenter(sceneNode.bounds)
      const distance = ViewDistance(calculateDistance(viewPosition, nodeCenter))

      // 早期リターン: カリング距離外
      if (distance > sceneNode.cullingRadius) {
        return sceneNode
      }

      // LODレベル計算
      const lodLevel = yield* calculateLODLevel(distance)

      // LOD適用
      const updatedNode = yield* lodService.updateNodeLOD(sceneNode, lodLevel)

      // 子ノードの再帰処理（浅いネスト）
      const updatedChildren = yield* Stream.fromIterable(sceneNode.children).pipe(
        Stream.mapEffect((child) =>
          updateSceneWithLOD(child, viewPosition).pipe(
            Stream.runCollect,
            Effect.map(Chunk.head),
            Effect.map(Option.getOrElse(() => child))
          )
        ),
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray)
      )

      return {
        ...updatedNode,
        children: updatedChildren,
      }
    })
  )

// シーン更新ループ（統合版）
const updateSceneLoop = (
  scene: Scene,
  deltaTime: number,
  viewPosition: Vector3
): Effect.Effect<Scene, SceneLifecycleError> =>
  Effect.gen(function* () {
    // 早期リターン: 非アクティブシーンはスキップ
    if (!scene.isActive) {
      return scene
    }

    // 早期リターン: 無効なdeltaTime
    if (deltaTime <= 0 || deltaTime > 1000) {
      return scene
    }

    // シーングラフ更新（LODとカリング適用）
    const updatedSceneGraph = yield* pipe(
      scene.sceneGraph,
      Option.match({
        onNone: () => Effect.succeed(Option.none<SceneNode>()),
        onSome: (graph) =>
          updateSceneWithLOD(graph, viewPosition).pipe(
            Stream.runCollect,
            Effect.map(Chunk.head),
            Effect.map(Option.some)
          ),
      })
    )

    // シーンタイプ別更新処理（パターンマッチング）
    const updatedData = yield* Match.value(scene.type).pipe(
      Match.when('StartScreen', () => updateStartScreen(scene.data, deltaTime)),
      Match.when('MainGame', () => updateMainGame(scene.data, deltaTime, viewPosition)),
      Match.when('GameOver', () => updateGameOverScreen(scene.data, deltaTime)),
      Match.when('Pause', () => Effect.succeed(scene.data)), // ポーズ中は更新しない
      Match.when('Settings', () => updateSettingsScreen(scene.data, deltaTime)),
      Match.when('Loading', () => updateLoadingScreen(scene.data, deltaTime)),
      Match.when('Credits', () => updateCreditsScreen(scene.data, deltaTime)),
      Match.exhaustive
    )

    return {
      ...scene,
      sceneGraph: updatedSceneGraph,
      data: updatedData,
      timestamp: Date.now(),
    }
  }).pipe(
    Effect.mapError(
      (error) =>
        new SceneLifecycleError({
          sceneId: scene.id,
          lifecycle: 'update',
          error: `Update failed: ${error}`,
        })
    )
  )
```

### 5. Scene Streaming and Preloading

```typescript
// チャンクストリーミング読み込み
const chunkStreamingSystem = (
  viewPosition: Vector3,
  viewDistance: ViewDistance
): Stream.Stream<SceneNode, SceneResourceError> =>
  Stream.repeatEffect(
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      const nearbyChunks = yield* chunkService.getNearbyChunks(viewPosition, viewDistance)

      // 未読み込みチャンクの検出
      const unloadedChunks = yield* Stream.fromIterable(nearbyChunks).pipe(
        Stream.filterEffect((chunk) => chunkService.isChunkLoaded(chunk.id).pipe(Effect.map((loaded) => !loaded))),
        Stream.take(4), // 同時読み込み制限
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray)
      )

      // 並行読み込み
      const loadedChunks = yield* Effect.all(
        unloadedChunks.map((chunk) => loadChunkSceneGraph(chunk.id)),
        { concurrency: 2 } // 並行度制限
      )

      return loadedChunks[0] // 最初の読み込み済みチャンクを返す
    })
  ).pipe(
    Stream.take(1),
    Stream.repeat(Schedule.spaced(Duration.millis(100))) // 100ms間隔で実行
  )

// プリロード戦略（優先度ベース）
const preloadSceneResources = (sceneType: SceneType, priority: LoadPriority): Effect.Effect<void, SceneResourceError> =>
  Effect.gen(function* () {
    const resourceCache = yield* createSceneResourceCache()
    const sceneService = yield* SceneService

    // プリロード対象のシーン決定
    const preloadTargets = yield* Match.value(sceneType).pipe(
      Match.when('MainGame', () => Effect.succeed(['Pause', 'GameOver'] as const)),
      Match.when('StartScreen', () => Effect.succeed(['MainGame', 'Settings'] as const)),
      Match.when('GameOver', () => Effect.succeed(['StartScreen'] as const)),
      Match.orElse(() => Effect.succeed([] as ReadonlyArray<SceneType>))
    )

    // 優先度順でリソースプリロード
    yield* Effect.all(
      preloadTargets.map((targetScene) =>
        sceneService.preloadSceneResources(targetScene).pipe(
          Effect.forkDaemon // バックグラウンドで実行
        )
      ),
      { concurrency: 2 }
    )

    yield* Effect.log(`Preloaded resources for ${sceneType} with priority ${priority}`)
  })
```

````

### 3. 特定シーン実装例

#### Start Screen（スタート画面）
```typescript
// スタートスクリーンのデータ定義
const StartScreenData = Schema.Struct({
  selectedMenuIndex: Schema.Number.pipe(Schema.int(), Schema.min(0)),
  menuItems: Schema.Array(Schema.String),
  isAnimating: Schema.Boolean,
  backgroundAnimation: Schema.optional(Schema.Unknown)
})
type StartScreenData = Schema.Schema.Type<typeof StartScreenData>

const initializeStartScreen = (data?: unknown): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // BGM開始
    yield* startBackgroundMusic("menu-theme")

    // UI要素初期化
    yield* initializeMenuUI()

    // アニメーション開始
    yield* startBackgroundAnimation()

    yield* Effect.log("Start screen initialized")
  })

const updateStartScreen = (
  currentData: unknown,
  deltaTime: number
): Effect.Effect<unknown, never> =>
  Effect.gen(function* () {
    const data = currentData as StartScreenData | undefined

    const menuItems = ["新規ゲーム", "続きから", "設定", "終了"]

    const updatedData: StartScreenData = {
      selectedMenuIndex: data?.selectedMenuIndex ?? 0,
      menuItems,
      isAnimating: data?.isAnimating ?? true,
      backgroundAnimation: yield* updateBackgroundAnimation(deltaTime)
    }

    return updatedData
  })

const handleStartScreenInput = (input: InputEvent): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* Match.value(input).pipe(
      Match.tag("MENU_UP", () => moveCursorUp()),
      Match.tag("MENU_DOWN", () => moveCursorDown()),
      Match.tag("MENU_SELECT", () => selectMenuItem()),
      Match.tag("MENU_BACK", () => Effect.unit),
      Match.orElse(() => Effect.unit)
    )
  })
````

#### Main Game（メインゲーム画面）

```typescript
const MainGameData = Schema.Struct({
  worldLoaded: Schema.Boolean,
  playerSpawned: Schema.Boolean,
  gameTime: Schema.Number,
  isPaused: Schema.Boolean,
  performance: Schema.Struct({
    fps: Schema.Number,
    frameTime: Schema.Number,
    memoryUsage: Schema.Number,
  }),
})
type MainGameData = Schema.Schema.Type<typeof MainGameData>

const initializeMainGame = (data?: unknown): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // ワールド初期化
    yield* initializeWorld()

    // プレイヤー生成
    yield* spawnPlayer()

    // レンダリングシステム開始
    yield* startRenderingSystem()

    // 物理システム開始
    yield* startPhysicsSystem()

    // HUD表示
    yield* showGameHUD()

    yield* Effect.log('Main game initialized')
  })

const updateMainGame = (currentData: unknown, deltaTime: number): Effect.Effect<unknown, never> =>
  Effect.gen(function* () {
    const data = currentData as MainGameData | undefined

    // ゲーム時間更新
    const gameTime = (data?.gameTime ?? 0) + deltaTime

    // パフォーマンス監視
    const performance = yield* getPerformanceMetrics()

    const updatedData: MainGameData = {
      worldLoaded: true,
      playerSpawned: true,
      gameTime,
      isPaused: data?.isPaused ?? false,
      performance,
    }

    return updatedData
  })
```

#### Game Over Screen（ゲームオーバー画面）

```typescript
const GameOverData = Schema.Struct({
  playerStats: Schema.Struct({
    survivalTime: Schema.Number,
    blocksPlaced: Schema.Number,
    distanceTraveled: Schema.Number,
  }),
  highScore: Schema.Boolean,
  selectedOption: Schema.Number.pipe(Schema.int(), Schema.min(0)),
  fadeInProgress: Schema.Number.pipe(Schema.clamp(0, 1)),
})
type GameOverData = Schema.Schema.Type<typeof GameOverData>

const initializeGameOverScreen = (data?: unknown): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // ゲーム統計取得
    const playerStats = yield* getPlayerStats()

    // ハイスコア判定
    const isHighScore = yield* checkHighScore(playerStats.survivalTime)

    // ゲームオーバー音楽再生
    yield* playGameOverSound()

    // UI表示
    yield* showGameOverUI(playerStats, isHighScore)

    yield* Effect.log('Game over screen initialized')
  })

const updateGameOverScreen = (currentData: unknown, deltaTime: number): Effect.Effect<unknown, never> =>
  Effect.gen(function* () {
    const data = currentData as GameOverData | undefined

    // フェードインアニメーション更新
    const fadeInProgress = Math.min(1, (data?.fadeInProgress ?? 0) + deltaTime / 2000)

    const updatedData: GameOverData = {
      playerStats: data?.playerStats ?? { survivalTime: 0, blocksPlaced: 0, distanceTraveled: 0 },
      highScore: data?.highScore ?? false,
      selectedOption: data?.selectedOption ?? 0,
      fadeInProgress,
    }

    return updatedData
  })
```

## Layer構成

```typescript
// Scene Management Layer構成（最新パターン）
export const SceneSystemLayer = Layer.mergeAll(
  SceneManagerServiceLive,
  SceneGraphServiceLive,
  CullingServiceLive,
  LODServiceLive,
  SceneServiceLive
).pipe(Layer.provide(ConfigLayer), Layer.provide(LoggingLayer), Layer.provide(CacheLayer))

// 開発・テスト用の軽量Layer
export const SceneSystemTestLayer = Layer.mergeAll(
  TestSceneManagerServiceLive,
  TestSceneGraphServiceLive,
  TestSceneServiceLive
).pipe(Layer.provide(TestConfigLayer), Layer.provide(TestCacheLayer))

// Scene Manager Service実装（Stream統合）
export const SceneManagerServiceLive = Layer.effect(
  SceneManagerService,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(createInitialSceneManagerState())
    const transitionHub = yield* Hub.bounded<SceneTransition>(100)
    const sceneChangeHub = yield* Hub.bounded<Scene>(50)

    const service: SceneManagerService = {
      getCurrentScene: () => Ref.get(stateRef).pipe(Effect.map((state) => getCurrentSceneFromStack(state.stack))),

      transitionTo: (sceneType: SceneType, data?: unknown) =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(stateRef)
          const priority = LoadPriority(1) // デフォルト優先度

          const newState = yield* executeTransitionStream(currentState, sceneType, 'replace', priority, data).pipe(
            Stream.runCollect,
            Effect.map(Chunk.head),
            Effect.flatMap(
              Option.match({
                onNone: () =>
                  Effect.fail(
                    new SceneTransitionError({
                      fromScene: currentState.stack.scenes[0],
                      toSceneType: sceneType,
                      reason: 'Failed to execute transition',
                      timestamp: Date.now(),
                    })
                  ),
                onSome: Effect.succeed,
              })
            )
          )

          yield* Ref.set(stateRef, newState)

          // Scene change通知
          if (newState.currentTransition) {
            yield* Hub.offer(transitionHub, newState.currentTransition)
            yield* Hub.offer(sceneChangeHub, newState.currentTransition.to)
          }

          yield* Effect.log(`Scene transition: -> ${sceneType}`)
        }),

      // Stream-based遷移監視
      sceneTransitionStream: () => Stream.fromHub(transitionHub),
      subscribeToSceneChanges: () => Stream.fromHub(sceneChangeHub),

      // Scene Graph統合
      updateSceneGraph: (sceneId: SceneId, graph: SceneNode) =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(stateRef)
          const scene = currentState.stack.scenes.find((s) => s.id === sceneId)

          if (!scene) {
            return yield* Effect.fail(
              new SceneLifecycleError({
                sceneId,
                lifecycle: 'update',
                error: 'Scene not found',
              })
            )
          }

          const updatedScene = { ...scene, sceneGraph: Option.some(graph) }
          const updatedScenes = currentState.stack.scenes.map((s) => (s.id === sceneId ? updatedScene : s))

          yield* Ref.set(stateRef, {
            ...currentState,
            stack: { ...currentState.stack, scenes: updatedScenes },
          })
        }),

      getSceneGraph: (sceneId: SceneId) =>
        Ref.get(stateRef).pipe(
          Effect.map((state) => {
            const scene = state.stack.scenes.find((s) => s.id === sceneId)
            return scene?.sceneGraph || Option.none()
          })
        ),

      // その他のメソッド実装...
    }

    return service
  })
)

// Culling Service実装
export const CullingServiceLive = Layer.effect(
  CullingService,
  Effect.gen(function* () {
    const cullingCache = yield* Cache.make({
      capacity: 500,
      timeToLive: Duration.millis(100), // 100ms cache for culling results
      lookup: (key: string) => Effect.succeed(new Set<SceneId>()),
    })

    return CullingService.of({
      performFrustumCulling: (nodes: ReadonlyArray<SceneNode>, camera: CameraState) =>
        performFrustumCulling(nodes, camera),

      checkFrustumIntersection: (node: SceneNode, frustum: Frustum) => checkFrustumIntersection(node, frustum),

      performOcclusionCulling: (nodes: ReadonlyArray<SceneNode>) =>
        Effect.gen(function* () {
          // オクルージョンカリング実装
          const visibleNodes = yield* Stream.fromIterable(nodes).pipe(
            Stream.filterEffect((node) =>
              Effect.gen(function* () {
                // 簡易オクルージョン判定
                const occluders = nodes.filter((n) => n.id !== node.id && n.visible)
                return yield* isOccluded(node, occluders).pipe(Effect.map((occluded) => !occluded))
              })
            ),
            Stream.runCollect,
            Effect.map(Chunk.toReadonlyArray)
          )

          return visibleNodes
        }),

      performDistanceCulling: (nodes, viewPosition, maxDistance) =>
        Effect.gen(function* () {
          const visibleNodes = yield* Stream.fromIterable(nodes).pipe(
            Stream.filter((node) => {
              const nodeCenter = calculateNodeCenter(node.bounds)
              const distance = calculateDistance(viewPosition, nodeCenter)
              return distance <= maxDistance
            }),
            Stream.runCollect,
            Effect.map(Chunk.toReadonlyArray)
          )

          return visibleNodes
        }),

      cullingStream: () =>
        Stream.repeatEffect(
          Effect.gen(function* () {
            const camera = yield* CameraService
            const sceneManager = yield* SceneManagerService
            const currentScene = yield* sceneManager.getCurrentScene()

            return yield* pipe(
              currentScene,
              Option.match({
                onNone: () => Effect.succeed([]),
                onSome: (scene) =>
                  pipe(
                    scene.sceneGraph,
                    Option.match({
                      onNone: () => Effect.succeed([]),
                      onSome: (graph) => performFrustumCulling([graph], camera),
                    })
                  ),
              })
            )
          })
        ).pipe(
          Stream.schedule(Schedule.spaced(Duration.millis(16))) // 60 FPS
        ),
    })
  })
)

// LOD Service実装
export const LODServiceLive = Layer.effect(
  LODService,
  Effect.gen(function* () {
    const lodCache = yield* Cache.make({
      capacity: 1000,
      timeToLive: Duration.seconds(1),
      lookup: (distance: ViewDistance) => calculateLODLevel(distance),
    })

    return LODService.of({
      calculateLOD: (distance: ViewDistance) => lodCache.get(distance),

      updateNodeLOD: (node: SceneNode, lodLevel: LODLevel) =>
        Effect.succeed({
          ...node,
          metadata: {
            ...node.metadata,
            currentLOD: lodLevel,
          },
        }),

      updateLODByDistance: (nodes, viewPosition) =>
        Effect.gen(function* () {
          const updatedNodes = yield* Stream.fromIterable(nodes).pipe(
            Stream.mapEffect((node) =>
              Effect.gen(function* () {
                const nodeCenter = calculateNodeCenter(node.bounds)
                const distance = ViewDistance(calculateDistance(viewPosition, nodeCenter))
                const lodLevel = yield* calculateLODLevel(distance)
                return yield* updateNodeLOD(node, lodLevel)
              })
            ),
            Stream.runCollect,
            Effect.map(Chunk.toReadonlyArray)
          )

          return updatedNodes
        }),

      getLODRanges: () =>
        Effect.succeed(
          new Map([
            ['HIGH', { min: ViewDistance(0), max: ViewDistance(16) }],
            ['MEDIUM', { min: ViewDistance(16), max: ViewDistance(64) }],
            ['LOW', { min: ViewDistance(64), max: ViewDistance(256) }],
            ['NONE', { min: ViewDistance(256), max: ViewDistance(Infinity) }],
          ])
        ),

      lodUpdateStream: () =>
        Stream.repeatEffect(
          Effect.gen(function* () {
            const player = yield* PlayerService
            const sceneManager = yield* SceneManagerService
            const viewPosition = yield* player.getPosition()
            const currentScene = yield* sceneManager.getCurrentScene()

            return yield* pipe(
              currentScene,
              Option.match({
                onNone: () => Effect.succeed([]),
                onSome: (scene) =>
                  pipe(
                    scene.sceneGraph,
                    Option.match({
                      onNone: () => Effect.succeed([]),
                      onSome: (graph) => updateLODByDistance([graph], viewPosition),
                    })
                  ),
              })
            )
          })
        ).pipe(
          Stream.schedule(Schedule.spaced(Duration.millis(100))) // 10 FPS for LOD updates
        ),
    })
  })
)
```

## 使用例

### 基本的なシーン遷移

```typescript
// ゲーム開始フロー
const startGameFlow = Effect.gen(function* () {
  const sceneManager = yield* SceneManagerService

  // スタート画面表示
  yield* sceneManager.transitionTo('StartScreen')

  // メニュー選択待機
  // ... ユーザー操作待機

  // メインゲーム開始
  yield* sceneManager.transitionTo('MainGame', {
    worldSeed: 12345,
    difficulty: 'Normal',
  })
})

// ゲームオーバー処理
const gameOverFlow = Effect.gen(function* () {
  const sceneManager = yield* SceneManagerService

  // 現在のゲーム統計取得
  const gameStats = yield* getCurrentGameStats()

  // ゲームオーバー画面へ遷移
  yield* sceneManager.transitionTo('GameOver', gameStats)
})

// ポーズ/再開処理
const pauseResumeFlow = Effect.gen(function* () {
  const sceneManager = yield* SceneManagerService
  const currentScene = yield* sceneManager.getCurrentScene()

  const action = yield* Match.value(currentScene).pipe(
    Match.some(
      Match.when(
        { type: 'MainGame' },
        () => sceneManager.pushScene('Pause') // ポーズ画面をプッシュ
      ),
      Match.when(
        { type: 'Pause' },
        () => sceneManager.popScene() // ポーズ画面をポップしてメインゲームに戻る
      ),
      Match.orElse(() => Effect.unit)
    ),
    Match.none(() => Effect.unit),
    Match.exhaustive
  )

  yield* action
})
```

## テスト戦略

### Property-Based Testing with Schema Integration

```typescript
import * as fc from "fast-check"
import { it } from "@effect/vitest"

// テスト用のArbitrary定義
const sceneIdArbitrary = fc.string({ minLength: 1 }).map(SceneId)
const loadPriorityArbitrary = fc.integer({ min: 0, max: 10 }).map(LoadPriority)
const viewDistanceArbitrary = fc.float({ min: 0, max: 1000 }).map(ViewDistance)

const sceneNodeArbitrary = fc.record({
  _tag: fc.constant("SceneNode" as const),
  id: sceneIdArbitrary,
  priority: loadPriorityArbitrary,
  visible: fc.boolean(),
  cullingRadius: fc.float({ min: 1, max: 500 }).map(CullingRadius),
  renderDepth: fc.integer({ min: 0, max: 100 }).map(RenderDepth),
  bounds: fc.record({
    min: fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),
    max: fc.record({ x: fc.float(), y: fc.float(), z: fc.float() })
  }),
  children: fc.constant([]), // 簡略化
  metadata: fc.option(fc.record({ test: fc.string() }), { nil: undefined })
})

const sceneArbitrary = fc.record({
  _tag: fc.constant("Scene" as const),
  type: fc.constantFrom("StartScreen", "MainGame", "GameOver", "Pause", "Settings", "Loading", "Credits"),
  id: sceneIdArbitrary,
  isActive: fc.boolean(),
  isLoading: fc.boolean(),
  visible: fc.boolean(),
  sceneGraph: fc.option(sceneNodeArbitrary, { nil: undefined }),
  data: fc.option(fc.record({ key: fc.string() }), { nil: undefined }),
  timestamp: fc.integer({ min: 0 })
})

// Schema-based Property Tests
export const SceneManagementTests = describe("Scene Management", () => {
  it.prop([sceneArbitrary])("Scene Schema validation", (scene) =>
    Effect.gen(function* () {
      // Schema デコード/エンコードの一貫性テスト
      const decoded = yield* Schema.decodeUnknown(Scene)(scene)
      const encoded = Schema.encode(Scene)(decoded)

      expect(decoded).toEqual(scene)
      expect(encoded).toEqual(scene)
    }).pipe(
      Effect.provide(SceneSystemTestLayer)
    ))

  it.prop([fc.array(sceneNodeArbitrary, { minLength: 1, maxLength: 50 }), viewDistanceArbitrary])(
    "Frustum culling preserves node count invariant",
    (nodes, viewDistance) =>
      Effect.gen(function* () {
        const cullingService = yield* CullingService
        const mockCamera = createMockCamera(viewDistance)

        // カリング前後でノード数が減少することを確認
        const culledNodes = yield* cullingService.performFrustumCulling(nodes, mockCamera)

        expect(culledNodes.length).toBeLessThanOrEqual(nodes.length)
        // 全てのカリング済みノードが元のセットに含まれることを確認
        culledNodes.forEach(node => {
          expect(nodes.some(original => original.id === node.id)).toBe(true)
        })
      }).pipe(
        Effect.provide(SceneSystemTestLayer)
      )
  )

  it.prop([sceneNodeArbitrary, viewDistanceArbitrary])(
    "LOD calculation is deterministic and monotonic",
    (node, viewDistance) =>
      Effect.gen(function* () {
        const lodService = yield* LODService

        // 同じ距離に対してLOD計算が一貫していることを確認
        const lod1 = yield* lodService.calculateLOD(viewDistance)
        const lod2 = yield* lodService.calculateLOD(viewDistance)

        expect(lod1).toBe(lod2)

        // 距離が近いほど高いLODになることを確認（単調性）
        const closerDistance = ViewDistance(Math.max(0, viewDistance - 10))
        const closerLOD = yield* lodService.calculateLOD(closerDistance)

        const lodLevels = ["NONE", "LOW", "MEDIUM", "HIGH"]
        const currentIndex = lodLevels.indexOf(lod1)
        const closerIndex = lodLevels.indexOf(closerLOD)

        expect(closerIndex).toBeGreaterThanOrEqual(currentIndex)
      }).pipe(
        Effect.provide(SceneSystemTestLayer)
      )
  )

  test("Stream-based scene transitions maintain state consistency", () =>
    Effect.gen(function* () {
      const sceneManager = yield* SceneManagerService

      // スタート画面に遷移
      yield* sceneManager.transitionTo("StartScreen")
      const startScene = yield* sceneManager.getCurrentScene()

      expect(Option.isSome(startScene)).toBe(true)
      expect(startScene.value.type).toBe("StartScreen")

      // Stream監視の設定
      const transitionStream = sceneManager.sceneTransitionStream()
      const transitionFiber = yield* transitionStream.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.fork
      )

      // メインゲームに遷移
      yield* sceneManager.transitionTo("MainGame")
      const gameScene = yield* sceneManager.getCurrentScene()

      expect(Option.isSome(gameScene)).toBe(true)
      expect(gameScene.value.type).toBe("MainGame")

      // 遷移イベントが正しく発火されることを確認
      const transitions = yield* Fiber.join(transitionFiber)
      expect(Chunk.size(transitions)).toBe(1)
      expect(Chunk.head(transitions).value.to.type).toBe("MainGame")
    }).pipe(
      Effect.provide(SceneSystemTestLayer)
    ))

  test("Scene resource cache integration", () =>
    Effect.gen(function* () {
      const sceneService = yield* SceneService
      const cache = yield* createSceneResourceCache()

      // リソースキャッシュのテスト
      const sceneId = SceneId("test_scene")

      // 初回アクセス（キャッシュミス）
      const resource1 = yield* cache.get(sceneId)

      // 2回目アクセス（キャッシュヒット）
      const resource2 = yield* cache.get(sceneId)

      // 同じリソースが返されることを確認
      expect(resource1).toBe(resource2)

      // プリロードが正常に動作することを確認
      yield* sceneService.preloadSceneResources("MainGame")

    }).pipe(
      Effect.provide(SceneSystemTestLayer)
    ))

  test("無効な遷移の拒否（Schema.TaggedError）", () =>
    Effect.gen(function* () {
      const sceneManager = yield* SceneManagerService

      // スタート画面に遷移
      yield* sceneManager.transitionTo("StartScreen")

      // 無効な遷移（StartScreen -> GameOver）
      const result = yield* sceneManager.transitionTo("GameOver").pipe(
        Effect.either
      )

      expect(Either.isLeft(result)).toBe(true)
      expect(result.left instanceof SceneTransitionError).toBe(true)
      expect(result.left._tag).toBe("SceneTransitionError")
    }).pipe(
      Effect.provide(SceneSystemTestLayer)
    ))
})

### Concurrent Testing with Resource Management
export const SceneConcurrencyTests = describe("Scene Concurrency", () => {
  test("Concurrent scene transitions maintain consistency", () =>
    Effect.gen(function* () {
      const sceneManager = yield* SceneManagerService

      // 初期シーン設定
      yield* sceneManager.transitionTo("StartScreen")

      // 並行遷移テスト
      const transitions = [
        Effect.fork(sceneManager.transitionTo("MainGame")),
        Effect.fork(sceneManager.transitionTo("Settings")),
        Effect.fork(sceneManager.transitionTo("Credits"))
      ]

      const fibers = yield* Effect.all(transitions)
      yield* Effect.all(fibers.map(Fiber.join), { concurrency: 3 })

      // 最終的に一つのシーンだけがアクティブであることを確認
      const finalScene = yield* sceneManager.getCurrentScene()
      expect(Option.isSome(finalScene)).toBe(true)

      const stack = yield* sceneManager.getSceneStack()
      const activeScenes = stack.scenes.filter(scene => scene.isActive)
      expect(activeScenes.length).toBeLessThanOrEqual(1)
    }).pipe(
      Effect.provide(SceneSystemTestLayer)
    ))

  test("LOD and culling systems work together correctly", () =>
    Effect.gen(function* () {
      const cullingService = yield* CullingService
      const lodService = yield* LODService

      // テスト用シーンノード作成
      const nodes = yield* Effect.all(
        Array.from({ length: 10 }, (_, i) =>
          Effect.succeed({
            _tag: "SceneNode" as const,
            id: SceneId(`node_${i}`),
            priority: LoadPriority(i),
            visible: true,
            cullingRadius: CullingRadius(100),
            renderDepth: RenderDepth(i),
            bounds: {
              min: { x: i * 10, y: 0, z: 0 },
              max: { x: i * 10 + 5, y: 5, z: 5 }
            },
            children: [],
            metadata: undefined
          })
        )
      )

      const viewPosition = { x: 0, y: 0, z: 0 }
      const mockCamera = createMockCamera(ViewDistance(50))

      // フラスタムカリング実行
      const culledNodes = yield* cullingService.performFrustumCulling(nodes, mockCamera)

      // LOD計算実行
      const lodUpdatedNodes = yield* lodService.updateLODByDistance(culledNodes, viewPosition)

      // 結果の整合性確認
      expect(lodUpdatedNodes.length).toBeLessThanOrEqual(culledNodes.length)
      expect(lodUpdatedNodes.length).toBeLessThanOrEqual(nodes.length)

      // 全ノードにLOD情報が付加されていることを確認
      lodUpdatedNodes.forEach(node => {
        expect(node.metadata).toBeDefined()
        expect(node.metadata.currentLOD).toBeDefined()
      })
    }).pipe(
      Effect.provide(SceneSystemTestLayer)
    ))
})

### Test Layer Implementations
export const TestSceneManagerServiceLive = Layer.effect(
  SceneManagerService,
  Effect.gen(function* () {
    // Test用の軽量実装
    const stateRef = yield* Ref.make(createInitialSceneManagerState())

    return SceneManagerService.of({
      getCurrentScene: () =>
        Ref.get(stateRef).pipe(
          Effect.map(state => Option.some(state.stack.scenes[0]))
        ),

      transitionTo: (sceneType, data) =>
        Ref.update(stateRef, state => ({
          ...state,
          stack: {
            ...state.stack,
            scenes: [{
              _tag: "Scene" as const,
              type: sceneType,
              id: SceneId(`test_${sceneType}`),
              isActive: true,
              isLoading: false,
              visible: true,
              sceneGraph: Option.none(),
              data,
              timestamp: Date.now()
            }]
          }
        })),

      // 他のメソッドのシンプル実装...
    })
  })
)
```

## パフォーマンス考慮事項

### メモリ効率化

- **シーンスタック制限**: 最大10シーンでメモリ使用量制御
- **遅延初期化**: シーン遷移時の必要最小限初期化
- **リソース解放**: 非表示シーンのリソース自動解放

### 遷移最適化

- **プリロード**: 次に遷移する可能性が高いシーンの事前準備
- **フェード効果**: GPU加速による滑らかな画面遷移
- **バックグラウンド処理**: UIスレッドをブロックしない非同期処理

### 状態管理効率化

- **不変データ**: コピーコスト最小化の構造共有
- **差分更新**: 変更された部分のみの更新処理
- **キャッシュ戦略**: よく使用される状態データのメモリキャッシュ

## システム統合

Scene Management Systemは以下のシステムと密接に連携します：

- **Rendering System**: 画面表示・エフェクト制御
- **Input System**: シーン固有の入力ハンドリング
- **Audio System**: BGM・効果音の切り替え
- **Save System**: シーン状態の永続化
- **Network System**: マルチプレイ時のシーン同期

これにより、統一されたユーザー体験と効率的なリソース管理を実現します。
