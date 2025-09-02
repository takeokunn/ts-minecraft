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
- **場所**: テストファイルは、テスト対象のソースコードが含まれるディレクトリ内の `__test__/` ディレクトリに配置します (例: `src/domain/world.ts` -> `src/domain/__test__/world.spec.ts`)。
- **共有ヘルパー**: 複数のドメインやレイヤーを横断して共有されるテストヘルパーは `src/__test__/` ディレクトリに配置します。

### Effectプログラムのテスト

[Effect](https://effect.website/llms-full.txt)でラップされたプログラムをテストする場合、`Effect.runPromise` を使用してEffectを実行し、その結果を検証します。

```typescript
// src/runtime/world.test.ts の例
import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'
import { createEntity, World, WorldLive } from './world'
import { Position } from '../domain/components'

describe('World', () => {
  it('should create an entity and retrieve its component', () => {
    // 1. テスト用のEffectプログラムを構築
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const position = new Position({ x: 1, y: 2, z: 3 })
      const entity = yield* _(createEntity(position))
      const retrieved = yield* _(world.getComponent(entity, Position))
      return { position, retrieved }
    })

    // 2. Layerを使って依存性を注入し、Effectを実行
    const { position, retrieved } = await Effect.runPromise(Effect.provide(program, WorldLive))

    // 3. 結果を検証
    expect(retrieved).toEqual(position)
  })
})
```

## 3. プロパティベーステスト (Property-Based Testing)

プロパティベーステスト (PBT) は、開発者が手動でテストケースを考える代わりに、「どのような入力であっても、このプロパティ（性質）は常に真でなければならない」という不変条件を定義するテスト手法です。ライブラリには **fast-check** を使用します。

PBTは、開発者が想定しないエッジケースを自動的に発見するのに非常に強力です。

- **使用例**: `src/domain/components.test.ts` では、すべてのコンポーネントスキーマが「任意の有効な入力データに対して、エンコードとデコードが可逆的である（`decode(encode(data)) === data`）」というプロパティをテストしています。

```typescript
// src/domain/components.test.ts の例
import * as fc from 'fast-check'
import * as Schema from '@effect/schema/Schema'
import { describe, it, expect } from 'vitest'
import { Position } from './components' // Positionスキーマ

// PositionスキーマからArbitrary（任意データ生成器）を生成
const positionArbitrary = fc.record({
  x: fc.float(),
  y: fc.float(),
  z: fc.float(),
})

describe('Component Schemas', () => {
  it('Position should be reversible after encoding and decoding', () => {
    // プロパティを定義
    const property = fc.property(positionArbitrary, (position) => {
      const encoded = Schema.encodeSync(Position)(position)
      const decoded = Schema.decodeSync(Position)(encoded)
      expect(decoded).toEqual(position)
    })

    // fast-checkがプロパティを検証（デフォルトで100回ランダムなデータを生成）
    fc.assert(property)
  })
})
```
