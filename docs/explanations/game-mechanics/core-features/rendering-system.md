---
title: 'レンダリングシステム仕様 - Three.js・WebGPU・最適化'
description: 'Greedy Meshingによる高性能レンダリング、ポストプロセシング、LODシステムの完全仕様。Three.jsとWebGPU統合。'
category: 'specification'
difficulty: 'advanced'
tags: ['rendering-system', 'threejs', 'webgpu', 'greedy-meshing', 'performance', 'graphics-pipeline']
prerequisites: ['threejs-fundamentals', 'webgl-concepts', 'graphics-programming']
estimated_reading_time: '18分'
related_patterns: ['optimization-patterns', 'graphics-patterns', 'performance-patterns']
related_docs: ['./03-block-system.md', './07-chunk-system.md', '../explanations/architecture/05-ecs-integration.md']
---

# レンダリングシステム

TypeScript Minecraft Cloneのレンダリングシステムは、Three.jsを基盤とした高性能レンダリングパイプラインで、WebGPU統合アーキテクチャにより、Greedy Meshingアルゴリズムと先進的なポストプロセシング効果を提供します。

## 1. 現行アーキテクチャ (Three.js)

### 1.1. Three.js統合詳細

レンダリングシステムは、DDD原則とEffect-TSパターンによる型安全な実装で、Three.jsの強力な機能を抽象化します。

```typescript
import { Context, Effect, Schema, Layer, Match, Stream, Clock, Scope } from "effect"
import * as THREE from "three"

// ブランド型定義 - レンダリングメトリクス
type FPS = number & { readonly _brand: "FPS" }
type RenderTime = number & { readonly _brand: "RenderTime" }
type TriangleCount = number & { readonly _brand: "TriangleCount" }
type FrameNumber = number & { readonly _brand: "FrameNumber" }

// レンダリングサービス定義（最新パターン）
export const RenderingError = Schema.TaggedError("RenderingError")({
  message: Schema.String
  timestamp: Schema.Number
})

// フレーム更新データスキーマ
const FrameUpdateSchema = Schema.Struct({
  _tag: Schema.Literal("FrameUpdate"),
  frameNumber: Schema.Number.pipe(Schema.brand("FrameNumber")),
  deltaTime: Schema.Number.pipe(Schema.brand("RenderTime")),
  timestamp: Schema.Number
}).annotations({
  identifier: "FrameUpdate",
  description: "フレーム更新情報"
})

type FrameUpdate = typeof FrameUpdateSchema.Type

// レンダリング統計スキーマ（ブランド型使用）
const RenderStatsSchema = Schema.Struct({
  _tag: Schema.Literal("RenderStats"),
  fps: Schema.Number.pipe(Schema.brand("FPS")),
  renderTime: Schema.Number.pipe(Schema.brand("RenderTime")),
  triangleCount: Schema.Number.pipe(Schema.brand("TriangleCount")),
  frameNumber: Schema.Number.pipe(Schema.brand("FrameNumber"))
}).annotations({
  identifier: "RenderStats",
  description: "レンダリング統計情報"
})

type RenderStats = typeof RenderStatsSchema.Type

// レンダリングサービス定義（Stream統合）
export interface IRenderingService {
  readonly render: () => Effect.Effect<void, RenderingError>
  readonly clear: () => Effect.Effect<void, RenderingError>
  readonly resize: (config: ViewportConfig) => Effect.Effect<void, RenderingError>
  readonly updateCamera: (camera: Camera) => Effect.Effect<void, RenderingError>
  readonly getStats: () => Effect.Effect<RenderStats, RenderingError>
  readonly frameUpdates: Stream.Stream<FrameUpdate, RenderingError>
}

export const RenderingService = Context.GenericTag<IRenderingService>("@minecraft/RenderingService")
```

### 1.2. Three.jsコンテキスト管理

```typescript
// Three.jsコンテキストの型安全な管理
// 最新Three.js r160+ - WebGPUレンダラー対応
const ThreeJsContextSchema = Schema.Struct({
  _tag: Schema.Literal('ThreeJsContext'),
  scene: Schema.instanceOf(THREE.Scene),
  camera: Schema.instanceOf(THREE.PerspectiveCamera),
  // WebGPUレンダラーとWebGLレンダラーの両方に対応
  renderer: Schema.Union(Schema.instanceOf(THREE.WebGPURenderer), Schema.instanceOf(THREE.WebGLRenderer)),
  canvas: Schema.instanceOf(HTMLCanvasElement),
  // WebGPUで必要な非同期レンダリングサポート
  isWebGPU: Schema.Boolean,
}).annotations({
  identifier: 'ThreeJsContext',
  description: 'Three.jsレンダリングコンテキスト（WebGPU/WebGLサポート付き）',
})

type ThreeJsContext = typeof ThreeJsContextSchema.Type

const ThreeJsContext = Context.GenericTag<ThreeJsContext>('@minecraft/ThreeJsContext')

// コンテキスト初期化レイヤー（Resource管理パターン）
const ThreeJsContextLive = Layer.scoped(
  ThreeJsContext,
  Effect.gen(function* () {
    // Canvas要素の取得（Early Return パターン）
    const canvas = document.getElementById('minecraft-canvas') as HTMLCanvasElement
    if (!canvas) {
      return yield* Effect.fail(
        new RenderingError({
          message: 'Canvas要素が見つかりません',
          timestamp: Date.now(),
        })
      )
    }

    // GPU リソース管理（acquire-release パターン）
    const gpuContext = yield* Effect.acquireRelease(
      Effect.gen(function* () {
        const isWebGPUSupported = navigator.gpu !== undefined
        const renderer = isWebGPUSupported
          ? new THREE.WebGPURenderer({
              canvas,
              antialias: true,
              powerPreference: 'high-performance',
              requiredFeatures: [
                'timestamp-query',
                'texture-compression-bc',
                'depth-clip-control',
                'depth32float-stencil8',
              ],
            })
          : new THREE.WebGLRenderer({
              canvas,
              antialias: true,
              alpha: false,
            })

        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap

        return { renderer, isWebGPUSupported }
      }),
      ({ renderer }) =>
        Effect.sync(() => {
          renderer.dispose()
          renderer.forceContextLoss()
        })
    )

    // Scene リソース管理
    const sceneContext = yield* Effect.acquireRelease(
      Effect.sync(() => {
        const scene = new THREE.Scene()
        scene.fog = new THREE.Fog(0x87ceeb, 50, 1000)
        return scene
      }),
      (scene) =>
        Effect.sync(() => {
          scene.clear()
          scene.dispose?.()
        })
    )

    // Camera リソース管理
    const camera = yield* Effect.sync(
      () => new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    )

    return Schema.decodeUnknownSync(ThreeJsContextSchema)({
      _tag: 'ThreeJsContext',
      scene: sceneContext,
      camera,
      renderer: gpuContext.renderer,
      canvas,
      isWebGPU: gpuContext.isWebGPUSupported,
    })
  })
)
```

### 1.3. Greedy Meshing実装

隣接する同一ブロックをまとめることで描画負荷を大幅に削減するアルゴリズムです。

```typescript
// メッシュデータスキーマ定義
const MeshDataSchema = Schema.Struct({
  _tag: Schema.Literal('MeshData'),
  positions: Schema.instanceOf(Float32Array),
  normals: Schema.instanceOf(Float32Array),
  uvs: Schema.instanceOf(Float32Array),
  indices: Schema.instanceOf(Uint32Array),
  vertexCount: Schema.Number,
}).annotations({
  identifier: 'MeshData',
  description: 'チャンクレンダリング用の最適化されたメッシュデータ構造',
})

type MeshData = typeof MeshDataSchema.Type

// Greedy Meshingアルゴリズム（Stream処理パターン）
const generateGreedyMesh = (chunkData: ChunkData): Effect.Effect<MeshData, RenderingError> =>
  Effect.gen(function* () {
    // 面方向の定義（早期リターン用）
    const directions = [
      { axis: 0, dir: 1, u: 1, v: 2, name: '+X' },
      { axis: 0, dir: -1, u: 2, v: 1, name: '-X' },
      { axis: 1, dir: 1, u: 0, v: 2, name: '+Y' },
      { axis: 1, dir: -1, u: 0, v: 2, name: '-Y' },
      { axis: 2, dir: 1, u: 0, v: 1, name: '+Z' },
      { axis: 2, dir: -1, u: 1, v: 0, name: '-Z' },
    ]

    // Stream で各方向の面を処理
    const meshComponents = yield* Stream.fromIterable(directions).pipe(
      Stream.mapEffect((direction) => processFaceDirection(chunkData, direction)),
      Stream.runCollect
    )

    // 結果をマージ（浅いネスト）
    const combinedMesh = meshComponents.reduce(
      (acc, component) => combineMeshComponents(acc, component),
      createEmptyMeshComponent()
    )

    return Schema.decodeUnknownSync(MeshDataSchema)({
      _tag: 'MeshData',
      positions: new Float32Array(combinedMesh.positions),
      normals: new Float32Array(combinedMesh.normals),
      uvs: new Float32Array(combinedMesh.uvs),
      indices: new Uint32Array(combinedMesh.indices),
      vertexCount: combinedMesh.positions.length / 3,
    })
  })

// 面方向の処理（Effect パターン）
const processFaceDirection = (
  chunkData: ChunkData,
  direction: FaceDirection
): Effect.Effect<MeshComponent, RenderingError> =>
  Effect.gen(function* () {
    const meshComponent = createEmptyMeshComponent()

    // スライスごとの処理（最大3レベルネスト）
    for (let slice = 0; slice < CHUNK_SIZE; slice++) {
      const mask = yield* generateFaceMask(chunkData, direction, slice)
      const quads = yield* generateQuadsFromMask(mask, slice, direction)

      meshComponent.positions.push(...quads.positions)
      meshComponent.normals.push(...quads.normals)
      meshComponent.uvs.push(...quads.uvs)
      meshComponent.indices.push(...quads.indices)
    }

    return meshComponent
  })

// マスク生成（Effect パターン）
const generateFaceMask = (
  chunkData: ChunkData,
  direction: FaceDirection,
  slice: number
): Effect.Effect<(Block | null)[], RenderingError> =>
  Effect.gen(function* () {
    const mask: (Block | null)[] = new Array(CHUNK_SIZE * CHUNK_SIZE).fill(null)
    let maskIndex = 0

    for (let v = 0; v < CHUNK_SIZE; v++) {
      for (let u = 0; u < CHUNK_SIZE; u++) {
        const block = getBlockAtPosition(chunkData, u, v, slice, direction)
        const neighborBlock = getNeighborBlock(chunkData, u, v, slice, direction)

        // Early return パターン
        if (!shouldRenderFace(block, neighborBlock)) {
          maskIndex++
          continue
        }

        mask[maskIndex] = block
        maskIndex++
      }
    }

    return mask
  })
```

### 1.4. レンダリングコマンドキュー

```typescript
// レンダリングコマンド定義（最新Union型パターン）
const RenderCommandSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('CREATE_MESH'),
    meshData: ChunkMeshDataSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('UPDATE_MESH'),
    handle: MeshHandleSchema,
    meshData: ChunkMeshDataSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('REMOVE_MESH'),
    handle: MeshHandleSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('UPDATE_CAMERA'),
    camera: CameraSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('RENDER_FRAME'),
  })
)

type RenderCommand = typeof RenderCommandSchema.Type

// コマンド処理（Stream + Pattern Matching）
const processRenderCommand = (command: RenderCommand): Effect.Effect<void, RenderingError> =>
  Match.value(command).pipe(
    Match.tag('CREATE_MESH', ({ meshData }) =>
      Effect.gen(function* () {
        const mesh = yield* createMesh(meshData)
        yield* Effect.log(`Created mesh with ${meshData.vertexCount} vertices`)
        return mesh
      })
    ),
    Match.tag('UPDATE_MESH', ({ handle, meshData }) =>
      Effect.gen(function* () {
        // Early return パターン
        const existingMesh = yield* getMesh(handle)
        if (!existingMesh) {
          return yield* Effect.fail(
            new RenderingError({
              message: `Mesh handle ${handle} not found`,
              timestamp: Date.now(),
            })
          )
        }

        return yield* updateMesh(handle, meshData)
      })
    ),
    Match.tag('REMOVE_MESH', ({ handle }) => removeMesh(handle)),
    Match.tag('UPDATE_CAMERA', ({ camera }) => updateCamera(camera)),
    Match.tag('RENDER_FRAME', () => renderFrame()),
    Match.exhaustive
  )

// レンダリングキューサービス（Stream + Priority Queue）
export interface IRenderingQueueService {
  readonly enqueue: (command: RenderCommand, priority?: number) => Effect.Effect<void, RenderingError>
  readonly processQueue: () => Stream.Stream<void, RenderingError>
  readonly flush: () => Effect.Effect<number, RenderingError>
}

export const RenderingQueueService = Context.GenericTag<IRenderingQueueService>('@minecraft/RenderingQueueService')

const RenderingQueueServiceLive = Layer.effect(
  RenderingQueueService,
  Effect.gen(function* () {
    const commandQueue = yield* Queue.bounded<PriorityCommand>(1000)
    const activeCommands = yield* Ref.make(0)

    const enqueue = (command: RenderCommand, priority: number = 0) =>
      Effect.gen(function* () {
        const priorityCommand = { command, priority, timestamp: Date.now() }
        return yield* Queue.offer(commandQueue, priorityCommand)
      })

    const processQueue = () =>
      Stream.fromQueue(commandQueue).pipe(
        Stream.mapEffect((priorityCommand) =>
          Effect.gen(function* () {
            yield* Ref.update(activeCommands, (n) => n + 1)
            yield* processRenderCommand(priorityCommand.command)
            yield* Ref.update(activeCommands, (n) => n - 1)
          })
        ),
        Stream.buffer({ capacity: 16, strategy: 'sliding' })
      )

    const flush = () =>
      Effect.gen(function* () {
        let processedCount = 0
        while (yield* Queue.size(commandQueue).pipe(Effect.map((size) => size > 0))) {
          const command = yield* Queue.take(commandQueue)
          yield* processRenderCommand(command.command)
          processedCount++
        }
        return processedCount
      })

    return RenderingQueueService.of({
      enqueue,
      processQueue,
      flush,
    })
  })
)
```

## 2. WebGPUへの移行パス

### 2.1. WebGPU統合アーキテクチャ

WebGLとWebGPUの両方をサポートする統合アーキテクチャにより、パフォーマンス向上とコンピュートシェーダー活用を実現します。

**Three.js r160+ + WebGL2/WebGPU アーキテクチャ**

- Three.jsアーキテクチャの最適化実装
- Greedy Meshingとフラスタムカリングによる描画最適化
- メモリ管理とLODシステムによるパフォーマンス制御
- Three.js Shading Language (TSL)による次世代シェーダー実装
- 高度なポストプロセシング効果（SSGI、TRAA、HBAO）
- WebGPUレンダラーによる高性能レンダリング
- コンピュートシェーダーによる地形生成最適化
- レイトレーシング機能の実装

### 2.2. TSL (Three.js Shading Language)活用

```typescript
import { pass, mrt, output, emissive, vec2 } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { ssao } from 'three/addons/tsl/display/SSAONode.js'
import { ssr } from 'three/addons/tsl/display/SSRNode.js'

// シェーダー設定スキーマ（Schema-First パターン）
const TSLConfigSchema = Schema.Struct({
  _tag: Schema.Literal('TSLConfig'),
  ssaoIntensity: Schema.Number.pipe(Schema.between(0, 1)),
  ssrIntensity: Schema.Number.pipe(Schema.between(0, 1)),
  bloomIntensity: Schema.Number.pipe(Schema.between(0, 2)),
  enableDebugMode: Schema.Boolean,
}).annotations({
  identifier: 'TSLConfig',
  description: 'TSLパイプライン設定',
})

type TSLConfig = typeof TSLConfigSchema.Type

// TSLパイプラインスキーマ（リソース管理）
const TSLPipelineSchema = Schema.Struct({
  _tag: Schema.Literal('TSLPipeline'),
  finalOutput: Schema.Any, // TSLノード（型定義が複雑なため）
  passes: Schema.Struct({
    scenePass: Schema.Any,
    ssaoPass: Schema.Any,
    ssrPass: Schema.Any,
    bloomPass: Schema.Any,
  }),
  config: TSLConfigSchema,
}).annotations({
  identifier: 'TSLPipeline',
  description: 'TSLレンダリングパイプライン',
})

type TSLPipeline = typeof TSLPipelineSchema.Type

// シェーダーサービス定義（Context パターン）
export interface IShaderService {
  readonly createShader: (type: ShaderType, source: string) => Effect.Effect<ShaderHandle, RenderingError>
  readonly updateShader: (handle: ShaderHandle, source: string) => Effect.Effect<void, RenderingError>
  readonly compileShaders: () => Effect.Effect<CompilationResult, RenderingError>
}

export const ShaderService = Context.GenericTag<IShaderService>('@minecraft/ShaderService')

// TSL統合サービス定義
export interface ITSLService {
  readonly setupPipeline: (config: TSLConfig) => Effect.Effect<TSLPipeline, RenderingError>
  readonly updateEffects: (config: TSLConfig) => Effect.Effect<void, RenderingError>
  readonly optimizePipeline: () => Effect.Effect<void, RenderingError>
}

export const TSLService = Context.GenericTag<ITSLService>('@minecraft/TSLService')

// TSLサービス実装（acquire-release パターン）
const TSLServiceLive = Layer.effect(
  TSLService,
  Effect.gen(function* () {
    const threeJsContext = yield* ThreeJsContext
    const shaderService = yield* ShaderService

    const setupPipeline = (config: TSLConfig): Effect.Effect<TSLPipeline, RenderingError> =>
      Effect.gen(function* () {
        // Pipeline リソース管理
        const pipeline = yield* Effect.acquireRelease(
          Effect.gen(function* () {
            const scenePass = pass(threeJsContext.scene, threeJsContext.camera)
            scenePass.setMRT(
              mrt({
                output: output,
                emissive: emissive,
                normal: normalView,
                metalRough: vec2(metalness, roughness),
              })
            )

            return { scenePass }
          }),
          ({ scenePass }) =>
            Effect.sync(() => {
              // TSLパスのクリーンアップ
              scenePass.dispose?.()
            })
        )

        // テクスチャノードの取得（Early return パターン）
        const scenePassColor = pipeline.scenePass.getTextureNode('output')
        const scenePassNormal = pipeline.scenePass.getTextureNode('normal')
        const scenePassDepth = pipeline.scenePass.getTextureNode('depth')

        if (!scenePassColor || !scenePassNormal || !scenePassDepth) {
          return yield* Effect.fail(
            new RenderingError({
              message: 'TSLテクスチャノードの取得に失敗',
              timestamp: Date.now(),
            })
          )
        }

        // ポストプロセシング効果の合成（Pattern matching）
        const effects = yield* Match.value(config).pipe(
          Match.when(
            (cfg) => cfg.enableDebugMode,
            () =>
              Effect.succeed({
                ssaoPass: null,
                ssrPass: null,
                bloomPass: null,
              })
          ),
          Match.orElse(() =>
            Effect.gen(function* () {
              const ssaoPass = ssao(scenePassColor, scenePassDepth, scenePassNormal)
              const ssrPass = ssr(scenePassColor, scenePassDepth, scenePassNormal)
              const bloomPass = bloom(pipeline.scenePass.getTextureNode('emissive'))

              return { ssaoPass, ssrPass, bloomPass }
            })
          )
        )

        // 最終出力の構築（浅いネスト）
        const finalOutput = config.enableDebugMode
          ? scenePassColor
          : scenePassColor
              .add(effects.ssaoPass?.mul(config.ssaoIntensity) || 0)
              .add(effects.ssrPass?.mul(config.ssrIntensity) || 0)
              .add(effects.bloomPass?.mul(config.bloomIntensity) || 0)

        return Schema.decodeUnknownSync(TSLPipelineSchema)({
          _tag: 'TSLPipeline',
          finalOutput,
          passes: {
            scenePass: pipeline.scenePass,
            ssaoPass: effects.ssaoPass,
            ssrPass: effects.ssrPass,
            bloomPass: effects.bloomPass,
          },
          config,
        })
      })

    const updateEffects = (config: TSLConfig): Effect.Effect<void, RenderingError> =>
      Effect.gen(function* () {
        // 設定変更時の最適化
        yield* Effect.log(`Updating TSL effects with config: ${JSON.stringify(config)}`)
        // 実際の更新処理は省略
      })

    const optimizePipeline = (): Effect.Effect<void, RenderingError> =>
      Effect.gen(function* () {
        // シェーダー最適化
        const compilationResult = yield* shaderService.compileShaders()

        if (!compilationResult.success) {
          return yield* Effect.fail(
            new RenderingError({
              message: `Shader compilation failed: ${compilationResult.errors.join(', ')}`,
              timestamp: Date.now(),
            })
          )
        }

        yield* Effect.log('TSL pipeline optimized successfully')
      })

    return TSLService.of({
      setupPipeline,
      updateEffects,
      optimizePipeline,
    })
  })
)
```

### 2.3. 互換性レイヤー設計

```typescript
// レンダラー抽象化インターフェース
export interface IUniversalRenderer {
  readonly render: (scene: THREE.Scene, camera: THREE.Camera) => Effect.Effect<void, RenderingError>
  readonly resize: (width: number, height: number) => Effect.Effect<void, RenderingError>
  readonly dispose: () => Effect.Effect<void, RenderingError>
  readonly getInfo: () => Effect.Effect<RendererInfo, RenderingError>
}

// WebGL/WebGPU統一アダプター
const createUniversalRenderer = (type: 'webgl' | 'webgpu'): Effect.Effect<IUniversalRenderer, RenderingError> =>
  Match.value(type).pipe(
    Match.when('webgl', () => createWebGLRenderer()),
    Match.when('webgpu', () => createWebGPURenderer()),
    Match.exhaustive
  )

// WebGPUレンダラー実装
const createWebGPURenderer = (): Effect.Effect<IUniversalRenderer, RenderingError> =>
  Effect.gen(function* () {
    const renderer = new THREE.WebGPURenderer({
      antialias: true,
      powerPreference: 'high-performance',
      requiredFeatures: ['timestamp-query', 'texture-compression-bc', 'depth-clip-control', 'depth32float-stencil8'],
    })

    return {
      render: (scene, camera) =>
        Effect.tryPromise({
          try: () => renderer.renderAsync(scene, camera),
          catch: (error) =>
            new RenderingError({
              message: `WebGPUレンダリング失敗: ${error}`,
              timestamp: Date.now(),
            }),
        }),
      resize: (width, height) =>
        Effect.sync(() => {
          renderer.setSize(width, height)
        }),
      dispose: () =>
        Effect.sync(() => {
          renderer.dispose()
        }),
      getInfo: () => Effect.sync(() => renderer.info),
    }
  })
```

## 3. 高度な機能

### 3.1. ポストプロセシング効果

**SSGI (Screen Space Global Illumination)**

```typescript
const SSGIEffectSchema = Schema.Struct({
  _tag: Schema.Literal('SSGIEffect'),
  intensity: Schema.Number.pipe(Schema.between(0, 2)),
  radius: Schema.Number.pipe(Schema.between(1, 10)),
  bias: Schema.Number.pipe(Schema.between(0, 1)),
}).annotations({
  identifier: 'SSGIEffect',
  description: 'スクリーンスペースグローバルイルミネーション設定',
})

type SSGIEffect = typeof SSGIEffectSchema.Type

const createSSGIPass = (config: SSGIEffect): Effect.Effect<SSGIPass, RenderingError> =>
  Effect.gen(function* () {
    // SSGI実装詳細
    return new SSGIPass(config)
  })
```

**TRAA (Temporal Reprojection Anti-Aliasing)**

```typescript
const TRAAEffectSchema = Schema.Struct({
  _tag: Schema.Literal('TRAAEffect'),
  samples: Schema.Number.pipe(Schema.int(), Schema.between(2, 16)),
  accumulation: Schema.Number.pipe(Schema.between(0.8, 0.99)),
})

type TRAAEffect = typeof TRAAEffectSchema.Type
```

### 3.2. シャドウマッピング

```typescript
// カスケードシャドウマッピング
const ShadowConfigSchema = Schema.Struct({
  _tag: Schema.Literal('ShadowConfig'),
  cascades: Schema.Number.pipe(Schema.int(), Schema.between(1, 4)),
  mapSize: Schema.Number.pipe(Schema.int()),
  bias: Schema.Number.pipe(Schema.between(-0.01, 0.01)),
  normalBias: Schema.Number.pipe(Schema.between(0, 1)),
})

type ShadowConfig = typeof ShadowConfigSchema.Type

const setupCascadedShadowMapping = (config: ShadowConfig): Effect.Effect<CSMPass, RenderingError> =>
  Effect.gen(function* () {
    const csm = new CSM({
      maxFar: config.cascades * 50,
      cascades: config.cascades,
      shadowMapSize: config.mapSize,
      bias: config.bias,
      normalBias: config.normalBias,
    })

    return csm
  })
```

### 3.3. アンビエントオクルージョン

```typescript
// HBAO (Horizon-Based Ambient Occlusion)
const HBAOConfigSchema = Schema.Struct({
  _tag: Schema.Literal('HBAOConfig'),
  aoRadius: Schema.Number.pipe(Schema.between(0.1, 5.0)),
  aoIntensity: Schema.Number.pipe(Schema.between(0.1, 2.0)),
  aoSteps: Schema.Number.pipe(Schema.int(), Schema.between(4, 16)),
  aoDirections: Schema.Number.pipe(Schema.int(), Schema.between(4, 16)),
})

type HBAOConfig = typeof HBAOConfigSchema.Type
```

## 4. パフォーマンス最適化

### 4.1. インスタンシング

```typescript
// インスタンス描画サービス
export interface IInstancedRenderingService {
  // 最新Three.js API使用
  readonly createInstancedMesh: (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number
  ) => Effect.Effect<THREE.InstancedMesh, RenderingError>
  readonly updateInstances: (mesh: THREE.InstancedMesh, transforms: Matrix4[]) => Effect.Effect<void, RenderingError>
  // WebGPU非同期レンダリングサポート
  readonly renderAsync: (scene: THREE.Scene, camera: THREE.Camera) => Effect.Effect<void, RenderingError>
}

export const InstancedRenderingService = Context.GenericTag<IInstancedRenderingService>(
  '@minecraft/InstancedRenderingService'
)

const InstancedRenderingServiceLive = Layer.effect(
  InstancedRenderingService,
  Effect.gen(function* () {
    const createInstancedMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, count: number) =>
      Effect.gen(function* () {
        // Three.js r160+の最新API使用
        const mesh = new THREE.InstancedMesh(geometry, material, count)

        // GPU最適化のための設定
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

        return mesh
      })

    const updateInstances = (mesh: THREE.InstancedMesh, transforms: Matrix4[]) =>
      Effect.gen(function* () {
        for (let i = 0; i < transforms.length; i++) {
          mesh.setMatrixAt(i, transforms[i])
        }
        mesh.instanceMatrix.needsUpdate = true
      })

    return InstancedRenderingService.of({
      createInstancedMesh,
      updateInstances,
    })
  })
)
```

### 4.2. フラスタムカリング

```typescript
// フラスタムカリングサービス（Stream + Pattern Matching）
const FrustumCullingConfigSchema = Schema.Struct({
  _tag: Schema.Literal('FrustumCullingConfig'),
  enableOcclusionCulling: Schema.Boolean,
  enableDistanceCulling: Schema.Boolean,
  maxDistance: Schema.Number.pipe(Schema.positive()),
  frustumPadding: Schema.Number.pipe(Schema.between(0, 2)),
}).annotations({
  identifier: 'FrustumCullingConfig',
  description: 'フラスタムカリング設定',
})

type FrustumCullingConfig = typeof FrustumCullingConfigSchema.Type

// カリング結果（ブランド型使用）
const CullingResultSchema = Schema.Struct({
  _tag: Schema.Literal('CullingResult'),
  visibleObjects: Schema.Array(Schema.instanceOf(THREE.Object3D)),
  culledCount: Schema.Number.pipe(Schema.brand('CulledCount')),
  processTime: Schema.Number.pipe(Schema.brand('RenderTime')),
  efficiency: Schema.Number.pipe(Schema.between(0, 1)),
}).annotations({
  identifier: 'CullingResult',
  description: 'カリング処理結果',
})

type CullingResult = typeof CullingResultSchema.Type

// フラスタムカリングサービス
export interface IFrustumCullingService {
  readonly performCulling: (
    camera: THREE.Camera,
    objects: THREE.Object3D[],
    config?: FrustumCullingConfig
  ) => Effect.Effect<CullingResult, RenderingError>
  readonly streamCulling: (
    camera: THREE.Camera,
    objectStream: Stream.Stream<THREE.Object3D[], RenderingError>,
    config?: FrustumCullingConfig
  ) => Stream.Stream<CullingResult, RenderingError>
}

export const FrustumCullingService = Context.GenericTag<IFrustumCullingService>('@minecraft/FrustumCullingService')

const FrustumCullingServiceLive = Layer.effect(
  FrustumCullingService,
  Effect.gen(function* () {
    const performCulling = (
      camera: THREE.Camera,
      objects: THREE.Object3D[],
      config: FrustumCullingConfig = {
        _tag: 'FrustumCullingConfig',
        enableOcclusionCulling: false,
        enableDistanceCulling: true,
        maxDistance: 1000,
        frustumPadding: 0.1,
      }
    ): Effect.Effect<CullingResult, RenderingError> =>
      Effect.gen(function* () {
        const startTime = Date.now()

        // フラスタム計算（リソース管理）
        const frustumData = yield* Effect.sync(() => {
          const frustum = new THREE.Frustum()
          const matrix = new THREE.Matrix4()
          matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
          frustum.setFromProjectionMatrix(matrix)
          return { frustum, matrix }
        })

        // Stream処理でカリング実行
        const visibleObjects = yield* Stream.fromIterable(objects).pipe(
          Stream.mapEffect((obj) =>
            Effect.gen(function* () {
              // Early return パターン
              if (!obj.geometry) {
                return { obj, visible: true, reason: 'no-geometry' }
              }

              // パターンマッチングによる複数カリング戦略
              const cullingResult = yield* Match.value(config).pipe(
                Match.when(
                  (cfg) => cfg.enableDistanceCulling,
                  () =>
                    Effect.gen(function* () {
                      const distance = camera.position.distanceTo(obj.position)
                      if (distance > config.maxDistance) {
                        return { obj, visible: false, reason: 'distance' }
                      }
                      return yield* performFrustumTest(obj, frustumData.frustum)
                    })
                ),
                Match.when(
                  (cfg) => cfg.enableOcclusionCulling,
                  () =>
                    Effect.gen(function* () {
                      const frustumResult = yield* performFrustumTest(obj, frustumData.frustum)
                      if (!frustumResult.visible) {
                        return frustumResult
                      }
                      return yield* performOcclusionTest(obj, camera)
                    })
                ),
                Match.orElse(() => performFrustumTest(obj, frustumData.frustum))
              )

              return cullingResult
            })
          ),
          Stream.runCollect
        )

        // 結果の集計（浅いネスト）
        const visible = visibleObjects.filter((result) => result.visible).map((r) => r.obj)
        const culledCount = objects.length - visible.length
        const processTime = Date.now() - startTime
        const efficiency = objects.length > 0 ? culledCount / objects.length : 0

        return Schema.decodeUnknownSync(CullingResultSchema)({
          _tag: 'CullingResult',
          visibleObjects: visible,
          culledCount: culledCount as any,
          processTime: processTime as any,
          efficiency,
        })
      })

    const streamCulling = (
      camera: THREE.Camera,
      objectStream: Stream.Stream<THREE.Object3D[], RenderingError>,
      config?: FrustumCullingConfig
    ): Stream.Stream<CullingResult, RenderingError> =>
      objectStream.pipe(
        Stream.mapEffect((objects) => performCulling(camera, objects, config)),
        Stream.buffer({ capacity: 8, strategy: 'sliding' })
      )

    return FrustumCullingService.of({
      performCulling,
      streamCulling,
    })
  })
)

// フラスタムテスト（Effect パターン）
const performFrustumTest = (
  obj: THREE.Object3D,
  frustum: THREE.Frustum
): Effect.Effect<{ obj: THREE.Object3D; visible: boolean; reason: string }, never> =>
  Effect.gen(function* () {
    const sphere = new THREE.Sphere()
    obj.geometry?.computeBoundingSphere()

    // Early return パターン
    if (!obj.geometry?.boundingSphere) {
      return { obj, visible: true, reason: 'no-bounding-sphere' }
    }

    sphere.copy(obj.geometry.boundingSphere)
    sphere.applyMatrix4(obj.matrixWorld)

    const visible = frustum.intersectsSphere(sphere)
    return { obj, visible, reason: visible ? 'visible' : 'frustum-culled' }
  })

// オクルージョンテスト（Effect パターン）
const performOcclusionTest = (
  obj: THREE.Object3D,
  camera: THREE.Camera
): Effect.Effect<{ obj: THREE.Object3D; visible: boolean; reason: string }, never> =>
  Effect.gen(function* () {
    // オクルージョンカリングの簡単な実装（実際はより複雑）
    const raycaster = new THREE.Raycaster()
    const direction = new THREE.Vector3()

    direction.subVectors(obj.position, camera.position).normalize()
    raycaster.set(camera.position, direction)

    // レイキャストによる遮蔽判定
    const intersections = raycaster.intersectObjects([obj], false)
    const visible = intersections.length === 0 || intersections[0].object === obj

    return { obj, visible, reason: visible ? 'visible' : 'occlusion-culled' }
  })
```

### 4.3. レベルオブディテール(LOD)

```typescript
// LOD品質レベル（Union型 + ブランド型）
const LODQualitySchema = Schema.Literal('ultra', 'high', 'medium', 'low', 'minimal')
type LODQuality = typeof LODQualitySchema.Type

type LODDistance = number & { readonly _brand: 'LODDistance' }
type MeshComplexity = number & { readonly _brand: 'MeshComplexity' }

// LOD設定スキーマ（Schema-First パターン）
const LODConfigSchema = Schema.Struct({
  _tag: Schema.Literal('LODConfig'),
  thresholds: Schema.Array(
    Schema.Struct({
      distance: Schema.Number.pipe(Schema.positive()).pipe(Schema.brand('LODDistance')),
      quality: LODQualitySchema,
      complexity: Schema.Number.pipe(Schema.between(0, 1)).pipe(Schema.brand('MeshComplexity')),
    })
  ),
  enableAdaptiveLOD: Schema.Boolean,
  performanceBudget: Schema.Number.pipe(Schema.positive()),
  hysteresis: Schema.Number.pipe(Schema.between(0, 1)),
}).annotations({
  identifier: 'LODConfig',
  description: 'レベルオブディテール設定',
})

type LODConfig = typeof LODConfigSchema.Type

// LOD結果スキーマ
const LODResultSchema = Schema.Struct({
  _tag: Schema.Literal('LODResult'),
  quality: LODQualitySchema,
  distance: Schema.Number.pipe(Schema.brand('LODDistance')),
  complexity: Schema.Number.pipe(Schema.brand('MeshComplexity')),
  meshData: Schema.Any, // MeshDataSchema参照
  reason: Schema.Literal('distance', 'performance', 'adaptive'),
}).annotations({
  identifier: 'LODResult',
  description: 'LOD処理結果',
})

type LODResult = typeof LODResultSchema.Type

// LODサービス（Context + Stream パターン）
export interface ILODService {
  readonly calculateLOD: (
    cameraPosition: Vector3,
    targetPosition: Vector3,
    config: LODConfig
  ) => Effect.Effect<LODQuality, RenderingError>
  readonly generateLODMesh: (
    chunkData: ChunkData,
    quality: LODQuality,
    complexity?: MeshComplexity
  ) => Effect.Effect<LODResult, RenderingError>
  readonly streamLODUpdates: (
    cameraStream: Stream.Stream<Vector3, RenderingError>,
    objects: ReadonlyArray<{ position: Vector3; chunkData: ChunkData }>,
    config: LODConfig
  ) => Stream.Stream<LODResult[], RenderingError>
}

export const LODService = Context.GenericTag<ILODService>('@minecraft/LODService')

const LODServiceLive = Layer.effect(
  LODService,
  Effect.gen(function* () {
    const performanceMonitor = yield* PerformanceMonitorService

    const calculateLOD = (
      cameraPosition: Vector3,
      targetPosition: Vector3,
      config: LODConfig
    ): Effect.Effect<LODQuality, RenderingError> =>
      Effect.gen(function* () {
        // 距離計算（早期リターン）
        const distance = Math.sqrt(
          Math.pow(cameraPosition.x - targetPosition.x, 2) + Math.pow(cameraPosition.z - targetPosition.z, 2)
        ) as LODDistance

        // パターンマッチングによるLOD決定（浅いネスト）
        const lodDecision = yield* Match.value(config).pipe(
          Match.when(
            (cfg) => cfg.enableAdaptiveLOD,
            () => calculateAdaptiveLOD(distance, config)
          ),
          Match.orElse(() => calculateStaticLOD(distance, config))
        )

        return lodDecision
      })

    const generateLODMesh = (
      chunkData: ChunkData,
      quality: LODQuality,
      complexity: MeshComplexity = 1.0 as MeshComplexity
    ): Effect.Effect<LODResult, RenderingError> =>
      Effect.gen(function* () {
        const startTime = Date.now()

        // パターンマッチングによるメッシュ生成戦略
        const meshData = yield* Match.value(quality).pipe(
          Match.when('ultra', () =>
            generateGreedyMesh(chunkData).pipe(Effect.map((data) => ({ ...data, tessellationLevel: 4 })))
          ),
          Match.when('high', () => generateGreedyMesh(chunkData)),
          Match.when('medium', () => generateSimplifiedMesh(chunkData, complexity * 0.7)),
          Match.when('low', () => generateSimplifiedMesh(chunkData, complexity * 0.4)),
          Match.when('minimal', () => generateSimplifiedMesh(chunkData, complexity * 0.2)),
          Match.exhaustive
        )

        const processingTime = Date.now() - startTime
        yield* performanceMonitor.recordMetric('lod_generation_time', processingTime, {
          quality,
          complexity: String(complexity),
        })

        return Schema.decodeUnknownSync(LODResultSchema)({
          _tag: 'LODResult',
          quality,
          distance: 0 as LODDistance, // 実際の距離は呼び出し元から設定
          complexity,
          meshData,
          reason: 'distance',
        })
      })

    const streamLODUpdates = (
      cameraStream: Stream.Stream<Vector3, RenderingError>,
      objects: ReadonlyArray<{ position: Vector3; chunkData: ChunkData }>,
      config: LODConfig
    ): Stream.Stream<LODResult[], RenderingError> =>
      cameraStream.pipe(
        Stream.mapEffect((cameraPosition) =>
          Effect.gen(function* () {
            // 全オブジェクトのLOD計算（並列処理）
            const lodResults = yield* Effect.all(
              objects.map((obj) =>
                Effect.gen(function* () {
                  const quality = yield* calculateLOD(cameraPosition, obj.position, config)
                  const result = yield* generateLODMesh(obj.chunkData, quality)
                  return { ...result, distance: calculateDistance(cameraPosition, obj.position) as LODDistance }
                })
              ),
              { concurrency: 8 }
            )

            return lodResults
          })
        ),
        Stream.buffer({ capacity: 4, strategy: 'sliding' })
      )

    return LODService.of({
      calculateLOD,
      generateLODMesh,
      streamLODUpdates,
    })
  })
)

// 静的LOD計算（Pattern matching）
const calculateStaticLOD = (distance: LODDistance, config: LODConfig): Effect.Effect<LODQuality, RenderingError> =>
  Effect.gen(function* () {
    // しきい値による段階的LOD決定（早期リターン）
    const threshold = config.thresholds.find((t) => distance <= t.distance)
    if (threshold) {
      return threshold.quality
    }

    return 'minimal' // デフォルト
  })

// 適応的LOD計算（パフォーマンス考慮）
const calculateAdaptiveLOD = (distance: LODDistance, config: LODConfig): Effect.Effect<LODQuality, RenderingError> =>
  Effect.gen(function* () {
    const performanceMonitor = yield* PerformanceMonitorService
    const currentFPS = yield* performanceMonitor.recordMetric('current_fps', 60) // 実際のFPS取得

    // パフォーマンスに基づくLOD調整（Pattern matching）
    const adjustedQuality = yield* Match.value({ distance, currentFPS }).pipe(
      Match.when(
        ({ currentFPS }) => currentFPS < 30,
        () => Effect.succeed('low' as LODQuality) // 低FPS時は品質を下げる
      ),
      Match.when(
        ({ currentFPS }) => currentFPS > 55,
        () => Effect.succeed('high' as LODQuality) // 高FPS時は品質を上げる
      ),
      Match.orElse(({ distance }) => calculateStaticLOD(distance, config))
    )

    return adjustedQuality
  })

// 簡略化メッシュ生成（複雑度パラメータ付き）
const generateSimplifiedMesh = (
  chunkData: ChunkData,
  complexity: MeshComplexity
): Effect.Effect<MeshData, RenderingError> =>
  Effect.gen(function* () {
    const fullMesh = yield* generateGreedyMesh(chunkData)

    // 複雑度に基づく頂点削減（浅いネスト）
    const simplificationFactor = Math.max(0.1, complexity)
    const targetVertices = Math.floor(fullMesh.vertexCount * simplificationFactor)

    const simplifiedMesh = yield* Effect.sync(() => ({
      ...fullMesh,
      positions: reduceVertices(fullMesh.positions, targetVertices),
      normals: reduceVertices(fullMesh.normals, targetVertices),
      uvs: reduceVertices(fullMesh.uvs, (targetVertices * 2) / 3), // UV座標は2/3の比率
      indices: reduceIndices(fullMesh.indices, targetVertices),
      vertexCount: targetVertices,
    }))

    return simplifiedMesh
  })

// ヒューリスティック距離計算
const calculateDistance = (pos1: Vector3, pos2: Vector3): number =>
  Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2) + Math.pow(pos1.z - pos2.z, 2))
```

### 4.4. メモリ管理とガベージコレクション

```typescript
// メモリ管理サービス
export interface IMemoryManagerService {
  readonly collectGarbage: () => Effect.Effect<{ freedBytes: number }, RenderingError>
  readonly getMemoryUsage: () => Effect.Effect<MemoryUsage, RenderingError>
  readonly dispose: () => Effect.Effect<void, RenderingError>
}

const MemoryUsageSchema = Schema.Struct({
  _tag: Schema.Literal('MemoryUsage'),
  totalBytes: Schema.Number,
  textureBytes: Schema.Number,
  geometryBytes: Schema.Number,
})

type MemoryUsage = typeof MemoryUsageSchema.Type

export const MemoryManagerService = Context.GenericTag<IMemoryManagerService>('@minecraft/MemoryManagerService')

const MemoryManagerServiceLive = Layer.effect(
  MemoryManagerService,
  Effect.gen(function* () {
    const threeJsContext = yield* ThreeJsContext

    const collectGarbage = (): Effect.Effect<{ freedBytes: number }, RenderingError> =>
      Effect.gen(function* () {
        const beforeMemory = yield* getMemoryUsage()

        // レンダラーのリソース解放
        threeJsContext.renderer.renderLists.dispose()

        const afterMemory = yield* getMemoryUsage()
        const freedBytes = beforeMemory.totalBytes - afterMemory.totalBytes

        return { freedBytes: Math.max(0, freedBytes) }
      })

    const getMemoryUsage = (): Effect.Effect<MemoryUsage, RenderingError> =>
      Effect.gen(function* () {
        const info = threeJsContext.renderer.info
        return Schema.decodeUnknownSync(MemoryUsageSchema)({
          _tag: 'MemoryUsage',
          totalBytes: (info.memory.geometries + info.memory.textures) * 1024,
          textureBytes: info.memory.textures * 1024,
          geometryBytes: info.memory.geometries * 1024,
        })
      })

    const dispose = (): Effect.Effect<void, RenderingError> =>
      Effect.gen(function* () {
        threeJsContext.renderer.dispose()
      })

    return MemoryManagerService.of({
      collectGarbage,
      getMemoryUsage,
      dispose,
    })
  })
)

// Property-based testing compatibility
// Fast-Check Arbitraries for rendering system testing
export const renderingArbitraries = {
  // ブランド型対応のArbitrary
  frameNumber: fc.nat().map((n) => n as FrameNumber),
  fps: fc.float({ min: 1, max: 144 }).map((n) => n as FPS),
  renderTime: fc.float({ min: 0.1, max: 100 }).map((n) => n as RenderTime),
  triangleCount: fc.nat({ max: 1000000 }).map((n) => n as TriangleCount),

  // レンダリング設定のArbitrary
  lodConfig: fc.record({
    _tag: fc.constant('LODConfig' as const),
    thresholds: fc.array(
      fc.record({
        distance: fc.float({ min: 1, max: 1000 }).map((n) => n as LODDistance),
        quality: fc.oneof(
          fc.constant('ultra' as const),
          fc.constant('high' as const),
          fc.constant('medium' as const),
          fc.constant('low' as const),
          fc.constant('minimal' as const)
        ),
        complexity: fc.float({ min: 0, max: 1 }).map((n) => n as MeshComplexity),
      }),
      { minLength: 1, maxLength: 5 }
    ),
    enableAdaptiveLOD: fc.boolean(),
    performanceBudget: fc.float({ min: 16, max: 144 }),
    hysteresis: fc.float({ min: 0, max: 1 }),
  }),

  // フラスタムカリング設定のArbitrary
  frustumCullingConfig: fc.record({
    _tag: fc.constant('FrustumCullingConfig' as const),
    enableOcclusionCulling: fc.boolean(),
    enableDistanceCulling: fc.boolean(),
    maxDistance: fc.float({ min: 10, max: 2000 }),
    frustumPadding: fc.float({ min: 0, max: 2 }),
  }),

  // TSL設定のArbitrary
  tslConfig: fc.record({
    _tag: fc.constant('TSLConfig' as const),
    ssaoIntensity: fc.float({ min: 0, max: 1 }),
    ssrIntensity: fc.float({ min: 0, max: 1 }),
    bloomIntensity: fc.float({ min: 0, max: 2 }),
    enableDebugMode: fc.boolean(),
  }),
}

// レンダリングシステム用のテストユーティリティ
export const TestRenderingServiceLive = Layer.effect(
  RenderingService,
  Effect.gen(function* () {
    // テスト用のモックレンダラー
    let frameCount = 0
    let isRendering = false

    const render = (): Effect.Effect<void, RenderingError> =>
      Effect.gen(function* () {
        if (isRendering) {
          return yield* Effect.fail(
            new RenderingError({
              message: 'Already rendering',
              timestamp: Date.now(),
            })
          )
        }

        isRendering = true
        frameCount++
        yield* Effect.sleep(Duration.millis(16)) // 60FPSシミュレート
        isRendering = false
      })

    const getStats = (): Effect.Effect<RenderStats, RenderingError> =>
      Effect.succeed({
        _tag: 'RenderStats',
        fps: 60 as FPS,
        renderTime: 16 as RenderTime,
        triangleCount: (frameCount * 1000) as TriangleCount,
        frameNumber: frameCount as FrameNumber,
      })

    const frameUpdates: Stream.Stream<FrameUpdate, RenderingError> = Stream.repeatEffect(
      Effect.gen(function* () {
        frameCount++
        return {
          _tag: 'FrameUpdate' as const,
          frameNumber: frameCount as FrameNumber,
          deltaTime: 16 as RenderTime,
          timestamp: Date.now(),
        }
      })
    ).pipe(Stream.schedule(Schedule.fixed(Duration.millis(16))))

    return RenderingService.of({
      render,
      clear: () =>
        Effect.sync(() => {
          frameCount = 0
        }),
      resize: () => Effect.void,
      updateCamera: () => Effect.void,
      getStats,
      frameUpdates,
    })
  })
)
```

## 関連ドキュメント

- [チャンクシステム](./chunk-system.md) - レンダリング対象となる主要オブジェクトであるチャンクを管理します。
- [マテリアルシステム](./material-system.md) - レンダリングされるオブジェクトの外観を定義します。
- [シーン管理システム](./scene-management-system.md) - レンダリングされるシーン全体を管理します。
- [パーティクルシステム](../enhanced-features/particle-system.md) - パーティクルエフェクトのレンダリングを扱います。
- [ECS統合](../explanations/architecture/05-ecs-integration.md) - エンティティコンポーネントシステムとの統合。
- [Effect-TSパターン](../explanations/architecture/06-effect-ts-patterns.md) - Effect-TSパターンの詳細な使用法。

## 用語集

- **Three.js**: レンダリングエンジンとして使用される3Dグラフィックスライブラリ。 ([詳細](../../../reference/glossary.md#threejs))
- **WebGPU**: 次世代のWebグラフィックスAPI。 ([詳細](../../../reference/glossary.md#webgpu))
- **Greedy Meshing**: ボクセルレンダリングの最適化アルゴリズム。 ([詳細](../../../reference/glossary.md#greedy-meshing))
- **TSL**: Three.js Shading Language。モダンなシェーダーを記述するための言語。 ([詳細](../../../reference/glossary.md#tsl))
- **フラスタムカリング**: カメラの視野外にあるオブジェクトを除外する最適化技術。 ([詳細](../../../reference/glossary.md#frustum-culling))
- **LOD**: Level of Detail。距離に応じてレンダリング品質を調整する最適化技術。 ([詳細](../../../reference/glossary.md#lod))
