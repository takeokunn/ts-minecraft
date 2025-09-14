## {{TITLE}}

### タスク
ID: `{{PHASE}}-{{NUMBER}}`
サイズ: `{{SIZE}}`
時間: `{{HOURS}}h`

### 成功基準
- [ ] Effect-TSパターン
- [ ] カバレッジ80%+
- [ ] 60FPS維持
- [ ] ドキュメント更新

### ファイル
```
# 新規
{{NEW_FILES}}

# 更新
{{UPDATE_FILES}}
```

### 仕様
```typescript
{{INTERFACE_DEFINITION}}
```

### 検証
```bash
pnpm typecheck
pnpm test:unit
pnpm lint
```

---
Labels: `{{LABELS}}`