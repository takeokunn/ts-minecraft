# Vitest → Effect-TS テスト完全移行 実行計画書

## 📋 概要

プロジェクト全体のテストコードをEffect-TSパターンに完全移行する大規模リファクタリング。

**GitHub Issue**: [#214](https://github.com/takeokunn/ts-minecraft/issues/214)

## 📊 現状分析

### テストファイル統計

- **総テストファイル数**: 92個（\*.spec.ts）
- **fast-check使用ファイル**: 23個
- **fast-check使用箇所**: 505箇所
- **既存it.effect使用ファイル**: 2個

### 依存関係

```json
{
  "devDependencies": {
    "@effect/vitest": "^0.25.1", // 既に導入済み（未活用）
    "fast-check": "^4.3.0", // 削除対象
    "vitest": "^3.2.4"
  }
}
```

## 🎯 移行目標

1. **全92個のテストファイルで`it.effect`に統一**
2. **fast-checkから`@effect/vitest`の`prop`機能への完全移行**
3. **fast-checkパッケージの削除**
4. **Effect-TSの記述パターンへの統一**

## 🔄 移行パターン詳細

### Pattern 1: 基本的な同期テスト

```typescript
// Before (vitest)
it('should work', () => {
  const result = someFunction()
  expect(result).toBe(expected)
})

// After (Effect-TS)
it.effect('should work', () =>
  Effect.gen(function* () {
    const result = someFunction()
    expect(result).toBe(expected)
  })
)
```

### Pattern 2: 非同期テスト

```typescript
// Before
it('async test', async () => {
  const result = await fetchData()
  expect(result).toBe(expected)
})

// After
it.effect('async test', () =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () => fetchData(),
      catch: (error) => new FetchError({ cause: error }),
    })
    expect(result).toBe(expected)
  })
)
```

### Pattern 3: プロパティベーステスト（基本型）

```typescript
// Before (fast-check)
it('property test', () => {
  fc.assert(
    fc.property(fc.integer(), fc.string(), (num, str) => {
      expect(typeof num).toBe('number')
      expect(typeof str).toBe('string')
    })
  )
})

// After (Effect-TS)
it.prop('property test', { num: Schema.Number, str: Schema.String }, ({ num, str }) =>
  Effect.gen(function* () {
    expect(typeof num).toBe('number')
    expect(typeof str).toBe('string')
  })
)
```

### Pattern 4: 制約付き型のプロパティテスト

```typescript
// Before
fc.property(fc.integer({ min: 0, max: 100 }), fc.string({ minLength: 1, maxLength: 50 }), (age, name) => {
  /* test */
})

// After
it.prop(
  'constrained property test',
  {
    age: Schema.Number.pipe(Schema.int(), Schema.between(0, 100)),
    name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(50)),
  },
  ({ age, name }) =>
    Effect.gen(function* () {
      /* test */
    })
)
```

### Pattern 5: 複雑な構造体

```typescript
// Before
const userArb = fc.record({
  id: fc.integer({ min: 1 }),
  name: fc.string({ minLength: 1 }),
  emails: fc.array(fc.string()),
})

// After
const UserSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.positive()),
  name: Schema.String.pipe(Schema.minLength(1)),
  emails: Schema.Array(Schema.String),
})

it.prop('user test', { user: UserSchema }, ({ user }) =>
  Effect.gen(function* () {
    /* test */
  })
)
```

## 📋 型変換マッピング表

### 基本型

| fast-check                   | Effect-TS Schema                                         |
| ---------------------------- | -------------------------------------------------------- |
| `fc.integer()`               | `Schema.Number.pipe(Schema.int())`                       |
| `fc.nat()`                   | `Schema.Number.pipe(Schema.int(), Schema.nonNegative())` |
| `fc.float()`                 | `Schema.Number`                                          |
| `fc.string()`                | `Schema.String`                                          |
| `fc.boolean()`               | `Schema.Boolean`                                         |
| `fc.constantFrom(...values)` | `Schema.Literal(...values)`                              |
| `fc.constant(value)`         | `Schema.Literal(value)`                                  |

### 配列・コレクション

| fast-check                    | Effect-TS Schema                                         |
| ----------------------------- | -------------------------------------------------------- |
| `fc.array(fc.integer())`      | `Schema.Array(Schema.Number)`                            |
| `fc.array(T, {minLength: n})` | `Schema.Array(T).pipe(Schema.minItems(n))`               |
| `fc.array(T, {maxLength: n})` | `Schema.Array(T).pipe(Schema.maxItems(n))`               |
| `fc.set(fc.integer())`        | `Schema.Array(Schema.Number).pipe(Schema.uniqueItems())` |
| `fc.tuple(A, B)`              | `Schema.Tuple(A, B)`                                     |

### オブジェクト・レコード

| fast-check                                 | Effect-TS Schema                              |
| ------------------------------------------ | --------------------------------------------- |
| `fc.record({a: fc.integer()})`             | `Schema.Struct({a: Schema.Number})`           |
| `fc.dictionary(fc.string(), fc.integer())` | `Schema.Record(Schema.String, Schema.Number)` |
| `fc.object()`                              | `Schema.Unknown`                              |
| `fc.jsonObject()`                          | `Schema.parseJson(Schema.Unknown)`            |

### 文字列制約

| fast-check                     | Effect-TS Schema                                          |
| ------------------------------ | --------------------------------------------------------- |
| `fc.string({minLength: n})`    | `Schema.String.pipe(Schema.minLength(n))`                 |
| `fc.string({maxLength: n})`    | `Schema.String.pipe(Schema.maxLength(n))`                 |
| `fc.stringMatching(/pattern/)` | `Schema.String.pipe(Schema.pattern(/pattern/))`           |
| `fc.emailAddress()`            | `Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+$/))` |
| `fc.uuid()`                    | `Schema.UUID`                                             |

### 数値制約

| fast-check                     | Effect-TS Schema                                         |
| ------------------------------ | -------------------------------------------------------- |
| `fc.integer({min: a, max: b})` | `Schema.Number.pipe(Schema.int(), Schema.between(a, b))` |
| `fc.integer({min: 0})`         | `Schema.Number.pipe(Schema.int(), Schema.nonNegative())` |
| `fc.integer({min: 1})`         | `Schema.Number.pipe(Schema.int(), Schema.positive())`    |
| `fc.float({min: a, max: b})`   | `Schema.Number.pipe(Schema.between(a, b))`               |

### 特殊型

| fast-check                            | Effect-TS Schema                             |
| ------------------------------------- | -------------------------------------------- |
| `fc.option(fc.integer())`             | `Schema.Option(Schema.Number)`               |
| `fc.oneof(fc.string(), fc.integer())` | `Schema.Union(Schema.String, Schema.Number)` |
| `fc.mapToConstant(...entries)`        | `Schema.Literal(...entries.map(e => e.num))` |

## 🚀 実装手順

### Phase 1: 準備（15分）

```bash
# 1. Serenaメモリ確認
list_memories
read_memory effect-ts-control-flow-patterns

# 2. 現状確認
pnpm test
pnpm typecheck
```

### Phase 2: 自動変換スクリプト作成（30分）

```typescript
// scripts/migrate-tests.ts
import { globSync } from 'glob'
import { readFileSync, writeFileSync } from 'fs'

const files = globSync('src/**/*.spec.ts')

for (const file of files) {
  let content = readFileSync(file, 'utf-8')

  // Import変換
  content = content.replace(/import \* as fc from ['"]fast-check['"]/g, "import { Schema } from '@effect/schema'")

  // it → it.effect
  content = content.replace(/\bit\(/g, 'it.effect(')

  // fc.assert削除
  content = content.replace(/fc\.assert\(\s*fc\.property\((.*?)\)\s*\)/gs, 'it.prop($1)')

  writeFileSync(file, content)
}
```

### Phase 3: モジュール別移行（3時間）

#### 3.1 Core モジュール（30分）

- [ ] src/core/errors/**test**/AppError.spec.ts
- [ ] src/core/errors/**test**/AppError.effect-schema.spec.ts
- [ ] src/core/schemas/**test**/Config.spec.ts
- [ ] src/core/schemas/**test**/Config.effect-schema.spec.ts

#### 3.2 Shared モジュール（45分）

- [ ] src/shared/types/**test**/common-types.spec.ts
- [ ] src/shared/types/**test**/branded.spec.ts
- [ ] src/shared/errors/**test**/\*.spec.ts (5ファイル)
- [ ] src/shared/services/**test**/LoggerServiceTest.spec.ts

#### 3.3 Infrastructure モジュール（30分）

- [ ] src/infrastructure/rendering/**test**/types.spec.ts
- [ ] src/infrastructure/ecs/**test**/EntityManager.spec.ts

#### 3.4 Domain モジュール（1時間15分）

- [ ] src/domain/world/**test**/\*.spec.ts (6ファイル)
- [ ] src/domain/chunk/**test**/Chunk.spec.ts
- [ ] src/config/**test**/config.spec.ts

### Phase 4: 依存関係削除（15分）

```bash
# fast-check削除
pnpm remove fast-check

# package.json確認
cat package.json | grep -v fast-check
```

### Phase 5: 検証（30分）

```bash
# 型チェック
pnpm typecheck

# テスト実行
pnpm test

# カバレッジ確認
pnpm test:coverage

# ビルド確認
pnpm build
```

### Phase 6: ドキュメント更新（1時間30分）

#### Priority 1: テスト関連ドキュメント（30分）

```bash
# 主要テストドキュメントの更新
docs/how-to/testing/effect-ts-testing-patterns.md      # Effect-TSテスト完全ガイド
docs/how-to/testing/pbt-implementation-examples.md     # PBT実装例
docs/how-to/testing/testing-guide.md                   # テストガイド
docs/how-to/testing/comprehensive-testing-strategy.md  # テスト戦略
docs/how-to/testing/testing-standards.md               # テスト規約
docs/how-to/testing/advanced-testing-techniques.md     # 高度テスト技術
docs/reference/configuration/vitest-config.md          # Vitest設定
```

#### Priority 2: Effect-TSチュートリアル（20分）

```bash
docs/tutorials/effect-ts-fundamentals/effect-ts-testing.md  # Effect-TSテスト基礎
docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md # Effect-TSパターン
docs/tutorials/effect-ts-fundamentals/effect-ts-services.md # サービステスト
```

#### Priority 3: 開発ガイド（20分）

```bash
docs/how-to/development/development-conventions.md      # 開発規約
docs/how-to/development/effect-ts-migration-guide.md   # 移行ガイド
docs/explanations/design-patterns/test-patterns.md     # テストパターン解説
```

#### Priority 4: API・CLIリファレンス（20分）

```bash
docs/reference/cli/testing-commands.md                 # テストコマンド
docs/reference/api/effect-ts-effect-api.md            # Effect-TS API
docs/reference/configuration/package-json.md          # package.json更新
```

#### ドキュメント更新スクリプト

```bash
# fast-check参照の自動置換
find docs -name "*.md" -exec grep -l "fast-check\|fc\." {} \; | \
while read file; do
  echo "Updating: $file"
  sed -i 's/fast-check/@effect\/vitest/g' "$file"
  sed -i 's/fc\./Schema./g' "$file"
  sed -i 's/fc\.assert/it.prop/g' "$file"
done

# 検証
grep -r "fast-check" docs/ || echo "✅ No fast-check references found"
grep -r "fc\." docs/ || echo "✅ No fc. references found"
```

### Phase 7: PR作成（15分）

```bash
# 変更をコミット
git add -A
git commit -m "feat: migrate all tests to Effect-TS pattern

- Replace all 'it' with 'it.effect'
- Migrate fast-check to @effect/vitest prop
- Remove fast-check dependency
- Unify test patterns with Effect-TS"

# PR作成
gh pr create \
  --title "feat: Vitest → Effect-TS テスト完全移行" \
  --body "Closes #214"
```

## 📊 進捗トラッキング

### コード移行進捗

| モジュール      | ファイル数 | fast-check箇所 | 移行状態 |
| --------------- | ---------- | -------------- | -------- |
| core/errors     | 2          | 28             | ⏳       |
| core/schemas    | 2          | 61             | ⏳       |
| shared/types    | 2          | 54             | ⏳       |
| shared/errors   | 5          | 100            | ⏳       |
| shared/services | 1          | 18             | ⏳       |
| infrastructure  | 2          | 58             | ⏳       |
| domain/world    | 6          | 91             | ⏳       |
| domain/chunk    | 1          | 19             | ⏳       |
| config          | 1          | 61             | ⏳       |

## ✅ 完了条件チェックリスト

- [ ] 全92ファイルで`it.effect`使用
- [ ] fast-check import文が0
- [ ] package.jsonからfast-check削除
- [ ] `pnpm typecheck` PASS
- [ ] `pnpm test` PASS
- [ ] `pnpm build` PASS
- [ ] テストカバレッジ維持
- [ ] PR作成・CI通過
- [ ] Issue #214 クローズ

## 🎯 成果物

1. **移行済みテストコード**: 92ファイル
2. **削除されたパッケージ**: fast-check
3. **統一されたテストパターン**: Effect-TS
4. **更新済みドキュメント**: 151ファイル
5. **GitHub PR**: Effect-TS移行PR（ドキュメント更新含む）
6. **実行計画書**: 本ドキュメント

### ドキュメント更新進捗

| カテゴリ                | ファイル数 | 優先度 | 更新状態 |
| ----------------------- | ---------- | ------ | -------- |
| テスト関連              | 7          | P1     | ⏳       |
| Effect-TSチュートリアル | 3          | P2     | ⏳       |
| 開発ガイド              | 3          | P3     | ⏳       |
| APIリファレンス         | 3          | P4     | ⏳       |
| その他テスト関連        | 135        | P5     | ⏳       |
| **合計**                | **151**    | -      | ⏳       |

## 📈 期待される効果

- **型安全性向上**: Effect-TS型システムの完全活用
- **保守性向上**: 単一のテストパターン
- **依存関係軽量化**: fast-check削除（-1 dependency）
- **開発効率向上**: 統一されたエラーハンドリング
- **ドキュメント整合性**: 全ドキュメントが最新パターンに準拠
- **学習コスト削減**: 一貫したテストパターンと豊富なサンプル

---

**実行開始時刻**: -
**実行完了時刻**: -
**総所要時間**: 約6-8時間（ドキュメント更新含む）
