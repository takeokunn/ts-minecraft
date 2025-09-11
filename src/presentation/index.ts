/**
 * Presentation Layer
 * プレゼンテーション層の統合エクスポート
 * 
 * 薄い層として実装され、ビジネスロジックを含まない
 * - Controllers: ユーザー入力の処理とアクションの委譲
 * - View Models: 表示用データの変換と整形
 * - CLI/Web: 具体的なプレゼンテーション実装
 */

// Controllers - プレゼンテーション制御層
export * from './controllers'

// View Models - 表示用データ変換層
export * from './view-models'

// CLI Tools - 開発・デバッグ用CLI
export * from './cli'

// Web Implementation - ウェブブラウザ実装
export * from './web/main'

// 廃止: UI機能はUIControllerに統合済み