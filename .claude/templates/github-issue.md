# GitHub Issue Template

## 📌 タスク概要
**タスクID**: `{{PHASE}}-{{NUMBER}}`
**タイトル**: `{{TITLE}}`
**サイズ**: `{{SIZE}}` (XS/S/M)
**推定時間**: `{{HOURS}}時間`
**フェーズ**: `{{PHASE_NAME}}`
**優先度**: `{{PRIORITY}}`

## 🎯 成功基準
- [ ] Effect-TSのContext.GenericTagでサービス定義
- [ ] Schema.Structで全データ型定義
- [ ] 単体テスト作成（カバレッジ80%以上）
- [ ] Property-Based Test実装
- [ ] パフォーマンステスト（{{PERFORMANCE_TARGET}}）
- [ ] ドキュメント更新

## 📁 実装対象

### 新規作成
```
{{NEW_FILES}}
```

### 更新対象
```
{{UPDATE_FILES}}
```

## 🔧 技術仕様

### インターフェース定義
```typescript
{{INTERFACE_DEFINITION}}
```

### スキーマ定義
```typescript
{{SCHEMA_DEFINITION}}
```

### エラー定義
```typescript
{{ERROR_DEFINITION}}
```

## 📝 実装ガイドライン

### 必須パターン
1. **サービス定義**: Context.GenericTag使用
2. **データ定義**: Schema.Struct使用
3. **エラー処理**: Schema.TaggedError使用
4. **非同期処理**: Effect.gen使用
5. **Layer構成**: Layer.effect使用

### 禁止事項
- ❌ クラス使用（Data.Class以外）
- ❌ async/await使用
- ❌ var/let使用
- ❌ any型使用
- ❌ 素のPromise/try-catch

## ✅ 検証手順

### 自動検証
```bash
# 型チェック
pnpm typecheck

# 単体テスト
pnpm test:unit {{TEST_PATH}}

# 統合テスト
pnpm test:integration {{TEST_PATH}}

# リント
pnpm lint {{FILE_PATH}}

# パフォーマンス
pnpm bench {{BENCHMARK_NAME}}
```

### 手動検証
1. [ ] 開発サーバーで動作確認
2. [ ] {{MANUAL_TEST_1}}
3. [ ] {{MANUAL_TEST_2}}
4. [ ] メモリリークチェック

## 📚 参考資料
- [Effect-TSパターン](../docs/tutorials/effect-ts-fundamentals/)
- [{{REFERENCE_DOC_1}}](../docs/{{REFERENCE_PATH_1}})
- [{{REFERENCE_DOC_2}}](../docs/{{REFERENCE_PATH_2}})

## 🔗 依存関係
- **ブロッカー**: {{BLOCKER_ISSUES}}
- **依存Issue**: {{DEPENDENCY_ISSUES}}
- **関連PR**: {{RELATED_PRS}}

## 📊 受け入れ基準
- [ ] 全自動テストがグリーン
- [ ] カバレッジ80%以上
- [ ] パフォーマンス目標達成
- [ ] ドキュメント更新完了
- [ ] コードレビュー承認

## 💡 実装ヒント
{{IMPLEMENTATION_HINTS}}

---
**Labels**: `{{LABELS}}`
**Assignees**: `@{{ASSIGNEE}}`
**Milestone**: `{{MILESTONE}}`
**Project**: `{{PROJECT}}`