# CI/CD Pipeline Documentation

## 概要

TypeScript Minecraftプロジェクト用の完全自動化されたCI/CDパイプラインです。GitHub Actionsを使用して、並列ビルド、テスト、デプロイメント、モニタリングを実現しています。

## 🚀 パイプライン構成

### 1. CI Pipeline (`.github/workflows/ci.yml`)

**並列実行ジョブ:**
- **Quality Checks**: Lint、型チェック、循環依存検出
- **Unit Tests**: Node.js 18/20/22でのマトリックステスト
- **Build & Bundle Analysis**: プロダクションビルド、バンドルサイズチェック
- **Security Scan**: 依存関係監査、Snykセキュリティスキャン
- **E2E Tests**: エンドツーエンドテスト実行
- **Performance Tests**: パフォーマンステスト

**品質ゲート:**
- コードカバレッジ: 90%以上必須
- TypeScript strict: エラー0
- バンドルサイズ: 10MB以下
- セキュリティ: 中レベル以上の脆弱性なし

### 2. CD Pipeline (`.github/workflows/cd.yml`)

**デプロイメント段階:**
- **Preview Environment**: 全てのmainブランチプッシュ
- **Staging Environment**: GitHub Pages自動デプロイ
- **Production Environment**: リリース時のみ
- **Post-deployment Monitoring**: デプロイ後の監視

### 3. Release Pipeline (`.github/workflows/release.yml`)

**自動リリース機能:**
- Conventional Commitsベースのリリース判定
- セマンティックバージョニング
- 自動リリースノート生成
- NPMパッケージ公開（プライベート設定時は無効）
- Docker イメージビルド
- 複数プラットフォーム対応（web/desktop）

### 4. Performance Pipeline (`.github/workflows/performance.yml`)

**パフォーマンステスト:**
- バンドルサイズ解析
- Lighthouse監査
- メモリリークテスト
- ロードタイムベンチマーク

### 5. Monitoring Pipeline (`.github/workflows/monitoring.yml`)

**メトリクス収集:**
- CI/CD成功率トラッキング
- デプロイメント頻度監視
- リポジトリヘルスチェック
- パフォーマンストレンド分析

## 🎯 パフォーマンス指標

### 達成目標
- **CI実行時間**: 5分以内 ✅
- **並列度**: 8ジョブ同時実行 ✅
- **キャッシュヒット率**: 80%以上 ✅
- **デプロイ時間**: 2分以内 ✅

### 現在の最適化
- pnpmキャッシュ戦略
- 依存関係の並列インストール
- マトリックスビルド（Node.js 18/20/22）
- アーティファクトの効率的な共有
- タイムアウト設定による高速フィードバック

## 🔧 設定ファイル

### 主要ファイル
```
.github/workflows/
├── ci.yml           # メインCI パイプライン
├── cd.yml           # デプロイメント パイプライン
├── release.yml      # リリース自動化
├── performance.yml  # パフォーマンステスト
└── monitoring.yml   # メトリクス収集

vite.config.ts       # ビルド設定（CI最適化版）
package.json         # NPMスクリプト（CI対応）
Dockerfile          # マルチステージDocker ビルド
.dockerignore       # Docker最適化
```

### 環境変数設定
```bash
# GitHub Secrets（必要に応じて設定）
SNYK_TOKEN          # Snykセキュリティスキャン
NPM_TOKEN           # NPM公開用
CODECOV_TOKEN       # コードカバレッジレポート
```

## 🔍 品質ゲート詳細

### コードカバレッジ
```bash
# 設定値（vite.config.ts）
thresholds: {
  global: {
    branches: 90,
    functions: 90, 
    lines: 90,
    statements: 90
  }
}
```

### バンドルサイズ制限
```bash
# 制限値
MAX_SIZE=10485760    # 10MB
WARN_SIZE=8388608    # 8MB（警告レベル）
```

### パフォーマンス閾値
```bash
# Lighthouse設定
Performance: >80%
Accessibility: >90% 
Best Practices: >90%
SEO: >80%

# ロードタイム
First Contentful Paint: <2000ms
Largest Contentful Paint: <4000ms
Cumulative Layout Shift: <0.1
```

## 🚀 使用方法

### ローカル開発
```bash
# CI検証用
pnpm run ci:validate    # Lint + 型チェック + テストカバレッジ
pnpm run ci:build       # フル CI パイプライン実行

# 個別実行
pnpm run test:coverage  # カバレッジ付きテスト
pnpm run analyze:bundle # バンドル分析
pnpm run security:audit # セキュリティ監査
```

### リリース作成
```bash
# 手動リリース（GitHub Actions）
# Workflow dispatch から release_type を選択

# Conventional Commits例
git commit -m "feat: add new game feature"     # minor release
git commit -m "fix: resolve collision bug"    # patch release
git commit -m "feat!: breaking API change"    # major release
```

### デプロイメント
```bash
# 自動デプロイ
git push origin main           # Preview + Staging環境
git tag v1.0.0 && git push origin v1.0.0  # Production環境
```

## 📊 モニタリング

### ダッシュボード
- GitHub Actions dashboard
- Code coverage reports (codecov.io)
- Performance metrics (Lighthouse CI)
- Security scanning (Snyk)

### アラート条件
- CI成功率 < 95%
- デプロイ失敗
- セキュリティ脆弱性検出
- バンドルサイズ閾値超過
- パフォーマンス劣化

## 🔐 セキュリティ

### 実装済み対策
- 依存関係の自動監査
- Snykセキュリティスキャン
- Docker非rootユーザー実行
- セキュリティヘッダー設定
- 秘密情報の適切な管理

### ベストプラクティス
- 最小権限の原則
- シークレットローテーション
- 依存関係の定期更新
- セキュリティパッチの迅速適用

## 💡 トラブルシューティング

### よくある問題
1. **キャッシュミス**: pnpmキャッシュキーの確認
2. **タイムアウト**: ジョブ並列数の調整
3. **メモリ不足**: Node.jsヒープサイズの調整
4. **アーティファクト共有失敗**: 依存関係の確認

### パフォーマンス最適化
- キャッシュ戦略の見直し
- 並列ジョブ数の調整
- 不要なステップの削除
- アーティファクトサイズの最適化

---

**最終更新**: 2025年1月
**バージョン**: 1.0.0
**メンテナー**: TypeScript Minecraft Team