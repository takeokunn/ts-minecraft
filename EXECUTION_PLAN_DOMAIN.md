# Domain Layer Refactoring Execution Plan

## 概要
`src/domain`配下のコードベースをEffect-TS準拠に移行し、型安全性を向上させ、テストカバレッジ100%を目指す実行計画書。

## 現状分析

### 主要な問題点
1. **型の問題（500箇所以上）**
   - `any`型の使用（unknownに置き換え必要）
   - `as`による型アサーション（約200箇所）
   - `!`による非nullアサーション
   - 不適切な型推論への依存

2. **クラスの存在**
   - TaggedErrorクラスの継承
   - サービスクラス（RaycastDomainService等）

3. **命名規則の不統一**
   - `.vo.ts`、`.entity.ts`、`.service.ts`の混在
   - ファイル名と内容の不一致

4. **未使用コード**
   - 外部から参照されていないexport
   - 不要なtype alias

## 実行フェーズ

### Phase 1: 基盤整備（優先度: 最高）

#### 1.1 型定義の厳密化
```typescript
// Before（問題のあるコード）
export type SoAResult<C extends Record<string, S.Schema<any, any, any>>> = {...}
validateError: (error: any): Effect.Effect<...>

// After（改善後）
export type SoAResult<C extends Record<string, S.Schema.Schema<unknown, unknown>>> = {...}
validateError: (error: unknown): Effect.Effect<ValidatedError, ValidationError>
// 内部で型ガードを使用してエラーを適切に処理
```

**対象ファイル:**
- `src/domain/types/type-utils.ts`
- `src/domain/errors/*.ts`
- `src/domain/services/ecs/*.ts`

#### 1.2 anyの排除とunknownへの移行
```typescript
// Before（危険）
function processData(data: any) {
  return data.value // 型チェックなし
}

// After（安全）
function processData(data: unknown): Effect.Effect<ProcessedData, ValidationError> {
  return pipe(
    data,
    S.decode(DataSchema), // 型ガードとバリデーション
    Effect.map(validated => validated.value)
  )
}
```

#### 1.3 Schema定義の改善
```typescript
// unknownを適切に使用したSchema定義
export interface ComponentSchema<A, I = A, R = never> extends S.Schema.Schema<A, I, R> {}
schema: S.optional(ComponentSchema<ComponentData>)
```

### Phase 2: エラーハンドリングの統一（優先度: 高）

#### 2.1 エラークラスの関数化
```typescript
// Before
export class WorldRepositoryError extends Data.TaggedError('WorldRepositoryError')<{...}> {}

// After
export const WorldRepositoryError = S.TaggedError<WorldRepositoryError>()('WorldRepositoryError', {
  message: S.String,
  entityId: S.optional(EntityId),
  cause: S.optional(S.Unknown)
})
export interface WorldRepositoryError extends S.Schema.Schema.Type<typeof WorldRepositoryError> {}
```

**対象:**
- 全エラークラス（約30個）

### Phase 3: サービスレイヤーのリファクタリング（優先度: 高）

#### 3.1 クラスから関数への移行
```typescript
// Before
export class RaycastDomainService extends Context.Tag('RaycastDomainService')<...> {}

// After
export const RaycastDomainService = Context.GenericTag<RaycastDomainService>(
  'RaycastDomainService'
)
export interface RaycastDomainService {
  readonly raycast: (ray: Ray) => Effect.Effect<RaycastResult, RaycastError>
}
```

### Phase 4: Value Objectsの改善（優先度: 中）

#### 4.1 ファイル名の統一
```bash
# Rename
*.vo.ts → *.value-object.ts
```

#### 4.2 型アサーションの除去とunknownの活用
```typescript
// Before（型アサーションを使用）
return component as Components[T]
const nextId = state.nextEntityId as EntityId

// After（unknownから安全に変換）
function getComponent<T>(data: unknown): Effect.Effect<Components[T], ParseError> {
  return S.decode(ComponentSchemas[T])(data)
}

function createEntityId(value: unknown): Effect.Effect<EntityId, ValidationError> {
  return pipe(
    value,
    S.decode(S.Number),
    Effect.flatMap(EntityId.make)
  )
}
```

### Phase 5: ECSシステムの型安全化（優先度: 中）

#### 5.1 Component System
```typescript
// Before
validate: (name: ComponentName, data: unknown) => Effect.Effect<ComponentData, ComponentValidationError>

// After
validate: <T extends ComponentName>(
  name: T,
  data: unknown
): Effect.Effect<ComponentOfName<T>, ComponentValidationError>
```

### Phase 6: 不要コードの削除（優先度: 低）

#### 6.1 未使用exportの削除
- type aliasの整理
- 重複定義の削除
- @deprecated コードの完全削除

#### 6.2 ファイル統合
- 細分化されすぎたファイルの統合
- index.tsの整理

## テスト戦略

### テストディレクトリ構造
```
src/domain/__tests__/
├── value-objects/
│   ├── position.test.ts
│   ├── chunk-coordinate.test.ts
│   └── ...
├── entities/
│   ├── world.test.ts
│   ├── player.test.ts
│   └── ...
├── services/
│   ├── terrain-generation.test.ts
│   ├── physics-domain.test.ts
│   └── ...
├── errors/
│   └── error-handling.test.ts
└── integration/
    └── domain-integration.test.ts
```

### Vitest設定
```typescript
// vitest.config.domain.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/domain/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/domain/**/*.ts'],
      exclude: [
        'src/domain/**/*.test.ts',
        'src/domain/**/index.ts',
        'src/domain/**/*.d.ts'
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    },
    globals: true,
    environment: 'node'
  }
})
```

### テストパターン

#### 1. Value Object Tests
```typescript
describe('Position', () => {
  it('should create valid position', () => {
    const result = Position.make({ x: 1, y: 2, z: 3 })
    expect(Effect.runSync(result)).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('should fail for invalid position', () => {
    const result = Position.make({ x: NaN, y: 2, z: 3 })
    expect(() => Effect.runSync(result)).toThrow()
  })
})
```

#### 2. Service Tests
```typescript
describe('TerrainGenerationService', () => {
  const service = pipe(
    TerrainGenerationDomainServiceLive,
    Layer.provideMerge(TestDependencies)
  )

  it('should generate chunk', () => {
    const program = pipe(
      TerrainGenerationDomainService,
      Effect.flatMap(s => s.generateChunk({ x: 0, z: 0 }))
    )
    
    const result = Effect.runSync(
      pipe(program, Effect.provide(service))
    )
    
    expect(result.blocks).toHaveLength(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
  })
})
```

#### 3. Error Handling Tests
```typescript
describe('Error Handling', () => {
  it('should handle entity not found', () => {
    const error = EntityNotFoundError({
      message: 'Entity not found',
      entityId: 'test-id'
    })
    
    expect(error._tag).toBe('EntityNotFoundError')
    expect(error.entityId).toBe('test-id')
  })
})
```

## 実装優先順位

### Week 1-2: Critical Issues
1. ✅ `any`型の排除（`unknown`への移行）
2. ✅ 型アサーション(`as`)の除去
3. ✅ 非nullアサーション(`!`)の除去
4. ✅ 適切な型ガードの実装

### Week 3-4: Structural Improvements
1. ✅ エラークラスの関数化
2. ✅ サービスクラスの関数化
3. ✅ ファイル名の統一

### Week 5-6: Test Implementation
1. ✅ 単体テストの実装
2. ✅ 統合テストの実装
3. ✅ カバレッジ100%達成

### Week 7-8: Optimization & Cleanup
1. ✅ 未使用コードの削除
2. ✅ パフォーマンス最適化
3. ✅ ドキュメント更新

## 成功指標

### 必須要件
- [ ] TypeScript strict modeでエラー0
- [ ] `any`型の使用0（全て`unknown`に移行）
- [ ] 型アサーション使用0
- [ ] `unknown`型の適切な型ガード実装
- [ ] テストカバレッジ100%
- [ ] Effect-TS準拠のエラーハンドリング

### 品質指標
- [ ] ビルド時間の改善（目標: 20%削減）
- [ ] バンドルサイズの削減（目標: 15%削減）
- [ ] 型推論の改善
- [ ] IDE補完の向上

## リスクと対策

### リスク1: 破壊的変更による影響
**対策:** 
- 段階的な移行
- 後方互換性レイヤーの提供
- 十分なテストカバレッジ

### リスク2: パフォーマンス低下
**対策:**
- ベンチマークテストの実施
- プロファイリングツールの活用
- 最適化の継続的実施

### リスク3: 学習コスト
**対策:**
- Effect-TSのベストプラクティスドキュメント作成
- コードレビューの徹底
- ペアプログラミングセッション

## 実装チェックリスト

### Phase 1
- [ ] type-utils.tsの型厳密化
- [ ] error-utils.tsの改善
- [ ] Schema定義の統一

### Phase 2
- [ ] TaggedError → 関数型エラー
- [ ] エラーファクトリーの実装
- [ ] エラーハンドリングユーティリティ

### Phase 3
- [ ] RaycastDomainServiceの関数化
- [ ] 他サービスクラスの関数化
- [ ] Context/Layerの整理

### Phase 4
- [ ] ファイル名リネーム
- [ ] 型アサーション除去
- [ ] Branded型の活用

### Phase 5
- [ ] Component型の厳密化
- [ ] Query Builderの型安全化
- [ ] Archetype Systemの改善

### Phase 6
- [ ] 未使用export削除
- [ ] ファイル統合
- [ ] index.ts整理

## 完了条件

1. **全ての型問題が解決**
   - `tsc --noEmit`でエラー0
   - strict: trueで動作

2. **テストカバレッジ100%**
   - 全ファイルにテスト存在
   - E2Eテストも含む

3. **Effect-TS完全準拠**
   - 全エラーがTaggedError
   - 全サービスがContext/Layer
   - 副作用の適切な管理

4. **クリーンなコードベース**
   - 未使用コード0
   - 一貫した命名規則
   - 適切なドキュメント

## 次のステップ

1. この計画書のレビューと承認
2. Phase 1の実装開始
3. 週次進捗レビュー
4. 継続的な改善とフィードバック

---

*Last Updated: 2025-09-12*
*Author: Domain Architecture Team*
*Version: 1.0.0*