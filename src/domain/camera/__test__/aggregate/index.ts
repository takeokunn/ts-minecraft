/**
 * Aggregate Tests - Barrel Export
 *
 * Camera Domain Aggregatesの世界最高峰テストスイート
 * DDD不変性・ビジネスロジック・ドメインイベントテスト
 */

// Aggregate Root Tests
export * from './camera.spec'
export * from './player_camera.spec'

// Aggregate Tests統合
// 個別スペックファイルのテストが自動で実行される
