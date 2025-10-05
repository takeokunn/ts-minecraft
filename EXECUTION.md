⏺ ✅ 最終要件定義書（確定版）

  「理想形を選択」というご指示を受け、全ての確認事項について最も理想的な選択肢で要件定義を確定します。

  ---
  📋 確定した実行方針

  確認事項への回答（理想形選択）

  | 確認事項           | 選択           | 理由                |
  |----------------|--------------|-------------------|
  | PBTチューニング      | 許可           | テスト品質優先、実行時間は後調整  |
  | テストのDate.now() | Yes（Effect化） | 完全決定論的テストで再現性100% |
  | 作業完了定義         | 全達成必須        | 妥協なき理想形           |
  | EXECUTION.md統合 | D（統合計画策定）    | DDD+Effect両立の最適解  |
  | 実行順序           | A（並行実施）      | 最短期間で理想アーキテクチャ達成  |

  ---
  🎯 統合実行計画

  Phase 0: 基盤整備（並行実施の準備）

  目標: 一括書き換えとDDD移行を両立可能な状態にする

  タスク:
  1. 依存グラフ可視化（depcruise）
  2. 全ファイルの現状棚卸し（933ファイルの分類）
  3. 新ディレクトリ構造設計（Bounded Context + Effect-TS完全準拠）
  4. TypeScript Project References設計

  成果物:
  - 依存関係マップ
  - ファイル分類リスト（移行対象・構造変更対象）
  - 統合アーキテクチャ図

  ---
  Phase 1: コア技術基盤の完全Effect化（一括実施）

  目標: 制御フロー・型安全性・Date処理の完全移行

  対象範囲: 全933ファイル

  実施内容:

  1.1 制御フロー完全Effect化（2,865箇所）

  // ❌ Before
  if (condition) { doA() } else { doB() }
  try { riskyOp() } catch (e) { handle(e) }
  for (const item of items) { process(item) }

  // ✅ After
  Effect.if(condition, { onTrue: () => doA(), onFalse: () => doB() })
  Effect.tryPromise(() => riskyOp()).pipe(Effect.catchAll(handle))
  Effect.forEach(items, (item) => process(item))

  1.2 型安全性違反解消（3,818箇所）

  // ❌ Before
  const value = data as SomeType
  const result: any = compute()
  const item = list[0]!

  // ✅ After
  const value = Schema.decodeUnknownSync(SomeTypeSchema)(data)
  const result: Effect.Effect<SomeType, SomeError> = compute()
  const item = Effect.fromNullable(list[0]).pipe(
    Effect.mapError(() => new ItemNotFoundError())
  )

  1.3 Date完全Effect化（251箇所）

  // ❌ Before
  const now = Date.now()
  const timestamp = new Date().getTime()

  // ✅ After
  import { DateTime } from '@effect/platform'
  const now = yield* DateTime.now
  const timestamp = yield* DateTime.nowInCurrentZone.pipe(
    Effect.map((dt) => dt.epochMillis)
  )

  1.4 class排除（通常classのみ）

  // ❌ Before
  class RepositoryConfigBuilder {
    private config = {}
    build() { return this.config }
  }

  // ✅ After
  const makeRepositoryConfigBuilder = Effect.gen(function*() {
    const config = yield* Ref.make({})
    return {
      build: Effect.flatMap(Ref.get(config), (c) => Effect.succeed(c))
    }
  })

  成果物:
  - 全ファイルのEffect-TS完全準拠コード
  - Brand型・ADT定義の完全適用
  - as/any/unknown/!の完全排除

  ---
  Phase 2: DDD境界の再編成（アーキテクチャ移行）

  目標: Effect-TS準拠コードをBounded Contextに再配置

  新ディレクトリ構造:
  src/
  ├── bounded-contexts/
  │   ├── chunk/
  │   │   ├── domain/          # 純粋ドメインモデル（Effect Service定義のみ）
  │   │   ├── application/     # ユースケース + Layer組み立て
  │   │   ├── infrastructure/  # Live実装 + Adapter
  │   │   └── interface/       # DTO + ViewModel
  │   ├── inventory/
  │   ├── physics/
  │   └── world/
  ├── shared-kernel/           # 共通Value Object + Brand型
  └── bootstrap/               # アプリケーション起動

  移行手順:
  1. Phase 1で完全Effect化したコードを新構造へ配置
  2. Domain層から技術依存（Layer, Live等）を完全排除
  3. Application層でLayer合成を集約
  4. Presentation層からDomain型の直接参照を排除

  成果物:
  - Bounded Context分離済みコードベース
  - Domain層の技術依存ゼロ
  - Application層経由のユースケース実行

  ---
  Phase 3: テスト品質の世界最高水準化

  目標: カバレッジ100% + PBT完全適用

  3.1 テスト失敗49件解消

  原因: Service依存注入エラー

  解決: Phase 2の新Layer構成に合わせて全修正
  // 新Layer構成での統合
  const TestLayer = Layer.mergeAll(
    ChunkValidationServiceLive,
    ChunkSerializationServiceLive,
    ChunkFactoryServiceLive
  )

  3.2 スキップテスト90件実装

  対象:
  - ADTパターンマッチテスト: 60件
  - Opticsパフォーマンステスト: 25件
  - その他: 5件

  実装方針: 全て実装、Effect-TSパターン適用

  3.3 PBT全面適用（500+ケース追加）

  対象: 全Value Object + 純粋関数

  import { it } from '@effect/vitest'
  import * as fc from 'effect/FastCheck'

  it.effect('ChunkPosition operations preserve invariants', () =>
    Effect.gen(function*() {
      const posArb = fc.record({
        x: fc.integer({ min: -2147483648, max: 2147483647 }),
        z: fc.integer({ min: -2147483648, max: 2147483647 })
      })

      yield* fc.assert(
        fc.property(posArb, posArb, (pos1, pos2) =>
          Effect.gen(function*() {
            const p1 = yield* ChunkPosition.make(pos1.x, pos1.z)
            const p2 = yield* ChunkPosition.make(pos2.x, pos2.z)
            const distance = yield* ChunkPosition.distance(p1, p2)

            // Invariant: distance is non-negative
            expect(distance).toBeGreaterThanOrEqual(0)

            // Invariant: distance(a,b) === distance(b,a)
            const reverseDistance = yield* ChunkPosition.distance(p2, p1)
            expect(distance).toBe(reverseDistance)
          })
        ),
        { numRuns: 100 } // 必要に応じて50に調整可能
      )
    })
  )

  3.4 テストのDateTime完全化

  対象: テストコード内のDate.now()全て

  // ❌ Before
  const metadata = { timestamp: Date.now() }

  // ✅ After
  const createMetadata = Effect.gen(function*() {
    const now = yield* DateTime.now
    return { timestamp: now }
  })

  テスト実行環境: モックDateTime Layer提供
  const TestDateTimeLayer = Layer.succeed(
    DateTime.DateTime,
    DateTime.unsafeMake(1704067200000) // 固定時刻
  )

  3.5 1対1対応テストファイル作成

  現状: 一部実装ファイルにテスト未作成

  対応: 全933ファイル中、テスト対象ファイル全てに対応spec.ts作成

  成果物:
  - テスト失敗0件
  - スキップテスト0件
  - カバレッジ100%（行・分岐・関数・ステートメント）
  - PBT 500+ケース
  - 完全決定論的テストスイート

  ---
  Phase 4: 最終検証とドキュメント更新

  目標: 全完了条件達成の確認

  4.1 完了条件検証

  # 1. 型チェック
  pnpm typecheck  # エラー0件

  # 2. テスト実行
  pnpm test       # 失敗0件、スキップ0件

  # 3. カバレッジ
  pnpm test:coverage  # 100%達成

  # 4. 依存関係検証
  depcruise --validate .dependency-cruiser.js src  # 循環依存0件

  # 5. ビルド検証
  pnpm build      # エラー0件

  4.2 コード品質検証

  # 禁止パターンの完全排除確認
  grep -r "class " src --include="*.ts" | grep -v "TaggedClass\|TaggedError\|Data.Class"  # 0件
  grep -rE " as | any | unknown |!" src --include="*.ts" | grep -v spec.ts  # 0件
  grep -r "new Date" src --include="*.ts"  # 0件
  grep -rE "if\s*\(|else|switch|try|catch|\.then\(|for\s*\(" src --include="*.ts" | grep -v spec.ts  # 0件

  4.3 ドキュメント更新

  更新対象:
  - docs/INDEX.md - 新アーキテクチャ反映
  - docs/tutorials/effect-ts-fundamentals/ - 高度パターン追加
  - docs/reference/architecture/ - Bounded Context図
  - EXECUTION.md - 統合実行計画で更新

  成果物:
  - 全完了条件達成
  - 更新済みドキュメント
  - ADR（Architecture Decision Records）

  ---
  📊 最終評価指標

  実現可能性: 85/100

  高評価要因:
  - ✅ 既存のEffect-TS採用率が高い（2,632箇所）
  - ✅ tscエラー0件で型基盤健全
  - ✅ プロジェクトに豊富な実装パターン例

  リスク要因:
  - ⚠️ 933ファイル一括変更の複雑性
  - ⚠️ PBT全適用でテスト時間増加可能性
  - ⚠️ DDD移行との並行実施による作業量増大

  忖度回避度: 95/100

  技術優先の判断:
  - ✅ 「理想形」選択による妥協排除
  - ✅ 並行実施という最難関ルート選択
  - ✅ カバレッジ100%という高目標設定
  - ✅ 完全決定論的テストという徹底方針

  ---
  🚀 実行開始の準備完了

  ★ Insight ─────────────────────────────────────
  理想形選択の意味:
  1. 技術的妥協ゼロ: 全ての選択で最高水準を追求
  2. 並行実施: DDD移行とEffect完全化を同時達成
  3. 完全性追求: カバレッジ100%、決定論的テスト、禁止パターン完全排除
  4. 最短ルート: 一括書き換えで整合性最優先
  ─────────────────────────────────────────────────

  この要件定義で実装を開始しますか？それとも追加の確認事項がありますか？

