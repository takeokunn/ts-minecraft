# 実行計画書: src/config モジュールのEffect-TS移行

## 📋 概要

`src/config`配下のコードをEffect-TSの設計思想に準拠させ、型安全性を強化し、100%のテストカバレッジを達成するための実行計画書です。

## 🎯 目標

1. **Effect-TS完全準拠**: 全ての設定管理をEffect-TSパターンで実装
2. **型安全性の強化**: any, unknown, as, ! の完全排除
3. **クラスの撲滅**: 全てを関数型プログラミングパターンへ移行
4. **命名規則の統一**: ケバブケースでのファイル名統一
5. **不要コードの削除**: 未使用エクスポートと依存の削除
6. **テストカバレッジ100%**: Vitestによる完全なテストカバー

## 📊 現状分析

### 現在のファイル構成
```
src/config/
├── index.ts                    # バレルエクスポート
├── app.config.ts              # アプリケーション設定（Effect/Schema使用済み）
├── game.config.ts             # ゲーム設定（interface使用、非Effect）
├── infrastructure.config.ts   # インフラ設定（interface使用、非Effect）
└── config-utils.ts           # 設定ユーティリティ（部分的にEffect使用）
```

### 識別された問題点

#### 1. 型定義の問題
- `game.config.ts`: interfaceを使用（GameConfig）
- `infrastructure.config.ts`: interfaceを使用（InfrastructureConfig）
- `config-utils.ts`: 型アサーション使用（line 112-113）
- 手動バリデーションの存在（validateGameConfig, validateInfrastructureConfig）

#### 2. 命名規則の不整合
- 現在: `app.config.ts`, `game.config.ts`（ドット記法）
- 目標: `app-config.ts`, `game-config.ts`（ケバブケース）

#### 3. Effect-TS非準拠のコード
- `game.config.ts`: 完全に非Effect（手動バリデーション、localStorage直接アクセス）
- `infrastructure.config.ts`: 完全に非Effect（手動バリデーション、グローバル参照）
- `config-utils.ts`: Effect.tryPromiseの不適切な使用

#### 4. クラスの存在
- `ConfigValidationError`クラスが存在（config-utils.ts）

#### 5. 外部依存の確認結果
- **良いニュース**: src/config配下のコードは他のモジュールから直接参照されていない
- 検索で見つかったCONFIG参照は別のローカルCONFIG定数

## 🚀 実行計画

### Phase 1: 準備とセットアップ（1時間）

#### 1.1 テスト環境の整備
```typescript
// src/config/__tests__/test-utils.ts
import { Effect, TestClock, TestContext } from 'effect'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

export const createTestConfig = () => {...}
export const mockEnvironment = (env: string) => {...}
```

#### 1.2 共通スキーマ定義の作成
```typescript
// src/config/schemas/common.schema.ts
import * as S from 'effect/Schema'

export const PositiveNumber = S.Number.pipe(
  S.positive(),
  S.annotations({ description: "A positive number" })
)

export const NonEmptyString = S.String.pipe(
  S.nonEmpty(),
  S.annotations({ description: "A non-empty string" })
)

export const Percentage = S.Number.pipe(
  S.between(0, 1),
  S.annotations({ description: "A percentage value between 0 and 1" })
)
```

### Phase 2: GameConfig の Effect-TS 移行（2時間）

#### 2.1 スキーマ定義の作成
```typescript
// src/config/schemas/game.schema.ts
import * as S from 'effect/Schema'
import { PositiveNumber } from './common.schema'

export const WorldConfigSchema = S.Struct({
  seed: S.Number,
  chunkSize: PositiveNumber,
  renderDistance: S.Number.pipe(S.between(1, 32)),
  maxLoadedChunks: PositiveNumber,
  worldHeight: PositiveNumber,
  seaLevel: S.Number,
  generateCaves: S.Boolean,
  generateOres: S.Boolean,
  generateStructures: S.Boolean,
})

export const PlayerConfigSchema = S.Struct({
  defaultGameMode: S.Literal('survival', 'creative', 'adventure', 'spectator'),
  spawnPosition: S.Struct({
    x: S.Number,
    y: S.Number,
    z: S.Number,
  }),
  // ... 他のフィールド
})

// ... 他のスキーマ定義

export const GameConfigSchema = S.Struct({
  world: WorldConfigSchema,
  player: PlayerConfigSchema,
  physics: PhysicsConfigSchema,
  gameplay: GameplayConfigSchema,
  performance: PerformanceConfigSchema,
  graphics: GraphicsConfigSchema,
  audio: AudioConfigSchema,
  controls: ControlsConfigSchema,
})
```

#### 2.2 Effectベースのサービス実装
```typescript
// src/config/services/game-config.service.ts
import { Effect, Layer, Context, Ref, Config } from 'effect'
import * as S from 'effect/Schema'
import { GameConfigSchema } from '../schemas/game.schema'

export class GameConfigService extends Context.Tag('GameConfigService')<
  GameConfigService,
  {
    readonly get: Effect.Effect<GameConfig>
    readonly update: (config: Partial<GameConfig>) => Effect.Effect<void>
    readonly load: Effect.Effect<GameConfig>
    readonly save: (config: GameConfig) => Effect.Effect<void>
  }
>() {}

export const GameConfigServiceLive = Layer.effect(
  GameConfigService,
  Effect.gen(function* () {
    const configRef = yield* Ref.make(defaultGameConfig)
    
    return {
      get: Ref.get(configRef),
      update: (partial) => 
        Ref.update(configRef, (current) => ({
          ...current,
          ...partial
        })),
      load: Effect.gen(function* () {
        const stored = yield* Storage.get('game-config')
        const decoded = yield* S.decodeUnknown(GameConfigSchema)(stored)
        yield* Ref.set(configRef, decoded)
        return decoded
      }),
      save: (config) => 
        Effect.gen(function* () {
          const encoded = yield* S.encode(GameConfigSchema)(config)
          yield* Storage.set('game-config', encoded)
        })
    }
  })
)
```

### Phase 3: InfrastructureConfig の Effect-TS 移行（2時間）

#### 3.1 型ガードの削除とスキーマ化
```typescript
// src/config/schemas/infrastructure.schema.ts
import * as S from 'effect/Schema'

export const DeviceMemorySchema = S.Number.pipe(
  S.positive(),
  S.annotations({ description: "Device memory in GB" })
)

export const RenderingConfigSchema = S.Struct({
  engine: S.Literal('three', 'webgpu'),
  preferWebGPU: S.Boolean,
  canvas: S.Struct({
    antialias: S.Boolean,
    alpha: S.Boolean,
    powerPreference: S.Literal('default', 'high-performance', 'low-power'),
    preserveDrawingBuffer: S.Boolean,
  }),
  // ... 他のフィールド
})

// ... 他のスキーマ定義
```

#### 3.2 能力検出のEffect化
```typescript
// src/config/services/capability-detection.service.ts
import { Effect, Layer, Context } from 'effect'

export class CapabilityDetectionService extends Context.Tag('CapabilityDetectionService')<
  CapabilityDetectionService,
  {
    readonly detectWebGL2: Effect.Effect<boolean>
    readonly detectWebGPU: Effect.Effect<boolean>
    readonly detectWorkers: Effect.Effect<boolean>
    readonly detectSharedArrayBuffer: Effect.Effect<boolean>
    readonly detectAll: Effect.Effect<Capabilities>
  }
>() {}

export const CapabilityDetectionServiceLive = Layer.succeed(
  CapabilityDetectionService,
  {
    detectWebGL2: Effect.sync(() => {
      const canvas = document.createElement('canvas')
      return !!canvas.getContext('webgl2')
    }),
    detectWebGPU: Effect.sync(() => !!navigator.gpu),
    // ... 他の検出メソッド
  }
)
```

### Phase 4: ConfigUtils の改善（1時間）

#### 4.1 クラスからタグ付きエラーへの移行
```typescript
// src/config/errors/config-errors.ts
import * as S from 'effect/Schema'

export class ConfigValidationError extends S.TaggedError<ConfigValidationError>()(
  'ConfigValidationError',
  {
    section: S.String,
    details: S.String,
    cause: S.optional(S.Unknown),
  }
) {}

export class ConfigLoadError extends S.TaggedError<ConfigLoadError>()(
  'ConfigLoadError',
  {
    source: S.Literal('file', 'environment', 'storage'),
    message: S.String,
  }
) {}
```

#### 4.2 統合設定サービスの実装
```typescript
// src/config/services/config.service.ts
import { Effect, Layer, Context } from 'effect'

export class ConfigService extends Context.Tag('ConfigService')<
  ConfigService,
  {
    readonly getApp: Effect.Effect<AppConfig>
    readonly getGame: Effect.Effect<GameConfig>
    readonly getInfrastructure: Effect.Effect<InfrastructureConfig>
    readonly reload: Effect.Effect<void, ConfigValidationError>
    readonly validate: Effect.Effect<boolean, ConfigValidationError>
  }
>() {}

export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const appConfig = yield* AppConfigService
    const gameConfig = yield* GameConfigService
    const infraConfig = yield* InfrastructureConfigService
    
    return {
      getApp: appConfig.get,
      getGame: gameConfig.get,
      getInfrastructure: infraConfig.get,
      reload: Effect.all([
        appConfig.reload(),
        gameConfig.reload(),
        infraConfig.reload(),
      ]).pipe(Effect.asVoid),
      validate: Effect.all([
        appConfig.validate(),
        gameConfig.validate(),
        infraConfig.validate(),
      ]).pipe(Effect.map(() => true))
    }
  })
).pipe(
  Layer.provide(AppConfigServiceLive),
  Layer.provide(GameConfigServiceLive),
  Layer.provide(InfrastructureConfigServiceLive)
)
```

### Phase 5: ファイル名の修正（30分）

#### 5.1 リネーム計画
```bash
# 実行順序（依存関係を考慮）
1. app.config.ts → app-config.ts
2. game.config.ts → game-config.ts  
3. infrastructure.config.ts → infrastructure-config.ts
4. config-utils.ts → config-service.ts（機能に合わせて改名）
```

#### 5.2 インポートの更新
- 全ファイルのインポートパスを更新
- index.tsのエクスポートパスを更新

### Phase 6: テスト実装（3時間）

#### 6.1 AppConfig テスト
```typescript
// src/config/__tests__/app-config.test.ts
import { describe, it, expect } from 'vitest'
import { Effect, Exit } from 'effect'
import { AppConfigService } from '../services/app-config.service'
import { TestEnvironment } from './test-utils'

describe('AppConfig', () => {
  describe('Schema Validation', () => {
    it('should validate correct configuration', async () => {
      const result = await Effect.runPromiseExit(
        AppConfigService.validate(validConfig)
      )
      expect(Exit.isSuccess(result)).toBe(true)
    })

    it('should reject invalid log levels', async () => {
      const result = await Effect.runPromiseExit(
        AppConfigService.validate({
          ...validConfig,
          logging: { level: 'invalid' }
        })
      )
      expect(Exit.isFailure(result)).toBe(true)
    })
  })

  describe('Environment Detection', () => {
    it('should load development config in dev mode', async () => {
      const config = await Effect.runPromise(
        AppConfigService.get.pipe(
          Effect.provide(TestEnvironment.development)
        )
      )
      expect(config.environment).toBe('development')
      expect(config.debug).toBe(true)
    })
  })
})
```

#### 6.2 GameConfig テスト
```typescript
// src/config/__tests__/game-config.test.ts
describe('GameConfig', () => {
  describe('Validation Rules', () => {
    it('should enforce chunk size > 0', async () => {
      // テスト実装
    })

    it('should enforce render distance between 1-32', async () => {
      // テスト実装
    })

    it('should enforce FOV between 30-120', async () => {
      // テスト実装
    })
  })

  describe('User Preferences', () => {
    it('should load user preferences from storage', async () => {
      // テスト実装
    })

    it('should merge user preferences with defaults', async () => {
      // テスト実装
    })

    it('should handle corrupted storage gracefully', async () => {
      // テスト実装
    })
  })
})
```

#### 6.3 InfrastructureConfig テスト
```typescript
// src/config/__tests__/infrastructure-config.test.ts
describe('InfrastructureConfig', () => {
  describe('Capability Detection', () => {
    it('should detect WebGL2 support', async () => {
      // テスト実装
    })

    it('should fallback when WebGPU unavailable', async () => {
      // テスト実装
    })

    it('should adjust config for low memory devices', async () => {
      // テスト実装
    })
  })

  describe('Power of Two Validation', () => {
    it('should validate texture atlas size', async () => {
      // テスト実装
    })
  })
})
```

#### 6.4 統合テスト
```typescript
// src/config/__tests__/config-integration.test.ts
describe('Config Integration', () => {
  it('should load all configurations successfully', async () => {
    // テスト実装
  })

  it('should reload configurations', async () => {
    // テスト実装
  })

  it('should validate entire configuration', async () => {
    // テスト実装
  })
})
```

### Phase 7: 不要コードの削除（30分）

#### 7.1 削除対象
- 手動バリデーション関数（validateGameConfig, validateInfrastructureConfig）
- 型ガード関数（hasDeviceMemoryAPI, isPowerOfTwo）
- グローバル副作用（ファイル末尾のバリデーション実行）
- 未使用のエクスポート

#### 7.2 デプリケーション警告の追加
```typescript
// 移行期間中のみ
/**
 * @deprecated Use ConfigService.getGame() instead
 */
export const GAME_CONFIG = /* ... */
```

## 📈 テストカバレッジ戦略

### カバレッジ目標
- **Line Coverage**: 100%
- **Branch Coverage**: 100%
- **Function Coverage**: 100%
- **Statement Coverage**: 100%

### テストカテゴリ
1. **スキーマバリデーション**: 全ての入力パターン
2. **環境別設定**: development, production, test
3. **エラーハンドリング**: 全てのエラーケース
4. **副作用**: ストレージ、環境変数
5. **能力検出**: ブラウザAPI のモック
6. **統合**: サービス間の連携

## 🔄 移行手順

### Day 1: 準備とGameConfig
1. テスト環境のセットアップ
2. 共通スキーマの作成
3. GameConfigのEffect-TS移行
4. GameConfigのテスト実装

### Day 2: InfrastructureConfigとUtils
1. InfrastructureConfigのEffect-TS移行
2. ConfigUtilsの改善
3. 統合サービスの実装
4. InfrastructureConfigのテスト実装

### Day 3: 仕上げとクリーンアップ
1. ファイル名の修正
2. 不要コードの削除
3. 統合テストの実装
4. カバレッジの確認と改善
5. ドキュメントの更新

## ✅ 成功基準

1. **型安全性**
   - [ ] any, unknown, as, ! の完全排除
   - [ ] 全ての値がスキーマで検証される
   - [ ] コンパイルエラーゼロ

2. **Effect-TS準拠**
   - [ ] 全ての設定がEffectサービスとして実装
   - [ ] 副作用が適切に管理される
   - [ ] エラーが型安全に処理される

3. **コード品質**
   - [ ] クラスの完全排除
   - [ ] ファイル名がケバブケース
   - [ ] 未使用コードの削除

4. **テスト**
   - [ ] Vitest設定完了
   - [ ] 全ファイル100%カバレッジ
   - [ ] E2Eテストの実装

## 🚨 リスクと対策

### リスク1: 外部モジュールへの影響
- **対策**: 段階的なデプリケーション
- **方法**: 旧APIを維持しつつ新APIへ誘導

### リスク2: ランタイムエラー
- **対策**: 包括的なスキーマバリデーション
- **方法**: Effect.catchAllでのフォールバック

### リスク3: パフォーマンス劣化
- **対策**: 設定のキャッシング
- **方法**: Ref.makeでのメモ化

## 📝 備考

- 全ての変更はfeature/ddd-architecture-migration-v3ブランチで実施
- コミットは機能単位で細かく実施
- 各フェーズ完了時にテストを実行

## 🎯 期待される成果

1. **保守性の向上**: 型安全で予測可能なコード
2. **テスタビリティ**: 100%カバレッジによる信頼性
3. **拡張性**: Effectパターンによる柔軟な設計
4. **開発体験**: 明確なエラーメッセージと型補完