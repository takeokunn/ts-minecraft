# TypeScript Minecraft - DDD リファクタリング実行計画書 v6

## 概要
本計画書は、TypeScript Minecraftプロジェクトの包括的なリファクタリングを実行するための詳細な計画です。
Effect-TS準拠、型安全性の向上、DDD構造の最適化を目的とし、並列実行可能なタスクに分割されています。

## 現状分析サマリー

### 🟢 良好な点
- クラスベースのコードは存在しない（既に関数型に移行済み）
- DDD層構造（domain, application, infrastructure, presentation）が適切に分離
- Effect-TSの基本的な使用（Effect, Context, Layer, Schema等）

### 🔴 改善が必要な点

#### 1. 型安全性の問題
- **any型の使用**: 約20箇所（主にdomain/errorsとdomain/services）
- **unknown型の使用**: 約15箇所（エラーハンドリングとスキーマ定義）
- **as型キャスト**: 300箇所以上（特にdomain層に集中）
- **非null assertion (!)**: 使用なし（良好）

#### 2. DDD構造の問題
- domain層がinfrastructure層のインポートを含む箇所がある
- ポートとアダプターの分離が不完全
- サービス層の責務が不明確な箇所がある

#### 3. Effect-TS準拠の問題
- 純粋関数でない実装が散見される
- 副作用の管理が不適切
- Effectモナドの使用が不完全

#### 4. 命名規則の不整合
- `.vo.ts`（Value Object）と通常の`.ts`が混在
- サービスファイル名の不統一（`-domain.service.ts`と`.service.ts`）
- エクスポート時の型エイリアスが過剰

## 実行計画

### Phase 1: 型安全性の向上（並列実行可能）

#### Task 1.1: any型の撲滅
**責任者**: Agent A
**対象ディレクトリ**: `src/domain/errors/`, `src/domain/types/`
```typescript
// Before
const error = (e: any) => e._tag

// After  
const error = <T extends { _tag: string }>(e: T) => e._tag
```

**詳細タスク**:
1. `domain/errors/error-utils.ts`: any型を具体的な型に置換
2. `domain/errors/generator.ts`: Schema型パラメータを明確化
3. `domain/errors/unified-errors.ts`: ErrorCategoriesの型を厳密化
4. `domain/types/type-utils.ts`: Schema型パラメータを具体化

#### Task 1.2: unknown型の適切な処理
**責任者**: Agent B
**対象ディレクトリ**: `src/domain/errors/validation-errors.ts`
```typescript
// Before
value: unknown

// After
value: Schema.Schema.Type<typeof ValidationSchema>
```

#### Task 1.3: 型キャスト(as)の除去 - Domain層
**責任者**: Agent C
**対象ディレクトリ**: `src/domain/services/`, `src/domain/entities/`
```typescript
// Before
return biome.surfaceBlock as BlockType

// After
return pipe(
  biome.surfaceBlock,
  Schema.decode(BlockTypeSchema)
)
```

**重点ファイル**:
- `terrain-generation.service.ts`: BlockType関連のキャスト
- `entity-domain.service.ts`: EntityId, ComponentName関連
- `mesh-generation.service.ts`: FaceDirection関連

#### Task 1.4: 型キャスト(as)の除去 - Infrastructure層
**責任者**: Agent D
**対象ディレクトリ**: `src/infrastructure/`, `src/application/`

### Phase 2: DDD構造の最適化（順次実行）

#### Task 2.1: ポート/アダプターの完全分離
**責任者**: Agent E
```typescript
// ポートの定義（domain層）
export interface ITerrainGeneratorPort {
  generate: (params: GenerateParams) => Effect.Effect<Terrain, TerrainError>
}

// アダプターの実装（infrastructure層）
export const TerrainGeneratorAdapter = Layer.succeed(
  ITerrainGeneratorPort,
  {
    generate: (params) => // 実装
  }
)
```

#### Task 2.2: サービス層の責務明確化
**責任者**: Agent F
- ドメインサービス: ビジネスロジックのみ
- アプリケーションサービス: ユースケースの調整
- インフラサービス: 技術的詳細の実装

### Phase 3: Effect-TS完全準拠（並列実行可能）

#### Task 3.1: 純粋関数への変換
**責任者**: Agent G
```typescript
// Before
let state = initialState
function updateState(value) {
  state = value
  return state
}

// After
const updateState = (value: Value) => 
  pipe(
    Ref.make(initialState),
    Effect.flatMap(ref => Ref.set(ref, value)),
    Effect.map(() => value)
  )
```

#### Task 3.2: 副作用の適切な管理
**責任者**: Agent H
```typescript
// Before
function saveToFile(data) {
  fs.writeFileSync('file.txt', data)
  return data
}

// After
const saveToFile = (data: Data) =>
  Effect.async<Data, FileError>((resume) => {
    fs.writeFile('file.txt', data, (err) => {
      if (err) resume(Effect.fail(new FileError(err)))
      else resume(Effect.succeed(data))
    })
  })
```

#### Task 3.3: Effectモナドの完全活用
**責任者**: Agent I
- Option/Eitherの適切な使用
- pipe/flowによる関数合成
- Effect.genによるdo記法の活用

### Phase 4: 命名規則の統一（並列実行可能）

#### Task 4.1: ファイル名の正規化
**責任者**: Agent J
```bash
# Value Objects
*.vo.ts → *.value-object.ts

# Domain Services  
*-domain.service.ts → *.domain-service.ts

# Application Services
*.use-case.ts → *.use-case.ts (維持)

# Infrastructure
*.adapter.ts → *.adapter.ts (維持)
*.repository.ts → *.repository.ts (維持)
```

#### Task 4.2: エクスポートの最適化
**責任者**: Agent K
```typescript
// Before
export { 
  WorldState as World,
  WorldState as WorldStateType,
  type WorldState as WorldStateInterface
}

// After
export { WorldState }
export type { WorldStateType }
```

### Phase 5: 未使用コードの削除（順次実行）

#### Task 5.1: デッドコードの特定と削除
**責任者**: Agent L
- 未使用のエクスポート
- 未参照の内部関数
- 廃止されたユーティリティ

#### Task 5.2: 重複コードの統合
**責任者**: Agent M
- 類似機能の統合
- 共通ロジックの抽出

## 実行スケジュール

### Week 1: Phase 1（型安全性）
- Day 1-2: Task 1.1, 1.2（any/unknown型の処理）
- Day 3-5: Task 1.3, 1.4（型キャストの除去）

### Week 2: Phase 2-3（DDD構造とEffect-TS）
- Day 1-2: Task 2.1（ポート/アダプター）
- Day 3-4: Task 2.2, 3.1（サービス層と純粋関数）
- Day 5: Task 3.2, 3.3（副作用管理）

### Week 3: Phase 4-5（命名規則とクリーンアップ）
- Day 1-2: Task 4.1, 4.2（命名規則）
- Day 3-5: Task 5.1, 5.2（未使用コード削除）

## 成功指標

### 定量的指標
- [ ] any型の使用: 0箇所
- [ ] unknown型の使用: 5箇所以下（必要最小限）
- [ ] 型キャスト(as)の使用: 10箇所以下
- [ ] 非null assertion(!)の使用: 0箇所
- [ ] TypeScriptのstrict modeでエラー: 0件

### 定性的指標
- [ ] DDD層の依存関係が単方向
- [ ] 全てのサービスがEffect-TSパターンに準拠
- [ ] 命名規則が統一されている
- [ ] 未使用コードが存在しない

## リスクと対策

### リスク1: 大規模な型変更による破壊的変更
**対策**: 
- 段階的な移行とテストの充実
- 型の後方互換性を維持する移行パス

### リスク2: パフォーマンスの低下
**対策**:
- Effect-TSの最適化パターンの適用
- ベンチマークテストの実施

### リスク3: 開発者の学習コスト
**対策**:
- Effect-TSのベストプラクティスドキュメント作成
- コードレビューによる知識共有

## 並列実行マトリックス

| Agent | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|-------|---------|---------|---------|---------|---------|
| A     | 1.1 ✓   | -       | -       | -       | -       |
| B     | 1.2 ✓   | -       | -       | -       | -       |
| C     | 1.3 ✓   | -       | -       | -       | -       |
| D     | 1.4 ✓   | -       | -       | -       | -       |
| E     | -       | 2.1 ✓   | -       | -       | -       |
| F     | -       | 2.2 ✓   | -       | -       | -       |
| G     | -       | -       | 3.1 ✓   | -       | -       |
| H     | -       | -       | 3.2 ✓   | -       | -       |
| I     | -       | -       | 3.3 ✓   | -       | -       |
| J     | -       | -       | -       | 4.1 ✓   | -       |
| K     | -       | -       | -       | 4.2 ✓   | -       |
| L     | -       | -       | -       | -       | 5.1 ✓   |
| M     | -       | -       | -       | -       | 5.2 ✓   |

✓ = 実行可能、- = 待機

## 次のステップ

1. **レビューと承認**: この計画書のレビューと承認
2. **環境準備**: 開発環境とCI/CDパイプラインの準備
3. **Phase 1開始**: 型安全性向上タスクの並列実行
4. **進捗モニタリング**: 週次レビューとKPI追跡
5. **継続的改善**: フィードバックに基づく計画の調整

---

*本計画書は、Effect-TSベストプラクティスとDDD原則に基づいて作成されました。*
*最終更新: 2025-09-12*