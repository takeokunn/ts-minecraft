# レンダリングシステム

TypeScript Minecraft Cloneのレンダリングシステムは、Three.jsを基盤とした高性能レンダリングパイプラインで、WebGPU統合アーキテクチャにより、Greedy Meshingアルゴリズムと先進的なポストプロセシング効果を提供します。

## 1. 現行アーキテクチャ (Three.js)

### 1.1. Three.js統合詳細

レンダリングシステムは、DDD原則とEffect-TSパターンによる型安全な実装で、Three.jsの強力な機能を抽象化します。

```typescript
import { Context, Effect, Schema, Layer, Match } from "effect"
import * as THREE from "three"

// レンダリングサービス定義（最新パターン）
export class RenderingError extends Schema.TaggedError("RenderingError")<{
  readonly message: string
  readonly timestamp: number
}> {}

export interface IRenderingService {
  readonly render: () => Effect.Effect<void, RenderingError>
  readonly clear: () => Effect.Effect<void, RenderingError>
  readonly resize: (config: ViewportConfig) => Effect.Effect<void, RenderingError>
  readonly updateCamera: (camera: Camera) => Effect.Effect<void, RenderingError>
  readonly getStats: () => Effect.Effect<RenderStats, RenderingError>
}

export const RenderingService = Context.GenericTag<IRenderingService>("@minecraft/RenderingService")
```

### 1.2. Three.jsコンテキスト管理

```typescript
// Three.jsコンテキストの型安全な管理
// 最新Three.js r160+ - WebGPUレンダラー対応
const ThreeJsContextSchema = Schema.Struct({
  _tag: Schema.Literal("ThreeJsContext"),
  scene: Schema.instanceOf(THREE.Scene),
  camera: Schema.instanceOf(THREE.PerspectiveCamera),
  // WebGPUレンダラーとWebGLレンダラーの両方に対応
  renderer: Schema.Union(
    Schema.instanceOf(THREE.WebGPURenderer),
    Schema.instanceOf(THREE.WebGLRenderer)
  ),
  canvas: Schema.instanceOf(HTMLCanvasElement),
  // WebGPUで必要な非同期レンダリングサポート
  isWebGPU: Schema.Boolean
}).annotations({
  identifier: "ThreeJsContext",
  description: "Three.jsレンダリングコンテキスト（WebGPU/WebGLサポート付き）"
})

type ThreeJsContext = typeof ThreeJsContextSchema.Type

const ThreeJsContext = Context.GenericTag<ThreeJsContext>("@minecraft/ThreeJsContext")

// コンテキスト初期化レイヤー
const ThreeJsContextLive = Layer.scoped(
  ThreeJsContext,
  Effect.gen(function* () {
    const canvas = document.getElementById("minecraft-canvas") as HTMLCanvasElement

    if (!canvas) {
      return yield* Effect.fail(new RenderingError({
        message: "Canvas要素が見つかりません",
        timestamp: Date.now()
      }))
    }

    // WebGPUレンダラーを優先、非対応時はWebGLにフォールバック
    const isWebGPUSupported = navigator.gpu !== undefined
    const renderer = isWebGPUSupported
      ? new THREE.WebGPURenderer({
          canvas,
          antialias: true,
          powerPreference: "high-performance",
          // WebGPU固有の機能を有効化
          requiredFeatures: [
            'timestamp-query',
            'texture-compression-bc',
            'depth-clip-control',
            'depth32float-stencil8'
          ]
        })
      : new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: false
        })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x87CEEB, 50, 1000)

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )

    return Schema.decodeUnknownSync(ThreeJsContextSchema)({
      _tag: "ThreeJsContext",
      scene,
      camera,
      renderer,
      canvas,
      isWebGPU: isWebGPUSupported
    })
  })
)
```

### 1.3. Greedy Meshing実装

隣接する同一ブロックをまとめることで描画負荷を大幅に削減するアルゴリズムです。

```typescript
// メッシュデータスキーマ定義
const MeshDataSchema = Schema.Struct({
  _tag: Schema.Literal("MeshData"),
  positions: Schema.instanceOf(Float32Array),
  normals: Schema.instanceOf(Float32Array),
  uvs: Schema.instanceOf(Float32Array),
  indices: Schema.instanceOf(Uint32Array),
  vertexCount: Schema.Number
}).annotations({
  identifier: "MeshData",
  description: "チャンクレンダリング用の最適化されたメッシュデータ構造"
})

type MeshData = typeof MeshDataSchema.Type

// Greedy Meshingアルゴリズム
const generateGreedyMesh = (chunkData: ChunkData): Effect.Effect<MeshData, RenderingError> =>
  Effect.gen(function* () {
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    let vertexIndex = 0

    // 6方向の面処理
    const directions = [
      { axis: 0, dir: 1, u: 1, v: 2 },  // +X面
      { axis: 0, dir: -1, u: 2, v: 1 }, // -X面
      { axis: 1, dir: 1, u: 0, v: 2 },  // +Y面
      { axis: 1, dir: -1, u: 0, v: 2 }, // -Y面
      { axis: 2, dir: 1, u: 0, v: 1 },  // +Z面
      { axis: 2, dir: -1, u: 1, v: 0 }  // -Z面
    ]

    for (const direction of directions) {
      const mask: (Block | null)[] = new Array(CHUNK_SIZE * CHUNK_SIZE).fill(null)

      for (let slice = 0; slice < CHUNK_SIZE; slice++) {
        let maskIndex = 0

        for (let v = 0; v < CHUNK_SIZE; v++) {
          for (let u = 0; u < CHUNK_SIZE; u++) {
            const block = getBlockAtPosition(chunkData, u, v, slice, direction)
            const neighborBlock = getNeighborBlock(chunkData, u, v, slice, direction)

            if (shouldRenderFace(block, neighborBlock)) {
              mask[maskIndex] = block
            }
            maskIndex++
          }
        }

        generateQuadsFromMask(mask, slice, direction, positions, normals, uvs, indices, vertexIndex)
      }
    }

    return Schema.decodeUnknownSync(MeshDataSchema)({
      _tag: "MeshData",
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices),
      vertexCount: positions.length / 3
    })
  })
```

### 1.4. レンダリングコマンドキュー

```typescript
// レンダリングコマンド定義（最新Union型パターン）
const RenderCommandSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("CREATE_MESH"),
    meshData: ChunkMeshDataSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal("UPDATE_MESH"),
    handle: MeshHandleSchema,
    meshData: ChunkMeshDataSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal("REMOVE_MESH"),
    handle: MeshHandleSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal("UPDATE_CAMERA"),
    camera: CameraSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal("RENDER_FRAME")
  })
)

type RenderCommand = typeof RenderCommandSchema.Type

// コマンド処理（Match.valueパターン）
const processRenderCommand = (command: RenderCommand): Effect.Effect<void, RenderingError> =>
  Match.value(command).pipe(
    Match.tag("CREATE_MESH", ({ meshData }) => createMesh(meshData)),
    Match.tag("UPDATE_MESH", ({ handle, meshData }) => updateMesh(handle, meshData)),
    Match.tag("REMOVE_MESH", ({ handle }) => removeMesh(handle)),
    Match.tag("UPDATE_CAMERA", ({ camera }) => updateCamera(camera)),
    Match.tag("RENDER_FRAME", () => renderFrame()),
    Match.exhaustive
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

// TSL統合サービス定義
export interface ITSLService {
  readonly setupPipeline: () => Effect.Effect<TSLPipeline, RenderingError>
  readonly updateEffects: (config: EffectsConfig) => Effect.Effect<void, RenderingError>
}

export const TSLService = Context.GenericTag<ITSLService>("@minecraft/TSLService")

const setupAdvancedRenderingPipeline = (): Effect.Effect<TSLPipeline, RenderingError> =>
  Effect.gen(function* () {
    const scenePass = pass(scene, camera)
    scenePass.setMRT(mrt({
      output: output,
      emissive: emissive,
      normal: normalView,
      metalRough: vec2(metalness, roughness)
    }))

    const scenePassColor = scenePass.getTextureNode('output')
    const scenePassNormal = scenePass.getTextureNode('normal')
    const scenePassDepth = scenePass.getTextureNode('depth')

    // ポストプロセシング効果の合成
    const ssaoPass = ssao(scenePassColor, scenePassDepth, scenePassNormal)
    const ssrPass = ssr(scenePassColor, scenePassDepth, scenePassNormal)
    const bloomPass = bloom(scenePass.getTextureNode('emissive'))

    const finalOutput = scenePassColor
      .add(ssaoPass.mul(0.5))
      .add(ssrPass.mul(0.3))
      .add(bloomPass)

    return {
      pipeline: finalOutput,
      passes: { scenePass, ssaoPass, ssrPass, bloomPass }
    }
  })
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
const createUniversalRenderer = (type: "webgl" | "webgpu"): Effect.Effect<IUniversalRenderer, RenderingError> =>
  Match.value(type).pipe(
    Match.when("webgl", () => createWebGLRenderer()),
    Match.when("webgpu", () => createWebGPURenderer()),
    Match.exhaustive
  )

// WebGPUレンダラー実装
const createWebGPURenderer = (): Effect.Effect<IUniversalRenderer, RenderingError> =>
  Effect.gen(function* () {
    const renderer = new THREE.WebGPURenderer({
      antialias: true,
      powerPreference: "high-performance",
      requiredFeatures: [
        'timestamp-query',
        'texture-compression-bc',
        'depth-clip-control',
        'depth32float-stencil8'
      ]
    })

    return {
      render: (scene, camera) => Effect.tryPromise({
        try: () => renderer.renderAsync(scene, camera),
        catch: (error) => new RenderingError({
          message: `WebGPUレンダリング失敗: ${error}`,
          timestamp: Date.now()
        })
      }),
      resize: (width, height) => Effect.sync(() => {
        renderer.setSize(width, height)
      }),
      dispose: () => Effect.sync(() => {
        renderer.dispose()
      }),
      getInfo: () => Effect.sync(() => renderer.info)
    }
  })
```

## 3. 高度な機能

### 3.1. ポストプロセシング効果

**SSGI (Screen Space Global Illumination)**
```typescript
const SSGIEffectSchema = Schema.Struct({
  _tag: Schema.Literal("SSGIEffect"),
  intensity: Schema.Number.pipe(Schema.between(0, 2)),
  radius: Schema.Number.pipe(Schema.between(1, 10)),
  bias: Schema.Number.pipe(Schema.between(0, 1))
}).annotations({
  identifier: "SSGIEffect",
  description: "スクリーンスペースグローバルイルミネーション設定"
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
  _tag: Schema.Literal("TRAAEffect"),
  samples: Schema.Number.pipe(Schema.int(), Schema.between(2, 16)),
  accumulation: Schema.Number.pipe(Schema.between(0.8, 0.99))
})

type TRAAEffect = typeof TRAAEffectSchema.Type
```

### 3.2. シャドウマッピング

```typescript
// カスケードシャドウマッピング
const ShadowConfigSchema = Schema.Struct({
  _tag: Schema.Literal("ShadowConfig"),
  cascades: Schema.Number.pipe(Schema.int(), Schema.between(1, 4)),
  mapSize: Schema.Number.pipe(Schema.int()),
  bias: Schema.Number.pipe(Schema.between(-0.01, 0.01)),
  normalBias: Schema.Number.pipe(Schema.between(0, 1))
})

type ShadowConfig = typeof ShadowConfigSchema.Type

const setupCascadedShadowMapping = (config: ShadowConfig): Effect.Effect<CSMPass, RenderingError> =>
  Effect.gen(function* () {
    const csm = new CSM({
      maxFar: config.cascades * 50,
      cascades: config.cascades,
      shadowMapSize: config.mapSize,
      bias: config.bias,
      normalBias: config.normalBias
    })

    return csm
  })
```

### 3.3. アンビエントオクルージョン

```typescript
// HBAO (Horizon-Based Ambient Occlusion)
const HBAOConfigSchema = Schema.Struct({
  _tag: Schema.Literal("HBAOConfig"),
  aoRadius: Schema.Number.pipe(Schema.between(0.1, 5.0)),
  aoIntensity: Schema.Number.pipe(Schema.between(0.1, 2.0)),
  aoSteps: Schema.Number.pipe(Schema.int(), Schema.between(4, 16)),
  aoDirections: Schema.Number.pipe(Schema.int(), Schema.between(4, 16))
})

type HBAOConfig = typeof HBAOConfigSchema.Type
```

## 4. パフォーマンス最適化

### 4.1. インスタンシング

```typescript
// インスタンス描画サービス
export interface IInstancedRenderingService {
  // 最新Three.js API使用
  readonly createInstancedMesh: (geometry: THREE.BufferGeometry, material: THREE.Material, count: number) => Effect.Effect<THREE.InstancedMesh, RenderingError>
  readonly updateInstances: (mesh: THREE.InstancedMesh, transforms: Matrix4[]) => Effect.Effect<void, RenderingError>
  // WebGPU非同期レンダリングサポート
  readonly renderAsync: (scene: THREE.Scene, camera: THREE.Camera) => Effect.Effect<void, RenderingError>
}

export const InstancedRenderingService = Context.GenericTag<IInstancedRenderingService>("@minecraft/InstancedRenderingService")

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
      updateInstances
    })
  })
)
```

### 4.2. フラスタムカリング

```typescript
// フラスタムカリングサービス
const FrustumCullingSchema = Schema.Struct({
  _tag: Schema.Literal("FrustumCulling"),
  camera: Schema.instanceOf(THREE.Camera),
  objects: Schema.Array(Schema.instanceOf(THREE.Object3D))
})

type FrustumCulling = typeof FrustumCullingSchema.Type

const performFrustumCulling = (data: FrustumCulling): Effect.Effect<THREE.Object3D[], RenderingError> =>
  Effect.gen(function* () {
    const frustum = new THREE.Frustum()
    const matrix = new THREE.Matrix4()

    matrix.multiplyMatrices(data.camera.projectionMatrix, data.camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(matrix)

    const visibleObjects = data.objects.filter(obj => {
      const sphere = new THREE.Sphere()
      obj.geometry?.computeBoundingSphere()
      if (obj.geometry?.boundingSphere) {
        sphere.copy(obj.geometry.boundingSphere)
        sphere.applyMatrix4(obj.matrixWorld)
        return frustum.intersectsSphere(sphere)
      }
      return true
    })

    return visibleObjects
  })
```

### 4.3. レベルオブディテール(LOD)

```typescript
// LOD管理システム
const LODConfigSchema = Schema.Struct({
  _tag: Schema.Literal("LODConfig"),
  distances: Schema.Array(Schema.Number),
  meshQuality: Schema.Array(Schema.Literal("high", "medium", "low"))
})

type LODConfig = typeof LODConfigSchema.Type

const LODManager = {
  calculateLOD: (cameraPosition: Vector3, chunkPosition: Vector3, config: LODConfig): "high" | "medium" | "low" => {
    const distance = Math.sqrt(
      Math.pow(cameraPosition.x - chunkPosition.x, 2) +
      Math.pow(cameraPosition.z - chunkPosition.z, 2)
    )

    for (let i = 0; i < config.distances.length; i++) {
      if (distance <= config.distances[i]) {
        return config.meshQuality[i]
      }
    }

    return "low"
  },

  generateLODMesh: (chunkData: ChunkData, quality: "high" | "medium" | "low"): Effect.Effect<MeshData, RenderingError> =>
    Match.value(quality).pipe(
      Match.when("high", () => generateGreedyMesh(chunkData)),
      Match.when("medium", () => generateSimplifiedMesh(chunkData, 0.5)),
      Match.when("low", () => generateSimplifiedMesh(chunkData, 0.25)),
      Match.exhaustive
    )
}
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
  _tag: Schema.Literal("MemoryUsage"),
  totalBytes: Schema.Number,
  textureBytes: Schema.Number,
  geometryBytes: Schema.Number
})

type MemoryUsage = typeof MemoryUsageSchema.Type

export const MemoryManagerService = Context.GenericTag<IMemoryManagerService>("@minecraft/MemoryManagerService")

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
          _tag: "MemoryUsage",
          totalBytes: (info.memory.geometries + info.memory.textures) * 1024,
          textureBytes: info.memory.textures * 1024,
          geometryBytes: info.memory.geometries * 1024
        })
      })

    const dispose = (): Effect.Effect<void, RenderingError> =>
      Effect.gen(function* () {
        threeJsContext.renderer.dispose()
      })

    return MemoryManagerService.of({
      collectGarbage,
      getMemoryUsage,
      dispose
    })
  })
)
```
## 関連ドキュメント

- [チャンクシステム](./07-chunk-system.md) - レンダリング対象となる主要オブジェクトであるチャンクを管理します。
- [マテリアルシステム](./10-material-system.md) - レンダリングされるオブジェクトの外観を定義します。
- [シーン管理システム](./11-scene-management-system.md) - レンダリングされるシーン全体を管理します。
- [パーティクルシステム](../../01-enhanced-features/14-particle-system.md) - パーティクルエフェクトのレンダリングを扱います。
- [ECS統合](../../01-architecture/05-ecs-integration.md) - エンティティコンポーネントシステムとの統合。
- [Effect-TSパターン](../../01-architecture/06-effect-ts-patterns.md) - Effect-TSパターンの詳細な使用法。

## 用語集

- **Three.js**: レンダリングエンジンとして使用される3Dグラフィックスライブラリ。 ([詳細](../../../04-appendix/00-glossary.md#threejs))
- **WebGPU**: 次世代のWebグラフィックスAPI。 ([詳細](../../../04-appendix/00-glossary.md#webgpu))
- **Greedy Meshing**: ボクセルレンダリングの最適化アルゴリズム。 ([詳細](../../../04-appendix/00-glossary.md#greedy-meshing))
- **TSL**: Three.js Shading Language。モダンなシェーダーを記述するための言語。 ([詳細](../../../04-appendix/00-glossary.md#tsl))
- **フラスタムカリング**: カメラの視野外にあるオブジェクトを除外する最適化技術。 ([詳細](../../../04-appendix/00-glossary.md#frustum-culling))
- **LOD**: Level of Detail。距離に応じてレンダリング品質を調整する最適化技術。 ([詳細](../../../04-appendix/00-glossary.md#lod))
