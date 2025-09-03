# テスティング (Testing)

本プロジェクトでは、コードの品質と信頼性を保証するため、テストを非常に重視しています。テストフレームワークにはViteネイティブの高速なテスターである **Vitest** を採用し、ユニットテストとプロパティベーステストを組み合わせています。

- **設定ファイル**: `vite.config.ts` (Vitestの設定を含む)
- **テスト実行コマンド**: `pnpm test`

---

## 1. テストの実行

プロジェクトのルートディレクトリで以下のコマンドを実行することで、すべてのテストが実行されます。

```bash
pnpm test
```

インタラクティブなUIでテスト結果を確認したい場合は、以下のコマンドを使用します。

```bash
pnpm test --ui
```

## 2. ユニットテスト (Unit Testing)

ユニットテストは、個々の関数やシステムが期待通りに動作するかを検証することを目的とします。

- **ファイル命名規則**: テスト対象のファイル名に `.spec.ts` を付与します (例: `world.ts` -> `world.spec.ts`)。
- **場所**: テストファイルは、テスト対象のソースコードが含まれるディレクトリ内の `__test__/` ディレクトリに配置します (例: `src/domain/__test__/world.spec.ts`)。
- **共有ヘルパー**: 複数のドメインやレイヤーを横断して共有されるテストヘルパーは `src/__test__/` ディレクトリに配置します。

### Effectプログラムのテスト

[Effect](https://effect.website/)でラップされたプログラムをテストする場合、`Effect.runPromise` を使用してEffectを実行し、その結果を検証します。

```typescript
// src/domain/__test__/world.spec.ts の例
import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'
import { World, WorldLive } from '@/domain/world'
import { Position } from '@/domain/components'
import { createArchetype } from '@/domain/archetypes'

describe('World', () => {
  it('should create an entity and retrieve its component', async () => {
    // 1. テスト用のEffectプログラムを構築
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const position = new Position({ x: 1, y: 2, z: 3 })
      const blockArchetype = yield* _(createArchetype({ type: 'block', pos: position, blockType: 'stone' }))
      const entity = yield* _(world.addArchetype(blockArchetype))
      const retrieved = yield* _(world.getComponent(entity, Position))
      return { position, retrieved }
    })

    // 2. Layerを使って依存性を注入し、Effectを実行
    const result = await Effect.runPromise(Effect.provide(program, WorldLive))

    // 3. 結果を検証
    expect(result.retrieved).toEqual(Option.some(result.position))
  })
})
```

## 3. プロパティベーステスト (Property-Based Testing)

プロパティベーステスト (PBT) は、開発者が手動でテストケースを考える代わりに、「どのような入力であっても、このプロパティ（性質）は常に真でなければならない」という不変条件を定義するテスト手法です。本プロジェクトでは、Effect-TSのエコシステムに統合された **`@effect/schema/Arbitrary`** と **`@effect/test`** を使用します。

PBTは、開発者が想定しないエッジケースを自動的に発見するのに非常に強力です。

- **使用例**: `src/domain/__test__/components.spec.ts` では、すべてのコンポーネントスキーマが「任意の有効な入力データに対して、エンコードとデコードが可逆的である（`decode(encode(data)) === data`）」というプロパティをテストしています。

```typescript
// src/domain/__test__/components.spec.ts の例
import * as S from '@effect/schema/Schema'
import * as Arbitrary from '@effect/schema/Arbitrary'
import { describe, it, expect } from '@effect/vitest'
import { Gen } from '@effect/test'
import { Position } from '@/domain/components'
import { Effect } from 'effect'

describe('Component Schemas', () => {
  it.effect('Position should be reversible after encoding and decoding', () =>
    Gen.forAll(Arbitrary.make(Position), (position) => {
      const encoded = S.encodeSync(Position)(position)
      const decoded = S.decodeSync(Position)(encoded)
      expect(decoded).toEqual(position)
      return Effect.void
    }),
  )
})
```

## 4. 浮動小数点数のテスト

物理演算や幾何学計算など、浮動小数点数を扱うテストでは、`toBe` や `toEqual` を使った直接比較は避けるべきです。これは、浮動小数点演算には誤差が伴い、テストが不安定になる原因となるためです。

代わりに、Vitestに組み込まれている `toBeCloseTo` マッチャーを使用してください。

### 例

```typescript
it('should handle floating point comparisons', () => {
  const result = 0.1 + 0.2
  const expected = 0.3

  // 失敗する可能性があるテスト
  // expect(result).toBe(expected);

  // 成功するテスト
  expect(result).toBeCloseTo(expected)
})
```

## 5. テストカバレッジ

コードベースの品質を保証するため、テストカバレッジは **90%以上** を目標とします。CIパイプラインでカバレッジレポートを生成し、この目標が維持されていることを確認します。

---

より詳細なテスト戦略については、[テスト戦略](./testing-strategy.md)のドキュメントを参照してください。
