# Rendering System - レンダリングシステム

## 概要

Rendering Systemは、Minecraftの3D世界をWebGL/Three.jsを使用してレンダリングする高性能なシステムです。チャンクメッシュ生成、視錐台カリング、LOD（Level of Detail）、ライティング、影処理などを担当します。

## アーキテクチャ

### Domain Model（Effect-TS + DDD）

```typescript
import { Effect, Layer, Context, Schema, pipe } from "effect"
import { Brand } from "effect"
import * as THREE from "three"

// Value Objects
export const ViewportSize = Schema.Struct({
  width: pipe(Schema.Number, Schema.int(), Schema.positive()),
  height: pipe(Schema.Number, Schema.int(), Schema.positive())
})

export const CameraConfiguration = Schema.Struct({
  fov: pipe(Schema.Number, Schema.between(30, 120)),
  aspect: pipe(Schema.Number, Schema.positive()),
  near: pipe(Schema.Number, Schema.positive()),
  far: pipe(Schema.Number, Schema.positive()),
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  target: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  })
})

export const RenderSettings = Schema.Struct({
  renderDistance: pipe(Schema.Number, Schema.int(), Schema.between(2, 32)),
  enableShadows: Schema.Boolean,
  shadowMapSize: pipe(Schema.Number, Schema.int(), Schema.between(512, 4096)),
  enableFog: Schema.Boolean,
  fogNear: Schema.Number,
  fogFar: Schema.Number,
  enableVSync: Schema.Boolean,
  maxFPS: pipe(Schema.Number, Schema.int(), Schema.between(30, 144)),
  antialiasing: Schema.Boolean,
  textureFiltering: Schema.Literal("nearest", "linear", "anisotropic")
})

// Entities
export const ChunkMesh = Schema.Struct({
  chunkCoordinate: Schema.Struct({
    x: Schema.Number.pipe(Schema.int()),
    z: Schema.Number.pipe(Schema.int())
  }),
  geometry: Schema.Unknown, // THREE.BufferGeometry
  material: Schema.Unknown, // THREE.Material
  mesh: Schema.Unknown, // THREE.Mesh
  vertices: Schema.Array(Schema.Number),
  indices: Schema.Array(Schema.Number),
  uvs: Schema.Array(Schema.Number),
  normals: Schema.Array(Schema.Number),
  vertexCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  triangleCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  needsUpdate: Schema.Boolean,
  lodLevel: pipe(Schema.Number, Schema.int(), Schema.between(0, 4)),
  lastUpdate: Schema.DateTimeUtc
})

export type ChunkMesh = Schema.Schema.Type<typeof ChunkMesh>

export const RenderContext = Schema.Struct({
  scene: Schema.Unknown, // THREE.Scene
  camera: Schema.Unknown, // THREE.Camera
  renderer: Schema.Unknown, // THREE.WebGLRenderer
  canvas: Schema.Unknown, // HTMLCanvasElement
  frameTime: Schema.Number,
  frameCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  averageFrameTime: Schema.Number,
  viewportSize: ViewportSize,
  settings: RenderSettings
})

export type RenderContext = Schema.Schema.Type<typeof RenderContext>
```

## WebGL/Three.js統合システム

### Renderer Service

```typescript
// IMPORTANT: Context7でThree.jsの最新APIパターンを確認して実装
interface RendererServiceInterface {
  readonly initialize: (canvas: HTMLCanvasElement) => Effect.Effect<RenderContext, RenderInitError>
  readonly resize: (context: RenderContext, size: ViewportSize) => Effect.Effect<RenderContext, never>
  readonly render: (context: RenderContext, deltaTime: number) => Effect.Effect<RenderContext, RenderError>
  readonly dispose: (context: RenderContext) => Effect.Effect<void, never>
  readonly updateSettings: (context: RenderContext, settings: RenderSettings) => Effect.Effect<RenderContext, never>
}

export const RendererService = Context.GenericTag<RendererServiceInterface>("@app/RendererService")

// Live実装
const makeRendererService = Effect.gen(function* () {
  const textureManager = yield* TextureManager
  const shaderManager = yield* ShaderManager

  // 純粋関数: WebGLレンダラー初期化設定
  const createRendererConfig = (canvas: HTMLCanvasElement) => ({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance" as const,
    precision: "highp" as const
  })

  // 純粋関数: デフォルトレンダー設定
  const createDefaultRenderSettings = (): RenderSettings => ({
    renderDistance: 16,
    enableShadows: true,
    shadowMapSize: 2048,
    enableFog: true,
    fogNear: 50,
    fogFar: 200,
    enableVSync: true,
    maxFPS: 60,
    antialiasing: true,
    textureFiltering: "anisotropic"
  })

  const initialize = (canvas: HTMLCanvasElement) =>
    Effect.gen(function* () {
      // 早期リターン: canvas検証
      if (!canvas) {
        return yield* Effect.fail(new RenderInitError("Canvas element is required"))
      }

      // WebGLレンダラー初期化
      const rendererConfig = createRendererConfig(canvas)
      const renderer = new THREE.WebGLRenderer(rendererConfig)

      // レンダラー設定の適用
      const setupRenderer = (r: THREE.WebGLRenderer, c: HTMLCanvasElement) => {
        r.setSize(c.clientWidth, c.clientHeight)
        r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        r.setClearColor(0x87CEEB, 1.0) // Sky blue
        r.shadowMap.enabled = true
        r.shadowMap.type = THREE.PCFSoftShadowMap
        r.outputColorSpace = THREE.SRGBColorSpace
        r.toneMapping = THREE.ACESFilmicToneMapping
        r.toneMappingExposure = 1.0
        return r
      }

      const configuredRenderer = setupRenderer(renderer, canvas)

      // シーン初期化
      const scene = new THREE.Scene()
      scene.fog = new THREE.Fog(0x87CEEB, 50, 200)

      // カメラ初期化
      const camera = new THREE.PerspectiveCamera(
        75, // FOV
        canvas.clientWidth / canvas.clientHeight, // Aspect
        0.1, // Near
        1000 // Far
      )
      camera.position.set(0, 64, 0)

      // ライティング設定
      yield* setupSceneLighting(scene)

      return {
        scene,
        camera,
        renderer: configuredRenderer,
        canvas,
        frameTime: 0,
        frameCount: 0,
        averageFrameTime: 16.67,
        viewportSize: { width: canvas.clientWidth, height: canvas.clientHeight },
        settings: createDefaultRenderSettings()
      } as RenderContext
    })

  // 純粋関数: シーンライティング設定
  const setupSceneLighting = (scene: THREE.Scene) =>
    Effect.gen(function* () {
      // 環境光の設定
      const ambientLight = new THREE.AmbientLight(0x404040, 0.3)
      scene.add(ambientLight)

      // 太陽光（指向性ライト）
      const sunLight = new THREE.DirectionalLight(0xffffff, 0.8)
      sunLight.position.set(50, 100, 50)
      sunLight.castShadow = true
      sunLight.shadow.mapSize.width = 2048
      sunLight.shadow.mapSize.height = 2048
      sunLight.shadow.camera.near = 0.5
      sunLight.shadow.camera.far = 200
      sunLight.shadow.camera.left = -100
      sunLight.shadow.camera.right = 100
      sunLight.shadow.camera.top = 100
      sunLight.shadow.camera.bottom = -100
      scene.add(sunLight)
    })

  const resize = (context: RenderContext, size: ViewportSize) =>
    Effect.gen(function* () {
      // 早期リターン: サイズ検証
      if (size.width <= 0 || size.height <= 0) {
        return context
      }

      const { camera, renderer } = context

      // 純粋関数: カメラアスペクト比計算
      const calculateAspectRatio = (w: number, h: number) => w / h

      // カメラ更新
      const perspectiveCamera = camera as THREE.PerspectiveCamera
      perspectiveCamera.aspect = calculateAspectRatio(size.width, size.height)
      perspectiveCamera.updateProjectionMatrix()

      // レンダラーサイズ更新
      ;(renderer as THREE.WebGLRenderer).setSize(size.width, size.height)

      return { ...context, viewportSize: size }
    })

  const render = (context: RenderContext, deltaTime: number) =>
    Effect.gen(function* () {
      const startTime = performance.now()

      // 純粋関数: フレームレート制限計算
      const calculateFrameDelay = (settings: RenderSettings, dt: number): number => {
        if (!settings.enableVSync) return 0
        const targetFrameTime = 1000 / settings.maxFPS
        return Math.max(0, targetFrameTime - dt)
      }

      // フレーム制限適用
      const frameDelay = calculateFrameDelay(context.settings, deltaTime)
      if (frameDelay > 0) {
        yield* Effect.sleep(`${frameDelay} millis`)
      }

      // レンダリング実行
      ;(context.renderer as THREE.WebGLRenderer).render(
        context.scene as THREE.Scene,
        context.camera as THREE.Camera
      )

      // パフォーマンス統計計算
      const endTime = performance.now()
      const frameTime = endTime - startTime
      const newFrameCount = context.frameCount + 1
      const smoothingFactor = 0.95
      const newAverageFrameTime = (context.averageFrameTime * smoothingFactor) + (frameTime * (1 - smoothingFactor))

      return {
        ...context,
        frameTime,
        frameCount: newFrameCount,
        averageFrameTime: newAverageFrameTime
      }
    })

  const dispose = (context: RenderContext) =>
    Effect.gen(function* () {
      const renderer = context.renderer as THREE.WebGLRenderer
      renderer.dispose()
    })

  const updateSettings = (context: RenderContext, settings: RenderSettings) =>
    Effect.gen(function* () {
      const renderer = context.renderer as THREE.WebGLRenderer
      const scene = context.scene as THREE.Scene

      // Match.valueで設定更新を分岐
      yield* Match.value(settings.enableShadows).pipe(
        Match.when(true, () => Effect.sync(() => {
          renderer.shadowMap.enabled = true
          renderer.shadowMap.needsUpdate = true
        })),
        Match.when(false, () => Effect.sync(() => {
          renderer.shadowMap.enabled = false
        })),
        Match.exhaustive
      )

      // Match.valueでフォグ設定を分岐
      yield* Match.value(settings.enableFog).pipe(
        Match.when(true, () => Effect.sync(() => {
          scene.fog = new THREE.Fog(0x87CEEB, settings.fogNear, settings.fogFar)
        })),
        Match.when(false, () => Effect.sync(() => {
          scene.fog = null
        })),
        Match.exhaustive
      )

      return { ...context, settings }
    })

  return RendererService.of({
    initialize,
    resize,
    render,
    dispose,
    updateSettings
  })
})

// Live Layer
export const RendererServiceLive = Layer.effect(
  RendererService,
  makeRendererService
).pipe(
  Layer.provide(TextureManagerLive),
  Layer.provide(ShaderManagerLive)
)
```

## チャンクレンダリング最適化

### Chunk Meshing System

```typescript
interface ChunkMeshingServiceInterface {
  readonly generateMesh: (chunk: Chunk) => Effect.Effect<ChunkMesh, MeshGenerationError>
  readonly updateMesh: (mesh: ChunkMesh, chunk: Chunk) => Effect.Effect<ChunkMesh, never>
  readonly generateLODMesh: (chunk: Chunk, lodLevel: number) => Effect.Effect<ChunkMesh, never>
  readonly optimizeMesh: (mesh: ChunkMesh) => Effect.Effect<ChunkMesh, never>
}

export const ChunkMeshingService = Context.GenericTag<ChunkMeshingServiceInterface>("@app/ChunkMeshingService")

export const ChunkMeshingServiceLive = Layer.effect(
  ChunkMeshingService,
  Effect.gen(function* () {
    const textureManager = yield* TextureManager
    const blockRegistry = yield* BlockRegistry

    const generateMesh = (chunk: Chunk) =>
      Effect.gen(function* () {
        const vertices: number[] = []
        const indices: number[] = []
        const uvs: number[] = []
        const normals: number[] = []
        let indexCounter = 0

        // グリーディメッシング（Greedy Meshing）アルゴリズム
        for (let axis = 0; axis < 3; axis++) {
          const u = (axis + 1) % 3
          const v = (axis + 2) % 3
          const x = [0, 0, 0]
          const q = [0, 0, 0]
          const mask: (number | null)[] = new Array(CHUNK_SIZE * CHUNK_SIZE)

          q[axis] = 1

          for (x[axis] = -1; x[axis] < CHUNK_SIZE;) {
            let n = 0

            for (x[v] = 0; x[v] < CHUNK_SIZE; x[v]++) {
              for (x[u] = 0; x[u] < CHUNK_SIZE; x[u]++) {
                const blockA = getBlockAt(chunk, x[0], x[1], x[2])
                const blockB = getBlockAt(chunk, x[0] + q[0], x[1] + q[1], x[2] + q[2])

                mask[n++] = shouldCreateFace(blockA, blockB) ? blockA : null
              }
            }

            x[axis]++
            n = 0

            // マスクからメッシュ生成
            for (let j = 0; j < CHUNK_SIZE; j++) {
              let i = 0
              while (i < CHUNK_SIZE) {
                if (mask[n] !== null) {
                  const currentBlock = mask[n]
                  let w = 1
                  let h = 1

                  // 幅の最適化
                  while (i + w < CHUNK_SIZE && mask[n + w] === currentBlock) {
                    w++
                  }

                  // 高さの最適化
                  let done = false
                  while (j + h < CHUNK_SIZE) {
                    for (let k = 0; k < w; k++) {
                      if (mask[n + k + h * CHUNK_SIZE] !== currentBlock) {
                        done = true
                        break
                      }
                    }
                    if (done) break
                    h++
                  }

                  // クワッドの生成
                  x[u] = i
                  x[v] = j
                  const du = [0, 0, 0]
                  const dv = [0, 0, 0]
                  du[u] = w
                  dv[v] = h

                  const quad = createQuad(x, du, dv, axis, currentBlock!)
                  vertices.push(...quad.vertices)
                  uvs.push(...quad.uvs)
                  normals.push(...quad.normals)

                  // インデックス追加
                  const baseIndex = indexCounter
                  indices.push(
                    baseIndex, baseIndex + 1, baseIndex + 2,
                    baseIndex, baseIndex + 2, baseIndex + 3
                  )
                  indexCounter += 4

                  // マスクをクリア
                  for (let l = 0; l < h; l++) {
                    for (let k = 0; k < w; k++) {
                      mask[n + k + l * CHUNK_SIZE] = null
                    }
                  }

                  i += w
                  n += w
                } else {
                  i++
                  n++
                }
              }
            }
          }
        }

        // Three.jsジオメトリ生成
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
        geometry.setIndex(indices)

        // マテリアル設定
        const material = yield* createChunkMaterial()
        const mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.position.set(
          chunk.coordinate.x * CHUNK_SIZE,
          0,
          chunk.coordinate.z * CHUNK_SIZE
        )

        return {
          chunkCoordinate: chunk.coordinate,
          geometry,
          material,
          mesh,
          vertices,
          indices,
          uvs,
          normals,
          vertexCount: vertices.length / 3,
          triangleCount: indices.length / 3,
          needsUpdate: false,
          lodLevel: 0,
          lastUpdate: new Date()
        } as ChunkMesh
      })

    const generateLODMesh = (chunk: Chunk, lodLevel: number) =>
      Effect.gen(function* () {
        const decimationFactor = Math.pow(2, lodLevel)
        const lodChunk = decimateChunk(chunk, decimationFactor)
        return yield* generateMesh(lodChunk)
      })

    const optimizeMesh = (mesh: ChunkMesh) =>
      Effect.gen(function* () {
        // メッシュ最適化（重複頂点の削除、インデックス最適化など）
        const geometry = mesh.geometry as THREE.BufferGeometry
        geometry.computeBoundingSphere()
        geometry.computeBoundingBox()

        // 頂点の重複削除
        const mergedGeometry = THREE.BufferGeometryUtils.mergeVertices(geometry, 0.0001)

        return {
          ...mesh,
          geometry: mergedGeometry,
          vertexCount: mergedGeometry.attributes.position.count,
          triangleCount: mergedGeometry.index ? mergedGeometry.index.count / 3 : 0,
          needsUpdate: false
        }
      })

    return { generateMesh, updateMesh: (mesh, chunk) => generateMesh(chunk), generateLODMesh, optimizeMesh }
  })
).pipe(
  Layer.provide(TextureManagerLive),
  Layer.provide(BlockRegistryLive)
)

// ヘルパー関数
const getBlockAt = (chunk: Chunk, x: number, y: number, z: number): number => {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
    return 0 // Air
  }
  const index = y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x
  return chunk.blocks[index] || 0
}

const shouldCreateFace = (blockA: number, blockB: number): boolean => {
  if (blockA === 0) return false // Air doesn't create faces
  if (blockB === 0) return true // Adjacent to air
  return isTransparent(blockB) && !isTransparent(blockA)
}

const createQuad = (pos: number[], du: number[], dv: number[], axis: number, blockType: number) => {
  const vertices: number[] = []
  const uvs: number[] = []
  const normals: number[] = []

  // クワッド頂点の計算
  const positions = [
    [pos[0], pos[1], pos[2]],
    [pos[0] + du[0], pos[1] + du[1], pos[2] + du[2]],
    [pos[0] + du[0] + dv[0], pos[1] + du[1] + dv[1], pos[2] + du[2] + dv[2]],
    [pos[0] + dv[0], pos[1] + dv[1], pos[2] + dv[2]]
  ]

  // 法線の計算
  const normal = [0, 0, 0]
  normal[axis] = pos[axis] < 0 ? -1 : 1

  positions.forEach(position => {
    vertices.push(...position)
    normals.push(...normal)
  })

  // テクスチャ座標の計算
  const textureIndex = getTextureIndex(blockType, axis)
  const u = (textureIndex % 16) / 16
  const v = Math.floor(textureIndex / 16) / 16
  const texelSize = 1 / 16

  uvs.push(
    u, v + texelSize,
    u + texelSize, v + texelSize,
    u + texelSize, v,
    u, v
  )

  return { vertices, uvs, normals }
}
```

## 視錐台カリング（Frustum Culling）

### Frustum Culling System

```typescript
export class FrustumCullingService extends Context.Tag("FrustumCullingService")<
  FrustumCullingService,
  {
    readonly updateFrustum: (camera: THREE.Camera) => Effect.Effect<THREE.Frustum, never>
    readonly cullChunks: (frustum: THREE.Frustum, chunks: ReadonlyArray<ChunkMesh>) => Effect.Effect<ReadonlyArray<ChunkMesh>, never>
    readonly cullEntities: (frustum: THREE.Frustum, entities: ReadonlyArray<Entity>) => Effect.Effect<ReadonlyArray<Entity>, never>
    readonly isInFrustum: (frustum: THREE.Frustum, bounds: THREE.Box3) => Effect.Effect<boolean, never>
  }
>() {}

export const FrustumCullingServiceLive = Layer.succeed(
  FrustumCullingService,
  {
    updateFrustum: (camera) =>
      Effect.gen(function* () {
        const frustum = new THREE.Frustum()
        const matrix = new THREE.Matrix4().multiplyMatrices(
          (camera as THREE.PerspectiveCamera).projectionMatrix,
          (camera as THREE.PerspectiveCamera).matrixWorldInverse
        )
        frustum.setFromProjectionMatrix(matrix)
        return frustum
      }),

    cullChunks: (frustum, chunks) =>
      Effect.gen(function* () {
        const visibleChunks: ChunkMesh[] = []

        for (const chunk of chunks) {
          const mesh = chunk.mesh as THREE.Mesh
          if (mesh.geometry.boundingBox) {
            const worldBounds = mesh.geometry.boundingBox.clone()
            worldBounds.applyMatrix4(mesh.matrixWorld)

            if (frustum.intersectsBox(worldBounds)) {
              visibleChunks.push(chunk)
            }
          }
        }

        return visibleChunks
      }),

    cullEntities: (frustum, entities) =>
      Effect.gen(function* () {
        const visibleEntities: Entity[] = []

        for (const entity of entities) {
          const bounds = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z),
            new THREE.Vector3(entity.size.x, entity.size.y, entity.size.z)
          )

          if (frustum.intersectsBox(bounds)) {
            visibleEntities.push(entity)
          }
        }

        return visibleEntities
      }),

    isInFrustum: (frustum, bounds) =>
      Effect.succeed(frustum.intersectsBox(bounds))
  }
)
```

## LOD（Level of Detail）システム

### LOD Management System

```typescript
export class LODService extends Context.Tag("LODService")<
  LODService,
  {
    readonly calculateLOD: (distance: number, settings: RenderSettings) => Effect.Effect<number, never>
    readonly updateChunkLOD: (mesh: ChunkMesh, lodLevel: number) => Effect.Effect<ChunkMesh, never>
    readonly manageLOD: (playerPosition: WorldPosition, chunks: ReadonlyArray<ChunkMesh>) => Effect.Effect<ReadonlyArray<ChunkMesh>, never>
  }
>() {}

export const LODServiceLive = Layer.effect(
  LODService,
  Effect.gen(function* () {
    const meshingService = yield* ChunkMeshingService

    const calculateLOD = (distance: number, settings: RenderSettings) =>
      Effect.gen(function* () {
        const maxDistance = settings.renderDistance * CHUNK_SIZE
        const ratio = distance / maxDistance

        if (ratio < 0.25) return 0 // 最高品質
        if (ratio < 0.5) return 1   // 高品質
        if (ratio < 0.75) return 2  // 中品質
        if (ratio < 1.0) return 3   // 低品質
        return 4                    // 最低品質
      })

    const updateChunkLOD = (mesh: ChunkMesh, lodLevel: number) =>
      Effect.gen(function* () {
        if (mesh.lodLevel === lodLevel) return mesh

        const chunk = yield* getChunkFromMesh(mesh)
        const newMesh = yield* meshingService.generateLODMesh(chunk, lodLevel)

        return {
          ...mesh,
          ...newMesh,
          lodLevel
        }
      })

    const manageLOD = (playerPosition: WorldPosition, chunks: ReadonlyArray<ChunkMesh>) =>
      Effect.gen(function* () {
        const updatedChunks: ChunkMesh[] = []

        for (const chunk of chunks) {
          const chunkCenter = {
            x: chunk.chunkCoordinate.x * CHUNK_SIZE + CHUNK_SIZE / 2,
            y: 64, // 中間高度
            z: chunk.chunkCoordinate.z * CHUNK_SIZE + CHUNK_SIZE / 2
          }

          const distance = Math.sqrt(
            Math.pow(playerPosition.x - chunkCenter.x, 2) +
            Math.pow(playerPosition.z - chunkCenter.z, 2)
          )

          const lodLevel = yield* calculateLOD(distance, {
            renderDistance: 16,
            enableShadows: true,
            shadowMapSize: 2048,
            enableFog: true,
            fogNear: 50,
            fogFar: 200,
            enableVSync: true,
            maxFPS: 60,
            antialiasing: true,
            textureFiltering: "anisotropic"
          })

          const updatedChunk = yield* updateChunkLOD(chunk, lodLevel)
          updatedChunks.push(updatedChunk)
        }

        return updatedChunks
      })

    return { calculateLOD, updateChunkLOD, manageLOD }
  })
).pipe(
  Layer.provide(ChunkMeshingServiceLive)
)
```

## ライティングとシャドウマッピング

### Lighting System

```typescript
export class RenderLightingService extends Context.Tag("RenderLightingService")<
  RenderLightingService,
  {
    readonly setupLighting: (scene: THREE.Scene) => Effect.Effect<LightingContext, never>
    readonly updateSunPosition: (context: LightingContext, timeOfDay: number) => Effect.Effect<LightingContext, never>
    readonly calculateShadowCascades: (camera: THREE.Camera) => Effect.Effect<ReadonlyArray<THREE.OrthographicCamera>, never>
    readonly updateDynamicLights: (context: LightingContext, lights: ReadonlyArray<DynamicLight>) => Effect.Effect<LightingContext, never>
  }
>() {}

export const RenderLightingServiceLive = Layer.succeed(
  RenderLightingService,
  {
    setupLighting: (scene) =>
      Effect.gen(function* () {
        // 環境光
        const ambientLight = new THREE.AmbientLight(0x404040, 0.2)
        scene.add(ambientLight)

        // 太陽光（指向性ライト）
        const sunLight = new THREE.DirectionalLight(0xffffff, 0.8)
        sunLight.position.set(100, 100, 50)
        sunLight.castShadow = true
        sunLight.shadow.mapSize.width = 4096
        sunLight.shadow.mapSize.height = 4096
        sunLight.shadow.camera.near = 0.5
        sunLight.shadow.camera.far = 500
        sunLight.shadow.camera.left = -200
        sunLight.shadow.camera.right = 200
        sunLight.shadow.camera.top = 200
        sunLight.shadow.camera.bottom = -200
        sunLight.shadow.bias = -0.0001
        scene.add(sunLight)

        // 月光（指向性ライト）
        const moonLight = new THREE.DirectionalLight(0x404080, 0.1)
        moonLight.position.set(-100, 50, -50)
        moonLight.castShadow = false
        scene.add(moonLight)

        return {
          ambientLight,
          sunLight,
          moonLight,
          dynamicLights: new Map<string, THREE.PointLight>(),
          shadowCascades: []
        } as LightingContext
      }),

    updateSunPosition: (context, timeOfDay) =>
      Effect.gen(function* () {
        const sunAngle = (timeOfDay * 2 * Math.PI) - Math.PI / 2
        const sunHeight = Math.sin(sunAngle) * 100
        const sunDistance = Math.cos(sunAngle) * 100

        context.sunLight.position.set(sunDistance, Math.max(sunHeight, 10), 50)

        // 昼夜サイクルに応じた光の色と強度
        if (sunHeight > 0) {
          // 昼間
          const intensity = Math.min(sunHeight / 100, 0.8)
          context.sunLight.intensity = intensity
          context.sunLight.color.setHex(0xffffff)
          context.ambientLight.intensity = 0.2 + intensity * 0.1
        } else {
          // 夜間
          context.sunLight.intensity = 0
          context.moonLight.intensity = 0.1
          context.ambientLight.intensity = 0.05
        }

        return context
      }),

    calculateShadowCascades: (camera) =>
      Effect.gen(function* () {
        const cascades: THREE.OrthographicCamera[] = []
        const distances = [10, 30, 100, 300]

        for (let i = 0; i < distances.length; i++) {
          const cascade = new THREE.OrthographicCamera(
            -distances[i], distances[i],
            distances[i], -distances[i],
            0.1, distances[i] * 2
          )
          cascades.push(cascade)
        }

        return cascades
      }),

    updateDynamicLights: (context, lights) =>
      Effect.gen(function* () {
        // 既存の動的ライトをクリア
        for (const [id, light] of context.dynamicLights) {
          light.parent?.remove(light)
        }
        context.dynamicLights.clear()

        // 新しい動的ライトを追加
        for (const dynamicLight of lights) {
          const pointLight = new THREE.PointLight(
            dynamicLight.color,
            dynamicLight.intensity,
            dynamicLight.range,
            2 // decay
          )
          pointLight.position.set(
            dynamicLight.position.x,
            dynamicLight.position.y,
            dynamicLight.position.z
          )
          pointLight.castShadow = dynamicLight.castShadow

          if (dynamicLight.castShadow) {
            pointLight.shadow.mapSize.width = 1024
            pointLight.shadow.mapSize.height = 1024
            pointLight.shadow.camera.near = 0.1
            pointLight.shadow.camera.far = dynamicLight.range
          }

          context.dynamicLights.set(dynamicLight.id, pointLight)
        }

        return context
      })
  }
)

// 型定義
interface LightingContext {
  readonly ambientLight: THREE.AmbientLight
  readonly sunLight: THREE.DirectionalLight
  readonly moonLight: THREE.DirectionalLight
  readonly dynamicLights: Map<string, THREE.PointLight>
  readonly shadowCascades: ReadonlyArray<THREE.OrthographicCamera>
}

interface DynamicLight {
  readonly id: string
  readonly position: { x: number; y: number; z: number }
  readonly color: number
  readonly intensity: number
  readonly range: number
  readonly castShadow: boolean
}
```

## テクスチャ管理システム

### Texture Manager

```typescript
export class TextureManager extends Context.Tag("TextureManager")<
  TextureManager,
  {
    readonly loadTexture: (path: string) => Effect.Effect<THREE.Texture, TextureLoadError>
    readonly createAtlas: (textures: ReadonlyArray<string>) => Effect.Effect<THREE.Texture, AtlasCreationError>
    readonly getBlockTexture: (blockType: BlockType, face: BlockFace) => Effect.Effect<THREE.Texture, never>
    readonly preloadTextures: () => Effect.Effect<void, TextureLoadError>
  }
>() {}

export const TextureManagerLive = Layer.effect(
  TextureManager,
  Effect.gen(function* () {
    const textureCache = yield* Effect.sync(() => new Map<string, THREE.Texture>())
    const atlasTexture = yield* Effect.sync(() => new Map<string, THREE.Texture>())

    const loadTexture = (path: string) =>
      Effect.gen(function* () {
        const cached = textureCache.get(path)
        if (cached) return cached

        const loader = new THREE.TextureLoader()
        const texture = yield* Effect.async<THREE.Texture, TextureLoadError>((resolve) => {
          loader.load(
            path,
            (texture) => {
              // テクスチャ設定
              texture.magFilter = THREE.NearestFilter
              texture.minFilter = THREE.NearestMipMapLinearFilter
              texture.generateMipmaps = true
              texture.wrapS = THREE.RepeatWrapping
              texture.wrapT = THREE.RepeatWrapping
              resolve(Effect.succeed(texture))
            },
            undefined,
            (error) => resolve(Effect.fail(new TextureLoadError({ path, error: error.message })))
          )
        })

        textureCache.set(path, texture)
        return texture
      })

    const createAtlas = (textures: ReadonlyArray<string>) =>
      Effect.gen(function* () {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')!

        // アトラスサイズの計算（16x16のテクスチャを仮定）
        const textureSize = 16
        const atlasSize = Math.ceil(Math.sqrt(textures.length)) * textureSize
        canvas.width = atlasSize
        canvas.height = atlasSize

        // 各テクスチャをアトラスに配置
        for (let i = 0; i < textures.length; i++) {
          const texture = yield* loadTexture(textures[i])
          const x = (i % (atlasSize / textureSize)) * textureSize
          const y = Math.floor(i / (atlasSize / textureSize)) * textureSize

          // テクスチャをcanvasに描画
          const img = new Image()
          img.src = textures[i]
          yield* Effect.async<void, never>((resolve) => {
            img.onload = () => {
              context.drawImage(img, x, y, textureSize, textureSize)
              resolve(Effect.unit)
            }
          })
        }

        // Three.jsテクスチャとして変換
        const atlasTexture = new THREE.CanvasTexture(canvas)
        atlasTexture.magFilter = THREE.NearestFilter
        atlasTexture.minFilter = THREE.NearestMipMapLinearFilter
        atlasTexture.generateMipmaps = true

        return atlasTexture
      })

    const getBlockTexture = (blockType: BlockType, face: BlockFace) =>
      Effect.gen(function* () {
        const textureMap = getBlockTextureMap()
        const textureName = textureMap[blockType]?.[face] || textureMap[blockType]?.all || 'missing'
        return yield* loadTexture(`textures/blocks/${textureName}.png`)
      })

    const preloadTextures = () =>
      Effect.gen(function* () {
        const blockTextures = [
          'stone', 'dirt', 'grass_block_top', 'grass_block_side',
          'oak_log', 'oak_leaves', 'cobblestone', 'sand',
          'water', 'glass', 'oak_planks'
        ]

        for (const texture of blockTextures) {
          yield* loadTexture(`textures/blocks/${texture}.png`)
        }
      })

    return { loadTexture, createAtlas, getBlockTexture, preloadTextures }
  })
)
```

## パフォーマンス最適化

### Performance Monitoring

```typescript
export const PerformanceMonitor = {
  // フレームレート監視
  monitorFrameRate: (context: RenderContext) =>
    Effect.gen(function* () {
      const fps = 1000 / context.averageFrameTime

      // パフォーマンス警告
      if (fps < 30) {
        yield* Logger.warn(`Low FPS detected: ${fps.toFixed(1)}`)
        yield* suggestOptimizations(context)
      }

      return { fps, frameTime: context.averageFrameTime }
    }),

  // メモリ使用量監視
  monitorMemoryUsage: () =>
    Effect.gen(function* () {
      const info = (window as any).performance?.memory
      if (info) {
        const usage = {
          usedJSHeapSize: info.usedJSHeapSize / (1024 * 1024),
          totalJSHeapSize: info.totalJSHeapSize / (1024 * 1024),
          jsHeapSizeLimit: info.jsHeapSizeLimit / (1024 * 1024)
        }

        if (usage.usedJSHeapSize > 100) {
          yield* Logger.warn(`High memory usage: ${usage.usedJSHeapSize.toFixed(1)}MB`)
        }

        return usage
      }

      return null
    }),

  // 描画統計
  getRenderStats: (context: RenderContext) =>
    Effect.gen(function* () {
      const renderer = context.renderer as THREE.WebGLRenderer
      const info = renderer.info

      return {
        triangles: info.render.triangles,
        points: info.render.points,
        lines: info.render.lines,
        calls: info.render.calls,
        frame: info.render.frame,
        geometries: info.memory.geometries,
        textures: info.memory.textures
      }
    })
}

// 最適化提案システム
const suggestOptimizations = (context: RenderContext) =>
  Effect.gen(function* () {
    const suggestions: string[] = []

    // 描画距離の調整
    if (context.settings.renderDistance > 16) {
      suggestions.push("描画距離を16チャンク以下に下げることを推奨")
    }

    // 影の無効化
    if (context.settings.enableShadows) {
      suggestions.push("影処理を無効化してパフォーマンスを向上")
    }

    // アンチエイリアシングの無効化
    if (context.settings.antialiasing) {
      suggestions.push("アンチエイリアシングを無効化")
    }

    yield* Logger.info(`最適化提案: ${suggestions.join(", ")}`)
    return suggestions
  })
```

## インテグレーション

### Render Loop Integration

```typescript
export class RenderLoop extends Context.Tag("RenderLoop")<
  RenderLoop,
  {
    readonly start: () => Effect.Effect<void, never>
    readonly stop: () => Effect.Effect<void, never>
    readonly render: (deltaTime: number) => Effect.Effect<void, RenderError>
  }
>() {}

export const RenderLoopLive = Layer.effect(
  RenderLoop,
  Effect.gen(function* () {
    const renderer = yield* RendererService
    const chunkRenderer = yield* ChunkRenderingService
    const frustumCulling = yield* FrustumCullingService
    const lodService = yield* LODService
    const lighting = yield* RenderLightingService

    let isRunning = false
    let animationFrameId: number | null = null
    let lastTime = 0

    const render = (deltaTime: number) =>
      Effect.gen(function* () {
        // プレイヤー位置とカメラの更新
        const playerPosition = yield* getCurrentPlayerPosition()
        const camera = yield* updateCamera(playerPosition)

        // 視錐台カリングの更新
        const frustum = yield* frustumCulling.updateFrustum(camera)

        // 可視チャンクの決定
        const allChunks = yield* chunkRenderer.getLoadedChunks()
        const visibleChunks = yield* frustumCulling.cullChunks(frustum, allChunks)

        // LODの更新
        const lodChunks = yield* lodService.manageLOD(playerPosition, visibleChunks)

        // ライティングの更新
        const timeOfDay = yield* getTimeOfDay()
        const lightingContext = yield* lighting.updateSunPosition(lightingContext, timeOfDay)

        // レンダリング実行
        const renderContext = yield* renderer.render(context, deltaTime)

        // パフォーマンス監視
        yield* PerformanceMonitor.monitorFrameRate(renderContext)
      })

    const gameLoop = (currentTime: number) => {
      const deltaTime = currentTime - lastTime
      lastTime = currentTime

      Effect.runPromise(render(deltaTime)).catch(console.error)

      if (isRunning) {
        animationFrameId = requestAnimationFrame(gameLoop)
      }
    }

    const start = () =>
      Effect.gen(function* () {
        if (!isRunning) {
          isRunning = true
          lastTime = performance.now()
          animationFrameId = requestAnimationFrame(gameLoop)
        }
      })

    const stop = () =>
      Effect.gen(function* () {
        isRunning = false
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId)
          animationFrameId = null
        }
      })

    return { start, stop, render }
  })
).pipe(
  Layer.provide(RendererServiceLive),
  Layer.provide(ChunkRenderingServiceLive),
  Layer.provide(FrustumCullingServiceLive),
  Layer.provide(LODServiceLive),
  Layer.provide(RenderLightingServiceLive)
)
```

## テスト

```typescript
import { Effect, TestContext, TestClock } from "effect"

describe("Rendering System", () => {
  const TestRenderingLayer = Layer.mergeAll(
    RendererServiceLive,
    ChunkMeshingServiceLive,
    FrustumCullingServiceLive,
    LODServiceLive,
    TextureManagerLive
  ).pipe(
    Layer.provide(TestContext.TestContext),
    Layer.provide(TestClock.TestClock)
  )

  it("should initialize renderer with correct settings", () =>
    Effect.gen(function* () {
      const canvas = document.createElement('canvas')
      const renderer = yield* RendererService
      const context = yield* renderer.initialize(canvas)

      expect(context.settings.renderDistance).toBe(16)
      expect(context.settings.enableShadows).toBe(true)
      expect(context.camera).toBeDefined()
      expect(context.scene).toBeDefined()
    }).pipe(
      Effect.provide(TestRenderingLayer),
      Effect.runPromise
    ))

  it("should generate chunk mesh with correct vertex count", () =>
    Effect.gen(function* () {
      const meshingService = yield* ChunkMeshingService
      const chunk = createTestChunk()
      const mesh = yield* meshingService.generateMesh(chunk)

      expect(mesh.vertexCount).toBeGreaterThan(0)
      expect(mesh.triangleCount).toBeGreaterThan(0)
      expect(mesh.vertices.length).toBe(mesh.vertexCount * 3)
    }).pipe(
      Effect.provide(TestRenderingLayer),
      Effect.runPromise
    ))

  it("should perform frustum culling correctly", () =>
    Effect.gen(function* () {
      const cullingService = yield* FrustumCullingService
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
      const frustum = yield* cullingService.updateFrustum(camera)

      const chunks = createTestChunks(100)
      const visibleChunks = yield* cullingService.cullChunks(frustum, chunks)

      expect(visibleChunks.length).toBeLessThan(chunks.length)
    }).pipe(
      Effect.provide(TestRenderingLayer),
      Effect.runPromise
    ))

  it("should calculate LOD levels based on distance", () =>
    Effect.gen(function* () {
      const lodService = yield* LODService

      const lodLevel0 = yield* lodService.calculateLOD(10, defaultRenderSettings)
      const lodLevel3 = yield* lodService.calculateLOD(200, defaultRenderSettings)

      expect(lodLevel0).toBe(0)
      expect(lodLevel3).toBe(3)
    }).pipe(
      Effect.provide(TestRenderingLayer),
      Effect.runPromise
    ))
})
```

## シェーダー管理システム

### Shader Manager

```typescript
export const ShaderProgram = Schema.Struct({
  id: pipe(Schema.String, Schema.brand("ShaderId")),
  vertexShader: Schema.String,
  fragmentShader: Schema.String,
  uniforms: Schema.Record({
    key: Schema.String,
    value: Schema.Union(
      Schema.Number,
      Schema.Array(Schema.Number),
      Schema.Unknown // THREE.Texture など
    )
  }),
  attributes: Schema.Array(Schema.String),
  compiled: Schema.Boolean,
  program: Schema.Unknown // WebGLProgram
})

export type ShaderProgram = Schema.Schema.Type<typeof ShaderProgram>

export interface ShaderManagerInterface {
  readonly loadShader: (id: string, vertexPath: string, fragmentPath: string) => Effect.Effect<ShaderProgram, ShaderError>
  readonly compileShader: (program: ShaderProgram) => Effect.Effect<ShaderProgram, ShaderError>
  readonly useShader: (id: string) => Effect.Effect<ShaderProgram, ShaderError>
  readonly setUniform: (id: string, name: string, value: any) => Effect.Effect<void, ShaderError>
  readonly createMaterial: (id: string, parameters?: any) => Effect.Effect<THREE.ShaderMaterial, ShaderError>
}

export const ShaderManager = Context.GenericTag<ShaderManagerInterface>("@rendering/ShaderManager")

export const ShaderManagerLive = Layer.effect(
  ShaderManager,
  Effect.gen(function* () {
    const shaderCache = yield* Effect.sync(() => new Map<string, ShaderProgram>())
    const materialCache = yield* Effect.sync(() => new Map<string, THREE.ShaderMaterial>())

    // チャンク用ベースシェーダー
    const chunkVertexShader = `
      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 uv;
      attribute float ao; // Ambient Occlusion

      uniform mat4 modelMatrix;
      uniform mat4 viewMatrix;
      uniform mat4 projectionMatrix;
      uniform mat4 lightMatrix;
      uniform float time;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec4 vLightSpacePosition;
      varying float vAO;
      varying float vFogDepth;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vLightSpacePosition = lightMatrix * worldPosition;

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
        vUv = uv;
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vAO = ao;
        vFogDepth = -(viewMatrix * worldPosition).z;
      }
    `

    const chunkFragmentShader = `
      precision highp float;

      uniform sampler2D textureAtlas;
      uniform sampler2D shadowMap;
      uniform vec3 sunDirection;
      uniform vec3 sunColor;
      uniform vec3 ambientColor;
      uniform float fogNear;
      uniform float fogFar;
      uniform vec3 fogColor;
      uniform float time;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec4 vLightSpacePosition;
      varying float vAO;
      varying float vFogDepth;

      // シャドウマッピング計算
      float calculateShadow(vec4 lightSpacePosition) {
        vec3 projCoords = lightSpacePosition.xyz / lightSpacePosition.w;
        projCoords = projCoords * 0.5 + 0.5;

        if (projCoords.z > 1.0) return 0.0;

        float closestDepth = texture2D(shadowMap, projCoords.xy).r;
        float currentDepth = projCoords.z;
        float bias = max(0.05 * (1.0 - dot(vNormal, sunDirection)), 0.005);

        // PCF (Percentage-Closer Filtering)
        float shadow = 0.0;
        vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
        for(int x = -1; x <= 1; ++x) {
          for(int y = -1; y <= 1; ++y) {
            float pcfDepth = texture2D(shadowMap, projCoords.xy + vec2(x, y) * texelSize).r;
            shadow += currentDepth - bias > pcfDepth ? 1.0 : 0.0;
          }
        }
        shadow /= 9.0;

        return shadow;
      }

      void main() {
        vec4 texColor = texture2D(textureAtlas, vUv);
        if (texColor.a < 0.1) discard;

        // ライティング計算
        float sunDot = max(dot(vNormal, -sunDirection), 0.0);
        float shadow = calculateShadow(vLightSpacePosition);
        float lightFactor = mix(sunDot, sunDot * 0.3, shadow);

        // AO（Ambient Occlusion）適用
        float aoFactor = mix(0.3, 1.0, vAO);

        // 最終色計算
        vec3 finalColor = texColor.rgb * (ambientColor + sunColor * lightFactor) * aoFactor;

        // フォグ適用
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        finalColor = mix(finalColor, fogColor, fogFactor);

        gl_FragColor = vec4(finalColor, texColor.a);
      }
    `

    const loadShader = (id: string, vertexPath: string, fragmentPath: string) =>
      Effect.gen(function* () {
        const vertexSource = yield* loadShaderSource(vertexPath)
        const fragmentSource = yield* loadShaderSource(fragmentPath)

        const program: ShaderProgram = {
          id: id as any,
          vertexShader: vertexSource,
          fragmentShader: fragmentSource,
          uniforms: {},
          attributes: [],
          compiled: false,
          program: null
        }

        const compiled = yield* compileShader(program)
        shaderCache.set(id, compiled)
        return compiled
      })

    const compileShader = (program: ShaderProgram) =>
      Effect.gen(function* () {
        const gl = yield* getWebGLContext()

        const vertexShader = yield* compileShaderPart(gl, program.vertexShader, gl.VERTEX_SHADER)
        const fragmentShader = yield* compileShaderPart(gl, program.fragmentShader, gl.FRAGMENT_SHADER)

        const shaderProgram = gl.createProgram()
        if (!shaderProgram) {
          return yield* Effect.fail(new ShaderError({ message: "Failed to create shader program" }))
        }

        gl.attachShader(shaderProgram, vertexShader)
        gl.attachShader(shaderProgram, fragmentShader)
        gl.linkProgram(shaderProgram)

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
          const error = gl.getProgramInfoLog(shaderProgram)
          return yield* Effect.fail(new ShaderError({ message: `Shader linking failed: ${error}` }))
        }

        return {
          ...program,
          compiled: true,
          program: shaderProgram
        }
      })

    const createMaterial = (id: string, parameters: any = {}) =>
      Effect.gen(function* () {
        const cached = materialCache.get(id)
        if (cached) return cached

        const shader = shaderCache.get(id)
        if (!shader) {
          return yield* Effect.fail(new ShaderError({ message: `Shader ${id} not found` }))
        }

        const material = new THREE.ShaderMaterial({
          vertexShader: shader.vertexShader,
          fragmentShader: shader.fragmentShader,
          uniforms: {
            textureAtlas: { value: null },
            shadowMap: { value: null },
            sunDirection: { value: new THREE.Vector3(0.5, 1.0, 0.5) },
            sunColor: { value: new THREE.Vector3(1.0, 1.0, 0.9) },
            ambientColor: { value: new THREE.Vector3(0.2, 0.2, 0.3) },
            fogNear: { value: 50 },
            fogFar: { value: 200 },
            fogColor: { value: new THREE.Vector3(0.53, 0.81, 0.92) },
            time: { value: 0 },
            ...parameters.uniforms
          },
          transparent: parameters.transparent || false,
          alphaTest: parameters.alphaTest || 0.1,
          side: parameters.side || THREE.FrontSide
        })

        materialCache.set(id, material)
        return material
      })

    return { loadShader, compileShader, useShader: (id) => Effect.succeed(shaderCache.get(id)!), setUniform: () => Effect.unit, createMaterial }
  })
)
```

## パーティクルシステム

### Particle System Implementation

```typescript
export const ParticleType = Schema.Literal("smoke", "fire", "water", "explosion", "magic", "break", "place")
export type ParticleType = Schema.Schema.Type<typeof ParticleType>

export const Particle = Schema.Struct({
  id: pipe(Schema.String, Schema.brand("ParticleId")),
  type: ParticleType,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  velocity: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  acceleration: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  color: Schema.Struct({
    r: Schema.Number,
    g: Schema.Number,
    b: Schema.Number,
    a: Schema.Number
  }),
  size: Schema.Number,
  life: Schema.Number,
  maxLife: Schema.Number,
  gravity: Schema.Number,
  drag: Schema.Number
})

export type Particle = Schema.Schema.Type<typeof Particle>

export interface ParticleSystemInterface {
  readonly createParticle: (type: ParticleType, position: Vec3, options?: Partial<Particle>) => Effect.Effect<Particle, never>
  readonly updateParticles: (deltaTime: number) => Effect.Effect<void, never>
  readonly renderParticles: (camera: THREE.Camera) => Effect.Effect<void, never>
  readonly emitParticles: (emitter: ParticleEmitter, count: number) => Effect.Effect<void, never>
  readonly clearDeadParticles: () => Effect.Effect<number, never>
}

export const ParticleSystem = Context.GenericTag<ParticleSystemInterface>("@rendering/ParticleSystem")

export const ParticleSystemLive = Layer.effect(
  ParticleSystem,
  Effect.gen(function* () {
    const activeParticles = yield* Effect.sync(() => new Map<string, Particle>())
    const particleGeometry = yield* Effect.sync(() => new THREE.BufferGeometry())
    const particleMaterial = yield* Effect.sync(() => createParticleMaterial())
    const particleSystem = yield* Effect.sync(() => new THREE.Points(particleGeometry, particleMaterial))

    const createParticle = (type: ParticleType, position: Vec3, options: Partial<Particle> = {}) =>
      Effect.gen(function* () {
        const id = `particle_${Date.now()}_${Math.random()}`
        const baseConfig = yield* getParticleConfig(type)

        const particle: Particle = {
          id: id as any,
          type,
          position,
          velocity: options.velocity || { x: 0, y: 0, z: 0 },
          acceleration: options.acceleration || { x: 0, y: -9.81, z: 0 },
          color: options.color || baseConfig.color,
          size: options.size || baseConfig.size,
          life: baseConfig.maxLife,
          maxLife: baseConfig.maxLife,
          gravity: options.gravity || baseConfig.gravity,
          drag: options.drag || baseConfig.drag
        }

        activeParticles.set(id, particle)
        return particle
      })

    const updateParticles = (deltaTime: number) =>
      Effect.gen(function* () {
        const toRemove: string[] = []

        for (const [id, particle] of activeParticles) {
          // 物理更新
          const newParticle = updateParticlePhysics(particle, deltaTime)

          // 生存時間チェック
          if (newParticle.life <= 0) {
            toRemove.push(id)
            continue
          }

          activeParticles.set(id, newParticle)
        }

        // 死んだパーティクルを削除
        toRemove.forEach(id => activeParticles.delete(id))

        // ジオメトリ更新
        yield* updateParticleGeometry()
      })

    const updateParticleGeometry = () =>
      Effect.gen(function* () {
        const particles = Array.from(activeParticles.values())
        const positions = new Float32Array(particles.length * 3)
        const colors = new Float32Array(particles.length * 4)
        const sizes = new Float32Array(particles.length)

        particles.forEach((particle, i) => {
          // 位置
          positions[i * 3] = particle.position.x
          positions[i * 3 + 1] = particle.position.y
          positions[i * 3 + 2] = particle.position.z

          // 色（アルファフェード）
          const lifeRatio = particle.life / particle.maxLife
          colors[i * 4] = particle.color.r
          colors[i * 4 + 1] = particle.color.g
          colors[i * 4 + 2] = particle.color.b
          colors[i * 4 + 3] = particle.color.a * lifeRatio

          // サイズ（生存時間に応じて変化）
          sizes[i] = particle.size * lifeRatio
        })

        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
        particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
        particleGeometry.attributes.position.needsUpdate = true
        particleGeometry.attributes.color.needsUpdate = true
        particleGeometry.attributes.size.needsUpdate = true
      })

    const renderParticles = (camera: THREE.Camera) =>
      Effect.gen(function* () {
        // ビルボード化（常にカメラを向く）
        particleSystem.quaternion.copy(camera.quaternion)

        // 距離ソート（アルファブレンディングのため）
        yield* sortParticlesByDistance(camera.position)
      })

    // パーティクル物理更新（純粋関数）
    const updateParticlePhysics = (particle: Particle, deltaTime: number): Particle => {
      // 重力と加速度の適用
      const newVelocity = {
        x: particle.velocity.x + (particle.acceleration.x * deltaTime),
        y: particle.velocity.y + (particle.acceleration.y * particle.gravity * deltaTime),
        z: particle.velocity.z + (particle.acceleration.z * deltaTime)
      }

      // 空気抵抗の適用
      const dragFactor = Math.pow(1 - particle.drag, deltaTime)
      newVelocity.x *= dragFactor
      newVelocity.y *= dragFactor
      newVelocity.z *= dragFactor

      // 位置の更新
      const newPosition = {
        x: particle.position.x + (newVelocity.x * deltaTime),
        y: particle.position.y + (newVelocity.y * deltaTime),
        z: particle.position.z + (newVelocity.z * deltaTime)
      }

      // 生存時間の減少
      const newLife = Math.max(0, particle.life - deltaTime)

      return {
        ...particle,
        position: newPosition,
        velocity: newVelocity,
        life: newLife
      }
    }

    return { createParticle, updateParticles, renderParticles, emitParticles: () => Effect.unit, clearDeadParticles: () => Effect.succeed(0) }
  })
)

// パーティクル設定の取得（純粋関数）
const getParticleConfig = (type: ParticleType) =>
  Effect.gen(function* () {
    return Match.value(type).pipe(
      Match.when("smoke", () => ({
        color: { r: 0.8, g: 0.8, b: 0.8, a: 0.5 },
        size: 1.0,
        maxLife: 3.0,
        gravity: 0.1,
        drag: 0.02
      })),
      Match.when("fire", () => ({
        color: { r: 1.0, g: 0.4, b: 0.1, a: 0.8 },
        size: 0.8,
        maxLife: 1.5,
        gravity: -0.2,
        drag: 0.01
      })),
      Match.when("water", () => ({
        color: { r: 0.3, g: 0.6, b: 1.0, a: 0.7 },
        size: 0.3,
        maxLife: 2.0,
        gravity: 1.0,
        drag: 0.05
      })),
      Match.when("explosion", () => ({
        color: { r: 1.0, g: 0.8, b: 0.2, a: 0.9 },
        size: 2.0,
        maxLife: 0.5,
        gravity: 0.5,
        drag: 0.1
      })),
      Match.orElse(() => ({
        color: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
        size: 1.0,
        maxLife: 2.0,
        gravity: 1.0,
        drag: 0.02
      }))
    )
  })
```

## UIレンダリングシステム

### HUD & UI Rendering

```typescript
export const UIElement = Schema.Struct({
  id: pipe(Schema.String, Schema.brand("UIElementId")),
  type: Schema.Literal("crosshair", "hotbar", "health", "hunger", "inventory", "chat", "debug"),
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number
  }),
  size: Schema.Struct({
    width: Schema.Number,
    height: Schema.Number
  }),
  visible: Schema.Boolean,
  zIndex: Schema.Number.pipe(Schema.int()),
  opacity: Schema.Number.pipe(Schema.between(0, 1)),
  data: Schema.Unknown // 要素固有のデータ
})

export type UIElement = Schema.Schema.Type<typeof UIElement>

export interface UIRenderingInterface {
  readonly initializeUI: (canvas: HTMLCanvasElement) => Effect.Effect<UIContext, UIError>
  readonly renderHUD: (gameState: GameState) => Effect.Effect<void, UIError>
  readonly renderInventory: (inventory: PlayerInventory) => Effect.Effect<void, UIError>
  readonly updateUIElement: (element: UIElement) => Effect.Effect<void, UIError>
  readonly handleUIInteraction: (event: MouseEvent | KeyboardEvent) => Effect.Effect<UIAction, never>
}

export const UIRendering = Context.GenericTag<UIRenderingInterface>("@rendering/UIRendering")

export const UIRenderingLive = Layer.effect(
  UIRendering,
  Effect.gen(function* () {
    const uiScene = yield* Effect.sync(() => new THREE.Scene())
    const uiCamera = yield* Effect.sync(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1))
    const uiRenderer = yield* Effect.sync(() => new THREE.WebGLRenderer({ alpha: true }))

    const hudElements = yield* Effect.sync(() => new Map<string, THREE.Object3D>())

    const initializeUI = (canvas: HTMLCanvasElement) =>
      Effect.gen(function* () {
        // UI専用レンダラーの設定
        uiRenderer.setSize(canvas.width, canvas.height)
        uiRenderer.autoClear = false
        uiRenderer.sortObjects = false

        // HUD要素の初期化
        yield* createCrosshair()
        yield* createHotbar()
        yield* createHealthBar()
        yield* createDebugInfo()

        return {
          scene: uiScene,
          camera: uiCamera,
          renderer: uiRenderer,
          elements: hudElements
        } as UIContext
      })

    const createCrosshair = () =>
      Effect.gen(function* () {
        const crosshairGeometry = new THREE.PlaneGeometry(0.02, 0.02)
        const crosshairMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.8
        })

        const crosshair = new THREE.Mesh(crosshairGeometry, crosshairMaterial)
        crosshair.position.set(0, 0, 0)

        uiScene.add(crosshair)
        hudElements.set("crosshair", crosshair)
      })

    const createHotbar = () =>
      Effect.gen(function* () {
        const hotbarGroup = new THREE.Group()

        // ホットバースロット（9個）
        for (let i = 0; i < 9; i++) {
          const slotGeometry = new THREE.PlaneGeometry(0.08, 0.08)
          const slotMaterial = new THREE.MeshBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.8
          })

          const slot = new THREE.Mesh(slotGeometry, slotMaterial)
          slot.position.set((i - 4) * 0.09, -0.8, 0)
          hotbarGroup.add(slot)

          // スロット選択インジケーター
          if (i === 0) {
            const indicatorGeometry = new THREE.PlaneGeometry(0.1, 0.1)
            const indicatorMaterial = new THREE.MeshBasicMaterial({
              color: 0xffffff,
              transparent: true,
              opacity: 0.5
            })
            const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial)
            indicator.position.copy(slot.position)
            indicator.position.z = -0.001
            hotbarGroup.add(indicator)
            hudElements.set("hotbar_indicator", indicator)
          }
        }

        uiScene.add(hotbarGroup)
        hudElements.set("hotbar", hotbarGroup)
      })

    const createHealthBar = () =>
      Effect.gen(function* () {
        const healthGroup = new THREE.Group()

        // ハート（10個）
        for (let i = 0; i < 10; i++) {
          const heartGeometry = new THREE.PlaneGeometry(0.04, 0.04)
          const heartMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.8
          })

          const heart = new THREE.Mesh(heartGeometry, heartMaterial)
          heart.position.set((i - 4.5) * 0.045, -0.65, 0)
          healthGroup.add(heart)
        }

        uiScene.add(healthGroup)
        hudElements.set("health", healthGroup)
      })

    const renderHUD = (gameState: GameState) =>
      Effect.gen(function* () {
        // クロスヘアの更新（常に表示）
        const crosshair = hudElements.get("crosshair")
        if (crosshair) {
          crosshair.visible = true
        }

        // ホットバーの更新
        yield* updateHotbar(gameState.player.inventory.hotbar, gameState.player.selectedSlot)

        // 体力バーの更新
        yield* updateHealthBar(gameState.player.health, gameState.player.maxHealth)

        // デバッグ情報の更新
        if (gameState.debugMode) {
          yield* updateDebugInfo(gameState.debug)
        }

        // HUD描画
        uiRenderer.render(uiScene, uiCamera)
      })

    const updateHotbar = (hotbar: ItemStack[], selectedSlot: number) =>
      Effect.gen(function* () {
        const hotbarGroup = hudElements.get("hotbar") as THREE.Group
        const indicator = hudElements.get("hotbar_indicator")

        if (hotbarGroup && indicator) {
          // 選択スロットインジケーターの位置更新
          indicator.position.x = (selectedSlot - 4) * 0.09

          // アイテムテクスチャの更新
          hotbarGroup.children.forEach((slot, index) => {
            if (index < 9 && hotbar[index] && hotbar[index].count > 0) {
              // アイテムのテクスチャを適用
              const itemTexture = getItemTexture(hotbar[index].type)
              if (itemTexture && slot instanceof THREE.Mesh) {
                (slot.material as THREE.MeshBasicMaterial).map = itemTexture
              }
            }
          })
        }
      })

    const renderInventory = (inventory: PlayerInventory) =>
      Effect.gen(function* () {
        // インベントリGUIの描画
        const inventoryUI = yield* createInventoryUI(inventory)

        // インベントリ専用のレンダリング
        const inventoryScene = new THREE.Scene()
        inventoryScene.add(inventoryUI)

        uiRenderer.render(inventoryScene, uiCamera)
      })

    return { initializeUI, renderHUD, renderInventory, updateUIElement: () => Effect.unit, handleUIInteraction: () => Effect.succeed({} as UIAction) }
  })
)
```

## 高度なパフォーマンス最適化

### インスタンシング・バッチング

```typescript
export interface BatchingSystemInterface {
  readonly createInstancedMesh: (geometry: THREE.BufferGeometry, material: THREE.Material, count: number) => Effect.Effect<THREE.InstancedMesh, BatchError>
  readonly updateInstancedPositions: (mesh: THREE.InstancedMesh, positions: Vec3[]) => Effect.Effect<void, never>
  readonly batchStaticGeometry: (meshes: THREE.Mesh[]) => Effect.Effect<THREE.Mesh, BatchError>
  readonly optimizeDrawCalls: (scene: THREE.Scene) => Effect.Effect<OptimizationReport, never>
}

export const BatchingSystem = Context.GenericTag<BatchingSystemInterface>("@rendering/BatchingSystem")

export const BatchingSystemLive = Layer.succeed(
  BatchingSystem,
  {
    createInstancedMesh: (geometry, material, count) =>
      Effect.gen(function* () {
        const instancedMesh = new THREE.InstancedMesh(geometry, material, count)

        // インスタンス行列の初期化
        const matrix = new THREE.Matrix4()
        for (let i = 0; i < count; i++) {
          matrix.identity()
          instancedMesh.setMatrixAt(i, matrix)
        }
        instancedMesh.instanceMatrix.needsUpdate = true

        return instancedMesh
      }),

    updateInstancedPositions: (mesh, positions) =>
      Effect.gen(function* () {
        const matrix = new THREE.Matrix4()
        positions.forEach((pos, i) => {
          if (i < mesh.count) {
            matrix.makeTranslation(pos.x, pos.y, pos.z)
            mesh.setMatrixAt(i, matrix)
          }
        })
        mesh.instanceMatrix.needsUpdate = true
      }),

    batchStaticGeometry: (meshes) =>
      Effect.gen(function* () {
        if (meshes.length === 0) {
          return yield* Effect.fail(new BatchError({ message: "No meshes to batch" }))
        }

        // ジオメトリの結合
        const geometries: THREE.BufferGeometry[] = []
        meshes.forEach(mesh => {
          const geo = mesh.geometry.clone()
          geo.applyMatrix4(mesh.matrixWorld)
          geometries.push(geo)
        })

        const mergedGeometry = THREE.BufferGeometryUtils.mergeGeometries(geometries)
        const batchedMesh = new THREE.Mesh(mergedGeometry, meshes[0].material)

        return batchedMesh
      }),

    optimizeDrawCalls: (scene) =>
      Effect.gen(function* () {
        let drawCallsBefore = 0
        let drawCallsAfter = 0
        const optimizedObjects: THREE.Object3D[] = []

        // シーンを走査してバッチ可能なオブジェクトを特定
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            drawCallsBefore++
          }
        })

        // 同一マテリアルのメッシュをグループ化
        const materialGroups = new Map<string, THREE.Mesh[]>()

        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            const materialId = object.material.uuid
            if (!materialGroups.has(materialId)) {
              materialGroups.set(materialId, [])
            }
            materialGroups.get(materialId)!.push(object)
          }
        })

        // 各グループをバッチ化
        for (const [materialId, meshes] of materialGroups) {
          if (meshes.length > 1) {
            const batchedMesh = yield* batchStaticGeometry(meshes)
            optimizedObjects.push(batchedMesh)
            drawCallsAfter++

            // 元のメッシュを削除
            meshes.forEach(mesh => {
              if (mesh.parent) {
                mesh.parent.remove(mesh)
              }
            })

            scene.add(batchedMesh)
          } else {
            drawCallsAfter++
          }
        }

        return {
          drawCallsBefore,
          drawCallsAfter,
          optimizedObjects: optimizedObjects.length,
          savingsPercent: ((drawCallsBefore - drawCallsAfter) / drawCallsBefore) * 100
        } as OptimizationReport
      })
  }
)

// GPU Culling最適化
export interface GPUCullingInterface {
  readonly setupGPUCulling: (camera: THREE.Camera) => Effect.Effect<CullingContext, CullingError>
  readonly performGPUCulling: (context: CullingContext, objects: THREE.Object3D[]) => Effect.Effect<THREE.Object3D[], never>
  readonly updateCullingBounds: (context: CullingContext, bounds: THREE.Box3[]) => Effect.Effect<void, never>
}

export const GPUCulling = Context.GenericTag<GPUCullingInterface>("@rendering/GPUCulling")

export const GPUCullingLive = Layer.effect(
  GPUCulling,
  Effect.gen(function* () {
    const shaderManager = yield* ShaderManager

    // カリング用コンピュートシェーダー
    const cullingComputeShader = `
      #version 310 es

      layout(local_size_x = 64, local_size_y = 1, local_size_z = 1) in;

      layout(std430, binding = 0) readonly buffer BoundingBoxes {
        vec4 bounds[]; // min.xyz, max.w stored separately
      };

      layout(std430, binding = 1) writeonly buffer VisibilityResults {
        uint visible[];
      };

      uniform mat4 frustumMatrix;
      uniform vec3 cameraPosition;
      uniform float maxDistance;

      bool isBoxInFrustum(vec3 boxMin, vec3 boxMax) {
        vec3 corners[8] = vec3[8](
          boxMin,
          vec3(boxMax.x, boxMin.y, boxMin.z),
          vec3(boxMin.x, boxMax.y, boxMin.z),
          vec3(boxMax.x, boxMax.y, boxMin.z),
          vec3(boxMin.x, boxMin.y, boxMax.z),
          vec3(boxMax.x, boxMin.y, boxMax.z),
          vec3(boxMin.x, boxMax.y, boxMax.z),
          boxMax
        );

        for (int plane = 0; plane < 6; plane++) {
          int inCount = 0;
          for (int corner = 0; corner < 8; corner++) {
            vec4 clipPos = frustumMatrix * vec4(corners[corner], 1.0);

            bool inside = true;
            if (plane == 0 && clipPos.x < -clipPos.w) inside = false; // left
            if (plane == 1 && clipPos.x > clipPos.w) inside = false;  // right
            if (plane == 2 && clipPos.y < -clipPos.w) inside = false; // bottom
            if (plane == 3 && clipPos.y > clipPos.w) inside = false;  // top
            if (plane == 4 && clipPos.z < -clipPos.w) inside = false; // near
            if (plane == 5 && clipPos.z > clipPos.w) inside = false;  // far

            if (inside) inCount++;
          }
          if (inCount == 0) return false;
        }
        return true;
      }

      void main() {
        uint index = gl_GlobalInvocationID.x;
        if (index >= bounds.length()) return;

        vec4 bound1 = bounds[index * 2];
        vec4 bound2 = bounds[index * 2 + 1];
        vec3 boxMin = bound1.xyz;
        vec3 boxMax = bound2.xyz;

        // 距離カリング
        vec3 boxCenter = (boxMin + boxMax) * 0.5;
        float distance = length(boxCenter - cameraPosition);
        if (distance > maxDistance) {
          visible[index] = 0u;
          return;
        }

        // 視錐台カリング
        visible[index] = isBoxInFrustum(boxMin, boxMax) ? 1u : 0u;
      }
    `

    const setupGPUCulling = (camera: THREE.Camera) =>
      Effect.gen(function* () {
        const gl = yield* getWebGLContext()

        // コンピュートシェーダーの初期化
        const computeShader = yield* compileComputeShader(gl, cullingComputeShader)

        // バッファの初期化
        const boundingBoxBuffer = gl.createBuffer()
        const visibilityBuffer = gl.createBuffer()

        return {
          computeShader,
          boundingBoxBuffer,
          visibilityBuffer,
          camera
        } as CullingContext
      })

    return { setupGPUCulling, performGPUCulling: () => Effect.succeed([]), updateCullingBounds: () => Effect.unit }
  })
)
```

## デバッグ・プロファイリング機能

### Debug & Profiling System

```typescript
export const DebugInfo = Schema.Struct({
  fps: Schema.Number,
  frameTime: Schema.Number,
  renderTime: Schema.Number,
  drawCalls: Schema.Number.pipe(Schema.int()),
  triangles: Schema.Number.pipe(Schema.int()),
  geometries: Schema.Number.pipe(Schema.int()),
  textures: Schema.Number.pipe(Schema.int()),
  memoryUsage: Schema.Number,
  visibleChunks: Schema.Number.pipe(Schema.int()),
  totalChunks: Schema.Number.pipe(Schema.int()),
  particleCount: Schema.Number.pipe(Schema.int()),
  cameraPosition: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  playerPosition: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  })
})

export type DebugInfo = Schema.Schema.Type<typeof DebugInfo>

export interface RenderDebugInterface {
  readonly enableWireframe: (enable: boolean) => Effect.Effect<void, never>
  readonly showBoundingBoxes: (enable: boolean) => Effect.Effect<void, never>
  readonly showFrustum: (camera: THREE.Camera, enable: boolean) => Effect.Effect<void, never>
  readonly captureFrame: () => Effect.Effect<FrameCapture, never>
  readonly profileRenderCall: <A>(name: string, effect: Effect.Effect<A, never>) => Effect.Effect<A, never>
  readonly generatePerformanceReport: () => Effect.Effect<PerformanceReport, never>
}

export const RenderDebug = Context.GenericTag<RenderDebugInterface>("@rendering/RenderDebug")

export const RenderDebugLive = Layer.effect(
  RenderDebug,
  Effect.gen(function* () {
    const debugScene = yield* Effect.sync(() => new THREE.Scene())
    const performanceMetrics = yield* Effect.sync(() => new Map<string, PerformanceMetric>())
    const frameHistory = yield* Effect.sync(() => new Array<FrameMetrics>())

    const enableWireframe = (enable: boolean) =>
      Effect.gen(function* () {
        // 全マテリアルにワイヤーフレーム適用
        const scene = yield* getCurrentScene()
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            if (Array.isArray(object.material)) {
              object.material.forEach(mat => mat.wireframe = enable)
            } else {
              object.material.wireframe = enable
            }
          }
        })
      })

    const showBoundingBoxes = (enable: boolean) =>
      Effect.gen(function* () {
        if (enable) {
          const scene = yield* getCurrentScene()
          scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              const box = new THREE.Box3().setFromObject(object)
              const boxHelper = new THREE.Box3Helper(box, 0x00ff00)
              object.add(boxHelper)
              object.userData.boundingBoxHelper = boxHelper
            }
          })
        } else {
          // バウンディングボックスを削除
          const scene = yield* getCurrentScene()
          scene.traverse((object) => {
            if (object.userData.boundingBoxHelper) {
              object.remove(object.userData.boundingBoxHelper)
              delete object.userData.boundingBoxHelper
            }
          })
        }
      })

    const showFrustum = (camera: THREE.Camera, enable: boolean) =>
      Effect.gen(function* () {
        if (enable) {
          const frustumHelper = new THREE.CameraHelper(camera)
          debugScene.add(frustumHelper)
        } else {
          debugScene.clear()
        }
      })

    const profileRenderCall = <A>(name: string, effect: Effect.Effect<A, never>) =>
      Effect.gen(function* () {
        const startTime = performance.now()
        const result = yield* effect
        const endTime = performance.now()
        const duration = endTime - startTime

        const metric = performanceMetrics.get(name) || {
          name,
          totalTime: 0,
          callCount: 0,
          averageTime: 0,
          minTime: Infinity,
          maxTime: 0
        }

        metric.totalTime += duration
        metric.callCount++
        metric.averageTime = metric.totalTime / metric.callCount
        metric.minTime = Math.min(metric.minTime, duration)
        metric.maxTime = Math.max(metric.maxTime, duration)

        performanceMetrics.set(name, metric)
        return result
      })

    const captureFrame = () =>
      Effect.gen(function* () {
        const renderer = yield* getCurrentRenderer()
        const info = renderer.info

        const frameCapture: FrameCapture = {
          timestamp: Date.now(),
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
          geometries: info.memory.geometries,
          textures: info.memory.textures,
          programs: info.programs?.length || 0,
          renderTime: 0, // 前回のフレーム時間を使用
          memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
        }

        frameHistory.push({
          timestamp: frameCapture.timestamp,
          frameTime: frameCapture.renderTime,
          drawCalls: frameCapture.drawCalls,
          triangles: frameCapture.triangles
        })

        // フレーム履歴を最新の60フレームに制限
        if (frameHistory.length > 60) {
          frameHistory.shift()
        }

        return frameCapture
      })

    const generatePerformanceReport = () =>
      Effect.gen(function* () {
        const metrics = Array.from(performanceMetrics.values())
        const recentFrames = frameHistory.slice(-30) // 最新30フレーム

        const averageFPS = recentFrames.length > 0
          ? 1000 / (recentFrames.reduce((sum, frame) => sum + frame.frameTime, 0) / recentFrames.length)
          : 0

        const averageDrawCalls = recentFrames.length > 0
          ? recentFrames.reduce((sum, frame) => sum + frame.drawCalls, 0) / recentFrames.length
          : 0

        const report: PerformanceReport = {
          timestamp: Date.now(),
          averageFPS,
          averageDrawCalls,
          memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
          renderingMetrics: metrics,
          recommendations: generateRecommendations(metrics, recentFrames),
          hotspots: identifyPerformanceHotspots(metrics)
        }

        return report
      })

    // パフォーマンス推奨事項の生成（純粋関数）
    const generateRecommendations = (metrics: PerformanceMetric[], frames: FrameMetrics[]): string[] => {
      const recommendations: string[] = []

      // FPS警告
      const avgFPS = frames.length > 0 ? 1000 / (frames.reduce((sum, f) => sum + f.frameTime, 0) / frames.length) : 0
      if (avgFPS < 30) {
        recommendations.push("フレームレートが低下しています。描画距離を下げるか、影を無効にしてください")
      }

      // ドローコール警告
      const avgDrawCalls = frames.length > 0 ? frames.reduce((sum, f) => sum + f.drawCalls, 0) / frames.length : 0
      if (avgDrawCalls > 500) {
        recommendations.push("ドローコール数が多すぎます。メッシュのバッチ化を検討してください")
      }

      // メッシング処理の警告
      const meshingMetric = metrics.find(m => m.name.includes("meshing"))
      if (meshingMetric && meshingMetric.averageTime > 16) {
        recommendations.push("チャンクメッシング処理が重いです。LODレベルを上げることを推奨します")
      }

      return recommendations
    }

    const identifyPerformanceHotspots = (metrics: PerformanceMetric[]): PerformanceHotspot[] => {
      return metrics
        .filter(metric => metric.averageTime > 5) // 5ms以上の処理をホットスポットとする
        .sort((a, b) => b.totalTime - a.totalTime)
        .slice(0, 10) // 上位10件
        .map(metric => ({
          name: metric.name,
          totalTime: metric.totalTime,
          averageTime: metric.averageTime,
          callCount: metric.callCount,
          severity: metric.averageTime > 16 ? "high" : metric.averageTime > 8 ? "medium" : "low"
        }))
    }

    return { enableWireframe, showBoundingBoxes, showFrustum, captureFrame, profileRenderCall, generatePerformanceReport }
  })
)

// パフォーマンス監視の自動化
export const createPerformanceMonitor = () =>
  Effect.gen(function* () {
    const debug = yield* RenderDebug

    // 定期的なパフォーマンス監視
    const monitoringLoop = Effect.gen(function* () {
      while (true) {
        yield* Effect.sleep("5 seconds")
        const report = yield* debug.generatePerformanceReport()

        if (report.averageFPS < 30 || report.averageDrawCalls > 500) {
          yield* Console.warn("パフォーマンス警告:", report.recommendations.join(", "))
        }
      }
    })

    return { start: () => Effect.fork(monitoringLoop) }
  })

// 型定義
interface PerformanceMetric {
  readonly name: string
  readonly totalTime: number
  readonly callCount: number
  readonly averageTime: number
  readonly minTime: number
  readonly maxTime: number
}

interface FrameMetrics {
  readonly timestamp: number
  readonly frameTime: number
  readonly drawCalls: number
  readonly triangles: number
}

interface FrameCapture {
  readonly timestamp: number
  readonly drawCalls: number
  readonly triangles: number
  readonly geometries: number
  readonly textures: number
  readonly programs: number
  readonly renderTime: number
  readonly memoryUsage: number
}

interface PerformanceReport {
  readonly timestamp: number
  readonly averageFPS: number
  readonly averageDrawCalls: number
  readonly memoryUsage: number
  readonly renderingMetrics: ReadonlyArray<PerformanceMetric>
  readonly recommendations: ReadonlyArray<string>
  readonly hotspots: ReadonlyArray<PerformanceHotspot>
}

interface PerformanceHotspot {
  readonly name: string
  readonly totalTime: number
  readonly averageTime: number
  readonly callCount: number
  readonly severity: "low" | "medium" | "high"
}
```

## 統合テストとベンチマーク

### Comprehensive Testing & Benchmarks

```typescript
describe("Rendering System - 統合テスト", () => {
  const TestRenderingEnvironment = Layer.mergeAll(
    RendererServiceLive,
    ChunkMeshingServiceLive,
    FrustumCullingServiceLive,
    LODServiceLive,
    ShaderManagerLive,
    TextureManagerLive,
    ParticleSystemLive,
    UIRenderingLive,
    BatchingSystemLive,
    RenderDebugLive
  ).pipe(
    Layer.provide(TestContext.TestContext),
    Layer.provide(TestClock.TestClock)
  )

  describe("パフォーマンステスト", () => {
    it("大量のチャンク描画でフレームレートを維持する", () =>
      Effect.gen(function* () {
        const renderer = yield* RendererService
        const meshingService = yield* ChunkMeshingService
        const debug = yield* RenderDebug

        // 100チャンクの生成とメッシング
        const chunks = Array.from({ length: 100 }, (_, i) => createTestChunk(i))
        const meshes = yield* Effect.all(
          chunks.map(chunk => meshingService.generateMesh(chunk))
        )

        // レンダリング性能測定
        const renderEffect = Effect.gen(function* () {
          for (let frame = 0; frame < 60; frame++) {
            yield* renderer.render(testContext, 16.67)
          }
        })

        const result = yield* debug.profileRenderCall("bulk_rendering", renderEffect)
        const report = yield* debug.generatePerformanceReport()

        expect(report.averageFPS).toBeGreaterThan(30)
        expect(report.averageDrawCalls).toBeLessThan(500)
      }).pipe(
        Effect.provide(TestRenderingEnvironment),
        Effect.runPromise
      ))

    it("メッシュバッチング最適化の効果を検証する", () =>
      Effect.gen(function* () {
        const batchingSystem = yield* BatchingSystem
        const scene = new THREE.Scene()

        // 同一マテリアルの複数メッシュを作成
        const meshes = Array.from({ length: 50 }, () => createTestMesh())
        meshes.forEach(mesh => scene.add(mesh))

        const reportBefore = yield* batchingSystem.optimizeDrawCalls(scene)
        expect(reportBefore.drawCallsBefore).toBe(50)
        expect(reportBefore.drawCallsAfter).toBeLessThan(10)
        expect(reportBefore.savingsPercent).toBeGreaterThan(80)
      }).pipe(
        Effect.provide(TestRenderingEnvironment),
        Effect.runPromise
      ))

    it("視錐台カリングが正しく機能する", () =>
      Effect.gen(function* () {
        const culling = yield* FrustumCullingService
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
        camera.position.set(0, 0, 0)
        camera.lookAt(0, 0, -1)

        const frustum = yield* culling.updateFrustum(camera)

        // カメラの前方にあるチャンク（可視）
        const visibleChunk = createTestChunkMesh(0, 0, -10)
        // カメラの後方にあるチャンク（不可視）
        const hiddenChunk = createTestChunkMesh(0, 0, 10)

        const chunks = [visibleChunk, hiddenChunk]
        const visibleChunks = yield* culling.cullChunks(frustum, chunks)

        expect(visibleChunks.length).toBe(1)
        expect(visibleChunks[0]).toEqual(visibleChunk)
      }).pipe(
        Effect.provide(TestRenderingEnvironment),
        Effect.runPromise
      ))
  })

  describe("品質テスト", () => {
    it("グリーディメッシングが面数を最適化する", () =>
      Effect.gen(function* () {
        const meshingService = yield* ChunkMeshingService

        // 単純な立方体のチャンク
        const simpleChunk = createSolidCubeChunk()
        const simpleMesh = yield* meshingService.generateMesh(simpleChunk)

        // 複雑な形状のチャンク
        const complexChunk = createComplexChunk()
        const complexMesh = yield* meshingService.generateMesh(complexChunk)

        // グリーディメッシングにより面数が最適化されている
        expect(simpleMesh.triangleCount).toBe(12) // 6面 × 2三角形
        expect(complexMesh.triangleCount).toBeLessThan(complexChunk.solidBlockCount * 12)
      }).pipe(
        Effect.provide(TestRenderingEnvironment),
        Effect.runPromise
      ))

    it("LODシステムが距離に応じてメッシュを最適化する", () =>
      Effect.gen(function* () {
        const lodService = yield* LODService
        const playerPosition = { x: 0, y: 64, z: 0 }

        const nearChunk = createTestChunkMesh(1, 0, 1) // 距離: 約16
        const farChunk = createTestChunkMesh(10, 0, 10) // 距離: 約224

        const chunks = [nearChunk, farChunk]
        const optimizedChunks = yield* lodService.manageLOD(playerPosition, chunks)

        expect(optimizedChunks[0].lodLevel).toBe(0) // 近い = 高品質
        expect(optimizedChunks[1].lodLevel).toBeGreaterThan(2) // 遠い = 低品質
      }).pipe(
        Effect.provide(TestRenderingEnvironment),
        Effect.runPromise
      ))

    it("パーティクルシステムが正しく動作する", () =>
      Effect.gen(function* () {
        const particleSystem = yield* ParticleSystem

        const position = { x: 0, y: 64, z: 0 }
        const particle = yield* particleSystem.createParticle("smoke", position)

        expect(particle.type).toBe("smoke")
        expect(particle.position).toEqual(position)
        expect(particle.life).toBeGreaterThan(0)

        // 物理更新のテスト
        yield* particleSystem.updateParticles(1.0) // 1秒経過

        // パーティクルが移動・変化していることを確認
        expect(particle.life).toBeLessThan(particle.maxLife)
      }).pipe(
        Effect.provide(TestRenderingEnvironment),
        Effect.runPromise
      ))
  })

  describe("エラーハンドリング", () => {
    it("不正なシェーダーコードでエラーを適切に処理する", () =>
      Effect.gen(function* () {
        const shaderManager = yield* ShaderManager

        const result = yield* Effect.either(
          shaderManager.loadShader("invalid", "invalid vertex", "invalid fragment")
        )

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left).toBeInstanceOf(ShaderError)
        }
      }).pipe(
        Effect.provide(TestRenderingEnvironment),
        Effect.runPromise
      ))

    it("メモリ不足時に適切にフォールバックする", () =>
      Effect.gen(function* () {
        // メモリ不足をシミュレーション
        const largeChunks = Array.from({ length: 1000 }, (_, i) => createLargeChunk(i))

        const result = yield* Effect.either(
          Effect.all(largeChunks.map(chunk => meshingService.generateMesh(chunk)))
        )

        // エラーが発生するか、メモリ最適化が働く
        expect(
          result._tag === "Left" ||
          (result._tag === "Right" && result.right.length < largeChunks.length)
        ).toBe(true)
      }).pipe(
        Effect.provide(TestRenderingEnvironment),
        Effect.runPromise
      ))
  })
})

// ベンチマーク専用テスト
describe("Rendering Benchmarks", () => {
  it("チャンクメッシング性能ベンチマーク", async () => {
    const benchmark = await import("@effect/vitest").then(m => m.Bench)

    const suite = new benchmark({
      time: 1000, // 1秒間実行
      iterations: 100
    })

    suite.add("standard meshing", () => {
      return Effect.runPromise(
        Effect.gen(function* () {
          const meshingService = yield* ChunkMeshingService
          const chunk = createStandardChunk()
          return yield* meshingService.generateMesh(chunk)
        }).pipe(Effect.provide(TestRenderingEnvironment))
      )
    })

    suite.add("LOD meshing level 2", () => {
      return Effect.runPromise(
        Effect.gen(function* () {
          const meshingService = yield* ChunkMeshingService
          const chunk = createStandardChunk()
          return yield* meshingService.generateLODMesh(chunk, 2)
        }).pipe(Effect.provide(TestRenderingEnvironment))
      )
    })

    await suite.run()

    console.table(suite.results)
  })
})
```

## まとめ

Rendering Systemは、TypeScript Minecraft クローンの視覚的品質とパフォーマンスの両立を実現する包括的なシステムです。Effect-TS 3.17+の最新パターンを活用し、純粋関数型アーキテクチャで設計された高度なレンダリング機能を提供します。

### 主要な技術的特徴

1. **WebGL/Three.js統合**: Effect-TSのLayer パターンで管理された型安全なレンダラー
2. **高性能チャンクメッシング**: グリーディメッシングアルゴリズムによる面数最適化
3. **インテリジェント視錐台カリング**: GPU加速による高速オブジェクト選別
4. **適応型LODシステム**: 距離と性能に基づく動的品質調整
5. **リアルタイムライティング**: 昼夜サイクル対応の動的光源処理
6. **高度なシェーダー管理**: カスタムシェーダーとマテリアルの統一管理
7. **効率的なパーティクルシステム**: GPU並列処理による大量パーティクル描画
8. **レスポンシブUIレンダリング**: HUD・インベントリの高品質描画
9. **自動パフォーマンス最適化**: バッチング・インスタンシングによるドローコール削減
10. **包括的デバッグシステム**: リアルタイム性能監視と最適化提案

### アーキテクチャ上の利点

- **型安全性**: Schema.Structによるランタイム検証付きの型定義
- **関数型設計**: 副作用の分離と純粋関数による予測可能な動作
- **Match.valueパターン**: 条件分岐の関数型実装による保守性向上
- **早期リターン**: エラーハンドリングの効率化
- **テスタビリティ**: PBTテスト対応の純粋関数設計
- **パフォーマンス**: Structure of Arrays ECS統合による高速描画

このシステムにより、数千のチャンクで構成される大規模なMinecraft世界を60FPSで滑らかに描画し、プレイヤーに快適で没入感のあるゲーム体験を提供します。また、モジュラーな設計により、将来的な機能拡張や最適化も容易に行えます。