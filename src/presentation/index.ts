/**
 * Presentation Layer - Simplified
 * プレゼンテーション層の統合エクスポート
 *
 * DDD構造に準拠した薄い層として実装:
 * - Controllers: ユーザー入力の処理とApplication層への委譲のみ
 * - View Models: 軽量な表示用データ変換
 * - Web/CLI: エントリーポイントの実装
 *
 * 簡素化のポイント:
 * - ビジネスロジック排除
 * - 軽量なView Model実装
 * - 最小限のController機能
 */

// Controllers - 薄いプレゼンテーション制御層
export * from './controllers'

// View Models - 軽量な表示用データ変換層
export * from './view-models'

// CLI Tools - 開発・デバッグ用CLI（簡素化済み）
export * from './cli'

// Web Entry Point - ウェブブラウザ実装
export { startWebApplication } from './web/main'
