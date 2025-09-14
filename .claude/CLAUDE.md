# TypeScript Minecraft Clone

## 開発フロー
1. ROADMAP → Sprint計画
2. Sprint → Issue分解（1PR/Issue）
3. Issue → 実装・テスト・ドキュメント
4. PR → 自動検証 → 人間レビュー

## プロジェクト
- Effect-TS 3.17+ / DDD×ECS / 完全関数型
- 目標: 60FPS / メモリ2GB以下 / カバレッジ80%+

## 制約
- クラス禁止（Data.Class除く）
- var/let/any/async/await禁止
- Effect.gen/Schema.Struct必須

## コマンド
```bash
# 開発
pnpm dev
pnpm test:unit
pnpm typecheck
pnpm lint

# Sprint管理
./scripts/sprint-start.sh $SPRINT_NUMBER
./scripts/create-issues.sh $PHASE
./scripts/pr-validate.sh $ISSUE_NUMBER
```

## パターン
```typescript
// Service
export const Service = Context.GenericTag<I>("@minecraft/Service")

// Data
export const Data = Schema.Struct({ field: Schema.String })

// Error
export const Error = Schema.TaggedError("Error")({ detail: Schema.String })

// Layer
export const ServiceLive = Layer.effect(Service, makeService())
```

## 品質ゲート
- [ ] Effect-TS 95%+
- [ ] カバレッジ 80%+
- [ ] 60FPS維持
- [ ] メモリリークなし
- [ ] ドキュメント更新

## 参照
- ROADMAP.md - 実装計画
- docs/ - 仕様書（100%完備）
- .claude/automation/ - 自動化スクリプト