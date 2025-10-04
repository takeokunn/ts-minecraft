/**
 * Aggregate Tests - Barrel Export
 *
 * Camera Domain Aggregatesの世界最高峰テストスイート
 * DDD不変性・ビジネスロジック・ドメインイベントテスト
 */

// Aggregate Root Tests
export * from './camera.spec'
export * from './player-camera.spec'

// Aggregate Tests統合
// 個別スペックファイルのテストが自動で実行される
