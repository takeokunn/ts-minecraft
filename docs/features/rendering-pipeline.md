# レンダリングパイプライン

TypeScript Minecraftのレンダリングパイプラインは、Three.jsを基盤としたWebGLレンダリングシステムで、Greedy Meshingアルゴリズムによる最適化とマテリアル管理を提供する。Effect-TSによる型安全で関数型のアプローチにより、高いパフォーマンスと保守性を実現している。

## アーキテクチャ概要

```
レンダリングパイプライン構成:
┌─────────────────────────────────────────┐
│ アプリケーション層                        │
│ - RenderingWorkflow                     │
│ - CameraController                      │
└─────────────────────────────────────────┘
           │
┌─────────────────────────────────────────┐
│ ドメイン層                               │
│ - MeshGenerationDomainService           │
│ - MaterialConfigDomainService           │
│ - CameraControlService                  │
└─────────────────────────────────────────┘
           │
┌─────────────────────────────────────────┐
│ インフラストラクチャ層                      │
│ - ThreeJsAdapter                        │
│ - MaterialManagerAdapter                │
│ - MeshGeneratorAdapter                  │
└─────────────────────────────────────────┘
```

## Three.jsとの統合

### レンダリングアダプタ

```typescript
interface IRenderPort {
  readonly render: () => Effect.Effect<void, InfrastructureError>
  readonly clear: () => Effect.Effect<void, InfrastructureError>
  readonly resize: (config: ViewportConfig) => Effect.Effect<void, InfrastructureError>
  readonly updateCamera: (camera: Camera) => Effect.Effect<void, InfrastructureError>
  readonly getCamera: () => Effect.Effect<Camera, InfrastructureError>
  
  // メッシュ管理
  readonly createMesh: (meshData: ChunkMeshData) => Effect.Effect<MeshHandle, MeshGenerationError>
  readonly updateMesh: (handle: MeshHandle, meshData: ChunkMeshData) => Effect.Effect<void, MeshGenerationError>
  readonly removeMesh: (handle: MeshHandle) => Effect.Effect<void, MeshGenerationError>
  
  // 統計とパフォーマンス
  readonly getStats: () => Effect.Effect<RenderStats, InfrastructureError>
  readonly setWireframe: (enabled: boolean) => Effect.Effect<void, InfrastructureError>
  readonly setFog: (config: FogConfig) => Effect.Effect<void, InfrastructureError>
  readonly setLighting: (config: LightingConfig) => Effect.Effect<void, InfrastructureError>
}
```

### Three.jsコンテキスト

```typescript
interface IThreeJsContext {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly canvas: HTMLCanvasElement
}

const ThreeJsContext = Context.GenericTag<IThreeJsContext>("@app/ThreeJsContext")

// コンテキスト初期化
const ThreeJsContextLive = Layer.scoped(
  ThreeJsContext,
  Effect.gen(function* () {
    // Canvas取得
    const canvas = document.getElementById("minecraft-canvas") as HTMLCanvasElement

    // 早期リターンでエラーハンドリング
    if (!canvas) {
      return yield* Effect.fail(new InfrastructureError({
        message: "Canvas element not found",
        timestamp: Date.now()
      }))
    }
    
    // レンダラー作成
    const renderer = new THREE.WebGLRenderer({ 
      canvas,
      antialias: true,
      alpha: false 
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    
    // シーン作成
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x87CEEB, 50, 1000)
    
    // カメラ作成
    const camera = new THREE.PerspectiveCamera(
      75, // FOV
      window.innerWidth / window.innerHeight, // アスペクト比
      0.1, // near
      1000 // far
    )
    
    return ThreeJsContext.of({ scene, camera, renderer, canvas })
  })
)
```

### レンダリングコマンドキュー

```typescript
// レンダリングコマンドのTagged Union定義
const RenderCommand = Schema.Union(
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
  }),
  Schema.Struct({
    _tag: Schema.Literal("SET_LIGHTING"),
    config: LightingConfigSchema
  })
)
type RenderCommand = Schema.Schema.Type<typeof RenderCommand>

// コマンド処理システム
// コマンド処理システム（Match.valueでパターンマッチング）
const processRenderQueue = () =>
  Queue.take(renderQueue).pipe(
    Effect.flatMap(command =>
      Match.value(command).pipe(
        Match.tag("CREATE_MESH", ({ meshData }) => createMesh(meshData)),
        Match.tag("UPDATE_MESH", ({ handle, meshData }) => updateMesh(handle, meshData)),
        Match.tag("REMOVE_MESH", ({ handle }) => removeMesh(handle)),
        Match.tag("UPDATE_CAMERA", ({ camera }) => updateCamera(camera)),
        Match.tag("RENDER_FRAME", () => renderFrame()),
        Match.tag("SET_LIGHTING", ({ config }) => setLighting(config)),
        Match.exhaustive
      )
    ),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError("Render command processing failed", error)
        return yield* Effect.fail(new InfrastructureError({
          message: "Render queue processing failed",
          timestamp: Date.now()
        }))
      })
    )
  )
```

## Greedy Meshingアルゴリズム

### アルゴリズム概要

Greedy Meshingは、隣接する同じブロックを単一のクアッドにまとめることで、レンダリング負荷を大幅に削減するアルゴリズム。

```typescript
// メッシュデータのスキーマ定義
const MeshData = Schema.Struct({
  _tag: Schema.Literal("MeshData"),
  positions: Schema.instanceOf(Float32Array),
  normals: Schema.instanceOf(Float32Array),
  uvs: Schema.instanceOf(Float32Array),
  indices: Schema.instanceOf(Uint32Array),
  vertexCount: Schema.Number
})
type MeshData = Schema.Schema.Type<typeof MeshData>

const generateGreedyMesh = (chunkData: ChunkData): Effect.Effect<GeneratedMeshData, MeshGenerationError> =>
  Effect.gen(function* () {
    // 純粋関数でメッシュデータ生成
    const meshData = greedyMeshingAlgorithm(chunkData)
    
    const vertexAttributes = MeshGeneratorHelpers.createTransferableVertexData(
      Array.from(meshData.positions),
      Array.from(meshData.normals),
      Array.from(meshData.uvs)
    )

    const vertexBuffer: VertexBuffer = {
      attributes: vertexAttributes,
      vertexCount: meshData.positions.length / 3,
      stride: 8 * 4, // position(3) + normal(3) + uv(2) = 8 floats
      interleaved: false
    }

    const indexBuffer: IndexBuffer = MeshGeneratorHelpers.createTransferableIndexBuffer(
      Array.from(meshData.indices)
    )

    const bounds: BoundingVolume = MeshGeneratorHelpers.calculateMeshBounds(
      vertexAttributes.positions
    )

    return {
      vertexBuffer,
      indexBuffer,
      bounds,
      materials: []
    } satisfies GeneratedMeshData
  })
```

### Greedy Meshingの実装詳細

```typescript
// Greedy Meshingアルゴリズム（純粋関数）
const greedyMeshingAlgorithm = (chunkData: ChunkData): MeshData => {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let vertexIndex = 0

  // 6つの面方向（+X, -X, +Y, -Y, +Z, -Z）
  const directions = [
    { axis: 0, dir: 1, u: 1, v: 2 },  // +X面
    { axis: 0, dir: -1, u: 2, v: 1 }, // -X面
    { axis: 1, dir: 1, u: 0, v: 2 },  // +Y面
    { axis: 1, dir: -1, u: 0, v: 2 }, // -Y面
    { axis: 2, dir: 1, u: 0, v: 1 },  // +Z面
    { axis: 2, dir: -1, u: 1, v: 0 }  // -Z面
  ]

  for (const direction of directions) {
    // マスクテーブル作成
    const mask: (Block | null)[] = new Array(CHUNK_SIZE * CHUNK_SIZE).fill(null)
    
    for (let slice = 0; slice < CHUNK_SIZE; slice++) {
      let maskIndex = 0
      
      // スライス内の各ブロックをチェック
      for (let v = 0; v < CHUNK_SIZE; v++) {
        for (let u = 0; u < CHUNK_SIZE; u++) {
          const block = getBlockAtPosition(chunkData, u, v, slice, direction)
          const neighborBlock = getNeighborBlock(chunkData, u, v, slice, direction)
          
          // 面が表示されるかチェック
          if (shouldRenderFace(block, neighborBlock)) {
            mask[maskIndex] = block
          }
          maskIndex++
        }
      }
      
      // マスクからクアッドを生成
      generateQuadsFromMask(mask, slice, direction, positions, normals, uvs, indices, vertexIndex)
    }
  }

  return {
    _tag: "MeshData",
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    vertexCount: positions.length / 3
  } satisfies MeshData
}

const generateQuadsFromMask = (
  mask: (Block | null)[],
  slice: number,
  direction: Direction,
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  vertexIndex: number
): void => {
  for (let v = 0; v < CHUNK_SIZE; v++) {
    for (let u = 0; u < CHUNK_SIZE; ) {
      const maskIndex = v * CHUNK_SIZE + u
      const block = mask[maskIndex]
      
      if (!block) {
        u++
        continue
      }
      
      // 幅を計算（u方向の連続ブロック）
      let width = 1
      while (u + width < CHUNK_SIZE && 
             mask[v * CHUNK_SIZE + u + width] === block) {
        width++
      }
      
      // 高さを計算（v方向の連続ブロック）
      let height = 1
      let canExtendHeight = true
      
      while (v + height < CHUNK_SIZE && canExtendHeight) {
        for (let i = 0; i < width; i++) {
          if (mask[(v + height) * CHUNK_SIZE + u + i] !== block) {
            canExtendHeight = false
            break
          }
        }
        if (canExtendHeight) height++
      }
      
      // クアッド生成
      generateQuad(u, v, slice, width, height, direction, block, 
                  positions, normals, uvs, indices, vertexIndex)
      
      // マスククリア
      for (let h = 0; h < height; h++) {
        for (let w = 0; w < width; w++) {
          mask[(v + h) * CHUNK_SIZE + u + w] = null
        }
      }
      
      u += width
    }
  }
}
```

## マテリアル管理

### マテリアルマネージャー

```typescript
interface MaterialManagerAdapter {
  readonly getMaterial: (name: string) => Effect.Effect<THREE.Material, ExternalLibraryError>
  readonly createMaterial: (name: string, config: Record<string, unknown>) => Effect.Effect<THREE.Material, ExternalLibraryError>
  readonly disposeMaterials: () => Effect.Effect<void>
  readonly hasMaterial: (name: string) => Effect.Effect<boolean>
  readonly removeMaterial: (name: string) => Effect.Effect<void>
}

// デフォルトマテリアル作成
const createDefaultMaterial = (name: string): Effect.Effect<THREE.Material, ExternalLibraryError> =>
  Effect.try({
    try: () => {
      switch (name) {
        case 'chunk':
          return new THREE.MeshStandardMaterial({
            vertexColors: true,
            metalness: 0,
            roughness: 1,
          })
        case 'water':
          return new THREE.MeshStandardMaterial({
            color: 0x006994,
            transparent: true,
            opacity: 0.8,
          })
        case 'grass':
          return new THREE.MeshStandardMaterial({
            color: 0x4a5d23,
          })
        default:
          return new THREE.MeshStandardMaterial({
            color: 0xcccccc,
          })
      }
    },
    catch: (e) => new ExternalLibraryError({
      message: `Failed to create material: ${e}`,
      libraryName: 'three.js',
      operation: 'createMaterial',
      cause: e,
      timestamp: Date.now()
    })
  })
```

### テクスチャ管理

```typescript
interface TextureConfig {
  readonly path: string
  readonly wrapS: THREE.Wrapping
  readonly wrapT: THREE.Wrapping
  readonly magFilter: THREE.TextureFilter
  readonly minFilter: THREE.TextureFilter
  readonly anisotropy: number
}

const TextureManager = {
  loadTexture: (config: TextureConfig): Effect.Effect<THREE.Texture, ResourceLoadError> =>
    Effect.tryPromise({
      try: () => new Promise<THREE.Texture>((resolve, reject) => {
        const loader = new THREE.TextureLoader()
        loader.load(
          config.path,
          (texture) => {
            texture.wrapS = config.wrapS
            texture.wrapT = config.wrapT
            texture.magFilter = config.magFilter
            texture.minFilter = config.minFilter
            texture.anisotropy = config.anisotropy
            resolve(texture)
          },
          undefined,
          reject
        )
      }),
      catch: (error) => new ResourceLoadError({
        message: `Failed to load texture: ${config.path}`,
        resourceId: config.path,
        reason: 'texture_load_failed',
        timestamp: Date.now()
      })
    }),

  createTextureAtlas: (texturePaths: ReadonlyArray<string>): Effect.Effect<THREE.Texture, ResourceLoadError> =>
    Effect.gen(function* () {
      // テクスチャアトラス生成ロジック
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      
      const atlasSize = 512
      const tileSize = 16
      const tilesPerRow = atlasSize / tileSize
      
      canvas.width = atlasSize
      canvas.height = atlasSize
      
      // 各テクスチャを読み込んでアトラスに配置
      for (let i = 0; i < texturePaths.length; i++) {
        const img = new Image()
        yield* Effect.tryPromise({
          try: () => new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const x = (i % tilesPerRow) * tileSize
              const y = Math.floor(i / tilesPerRow) * tileSize
              ctx.drawImage(img, x, y, tileSize, tileSize)
              resolve()
            }
            img.onerror = reject
            img.src = texturePaths[i]
          }),
          catch: (error) => new ResourceLoadError({
            message: `Failed to load atlas texture: ${texturePaths[i]}`,
            resourceId: texturePaths[i],
            reason: 'atlas_texture_load_failed',
            timestamp: Date.now()
          })
        })
      }
      
      // Canvas をテクスチャに変換
      const texture = new THREE.CanvasTexture(canvas)
      texture.magFilter = THREE.NearestFilter
      texture.minFilter = THREE.NearestFilter
      
      return texture
    })
}
```

## カメラシステム

### カメラ制御

```typescript
interface Camera {
  readonly position: Vector3
  readonly rotation: Vector3
  readonly fov: number
  readonly aspect: number
  readonly near: number
  readonly far: number
}

interface CameraControlService {
  readonly updateCamera: (input: InputState, deltaTime: number) => Effect.Effect<Camera>
  readonly setPosition: (position: Vector3) => Effect.Effect<void>
  readonly setRotation: (rotation: Vector3) => Effect.Effect<void>
  readonly setFOV: (fov: number) => Effect.Effect<void>
}

const CameraControlServiceLive = Layer.effect(
  CameraControlService,
  Effect.gen(function* () {
    const cameraRef = yield* Ref.make<Camera>({
      position: { x: 0, y: 50, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      fov: 75,
      aspect: window.innerWidth / window.innerHeight,
      near: 0.1,
      far: 1000
    })

    const updateCamera = (input: InputState, deltaTime: number): Effect.Effect<Camera> =>
      Effect.gen(function* () {
        const currentCamera = yield* Ref.get(cameraRef)
        
        // マウス入力による回転
        const rotationSpeed = 0.002
        const newRotation = {
          x: currentCamera.rotation.x - input.mouse.deltaY * rotationSpeed,
          y: currentCamera.rotation.y - input.mouse.deltaX * rotationSpeed,
          z: currentCamera.rotation.z
        }
        
        // 垂直回転の制限
        newRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, newRotation.x))
        
        // キーボード入力による移動
        const moveSpeed = 10 * deltaTime
        const forward = {
          x: Math.sin(newRotation.y),
          y: 0,
          z: Math.cos(newRotation.y)
        }
        const right = {
          x: Math.cos(newRotation.y),
          y: 0,
          z: -Math.sin(newRotation.y)
        }
        
        let newPosition = { ...currentCamera.position }
        
        if (input.keys.w) {
          newPosition.x += forward.x * moveSpeed
          newPosition.z += forward.z * moveSpeed
        }
        if (input.keys.s) {
          newPosition.x -= forward.x * moveSpeed
          newPosition.z -= forward.z * moveSpeed
        }
        if (input.keys.a) {
          newPosition.x -= right.x * moveSpeed
          newPosition.z -= right.z * moveSpeed
        }
        if (input.keys.d) {
          newPosition.x += right.x * moveSpeed
          newPosition.z += right.z * moveSpeed
        }
        if (input.keys.space) {
          newPosition.y += moveSpeed
        }
        if (input.keys.shift) {
          newPosition.y -= moveSpeed
        }
        
        const updatedCamera = {
          ...currentCamera,
          position: newPosition,
          rotation: newRotation
        }
        
        yield* Ref.set(cameraRef, updatedCamera)
        return updatedCamera
      })

    return CameraControlService.of({
      updateCamera,
      setPosition: (position) => Ref.update(cameraRef, camera => ({ ...camera, position })),
      setRotation: (rotation) => Ref.update(cameraRef, camera => ({ ...camera, rotation })),
      setFOV: (fov) => Ref.update(cameraRef, camera => ({ ...camera, fov }))
    })
  })
)
```

## パフォーマンス最適化

### レンダリング統計

```typescript
interface RenderStats {
  readonly fps: number
  readonly frameTime: number
  readonly drawCalls: number
  readonly triangles: number
  readonly memoryUsage: number
  readonly activeMeshes: number
}

const getRenderStats = (): Effect.Effect<RenderStats, InfrastructureError> =>
  Effect.gen(function* () {
    const meshMap = yield* Ref.get(chunkMeshes)
    const handleMap = yield* Ref.get(meshHandles)

    return {
      fps: 0, // フレームタイミング実装が必要
      frameTime: 0,
      drawCalls: threeJsContext.renderer.info.render.calls,
      triangles: threeJsContext.renderer.info.render.triangles,
      memoryUsage: threeJsContext.renderer.info.memory.geometries + 
                  threeJsContext.renderer.info.memory.textures,
      activeMeshes: meshMap.size + handleMap.size
    }
  })
```

### メモリ管理

```typescript
const MemoryManager = {
  // ガベージコレクション実行
  collectGarbage: () =>
    Effect.gen(function* () {
      const beforeMemory = yield* getMemoryUsage()
      
      // レンダラーのリソース解放
      threeJsContext.renderer.renderLists.dispose()
      
      const afterMemory = yield* getMemoryUsage()
      const freedBytes = beforeMemory.totalBytes - afterMemory.totalBytes
      
      return { freedBytes: Math.max(0, freedBytes) }
    }),

  // メモリ使用量取得
  getMemoryUsage: () =>
    Effect.gen(function* () {
      const info = threeJsContext.renderer.info
      return {
        totalBytes: (info.memory.geometries + info.memory.textures) * 1024,
        textureBytes: info.memory.textures * 1024,
        geometryBytes: info.memory.geometries * 1024
      }
    }),

  // リソース解放
  dispose: () =>
    Effect.gen(function* () {
      const meshMap = yield* Ref.get(chunkMeshes)
      const handleMap = yield* Ref.get(meshHandles)

      // 全メッシュの解放
      meshMap.forEach(mesh => {
        mesh.geometry.dispose()
        threeJsContext.scene.remove(mesh)
      })

      handleMap.forEach(mesh => {
        mesh.geometry.dispose()
        threeJsContext.scene.remove(mesh)
      })

      // マテリアル解放
      chunkMaterial.dispose()
      wireframeMaterial.dispose()

      // レンダラー解放
      threeJsContext.renderer.dispose()
    })
}
```

### レベル・オブ・ディテール (LOD)

```typescript
interface LODConfig {
  readonly distances: ReadonlyArray<number>
  readonly meshQuality: ReadonlyArray<'high' | 'medium' | 'low'>
}

const LODManager = {
  calculateLOD: (cameraPosition: Vector3, chunkPosition: Vector3, config: LODConfig): 'high' | 'medium' | 'low' => {
    const distance = Math.sqrt(
      Math.pow(cameraPosition.x - chunkPosition.x, 2) +
      Math.pow(cameraPosition.z - chunkPosition.z, 2)
    )

    for (let i = 0; i < config.distances.length; i++) {
      if (distance <= config.distances[i]) {
        return config.meshQuality[i]
      }
    }

    return 'low'
  },

  generateLODMesh: (chunkData: ChunkData, quality: 'high' | 'medium' | 'low'): Effect.Effect<GeneratedMeshData> =>
    Effect.gen(function* () {
      switch (quality) {
        case 'high':
          return yield* generateGreedyMesh(chunkData)
        case 'medium':
          return yield* generateSimplifiedMesh(chunkData, 0.5)
        case 'low':
          return yield* generateSimplifiedMesh(chunkData, 0.25)
      }
    })
}
```

このレンダリングパイプラインは、Three.jsの強力な機能とEffect-TSの型安全性を組み合わせ、高性能で保守性の高いレンダリングシステムを実現している。Greedy Meshingアルゴリズムにより描画負荷を大幅に削減し、適切なマテリアル管理とLODシステムにより、大規模なワールドでもスムーズなレンダリングを提供する。