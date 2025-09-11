# Unified Worker System

統一されたWorkerシステムは、TypeScript MinecraftプロジェクトのためのEffect-tsベースの高度なWorker管理システムです。

## 概要

このシステムは、以下の主要な機能を提供します：

- **統一Worker管理**: 全てのWorkerタイプ（terrain、physics、mesh、lighting、computation）を単一のインターフェースで管理
- **型安全性**: Effect Schemaを使用した完全な型安全なメッセージプロトコル
- **動的スケーリング**: 負荷に応じたWorkerプールの自動スケーリング
- **負荷分散**: 複数の負荷分散アルゴリズムをサポート
- **健全性監視**: Workerの状態監視と自動復旧
- **パフォーマンス最適化**: SharedArrayBufferとTransferable Objectsのサポート

## アーキテクチャ

```
src/infrastructure/workers/
├── unified/                     # 統一Workerシステム
│   ├── worker-manager.ts       # 全WorkerタイプのManager
│   ├── worker-pool.ts          # 高度なWorkerプール管理
│   ├── protocols/              # 型安全なプロトコル定義
│   │   ├── terrain.protocol.ts
│   │   ├── physics.protocol.ts
│   │   ├── mesh.protocol.ts
│   │   └── index.ts
│   ├── workers/               # 実際のWorker実装
│   │   ├── terrain-generation.worker.ts
│   │   ├── physics.worker.ts
│   │   ├── mesh-generation.worker.ts
│   │   ├── lighting.worker.ts
│   │   └── computation.worker.ts
│   └── index.ts
├── base/                      # 基本Worker機能
│   └── typed-worker.ts
└── index.ts
```

## 主要コンポーネント

### WorkerManagerService

全てのWorkerタイプを統一管理するサービス：

```typescript
import { WorkerManagerService } from '@infrastructure/workers/unified'

// Terrain生成
const terrainResult = await WorkerManagerService.generateTerrain({
  coordinates: { x: 0, z: 0 },
  seed: 12345,
  biome: createDefaultBiome('plains'),
  noise: createDefaultNoiseSettings(12345),
  features: createDefaultTerrainFeatures(),
})

// Physics simulation
const physicsResult = await WorkerManagerService.simulatePhysics({
  deltaTime: 1 / 60,
  gravity: { x: 0, y: -9.81, z: 0 },
  bodies: [
    /* physics bodies */
  ],
})

// Mesh生成
const meshResult = await WorkerManagerService.generateMesh({
  chunkData: terrainResult.chunkData,
  algorithm: 'greedy',
  optimizations: createDefaultOptimizations(),
})
```

### WorkerPoolService

個別Workerプールの詳細管理：

```typescript
import { createWorkerPool, WorkerPoolConfig } from '@infrastructure/workers/unified'

const terrainPoolConfig: WorkerPoolConfig = {
  name: 'terrain-pool',
  workerScript: './terrain-generation.worker.ts',
  inputSchema: TerrainGenerationRequest,
  outputSchema: TerrainGenerationResponse,

  // Pool設定
  minWorkers: 1,
  maxWorkers: 4,
  initialWorkers: 2,
  strategy: 'dynamic',

  // パフォーマンス設定
  maxConcurrentRequests: 2,
  requestTimeout: Duration.seconds(30),
  loadBalanceStrategy: 'least-busy',

  // 自動スケーリング
  scaleUpThreshold: 80,
  scaleDownThreshold: 20,
  scaleUpCooldown: Duration.seconds(30),
  scaleDownCooldown: Duration.minutes(2),
}

const terrainPool = createWorkerPool(terrainPoolConfig)
```

## プロトコル定義

### Terrain Protocol

地形生成のための包括的なプロトコル：

```typescript
import { TerrainGenerationRequest, TerrainGenerationResponse, Position3D, Block, ChunkData } from '@infrastructure/workers/unified/protocols'

const request: TerrainGenerationRequest = {
  coordinates: { x: 0, z: 0 },
  seed: 12345,
  biome: {
    type: 'plains',
    temperature: 0.5,
    humidity: 0.5,
    elevation: 0.3,
    rainfall: 0.6,
    vegetation: 0.7,
  },
  noise: {
    seed: 12345,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    scale: 0.01,
    heightMultiplier: 64,
    baseHeight: 64,
  },
  features: {
    generateCaves: true,
    generateOres: true,
    generateVegetation: true,
    generateWaterBodies: true,
    generateStructures: false,
  },
}
```

### Physics Protocol

物理シミュレーションのプロトコル：

```typescript
import { PhysicsSimulationRequest, PhysicsBody, Vector3, createPhysicsMaterial } from '@infrastructure/workers/unified/protocols'

const physicsRequest: PhysicsSimulationRequest = {
  deltaTime: 1 / 60,
  gravity: { x: 0, y: -9.81, z: 0 },
  bodies: [
    {
      id: 'player',
      transform: {
        position: { x: 0, y: 10, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      },
      type: 'dynamic',
      mass: 1.0,
      material: createPhysicsMaterial(0.5, 0.3, 1.0),
      shape: {
        type: 'box',
        halfExtents: { x: 0.5, y: 0.9, z: 0.5 },
      },
      collisionGroup: 1,
      collisionMask: 0xffffffff,
      isActive: true,
    },
  ],
  options: {
    enableCollisionDetection: true,
    enableContinuousCollisionDetection: false,
    enableSleeping: true,
    solverIterations: 10,
  },
}
```

### Mesh Protocol

メッシュ生成のプロトコル：

```typescript
import {
  MeshGenerationRequest,
  OptimizationSettings,
  createDefaultOptimizations
} from '@infrastructure/workers/unified/protocols'

const meshRequest: MeshGenerationRequest = {
  chunkData: /* ChunkData from terrain generation */,
  algorithm: 'greedy',
  lodLevel: 0,
  optimizations: {
    enableFaceCulling: true,
    enableBackfaceCulling: true,
    enableGreedyMeshing: true,
    enableVertexWelding: true,
    weldingThreshold: 0.001,
    normalSmoothingAngle: 30,
    enableLod: false
  },
  options: {
    generateNormals: true,
    generateTangents: false,
    generateUVs: true,
    generateColors: false,
    generateLightmap: false
  }
}
```

## 使用例

### Layer統合

```typescript
import { Layer } from 'effect'
import { WorkerManagerServiceLive } from '@infrastructure/workers/unified'

const AppLayer = Layer.mergeAll(
  WorkerManagerServiceLive,
  // その他のレイヤー...
)
```

### カスタム設定

```typescript
import { WorkerManagerServiceLiveWith } from '@infrastructure/workers/unified'

const customConfig = {
  terrain: {
    poolSize: 4,
    maxConcurrency: 6,
    timeout: Duration.seconds(45),
    priority: 1,
  },
  physics: {
    poolSize: 2,
    maxConcurrency: 4,
    timeout: Duration.seconds(16),
    priority: 2,
  },
  globalSettings: {
    loadBalancing: 'least-busy' as const,
    maxRetries: 5,
    enableMetrics: true,
  },
}

const CustomWorkerLayer = WorkerManagerServiceLiveWith(customConfig)
```

## 主な改善点

1. **統一されたインターフェース**: 全Workerタイプを単一のサービスで管理
2. **型安全性の強化**: Effect Schema使用による完全な型安全性
3. **動的負荷管理**: 自動スケーリングと負荷分散
4. **パフォーマンス最適化**: SharedArrayBufferとTransferable Objects対応
5. **堅牢性向上**: 健全性監視、エラーハンドリング、自動復旧
6. **設定の柔軟性**: 詳細な設定オプションとカスタマイゼーション
7. **メトリクス収集**: 詳細なパフォーマンス監視

## 今後の拡張

- WebAssembly統合
- GPU計算サポート（WebGPU）
- 分散Worker実行（Service Worker）
- 更なるメッシングアルゴリズム（Marching Cubes、Dual Contouring）
- 高度な照明計算（レイトレーシング、グローバルイルミネーション）
