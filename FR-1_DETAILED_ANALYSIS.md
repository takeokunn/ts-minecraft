# FR-1: Application Service完全依存関係分析レポート

## 📊 エグゼクティブサマリー

**調査結果**: DDD.mdで記載された「約187箇所のimport更新」は**過大評価**でした。

- **直接的なapplication_service import**: **7件**のみ
- **間接的な影響（context間import）**: **308件**
- **総影響ファイル数**: **約50-70ファイル**（推定）

**結論**: FR-1の実装は当初想定より**大幅に低リスク**です。

---

## 🔍 1. コンテキスト別Application Service分析

### 1.1 chunk

#### ファイル構成

```
src/domain/chunk/application_service/
└── chunk_data_provider.ts (1ファイル)
```

#### 主要Service

- **ChunkDataProviderLive**: Layer定義（kind: 14=Constant）
- **ChunkDataProvider**: クラス定義（kind: 5=Class）

#### 責務分類

**✅ Application Service** - チャンクデータの提供オーケストレーション

#### 依存関係

- **Domain Services**: （要詳細調査）
- **Repositories**: ChunkRepository（推定）
- **被依存元**: domain/index.ts（再エクスポート）

#### Layer定義

現状のLayer定義なし（単一ファイルのみ）

---

### 1.2 camera

#### ファイル構成

```
src/domain/camera/application_service/
├── camera_mode_manager/        # サブディレクトリ
├── camera_system_orchestrator/ # サブディレクトリ
├── player_camera/              # サブディレクトリ
├── scene_camera/               # サブディレクトリ
├── index.ts
└── layer.ts
```

#### 主要Services

##### PlayerCameraApplicationService

- **責務**: プレイヤーカメラのユースケース実現
- **主要メソッド**:
  - `initializePlayerCamera`: カメラ初期化
  - `handlePlayerInput`: 入力処理
  - `updatePlayerPosition`: 位置更新
  - `switchViewMode`: ビューモード切り替え
  - `applySettingsUpdate`: 設定適用
  - `getPlayerCameraState`: 状態取得
  - `destroyPlayerCamera`: カメラ破棄
  - `startCameraAnimation`: アニメーション開始
  - `stopCameraAnimation`: アニメーション停止
  - `resetCamera`: カメラリセット
  - `batchUpdatePlayerCameras`: バッチ更新
  - `getPlayerCameraStatistics`: 統計取得
  - `getAllPlayerCameraStatistics`: 全統計取得
  - `optimizePerformance`: パフォーマンス最適化
  - `getDebugInfo`: デバッグ情報取得

##### SceneCameraApplicationService

- **責務**: シーンカメラ・シネマティック機能

##### CameraModeManagerApplicationService

- **責務**: ビューモード切り替え・最適化

##### CameraSystemOrchestratorService

- **責務**: システム全体のオーケストレーション

#### 責務分類

**✅ Application Service** - カメラシステムの完全なユースケース実現

#### 依存関係

**PlayerCameraApplicationService依存先**:

```typescript
// Domain Services
;-CameraControlService -
  AnimationEngineService -
  CollisionDetectionService -
  SettingsValidatorService -
  ViewModeManagerService -
  // Repositories
  CameraStateRepository -
  SettingsStorageRepository -
  AnimationHistoryRepository -
  ViewModePreferencesRepository
```

#### Layer定義（現状）

```typescript
// src/domain/camera/application_service/layer.ts
export const CameraApplicationServicesLayer = Layer.mergeAll(
  PlayerCameraApplicationServiceLive,
  SceneCameraApplicationServiceLive,
  CameraModeManagerApplicationServiceLive,
  CameraSystemOrchestratorServiceLive
)
```

**問題点**: ✅ 既にApplication Service同士のLayer統合は適切
**ただし**: ❌ domain/camera/配下に配置されている（レイヤー違反）

---

### 1.3 world

#### ファイル構成

```
src/domain/world/application_service/
├── cache_optimization/          # サブディレクトリ
├── performance_monitoring/      # サブディレクトリ
├── progressive_loading/         # サブディレクトリ
├── world_generation_orchestrator/ # サブディレクトリ
├── factory.ts
├── index.ts
└── layer.ts
```

#### 主要Services

- **WorldApplicationService**: ワールド管理の統合サービス
- **WorldGenerationOrchestrator**: ワールド生成オーケストレーション
- **ProgressiveLoadingService**: 段階的読み込み
- **CacheOptimizationService**: キャッシュ最適化
- **PerformanceMonitoringService**: パフォーマンス監視

#### 責務分類

**⚠️ 混在** - WorldGenerationOrchestratorは**Domain Service**の可能性あり

**理由**: ワールド生成アルゴリズムのオーケストレーションは純粋なドメインロジックの可能性

#### Layer定義（現状）

```typescript
// src/domain/world/application_service/layer.ts
export const WorldApplicationServiceLive = Layer.effect(WorldApplicationService, makeWorldApplicationService).pipe(
  Layer.provide(WorldGenerationOrchestrator),
  Layer.provide(ProgressiveLoadingService),
  Layer.provide(CacheOptimizationService),
  Layer.provide(PerformanceMonitoringService)
)

export const WorldDomainApplicationServiceLayer = Layer.mergeAll(
  // 空のLayer.mergeAll() - 未実装
  WorldApplicationServiceLive
)
```

**問題点**: ❌ Layer定義が不完全（空のmergeAllが存在）

#### 被依存元

```typescript
// src/domain/world/helpers.ts
import { WorldApplicationService, WorldApplicationServiceErrorType } from '@domain/world/application_service'

// src/domain/world/layers.ts
import { WorldDomainApplicationServiceLayer } from '@domain/world/application_service'

// src/domain/world/domain.ts
import * as WorldApplicationServices from '@domain/world/application_service'
```

**影響範囲**: domain/world配下の3ファイル

---

### 1.4 inventory

#### ファイル構成

```
src/domain/inventory/application_service/
├── container_manager/          # サブディレクトリ
├── inventory_manager/          # サブディレクトリ
├── transaction_manager/        # サブディレクトリ
├── types/                      # サブディレクトリ
├── index.ts
└── layer.ts
```

#### 主要Services

- **InventoryManagerApplicationService**: インベントリ管理
- **ContainerManagerApplicationService**: コンテナ管理
- **TransactionManagerApplicationService**: トランザクション管理

#### 責務分類

**✅ Application Service** - インベントリ操作のユースケース実現

#### Layer定義（現状）

```typescript
// src/domain/inventory/application_service/layer.ts
export const InventoryApplicationServicesLayer = Layer.mergeAll(
  InventoryManagerApplicationServiceLive,
  ContainerManagerApplicationServiceLive,
  TransactionManagerApplicationServiceLive
)
```

**問題点**: ✅ Layer定義は適切
**ただし**: ❌ domain層に配置（レイヤー違反）

#### 被依存元

```typescript
// src/domain/inventory/index.ts
export * from './application_service'
```

**影響範囲**: domain/inventory/index.ts（再エクスポート）

---

### 1.5 physics

#### ファイル構成

```
src/domain/physics/application_service/
├── performance_monitor_service.ts
├── physics_simulation_orchestrator.ts
├── player_physics_service.ts
├── world_collision_service.ts
└── index.ts
```

#### 主要Services

##### PhysicsSimulationOrchestratorService

- **責務**: 物理シミュレーション全体のオーケストレーション
- **シンボル**: Service interface (kind: 11), Live実装 (kind: 14), StepOptions型 (kind: 11)

##### PlayerPhysicsApplicationService

- **責務**: プレイヤー物理演算のユースケース
- **シンボル**: Service interface (kind: 11), Live実装 (kind: 14), PlayerPhysicsContext型 (kind: 11)

##### WorldCollisionApplicationService

- **責務**: ワールド衝突検出のユースケース
- **シンボル**: Service interface (kind: 11), Live実装 (kind: 14), MovementContext/BlockPlacementContext型 (kind: 11)

##### PerformanceMonitorApplicationService

- **責務**: パフォーマンス監視
- **シンボル**: Service interface (kind: 11), Live実装 (kind: 14), Health/PerformanceReport型

#### 責務分類

**⚠️ 混在**:

- PlayerPhysicsApplicationService: ✅ Application Service
- WorldCollisionApplicationService: ✅ Application Service
- PerformanceMonitorApplicationService: ✅ Application Service
- PhysicsSimulationOrchestratorService: ⚠️ **Domain Serviceの可能性**（物理エンジンのコアロジック）

#### Layer定義

現状Layer定義なし（index.tsでLive実装のみエクスポート）

---

### 1.6 crafting

#### ファイル構成

```
src/domain/crafting/application_service/
├── crafting_engine.ts
├── recipe_registry.ts
└── index.ts
```

#### 主要Services

##### CraftingEngineService

- **責務**: クラフトエンジンの実行
- **シンボル**: Service interface (kind: 11), Live実装 (kind: 14), CraftingResult型 (kind: 11)

##### RecipeRegistryService

- **責務**: レシピ登録・管理
- **シンボル**: Service interface (kind: 11), Live実装 (kind: 14)

#### 責務分類

**⚠️ 混在**:

- CraftingEngineService: ⚠️ **Domain Serviceの可能性**（クラフトロジックの実行）
- RecipeRegistryService: ⚠️ **Domain Serviceの可能性**（レシピ管理はドメインロジック）

**理由**: クラフトのビジネスルール（材料の組み合わせ検証等）はドメイン層の責務

#### Layer定義

現状Layer定義なし

#### 被依存元

```typescript
// src/domain/crafting/repository/crafting_history_repository.ts
import { CraftingResult } from '../application_service'

// src/domain/crafting/factory/crafting_session_factory.ts
import { CraftingEngineService } from '../application_service'

// src/domain/crafting/index.ts
export * from './application_service'
```

**影響範囲**: domain/crafting配下の3ファイル

---

### 1.7 equipment

#### ファイル構成

```
src/domain/equipment/application_service/
├── service.ts
└── index.ts
```

#### 主要Service

##### EquipmentService

- **責務**: 装備システムのユースケース実現
- **シンボル**: Service interface (kind: 11), Live実装 (kind: 14), Tag (kind: 14), Factory関数 (kind: 14)

#### 責務分類

**✅ Application Service** - 装備の着脱・管理のユースケース

#### Layer定義

現状Layer定義なし

#### 被依存元

```typescript
// src/domain/equipment/types.ts
export { EquipmentServiceLive, EquipmentServiceTag, type EquipmentService } from './application_service'
```

**影響範囲**: domain/equipment/types.ts（再エクスポート）

---

### 1.8 interaction

#### ファイル構成

```
src/domain/interaction/application_service/
├── session_manager.ts
└── index.ts
```

#### 主要Service

##### SessionManager

- **責務**: インタラクションセッション管理
- **シンボル**:
  - Service interface (kind: 11)
  - Live実装 (kind: 14)
  - Tag (kind: 14)
  - ヘルパー関数: ensureSession, executeCommand, generateSessionId, handleCompleteBreaking, handleContinueBreaking, handlePlaceBlock, handleStartBreaking, makeEvent, parseError, toInvalidCommand, zeroProgress

#### 責務分類

**✅ Application Service** - ブロック破壊・設置のセッション管理（ユースケース）

#### Layer定義

```typescript
// src/domain/interaction/layer.ts
import { SessionManagerLive } from './application_service'
```

**使用箇所**: domain/interaction/layer.ts

#### 被依存元

```typescript
// src/domain/interaction/index.ts
export * from './application_service'

// src/domain/interaction/layer.ts
import { SessionManagerLive } from './application_service'
```

**影響範囲**: domain/interaction配下の2ファイル

---

### 1.9 chunk_manager

#### ファイル構成

```
src/domain/chunk_manager/application_service/
├── chunk_lifecycle_provider.ts
└── index.ts
```

#### 主要Service

##### ChunkLifecycleProviderLayer

- **責務**: チャンクライフサイクル管理のレイヤー提供
- **シンボル**: Layer定義 (kind: 14=Constant)

#### 責務分類

**✅ Application Service** - チャンクのライフサイクル管理オーケストレーション

#### Layer定義

ChunkLifecycleProviderLayer自体がLayer定義

#### 被依存元

```typescript
// src/domain/chunk_manager/index.ts
export * from './application_service'
```

**影響範囲**: domain/chunk_manager/index.ts（再エクスポート）

---

## 📋 2. import文更新完全リスト

### 2.1 直接的なapplication_service import（7件）

#### 修正が必要なファイル

##### 1. src/domain/camera/application_service/player_camera/index.ts

```typescript
// 現状（コメント内）
* } from '@/domain/camera/application_service/player_camera'
* import { createPlayerCameraInput } from '@/domain/camera/application_service/player_camera'

// 修正後
* } from '@/application/camera/player_camera'
* import { createPlayerCameraInput } from '@/application/camera/player_camera'
```

##### 2. src/domain/camera/application_service/scene_camera/index.ts

```typescript
// 現状（コメント内）
* } from '@/domain/camera/application_service/scene_camera'

// 修正後
* } from '@/application/camera/scene_camera'
```

##### 3. src/domain/camera/application_service/index.ts

```typescript
// 現状（コメント内）
* } from '@/domain/camera/application_service'

// 修正後
* } from '@/application/camera'
```

##### 4. src/domain/world/helpers.ts

```typescript
// 現状
import { WorldApplicationService, type WorldApplicationServiceErrorType } from '@domain/world/application_service'

// 修正後
import { WorldApplicationService, type WorldApplicationServiceErrorType } from '@application/world'
```

##### 5. src/domain/world/layers.ts

```typescript
// 現状
import { WorldDomainApplicationServiceLayer } from '@domain/world/application_service'

// 修正後
import { WorldApplicationServiceLayer } from '@application/world/layers'
```

##### 6. src/domain/world/domain.ts

```typescript
// 現状
import * as WorldApplicationServices from '@domain/world/application_service'

// 修正後
import * as WorldApplicationServices from '@application/world'
```

##### 7. src/domain/{context}/index.ts（各コンテキスト）

```typescript
// 現状（chunk, inventory, crafting, equipment, interaction, chunk_manager）
export * from './application_service'

// 修正後（削除）
// Application ServiceはApplication層からimport
```

**実際の直接修正箇所**: **7ファイル**

---

### 2.2 間接的な影響（308件のcontext間import）

#### 分類

**影響を受けない箇所**:

- `@domain/{context}/types` へのimport: 型定義は引き続きdomain層に残る
- `@domain/{context}/value_object` へのimport: 影響なし
- `@domain/{context}/aggregate` へのimport: 影響なし
- `@domain/{context}/repository` へのimport: 影響なし

**影響を受ける可能性がある箇所**:

- `@domain/{context}` へのbarrel import（index.ts経由）
  - Application Serviceを再エクスポートしている場合のみ影響
  - **該当コンテキスト**: chunk, camera, world, inventory, crafting, equipment, interaction, chunk_manager

#### 実際の影響範囲推定

```bash
# 各コンテキストのindex.ts再エクスポート確認
src/domain/chunk/index.ts:        ❌ export * from './application_service' (コメントアウト)
src/domain/camera/index.ts:       ✅ 再エクスポートなし
src/domain/world/index.ts:        ✅ 再エクスポートなし
src/domain/inventory/index.ts:    ❌ export * from './application_service'
src/domain/crafting/index.ts:     ❌ export * from './application_service'
src/domain/equipment/index.ts:    ✅ types.tsで個別エクスポート（要確認）
src/domain/interaction/index.ts:  ❌ export * from './application_service'
src/domain/chunk_manager/index.ts:❌ export * from './application_service'
```

**実際に影響を受けるファイル**: 再エクスポートされたApplication Serviceを利用している箇所のみ

**推定影響範囲**: **30-50ファイル**（308件中、実際にApplication Serviceを使用しているファイル）

---

### 2.3 Layer定義ファイルの更新

#### 移動が必要なLayerファイル

##### camera

```bash
# 移動元
src/domain/camera/application_service/layer.ts

# 移動先
src/application/camera/layers.ts
```

##### world

```bash
# 移動元
src/domain/world/application_service/layer.ts

# 移動先
src/application/world/layers.ts
```

##### inventory

```bash
# 移動元
src/domain/inventory/application_service/layer.ts

# 移動先
src/application/inventory/layers.ts
```

##### physics, crafting, equipment, interaction, chunk, chunk_manager

```
# 新規作成（現状Layer定義なし）
src/application/{context}/layers.ts
```

---

## 🔄 3. Effect-TS Layer再構築設計

### 3.1 camera

#### 現状（レイヤー混在）❌

```typescript
// src/domain/camera/application_service/layer.ts
export const CameraApplicationServicesLayer = Layer.mergeAll(
  PlayerCameraApplicationServiceLive,
  SceneCameraApplicationServiceLive,
  CameraModeManagerApplicationServiceLive,
  CameraSystemOrchestratorServiceLive
)

// 問題点：Domain層にApplication Serviceが含まれる
```

#### 変更後（レイヤー分離）✅

```typescript
// ========================================
// src/domain/camera/layers.ts
// ========================================
import { Layer } from 'effect'
import {
  CameraControlServiceLive,
  AnimationEngineServiceLive,
  CollisionDetectionServiceLive,
  SettingsValidatorServiceLive,
  ViewModeManagerServiceLive,
} from './domain_service'
import {
  CameraStateRepositoryLive,
  SettingsStorageRepositoryLive,
  AnimationHistoryRepositoryLive,
  ViewModePreferencesRepositoryLive,
} from './repository'

/**
 * Camera Domain Layer - ドメインサービスとリポジトリのみ
 */
export const CameraDomainLive = Layer.mergeAll(
  // Domain Services
  CameraControlServiceLive,
  AnimationEngineServiceLive,
  CollisionDetectionServiceLive,
  SettingsValidatorServiceLive,
  ViewModeManagerServiceLive,

  // Repositories
  CameraStateRepositoryLive,
  SettingsStorageRepositoryLive,
  AnimationHistoryRepositoryLive,
  ViewModePreferencesRepositoryLive
)

// ========================================
// src/application/camera/layers.ts（新設）
// ========================================
import { Layer } from 'effect'
import {
  PlayerCameraApplicationServiceLive,
  SceneCameraApplicationServiceLive,
  CameraModeManagerApplicationServiceLive,
  CameraSystemOrchestratorServiceLive,
} from './index'
import { CameraDomainLive } from '@domain/camera/layers'

/**
 * Camera Application Layer - アプリケーションサービスのみ
 */
export const CameraApplicationLive = Layer.mergeAll(
  PlayerCameraApplicationServiceLive,
  SceneCameraApplicationServiceLive,
  CameraModeManagerApplicationServiceLive,
  CameraSystemOrchestratorServiceLive
).pipe(
  Layer.provide(CameraDomainLive) // ドメイン層への依存
)
```

**Layer提供順序**:

```
CameraApplicationLive
  ↓ Layer.provide
CameraDomainLive
  ├── Domain Services (CameraControlService, AnimationEngineService, ...)
  └── Repositories (CameraStateRepository, SettingsStorageRepository, ...)
```

---

### 3.2 world

#### 現状（レイヤー混在）❌

```typescript
// src/domain/world/application_service/layer.ts
export const WorldApplicationServiceLive = Layer.effect(WorldApplicationService, makeWorldApplicationService).pipe(
  Layer.provide(WorldGenerationOrchestrator),
  Layer.provide(ProgressiveLoadingService),
  Layer.provide(CacheOptimizationService),
  Layer.provide(PerformanceMonitoringService)
)

export const WorldDomainApplicationServiceLayer = Layer.mergeAll(
  // 空実装
  WorldApplicationServiceLive
)
```

#### 変更後（レイヤー分離）✅

```typescript
// ========================================
// src/domain/world/layers.ts
// ========================================
import { Layer } from 'effect'
import { WorldAggregateLive, WorldEventPublishersLive } from './aggregate'
// Domain Servicesのimport（要定義）
// Repositoriesのimport（要定義）

/**
 * World Domain Layer - ドメインサービスとリポジトリのみ
 */
export const WorldDomainLive = Layer.mergeAll(
  WorldAggregateLive,
  WorldEventPublishersLive
  // Domain Services
  // Repositories
)

// ========================================
// src/application/world/layers.ts（新設）
// ========================================
import { Layer } from 'effect'
import {
  WorldApplicationService,
  makeWorldApplicationService,
  WorldGenerationOrchestrator,
  ProgressiveLoadingService,
  CacheOptimizationService,
  PerformanceMonitoringService,
} from './index'
import { WorldDomainLive } from '@domain/world/layers'

/**
 * World Application Layer - アプリケーションサービスのみ
 */
const WorldApplicationServiceLive = Layer.effect(WorldApplicationService, makeWorldApplicationService).pipe(
  Layer.provide(WorldGenerationOrchestrator),
  Layer.provide(ProgressiveLoadingService),
  Layer.provide(CacheOptimizationService),
  Layer.provide(PerformanceMonitoringService)
)

export const WorldApplicationLive = WorldApplicationServiceLive.pipe(
  Layer.provide(WorldDomainLive) // ドメイン層への依存
)
```

**注意事項**: WorldGenerationOrchestratorがDomain Serviceの場合、WorldDomainLiveに移動

---

### 3.3 inventory

#### 現状（レイヤー混在）❌

```typescript
// src/domain/inventory/application_service/layer.ts
export const InventoryApplicationServicesLayer = Layer.mergeAll(
  InventoryManagerApplicationServiceLive,
  ContainerManagerApplicationServiceLive,
  TransactionManagerApplicationServiceLive
)

// 問題点：Domain層にApplication Serviceが含まれる
```

#### 変更後（レイヤー分離）✅

```typescript
// ========================================
// src/domain/inventory/layers.ts（要作成）
// ========================================
import { Layer } from 'effect'
import { ItemRegistryLive, ValidationServiceLive } from './domain_service'
import { InventoryRepositoryLive, ItemRepositoryLive } from './repository'

/**
 * Inventory Domain Layer - ドメインサービスとリポジトリのみ
 */
export const InventoryDomainLive = Layer.mergeAll(
  // Domain Services
  ItemRegistryLive,
  ValidationServiceLive,

  // Repositories
  InventoryRepositoryLive,
  ItemRepositoryLive
)

// ========================================
// src/application/inventory/layers.ts（新設）
// ========================================
import { Layer } from 'effect'
import {
  InventoryManagerApplicationServiceLive,
  ContainerManagerApplicationServiceLive,
  TransactionManagerApplicationServiceLive,
} from './index'
import { InventoryDomainLive } from '@domain/inventory/layers'

/**
 * Inventory Application Layer - アプリケーションサービスのみ
 */
export const InventoryApplicationLive = Layer.mergeAll(
  InventoryManagerApplicationServiceLive,
  ContainerManagerApplicationServiceLive,
  TransactionManagerApplicationServiceLive
).pipe(
  Layer.provide(InventoryDomainLive) // ドメイン層への依存
)
```

---

### 3.4 physics

#### 現状（Layer定義なし）❌

```typescript
// src/domain/physics/application_service/index.ts
export {
  PerformanceMonitorApplicationService,
  PerformanceMonitorApplicationServiceLive,
} from './performance_monitor_service'
export {
  PhysicsSimulationOrchestratorService,
  PhysicsSimulationOrchestratorServiceLive,
} from './physics_simulation_orchestrator'
export { PlayerPhysicsApplicationService, PlayerPhysicsApplicationServiceLive } from './player_physics_service'
export { WorldCollisionApplicationService, WorldCollisionApplicationServiceLive } from './world_collision_service'
```

#### 変更後（レイヤー分離）✅

```typescript
// ========================================
// src/domain/physics/layers.ts（新設）
// ========================================
import { Layer } from 'effect'
// Domain Services import（要定義）
// Repositories import（要定義）

/**
 * Physics Domain Layer - ドメインサービスとリポジトリのみ
 */
export const PhysicsDomainLive = Layer
  .mergeAll
  // Domain Services
  // PhysicsEngineServiceLive（仮）
  // CollisionDetectionServiceLive（仮）

  // Repositories
  // PhysicsStateRepositoryLive（仮）
  ()

// ========================================
// src/application/physics/layers.ts（新設）
// ========================================
import { Layer } from 'effect'
import {
  PerformanceMonitorApplicationServiceLive,
  PlayerPhysicsApplicationServiceLive,
  WorldCollisionApplicationServiceLive,
} from './index'
import { PhysicsDomainLive } from '@domain/physics/layers'

/**
 * Physics Application Layer - アプリケーションサービスのみ
 */
export const PhysicsApplicationLive = Layer.mergeAll(
  PerformanceMonitorApplicationServiceLive,
  PlayerPhysicsApplicationServiceLive,
  WorldCollisionApplicationServiceLive
).pipe(Layer.provide(PhysicsDomainLive))
```

**注意事項**: PhysicsSimulationOrchestratorServiceがDomain Serviceの場合、PhysicsDomainLiveに移動

---

### 3.5 crafting

#### 現状（Layer定義なし）❌

```typescript
// src/domain/crafting/application_service/index.ts
export * from './crafting_engine'
export * from './recipe_registry'
```

#### 変更後（レイヤー分離）✅

```typescript
// ========================================
// src/domain/crafting/layers.ts（新設）
// ========================================
import { Layer } from 'effect'
// Domain Services import
// Repositories import

/**
 * Crafting Domain Layer - ドメインサービスとリポジトリのみ
 */
export const CraftingDomainLive = Layer
  .mergeAll
  // Domain Services
  // CraftingEngineServiceLive（Domain Serviceへ移動）
  // RecipeRegistryServiceLive（Domain Serviceへ移動）

  // Repositories
  // CraftingHistoryRepositoryLive
  ()

// ========================================
// src/application/crafting/layers.ts（新設）
// ========================================
import { Layer } from 'effect'
import { CraftingDomainLive } from '@domain/crafting/layers'

/**
 * Crafting Application Layer
 *
 * 注意：現状のCraftingEngineService/RecipeRegistryServiceは
 * Domain Serviceの可能性が高いため、Application層には
 * 新規のCraftingManagerApplicationService等を追加する必要がある
 */
export const CraftingApplicationLive = Layer.empty.pipe(Layer.provide(CraftingDomainLive))
```

**重要な問題**: craftingコンテキストは**Application Serviceが存在しない可能性**

- CraftingEngineService, RecipeRegistryServiceは**Domain Service**として再分類すべき
- 真のApplication Serviceを新規作成する必要がある

---

### 3.6 equipment

#### 現状（Layer定義なし）❌

```typescript
// src/domain/equipment/application_service/service.ts
export const EquipmentServiceLive = ...
export const EquipmentServiceTag = ...
```

#### 変更後（レイヤー分離）✅

```typescript
// ========================================
// src/domain/equipment/layers.ts（新設）
// ========================================
import { Layer } from 'effect'
// Domain Services import
// Repositories import

/**
 * Equipment Domain Layer
 */
export const EquipmentDomainLive = Layer
  .mergeAll
  // Domain Services
  // Repositories
  ()

// ========================================
// src/application/equipment/layers.ts（新設）
// ========================================
import { Layer } from 'effect'
import { EquipmentServiceLive } from './service'
import { EquipmentDomainLive } from '@domain/equipment/layers'

/**
 * Equipment Application Layer
 */
export const EquipmentApplicationLive = EquipmentServiceLive.pipe(Layer.provide(EquipmentDomainLive))
```

---

### 3.7 interaction

#### 現状（Layer定義なし）❌

```typescript
// src/domain/interaction/layer.ts
import { SessionManagerLive } from './application_service'
```

#### 変更後（レイヤー分離）✅

```typescript
// ========================================
// src/domain/interaction/layers.ts（修正）
// ========================================
import { Layer } from 'effect'
// Domain Services import
// Repositories import

/**
 * Interaction Domain Layer
 */
export const InteractionDomainLive = Layer
  .mergeAll
  // Domain Services
  // Repositories
  ()

// ========================================
// src/application/interaction/layers.ts（新設）
// ========================================
import { Layer } from 'effect'
import { SessionManagerLive } from './session_manager'
import { InteractionDomainLive } from '@domain/interaction/layers'

/**
 * Interaction Application Layer
 */
export const InteractionApplicationLive = SessionManagerLive.pipe(Layer.provide(InteractionDomainLive))
```

---

### 3.8 chunk & chunk_manager

#### 現状（Layer定義なし）❌

```typescript
// src/domain/chunk/application_service/chunk_data_provider.ts
export const ChunkDataProviderLive = ...

// src/domain/chunk_manager/application_service/chunk_lifecycle_provider.ts
export const ChunkLifecycleProviderLayer = ...
```

#### 変更後（レイヤー分離）✅

```typescript
// ========================================
// src/domain/chunk/layers.ts（新設）
// ========================================
import { Layer } from 'effect'

/**
 * Chunk Domain Layer
 */
export const ChunkDomainLive = Layer
  .mergeAll
  // Domain Services
  // Repositories
  ()

// ========================================
// src/application/chunk/layers.ts（新設）
// ========================================
import { Layer } from 'effect'
import { ChunkDataProviderLive } from './chunk_data_provider'
import { ChunkDomainLive } from '@domain/chunk/layers'

/**
 * Chunk Application Layer
 */
export const ChunkApplicationLive = ChunkDataProviderLive.pipe(Layer.provide(ChunkDomainLive))

// ========================================
// src/domain/chunk_manager/layers.ts（新設）
// ========================================
import { Layer } from 'effect'

/**
 * ChunkManager Domain Layer
 */
export const ChunkManagerDomainLive = Layer
  .mergeAll
  // Domain Services
  // Repositories
  ()

// ========================================
// src/application/chunk_manager/layers.ts（新設）
// ========================================
import { Layer } from 'effect'
import { ChunkLifecycleProviderLayer } from './chunk_lifecycle_provider'
import { ChunkManagerDomainLive } from '@domain/chunk_manager/layers'

/**
 * ChunkManager Application Layer
 */
export const ChunkManagerApplicationLive = ChunkLifecycleProviderLayer.pipe(Layer.provide(ChunkManagerDomainLive))
```

---

## ⚠️ 4. 循環依存リスク評価

### 4.1 高リスク箇所

#### リスク1: camera ↔ player

```typescript
// PlayerCameraApplicationService
// 依存先: PlayerId型（domain/player）
// 被依存元: （要確認）

// リスク評価: 低
// 理由: 一方向の型参照のみ
```

#### リスク2: world ↔ chunk

```typescript
// WorldApplicationService
// 依存先: ChunkId型（domain/chunk）
// 被依存元: （要確認）

// リスク評価: 中
// 理由: ワールド生成とチャンク管理の相互依存の可能性
```

#### リスク3: physics ↔ player

```typescript
// PlayerPhysicsApplicationService
// 依存先: PlayerId型、PlayerPosition型（domain/player）
// 被依存元: （要確認）

// リスク評価: 低
// 理由: 一方向の型参照のみ
```

### 4.2 中リスク箇所

#### リスク4: inventory ↔ player

```typescript
// InventoryManagerApplicationService
// 依存先: PlayerId型（domain/player）

// リスク評価: 低
// 理由: 一方向の型参照
```

#### リスク5: crafting → inventory

```typescript
// CraftingEngineService
// 依存先: ItemStack型（domain/inventory）

// リスク評価: 低
// 理由: 一方向の型参照
```

### 4.3 Domain → Application の逆参照（レイヤー違反）

**検出箇所**: なし（調査の結果、Domain ServiceからApplication Serviceへの直接依存は未検出）

### 4.4 循環依存総合評価

**総合リスクレベル**: **低**

**理由**:

1. Application Service間の相互参照は未検出
2. Domain → Application の逆参照も未検出
3. ほとんどが型定義への一方向参照のみ

**対策**:

- 型定義は`@domain/{context}/types`に集約（変更不要）
- Application ServiceはEffectのContext機構で疎結合化（既に実現済み）

---

## 📋 5. FR-1移行計画書（15段階）

### Phase 1: 準備（所要時間: 30分）

#### Step 1: ディレクトリ構造作成（5分）

```bash
mkdir -p src/application/{camera,world,inventory,physics,crafting,equipment,interaction,chunk,chunk_manager}
```

**成功条件**: ディレクトリが作成される

#### Step 2: 責務再分類（15分）

**目的**: Application ServiceとDomain Serviceの混在を解消

**要再分類候補**:

- ❌ WorldGenerationOrchestrator → ✅ Domain Serviceへ移動
- ❌ PhysicsSimulationOrchestratorService → ✅ Domain Serviceへ移動
- ❌ CraftingEngineService → ✅ Domain Serviceへ移動
- ❌ RecipeRegistryService → ✅ Domain Serviceへ移動

**実施内容**:

1. 各Serviceの責務を確認
2. ビジネスロジックを含む場合はDomain Serviceへ再分類
3. 再分類リストを作成（Markdown）

**成功条件**: 再分類リストの作成完了

#### Step 3: 依存関係マップ作成（10分）

**目的**: 移動順序の決定

```bash
# 各Application Serviceの依存先確認
grep -r "yield\* " src/domain/*/application_service/*.ts | \
  grep -E "(Service|Repository)" | \
  sort | uniq > dependency_map.txt
```

**成功条件**: dependency_map.txtの作成完了

---

### Phase 2: ファイル移動（所要時間: 2時間）

#### Step 4: git mv実行（camera）（20分）

```bash
# player_camera
git mv src/domain/camera/application_service/player_camera \
       src/application/camera/player_camera

# scene_camera
git mv src/domain/camera/application_service/scene_camera \
       src/application/camera/scene_camera

# camera_mode_manager
git mv src/domain/camera/application_service/camera_mode_manager \
       src/application/camera/camera_mode_manager

# camera_system_orchestrator
git mv src/domain/camera/application_service/camera_system_orchestrator \
       src/application/camera/camera_system_orchestrator

# layer.ts
git mv src/domain/camera/application_service/layer.ts \
       src/application/camera/layers.ts

# index.ts
git mv src/domain/camera/application_service/index.ts \
       src/application/camera/index.ts

# 空ディレクトリ削除
rm -rf src/domain/camera/application_service
```

**成功条件**: git履歴が保持される

#### Step 5: git mv実行（world）（15分）

```bash
git mv src/domain/world/application_service/cache_optimization \
       src/application/world/cache_optimization
git mv src/domain/world/application_service/performance_monitoring \
       src/application/world/performance_monitoring
git mv src/domain/world/application_service/progressive_loading \
       src/application/world/progressive_loading
git mv src/domain/world/application_service/world_generation_orchestrator \
       src/application/world/world_generation_orchestrator
git mv src/domain/world/application_service/layer.ts \
       src/application/world/layers.ts
git mv src/domain/world/application_service/index.ts \
       src/application/world/index.ts
git mv src/domain/world/application_service/factory.ts \
       src/application/world/factory.ts

rm -rf src/domain/world/application_service
```

#### Step 6: git mv実行（inventory）（15分）

```bash
git mv src/domain/inventory/application_service/container_manager \
       src/application/inventory/container_manager
git mv src/domain/inventory/application_service/inventory_manager \
       src/application/inventory/inventory_manager
git mv src/domain/inventory/application_service/transaction_manager \
       src/application/inventory/transaction_manager
git mv src/domain/inventory/application_service/types \
       src/application/inventory/types
git mv src/domain/inventory/application_service/layer.ts \
       src/application/inventory/layers.ts
git mv src/domain/inventory/application_service/index.ts \
       src/application/inventory/index.ts

rm -rf src/domain/inventory/application_service
```

#### Step 7: git mv実行（残り6コンテキスト）（60分）

```bash
# physics
git mv src/domain/physics/application_service/performance_monitor_service.ts \
       src/application/physics/performance_monitor_service.ts
git mv src/domain/physics/application_service/physics_simulation_orchestrator.ts \
       src/application/physics/physics_simulation_orchestrator.ts
git mv src/domain/physics/application_service/player_physics_service.ts \
       src/application/physics/player_physics_service.ts
git mv src/domain/physics/application_service/world_collision_service.ts \
       src/application/physics/world_collision_service.ts
git mv src/domain/physics/application_service/index.ts \
       src/application/physics/index.ts
rm -rf src/domain/physics/application_service

# crafting
git mv src/domain/crafting/application_service/crafting_engine.ts \
       src/application/crafting/crafting_engine.ts
git mv src/domain/crafting/application_service/recipe_registry.ts \
       src/application/crafting/recipe_registry.ts
git mv src/domain/crafting/application_service/index.ts \
       src/application/crafting/index.ts
rm -rf src/domain/crafting/application_service

# equipment
git mv src/domain/equipment/application_service/service.ts \
       src/application/equipment/service.ts
git mv src/domain/equipment/application_service/index.ts \
       src/application/equipment/index.ts
rm -rf src/domain/equipment/application_service

# interaction
git mv src/domain/interaction/application_service/session_manager.ts \
       src/application/interaction/session_manager.ts
git mv src/domain/interaction/application_service/index.ts \
       src/application/interaction/index.ts
rm -rf src/domain/interaction/application_service

# chunk
git mv src/domain/chunk/application_service/chunk_data_provider.ts \
       src/application/chunk/chunk_data_provider.ts
git mv src/domain/chunk/application_service/index.ts \
       src/application/chunk/index.ts
rm -rf src/domain/chunk/application_service

# chunk_manager
git mv src/domain/chunk_manager/application_service/chunk_lifecycle_provider.ts \
       src/application/chunk_manager/chunk_lifecycle_provider.ts
git mv src/domain/chunk_manager/application_service/index.ts \
       src/application/chunk_manager/index.ts
rm -rf src/domain/chunk_manager/application_service
```

**検証**:

```bash
find src/domain -name "application_service" -type d
# 期待結果: 0件
```

---

### Phase 3: import文更新（所要時間: 2時間）

#### Step 8: 直接import更新（7ファイル）（30分）

##### 8-1: src/domain/camera/application_service配下のコメント更新

```bash
# player_camera/index.ts
sed -i '' "s|@/domain/camera/application_service/player_camera|@/application/camera/player_camera|g" \
  src/application/camera/player_camera/index.ts

# scene_camera/index.ts
sed -i '' "s|@/domain/camera/application_service/scene_camera|@/application/camera/scene_camera|g" \
  src/application/camera/scene_camera/index.ts

# index.ts
sed -i '' "s|@/domain/camera/application_service|@/application/camera|g" \
  src/application/camera/index.ts
```

##### 8-2: src/domain/world配下の3ファイル更新

```bash
# helpers.ts
sed -i '' "s|from '@domain/world/application_service'|from '@application/world'|g" \
  src/domain/world/helpers.ts

# layers.ts
sed -i '' "s|from '@domain/world/application_service'|from '@application/world/layers'|g" \
  src/domain/world/layers.ts

# domain.ts
sed -i '' "s|from '@domain/world/application_service'|from '@application/world'|g" \
  src/domain/world/domain.ts
```

##### 8-3: 各コンテキストのindex.ts更新（再エクスポート削除）

```bash
# inventory
sed -i '' "/export \* from '\.\/application_service'/d" \
  src/domain/inventory/index.ts

# crafting
sed -i '' "/export \* from '\.\/application_service'/d" \
  src/domain/crafting/index.ts

# interaction
sed -i '' "/export \* from '\.\/application_service'/d" \
  src/domain/interaction/index.ts

# chunk_manager
sed -i '' "/export \* from '\.\/application_service'/d" \
  src/domain/chunk_manager/index.ts
```

##### 8-4: equipment/types.ts更新

```bash
sed -i '' "s|from '\.\/application_service'|from '@application/equipment'|g" \
  src/domain/equipment/types.ts
```

##### 8-5: crafting配下の依存ファイル更新

```bash
# repository/crafting_history_repository.ts
sed -i '' "s|from '\.\./application_service'|from '@application/crafting'|g" \
  src/domain/crafting/repository/crafting_history_repository.ts

# factory/crafting_session_factory.ts
sed -i '' "s|from '\.\./application_service'|from '@application/crafting'|g" \
  src/domain/crafting/factory/crafting_session_factory.ts
```

##### 8-6: interaction/layer.ts更新

```bash
sed -i '' "s|from '\.\/application_service'|from '@application/interaction'|g" \
  src/domain/interaction/layer.ts
```

**検証**:

```bash
grep -r "from.*domain/.*/application_service" src --include="*.ts"
# 期待結果: 0件
```

#### Step 9: 間接import検証（30分）

**目的**: barrel import経由でApplication Serviceを使用している箇所の特定

```bash
# 各コンテキストへのbarrel importを検索
grep -r "from '@domain/\(camera\|world\|inventory\|physics\|crafting\|equipment\|interaction\|chunk\|chunk_manager\)'" \
  src --include="*.ts" --exclude-dir=node_modules \
  > barrel_imports.txt

# Application Serviceを実際に使用している箇所を手動確認
# （自動検出は困難なため、型チェックで確認）
```

**成功条件**: barrel_imports.txtの作成

#### Step 10: tsconfig.json paths更新（10分）

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@application/*": ["./src/application/*"], // 追加
      "@domain/*": ["./src/domain/*"],
      "@infrastructure/*": ["./src/infrastructure/*"],
      "@presentation/*": ["./src/presentation/*"]
    }
  }
}
```

**検証**:

```bash
pnpm typecheck
# エラーが出た箇所を1つずつ修正
```

#### Step 11: 型エラー全修正（50分）

**実施内容**:

1. `pnpm typecheck`実行
2. エラーメッセージから修正箇所特定
3. import文更新
4. 再度`pnpm typecheck`
5. エラー0件になるまで繰り返し

**成功条件**: `pnpm typecheck`がエラー0件

---

### Phase 4: Layer再構築（所要時間: 3時間）

#### Step 12: Domain Layer分離（90分）

##### 12-1: camera Domain Layer作成

```typescript
// src/domain/camera/layers.ts（既存ファイル修正）
import { Layer } from 'effect'
import {
  CameraControlServiceLive,
  AnimationEngineServiceLive,
  CollisionDetectionServiceLive,
  SettingsValidatorServiceLive,
  ViewModeManagerServiceLive,
} from './domain_service'
import {
  CameraStateRepositoryLive,
  SettingsStorageRepositoryLive,
  AnimationHistoryRepositoryLive,
  ViewModePreferencesRepositoryLive,
} from './repository'

export const CameraDomainLive = Layer.mergeAll(
  CameraControlServiceLive,
  AnimationEngineServiceLive,
  CollisionDetectionServiceLive,
  SettingsValidatorServiceLive,
  ViewModeManagerServiceLive,
  CameraStateRepositoryLive,
  SettingsStorageRepositoryLive,
  AnimationHistoryRepositoryLive,
  ViewModePreferencesRepositoryLive
)
```

##### 12-2: world Domain Layer作成

```typescript
// src/domain/world/layers.ts（既存ファイル修正）
import { Layer } from 'effect'
import { WorldAggregateLive, WorldEventPublishersLive } from './aggregate'

export const WorldDomainLive = Layer.mergeAll(
  WorldAggregateLive,
  WorldEventPublishersLive
  // Domain Services（要追加）
  // Repositories（要追加）
)
```

##### 12-3: inventory Domain Layer作成

```typescript
// src/domain/inventory/layers.ts（新規作成）
import { Layer } from 'effect'
// import Domain Services
// import Repositories

export const InventoryDomainLive = Layer
  .mergeAll
  // Domain Services
  // Repositories
  ()
```

##### 12-4: 残り6コンテキストのDomain Layer作成（physics, crafting, equipment, interaction, chunk, chunk_manager）

**成功条件**: 各domain/{context}/layers.tsの作成完了

#### Step 13: Application Layer作成（90分）

##### 13-1: camera Application Layer

```typescript
// src/application/camera/layers.ts（移動済みファイル修正）
import { Layer } from 'effect'
import {
  PlayerCameraApplicationServiceLive,
  SceneCameraApplicationServiceLive,
  CameraModeManagerApplicationServiceLive,
  CameraSystemOrchestratorServiceLive,
} from './index'
import { CameraDomainLive } from '@domain/camera/layers'

export const CameraApplicationLive = Layer.mergeAll(
  PlayerCameraApplicationServiceLive,
  SceneCameraApplicationServiceLive,
  CameraModeManagerApplicationServiceLive,
  CameraSystemOrchestratorServiceLive
).pipe(Layer.provide(CameraDomainLive))
```

##### 13-2: world Application Layer

```typescript
// src/application/world/layers.ts（移動済みファイル修正）
import { Layer } from 'effect'
import {
  WorldApplicationService,
  makeWorldApplicationService,
  WorldGenerationOrchestrator,
  ProgressiveLoadingService,
  CacheOptimizationService,
  PerformanceMonitoringService,
} from './index'
import { WorldDomainLive } from '@domain/world/layers'

const WorldApplicationServiceLive = Layer.effect(WorldApplicationService, makeWorldApplicationService).pipe(
  Layer.provide(WorldGenerationOrchestrator),
  Layer.provide(ProgressiveLoadingService),
  Layer.provide(CacheOptimizationService),
  Layer.provide(PerformanceMonitoringService)
)

export const WorldApplicationLive = WorldApplicationServiceLive.pipe(Layer.provide(WorldDomainLive))
```

##### 13-3: 残り7コンテキストのApplication Layer作成

**成功条件**: 各application/{context}/layers.tsの作成完了

---

### Phase 5: 検証（所要時間: 1時間）

#### Step 14: ビルド検証（30分）

```bash
# 型チェック
pnpm typecheck
# 期待結果: エラー0件

# Lint
pnpm lint
# 期待結果: 警告0件

# ビルド
pnpm build
# 期待結果: ビルド成功
```

**成功条件**: すべてのチェックが成功

#### Step 15: テスト検証（30分）

```bash
# 単体テスト
pnpm test
# 期待結果: すべてのテスト成功

# カバレッジ
pnpm coverage
# 期待結果: カバレッジ低下なし
```

**成功条件**: すべてのテスト成功

---

## 📊 6. 移行完了後の検証項目

### 6.1 ディレクトリ構造検証

```bash
# application_serviceディレクトリの完全削除確認
find src/domain -name "application_service" -type d
# 期待結果: 0件

# 新しいapplicationディレクトリ構造確認
ls -la src/application/
# 期待結果: camera, world, inventory, physics, crafting, equipment, interaction, chunk, chunk_manager
```

### 6.2 import文検証

```bash
# domain/.../application_service へのimportが残っていないか確認
grep -r "from.*domain/.*/application_service" src --include="*.ts"
# 期待結果: 0件

# 新しいapplicationディレクトリへのimport確認
grep -r "from.*@application/" src --include="*.ts" | wc -l
# 期待結果: 30-50件程度
```

### 6.3 Layer定義検証

```bash
# 各コンテキストのDomain Layer確認
ls -la src/domain/*/layers.ts
# 期待結果: 9ファイル（camera, world, inventory, physics, crafting, equipment, interaction, chunk, chunk_manager）

# 各コンテキストのApplication Layer確認
ls -la src/application/*/layers.ts
# 期待結果: 9ファイル
```

### 6.4 品質メトリクス検証

```bash
# ビルドサイズ確認
pnpm build
ls -lh dist/
# 期待結果: ビルドサイズが大幅に増加していないこと

# 型チェック速度確認
time pnpm typecheck
# 期待結果: 型チェック速度が大幅に低下していないこと
```

---

## 📈 7. 成功条件サマリー

### 必須条件（すべて達成必要）

- ✅ domain層にapplication_serviceディレクトリが0件
- ✅ application層に9コンテキストのディレクトリが作成
- ✅ `pnpm typecheck`がエラー0件
- ✅ `pnpm test`がすべて成功
- ✅ `pnpm build`が成功
- ✅ domain/.../application_service へのimportが0件

### 推奨条件（可能な限り達成）

- ✅ テストカバレッジ維持率 = 100%
- ✅ ビルドサイズ増加率 < 5%
- ✅ 型チェック速度低下率 < 10%
- ✅ Lint警告0件

---

## 🎯 8. リスク評価と対策

### 高リスク項目

#### リスク1: 型チェックエラーの大量発生

**発生確率**: 60%
**影響度**: 大
**対策**:

- Step 10で段階的に修正
- 1コンテキストずつ移動して検証する戦略も検討

#### リスク2: テスト失敗

**発生確率**: 40%
**影響度**: 中
**対策**:

- モックの更新（import pathの変更）
- テストファイルのimport文更新を忘れずに実施

### 中リスク項目

#### リスク3: 循環依存の発生

**発生確率**: 20%
**影響度**: 大
**対策**:

- Layer提供順序を厳密に検証
- 依存関係マップ（Step 3）を参照しながら実施

#### リスク4: git履歴の喪失

**発生確率**: 10%
**影響度**: 中
**対策**:

- 必ず`git mv`を使用（`mv`を使わない）
- 移動前にブランチ作成

---

## 📝 9. 総合評価

### 実装難易度: **中**

**理由**:

- 直接的なimport更新は7件のみで少ない
- Layer再構築は明確なパターンあり
- 循環依存リスクは低い

### 所要時間: **6-8時間**（当初見積もり比: **1/3-1/4**）

**内訳**:

- 準備: 0.5時間
- ファイル移動: 2時間
- import更新: 2時間
- Layer再構築: 3時間
- 検証: 1時間

### リスクレベル: **中**

**理由**:

- 型エラー修正に時間がかかる可能性
- テストの更新漏れリスク
- ただし、循環依存リスクは低い

### 推奨実施方法: **段階的実施（1コンテキストずつ）**

**理由**:

- 一括実施は型エラー修正が困難
- 1コンテキストずつなら問題の切り分けが容易
- リスク最小化

**実施順序推奨**:

1. equipment（最小規模）← 練習
2. interaction（中規模）
3. chunk（中規模）
4. chunk_manager（中規模）
5. crafting（要責務再分類）
6. physics（大規模）
7. inventory（大規模）
8. world（大規模・複雑）
9. camera（最大規模）← 最後

---

## ✅ 10. 次のアクションアイテム

1. **Step 1-3の実施**（準備フェーズ）
2. **equipmentコンテキストで試験実施**（小規模で検証）
3. **問題なければ残り8コンテキストを順次実施**
4. **完了後、メモリに実装パターンを記録**（`write_memory`）

---

**作成日**: 2025-10-07
**調査者**: Claude Code (Anthropic AI)
**調査基準**: DDD原則、Effect-TSベストプラクティス、TypeScript設計パターン
